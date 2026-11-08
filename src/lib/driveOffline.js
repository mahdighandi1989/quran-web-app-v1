// Drive «offline access» client (owner decision 2026-11-08: everything automatic, no renewal clicks).
//
// One click on «اتصال» runs Google's authorization-CODE flow (GIS code client, popup — GIS adds access_type=offline and
// prompt=consent itself). The code goes to the bot server (server/driveOffline.mjs), which keeps the refresh token
// encrypted and hands this page short-lived access tokens on request — page load, a 401, the renewal timer — without
// ever opening a window. The browser never sees the refresh token. Every call carries the Firebase ID token; the
// server decides who the caller is.
//
// GIS must already be loaded when the click comes: an await before requestCode() would cost the click's user
// activation and the popup would be blocked. So the page preloads it (preloadGis) once the server says it is ready.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
export const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const DRIVE_API = String(
  import.meta.env.VITE_INSPECTION_API_URL || import.meta.env.VITE_AI_PROXY_URL || 'https://quran-telegram-bot-tnr7.onrender.com',
).replace(/\/+$/, '');

async function call(path, idToken, { method = 'GET', body, fetchImpl = globalThis.fetch } = {}) {
  const r = await fetchImpl(`${DRIVE_API}/api/drive/${path}`, {
    method,
    headers: { Authorization: `Bearer ${idToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = {}; try { j = await r.json(); } catch { j = {}; }
  return { ok: r.ok, status: r.status, body: j };
}

/** { configured, connected, clientId, email } — or null when the server cannot be asked. */
export async function driveOfflineStatus(idToken, opts) {
  try { const r = await call('status', idToken, opts); return r.ok ? r.body : null; } catch { return null; }
}

/** A fresh access token from the server, no window: { token, expiresIn } | { token:null, reconnect, status }. */
export async function serverDriveToken(idToken, opts) {
  try {
    const r = await call('token', idToken, { method: 'POST', ...opts });
    if (r.ok && r.body.access_token) return { token: r.body.access_token, expiresIn: Number(r.body.expires_in) || 3600 };
    return { token: null, reconnect: !!r.body.reconnect, status: r.status, error: r.body.error || '' };
  } catch { return { token: null, reconnect: false, status: 0, error: '' }; }
}

export async function disconnectDriveOffline(idToken, opts) {
  try { const r = await call('disconnect', idToken, { method: 'POST', ...opts }); return r.ok; } catch { return false; }
}

let gisLoading = null;
export function gisCodeReady() {
  return typeof window !== 'undefined' && !!(window.google && window.google.accounts && window.google.accounts.oauth2
    && typeof window.google.accounts.oauth2.initCodeClient === 'function');
}
export function preloadGis() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (gisCodeReady()) return Promise.resolve(true);
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve) => {
    try {
      const s = document.createElement('script');
      s.src = GIS_SRC; s.async = true;
      s.onload = () => resolve(gisCodeReady());
      s.onerror = () => { gisLoading = null; resolve(false); };
      document.head.appendChild(s);
    } catch { gisLoading = null; resolve(false); }
  });
  return gisLoading;
}

/**
 * MUST be called synchronously from a click handler (it opens Google's window). Resolves
 * { token, expiresIn, email } on success; rejects with an Error whose .code is 'popup_closed', 'access_denied', … or
 * the server's HTTP status. Requires gisCodeReady().
 */
export function connectDriveOffline({ clientId, email, getIdToken, fetchImpl }) {
  return new Promise((resolve, reject) => {
    if (!gisCodeReady()) { const e = new Error('gis-not-ready'); e.code = 'gis-not-ready'; reject(e); return; }
    const fail = (code, message) => { const e = new Error(message || code); e.code = code; reject(e); };
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      ux_mode: 'popup',
      login_hint: email || undefined,
      select_account: false,
      callback: async (resp) => {
        if (!resp || resp.error || !resp.code) { fail((resp && resp.error) || 'no_code'); return; }
        try {
          const idToken = await getIdToken();
          const r = await call('connect', idToken, { method: 'POST', body: { code: resp.code }, fetchImpl });
          if (!r.ok) { fail(String(r.status), r.body.error || 'اتصال ناموفق بود'); return; }
          resolve({ token: r.body.access_token, expiresIn: Number(r.body.expires_in) || 3600, email: r.body.email || '' });
        } catch (e) { fail('network', 'سرور در دسترس نبود'); }
      },
      error_callback: (err) => fail((err && err.type) || 'popup_failed'),
    });
    client.requestCode();
  });
}

/** One Persian line for a failed connect. */
export function connectErrorMessage(err) {
  const code = (err && err.code) || '';
  if (code === 'popup_closed' || code === 'access_denied') return 'پنجرهٔ گوگل بسته شد پیش از تأیید؛ «اتصال» را دوباره بزنید.';
  if (code === 'popup_failed_to_open' || code === 'popup_failed') return 'مرورگر پنجرهٔ گوگل را باز نکرد؛ اجازهٔ پنجرهٔ بازشو را برای این سایت بدهید و «اتصال» را دوباره بزنید.';
  if (/^\d{3}$/.test(code)) return (err && err.message) || 'اتصال ناموفق بود؛ دوباره امتحان کنید.';
  return 'اتصال به گوگل‌درایو ناموفق بود؛ «اتصال» را دوباره بزنید (داده‌های محلی حفظ شده‌اند).';
}
