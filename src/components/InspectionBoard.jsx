// «نظارت و سرکشی» — the board. The owner (admin) sees every sheet and is the only one who can
// tick (approve), accept/decline a user's sheet, or press «⚡ فوری». Other signed-in users see
// only their own sheets. The supervisor never uses this page; it answers through the API.
// Nothing here can delete a sheet (owner's rule) — the server refuses it too.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getMe, listSheets, getSheet, addNote, setStatus, triage, setUrgent, uploadFile, fetchBlobUrl, createSheet,
  STATUS_FA, OUTCOME_FA, GLOW_COLOR, GENERAL_SPOT, clockFa, gapFa, rushMessage,
} from '../lib/inspectionApi.js';

const FILTERS = [
  ['', 'همه'], ['open', 'در انتظارِ ناظر'], ['answered', 'پاسخ‌داده'], ['pending', 'منتظرِ تأییدِ مدیر'],
  ['approved', 'تأییدشده'], ['filed', 'بایگانی'], ['declined', 'رد'],
];
const fmt = (iso) => { try { return new Date(iso).toLocaleString('fa-IR'); } catch { return iso || ''; } };

function AuthedImage({ path, alt }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let u = null; let live = true;
    fetchBlobUrl(path).then((x) => { u = x; if (live) setUrl(x); else URL.revokeObjectURL(x); }).catch((e) => live && setErr(e.message));
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [path]);
  if (err) return <span className="insp-err">تصویر بارگذاری نشد ({err})</span>;
  return url ? <a href={url} target="_blank" rel="noreferrer"><img className="insp-shot" src={url} alt={alt} /></a> : <span>⏳</span>;
}

// An attachment is untrusted: a blob: document runs IN THIS ORIGIN (an uploaded .html/.svg could read
// the sign-in session). So it is always DOWNLOADED as opaque bytes, never opened in a tab.
async function openFile(id, filename) {
  const url = await fetchBlobUrl(`/api/inspection/files/${id}/raw`, { download: true });
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'attachment'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : null);
// «رفتن به همان‌جا»: the page, with ?insp=<n> so the inspection layer turns on and scrolls to the box.
export const sheetHref = (r) => {
  const p = safePath(r && r.spot && r.spot.path);
  return p ? `${p}${p.includes('?') ? '&' : '?'}insp=${r.number}` : null;
};
const urgentOpen = (r) => !!(r.urgent_at && !r.urgent_done_at);

// The supervisor's rounds, measured on the server from its own visits (server/lib/rounds.mjs).
// The urgent queue runs every 3 hours (cron `23 */3 * * *` UTC); the server reports the measured cadence.
export const cadenceFa = (mins) => {
  const m = Number(mins);
  if (!Number.isFinite(m) || m <= 0) return '';
  return m % 60 === 0 ? ` — هر ${(m / 60).toLocaleString('fa-IR')} ساعت` : ` — هر ${m.toLocaleString('fa-IR')} دقیقه`;
};
export function RoundsBar({ rounds }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  if (!rounds) return null;
  const u = rounds.urgent || {}; const f = rounds.full || {};
  const left = (Date.parse(u.at) - Date.now()) / 60000;
  return (
    <div className="insp-rounds" data-testid="rounds-bar">
      {u.basis === 'stale'
        ? <span className="r-bad">⚡ ناظرِ فوری مدتی است سر نزده (آخرین دور: {u.last_seen ? fmt(u.last_seen) : '—'}) — روتینش را بررسی کنید</span>
        : <span>⚡ دورِ بعدیِ ناظرِ فوری: {clockFa(u.at)} ({gapFa(left)}){u.basis === 'assumed' ? ' — تخمینی' : ''}{cadenceFa(u.every_minutes)}</span>}
      <span>آخرین دورِ ناظر: {u.last_seen ? fmt(u.last_seen) : 'هنوز ثبت نشده'}</span>
      {f.basis === 'stale'
        ? <span className="r-bad">🔍 دورِ کاملِ ناظر مدتی است نیامده — روتینش را بررسی کنید</span>
        : <span>🔍 بازرسیِ کاملِ بعدی: {f.at ? new Date(f.at).toLocaleString('fa-IR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : '—'}</span>}
      <span>آخرین دورِ کامل: {f.last_seen ? fmt(f.last_seen) : 'هنوز ثبت نشده'}</span>
    </div>
  );
}

function Sheet({ n, me, onChanged }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const load = useCallback(() => getSheet(n).then((d) => setR(d.report)).catch((e) => setErr(e.message)), [n]);
  useEffect(() => { setR(null); setErr(''); load(); }, [load]);

  const act = async (fn) => {
    setBusy(true); setErr('');
    try { const d = await fn(); if (d && d.report) setR(d.report); else await load(); onChanged(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const sendNote = () => act(async () => {
    const d = await addNote(n, { text });
    const noteId = d.report.notes[d.report.notes.length - 1].id;
    for (const f of files) await uploadFile(n, f, { noteId });
    setText(''); setFiles([]);
    return getSheet(n);
  });

  if (err && !r) return <div className="insp-err">{err}</div>;
  if (!r) return <div>⏳ بارگذاری…</div>;
  const closed = ['filed', 'declined'].includes(r.status);
  return (
    <div className="insp-sheet">
      <h3><span className="insp-dot" style={{ background: GLOW_COLOR[r.glow] }} /> برگهٔ {r.number} — {r.title}</h3>
      <p className="insp-meta">
        {STATUS_FA[r.status]} · {r.created_by} · {fmt(r.created_at)}
        {r.spot?.general ? <> · <span className="insp-general">درخواستِ عمومی</span></> : null}
        {sheetHref(r) ? <> · صفحه: <code>{r.spot.path}</code> · <a href={sheetHref(r)} data-testid="goto">رفتن به همان‌جا ↗</a></> : null}
        {r.urgent_at && !r.urgent_done_at ? ' · ⚡ فوری' : ''}
        {r.binder ? ` · زونکنِ ${r.binder.number} برگِ ${r.binder.page}` : ''}
      </p>
      {r.spot?.anchor && <p className="insp-meta">گره: <code dir="ltr">{r.spot.anchor.selector || '—'}</code> {r.spot.anchor.verified ? '✓' : '(تأییدنشده)'}</p>}
      {r.triage && <p className="insp-meta">بررسیِ مدیر: {r.triage.decision === 'accept' ? 'پذیرفته' : 'رد'} {r.triage.note ? `— ${r.triage.note}` : ''}</p>}
      <ol className="insp-notes">
        {r.notes.map((x) => (
          <li key={x.id} className={x.by === 'reviewer' ? 'rev' : 'own'}>
            <b>{x.by === 'reviewer' ? '🤖 ناظر' : `👤 ${x.author}`}</b> · <small>{fmt(x.at)}{x.edited_at ? ' (ویرایش‌شده)' : ''}</small>
            {x.outcome && <span className={`insp-outcome o-${x.outcome}`}>{OUTCOME_FA[x.outcome]}</span>}
            <div className="insp-text">{x.text}</div>
            {x.commits?.length > 0 && <div className="insp-meta">کامیت: {x.commits.map((c) => <code key={c} dir="ltr">{c} </code>)}</div>}
            {x.place && <div className="insp-meta">کجا: {x.place}</div>}
            {x.shot_id && <AuthedImage path={`/api/inspection/shots/${x.shot_id}`} alt="تصویرِ پیش" />}
            {x.after_shot_id && <><div className="insp-meta">تصویرِ بعد (مدرک):</div><AuthedImage path={`/api/inspection/shots/${x.after_shot_id}`} alt="تصویرِ بعد" /></>}
          </li>
        ))}
      </ol>
      {r.files?.length > 0 && (
        <div><h4>پیوست‌ها</h4><ul>
          {r.files.map((f) => (
            <li key={f.id}>
              <button type="button" className="linklike" onClick={() => openFile(f.id, f.filename).catch((e) => setErr(e.message))}>{f.filename}</button>
              {' '}· {Math.ceil(f.byte_size / 1024)}KB · استخراج: {f.extract_status}{f.extract_note ? ` — ${f.extract_note}` : ''}
              {' '}· {f.extract_status === 'ok'
                ? (f.fully_read ? <span className="r-ok">✓ ناظر کاملش را خواند</span> : <span className="r-warn">ناظر {(f.read_percent ?? 0).toLocaleString('fa-IR')}٪ خوانده</span>)
                : (f.viewed_at ? <span className="r-ok">✓ ناظر بازش کرد</span> : <span className="r-warn">ناظر هنوز بازش نکرده</span>)}
              {f.caption ? <div className="insp-meta">{f.caption}</div> : null}
            </li>
          ))}
        </ul></div>
      )}
      {r.deps?.length > 0 && (
        <details><summary>زنجیرهٔ وابستگی ({r.deps.length})</summary>
          <ul>{r.deps.map((d, i) => <li key={i}>{d.name} — <b>{d.status}</b> {d.note}</li>)}</ul>
        </details>
      )}
      {err && <div className="insp-err">{err}</div>}
      {info && <div className="insp-info" data-testid="rush-info">{info}</div>}
      <div className="insp-actions">
        {me.isAdmin && r.status === 'pending' && <>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => act(() => triage(n, 'accept'))}>پذیرش</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => act(() => triage(n, 'decline', prompt('دلیلِ رد (اختیاری):') || ''))}>رد</button>
        </>}
        {me.isAdmin && ['open', 'answered'].includes(r.status) && (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => act(() => setStatus(n, 'approved'))} title="تیکِ تأیید فقط دستِ مالک است">✓ تأییدِ مالک</button>
        )}
        {me.isAdmin && r.status === 'approved' && <button type="button" className="btn-secondary" disabled={busy} onClick={() => act(() => setStatus(n, 'open'))}>برداشتنِ تیک</button>}
        {me.isAdmin && !closed && (r.urgent_at && !r.urgent_done_at
          ? <button type="button" className="btn-secondary" disabled={busy} onClick={() => act(() => setUrgent(n, false))}>لغوِ فوری</button>
          : <button type="button" className="btn-secondary" disabled={busy} onClick={() => act(async () => { const d = await setUrgent(n, true); setInfo(rushMessage(d.position, d.next_round)); return d; })}>⚡ فوری</button>)}
      </div>
      {!closed && (
        <div className="insp-reply">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="یادداشتِ تازه زیرِ همین برگه (برگهٔ پاسخ‌داده دوباره باز می‌شود)" />
          <input type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
          <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={sendNote}>افزودنِ یادداشت</button>
        </div>
      )}
    </div>
  );
}

export default function InspectionBoard({ user }) {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [rounds, setRounds] = useState(null);
  const [general, setGeneral] = useState(null); // { text, files, urgent }
  const [done, setDone] = useState([]);         // «ناظر روی موردهای فوری کار کرد»
  const seen = useRef({});
  const remember = (list) => { for (const r of list) seen.current[r.number] = `${r.status}|${(r.notes || []).length}`; };
  const load = useCallback(async () => {
    setErr('');
    try {
      const d = await listSheets(filter ? `status=${filter}` : '');
      setRows(d.reports); setCounts(d.counts || {}); setMe(d.me); setRounds(d.rounds || null); remember(d.reports);
    } catch (e) { setErr(e.message); }
  }, [filter]);
  useEffect(() => { if (user) { getMe().then(setMe).catch((e) => setErr(e.message)); load(); } }, [user, load]);

  // Auto-refresh ONLY while something is rushed (an idle page must not poll forever), every 20 s and on
  // focus. A rushed sheet that changed (answered) is named in a banner, not just silently redrawn.
  const watching = useMemo(() => rows.filter(urgentOpen).map((r) => r.number).join(','), [rows]);
  useEffect(() => {
    if (!watching) return undefined;
    let alive = true;
    const tickPoll = async () => {
      try {
        const d = await listSheets(filter ? `status=${filter}` : '');
        if (!alive) return;
        const changed = [];
        for (const r of d.reports) {
          const before = seen.current[r.number]; const nowS = `${r.status}|${(r.notes || []).length}`;
          if (before && before !== nowS && r.urgent_at && (r.urgent_done_at || r.status === 'answered')) changed.push({ number: r.number, title: r.title, label: STATUS_FA[r.status] });
        }
        remember(d.reports);
        setRows(d.reports); setCounts(d.counts || {}); setRounds(d.rounds || null);
        if (changed.length) setDone((prev) => [...changed, ...prev].slice(0, 5));
      } catch { /* offline or signed out — the next tick tries again */ }
    };
    const t = setInterval(tickPoll, 20000);
    window.addEventListener('focus', tickPoll);
    return () => { alive = false; clearInterval(t); window.removeEventListener('focus', tickPoll); };
  }, [watching, filter]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [String(r.number), r.title, r.created_by, r.spot?.path, ...(r.notes || []).map((x) => x.text)]
      .some((v) => String(v || '').toLowerCase().includes(s)));
  }, [rows, q]);

  async function submitGeneral() {
    if (!general?.text.trim()) return;
    setErr('');
    try {
      const r = (await createSheet({ text: general.text.trim(), spot: GENERAL_SPOT })).report;
      const failed = [];
      for (const f of general.files) { try { await uploadFile(r.number, f); } catch (e) { failed.push(`${f.name}: ${e.message}`); } }
      let msg = `درخواستِ عمومیِ ${r.number} ثبت شد`;
      if (general.urgent && me?.isAdmin) { const u = await setUrgent(r.number, true); msg += ` — ${rushMessage(u.position, u.next_round)}`; }
      setGeneral(null);
      if (failed.length) setErr(`${msg}، ولی این پیوست‌ها بالا نرفتند: ${failed.join(' · ')}`); else setDone((prev) => [{ number: r.number, title: r.title, label: msg, info: true }, ...prev].slice(0, 5));
      await load(); setSel(r.number);
    } catch (e) { setErr(e.message); }
  }

  if (!user) return <section className="page-section"><p className="help-text">برای «نظارت و سرکشی» ابتدا با گوگل وارد شوید.</p></section>;
  return (
    <section className="page-section insp-board" dir="rtl">
      <h2>📝 نظارت و سرکشی</h2>
      {me && !me.adminConfigured && <div className="insp-err">ADMIN_EMAILS روی سرورِ بات تنظیم نیست — هیچ حسابی مدیر نیست (Render › quran-telegram-bot › Environment).</div>}
      <p className="help-text">
        {me?.isAdmin ? 'شما مدیر هستید: همهٔ برگه‌ها را می‌بینید؛ تیکِ تأیید، پذیرش/رد و «فوری» فقط با شماست.' : 'برگه‌های خودتان را می‌بینید؛ برگهٔ تازه پس از تأییدِ مدیر به ناظر می‌رسد.'}
        {' '}برای ثبتِ برگهٔ تازه دکمهٔ «📝 نظارت» پایینِ صفحه را بزنید و روی هر صفحه کادر بکشید.
        {' '}ناظرِ خودکار: صفِ فوری هر ۳ ساعت (دقیقهٔ ۲۳)، دورِ کامل دوشنبه و پنجشنبه.
      </p>
      {done.length > 0 && (
        <div className="insp-done" role="status" data-testid="urgent-done">
          <b>{done.some((d) => !d.info) ? '⚡ ناظر روی موردهای فوری کار کرد:' : '✓'}</b>
          <ul>{done.map((d, i) => <li key={`${d.number}-${i}`}><button type="button" className="linklike" onClick={() => setSel(d.number)}>برگهٔ {d.number}</button>{d.title ? ` — ${d.title}` : ''} · {d.label}</li>)}</ul>
          {done.some((d) => !d.info) && <small>صفحه خودش به‌روز شد — بازش کنید و ببینید.</small>}
          <button type="button" className="linklike" onClick={() => setDone([])}>بستن</button>
        </div>
      )}
      <RoundsBar rounds={rounds} />
      <div className="insp-toolbar">
        <input type="search" placeholder="جستجو در برگه‌ها (شماره، متن، یادداشت‌ها، صفحه)…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="insp-search" />
        <button type="button" className="btn-secondary" onClick={() => setGeneral(general ? null : { text: '', files: [], urgent: false })}>＋ درخواستِ عمومی</button>
      </div>
      {general && (
        <div className="insp-general-form" data-testid="general-form">
          <b>درخواستِ عمومی</b> <small>— به کادرِ خاصی روی صفحه گره نخورده؛ همان صف، رنگ، فوری و بایگانی.</small>
          <textarea rows={4} value={general.text} onChange={(e) => setGeneral({ ...general, text: e.target.value })} placeholder="چه می‌خواهید؟" />
          <label>📎 پیوست (هر نوع فایل، تا ۲۰ مگابایت){general.files.length ? ` — ${general.files.length} فایل` : ''}
            <input type="file" multiple onChange={(e) => { const l = [...(e.target.files || [])]; if (l.length) setGeneral({ ...general, files: [...general.files, ...l] }); e.target.value = ''; }} />
          </label>
          {me?.isAdmin && <label><input type="checkbox" checked={general.urgent} onChange={(e) => setGeneral({ ...general, urgent: e.target.checked })} /> ⚡ فوری</label>}
          <div className="insp-actions">
            <button type="button" className="btn-primary" disabled={!general.text.trim()} onClick={submitGeneral}>ثبت</button>
            <button type="button" className="btn-secondary" onClick={() => setGeneral(null)}>انصراف</button>
          </div>
        </div>
      )}
      <div className="seg insp-filters">
        {FILTERS.map(([k, t]) => (
          <button key={k || 'all'} type="button" className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
            {t}{k && counts[k] != null && !filter ? ` (${counts[k]})` : ''}
          </button>
        ))}
        <button type="button" onClick={load}>↻</button>
      </div>
      {err && <div className="insp-err">{err}</div>}
      <div className="insp-layout">
        <ul className="insp-list">
          {shown.length === 0 && <li className="help-text">{q ? 'برگه‌ای با این جستجو نیست.' : 'برگه‌ای نیست.'}</li>}
          {shown.map((r) => (
            <li key={r.number} className={sel === r.number ? 'sel' : ''}>
              <button type="button" onClick={() => setSel(r.number)}>
                <span className="insp-dot" style={{ background: GLOW_COLOR[r.glow] }} />
                <b>{r.number}</b> {r.title} <small>· {STATUS_FA[r.status]}{urgentOpen(r) ? ' · ⚡' : ''}{r.spot?.general ? ' · عمومی' : ''}</small>
              </button>
            </li>
          ))}
        </ul>
        <div className="insp-detail">{sel && me ? <Sheet n={sel} me={me} onChanged={load} /> : <p className="help-text">یک برگه را انتخاب کنید.</p>}</div>
      </div>
    </section>
  );
}

export const BOARD_CSS = `
.insp-rounds{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0;font-size:.8rem}
.insp-rounds span{border:1px solid var(--border-color,#e2e8f0);border-radius:.5rem;padding:.25rem .55rem}
.insp-rounds .r-bad{border-color:#fca5a5;background:#fee2e2;color:#991b1b}
.r-ok{color:#16a34a}.r-warn{color:#d97706}
.insp-toolbar{display:flex;gap:.5rem;flex-wrap:wrap;margin:.4rem 0}
.insp-toolbar input{flex:1;min-width:200px;padding:.4rem .6rem;border-radius:.5rem;border:1px solid var(--border-color,#cbd5e1);font:inherit}
.insp-general-form{display:flex;flex-direction:column;gap:.4rem;border:1px solid #c4b5fd;background:rgba(139,92,246,.06);border-radius:.8rem;padding:.7rem;margin:.4rem 0}
.insp-general-form textarea{width:100%;box-sizing:border-box;border-radius:.5rem;padding:.5rem;font:inherit}
.insp-general{background:#ede9fe;color:#5b21b6;border-radius:.4rem;padding:0 .4rem}
.insp-done{border:1px solid #6ee7b7;background:#ecfdf5;color:#065f46;border-radius:.8rem;padding:.6rem .8rem;margin:.4rem 0}
.insp-done ul{margin:.2rem 0}
.insp-info{background:#fffbeb;color:#92400e;border-radius:.5rem;padding:.4rem .6rem;margin:.4rem 0}
.insp-board h2{margin-top:0}
.insp-filters{display:flex;flex-wrap:wrap;gap:.3rem;margin:.5rem 0}
.insp-filters button{border:1px solid var(--border-color,#e2e8f0);background:transparent;border-radius:.5rem;padding:.3rem .6rem;cursor:pointer;color:inherit}
.insp-filters button.active{background:var(--primary-color,#0f766e);color:#fff}
.insp-layout{display:grid;grid-template-columns:minmax(220px,1fr) 2fr;gap:1rem}
@media (max-width:760px){.insp-layout{grid-template-columns:1fr}}
.insp-list{list-style:none;padding:0;margin:0;max-height:70vh;overflow:auto}
.insp-list li button{width:100%;text-align:right;background:none;border:none;padding:.5rem;border-bottom:1px solid var(--border-color,#e2e8f0);cursor:pointer;color:inherit}
.insp-list li.sel button{background:var(--primary-color-light,#ccfbf1)}
.insp-dot{display:inline-block;width:.7rem;height:.7rem;border-radius:999px;margin-left:.3rem;vertical-align:middle}
.insp-notes{padding-right:1rem}
.insp-notes li{margin:.6rem 0;padding:.5rem;border-radius:.6rem;background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0)}
.insp-notes li.rev{border-color:#99f6e4}
.insp-text{white-space:pre-wrap;margin:.3rem 0}
.insp-outcome{margin-right:.5rem;font-weight:700}
.insp-outcome.o-fixed{color:#16a34a}.insp-outcome.o-partial{color:#d97706}.insp-outcome.o-not-done{color:#b91c1c}.insp-outcome.o-needs-owner{color:#7c3aed}
.insp-shot{max-width:100%;max-height:320px;border:1px solid #e2e8f0;border-radius:.4rem;margin-top:.3rem}
.insp-err{color:#b91c1c;background:#fee2e2;padding:.4rem .6rem;border-radius:.5rem;margin:.4rem 0}
.insp-reply{display:flex;flex-direction:column;gap:.4rem;margin-top:.8rem}
.insp-reply textarea{width:100%;box-sizing:border-box;border-radius:.6rem;padding:.5rem;font:inherit}
.linklike{background:none;border:none;color:var(--primary-color,#0f766e);text-decoration:underline;cursor:pointer;padding:0}
`;
