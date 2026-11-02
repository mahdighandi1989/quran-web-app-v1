// «نظارت و سرکشی» — the board. The owner (admin) sees every sheet and is the only one who can
// tick (approve), accept/decline a user's sheet, or press «⚡ فوری». Other signed-in users see
// only their own sheets. The supervisor never uses this page; it answers through the API.
// Nothing here can delete a sheet (owner's rule) — the server refuses it too.
import React, { useCallback, useEffect, useState } from 'react';
import {
  getMe, listSheets, getSheet, addNote, setStatus, triage, setUrgent, uploadFile, fetchBlobUrl,
  STATUS_FA, OUTCOME_FA, GLOW_COLOR,
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

async function openFile(id) {
  const url = await fetchBlobUrl(`/api/inspection/files/${id}/raw`);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function Sheet({ n, me, onChanged }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
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
        {r.spot?.path ? <> · صفحه: <a href={r.spot.path}>{r.spot.path}</a></> : null}
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
              <button type="button" className="linklike" onClick={() => openFile(f.id).catch((e) => setErr(e.message))}>{f.filename}</button>
              {' '}· {Math.ceil(f.byte_size / 1024)}KB · استخراج: {f.extract_status}{f.extract_note ? ` — ${f.extract_note}` : ''}
              {' '}· خواندهٔ ناظر: {f.extract_status === 'ok' ? `${f.read_chars}/${f.text_chars}` : (f.viewed_at ? 'باز شد' : 'هنوز نه')}
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
          : <button type="button" className="btn-secondary" disabled={busy} onClick={() => act(() => setUrgent(n, true))}>⚡ فوری</button>)}
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
  const load = useCallback(async () => {
    setErr('');
    try {
      const d = await listSheets(filter ? `status=${filter}` : '');
      setRows(d.reports); setCounts(d.counts || {}); setMe(d.me);
    } catch (e) { setErr(e.message); }
  }, [filter]);
  useEffect(() => { if (user) { getMe().then(setMe).catch((e) => setErr(e.message)); load(); } }, [user, load]);

  if (!user) return <section className="page-section"><p className="help-text">برای «نظارت و سرکشی» ابتدا با گوگل وارد شوید.</p></section>;
  return (
    <section className="page-section insp-board" dir="rtl">
      <h2>📝 نظارت و سرکشی</h2>
      {me && !me.adminConfigured && <div className="insp-err">ADMIN_EMAILS روی سرورِ بات تنظیم نیست — هیچ حسابی مدیر نیست (Render › quran-telegram-bot › Environment).</div>}
      <p className="help-text">
        {me?.isAdmin ? 'شما مدیر هستید: همهٔ برگه‌ها را می‌بینید؛ تیکِ تأیید، پذیرش/رد و «فوری» فقط با شماست.' : 'برگه‌های خودتان را می‌بینید؛ برگهٔ تازه پس از تأییدِ مدیر به ناظر می‌رسد.'}
        {' '}برای ثبتِ برگهٔ تازه دکمهٔ «📝 نظارت» پایینِ صفحه را بزنید و روی هر صفحه کادر بکشید.
        {' '}ناظرِ خودکار: صفِ فوری هر ساعت، دورِ کامل دوشنبه و پنجشنبه.
      </p>
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
          {rows.length === 0 && <li className="help-text">برگه‌ای نیست.</li>}
          {rows.map((r) => (
            <li key={r.number} className={sel === r.number ? 'sel' : ''}>
              <button type="button" onClick={() => setSel(r.number)}>
                <span className="insp-dot" style={{ background: GLOW_COLOR[r.glow] }} />
                <b>{r.number}</b> {r.title} <small>· {STATUS_FA[r.status]}{r.urgent_at && !r.urgent_done_at ? ' · ⚡' : ''}</small>
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
