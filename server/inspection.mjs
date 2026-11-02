// «نظارت و سرکشی» — the owner's inspection sheets over the app's screens, served by the bot service.
//
// The owner walks the app, draws a box around what is wrong, writes a note, attaches files; the
// scheduled supervisor (a Claude Code routine, docs/supervisor/PROMPT.md) reads the sheet, does the
// work and answers UNDER the sheet; only the owner ticks it; the next round files it into a binder.
//
// RULES THIS API ENFORCES (a guard, not a written promise):
//  1. `status` = where the conversation is (pending/open/answered/approved/filed/declined);
//     `outcome` on the supervisor's note = what actually happened (fixed/partial/not-done/needs-owner).
//  2. outcome `fixed` without an after-picture is refused; so is `fixed` without a commit (or a ≥40-char
//     reason why no change was needed); a sheet whose text says «here» needs a `place` for `fixed`.
//  3. Only the owner (admin) ticks. The supervisor's account is refused by the approve endpoint.
//  4. Every supervisor answer carries its dependency chain (≥1 entry).
//  5. Attachments are READ: text is extracted at upload; the supervisor's answer is refused while any
//     file is unread (text not fully served, or a picture/unsupported file never opened).
//  6. A non-admin's sheet waits (pending) for the admin's accept/decline before the supervisor sees it.
//  7. Sheets are never deleted (DELETE → 405). Declined sheets are kept.
import crypto from 'node:crypto';
import { HttpError, principalFrom, supervisorLogin, createLoginLimiter } from './lib/auth.mjs';
import { extractText } from './lib/extract.mjs';
import { readJsonBody, clientIp } from './ai-proxy.mjs';

export const STATUSES = ['pending', 'open', 'answered', 'approved', 'filed', 'declined'];
export const STATUS_LABEL = {
  pending: 'در انتظارِ تأییدِ مدیر', open: 'در انتظارِ ناظر', answered: 'ناظر پاسخ داد',
  approved: 'تأییدِ مالک', filed: 'بایگانی‌شده', declined: 'ردِ مدیر',
};
export const NOT_FOR_SUPERVISOR = ['pending', 'declined', 'filed'];
export const OUTCOMES = ['fixed', 'partial', 'needs-owner', 'not-done'];
export const OUTCOME_LABEL = {
  fixed: '✓ درست شد', partial: '◑ نیمه‌کاره', 'needs-owner': '؟ منتظرِ انتخابِ مالک', 'not-done': '✗ درست نشد',
};
export const LIMITS = {
  maxText: 20000, maxShotBytes: 4 * 1024 * 1024, maxFileBytes: 20 * 1024 * 1024,
  maxPendingPerUser: 3, maxPerDayPerUser: 10, maxActive: 300, binderCapacity: 40,
  urgentClaimMs: 100 * 60 * 1000, textSlice: 200000,
};
const HERE = /اینجا|این‌جا|این قسمت|این بخش|همین‌جا|همینجا|همین جا|\bhere\b/i;

const nowIso = (now) => new Date(now()).toISOString();
const newId = () => crypto.randomBytes(8).toString('hex');
const clip = (v, n = LIMITS.maxText) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const headline = (t) => clip(String(t).split('\n')[0], 200);

// The colour the owner sees — derived, never stored. Green only with a fix AND its picture.
export function sheetGlow(r) {
  if (r.status === 'approved' || r.status === 'filed') return 'blue';
  const last = [...(r.notes || [])].reverse().find((n) => n.by === 'reviewer');
  const lastOwner = [...(r.notes || [])].reverse().find((n) => n.by === 'owner');
  if (last && (!lastOwner || last.at >= lastOwner.at) && last.outcome === 'fixed' && last.after_shot_id) return 'green';
  if (r.status === 'declined') return 'grey';
  return 'orange';
}

// Which attached files the supervisor still owes a read on. Empty = may answer.
export function fileReadDebt(files) {
  const debt = [];
  for (const f of files || []) {
    const name = f.filename || '?';
    if (f.extract_status === 'ok') {
      if ((f.read_chars || 0) < (f.text_chars || 0)) debt.push({ file_id: f.id, filename: name, reason: 'text', remaining: f.text_chars - (f.read_chars || 0), text_chars: f.text_chars });
      else if (f.text_truncated && !f.viewed_at) debt.push({ file_id: f.id, filename: name, reason: 'truncated', remaining: 1 });
    } else if (['image', 'unsupported', 'failed'].includes(f.extract_status) && !f.viewed_at) {
      debt.push({ file_id: f.id, filename: name, reason: 'unopened', remaining: 1 });
    }
  }
  return debt;
}

// Is a sheet still owed work by the supervisor (open, or answered partial/not-done)?
export function isOwed(r) {
  if (r.status === 'open') return true;
  if (r.status !== 'answered') return false;
  const last = [...(r.notes || [])].reverse().find((n) => n.by === 'reviewer');
  return !!last && ['partial', 'not-done'].includes(last.outcome);
}

function parseDataUrl(s) {
  if (!s) return null;
  const m = String(s).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) throw new HttpError(415, 'تصویر باید PNG/JPEG/WebP به‌صورتِ data URL باشد');
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) return null;
  if (buf.length > LIMITS.maxShotBytes) throw new HttpError(413, `تصویر بیش از ${LIMITS.maxShotBytes / 1048576} مگابایت است`);
  return { mime: m[1], buf };
}

function cleanSpot(sp) {
  if (!sp || typeof sp !== 'object') return null;
  const num = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x) * 1000) / 1000 : 0);
  const rect = sp.rect || {};
  const anchor = sp.anchor && typeof sp.anchor === 'object' ? {
    selector: clip(sp.anchor.selector, 400), verified: !!sp.anchor.verified, tag: clip(sp.anchor.tag, 40),
    fx: num(sp.anchor.fx), fy: num(sp.anchor.fy), fw: num(sp.anchor.fw), fh: num(sp.anchor.fh),
  } : null;
  return {
    path: (() => { const p = clip(sp.path, 300); return p.startsWith('/') && !p.startsWith('//') ? p : ''; })(), page_label: clip(sp.page_label, 200), title: clip(sp.title, 200),
    rect: { x: num(rect.x), y: num(rect.y), w: num(rect.w), h: num(rect.h) }, // DOCUMENT coordinates
    viewport: { w: num(sp.viewport?.w), h: num(sp.viewport?.h), dpr: num(sp.viewport?.dpr), sx: num(sp.viewport?.sx), sy: num(sp.viewport?.sy) },
    covered_text: clip(sp.covered_text, 2000), anchor,
  };
}

function publicReport(r, files) {
  return {
    ...r,
    status_label: STATUS_LABEL[r.status] || r.status,
    glow: sheetGlow(r),
    owed: isOwed(r),
    files: (files || []).map(publicFile),
    read_debt: fileReadDebt(files),
  };
}
const publicFile = (f) => {
  const { text, ...rest } = f; // eslint-disable-line no-unused-vars
  return rest;
};

// Read-only, aggregate-only health of the app's own Firestore data (no values leave the server):
// counts, the bot's chat→user index consistency, duplicate chat-id claims, the goal mirror.
export async function storageHealth(db, { listUsers } = {}) {
  const out = { at: new Date().toISOString() };
  for (const c of ['telegramConfigs', 'appState', 'aiConfigs', 'quranSamples', 'inspectionReports', 'inspectionFiles']) {
    const snap = await db.collection(c).get();
    const docs = snap.docs.map((d) => ({ id: d.id, x: d.data() || {} }));
    const row = { docs: docs.length };
    if (c === 'telegramConfigs') {
      const claims = new Map();
      let outOfSync = 0;
      for (const { x } of docs) {
        const ids = new Set([x.primaryChatId, ...((x.devices || []).map((v) => v && v.chatId))].filter(Boolean).map(String));
        const idx = new Set((x.allChatIds || []).map(String));
        if (ids.size !== idx.size || [...ids].some((i) => !idx.has(i))) outOfSync += 1;
        for (const i of idx) claims.set(i, (claims.get(i) || 0) + 1);
      }
      Object.assign(row, {
        enabled: docs.filter((d) => d.x.enabled).length,
        withDailyGoal: docs.filter((d) => typeof d.x.dailyGoal === 'number').length,
        tzMissing: docs.filter((d) => d.x.tzOffsetMinutes == null).length,
        allChatIdsOutOfSync: outOfSync,
        chatIdsClaimedByMoreThanOneAccount: [...claims.values()].filter((n) => n > 1).length,
      });
    }
    if (c === 'appState') row.newestUpdate = docs.map((d) => d.x.updatedAt || 0).sort((a, b) => a - b).pop() || null;
    if (c === 'quranSamples') row.maxDocBytesApprox = Math.max(0, ...docs.map((d) => JSON.stringify(d.x).length));
    if (c === 'aiConfigs') row.withAnyKey = docs.filter((d) => Object.values(d.x.keys || {}).some(Boolean)).length;
    out[c] = row;
  }
  if (typeof listUsers === 'function') {
    const uids = new Set(await listUsers());
    out.authUsers = uids.size;
    out.orphanDocs = Object.fromEntries(await Promise.all(['telegramConfigs', 'appState', 'aiConfigs', 'quranSamples'].map(async (c) => {
      const snap = await db.collection(c).get();
      return [c, snap.docs.filter((d) => !uids.has(d.id)).length];
    })));
  }
  return out;
}

export function createInspectionApi({ getStore, verifyIdToken, env = process.env, now = () => Date.now(), allowedOrigins, getDb, listUsers } = {}) {
  const limiter = createLoginLimiter();
  const globalLimiter = createLoginLimiter({ max: 30, windowMs: 15 * 60 * 1000 });
  const origins = allowedOrigins || String(env.ALLOWED_ORIGINS || 'https://quran-web-app-8rwy.onrender.com,http://localhost:5173,http://localhost:4173')
    .split(',').map((s) => s.trim()).filter(Boolean);

  function cors(req) {
    const o = req.headers?.origin;
    const h = { 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
    if (o && origins.includes(o)) h['Access-Control-Allow-Origin'] = o;
    return h;
  }
  function send(req, res, status, body, extra = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...extra });
    res.end(JSON.stringify(body));
  }
  function sendBytes(req, res, mime, data, filename) {
    res.writeHead(200, {
      'Content-Type': mime || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      ...(filename ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } : {}), ...cors(req),
    });
    res.end(data);
  }

  const store = () => {
    const s = getStore();
    if (!s) throw new HttpError(503, 'Firestore روی سرورِ بات وصل نیست (FIREBASE_SERVICE_ACCOUNT) — نظارت فعلاً در دسترس نیست');
    return s;
  };
  const need = (p) => { if (!p) throw new HttpError(401, 'برای این کار باید وارد شوید'); return p; };
  const needAdmin = (p) => {
    need(p);
    if (p.isSupervisor) throw new HttpError(403, 'این کار فقط دستِ مالک است — ناظر نمی‌تواند');
    if (!p.isAdmin) throw new HttpError(403, 'این کار فقط برای مدیر است');
    return p;
  };
  const sees = (p, r) => p.isAdmin || (p.isSupervisor && !['pending', 'declined'].includes(r.status)) || (r.created_by_uid && r.created_by_uid === p.uid);
  async function reportOr404(p, n) {
    const r = await store().getReport(n);
    if (!r || !sees(p, r)) throw new HttpError(404, 'برگه پیدا نشد');
    return r;
  }

  async function storeShot(parsed) {
    if (!parsed) return null;
    const id = 'shot_' + newId();
    await store().putBlob(id, parsed.buf, parsed.mime);
    return id;
  }

  /* ------------------------------- handlers ------------------------------- */
  async function me(p) {
    return {
      signedIn: !!p, uid: p?.uid || null, email: p?.email || null, isAdmin: !!p?.isAdmin, isSupervisor: !!p?.isSupervisor,
      adminConfigured: String(env.ADMIN_EMAILS || '').trim().length > 0,
      supervisorConfigured: !!env.SUPERVISOR_PASSWORD, storage: getStore()?.kind || 'none',
    };
  }

  async function list(p, q) {
    need(p);
    let rows = await store().listReports();
    rows = rows.filter((r) => sees(p, r));
    if (q.get('status')) rows = rows.filter((r) => r.status === q.get('status'));
    if (q.get('path')) rows = rows.filter((r) => r.spot?.path === q.get('path') && r.status !== 'filed');
    if (q.get('mine') === '1') rows = rows.filter((r) => r.created_by_uid === p.uid);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
    return { reports: rows.map((r) => publicReport(r, [])), counts, me: await me(p) };
  }

  async function create(p, body) {
    need(p);
    if (p.isSupervisor) throw new HttpError(403, 'ناظر برگه ثبت نمی‌کند؛ جواب زیرِ برگه می‌نویسد');
    const text = clip(body.text);
    if (!text) throw new HttpError(422, 'متنِ برگه خالی است');
    const all = await store().listReports();
    if (!p.isAdmin) {
      const pending = all.filter((r) => r.created_by_uid === p.uid && r.status === 'pending').length;
      if (pending >= LIMITS.maxPendingPerUser) throw new HttpError(429, `${pending} برگهٔ شما هنوز منتظرِ تأییدِ مدیر است`);
      const day = all.filter((r) => r.created_by_uid === p.uid && Date.parse(r.created_at) > now() - 86400000).length;
      if (day >= LIMITS.maxPerDayPerUser) throw new HttpError(429, `سقفِ ${LIMITS.maxPerDayPerUser} برگه در ۲۴ ساعت پر شده است`);
    }
    if (all.filter((r) => r.status !== 'filed' && r.status !== 'declined').length >= LIMITS.maxActive) {
      throw new HttpError(422, `سقفِ ${LIMITS.maxActive} برگهٔ باز پر است — اول چند تا را تأیید و بایگانی کن`);
    }
    const shot = parseDataUrl(body.shot);
    const number = await store().nextNumber();
    const nid = newId();
    const at = nowIso(now);
    const r = {
      number, created_at: at, updated_at: at, status: p.isAdmin ? 'open' : 'pending', title: headline(text),
      created_by_uid: p.uid, created_by: p.email, spot: cleanSpot(body.spot),
      notes: [{ id: nid, by: 'owner', at, text, author: p.email, shot_id: await storeShot(shot) }],
      deps: [], urgent_at: null, urgent_claimed_at: null, urgent_done_at: null,
      triage: null, binder: null,
    };
    await store().putReport(r);
    return { ok: true, report: publicReport(r, []), pending_owner: !p.isAdmin };
  }

  async function getOne(p, n) {
    const r = await reportOr404(p, n);
    return { report: publicReport(r, await store().listFiles(n)) };
  }

  async function uploadFile(p, n, body) {
    need(p);
    const r = await reportOr404(p, n);
    if (['filed', 'declined'].includes(r.status)) throw new HttpError(422, 'برگهٔ بسته (بایگانی/رد) فایلِ تازه نمی‌گیرد');
    if (p.isSupervisor && r.status === 'pending') throw new HttpError(422, 'این برگه هنوز تأییدِ مدیر را ندارد');
    const filename = clip(body.filename || 'file', 200).replace(/[\\/]/g, '_') || 'file';
    const mime = clip(body.mime || 'application/octet-stream', 120);
    const buf = Buffer.from(String(body.data_b64 || ''), 'base64');
    if (!buf.length) throw new HttpError(422, 'فایل خالی است');
    if (buf.length > LIMITS.maxFileBytes) throw new HttpError(413, `حجمِ فایل از ${LIMITS.maxFileBytes / 1048576} مگابایت بیشتر است`);
    const id = 'file_' + newId();
    const placed = await store().putBlob(id, buf, mime);
    const ex = await extractText(buf, filename, mime);
    // The extracted text can be millions of characters; a Firestore document is capped at 1 MiB, so the
    // text lives in the chunked blob store too (text_<id>), not in the file document.
    let textBlob = null;
    if (ex.text) { textBlob = 'text_' + id.slice(5); await store().putBlob(textBlob, Buffer.from(ex.text, 'utf8'), 'text/plain; charset=utf-8'); }
    const f = {
      id, report_number: Number(n), note_id: clip(body.note_id, 40), uploaded_by: p.email, created_at: nowIso(now),
      filename, mime, byte_size: placed.size, sha256: placed.sha256, caption: clip(body.caption, 2000), store: store().kind,
      extract_status: ex.status, extract_note: ex.note, text_blob: textBlob, text_chars: ex.text.length, page_count: ex.page_count,
      text_truncated: ex.truncated, read_chars: 0, read_at: null, viewed_at: null,
    };
    await store().putFile(f);
    // New material re-opens an answered sheet: the previous answer did not see it. files_rev lets an
    // answer that was checked against the OLD file list be refused (no answering an unread upload).
    const report = await store().updateReport(n, (d) => {
      if (!d) throw new HttpError(404, 'برگه پیدا نشد');
      d.files_rev = (d.files_rev || 0) + 1;
      if (!p.isSupervisor && ['answered', 'approved'].includes(d.status)) d.status = p.isAdmin ? 'open' : 'pending';
      d.updated_at = nowIso(now);
      return d;
    });
    return { ok: true, file: publicFile(f), report: publicReport(report, await store().listFiles(n)) };
  }

  async function fileText(p, id, q) {
    need(p);
    const f = await store().getFile(id);
    if (!f) throw new HttpError(404, 'فایل پیدا نشد');
    await reportOr404(p, f.report_number);
    const offset = Math.max(0, parseInt(q.get('offset') || '0', 10) || 0);
    const limit = Math.min(LIMITS.textSlice, Math.max(1, parseInt(q.get('limit') || String(LIMITS.textSlice), 10) || LIMITS.textSlice));
    const end = Math.min(f.text_chars || 0, offset + limit);
    // Only the supervisor's own contiguous reading discharges its debt.
    if (p.isSupervisor && offset <= (f.read_chars || 0) && (f.read_chars || 0) < end) {
      await store().updateFile(id, (d) => { if (d && offset <= (d.read_chars || 0)) { d.read_chars = Math.max(d.read_chars || 0, end); d.read_at = nowIso(now); } });
    }
    const full = f.text_blob ? ((await store().getBlob(f.text_blob))?.data.toString('utf8') || '') : (f.text || '');
    return { file_id: id, offset, end, total: f.text_chars || 0, done: end >= (f.text_chars || 0), text: full.slice(offset, end), extract_status: f.extract_status, extract_note: f.extract_note, text_truncated: f.text_truncated };
  }

  async function fileRaw(p, id) {
    need(p);
    const f = await store().getFile(id);
    if (!f) throw new HttpError(404, 'فایل پیدا نشد');
    await reportOr404(p, f.report_number);
    const blob = await store().getBlob(id);
    if (!blob) throw new HttpError(410, 'بایت‌های این فایل در دسترس نیست');
    if (p.isSupervisor && !f.viewed_at) await store().updateFile(id, (d) => { if (d) d.viewed_at = nowIso(now); });
    return { bytes: blob.data, mime: f.mime, filename: f.filename };
  }

  async function shot(p, id) {
    need(p);
    if (!/^shot_[0-9a-f]{16}$/.test(id)) throw new HttpError(404, 'تصویر پیدا نشد');
    const blob = await store().getBlob(id);
    if (!blob) throw new HttpError(404, 'تصویر پیدا نشد');
    if (!p.isAdmin && !p.isSupervisor) {
      const owns = (await store().listReports()).some((r) => r.created_by_uid === p.uid && (r.notes || []).some((nt) => nt.shot_id === id || nt.after_shot_id === id));
      if (!owns) throw new HttpError(404, 'تصویر پیدا نشد');
    }
    return { bytes: blob.data, mime: blob.mime };
  }

  async function addNote(p, n, body) {
    need(p);
    const reviewer = !!p.isSupervisor;
    const text = clip(body.text);
    if (!text) throw new HttpError(422, 'متنِ یادداشت خالی است');
    const outcome = body.outcome ?? null;
    if (outcome != null && !reviewer) throw new HttpError(422, '«نتیجه» را فقط ناظر ثبت می‌کند');
    if (reviewer) {
      if (!OUTCOMES.includes(outcome)) throw new HttpError(422, 'جوابِ ناظر باید نتیجه داشته باشد: fixed | partial | needs-owner | not-done');
      const deps = Array.isArray(body.dependencies) ? body.dependencies.filter((d) => d && d.name) : [];
      if (!deps.length) throw new HttpError(422, 'هر جوابِ ناظر زنجیرهٔ وابستگی می‌خواهد (dependencies: [{name, status, note}])');
    }
    const after = reviewer ? parseDataUrl(body.after_shot) : null;
    const commits = (Array.isArray(body.commits) ? body.commits : []).map((c) => clip(c, 60)).filter(Boolean).slice(0, 20);
    if (reviewer && outcome === 'fixed') {
      if (!after) throw new HttpError(422, '«درست شد» بدونِ تصویرِ بعد پذیرفته نمی‌شود — تصویر بفرست یا نتیجه را partial/not-done بگذار');
      if (!commits.length && clip(body.no_change_reason).length < 40) throw new HttpError(422, '«درست شد» بدونِ کامیت پذیرفته نمی‌شود (یا no_change_reason ِ دست‌کم ۴۰ نویسه)');
    }
    const r0 = await reportOr404(p, n);
    if (r0.status === 'filed') throw new HttpError(422, 'برگهٔ بایگانی‌شده بسته است — برای موضوعِ تازه برگهٔ تازه ثبت کن');
    if (r0.status === 'declined') throw new HttpError(422, 'این برگه رد شده و بسته است');
    if (reviewer && r0.status === 'pending') throw new HttpError(422, 'این برگه هنوز تأییدِ مدیر را ندارد — ناظر رویش کار نمی‌کند');
    if (reviewer && outcome === 'fixed' && r0.spot?.anchor && (r0.notes || []).some((x) => x.by === 'owner' && HERE.test(x.text)) && clip(body.place, 300).length < 5) {
      throw new HttpError(422, 'برگه «اینجا» را با کادر گفته — برای «درست شد» بنویس دقیقاً کجا گذاشتی (place)');
    }
    const filesRev = r0.files_rev || 0;
    if (reviewer) {
      const debt = fileReadDebt(await store().listFiles(n));
      if (debt.length) {
        throw new HttpError(422, 'پیش از جواب باید پیوست‌ها را کامل بخوانی — ' + debt.slice(0, 6).map((d) => (d.reason === 'text'
          ? `«${d.filename}»: ${d.remaining} نویسه از ${d.text_chars} خوانده نشده` : `«${d.filename}»: هنوز باز نشده`)).join('؛ '));
      }
    }
    const nid = newId();
    const shotId = await storeShot(parseDataUrl(body.shot));
    const afterId = await storeShot(after);
    const fileIds = (Array.isArray(body.file_ids) ? body.file_ids : []).map(String).filter((x) => /^file_[0-9a-f]{16}$/.test(x)).slice(0, 40);
    const report = await store().updateReport(n, (d) => {
      if (!d) throw new HttpError(404, 'برگه پیدا نشد');
      if (reviewer && (d.files_rev || 0) !== filesRev) throw new HttpError(409, 'هم‌زمان فایلِ تازه‌ای به برگه اضافه شد — دوباره pull کن و آن را هم بخوان');
      const at = nowIso(now);
      const note = { id: nid, by: reviewer ? 'reviewer' : 'owner', at, text, author: p.email, shot_id: shotId };
      if (body.spot) note.spot = cleanSpot(body.spot);
      if (reviewer) {
        Object.assign(note, { outcome, after_shot_id: afterId, commits, place: clip(body.place, 300), no_change_reason: clip(body.no_change_reason, 2000) });
        d.deps = [...(d.deps || []), ...body.dependencies.filter((x) => x && x.name).slice(0, 60).map((x) => ({ name: clip(x.name, 160), status: clip(x.status, 20), note: clip(x.note, 300), note_id: nid }))];
        if (['open', 'answered'].includes(d.status)) d.status = 'answered';
        if (d.urgent_at && !d.urgent_done_at) { d.urgent_done_at = at; d.urgent_claimed_at = null; }
      } else {
        if (d.urgent_done_at) d.urgent_done_at = null; // back into the urgent queue at its ORIGINAL place
        if (['answered', 'approved'].includes(d.status)) d.status = 'open';
        if (d.status === 'open' && !p.isAdmin) d.status = 'pending';
      }
      d.notes = [...(d.notes || []), note];
      d.updated_at = at;
      return d;
    });
    for (const fid of fileIds) {
      // A bad id must not turn a saved note into a 500 (the client would retry and duplicate it).
      try { await store().updateFile(fid, (f) => { if (f && f.report_number === Number(n) && !f.note_id) f.note_id = nid; }); }
      catch (e) { console.warn('[inspection] could not attach file to note', fid, e.message); }
    }
    return { ok: true, report: publicReport(report, await store().listFiles(n)) };
  }

  async function editNote(p, n, noteId, body) {
    need(p);
    const text = clip(body.text);
    if (!text) throw new HttpError(422, 'متنِ یادداشت خالی است');
    await reportOr404(p, n);
    const report = await store().updateReport(n, (d) => {
      if (!d) throw new HttpError(404, 'برگه پیدا نشد');
      if (['filed', 'declined'].includes(d.status)) throw new HttpError(422, 'برگهٔ بسته ویرایش نمی‌شود — تاریخچه دست‌نخورده می‌ماند');
      const t = (d.notes || []).find((x) => x.id === noteId);
      if (!t) throw new HttpError(404, 'یادداشت پیدا نشد');
      const mine = p.isSupervisor ? 'reviewer' : 'owner';
      if (t.by !== mine) throw new HttpError(403, 'یادداشتِ طرفِ مقابل ویرایش نمی‌شود — یادداشتِ تازه بنویس');
      if (mine === 'owner' && !p.isAdmin && t.author !== p.email) throw new HttpError(403, 'فقط یادداشتِ خودت را می‌توانی ویرایش کنی');
      if (!t.original_text) t.original_text = t.text;
      t.text = text; t.edited_at = nowIso(now);
      if (d.notes[0].id === noteId) d.title = headline(text);
      d.updated_at = nowIso(now);
      return d;
    });
    return { ok: true, report: publicReport(report, await store().listFiles(n)) };
  }

  async function setStatus(p, n, body) {
    needAdmin(p);
    const want = String(body.status || '');
    if (!['open', 'approved'].includes(want)) throw new HttpError(422, 'فقط «open» یا «approved» پذیرفته می‌شود');
    const report = await store().updateReport(n, (d) => {
      if (!d) throw new HttpError(404, 'برگه پیدا نشد');
      if (d.status === 'filed') throw new HttpError(422, 'برگهٔ بایگانی‌شده بسته است');
      if (['pending', 'declined'].includes(d.status)) throw new HttpError(422, 'برگهٔ کاربر را با «پذیرش/رد» بررسی کن، نه با تیک');
      d.status = want; d.approved_by = want === 'approved' ? p.email : null; d.approved_at = want === 'approved' ? nowIso(now) : null;
      d.updated_at = nowIso(now);
      return d;
    });
    return { ok: true, report: publicReport(report, await store().listFiles(n)) };
  }

  async function triage(p, n, body) {
    needAdmin(p);
    if (!['accept', 'decline'].includes(body.decision)) throw new HttpError(422, 'decision باید accept یا decline باشد');
    const report = await store().updateReport(n, (d) => {
      if (!d) throw new HttpError(404, 'برگه پیدا نشد');
      if (d.status !== 'pending') throw new HttpError(422, `این برگه منتظرِ تأیید نیست (${STATUS_LABEL[d.status]})`);
      d.status = body.decision === 'accept' ? 'open' : 'declined';
      d.triage = { decision: body.decision, note: clip(body.note, 2000), by: p.email, at: nowIso(now) };
      d.updated_at = nowIso(now);
      return d;
    });
    return { ok: true, report: publicReport(report, await store().listFiles(n)) };
  }

  async function urgent(p, n, on) {
    needAdmin(p);
    const report = await store().updateReport(n, (d) => {
      if (!d) throw new HttpError(404, 'برگه پیدا نشد');
      if (on) {
        if (['filed', 'declined'].includes(d.status)) throw new HttpError(422, 'برگهٔ بسته نوبتِ فوری نمی‌گیرد');
        if (d.status === 'pending') { d.status = 'open'; d.triage = { decision: 'accept', note: 'via urgent', by: p.email, at: nowIso(now) }; }
        if (!d.urgent_at || d.urgent_done_at) { d.urgent_at = nowIso(now); d.urgent_done_at = null; d.urgent_claimed_at = null; }
      } else { d.urgent_at = null; d.urgent_done_at = null; d.urgent_claimed_at = null; }
      d.updated_at = nowIso(now);
      return d;
    });
    const ahead = on ? (await store().listReports()).filter((r) => r.urgent_at && !r.urgent_done_at && !NOT_FOR_SUPERVISOR.includes(r.status) && r.urgent_at < report.urgent_at).length : 0;
    return { ok: true, position: on ? ahead + 1 : 0, report: publicReport(report, await store().listFiles(n)) };
  }

  async function claimUrgent(p) {
    need(p);
    if (!p.isSupervisor) throw new HttpError(403, 'صفِ فوری را فقط حسابِ ناظر برمی‌دارد');
    const cands = (await store().listReports())
      .filter((r) => r.urgent_at && !r.urgent_done_at && !NOT_FOR_SUPERVISOR.includes(r.status))
      .filter((r) => !r.urgent_claimed_at || now() - Date.parse(r.urgent_claimed_at) > LIMITS.urgentClaimMs)
      .sort((a, b) => String(a.urgent_at).localeCompare(String(b.urgent_at)));
    for (const c of cands) {
      const got = await store().updateReport(c.number, (d) => {
        if (!d || d.urgent_done_at || (d.urgent_claimed_at && now() - Date.parse(d.urgent_claimed_at) <= LIMITS.urgentClaimMs)) return null;
        d.urgent_claimed_at = nowIso(now);
        return d;
      });
      if (got) return { report: publicReport(got, await store().listFiles(got.number)) };
    }
    return { report: null };
  }

  async function queue(p) {
    need(p);
    if (!p.isSupervisor && !p.isAdmin) throw new HttpError(403, 'صفِ ناظر فقط برای مدیر و ناظر است');
    const rows = (await store().listReports()).filter((r) => !NOT_FOR_SUPERVISOR.includes(r.status));
    const out = [];
    for (const r of rows) if (isOwed(r) || r.status === 'answered') out.push(publicReport(r, await store().listFiles(r.number)));
    return { reports: out, owed: out.filter((r) => r.owed).length };
  }

  // Ticked sheets → the binder (supervisor each round, or the owner).
  async function fileApproved(p) {
    need(p);
    if (!p.isSupervisor && !p.isAdmin) throw new HttpError(403, 'بایگانی کارِ ناظر یا مدیر است');
    const approved = (await store().listReports()).filter((r) => r.status === 'approved').sort((a, b) => a.number - b.number);
    const filed = [];
    for (const r of approved) {
      // Each page is allocated in its own transaction on the binder counter, so two concurrent rounds
      // (urgent + full, or the owner) can never hand out the same page.
      const binder = await store().updateMeta('binders', (m) => {
        const cur = m.current || { number: 1, count: 0 };
        const next = cur.count >= LIMITS.binderCapacity ? { number: cur.number + 1, count: 1 } : { number: cur.number, count: cur.count + 1 };
        m.current = next;
        return { number: next.number, page: next.count };
      });
      const ok = await store().updateReport(r.number, (d) => {
        if (!d || d.status !== 'approved') return false;
        d.status = 'filed'; d.binder = binder; d.filed_at = nowIso(now); d.updated_at = nowIso(now);
        return true;
      });
      if (ok) filed.push({ number: r.number, binder });
    }
    return { ok: true, filed };
  }

  /* -------------------------------- router -------------------------------- */
  async function route(req, res) {
    const url = new URL(req.url || '/', 'http://x');
    const path = url.pathname.replace(/\/+$/, '');
    const m = req.method || 'GET';
    if (m === 'OPTIONS') { res.writeHead(204, cors(req)); return res.end(); }
    try {
      if (path === '/api/inspection/supervisor/login' && m === 'POST') {
        const body = await readJsonBody(req, { limit: 4096 });
        const ip = clientIp(req);
        // Per-client AND global failure limits: the client IP header can be spoofed, the global one cannot.
        if (globalLimiter.blocked('*', now())) throw new HttpError(429, 'تلاشِ ناموفقِ زیاد — ۱۵ دقیقهٔ دیگر');
        try { return send(req, res, 200, { token: supervisorLogin(env.SUPERVISOR_PASSWORD, body.password, limiter, ip, now()), expires_in_s: 43200 }); }
        catch (e) { if (e instanceof HttpError && e.status === 401) globalLimiter.fail('*', now()); throw e; }
      }
      const p = await principalFrom(req, { verifyIdToken, env, now: now() });
      // Never buffer a large body for an anonymous caller.
      if (!p && ['POST', 'PATCH'].includes(m)) throw new HttpError(401, 'برای این کار باید وارد شوید');
      if (path === '/api/me' && m === 'GET') return send(req, res, 200, await me(p));
      if (m === 'DELETE' && !/\/urgent$/.test(path)) throw new HttpError(405, 'حذفِ برگه/فایل/یادداشت ممنوع است (قاعدهٔ مالک) — برگه می‌ماند؛ «رد» یا «بایگانی» کن');
      let mm;
      if (path === '/api/inspection' && m === 'GET') return send(req, res, 200, await list(p, url.searchParams));
      if (path === '/api/inspection' && m === 'POST') return send(req, res, 200, await create(p, await readJsonBody(req, { limit: 8 * 1024 * 1024 })));
      if (path === '/api/inspection/queue' && m === 'GET') return send(req, res, 200, await queue(p));
      if (path === '/api/inspection/storage-health' && m === 'GET') {
        need(p);
        if (!p.isAdmin && !p.isSupervisor) throw new HttpError(403, 'فقط مدیر و ناظر');
        const db = getDb && getDb();
        if (!db) throw new HttpError(503, 'Firestore روی سرورِ بات وصل نیست');
        return send(req, res, 200, await storageHealth(db, { listUsers }));
      }
      if (path === '/api/inspection/urgent/claim' && m === 'POST') return send(req, res, 200, await claimUrgent(p));
      if (path === '/api/inspection/file' && m === 'POST') return send(req, res, 200, await fileApproved(p));
      if ((mm = path.match(/^\/api\/inspection\/files\/(file_[0-9a-f]{16})\/text$/)) && m === 'GET') return send(req, res, 200, await fileText(p, mm[1], url.searchParams));
      if ((mm = path.match(/^\/api\/inspection\/files\/(file_[0-9a-f]{16})\/raw$/)) && m === 'GET') { const r = await fileRaw(p, mm[1]); return sendBytes(req, res, r.mime, r.bytes, r.filename); }
      if ((mm = path.match(/^\/api\/inspection\/shots\/([\w]+)$/)) && m === 'GET') { const r = await shot(p, mm[1]); return sendBytes(req, res, r.mime, r.bytes); }
      if ((mm = path.match(/^\/api\/inspection\/(\d+)$/)) && m === 'GET') return send(req, res, 200, await getOne(p, Number(mm[1])));
      if ((mm = path.match(/^\/api\/inspection\/(\d+)\/files$/)) && m === 'POST') return send(req, res, 200, await uploadFile(p, Number(mm[1]), await readJsonBody(req, { limit: 30 * 1024 * 1024 })));
      if ((mm = path.match(/^\/api\/inspection\/(\d+)\/notes$/)) && m === 'POST') return send(req, res, 200, await addNote(p, Number(mm[1]), await readJsonBody(req, { limit: 12 * 1024 * 1024 })));
      if ((mm = path.match(/^\/api\/inspection\/(\d+)\/notes\/([0-9a-f]{16})$/)) && m === 'PATCH') return send(req, res, 200, await editNote(p, Number(mm[1]), mm[2], await readJsonBody(req)));
      if ((mm = path.match(/^\/api\/inspection\/(\d+)\/status$/)) && m === 'POST') return send(req, res, 200, await setStatus(p, Number(mm[1]), await readJsonBody(req)));
      if ((mm = path.match(/^\/api\/inspection\/(\d+)\/triage$/)) && m === 'POST') return send(req, res, 200, await triage(p, Number(mm[1]), await readJsonBody(req)));
      if ((mm = path.match(/^\/api\/inspection\/(\d+)\/urgent$/)) && (m === 'POST' || m === 'DELETE')) return send(req, res, 200, await urgent(p, Number(mm[1]), m === 'POST'));
      throw new HttpError(404, 'مسیر پیدا نشد');
    } catch (e) {
      const status = e instanceof HttpError ? e.status : (/payload too large/.test(e?.message) ? 413 : /invalid JSON/.test(e?.message) ? 400 : 500);
      if (status === 500) console.error('[inspection]', e);
      return send(req, res, status, { error: status === 500 ? 'خطای داخلیِ سرور' : e.message, detail: e.message });
    }
  }

  return { route, matches: (url) => /^\/api\/(inspection(\/|$)|me$)/.test(String(url || '').split('?')[0].replace(/\/+$/, '')) };
}
