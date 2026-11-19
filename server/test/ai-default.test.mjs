import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { handleAiProxy, serverDefaultAI, aiDefaultStatus, createDailyQuota, resolveTarget } from '../ai-proxy.mjs';
import { resolveAI } from '../ai.mjs';

const ENV = { AI_DEFAULT_PROVIDER: 'google', AI_DEFAULT_MODEL: 'gemini-x', AI_DEFAULT_KEY: 'owner-key' };

test('server default AI: off unless provider (built-in), model and key are all set', () => {
  assert.equal(serverDefaultAI({}), null);
  assert.equal(serverDefaultAI({ ...ENV, AI_DEFAULT_KEY: '' }), null);
  assert.equal(serverDefaultAI({ ...ENV, AI_DEFAULT_PROVIDER: 'http://169.254.169.254' }), null, 'only built-in ids, no URL from env');
  const d = serverDefaultAI(ENV);
  assert.equal(d.kind, 'gemini'); assert.equal(d.model, 'gemini-x'); assert.match(d.baseUrl, /^https:\/\/generativelanguage/);
});

test('status endpoint never leaks the key', () => {
  const s = aiDefaultStatus(ENV);
  assert.equal(s.available, true); assert.equal(s.model, 'gemini-x');
  assert.doesNotMatch(JSON.stringify(s), /owner-key/);
  assert.deepEqual(aiDefaultStatus({}), { available: false });
});

test('daily quota per account', () => {
  const q = createDailyQuota(2);
  const t = Date.UTC(2026, 10, 19, 10);
  assert.equal(q('u', t), true); assert.equal(q('u', t), true); assert.equal(q('u', t), false);
  assert.equal(q('v', t), true, 'other account unaffected');
  assert.equal(q('u', t + 24 * 3600e3), true, 'resets next UTC day');
});

const deps = (over = {}) => ({ resolveAI, verifyIdToken: async () => 'uid1', getAiConfig: async () => null, defaultAI: serverDefaultAI(ENV), defaultQuota: () => true, ...over });

test('signed-in user without a key gets the default; their own key still wins', async () => {
  const r = await resolveTarget({ idToken: 't' }, deps());
  assert.equal(r.viaDefault, true); assert.equal(r.ai.key, 'owner-key');
  const own = await resolveTarget({ idToken: 't', model: 'm2' }, deps({ getAiConfig: async () => ({ activeProvider: 'openai', activeModel: 'gpt', keys: { openai: 'mine' } }) }));
  assert.equal(own.viaDefault, undefined); assert.equal(own.ai.key, 'mine');
  const forced = await resolveTarget({ idToken: 't', useDefault: true, model: 'hack' }, deps({ getAiConfig: async () => ({ activeProvider: 'openai', activeModel: 'gpt', keys: { openai: 'mine' } }) }));
  assert.equal(forced.ai.key, 'owner-key'); assert.equal(forced.ai.model, 'gemini-x', 'model override ignored on the default');
});

test('guests never reach the default; exhausted quota ⇒ 429; no default configured ⇒ 400', async () => {
  const guest = await resolveTarget({ useDefault: true }, deps());
  assert.equal(guest.status, 400);
  const bad = await resolveTarget({ idToken: 't' }, deps({ verifyIdToken: async () => { throw new Error('x'); } }));
  assert.equal(bad.status, 401);
  const out = await resolveTarget({ idToken: 't' }, deps({ defaultQuota: () => false }));
  assert.equal(out.status, 429);
  const none = await resolveTarget({ idToken: 't' }, deps({ defaultAI: null }));
  assert.equal(none.status, 400);
});

test('proxy end-to-end: default answer is marked viaDefault', async () => {
  const req = Readable.from([Buffer.from(JSON.stringify({ idToken: 't', useDefault: true, prompt: 'سلام' }))]);
  req.method = 'POST'; req.url = '/api/ai/proxy'; req.headers = {}; req.socket = { remoteAddress: '1.2.3.4' };
  const res = { status: 0, body: '', writeHead(s) { this.status = s; }, end(d) { this.body = d || ''; } };
  let used;
  await handleAiProxy(req, res, { ...deps(), allow: () => true, assertUrl: async () => {}, chat: async (ai) => { used = ai; return 'جواب'; } });
  assert.equal(res.status, 200);
  const j = JSON.parse(res.body);
  assert.equal(j.response, 'جواب'); assert.equal(j.viaDefault, true); assert.equal(used.key, 'owner-key');
  assert.doesNotMatch(res.body, /owner-key/);
});
