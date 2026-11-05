// Google Drive access token + the ONE sign-in popup (owner, urgent 2026-11-04: «with every visit several small login
// windows open»). Causes found: (1) a reload/new tab with no same-tab token called signInWithPopup with NO user
// gesture — a window per page; (2) the 45 s timeout gave up on the promise but never closed the window, and the next
// try opened another; (3) the token lived in sessionStorage only, so every new tab started over.
//
// Rules here: a popup is opened ONLY from a click (callers), never on load; at most one window — a second request
// focuses the open one and shares its promise; a timeout CLOSES the window; the access token is kept with its expiry
// (localStorage, per account) and reused until it is about to expire, so no popup is needed while it is valid.

export const TOKEN_LS = "quran.drive.token.v2";
export const DEFAULT_TTL_S = 3600; // Google OAuth access tokens live ~1 h
export const EXPIRY_MARGIN_MS = 2 * 60 * 1000;
export const POPUP_TIMEOUT_MS = 60 * 1000; // owner, 2026-11-04: «مهلت ~۶۰ ثانیه»

function now() { return Date.now(); }

export function saveDriveToken(token, { expiresInS = DEFAULT_TTL_S, email = "", storage = safeStorage() } = {}) {
  if (!storage) return;
  try {
    if (!token) { storage.removeItem(TOKEN_LS); return; }
    storage.setItem(TOKEN_LS, JSON.stringify({ token, exp: now() + Number(expiresInS || DEFAULT_TTL_S) * 1000, email: email || "" }));
  } catch { /* quota / private mode: the in-memory token still works this session */ }
}

// The stored token if it belongs to this account and is not about to expire; else null (and the stale entry is dropped).
export function loadDriveToken({ email = "", storage = safeStorage() } = {}) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(TOKEN_LS);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || !v.token || !v.exp || (v.email && email && v.email !== email) || v.exp - EXPIRY_MARGIN_MS <= now()) {
      storage.removeItem(TOKEN_LS);
      return null;
    }
    return v.token;
  } catch { return null; }
}

export function tokenExpiresAt({ storage = safeStorage() } = {}) {
  try { const v = JSON.parse(storage.getItem(TOKEN_LS) || "null"); return v && v.exp ? v.exp : null; } catch { return null; }
}

function safeStorage() {
  try { return typeof window !== "undefined" && window.localStorage ? window.localStorage : null; } catch { return null; }
}

// --- the single popup -------------------------------------------------------------------------------------------
let inFlight = null;   // the pending promise
let popupWin = null;   // the window it opened (captured from window.open)

export function popupOpen() { return !!inFlight; }

/**
 * Run a popup sign-in (`run` calls e.g. signInWithPopup) with at most ONE window:
 * - while one is pending, a new call focuses that window and returns the same promise;
 * - after `timeoutMs` the window is closed and the promise rejects with code "drive-popup-timeout".
 * Must be called from a user gesture (click) — never on page load.
 */
export function singlePopup(run, { timeoutMs = POPUP_TIMEOUT_MS, win = typeof window !== "undefined" ? window : null } = {}) {
  if (inFlight) {
    try { if (popupWin && !popupWin.closed) popupWin.focus(); } catch { /* cross-origin: focus may be refused */ }
    return inFlight;
  }
  let restore = () => {};
  if (win && typeof win.open === "function") {
    const orig = win.open;
    restore = () => { if (win.open !== orig) win.open = orig; };
    win.open = function captureOpen(...args) {
      const w = orig.apply(win, args);
      popupWin = w;
      restore();
      return w;
    };
  }
  let timer = null;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => {
      try { if (popupWin && !popupWin.closed) popupWin.close(); } catch { /* ignore */ }
      rej(Object.assign(new Error("drive-popup-timeout"), { code: "drive-popup-timeout" }));
    }, timeoutMs);
  });
  let started;
  try { started = Promise.resolve(run()); } catch (e) { started = Promise.reject(e); }
  inFlight = Promise.race([started, timeout]).finally(() => {
    clearTimeout(timer);
    restore();
    inFlight = null;
    popupWin = null;
  });
  return inFlight;
}

// What a failed/abandoned Drive popup means for the header (owner, urgent 2026-11-04: the chip sat on «⏳ بارگذاری از
// درایو…» while Google's small window waited for an account choice, then turned into «درایو وصل نیست» with no word).
export const PICK_MSG = 'حساب گوگل را در پنجرهٔ کوچک انتخاب کنید';
// 2026-11-05 (owner's screenshot: a blank white …firebaseapp.com/__/auth/handler window): measured with Playwright, the
// handler itself works (it reaches Google's sign-in) — what fails is handing the result back from the popup on
// firebaseapp.com to Firebase's iframe inside THIS site: browsers partition third-party storage, so the hand-off never
// arrives and the window stays white. The cure is a same-site authDomain (the /__/auth/* proxy on this host + the
// redirect URI in the OAuth client — an owner step, docs/supervisor/OPEN_ITEMS.md). Until then, say so plainly.
export const CROSS_SITE_HINT = 'علتِ محتمل: مرورگر نتیجهٔ ورود را از پنجرهٔ firebaseapp.com به این سایت نمی‌رساند (جداسازیِ ذخیره‌سازیِ شخصِ ثالث). «روشِ دوم: ورود با انتقالِ صفحه» را بزنید؛ راهِ قطعی یک تنظیمِ مالک است.';
export function isCrossSiteAuth(authDomain, host) {
  return !!authDomain && !!host && String(authDomain).toLowerCase() !== String(host).toLowerCase();
}

export function drivePopupOutcome(err, email = '', { crossSite = false } = {}) {
  const code = (err && err.code) || '';
  const hint = crossSite ? ` ${CROSS_SITE_HINT}` : '';
  if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/internal-error'].includes(code))
    return { redirect: true, status: 'reconnect', msg: 'پنجرهٔ کوچک باز نشد؛ به صفحهٔ گوگل منتقل می‌شوید…' };
  if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(code))
    return { redirect: false, status: 'retry', msg: `${PICK_MSG} — پنجره بسته شد پیش از انتخابِ حساب. «تلاش دوباره» را بزنید.${hint}` };
  if (code === 'drive-popup-timeout')
    return { redirect: false, status: 'retry', msg: `${PICK_MSG} — ۶۰ ثانیه بی‌پاسخ ماند و بسته شد. «تلاش دوباره» را بزنید.${hint}` };
  if (code === 'auth/user-mismatch')
    return { redirect: false, status: 'retry', msg: `حسابِ دیگری انتخاب شد؛ همان حسابی را انتخاب کنید که با آن وارد شده‌اید${email ? ` (${email})` : ''}.` };
  return { redirect: false, status: 'retry', msg: '' };
}

// tests only
export function _resetPopupForTests() { inFlight = null; popupWin = null; }
