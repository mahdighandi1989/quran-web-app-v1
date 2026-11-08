// Google Drive «offline access»: one consent, then the server renews the Drive access token silently.
//
// Owner decision 2026-11-08 (via the coordinator): «هر کاری لازم است بکن تا همه چیز خودکار شود و نیاز به تمدید
// هرباره نباشد». Measured the same day: the browser-only silent renewal (GIS token client) opens a window even with
// prompt:"none", so it cannot run on page load / a 401 / a timer. The authorization-code flow can:
//
//   1. «اتصال» (a click) runs the GIS CODE client in a popup. GIS itself sends access_type=offline + prompt=consent, and
//      the code is returned to this origin by postMessage (redirect_uri "postmessage" — no extra redirect URI needed;
//      the site's JavaScript origin is already registered on the OAuth client).
//   2. POST /api/drive/connect { code } — this server exchanges the code with the client SECRET, checks the Google
//      account is the signed-in user's own (Drive about.user.emailAddress == verified Firebase e-mail), and keeps the
//      refresh token ENCRYPTED (AES-256-GCM, key = SHA-256 of DRIVE_TOKEN_KEY) in driveOfflineTokens/{uid}. That
//      collection is written only by this server (Admin SDK); firestore.rules' default deny keeps every browser out.
//   3. POST /api/drive/token — a fresh access token, no window, ever (page load, 401, timer).
//   4. POST /api/drive/disconnect — revokes the grant at Google and deletes the record.
//
// The refresh token never leaves this process in clear: not to the browser, not to a log, not to the repo. Errors are
// logged by Google's error CODE only. Scope = the app's existing Drive scope, nothing more.
import crypto from 'node:crypto';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
export const PUBLIC_CLIENT_ID = '31712827799-6quvsi0ic0qj4cgu8p7jmvbo47qsm8co.apps.googleusercontent.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const ABOUT_URL = 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)';
const CODE_RE = /^[\w./-]{10,512}$/; // Google authorization codes: «4/0A…» — letters, digits, / . _ -
const REUSE_MS = 5 * 60 * 1000; // hand out a cached access token while it still has ≥ 5 minutes

export class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra || {}; } }

export function configFrom(env = process.env) {
  const secret = String(env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const keyRaw = String(env.DRIVE_TOKEN_KEY || '').trim();
  return {
    clientId: String(env.GOOGLE_OAUTH_CLIENT_ID || '').trim() || PUBLIC_CLIENT_ID,
    clientSecret: secret,
    key: keyRaw.length >= 32 ? crypto.createHash('sha256').update(keyRaw, 'utf8').digest() : null,
    configured: !!(secret && keyRaw.length >= 32),
    missing: [!secret && 'GOOGLE_OAUTH_CLIENT_SECRET', keyRaw.length < 32 && 'DRIVE_TOKEN_KEY'].filter(Boolean),
  };
}

export function encrypt(key, plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}
export function decrypt(key, box) {
  if (!box || box.v !== 1) throw new Error('bad box');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
  d.setAuthTag(Buffer.from(box.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(box.ct, 'base64')), d.final()]).toString('utf8');
}

export function memoryDriveStore() {
  const m = new Map();
  return {
    async get(uid) { const v = m.get(uid); return v ? { ...v } : null; },
    async set(uid, v) { m.set(uid, { ...v }); },
    async del(uid) { m.delete(uid); },
    _raw: m,
  };
}
export function firestoreDriveStore(db) {
  const ref = (uid) => db.collection('driveOfflineTokens').doc(String(uid));
  return {
    async get(uid) { const s = await ref(uid).get(); return s.exists ? s.data() : null; },
    async set(uid, v) { await ref(uid).set(v); },
    async del(uid) { await ref(uid).delete(); },
  };
}

async function postForm(fetchImpl, url, form) {
  const r = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
  let j = {}; try { j = await r.json(); } catch { j = {}; }
  return { ok: r.ok, status: r.status, body: j };
}

export function createDriveOffline({ getStore, principal, env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), log = console }) {
  const cache = new Map(); // uid → { token, exp }  (access tokens only; short-lived)

  async function driveEmail(accessToken) {
    const r = await fetchImpl(ABOUT_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return '';
    const j = await r.json().catch(() => ({}));
    return String((j.user && j.user.emailAddress) || '').toLowerCase();
  }
  async function revoke(token) {
    try { await postForm(fetchImpl, REVOKE_URL, { token }); } catch { /* best effort */ }
  }

  async function connect(p, code) {
    const cfg = configFrom(env);
    if (!cfg.configured) throw new HttpError(503, 'اتصالِ دائمیِ درایو روی سرور هنوز تنظیم نشده', { missing: cfg.missing });
    if (!CODE_RE.test(String(code || ''))) throw new HttpError(400, 'کدِ گوگل نامعتبر است');
    const ex = await postForm(fetchImpl, TOKEN_URL, {
      code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: 'postmessage', grant_type: 'authorization_code',
    });
    if (!ex.ok || !ex.body.access_token) {
      log.warn && log.warn('[drive-offline] code exchange failed', ex.status, ex.body && ex.body.error);
      throw new HttpError(400, 'گوگل کد را نپذیرفت؛ «اتصال» را دوباره بزنید');
    }
    const { access_token: at, refresh_token: rt, expires_in: exp, scope = '' } = ex.body;
    if (!String(scope).split(/\s+/).includes(DRIVE_SCOPE)) {
      if (rt) await revoke(rt);
      throw new HttpError(400, 'اجازهٔ درایو داده نشد؛ در پنجرهٔ گوگل تیکِ دسترسی به درایو را بزنید');
    }
    // the grant must belong to the signed-in account — never store someone else's Drive under this uid
    const email = await driveEmail(at);
    if (!email || !p.email || email !== p.email) {
      if (rt) await revoke(rt); else await revoke(at);
      throw new HttpError(409, `حسابِ گوگلِ انتخاب‌شده با حسابِ واردشده یکی نیست${p.email ? ` (${p.email})` : ''}`);
    }
    if (!rt) throw new HttpError(400, 'گوگل اجازهٔ دائمی (refresh token) نداد؛ «اتصال» را دوباره بزنید');
    const store = getStore();
    if (!store) throw new HttpError(503, 'Firestore روی سرور وصل نیست');
    await store.set(p.uid, { enc: encrypt(cfg.key, rt), email, scope: DRIVE_SCOPE, createdAt: now(), updatedAt: now() });
    cache.set(p.uid, { token: at, exp: now() + (Number(exp) || 3600) * 1000 });
    log.info && log.info('[drive-offline] connected', p.uid);
    return { access_token: at, expires_in: Number(exp) || 3600, email };
  }

  async function token(p) {
    const cfg = configFrom(env);
    if (!cfg.configured) throw new HttpError(503, 'اتصالِ دائمیِ درایو روی سرور هنوز تنظیم نشده', { missing: cfg.missing });
    const c = cache.get(p.uid);
    if (c && c.exp - now() > REUSE_MS) return { access_token: c.token, expires_in: Math.floor((c.exp - now()) / 1000) };
    const store = getStore();
    if (!store) throw new HttpError(503, 'Firestore روی سرور وصل نیست');
    const rec = await store.get(p.uid);
    if (!rec || !rec.enc) throw new HttpError(404, 'درایو هنوز به‌صورتِ دائمی وصل نشده', { reconnect: true });
    let rt;
    try { rt = decrypt(cfg.key, rec.enc); } catch { throw new HttpError(410, 'کلیدِ رمزنگاریِ سرور عوض شده؛ «اتصال» را یک بار دیگر بزنید', { reconnect: true }); }
    const r = await postForm(fetchImpl, TOKEN_URL, { client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: rt, grant_type: 'refresh_token' });
    if (!r.ok || !r.body.access_token) {
      const err = r.body && r.body.error;
      log.warn && log.warn('[drive-offline] refresh failed', r.status, err);
      if (err === 'invalid_grant') { await store.del(p.uid); cache.delete(p.uid); throw new HttpError(410, 'اجازهٔ درایو در گوگل لغو شده؛ «اتصال» را یک بار دیگر بزنید', { reconnect: true }); }
      throw new HttpError(502, 'تمدیدِ توکنِ درایو موقتاً ناموفق بود');
    }
    const exp = Number(r.body.expires_in) || 3600;
    cache.set(p.uid, { token: r.body.access_token, exp: now() + exp * 1000 });
    await store.set(p.uid, { ...rec, updatedAt: now(), lastRefreshAt: now() });
    log.info && log.info('[drive-offline] refreshed', p.uid);
    return { access_token: r.body.access_token, expires_in: exp };
  }

  async function disconnect(p) {
    const cfg = configFrom(env);
    const store = getStore();
    const rec = store ? await store.get(p.uid) : null;
    if (rec && rec.enc && cfg.key) { try { await revoke(decrypt(cfg.key, rec.enc)); } catch { /* undecryptable: still delete */ } }
    if (store && rec) await store.del(p.uid);
    cache.delete(p.uid);
    log.info && log.info('[drive-offline] disconnected', p.uid);
    return { ok: true, had: !!rec };
  }

  async function status(p) {
    const cfg = configFrom(env);
    const store = getStore();
    const rec = store && cfg.configured ? await store.get(p.uid) : null;
    return { configured: cfg.configured, clientId: cfg.clientId, connected: !!(rec && rec.enc), email: rec ? rec.email : null };
  }

  return { connect, token, disconnect, status, _cache: cache };
}

// HTTP API (signed-in Google user only; the supervisor account has no Drive):
//   GET  /api/drive/health      → { configured }   (anonymous; a boolean only)
//   GET  /api/drive/status      → { configured, clientId, connected, email }
//   POST /api/drive/connect     { code } → { access_token, expires_in, email }
//   POST /api/drive/token       → { access_token, expires_in }
//   POST /api/drive/disconnect  → { ok }
export function createDriveOfflineApi({ service, principal, allowedOrigins, env = process.env }) {
  const cors = (req) => {
    const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', Vary: 'Origin' };
    const o = req.headers && req.headers.origin;
    if (o && allowedOrigins.includes(o)) h['Access-Control-Allow-Origin'] = o;
    return h;
  };
  const send = (req, res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) }); res.end(JSON.stringify(body)); };
  const readJson = (req) => new Promise((resolve) => {
    let b = ''; req.on('data', (c) => { b += c; if (b.length > 8192) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
  return {
    matches: (url) => /^\/api\/drive\/(health|status|connect|token|disconnect)\/?$/.test(String(url || '').split('?')[0]),
    async route(req, res) {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors(req)); return res.end(); }
      try {
        const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
        // Anonymous, for operators: is the server ready? A boolean only — never names, values or user data.
        if (path === '/api/drive/health' && req.method === 'GET') return send(req, res, 200, { configured: configFrom(env).configured });
        const p = await principal(req);
        if (!p || p.isSupervisor) return send(req, res, 401, { error: 'برای درایو باید با حسابِ گوگلِ خودتان وارد شوید' });
        if (path === '/api/drive/status' && req.method === 'GET') return send(req, res, 200, await service.status(p));
        if (req.method !== 'POST') return send(req, res, 405, { error: 'روشِ نامعتبر' });
        if (path === '/api/drive/connect') { const b = await readJson(req); return send(req, res, 200, await service.connect(p, b.code)); }
        if (path === '/api/drive/token') return send(req, res, 200, await service.token(p));
        if (path === '/api/drive/disconnect') return send(req, res, 200, await service.disconnect(p));
        return send(req, res, 404, { error: 'مسیر پیدا نشد' });
      } catch (e) {
        const status = e && e.status ? e.status : 500;
        if (status === 500) console.error('[drive-offline] internal', e && e.message);
        return send(req, res, status, { error: status === 500 ? 'خطای داخلیِ سرور' : e.message, ...(e && e.extra) });
      }
    },
  };
}
