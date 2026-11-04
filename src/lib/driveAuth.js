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
export const POPUP_TIMEOUT_MS = 90 * 1000;

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

// tests only
export function _resetPopupForTests() { inFlight = null; popupWin = null; }
