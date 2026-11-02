// A chat is linked to an account only by redeeming a one-time code the signed-in owner got from the app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { memoryLinkStore, issueCode, redeemCode, ownerOfChat, verifiedRecipients, grandfatherOnce, createLinkApi, CODE_TTL_MS } from '../telegramLink.mjs';

test('typing a chat id is not ownership; redeeming the code is', async () => {
  const s = memoryLinkStore();
  assert.equal(await ownerOfChat(s, '111'), null);
  const { code } = await issueCode(s, 'victim', 0);
  assert.deepEqual(await redeemCode(s, '111', code, 1000), { ok: true, uid: 'victim' });
  assert.equal(await ownerOfChat(s, '111'), 'victim');
  assert.equal((await redeemCode(s, '222', code, 2000)).reason, 'unknown', 'one-time');
});

test('expired and malformed codes are refused', async () => {
  const s = memoryLinkStore();
  const { code } = await issueCode(s, 'u', 0);
  assert.equal((await redeemCode(s, '1', code, CODE_TTL_MS + 1)).reason, 'expired');
  assert.equal((await redeemCode(s, '1', '../x', 0)).reason, 'invalid');
  assert.equal(await ownerOfChat(s, '1'), null);
});

test('the server sends only to chats proven to belong to the account', async () => {
  const s = memoryLinkStore();
  await s.setLink('1', { uid: 'attacker' });
  await s.setLink('2', { uid: 'victim' });
  // the attacker typed the victim's chat id "2" into their own config:
  assert.deepEqual(await verifiedRecipients(s, 'attacker', ['1', '2', '3']), ['1']);
});

test('migration: unambiguous existing registrations are kept, contested ones are not; runs once', async () => {
  const s = memoryLinkStore();
  const r = await grandfatherOnce(s, [{ uid: 'owner', chatIds: ['10', '11'] }, { uid: 'x', chatIds: ['11'] }], 5);
  assert.deepEqual([r.linked, r.ambiguous], [1, 1]);
  assert.equal(await ownerOfChat(s, '10'), 'owner');
  assert.equal(await ownerOfChat(s, '11'), null);
  assert.equal((await grandfatherOnce(s, [{ uid: 'z', chatIds: ['99'] }], 6)).skipped, true);
  assert.equal(await ownerOfChat(s, '99'), null);
});

function call(api, method, url, principal) {
  const req = Readable.from([]); req.method = method; req.url = url; req.headers = { origin: 'https://app.example' };
  const res = { status: 0, body: '', writeHead(s) { this.status = s; }, end(d) { this.body = d || ''; } };
  return api.route(req, res).then(() => ({ status: res.status, json: res.body ? JSON.parse(res.body) : null }));
}

test('link API: signed-in owner only; returns a deep link; lists only own links', async () => {
  const s = memoryLinkStore();
  await s.setLink('7', { uid: 'u1', linkedAt: 1, via: 'code' });
  await s.setLink('8', { uid: 'u2', linkedAt: 1, via: 'code' });
  let who = null;
  const api = createLinkApi({ getStore: () => s, principal: async () => who, botUsername: async () => 'QuranBot', allowedOrigins: ['https://app.example'] });
  assert.equal((await call(api, 'POST', '/api/telegram/link-code')).status, 401);
  who = { uid: 'x', isSupervisor: true };
  assert.equal((await call(api, 'POST', '/api/telegram/link-code')).status, 401, 'the supervisor cannot link chats');
  who = { uid: 'u1' };
  const c = await call(api, 'POST', '/api/telegram/link-code');
  assert.equal(c.status, 200);
  assert.match(c.json.deepLink, /^https:\/\/t\.me\/QuranBot\?start=[A-Za-z0-9_-]{16}$/);
  const l = await call(api, 'GET', '/api/telegram/links');
  assert.deepEqual(l.json.links.map((x) => x.chatId), ['7']);
});

test('bot: chat resolution and reminders use proven links, not the typed allChatIds', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../telegram-bot.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /where\('allChatIds', 'array-contains'/);
  assert.match(src, /verifiedRecipients\(getLinkStore\(\), doc\.id, recipientsOf\(cfg\)\)/);
  assert.match(src, /redeemCode\(getLinkStore\(\), chatId, startArg\)/);
});
