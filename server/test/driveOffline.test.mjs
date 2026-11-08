// Drive offline access: one consent, then silent renewal from the server. The refresh token is encrypted at rest,
// never returned to the browser, never logged, and bound to the signed-in account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { configFrom, encrypt, decrypt, memoryDriveStore, createDriveOffline, createDriveOfflineApi, DRIVE_SCOPE } from '../driveOffline.mjs';

const ENV = { GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret', DRIVE_TOKEN_KEY: 'k'.repeat(40) };
const USER = { kind: 'user', uid: 'u1', email: 'owner@example.com', isSupervisor: false };
const RT = '1//refresh-token-SECRET';

function fakeGoogle({ email = 'owner@example.com', scope = DRIVE_SCOPE, refresh = RT, failRefresh = null } = {}) {
  const calls = []; let n = 0;
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const f = async (url, opts = {}) => {
    const body = opts.body ? Object.fromEntries(new URLSearchParams(opts.body)) : {};
    calls.push({ url, body, auth: opts.headers && opts.headers.Authorization });
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      if (body.grant_type === 'authorization_code') return json(200, { access_token: 'AT-0', expires_in: 3599, scope, ...(refresh ? { refresh_token: refresh } : {}) });
      if (failRefresh) return json(400, { error: failRefresh });
      n += 1; return json(200, { access_token: `AT-${n}`, expires_in: 3599, scope });
    }
    if (url.startsWith('https://oauth2.googleapis.com/revoke')) return json(200, {});
    if (url.startsWith('https://www.googleapis.com/drive/v3/about')) return json(200, { user: { emailAddress: email } });
    return json(404, {});
  };
  return { f, calls };
}
const quiet = { info() {}, warn() {}, error() {} };
function capture() { const lines = []; const rec = (...a) => lines.push(a.map(String).join(' ')); return { lines, log: { info: rec, warn: rec, error: rec } }; }

test('config: both secrets required; any 32+ char key works (SHA-256 derived)', () => {
  assert.equal(configFrom({}).configured, false);
  assert.deepEqual(configFrom({}).missing, ['GOOGLE_OAUTH_CLIENT_SECRET', 'DRIVE_TOKEN_KEY']);
  assert.equal(configFrom({ ...ENV, DRIVE_TOKEN_KEY: 'short' }).configured, false);
  assert.equal(configFrom(ENV).configured, true);
  assert.equal(configFrom(ENV).key.length, 32);
});

test('AES-256-GCM round trip; tampering and a different key fail', () => {
  const k = configFrom(ENV).key; const box = encrypt(k, RT);
  assert.equal(decrypt(k, box), RT);
  assert.ok(!JSON.stringify(box).includes('refresh-token'));
  assert.throws(() => decrypt(configFrom({ ...ENV, DRIVE_TOKEN_KEY: 'z'.repeat(40) }).key, box));
  assert.throws(() => decrypt(k, { ...box, ct: Buffer.from('x').toString('base64') }));
});

test('connect: exchanges with redirect_uri postmessage, stores ONLY ciphertext, returns no refresh token', async () => {
  const store = memoryDriveStore(); const g = fakeGoogle(); const { lines, log } = capture();
  const s = createDriveOffline({ getStore: () => store, env: ENV, fetchImpl: g.f, log });
  const out = await s.connect(USER, '4/0Aabc-DEF_ghi.jkl');
  assert.equal(out.access_token, 'AT-0'); assert.equal(out.email, 'owner@example.com');
  assert.ok(!JSON.stringify(out).includes(RT));
  const ex = g.calls.find((c) => c.body.grant_type === 'authorization_code');
  assert.equal(ex.body.redirect_uri, 'postmessage'); assert.equal(ex.body.client_secret, 'test-secret');
  const raw = JSON.stringify(store._raw.get('u1'));
  assert.ok(!raw.includes(RT), 'refresh token not stored in clear');
  assert.ok(!lines.join('\n').includes(RT) && !lines.join('\n').includes('test-secret'), 'never logged');
});

test('connect refuses another Google account and revokes the grant', async () => {
  const store = memoryDriveStore(); const g = fakeGoogle({ email: 'someone@else.com' });
  const s = createDriveOffline({ getStore: () => store, env: ENV, fetchImpl: g.f, log: quiet });
  await assert.rejects(s.connect(USER, '4/0Aabc-DEF_ghi.jkl'), (e) => e.status === 409);
  assert.equal(store._raw.size, 0);
  assert.ok(g.calls.some((c) => c.url.startsWith('https://oauth2.googleapis.com/revoke') && c.body.token === RT));
});

test('connect refuses a grant without the Drive scope, and a malformed code', async () => {
  const s1 = createDriveOffline({ getStore: () => memoryDriveStore(), env: ENV, fetchImpl: fakeGoogle({ scope: 'openid' }).f, log: quiet });
  await assert.rejects(s1.connect(USER, '4/0Aabc-DEF_ghi.jkl'), (e) => e.status === 400);
  await assert.rejects(s1.connect(USER, '<script>'), (e) => e.status === 400);
});

test('token: silent renewal after expiry — cached while fresh, refreshed when stale, no window involved', async () => {
  let t = 0; const store = memoryDriveStore(); const g = fakeGoogle();
  const s = createDriveOffline({ getStore: () => store, env: ENV, fetchImpl: g.f, now: () => t, log: quiet });
  await s.connect(USER, '4/0Aabc-DEF_ghi.jkl');
  assert.equal((await s.token(USER)).access_token, 'AT-0', 'fresh token reused');
  t = 3600 * 1000;                                        // an hour later: expired
  const r = await s.token(USER);
  assert.equal(r.access_token, 'AT-1');
  const rf = g.calls.find((c) => c.body.grant_type === 'refresh_token');
  assert.equal(rf.body.refresh_token, RT, 'decrypted server-side only');
  // a new process (cache gone) still renews from the stored ciphertext
  const s2 = createDriveOffline({ getStore: () => store, env: ENV, fetchImpl: g.f, now: () => t, log: quiet });
  assert.equal((await s2.token(USER)).access_token, 'AT-2');
});

test('token: revoked at Google ⇒ record deleted, 410 reconnect; not connected ⇒ 404', async () => {
  const store = memoryDriveStore();
  const ok = createDriveOffline({ getStore: () => store, env: ENV, fetchImpl: fakeGoogle().f, log: quiet });
  await assert.rejects(ok.token(USER), (e) => e.status === 404 && e.extra.reconnect);
  await ok.connect(USER, '4/0Aabc-DEF_ghi.jkl');
  let t = 10 * 3600 * 1000;
  const bad = createDriveOffline({ getStore: () => store, env: ENV, fetchImpl: fakeGoogle({ failRefresh: 'invalid_grant' }).f, now: () => t, log: quiet });
  await assert.rejects(bad.token(USER), (e) => e.status === 410 && e.extra.reconnect);
  assert.equal(store._raw.size, 0);
});

test('disconnect revokes at Google and deletes the record', async () => {
  const store = memoryDriveStore(); const g = fakeGoogle();
  const s = createDriveOffline({ getStore: () => store, env: ENV, fetchImpl: g.f, log: quiet });
  await s.connect(USER, '4/0Aabc-DEF_ghi.jkl');
  assert.deepEqual(await s.disconnect(USER), { ok: true, had: true });
  assert.equal(store._raw.size, 0);
  assert.ok(g.calls.some((c) => c.url.startsWith('https://oauth2.googleapis.com/revoke') && c.body.token === RT));
  assert.equal((await s.status(USER)).connected, false);
});

test('not configured ⇒ 503 with the missing variable names (no values)', async () => {
  const s = createDriveOffline({ getStore: () => memoryDriveStore(), env: {}, fetchImpl: fakeGoogle().f, log: quiet });
  await assert.rejects(s.token(USER), (e) => e.status === 503 && e.extra.missing.includes('DRIVE_TOKEN_KEY'));
  assert.equal((await s.status(USER)).configured, false);
});

function req(method, url, { auth = 'Bearer x', body = '', origin = 'https://quran-web-app-8rwy.onrender.com' } = {}) {
  const r = Readable.from(body ? [Buffer.from(body)] : []);
  r.method = method; r.url = url; r.headers = { authorization: auth, origin };
  return r;
}
function res() { const o = { status: 0, headers: {}, body: '' }; return Object.assign(o, { writeHead(s, h) { o.status = s; o.headers = h || {}; }, end(b) { o.body = b || ''; } }); }

test('HTTP: anonymous and supervisor refused; user gets a token; CORS only for the app origin', async () => {
  const store = memoryDriveStore();
  const service = createDriveOffline({ getStore: () => store, env: ENV, fetchImpl: fakeGoogle().f, log: quiet });
  const principal = async (r) => (r.headers.authorization === 'Bearer x' ? USER : r.headers.authorization === 'Supervisor s' ? { isSupervisor: true } : null);
  const api = createDriveOfflineApi({ service, principal, allowedOrigins: ['https://quran-web-app-8rwy.onrender.com'] });
  assert.ok(api.matches('/api/drive/token') && !api.matches('/api/drive/../x'));
  let o = res(); await api.route(req('POST', '/api/drive/token', { auth: '' }), o); assert.equal(o.status, 401);
  o = res(); await api.route(req('POST', '/api/drive/token', { auth: 'Supervisor s' }), o); assert.equal(o.status, 401);
  o = res(); await api.route(req('POST', '/api/drive/connect', { body: JSON.stringify({ code: '4/0Aabc-DEF_ghi.jkl' }) }), o);
  assert.equal(o.status, 200); assert.ok(!o.body.includes(RT));
  assert.equal(o.headers['Access-Control-Allow-Origin'], 'https://quran-web-app-8rwy.onrender.com');
  o = res(); await api.route(req('GET', '/api/drive/status', { origin: 'https://evil.example' }), o);
  assert.equal(JSON.parse(o.body).connected, true); assert.equal(o.headers['Access-Control-Allow-Origin'], undefined);
  o = res(); await api.route(req('GET', '/api/drive/token'), o); assert.equal(o.status, 405);
});

test('HTTP health: anonymous, a boolean only', async () => {
  const service = createDriveOffline({ getStore: () => memoryDriveStore(), env: ENV, fetchImpl: fakeGoogle().f, log: quiet });
  for (const [env, want] of [[ENV, true], [{}, false]]) {
    const svc = createDriveOffline({ getStore: () => memoryDriveStore(), env, fetchImpl: fakeGoogle().f, log: quiet });
    const api = createDriveOfflineApi({ service: svc, principal: async () => null, allowedOrigins: [], env });
    const o = res(); await api.route(req('GET', '/api/drive/health', { auth: '' }), o);
    assert.equal(o.status, 200); assert.equal(JSON.parse(o.body).configured, want);
    assert.ok(!o.body.includes('test-secret') && !o.body.includes('kkkk'));
  }
});

// 2026-11-09 production: the owner's connect failed with Google «invalid_client» (wrong secret on Render).
function googleRejectingClient() {
  return async (url, opts = {}) => {
    const body = opts.body ? Object.fromEntries(new URLSearchParams(opts.body)) : {};
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const okSecret = body.client_secret === 'right-secret';
      return { ok: false, status: okSecret ? 400 : 401, json: async () => ({ error: okSecret ? 'invalid_grant' : 'invalid_client' }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

test('wrong client secret: connect says it is a server setting (503), not «try again»', async () => {
  const s = createDriveOffline({ getStore: () => memoryDriveStore(), env: { ...ENV, GOOGLE_OAUTH_CLIENT_SECRET: 'wrong' }, fetchImpl: googleRejectingClient(), log: quiet });
  await assert.rejects(s.connect(USER, '4/0Aabc-DEF_ghi.jkl'), (e) => e.status === 503 && e.extra.server_setting === 'client_secret' && /GOOGLE_OAUTH_CLIENT_SECRET/.test(e.message));
});

test('health client_ok: false for a wrong secret, true for a right one, cached; never echoes the secret', async () => {
  let n = 0; const f = googleRejectingClient(); const counted = async (u, o) => { n += 1; return f(u, o); };
  const bad = createDriveOffline({ getStore: () => memoryDriveStore(), env: { ...ENV, GOOGLE_OAUTH_CLIENT_SECRET: 'wrong' }, fetchImpl: counted, log: quiet });
  assert.equal(await bad.checkClient(), false); assert.equal(await bad.checkClient(), false); assert.equal(n, 1, 'cached');
  const good = createDriveOffline({ getStore: () => memoryDriveStore(), env: { ...ENV, GOOGLE_OAUTH_CLIENT_SECRET: 'right-secret' }, fetchImpl: f, log: quiet });
  assert.equal(await good.checkClient(), true);
  const api = createDriveOfflineApi({ service: good, principal: async () => null, allowedOrigins: [], env: { ...ENV, GOOGLE_OAUTH_CLIENT_SECRET: 'right-secret' } });
  const o = res(); await api.route(req('GET', '/api/drive/health', { auth: '' }), o);
  assert.deepEqual(JSON.parse(o.body), { configured: true, client_ok: true }); assert.ok(!o.body.includes('right-secret'));
  assert.equal(await createDriveOffline({ getStore: () => null, env: {}, fetchImpl: f, log: quiet }).checkClient(), null);
});
