// Proving that a Telegram chat belongs to an app account — before the bot answers it or sends it anything.
//
// Before: the bot mapped an incoming chat to whichever account had typed that chat id into its own
// telegramConfigs doc (array-contains … limit 1). Anyone could type SOMEONE ELSE's chat id: that person's
// /status then showed the attacker's data, and the server's reminder loop sent the attacker's messages
// to them. Nothing proved the chat was theirs.
//
// Now: a link exists only after the chat itself sends a one-time code that the signed-in owner got
// from the app (`/start <code>`, or the t.me deep link). Both collections below are written ONLY by
// this server (Admin SDK); firestore.rules' default deny keeps clients out — no rules change needed,
// and the users' own telegramConfigs documents are never modified by this module.
//
//   telegramLinkCodes/{code}  { uid, expiresAt }            one-time, 15 minutes
//   telegramLinks/{chatId}    { uid, linkedAt, via }        the proof
//   telegramMeta/links        { grandfatheredAt, count }    the one-time migration below
//
// Migration (once, at boot): a chat id that EXACTLY ONE account had already registered before this
// change is grandfathered as linked, so the existing owner's bot keeps working. Chat ids claimed by two
// or more accounts are NOT linked (that is precisely the ambiguous/hijack case) — they must re-link.
import crypto from 'node:crypto';

export const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_RE = /^[A-Za-z0-9_-]{12,64}$/;

export function newLinkCode() {
  return crypto.randomBytes(12).toString('base64url'); // 16 chars, valid as a Telegram /start payload
}

export function memoryLinkStore() {
  const codes = new Map(); const links = new Map(); const meta = new Map();
  return {
    async putCode(code, v) { codes.set(code, { ...v }); },
    async takeCode(code) { const v = codes.get(code); codes.delete(code); return v ? { ...v } : null; },
    async getLink(chatId) { const v = links.get(String(chatId)); return v ? { ...v } : null; },
    async setLink(chatId, v) { links.set(String(chatId), { ...v }); },
    async linksOf(uid) { return [...links.entries()].filter(([, v]) => v.uid === uid).map(([chatId, v]) => ({ chatId, ...v })); },
    async getMeta() { return { ...(meta.get('links') || {}) }; },
    async setMeta(v) { meta.set('links', { ...v }); },
  };
}

export function firestoreLinkStore(db) {
  const C = (n) => db.collection(n);
  return {
    async putCode(code, v) { await C('telegramLinkCodes').doc(code).set(v); },
    // One-time: read-and-delete inside a transaction, so a code can never link two chats.
    async takeCode(code) {
      return db.runTransaction(async (t) => {
        const ref = C('telegramLinkCodes').doc(code);
        const s = await t.get(ref);
        if (!s.exists) return null;
        t.delete(ref);
        return s.data();
      });
    },
    async getLink(chatId) { const s = await C('telegramLinks').doc(String(chatId)).get(); return s.exists ? s.data() : null; },
    async setLink(chatId, v) { await C('telegramLinks').doc(String(chatId)).set(v); },
    async linksOf(uid) { const q = await C('telegramLinks').where('uid', '==', uid).get(); return q.docs.map((d) => ({ chatId: d.id, ...d.data() })); },
    async getMeta() { const s = await C('telegramMeta').doc('links').get(); return s.exists ? s.data() : {}; },
    async setMeta(v) { await C('telegramMeta').doc('links').set(v); },
  };
}

// Owner (signed in) asks for a code.
export async function issueCode(store, uid, now = Date.now()) {
  const code = newLinkCode();
  await store.putCode(code, { uid, expiresAt: now + CODE_TTL_MS, createdAt: now });
  return { code, expiresAt: now + CODE_TTL_MS };
}

// The chat sends `/start <code>`. Returns { ok, uid } or { ok:false, reason }.
export async function redeemCode(store, chatId, code, now = Date.now()) {
  if (!CODE_RE.test(String(code || ''))) return { ok: false, reason: 'invalid' };
  const v = await store.takeCode(String(code));
  if (!v) return { ok: false, reason: 'unknown' };
  if (Number(v.expiresAt) < now) return { ok: false, reason: 'expired' };
  await store.setLink(String(chatId), { uid: v.uid, linkedAt: now, via: 'code' });
  return { ok: true, uid: v.uid };
}

// Which account owns this chat? Only a PROVEN link counts.
export async function ownerOfChat(store, chatId) {
  const l = await store.getLink(String(chatId));
  return l && l.uid ? l.uid : null;
}

// Filter a config's recipients to chats proven to belong to `uid` (server-sent reminders/summaries).
export async function verifiedRecipients(store, uid, chatIds) {
  const out = [];
  for (const id of chatIds) if ((await ownerOfChat(store, id)) === uid) out.push(String(id));
  return out;
}

// One-time grandfathering of the pre-existing, unambiguous registrations. `configs`: [{ uid, chatIds }].
export async function grandfatherOnce(store, configs, now = Date.now()) {
  const meta = await store.getMeta();
  if (meta.grandfatheredAt) return { skipped: true, ...meta };
  const claims = new Map();
  for (const { uid, chatIds } of configs) for (const id of new Set((chatIds || []).map(String))) {
    if (!claims.has(id)) claims.set(id, new Set());
    claims.get(id).add(uid);
  }
  let linked = 0; let ambiguous = 0;
  for (const [chatId, uids] of claims) {
    if (uids.size !== 1) { ambiguous += 1; continue; }
    if (!(await store.getLink(chatId))) { await store.setLink(chatId, { uid: [...uids][0], linkedAt: now, via: 'grandfathered' }); linked += 1; }
  }
  const out = { grandfatheredAt: now, linked, ambiguous };
  await store.setMeta(out);
  return out;
}

// HTTP API for the app (signed-in owner only):
//   POST /api/telegram/link-code  → { code, expiresAt, botUsername, deepLink }
//   GET  /api/telegram/links      → { links: [{ chatId, linkedAt, via }] }
export function createLinkApi({ getStore, principal, botUsername, allowedOrigins, now = () => Date.now() }) {
  const cors = (req) => {
    const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', Vary: 'Origin' };
    const o = req.headers && req.headers.origin;
    if (o && allowedOrigins.includes(o)) h['Access-Control-Allow-Origin'] = o;
    return h;
  };
  const send = (req, res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) }); res.end(JSON.stringify(body)); };
  return {
    matches: (url) => /^\/api\/telegram\/(link-code|links)\/?$/.test(String(url || '').split('?')[0]),
    async route(req, res) {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors(req)); return res.end(); }
      try {
        const p = await principal(req);
        if (!p || p.isSupervisor) return send(req, res, 401, { error: 'برای اتصالِ تلگرام باید با حسابِ گوگلِ خودتان وارد شوید' });
        const store = getStore();
        if (!store) return send(req, res, 503, { error: 'Firestore روی سرورِ بات وصل نیست' });
        const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
        if (path === '/api/telegram/link-code' && req.method === 'POST') {
          const { code, expiresAt } = await issueCode(store, p.uid, now());
          const user = await botUsername();
          return send(req, res, 200, { code, expiresAt, botUsername: user || null, deepLink: user ? `https://t.me/${user}?start=${code}` : null });
        }
        if (path === '/api/telegram/links' && req.method === 'GET') {
          const links = (await store.linksOf(p.uid)).map(({ chatId, linkedAt, via }) => ({ chatId, linkedAt, via }));
          return send(req, res, 200, { links });
        }
        return send(req, res, 404, { error: 'مسیر پیدا نشد' });
      } catch (e) {
        const status = e && e.status ? e.status : 500;
        if (status === 500) console.error('[telegram-link]', e);
        return send(req, res, status, { error: status === 500 ? 'خطای داخلیِ سرور' : e.message });
      }
    },
  };
}
