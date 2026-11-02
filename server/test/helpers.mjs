// Drive the inspection API in-process: a fake req (readable stream) and a capturing res.
import { Readable } from 'node:stream';
import { createInspectionApi } from '../inspection.mjs';
import { memoryStore } from '../lib/inspectionStore.mjs';

export const PNG = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');

export const USERS = {
  owner: { uid: 'u-owner', email: 'owner@example.com', email_verified: true },
  ownerUnverified: { uid: 'u-ov', email: 'owner@example.com', email_verified: false },
  alice: { uid: 'u-alice', email: 'alice@example.com', email_verified: true },
  bob: { uid: 'u-bob', email: 'bob@example.com', email_verified: true },
};

export function makeApi({ now } = {}) {
  const store = memoryStore();
  const clock = { t: Date.parse('2026-11-02T10:00:00Z') };
  const env = { ADMIN_EMAILS: 'owner@example.com', SUPERVISOR_PASSWORD: 'correct horse battery staple' };
  const api = createInspectionApi({
    getStore: () => store,
    verifyIdToken: async (tok) => { const u = USERS[tok]; if (!u) throw new Error('bad token'); return u; },
    env,
    now: now || (() => clock.t),
  });
  async function call(method, url, { as, body, raw = false } = {}) {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const req = Readable.from(payload ? [Buffer.from(payload)] : []);
    req.method = method; req.url = url;
    req.headers = { origin: 'http://localhost:5173' };
    if (as === 'supervisor') req.headers.authorization = `Supervisor ${token.value}`;
    else if (as) req.headers.authorization = `Bearer ${as}`;
    req.socket = { remoteAddress: '127.0.0.1' };
    const res = { status: 0, headers: {}, chunks: [],
      writeHead(s, h) { this.status = s; Object.assign(this.headers, h || {}); },
      end(d) { if (d) this.chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(String(d))); } };
    await api.route(req, res);
    const buf = Buffer.concat(res.chunks);
    return { status: res.status, headers: res.headers, body: raw ? buf : (buf.length ? JSON.parse(buf.toString('utf8')) : null) };
  }
  const token = { value: '' };
  async function loginSupervisor() {
    const r = await call('POST', '/api/inspection/supervisor/login', { body: { password: env.SUPERVISOR_PASSWORD } });
    token.value = r.body.token;
    return r;
  }
  return { api, store, env, clock, call, loginSupervisor };
}
