// «📝 نظارت» — on every page: turn it on, drag a box around what is wrong, write what you saw,
// attach any files, send. The sheet records the page, the box (document coordinates + the
// element under it as a verified selector with fractions) and a picture of the area.
// While it is on, sheets already filed for this page are drawn as highlights:
// orange = waiting for the supervisor · green = the supervisor fixed it (with proof) · blue = ticked by the owner.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createSheet, listSheets, uploadFile, GLOW_COLOR, STATUS_FA } from '../lib/inspectionApi.js';
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

export default function InspectionLayer({ user, pageLabel = '', onOpenBoard }) {
  const [on, setOn] = useState(false);
  const [drag, setDrag] = useState(null);       // {x0,y0,x,y} viewport while drawing
  const [box, setBox] = useState(null);         // finished box (viewport)
  const [spot, setSpot] = useState(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);         // {kind:'ok'|'err', text}
  const [marks, setMarks] = useState([]);
  const [, setTick] = useState(0);
  const startRef = useRef(null);
  // «رفتن به همان‌جا» from the board: /page?insp=<n> turns the layer on and scrolls to that sheet's box.
  const [focusN, setFocusN] = useState(() => {
    try { const v = new URLSearchParams(window.location.search).get('insp'); return v && /^\d+$/.test(v) ? Number(v) : null; } catch { return null; }
  });
  useEffect(() => { if (focusN && user) setOn(true); }, [focusN, user]);
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
  useEffect(() => {
    if (!on) return undefined;
    const re = () => setTick((t) => t + 1);
    window.addEventListener('scroll', re, true); window.addEventListener('resize', re);
    return () => { window.removeEventListener('scroll', re, true); window.removeEventListener('resize', re); };
  }, [on]);
  useEffect(() => {
    if (!on) return undefined;
    const esc = (e) => { if (e.key === 'Escape') { setOn(false); setBox(null); setDrag(null); } };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [on]);

  if (!user) return null;

  const reset = () => { setBox(null); setSpot(null); setText(''); setFiles([]); setDrag(null); };
  const down = (e) => { if (box) return; startRef.current = { x: e.clientX, y: e.clientY }; setDrag({ x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }); };
  const move = (e) => { if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY }); };
  const up = () => {
    if (!drag) return;
    const b = { x: Math.min(drag.x0, drag.x), y: Math.min(drag.y0, drag.y), w: Math.abs(drag.x - drag.x0), h: Math.abs(drag.y - drag.y0) };
    setDrag(null);
    if (b.w < 6 || b.h < 6) return;
    setBox(b);
    setSpot(describeSpot(b, { ignore: isOurs, pageLabel }));
  };

  async function send() {
    if (!text.trim()) { setMsg({ kind: 'err', text: 'بنویسید چه دیدید یا چه می‌خواهید.' }); return; }
    setBusy(true); setMsg(null);
    let shot = null; let shotNote = '';
    try { shot = await captureArea(spot); if (shot.length > 5_000_000) { shot = null; shotNote = ' (تصویر بزرگ بود و فرستاده نشد)'; } }
    catch (e) { shotNote = ` (عکسِ ناحیه گرفته نشد: ${e.message})`; }
    try {
      const r = await createSheet({ text: text.trim(), spot, shot });
      const n = r.report.number;
      const failed = [];
      for (const f of files) { try { await uploadFile(n, f); } catch (e) { failed.push(`${f.name}: ${e.message}`); } }
      setMsg({ kind: failed.length ? 'err' : 'ok', text: `برگهٔ ${n} ثبت شد${r.pending_owner ? ' — منتظرِ تأییدِ مدیر' : ''}${shotNote}` + (failed.length ? ` — پیوست‌های ناموفق: ${failed.join('؛ ')}` : '') });
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
          <div className="insp-veil" onMouseDown={down} onMouseMove={move} onMouseUp={up}
            onTouchStart={(e) => down(e.touches[0])} onTouchMove={(e) => move(e.touches[0])} onTouchEnd={up} />
          {marks.map((r) => {
            const p = placeSpot(r.spot);
            if (!p) return null;
            return (
              <div key={r.number} className={`insp-mark${flash === r.number ? ' flash' : ''}`} data-testid={`mark-${r.number}`} style={{ left: p.x, top: p.y, width: p.w, height: p.h, borderColor: GLOW_COLOR[r.glow] || GLOW_COLOR.orange }}
                title={`برگهٔ ${r.number} — ${STATUS_FA[r.status] || r.status}: ${r.title}`}>
                <span style={{ background: GLOW_COLOR[r.glow] || GLOW_COLOR.orange }}>{r.number}</span>
              </div>
            );
          })}
          {live && <div className="insp-box" style={{ left: live.x, top: live.y, width: live.w, height: live.h }} />}
          {!box && <div className="insp-hint">دورِ ایراد یا جای پیشنهاد کادر بکشید · Esc = خروج{onOpenBoard ? <> · <button type="button" onClick={onOpenBoard}>برگه‌ها</button></> : null}</div>}
          {box && (
            <div className="insp-form" role="dialog" aria-label="ثبتِ برگهٔ نظارت">
              <h4>برگهٔ نظارت — {pageLabel || spot?.path}</h4>
              {spot?.anchor && <p className="insp-meta">عنصر: <code>{spot.anchor.tag}</code>{spot.anchor.verified ? '' : ' (گره تأیید نشد)'} · «{(spot.covered_text || '').slice(0, 80)}»</p>}
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="چه دیدید؟ چه باید بشود؟ (اگر «اینجا» می‌نویسید، همین کادر منظور است)" />
              <label className="insp-files">📎 پیوست (هر نوع فایل، تا ۲۰ مگابایت)
                <input type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
              </label>
              {files.length > 0 && <ul className="insp-filelist">{files.map((f) => <li key={f.name}>{f.name} · {Math.ceil(f.size / 1024)}KB</li>)}</ul>}
              <div className="insp-actions">
                <button type="button" className="btn-primary" disabled={busy} onClick={send}>{busy ? 'در حالِ ثبت…' : 'ثبتِ برگه'}</button>
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
`;
