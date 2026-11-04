// «📝 نظارت» — on every page: turn it on, drag a box around what is wrong, write what you saw,
// attach any files, send. The sheet records the page, the box (document coordinates + the
// element under it as a verified selector with fractions) and a picture of the area.
// While it is on, sheets already filed for this page are drawn as highlights:
// orange = waiting for the supervisor · green = the supervisor fixed it (with proof) · blue = ticked by the owner.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createSheet, listSheets, uploadFile, getMe, setUrgent, rushMessage, GLOW_COLOR, STATUS_FA } from '../lib/inspectionApi.js';
import { describeSpot, placeSpot } from '../lib/inspectionGeometry.js';

const isOurs = (el) => !!(el && el.closest && el.closest('[data-inspection-ui]'));

// A JPEG of the boxed area (+ margin), cropped from a render of the page. Never blocks sending:
// on failure the sheet goes without a picture and says so.
async function captureArea(spot) {
  const { toCanvas } = await import('html-to-image');
  const body = document.body;
  if (body.scrollHeight > 12000) throw new Error('صفحه برای عکس‌گرفتن بیش از حد بلند است');
  const full = await toCanvas(body, { pixelRatio: 1, cacheBust: true, filter: (n) => !(n.dataset && 'inspectionUi' in n.dataset), backgroundColor: getComputedStyle(body).backgroundColor || '#fff' });
  const bodyRect = body.getBoundingClientRect();
  const offX = bodyRect.left + window.scrollX, offY = bodyRect.top + window.scrollY;
  const pad = 60;
  const sx = Math.max(0, spot.rect.x - offX - pad), sy = Math.max(0, spot.rect.y - offY - pad);
  const sw = Math.min(full.width - sx, spot.rect.w + pad * 2), sh = Math.min(full.height - sy, spot.rect.h + pad * 2);
  const out = document.createElement('canvas');
  out.width = Math.max(1, sw); out.height = Math.max(1, sh);
  const ctx = out.getContext('2d');
  ctx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
  ctx.strokeRect(spot.rect.x - offX - sx, spot.rect.y - offY - sy, spot.rect.w, spot.rect.h);
  return out.toDataURL('image/jpeg', 0.82);
}

export const ACTIVE_LS = 'quran.inspection.active';
const readActive = () => { try { return localStorage.getItem(ACTIVE_LS) === '1'; } catch { return false; } };
const writeActive = (v) => { try { if (v) localStorage.setItem(ACTIVE_LS, '1'); else localStorage.removeItem(ACTIVE_LS); } catch { /* */ } };
const lastAnswer = (r) => [...(r.notes || [])].reverse().find((x) => x.by === 'reviewer');

// Parity with Detective/Bank (owner, 2026-11-04): while the mode is on the PAGE STAYS USABLE; a box is drawn only while
// «armed» — hold Alt, or press «✏️ کادر» (touch). The picture is taken right after the box is drawn and shown in the
// form (retake, or Ctrl+V a real screenshot which wins), the owner can tick ⚡ فوری in the form, and existing sheets on
// the page show their status and the supervisor's last answer on hover.
export default function InspectionLayer({ user, pageLabel = '', onOpenBoard }) {
  const [on, setOnState] = useState(readActive);
  const setOn = (v) => { setOnState(v); writeActive(v); };
  const [armed, setArmed] = useState(false);
  const [drag, setDrag] = useState(null);       // {x0,y0,x,y} viewport while drawing
  const [box, setBox] = useState(null);         // finished box (viewport)
  const [spot, setSpot] = useState(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [urgent, setUrgentBox] = useState(false);
  const [shot, setShot] = useState(null);       // {data, kind:'rendered'|'pasted'} | {err}
  const [shooting, setShooting] = useState(false);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);         // {kind:'ok'|'err', text}
  const [marks, setMarks] = useState([]);
  const [hover, setHover] = useState(null);     // {r, x, y}
  const [, setTick] = useState(0);
  const startRef = useRef(null);
  const dragRef = useRef(null);
  // «رفتن به همان‌جا» from the board: /page?insp=<n> turns the layer on and scrolls to that sheet's box.
  const [focusN, setFocusN] = useState(() => {
    try { const v = new URLSearchParams(window.location.search).get('insp'); return v && /^\d+$/.test(v) ? Number(v) : null; } catch { return null; }
  });
  useEffect(() => { if (focusN && user) setOn(true); }, [focusN, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!focusN || !marks.length) return;
    const r = marks.find((x) => x.number === focusN);
    if (!r) { setMsg({ kind: 'err', text: `کادرِ برگهٔ ${focusN} روی این صفحه پیدا نشد (شاید عمومی یا بایگانی است)` }); setFocusN(null); return; }
    const p = placeSpot(r.spot);
    if (p) window.scrollTo({ top: Math.max(0, window.scrollY + p.y - 120), behavior: 'smooth' });
    setFlash(focusN);
    setTimeout(() => setFlash(null), 4000);
    setFocusN(null);
    try { const u = new URL(window.location.href); u.searchParams.delete('insp'); window.history.replaceState(window.history.state, '', u.toString()); } catch { /* */ }
  }, [focusN, marks]);
  const [flash, setFlash] = useState(null);

  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const loadMarks = useCallback(async () => {
    try { const d = await listSheets(`path=${encodeURIComponent(window.location.pathname)}`); setMarks(d.reports || []); }
    catch (e) { setMarks([]); setMsg({ kind: 'err', text: e.message }); }
  }, []);
  useEffect(() => { if (on && user) loadMarks(); }, [on, user, path, loadMarks]);
  useEffect(() => { if (on && user && !me) Promise.resolve().then(() => getMe()).then((m) => setMe(m || { isAdmin: false })).catch(() => setMe({ isAdmin: false })); }, [on, user, me]);
  // fresh highlights when the owner comes back to the tab (the supervisor may have answered meanwhile)
  useEffect(() => {
    if (!on || !user) return undefined;
    window.addEventListener('focus', loadMarks);
    return () => window.removeEventListener('focus', loadMarks);
  }, [on, user, loadMarks]);
  useEffect(() => {
    if (!on) return undefined;
    const re = () => setTick((t) => t + 1);
    window.addEventListener('scroll', re, true); window.addEventListener('resize', re);
    return () => { window.removeEventListener('scroll', re, true); window.removeEventListener('resize', re); };
  }, [on]);
  // Alt arms the box while held; releasing it before a drag disarms. Esc steps back: form → armed → off.
  useEffect(() => {
    if (!on) return undefined;
    const down = (e) => {
      if (e.key === 'Escape') {
        if (box) { reset(); } else if (armed) { setArmed(false); setDragBoth(null); } else { setOn(false); }
        return;
      }
      if (e.key === 'Alt' && !box) { e.preventDefault(); setArmed(true); }
    };
    const up = (e) => { if (e.key === 'Alt' && !dragRef.current && !box) setArmed(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [on, box, armed]); // eslint-disable-line react-hooks/exhaustive-deps
  // hover tooltip over existing highlights (the marks stay pointer-events:none so the page is never blocked)
  useEffect(() => {
    if (!on || !marks.length) { setHover(null); return undefined; }
    const mv = (e) => {
      let hit = null;
      for (const r of marks) {
        const p = placeSpot(r.spot);
        if (p && e.clientX >= p.x && e.clientX <= p.x + p.w && e.clientY >= p.y && e.clientY <= p.y + p.h) { hit = { r, x: e.clientX, y: e.clientY }; break; }
      }
      setHover(hit);
    };
    document.addEventListener('mousemove', mv);
    return () => document.removeEventListener('mousemove', mv);
  }, [on, marks]);

  if (!user) return null;

  function reset() { setBox(null); setSpot(null); setText(''); setFiles([]); setDrag(null); setShot(null); setShooting(false); setUrgentBox(false); setArmed(false); }
  // The drag lives in a ref too: React state lags one render behind fast mouse events, so `up` used to read a
  // stale rectangle and the frame came out truncated (owner sheet 7, item 8).
  function setDragBoth(d) { dragRef.current = d; setDrag(d); }
  const down = (e) => { if (box) return; startRef.current = { x: e.clientX, y: e.clientY }; setDragBoth({ x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }); };
  const move = (e) => { const d = dragRef.current; if (d) setDragBoth({ ...d, x: e.clientX, y: e.clientY }); };
  async function takeShot(sp) {
    setShooting(true);
    try {
      const data = await captureArea(sp);
      setShot(data.length > 5_000_000 ? { err: 'تصویر بزرگ بود؛ می‌توانید عکسِ صفحه را با Ctrl+V بچسبانید' } : { data, kind: 'rendered' });
    } catch (e) { setShot({ err: `عکسِ ناحیه گرفته نشد: ${e.message}` }); }
    finally { setShooting(false); }
  }
  const up = (e) => {
    const d0 = dragRef.current;
    if (!d0) return;
    const d = e && e.clientX != null ? { ...d0, x: e.clientX, y: e.clientY } : d0;
    const b = { x: Math.min(d.x0, d.x), y: Math.min(d.y0, d.y), w: Math.abs(d.x - d.x0), h: Math.abs(d.y - d.y0) };
    setDragBoth(null);
    if (b.w < 6 || b.h < 6) return;
    const sp = describeSpot(b, { ignore: isOurs, pageLabel });
    setBox(b); setSpot(sp); setArmed(false);
    takeShot(sp);
  };
  // Ctrl+V of a real screenshot (an image on the clipboard) replaces the rendered one.
  const onPaste = (e) => {
    const item = [...((e.clipboardData && e.clipboardData.items) || [])].find((x) => x.type && x.type.startsWith('image/'));
    if (!item) return;
    const f = item.getAsFile();
    if (!f) return;
    e.preventDefault();
    const rd = new FileReader();
    rd.onload = () => setShot({ data: String(rd.result), kind: 'pasted' });
    rd.readAsDataURL(f);
  };

  async function send() {
    if (!text.trim()) { setMsg({ kind: 'err', text: 'بنویسید چه دیدید یا چه می‌خواهید.' }); return; }
    setBusy(true); setMsg(null);
    const data = shot && shot.data && shot.data.length <= 5_000_000 ? shot.data : null;
    const shotNote = data ? '' : shot && shot.err ? ` (${shot.err})` : ' (بی‌تصویر)';
    try {
      const r = await createSheet({ text: text.trim(), spot, shot: data });
      const n = r.report.number;
      const failed = [];
      for (const f of files) { try { await uploadFile(n, f); } catch (e) { failed.push(`${f.name}: ${e.message}`); } }
      let rush = '';
      if (urgent && me && me.isAdmin) {
        try { const u = await setUrgent(n, true); rush = ` — ⚡ ${rushMessage(u.position, u.next_round)}`; }
        catch (e) { rush = ` — ⚡ فوری ثبت نشد: ${e.message} (از صفحهٔ برگه‌ها دوباره بزنید)`; failed.push('فوری'); }
      }
      setMsg({ kind: failed.length ? 'err' : 'ok', text: `برگهٔ ${n} ثبت شد${r.pending_owner ? ' — منتظرِ تأییدِ مدیر' : ''}${shotNote}${rush}` + (failed.filter((x) => x !== 'فوری').length ? ` — پیوست‌های ناموفق: ${failed.filter((x) => x !== 'فوری').join('؛ ')}` : '') });
      reset(); loadMarks();
    } catch (e) { setMsg({ kind: 'err', text: e.message }); }
    finally { setBusy(false); }
  }

  const live = drag ? { x: Math.min(drag.x0, drag.x), y: Math.min(drag.y0, drag.y), w: Math.abs(drag.x - drag.x0), h: Math.abs(drag.y - drag.y0) } : box;

  return (
    <div data-inspection-ui="" dir="rtl">
      <button type="button" className="insp-fab" data-testid="inspection-toggle" onClick={() => { setOn(!on); reset(); setMsg(null); }}
        title="کادر بکشید و ایراد یا پیشنهاد را ثبت کنید" aria-pressed={on}>
        {on ? '✕ پایانِ نظارت' : '📝 نظارت'}
      </button>
      {on && (
        <>
          {armed && !box && (
            <div className="insp-veil" data-testid="inspection-veil" onMouseDown={down} onMouseMove={move} onMouseUp={up}
              onTouchStart={(e) => down(e.touches[0])} onTouchMove={(e) => move(e.touches[0])} onTouchEnd={() => up()} />
          )}
          {marks.map((r) => {
            const p = placeSpot(r.spot);
            if (!p) return null;
            return (
              <div key={r.number} className={`insp-mark${flash === r.number ? ' flash' : ''}`} data-testid={`mark-${r.number}`} style={{ left: p.x, top: p.y, width: p.w, height: p.h, borderColor: GLOW_COLOR[r.glow] || GLOW_COLOR.orange }}>
                <span style={{ background: GLOW_COLOR[r.glow] || GLOW_COLOR.orange }}>{r.number}</span>
              </div>
            );
          })}
          {hover && !armed && !box && (
            <div className="insp-tip" data-testid="mark-tip" style={{ left: Math.min(hover.x + 12, window.innerWidth - 300), top: hover.y + 14 }}>
              <b>برگهٔ {hover.r.number}</b> · {STATUS_FA[hover.r.status] || hover.r.status}{hover.r.urgent_at && !hover.r.urgent_done_at ? ' · ⚡' : ''}
              <div>{hover.r.title}</div>
              {lastAnswer(hover.r) && <div className="insp-tip-ans">🤖 {String(lastAnswer(hover.r).text || '').slice(0, 160)}</div>}
              {hover.r.spot?.anchor && placeSpot(hover.r.spot)?.via === 'rect' && <small>جای تقریبی (عنصرِ اصلی دیگر پیدا نمی‌شود)</small>}
            </div>
          )}
          {live && <div className="insp-box" style={{ left: live.x, top: live.y, width: live.w, height: live.h }} />}
          {!box && (
            <div className="insp-hint">
              {armed ? 'کادر بکشید دورِ ایراد یا جای پیشنهاد' : <>برای کادر کشیدن <kbd>Alt</kbd> را نگه دارید یا <button type="button" data-testid="inspection-arm" onClick={() => setArmed(true)}>✏️ کادر</button></>}
              {' '}· صفحه در این حالت کار می‌کند · Esc = خروج{onOpenBoard ? <> · <button type="button" onClick={onOpenBoard}>برگه‌ها</button></> : null}
            </div>
          )}
          {box && (
            <div className="insp-form" role="dialog" aria-label="ثبتِ برگهٔ نظارت" onPaste={onPaste}>
              <h4>برگهٔ نظارت — {pageLabel || spot?.path}</h4>
              {spot?.anchor && <p className="insp-meta">عنصر: <code>{spot.anchor.tag}</code>{spot.anchor.verified ? '' : ' (گره تأیید نشد)'} · «{(spot.covered_text || '').slice(0, 80)}»</p>}
              <div className="insp-shotbox" data-testid="shot-preview">
                {shooting ? <span>⏳ گرفتنِ تصویرِ کادر…</span>
                  : shot && shot.data ? <img src={shot.data} alt="تصویرِ کادر" />
                  : <span className="insp-meta">{shot && shot.err ? shot.err : 'بی‌تصویر'}</span>}
                <div className="insp-shot-actions">
                  <button type="button" className="linklike" disabled={shooting} onClick={() => takeShot(spot)}>📷 گرفتنِ دوبارهٔ تصویر</button>
                  <small>{shot && shot.kind === 'pasted' ? 'تصویرِ چسبانده‌شده' : 'Ctrl+V: عکسِ صفحه را بچسبانید'}</small>
                </div>
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="چه دیدید؟ چه باید بشود؟ (اگر «اینجا» می‌نویسید، همین کادر منظور است)" />
              <label className="insp-files">📎 پیوست (هر نوع فایل، تا ۲۰ مگابایت)
                <input type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
              </label>
              {files.length > 0 && <ul className="insp-filelist">{files.map((f) => <li key={f.name}>{f.name} · {Math.ceil(f.size / 1024)}KB</li>)}</ul>}
              {me && me.isAdmin && (
                <label className="insp-urgent"><input type="checkbox" data-testid="form-urgent" checked={urgent} onChange={(e) => setUrgentBox(e.target.checked)} /> ⚡ فوری (به صفِ ناظرِ فوری می‌رود)</label>
              )}
              <div className="insp-actions">
                <button type="button" className="btn-primary" disabled={busy || shooting} onClick={send}>{busy ? 'در حالِ ثبت…' : 'ثبتِ برگه'}</button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={reset}>کادرِ دیگر</button>
              </div>
            </div>
          )}
        </>
      )}
      {msg && <div className={`insp-toast ${msg.kind}`} role="status" onClick={() => setMsg(null)}>{msg.text}</div>}
    </div>
  );
}

export const INSPECTION_CSS = `
.insp-fab{position:fixed;left:16px;bottom:16px;z-index:9990;border:none;border-radius:999px;padding:.6rem 1rem;font-weight:700;background:#0f766e;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.2);cursor:pointer}
.insp-veil{position:fixed;inset:0;z-index:9980;cursor:crosshair;background:rgba(15,23,42,.06)}
.insp-box{position:fixed;z-index:9985;border:2px dashed #ef4444;background:rgba(239,68,68,.08);pointer-events:none}
.insp-mark{position:fixed;z-index:9983;border:3px solid;border-radius:6px;pointer-events:none}
.insp-mark.flash{animation:inspflash 1s ease-in-out 4;box-shadow:0 0 0 6px rgba(239,68,68,.45)}
@keyframes inspflash{50%{box-shadow:0 0 0 12px rgba(239,68,68,.15)}}
.insp-mark span{position:absolute;top:-12px;right:-12px;color:#fff;border-radius:999px;padding:0 .4rem;font-size:.75rem;font-weight:700}
.insp-hint{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9986;background:#0f172a;color:#fff;padding:.4rem .8rem;border-radius:.6rem;font-size:.85rem}
.insp-hint button{background:none;border:none;color:#5eead4;text-decoration:underline;cursor:pointer}
.insp-form{position:fixed;left:16px;bottom:70px;z-index:9995;width:min(420px,calc(100vw - 32px));background:var(--card-bg,#fff);color:var(--text-main,#0f172a);border:1px solid var(--border-color,#e2e8f0);border-radius:1rem;padding:1rem;box-shadow:0 12px 32px rgba(0,0,0,.25)}
.insp-form h4{margin:0 0 .5rem}
.insp-form textarea{width:100%;box-sizing:border-box;border-radius:.6rem;padding:.5rem;border:1px solid var(--border-color,#cbd5e1);font:inherit}
.insp-meta{font-size:.8rem;opacity:.8;margin:.2rem 0 .5rem}
.insp-files{display:block;margin:.5rem 0;font-size:.85rem}
.insp-filelist{font-size:.8rem;margin:.2rem 0}
.insp-actions{display:flex;gap:.5rem;margin-top:.5rem}
.insp-toast{position:fixed;left:16px;bottom:70px;z-index:9996;max-width:min(460px,calc(100vw - 32px));padding:.6rem .9rem;border-radius:.7rem;color:#fff;background:#0f766e;cursor:pointer}
.insp-toast.err{background:#b91c1c}
.insp-hint kbd{background:#334155;border-radius:.3rem;padding:0 .3rem;font-size:.8rem}
.insp-tip{position:fixed;z-index:9987;max-width:280px;background:#0f172a;color:#fff;border-radius:.6rem;padding:.45rem .6rem;font-size:.8rem;pointer-events:none;box-shadow:0 8px 20px rgba(0,0,0,.3)}
.insp-tip-ans{margin-top:.25rem;color:#a7f3d0}
.insp-shotbox{border:1px dashed var(--border-color,#cbd5e1);border-radius:.6rem;padding:.4rem;margin:.3rem 0 .5rem;text-align:center}
.insp-shotbox img{max-width:100%;max-height:160px;border-radius:.4rem}
.insp-shot-actions{display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-top:.25rem;font-size:.8rem}
.insp-urgent{display:block;margin:.4rem 0;font-weight:600}
`;
