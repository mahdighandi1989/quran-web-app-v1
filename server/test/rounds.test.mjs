// Parity with Detective-1: general requests, measured supervisor rounds, read percentage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordRound, nextRound, nextFullRound } from '../lib/rounds.mjs';
import { makeApi } from './helpers.mjs';

const T = (s) => Date.parse(s);

test('urgent round: assumed until observed, then follows the observed minute, stale when silent', () => {
  const now = T('2026-11-03T10:05:00Z');
  const a = nextRound(now, [], 23);
  assert.equal(a.basis, 'assumed'); assert.equal(a.at, '2026-11-03T10:23:00.000Z');
  let log = [];
  for (const h of ['07', '08', '09']) log = recordRound(log, T(`2026-11-03T${h}:41:30Z`));
  const o = nextRound(now, log, 23);
  assert.equal(o.basis, 'observed'); assert.equal(o.at, '2026-11-03T10:41:00.000Z'); assert.equal(o.every_minutes, 60);
  assert.equal(nextRound(T('2026-11-03T14:00:00Z'), log, 23).basis, 'stale');
});

test('full round: next Mon/Thu 00:47 UTC; stale after the longest gap + a day', () => {
  const now = T('2026-11-03T12:00:00Z'); // a Tuesday
  const f = nextFullRound(now, [], '47 0 * * 1,4');
  assert.equal(f.at, '2026-11-05T00:47:00.000Z'); assert.equal(f.basis, 'scheduled');
  assert.equal(nextFullRound(now, ['2026-10-20T00:47:00Z'], '47 0 * * 1,4').basis, 'stale');
});

test('the supervisor\'s claim and queue read are the heartbeats; the board sees /rounds', async () => {
  const h = makeApi();
  await h.loginSupervisor();
  await h.call('POST', '/api/inspection/urgent/claim', { as: 'supervisor' });
  await h.call('GET', '/api/inspection/queue', { as: 'supervisor' });
  const r = (await h.call('GET', '/api/inspection/rounds', { as: 'owner' })).body;
  assert.ok(r.urgent.last_seen); assert.ok(r.full.last_seen);
  assert.equal((await h.call('GET', '/api/inspection/rounds')).status, 401);
  assert.ok((await h.call('GET', '/api/inspection', { as: 'owner' })).body.rounds.urgent);
});

test('general request: no box, same queue/urgent/binder; marking urgent returns the next round', async () => {
  const h = makeApi();
  const r = (await h.call('POST', '/api/inspection', { as: 'owner', body: { text: 'یک درخواستِ کلی', spot: { general: true, path: '/settings', rect: { x: 1 } } } })).body.report;
  assert.equal(r.spot.general, true); assert.equal(r.spot.rect, null); assert.equal(r.spot.path, '');
  const u = (await h.call('POST', `/api/inspection/${r.number}/urgent`, { as: 'owner' })).body;
  assert.equal(u.position, 1); assert.ok(u.next_round.at);
  await h.loginSupervisor();
  assert.equal((await h.call('POST', '/api/inspection/urgent/claim', { as: 'supervisor' })).body.report.number, r.number);
});

test('read_percent / fully_read are reported to the owner', async () => {
  const h = makeApi();
  const r = (await h.call('POST', '/api/inspection', { as: 'owner', body: { text: 'x' } })).body.report;
  const text = 'a'.repeat(300000);
  const f = (await h.call('POST', `/api/inspection/${r.number}/files`, { as: 'owner', body: { filename: 't.txt', mime: 'text/plain', data_b64: Buffer.from(text).toString('base64') } })).body.file;
  assert.equal(f.read_percent, 0); assert.equal(f.fully_read, false);
  await h.loginSupervisor();
  await h.call('GET', `/api/inspection/files/${f.id}/text?offset=0`, { as: 'supervisor' });
  let g = (await h.call('GET', `/api/inspection/${r.number}`, { as: 'owner' })).body.report.files[0];
  assert.equal(g.read_percent, 66);
  await h.call('GET', `/api/inspection/files/${f.id}/text?offset=200000`, { as: 'supervisor' });
  g = (await h.call('GET', `/api/inspection/${r.number}`, { as: 'owner' })).body.report.files[0];
  assert.equal(g.read_percent, 100); assert.equal(g.fully_read, true);
});
