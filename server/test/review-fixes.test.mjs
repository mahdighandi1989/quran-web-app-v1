// Regressions for the independent review of 2026-11-02 (WORKLOG (۵)). Each test is a bug that was real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { listZip } from '../lib/zip.mjs';
import { extractText } from '../lib/extract.mjs';
import { isPrivateAddress } from '../lib/netguard.mjs';
import { clientIp, readJsonBody } from '../ai-proxy.mjs';
import { makeApi, PNG } from './helpers.mjs';

function bombZip(entries, payloadBytes, declared = 1) {
  const comp = deflateRawSync(Buffer.alloc(payloadBytes)); const name = Buffer.from('x.txt');
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(declared, 22); lh.writeUInt16LE(name.length, 26);
  const local = Buffer.concat([lh, name, comp]);
  const cds = [];
  for (let i = 0; i < entries; i++) {
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(declared, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(0, 42);
    cds.push(ch, name);
  }
  const cd = Buffer.concat(cds);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries, 8); e.writeUInt16LE(entries, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, cd, e]);
}

test('zip bomb: entries sharing one blob are refused; a lying size is capped by ACTUAL bytes', async () => {
  assert.throws(() => listZip(bombZip(12, 1024)), /share the same data/);
  const one = listZip(bombZip(1, 50 * 1024 * 1024));
  assert.throws(() => one[0].read(), /extraction limit/);
  const r = await extractText(bombZip(12, 1024), 'bomb.zip', 'application/zip');
  assert.equal(r.status, 'failed');
});

test('SSRF: IPv6-mapped, compat and NAT64 forms of internal addresses are private', () => {
  for (const ip of ['::ffff:7f00:1', '::ffff:a9fe:a9fe', '::7f00:1', '64:ff9b::7f00:1', '::ffff:169.254.169.254']) assert.equal(isPrivateAddress(ip), true, ip);
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
});

test('client IP = the hop appended by the proxy (last X-Forwarded-For), not the client-supplied first', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': 'spoofed, 9.9.9.9' } }), '9.9.9.9');
});

test('request bodies decode multi-byte UTF-8 split across chunks', async () => {
  const buf = Buffer.from(JSON.stringify({ t: 'سلام' }));
  const req = Readable.from([buf.subarray(0, 9), buf.subarray(9)]);
  assert.deepEqual(await readJsonBody(req), { t: 'سلام' });
  assert.deepEqual(await readJsonBody(Readable.from([Buffer.from('null')])), {});
});

test('large extracted text is stored outside the file document and read back in full', async () => {
  const h = makeApi();
  const r = (await h.call('POST', '/api/inspection', { as: 'owner', body: { text: 'متن' } })).body.report;
  const big = 'ب'.repeat(700000); // > 1 MiB of UTF-8
  const up = await h.call('POST', `/api/inspection/${r.number}/files`, { as: 'owner', body: { filename: 'big.txt', mime: 'text/plain', data_b64: Buffer.from(big).toString('base64') } });
  assert.equal(up.status, 200);
  const doc = await h.store.getFile(up.body.file.id);
  assert.equal(doc.text, undefined); assert.ok(doc.text_blob);
  await h.loginSupervisor();
  let got = '', off = 0;
  for (;;) { const s = (await h.call('GET', `/api/inspection/files/${doc.id}/text?offset=${off}`, { as: 'supervisor' })).body; got += s.text; off = s.end; if (s.done) break; }
  assert.equal(got, big);
});

test('an answer checked against an older file list is refused (upload in between)', async () => {
  const h = makeApi();
  const r = (await h.call('POST', '/api/inspection', { as: 'owner', body: { text: 'x' } })).body.report;
  await h.loginSupervisor();
  // simulate: supervisor read r0 (files_rev 0), the owner uploads, then the answer commits
  const orig = h.store.updateReport.bind(h.store);
  let once = true;
  h.store.updateReport = async (n, fn) => { if (once) { once = false; await orig(n, (d) => { d.files_rev = 1; return d; }); } return orig(n, fn); };
  const x = await h.call('POST', `/api/inspection/${r.number}/notes`, { as: 'supervisor', body: { text: 'ok', outcome: 'not-done', dependencies: [{ name: 'a', status: 'ok' }] } });
  assert.equal(x.status, 409);
});

test('a bad file id does not turn a saved note into a 500; anonymous bodies are not read', async () => {
  const h = makeApi();
  const r = (await h.call('POST', '/api/inspection', { as: 'owner', body: { text: 'x' } })).body.report;
  const x = await h.call('POST', `/api/inspection/${r.number}/notes`, { as: 'owner', body: { text: 'y', file_ids: ['a/b', '', 'file_0000000000000000'] } });
  assert.equal(x.status, 200);
  assert.equal((await h.call('POST', '/api/inspection', { body: { text: 'anon', shot: PNG } })).status, 401);
});

test('spot.path must be app-relative (no javascript: links on the board)', async () => {
  const h = makeApi();
  const r = (await h.call('POST', '/api/inspection', { as: 'owner', body: { text: 'x', spot: { path: 'javascript:alert(1)' } } })).body.report;
  assert.equal(r.spot.path, '');
});

test('binder pages are unique under concurrent filing', async () => {
  const h = makeApi();
  for (let i = 0; i < 3; i++) {
    const r = (await h.call('POST', '/api/inspection', { as: 'owner', body: { text: `s${i}` } })).body.report;
    await h.call('POST', `/api/inspection/${r.number}/status`, { as: 'owner', body: { status: 'approved' } });
  }
  await h.loginSupervisor();
  const [a, b] = await Promise.all([h.call('POST', '/api/inspection/file', { as: 'supervisor' }), h.call('POST', '/api/inspection/file', { as: 'owner' })]);
  const pages = [...a.body.filed, ...b.body.filed].map((f) => `${f.binder.number}/${f.binder.page}`);
  assert.equal(pages.length, 3);
  assert.equal(new Set(pages).size, 3);
});
