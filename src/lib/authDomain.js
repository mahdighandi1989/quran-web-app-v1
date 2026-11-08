// Which host serves Firebase's sign-in window (/__/auth/handler), and can this browser reach it?
//
// 2026-11-08 (coordinator, urgent): on the owner's computer the small window
// quran-app-7566b.firebaseapp.com/__/auth/handler showed DNS_PROBE_FINISHED_NXDOMAIN. Measured from here: the domain
// EXISTS (Google + Cloudflare DNS-over-HTTPS → 199.36.158.100, the handler answers 200) — so it is THAT network's DNS
// that refuses firebaseapp.com (filtering), not a missing project. Two remedies, both here:
//
// 1) Same-site authDomain: this site already proxies /__/auth/* to Firebase (render.yaml rewrite, 7259bea; the handler,
//    handler.js and iframe answer 200 through it). With authDomain = this host the blocked domain is out of the path.
//    BUT Google's OAuth client must list https://<this host>/__/auth/handler as a redirect URI, or EVERY sign-in ends
//    on «redirect_uri_mismatch» (probed 2026-11-08: not registered yet). So the switch is per host and OFF until the
//    owner registers it (steps in docs/WORKLOG.md) — flip the flag below; VITE_FIREBASE_AUTH_DOMAIN still overrides.
// 2) Never open a window that cannot load: the auth host is probed in the background when the page loads; a click
//    reads the cached answer synchronously (an await before window.open would cost the click's user activation and
//    the browser would block the popup). Unreachable ⇒ one clear line, no window.

export const FIREBASE_AUTH_DOMAIN = "quran-app-7566b.firebaseapp.com";

/** host → is https://<host>/__/auth/handler registered on the Google OAuth web client? */
export const SAME_SITE_AUTH_HOSTS = {
  "quran-web-app-8rwy.onrender.com": false, // ← true once the owner adds the redirect URI + JS origin (WORKLOG)
};

export function pickAuthDomain({ envDomain = "", host = "" } = {}) {
  if (envDomain) return envDomain;
  const h = String(host || "").toLowerCase();
  if (SAME_SITE_AUTH_HOSTS[h] === true) return h;
  return FIREBASE_AUTH_DOMAIN;
}

// The Firebase project's OAuth WEB client id — public (it ships in every sign-in URL), not a secret. Used by the
// silent Drive refresh (GIS token client, src/lib/gisToken.js). GIS also demands that THIS origin be an «Authorized
// JavaScript origin» of the client; probed 2026-11-08 for quran-web-app-8rwy.onrender.com ⇒ redirect_uri_mismatch,
// i.e. not registered. Until it is, GIS can only fail (and its token flow uses a window), so the id is handed out per
// host only when registered — same owner step as the redirect URI above. VITE_GOOGLE_OAUTH_CLIENT_ID still overrides.
export const PUBLIC_OAUTH_WEB_CLIENT_ID = "31712827799-6quvsi0ic0qj4cgu8p7jmvbo47qsm8co.apps.googleusercontent.com";
export const GIS_ORIGIN_REGISTERED = {
  "quran-web-app-8rwy.onrender.com": false, // ← true once https://<host> is an Authorized JavaScript origin (WORKLOG)
};

export function pickGisClientId({ envId = "", host = "" } = {}) {
  if (envId) return envId;
  return GIS_ORIGIN_REGISTERED[String(host || "").toLowerCase()] === true ? PUBLIC_OAUTH_WEB_CLIENT_ID : "";
}

export const AUTH_UNREACHABLE_MSG =
  "اتصال ممکن نیست: دامنهٔ ورودِ گوگل (firebaseapp.com) از اینترنتِ این دستگاه باز نمی‌شود — با شبکهٔ دیگر یا VPN امتحان کنید؛ رفعِ دائمی یک تنظیمِ مالک است.";

const PROBE_TTL_MS = 5 * 60 * 1000;
let probe = { domain: "", at: 0, reachable: null, pending: null };

/** Background check; resolves true/false. Same host as the page ⇒ true without a request. */
export function probeAuthDomain(domain, { host = "", fetchImpl = globalThis.fetch, timeoutMs = 5000, now = Date.now } = {}) {
  if (!domain || String(domain).toLowerCase() === String(host || "").toLowerCase()) {
    probe = { domain, at: now(), reachable: true, pending: null };
    return Promise.resolve(true);
  }
  if (probe.domain === domain && probe.pending) return probe.pending;
  if (probe.domain === domain && probe.reachable !== null && now() - probe.at < PROBE_TTL_MS) return Promise.resolve(probe.reachable);
  if (typeof fetchImpl !== "function") return Promise.resolve(true);
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => ctl && ctl.abort(), timeoutMs);
  // no-cors: an opaque answer still proves DNS + TLS + server; a DNS failure (NXDOMAIN) rejects.
  const p = fetchImpl(`https://${domain}/__/auth/handler.js`, { mode: "no-cors", cache: "no-store", signal: ctl ? ctl.signal : undefined })
    .then(() => true, () => false)
    .then((ok) => { clearTimeout(timer); probe = { domain, at: now(), reachable: ok, pending: null }; return ok; });
  probe = { domain, at: 0, reachable: null, pending: p };
  return p;
}

/** Synchronous answer for a click: false only when a finished probe said «unreachable»; unknown ⇒ try. */
export function authDomainKnownUnreachable(domain) {
  return probe.domain === domain && probe.reachable === false;
}

// tests only
export function _resetProbeForTests() { probe = { domain: "", at: 0, reachable: null, pending: null }; }
