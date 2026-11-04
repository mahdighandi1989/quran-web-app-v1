// Silent Google Drive token via Google Identity Services (GIS) token client, prompt=none.
// Owner sheet 3 decision (option B): no client secret / refresh token on the server. After the first
// consent, GIS can mint a fresh access token without UI. Needs the OAuth *web* client id of the
// Firebase project (VITE_GOOGLE_OAUTH_CLIENT_ID). Without it every call resolves null and the app
// falls back to the "reconnect" button (option C) — nothing breaks.
export const GIS_SRC = "https://accounts.google.com/gsi/client";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const GIS_TIMEOUT_MS = 8000;
// Refresh before the ~1h expiry.
export const GIS_REFRESH_MS = 55 * 60 * 1000;

export function gisClientId() {
  try { return (import.meta.env && import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID) || ""; } catch { return ""; }
}

let loading = null;
function loadGis() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    try {
      const s = document.createElement("script");
      s.src = GIS_SRC; s.async = true;
      s.onload = () => resolve(!!(window.google && window.google.accounts && window.google.accounts.oauth2));
      s.onerror = () => { loading = null; resolve(false); };
      document.head.appendChild(s);
    } catch { loading = null; resolve(false); }
  });
  return loading;
}

// Resolves an access token string, or null (no client id / script blocked / consent needed / timeout).
// Never throws, never prompts (prompt=none), never uploads anything.
export async function requestDriveTokenSilently(hintEmail, { timeoutMs = GIS_TIMEOUT_MS, clientId = gisClientId() } = {}) {
  if (!clientId) return null;
  if (!(await loadGis())) return null;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        prompt: "none",
        hint: hintEmail || undefined,
        callback: (resp) => finish(resp && resp.access_token && !resp.error ? resp.access_token : null),
        error_callback: () => finish(null),
      });
      client.requestAccessToken({ prompt: "none", hint: hintEmail || undefined });
    } catch { finish(null); }
  });
}
