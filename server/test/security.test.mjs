import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { assertPublicHttpsUrl, isPrivateAddress, createRateLimiter, UnsafeUrlError } from '../lib/netguard.mjs';
import { handleAiProxy } from '../ai-proxy.mjs';
import { resolveAI } from '../ai.mjs';

const pub = async () => [{ address: '93.184.216.34' }];

test('SSRF guard: https + public addresses only', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.0.5', '172.20.0.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1', '0.0.0.0']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  await assert.rejects(assertPublicHttpsUrl('http://api.openai.com/v1', { lookup: pub }), UnsafeUrlError);
  await assert.rejects(assertPublicHttpsUrl('https://169.254.169.254/latest'), UnsafeUrlError);
  await assert.rejects(assertPublicHttpsUrl('https://localhost:8080'), UnsafeUrlError);
  await assert.rejects(assertPublicHttpsUrl('https://user:pw@example.com', { lookup: pub }), UnsafeUrlError);
  await assert.rejects(assertPublicHttpsUrl('https://evil.example', { lookup: async () => [{ address: '10.0.0.7' }] }), UnsafeUrlError, 'DNS that points inside is refused');
  await assertPublicHttpsUrl('https://api.openai.com/v1', { lookup: pub });
});

test('rate limiter: fixed window per key', () => {
  const allow = createRateLimiter({ max: 2, windowMs: 1000 });
  assert.equal(allow('a', 0), true); assert.equal(allow('a', 10), true); assert.equal(allow('a', 20), false);
  assert.equal(allow('b', 20), true);
  assert.equal(allow('a', 1500), true);
});

function call(body, { origin = 'https://quran-web-app-8rwy.onrender.com', deps = {} } = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = 'POST'; req.url = '/api/ai/proxy'; req.headers = { origin }; req.socket = { remoteAddress: '1.2.3.4' };
  const res = { status: 0, headers: {}, body: '', writeHead(s, h) { this.status = s; this.headers = h; }, end(d) { this.body = d || ''; } };
  let called = false;
  return handleAiProxy(req, res, { resolveAI, chat: async () => { called = true; return 'ok'; }, allow: () => true, ...deps })
    .then(() => ({ res, called, json: res.body ? JSON.parse(res.body) : null }));
}

test('AI proxy refuses a guest base URL that points inside, without calling it', async () => {
  const r = await call({ provider: { id: 'x', kind: 'openai', baseUrl: 'http://169.254.169.254/latest' }, model: 'm', key: 'k', prompt: 'hi' });
  assert.equal(r.res.status, 400);
  assert.equal(r.called, false);
});

test('AI proxy: CORS only for the app origin; foreign sites get no ACAO header', async () => {
  const ok = await call({ provider: { id: 'openai', kind: 'openai' }, model: 'm', key: 'k', prompt: 'hi' }, { deps: { assertUrl: async () => {} } });
  assert.equal(ok.res.status, 200);
  assert.equal(ok.res.headers['Access-Control-Allow-Origin'], 'https://quran-web-app-8rwy.onrender.com');
  const foreign = await call({ provider: { id: 'openai', kind: 'openai' }, model: 'm', key: 'k', prompt: 'hi' }, { origin: 'https://evil.example', deps: { assertUrl: async () => {} } });
  assert.equal(foreign.res.headers['Access-Control-Allow-Origin'], undefined);
});

test('AI proxy: rate-limited callers get 429', async () => {
  const r = await call({ prompt: 'hi' }, { deps: { allow: () => false } });
  assert.equal(r.res.status, 429);
});

test('bot: every AI/ayah/user string sent with parse_mode HTML goes through esc()', () => {
  const src = readFileSync(new URL('../telegram-bot.mjs', import.meta.url), 'utf8');
  assert.match(src, /const esc = \(s\) =>/);
  for (const bad of [/\$\{out\}/, /reply\(chatId, out,/, /«\$\{h\.t \|\| h\.p\}»/, /«\$\{full\}»/, /— \$\{parsed\.text\}/]) {
    assert.doesNotMatch(src, bad, `unescaped interpolation ${bad}`);
  }
});
