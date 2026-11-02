// Who is calling? — the ONLY place roles are decided (the UI merely hides things).
//
//   admin      a Google-signed-in Firebase user whose VERIFIED email is in ADMIN_EMAILS (Render env)
//   user       any other signed-in Firebase user
//   supervisor the automated supervisor: no Google account; signs in with SUPERVISOR_PASSWORD
//              (Render env only) and gets a short-lived HMAC session token. A supervisor is never
//              an admin, so it can never tick (approve) its own work.
import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function adminEmails(env = process.env) {
  return String(env.ADMIN_EMAILS || '').split(/[,\s;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
function sessionKey(password) {
  return crypto.createHash('sha256').update('quran-supervisor-session\0' + password).digest();
}
function sign(key, payload) {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function issueSupervisorToken(password, now = Date.now()) {
  const payload = `sv1.${now + SESSION_TTL_MS}`;
  return `${payload}.${sign(sessionKey(password), payload)}`;
}
export function checkSupervisorToken(token, password, now = Date.now()) {
  if (!password || !token) return false;
  const m = String(token).match(/^(sv1\.(\d+))\.([A-Za-z0-9_-]+)$/);
  if (!m || Number(m[2]) < now) return false;
  return safeEqual(m[3], sign(sessionKey(password), m[1]));
}

// Failed supervisor logins per client: 5 per 15 minutes.
export function createLoginLimiter({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const fails = new Map();
  return {
    blocked(ip, now = Date.now()) {
      const xs = (fails.get(ip) || []).filter((t) => now - t < windowMs);
      fails.set(ip, xs);
      return xs.length >= max;
    },
    fail(ip, now = Date.now()) { fails.set(ip, [...(fails.get(ip) || []), now]); },
  };
}

export function supervisorLogin(password, given, limiter, ip, now = Date.now()) {
  if (!password) throw new HttpError(503, 'SUPERVISOR_PASSWORD روی سرویسِ بات در Render تنظیم نیست — حسابِ ناظر فعال نیست');
  if (limiter.blocked(ip, now)) throw new HttpError(429, 'تلاشِ ناموفقِ زیاد — ۱۵ دقیقهٔ دیگر');
  if (!safeEqual(given || '', password)) { limiter.fail(ip, now); throw new HttpError(401, 'رمزِ ناظر نادرست است'); }
  return issueSupervisorToken(password, now);
}

// Resolve the caller from the Authorization header. Returns null for anonymous.
//   Bearer <Firebase ID token>   |   Supervisor <session token>
export async function principalFrom(req, { verifyIdToken, env = process.env, now = Date.now() } = {}) {
  const h = String(req.headers?.authorization || '');
  const sup = h.match(/^Supervisor\s+(\S+)$/i);
  if (sup) {
    if (!checkSupervisorToken(sup[1], env.SUPERVISOR_PASSWORD, now)) throw new HttpError(401, 'نشستِ ناظر نامعتبر یا منقضی است — دوباره وارد شو');
    return { kind: 'supervisor', uid: 'supervisor', email: 'supervisor', isAdmin: false, isSupervisor: true };
  }
  const bearer = h.match(/^Bearer\s+(\S+)$/i);
  if (!bearer) return null;
  if (typeof verifyIdToken !== 'function') throw new HttpError(503, 'تأییدِ ورود روی سرور در دسترس نیست (Firebase Admin)');
  let decoded;
  try { decoded = await verifyIdToken(bearer[1]); } catch { throw new HttpError(401, 'ورودِ نامعتبر یا منقضی — دوباره وارد شوید'); }
  if (!decoded || !decoded.uid) throw new HttpError(401, 'ورودِ نامعتبر');
  const email = String(decoded.email || '').toLowerCase();
  const isAdmin = !!(email && decoded.email_verified === true && adminEmails(env).includes(email));
  return { kind: isAdmin ? 'admin' : 'user', uid: decoded.uid, email, name: decoded.name || '', isAdmin, isSupervisor: false };
}
