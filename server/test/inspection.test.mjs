import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApi, PNG } from './helpers.mjs';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const DEPS = [{ name: 'دکمه ⇒ POST /api/inspection', status: 'ok' }];

async function ownerSheet(h, text = 'دکمهٔ تمرین اینجا کج است') {
  const r = await h.call('POST', '/api/inspection', { as: 'owner', body: { text, shot: PNG, spot: { path: '/practice', rect: { x: 1, y: 2, w: 30, h: 40 }, anchor: { selector: '#x', verified: true, fx: 0.1, fy: 0.2, fw: 0.5, fh: 0.5 } } } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.report;
}

test('/api/me: roles come from ADMIN_EMAILS + verified email only', async () => {
  const h = makeApi();
  assert.equal((await h.call('GET', '/api/me')).body.signedIn, false);
  assert.equal((await h.call('GET', '/api/me', { as: 'owner' })).body.isAdmin, true);
  assert.equal((await h.call('GET', '/api/me', { as: 'ownerUnverified' })).body.isAdmin, false, 'unverified email must not be admin');
  assert.equal((await h.call('GET', '/api/me', { as: 'alice' })).body.isAdmin, false);
  assert.equal((await h.call('GET', '/api/me', { as: 'nobody' })).status, 401);
  await h.loginSupervisor();
  const sup = (await h.call('GET', '/api/me', { as: 'supervisor' })).body;
  assert.equal(sup.isSupervisor, true);
  assert.equal(sup.isAdmin, false);
});

test('supervisor login: wrong password refused and rate-limited', async () => {
  const h = makeApi();
  for (let i = 0; i < 5; i++) assert.equal((await h.call('POST', '/api/inspection/supervisor/login', { body: { password: 'nope' } })).status, 401);
  assert.equal((await h.call('POST', '/api/inspection/supervisor/login', { body: { password: h.env.SUPERVISOR_PASSWORD } })).status, 429);
});

test('owner sheet opens directly; a non-admin sheet waits for triage and is invisible to the supervisor', async () => {
  const h = makeApi();
  const a = await ownerSheet(h);
  assert.equal(a.status, 'open');
  const u = await h.call('POST', '/api/inspection', { as: 'alice', body: { text: 'پیشنهاد' } });
  assert.equal(u.body.report.status, 'pending');
  await h.loginSupervisor();
  const list = (await h.call('GET', '/api/inspection', { as: 'supervisor' })).body.reports.map((r) => r.number);
  assert.deepEqual(list, [a.number]);
  assert.equal((await h.call('POST', `/api/inspection/${u.body.report.number}/notes`, { as: 'supervisor', body: { text: 'x', outcome: 'not-done', dependencies: DEPS } })).status, 404);
  // bob cannot see alice's sheet
  assert.equal((await h.call('GET', `/api/inspection/${u.body.report.number}`, { as: 'bob' })).status, 404);
  // the owner accepts it → supervisor sees it
  assert.equal((await h.call('POST', `/api/inspection/${u.body.report.number}/triage`, { as: 'owner', body: { decision: 'accept' } })).body.report.status, 'open');
  assert.equal((await h.call('POST', `/api/inspection/${u.body.report.number}/triage`, { as: 'alice', body: { decision: 'accept' } })).status, 403);
});

test('fixed without an after-picture, without commit, or without place is refused', async () => {
  const h = makeApi();
  const r = await ownerSheet(h);
  await h.loginSupervisor();
  const url = `/api/inspection/${r.number}/notes`;
  let x = await h.call('POST', url, { as: 'supervisor', body: { text: 'done', outcome: 'fixed', commits: ['abc1234'], place: 'کنار دکمه', dependencies: DEPS } });
  assert.equal(x.status, 422); assert.match(x.body.error, /تصویرِ بعد/);
  x = await h.call('POST', url, { as: 'supervisor', body: { text: 'done', outcome: 'fixed', after_shot: PNG, place: 'کنار دکمه', dependencies: DEPS } });
  assert.equal(x.status, 422); assert.match(x.body.error, /کامیت/);
  x = await h.call('POST', url, { as: 'supervisor', body: { text: 'done', outcome: 'fixed', after_shot: PNG, commits: ['abc1234'], dependencies: DEPS } });
  assert.equal(x.status, 422); assert.match(x.body.error, /place/);
  x = await h.call('POST', url, { as: 'supervisor', body: { text: 'done', outcome: 'fixed', after_shot: PNG, commits: ['abc1234'], place: 'کنار دکمه' } });
  assert.equal(x.status, 422); assert.match(x.body.error, /وابستگی/);
  x = await h.call('POST', url, { as: 'supervisor', body: { text: 'done', after_shot: PNG, dependencies: DEPS } });
  assert.equal(x.status, 422, 'a supervisor answer needs an outcome');
  x = await h.call('POST', url, { as: 'supervisor', body: { text: 'done', outcome: 'fixed', after_shot: PNG, commits: ['abc1234'], place: 'کنار دکمهٔ شروع', dependencies: DEPS } });
  assert.equal(x.status, 200, JSON.stringify(x.body));
  assert.equal(x.body.report.status, 'answered');
  assert.equal(x.body.report.glow, 'green');
  // the owner cannot set an outcome
  assert.equal((await h.call('POST', url, { as: 'owner', body: { text: 'ok', outcome: 'fixed' } })).status, 422);
});

test('only the owner ticks; the supervisor is refused; filing goes to a binder; deletion is forbidden', async () => {
  const h = makeApi();
  const r = await ownerSheet(h, 'یک مشکل');
  await h.loginSupervisor();
  await h.call('POST', `/api/inspection/${r.number}/notes`, { as: 'supervisor', body: { text: 'نشد', outcome: 'not-done', dependencies: DEPS } });
  assert.equal((await h.call('POST', `/api/inspection/${r.number}/status`, { as: 'supervisor', body: { status: 'approved' } })).status, 403);
  assert.equal((await h.call('POST', `/api/inspection/${r.number}/status`, { as: 'alice', body: { status: 'approved' } })).status, 403);
  assert.equal((await h.call('POST', `/api/inspection/${r.number}/status`, { as: 'owner', body: { status: 'approved' } })).body.report.status, 'approved');
  const f = await h.call('POST', '/api/inspection/file', { as: 'supervisor' });
  assert.deepEqual(f.body.filed, [{ number: r.number, binder: { number: 1, page: 1 } }]);
  assert.equal((await h.call('DELETE', `/api/inspection/${r.number}`, { as: 'owner' })).status, 405);
  assert.equal((await h.call('GET', `/api/inspection/${r.number}`, { as: 'owner' })).body.report.status, 'filed');
  assert.equal((await h.call('POST', `/api/inspection/${r.number}/notes`, { as: 'owner', body: { text: 'باز' } })).status, 422);
});

test('attachments: text extracted at upload; the answer is refused until the supervisor read all of it', async () => {
  const h = makeApi();
  const r = await ownerSheet(h, 'فایل را بخوان');
  const long = 'سطر\n'.repeat(60000); // 240k chars > one slice
  const up = await h.call('POST', `/api/inspection/${r.number}/files`, { as: 'owner', body: { filename: 'notes.txt', mime: 'text/plain', data_b64: b64(long), caption: 'نمونه' } });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.file.extract_status, 'ok');
  assert.equal(up.body.file.text_chars, long.length);
  const img = await h.call('POST', `/api/inspection/${r.number}/files`, { as: 'owner', body: { filename: 'a.png', mime: 'image/png', data_b64: PNG.split(',')[1] } });
  assert.equal(img.body.file.extract_status, 'image');
  await h.loginSupervisor();
  const url = `/api/inspection/${r.number}/notes`;
  const ans = { text: 'خواندم', outcome: 'needs-owner', dependencies: DEPS };
  let x = await h.call('POST', url, { as: 'supervisor', body: ans });
  assert.equal(x.status, 422); assert.match(x.body.error, /notes\.txt/); assert.match(x.body.error, /a\.png/);
  const fid = up.body.file.id;
  const s1 = await h.call('GET', `/api/inspection/files/${fid}/text?offset=0`, { as: 'supervisor' });
  assert.equal(s1.body.done, false);
  // the owner reading does NOT discharge the supervisor's debt
  await h.call('GET', `/api/inspection/files/${fid}/text?offset=${s1.body.end}`, { as: 'owner' });
  x = await h.call('POST', url, { as: 'supervisor', body: ans });
  assert.equal(x.status, 422);
  const s2 = await h.call('GET', `/api/inspection/files/${fid}/text?offset=${s1.body.end}`, { as: 'supervisor' });
  assert.equal(s2.body.done, true);
  assert.equal(s1.body.text + s2.body.text, long);
  x = await h.call('POST', url, { as: 'supervisor', body: ans });
  assert.equal(x.status, 422, 'the picture was never opened'); assert.match(x.body.error, /a\.png/);
  const raw = await h.call('GET', `/api/inspection/files/${img.body.file.id}/raw`, { as: 'supervisor', raw: true });
  assert.equal(raw.status, 200);
  assert.equal(raw.body.toString('base64'), PNG.split(',')[1]);
  x = await h.call('POST', url, { as: 'supervisor', body: ans });
  assert.equal(x.status, 200, JSON.stringify(x.body));
});

test('a new owner note re-opens an answered sheet and puts it back in the urgent queue at its old place', async () => {
  const h = makeApi();
  const a = await ownerSheet(h, 'اول');
  const b = await ownerSheet(h, 'دوم');
  await h.call('POST', `/api/inspection/${a.number}/urgent`, { as: 'owner' });
  h.clock.t += 1000;
  await h.call('POST', `/api/inspection/${b.number}/urgent`, { as: 'owner' });
  await h.loginSupervisor();
  assert.equal((await h.call('POST', `/api/inspection/${a.number}/urgent`, { as: 'supervisor' })).status, 403, 'urgent is the owner\'s button');
  let c = await h.call('POST', '/api/inspection/urgent/claim', { as: 'supervisor' });
  assert.equal(c.body.report.number, a.number);
  c = await h.call('POST', '/api/inspection/urgent/claim', { as: 'supervisor' });
  assert.equal(c.body.report.number, b.number, 'a claimed sheet is not handed out twice');
  await h.call('POST', `/api/inspection/${a.number}/notes`, { as: 'supervisor', body: { text: 'نیمه', outcome: 'partial', dependencies: DEPS } });
  const back = await h.call('POST', `/api/inspection/${a.number}/notes`, { as: 'owner', body: { text: 'هنوز نه' } });
  assert.equal(back.body.report.status, 'open');
  assert.equal(back.body.report.urgent_done_at, null);
  h.clock.t += 101 * 60 * 1000; // claims expire
  c = await h.call('POST', '/api/inspection/urgent/claim', { as: 'supervisor' });
  assert.equal(c.body.report.number, a.number, 'original place kept');
});

test('editing: own side only, original text kept', async () => {
  const h = makeApi();
  const r = await ownerSheet(h, 'متنِ اول');
  const nid = r.notes[0].id;
  const e = await h.call('PATCH', `/api/inspection/${r.number}/notes/${nid}`, { as: 'owner', body: { text: 'متنِ دوم' } });
  assert.equal(e.body.report.notes[0].text, 'متنِ دوم');
  assert.equal(e.body.report.notes[0].original_text, 'متنِ اول');
  await h.loginSupervisor();
  assert.equal((await h.call('PATCH', `/api/inspection/${r.number}/notes/${nid}`, { as: 'supervisor', body: { text: 'x' } })).status, 403);
});

test('shots are served only to people who may see them', async () => {
  const h = makeApi();
  const r = await ownerSheet(h);
  const sid = r.notes[0].shot_id;
  assert.equal((await h.call('GET', `/api/inspection/shots/${sid}`, { as: 'owner', raw: true })).status, 200);
  assert.equal((await h.call('GET', `/api/inspection/shots/${sid}`, { as: 'alice', raw: true })).status, 404);
  assert.equal((await h.call('GET', `/api/inspection/shots/${sid}`, { raw: true })).status, 401);
});
