// Text extraction for inspection attachments — run ONCE, at upload, so the supervisor reads
// text, not bytes. The status never collapses «nothing to read» into «I read nothing»:
//   ok          text extracted — the reviewer must read ALL of it
//   empty       opened, no text inside
//   unsupported no extractor for this type (audio/video/binary/scanned PDF) — open the file itself
//   failed      the extractor broke — reason in `note`; open the file itself
//   image       a picture — look at it
import { isZip, listZip } from './zip.mjs';

export const MAX_TEXT_CHARS = 3_000_000;

const TEXT_EXT = new Set(('txt md markdown csv tsv json jsonl xml html htm xhtml svg js mjs cjs jsx ts tsx py rb go java kt c cc cpp h hpp cs php sh bash zsh ' +
  'yml yaml toml ini cfg conf log sql css scss less env properties srt vtt tex rst bat ps1 r swift dart vue lua pl gradle').split(' '));
const IMAGE_EXT = new Set('png jpg jpeg gif webp bmp tif tiff heic heif avif ico'.split(' '));
const AV_EXT = new Set('mp3 wav m4a ogg oga opus flac aac amr wma mp4 mov mkv webm avi 3gp wmv m4v mpeg mpg'.split(' '));

const ext = (name) => (String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(cp); } catch { return m; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// XML → text: paragraph-ish closing tags become newlines, then all tags are stripped.
function xmlText(xml, { para = /<\/(?:w:p|a:p|text:p|text:h|p|div|li|h[1-6]|tr|br)\s*>|<br\s*\/?>/gi, tab = /<w:tab\/>|<text:tab\/>/g } = {}) {
  return decodeEntities(String(xml).replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(tab, '\t').replace(para, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function utf8Strict(buf) {
  try {
    const s = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    const ctrl = (s.match(/[\u0000-\u0008\u000e-\u001f]/g) || []).length;
    return ctrl > Math.max(8, s.length / 200) ? null : s.replace(/^﻿/, '');
  } catch { return null; }
}

function byName(entries) { return Object.fromEntries(entries.map((e) => [e.name, e])); }
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });

function docx(entries) {
  const m = byName(entries);
  const parts = ['word/document.xml', ...entries.map((e) => e.name).filter((n) => /^word\/(header|footer|footnotes|endnotes|comments)\d*\.xml$/.test(n)).sort(natural)];
  return parts.filter((n) => m[n]).map((n) => (n === 'word/document.xml' ? '' : `\n## ${n}\n`) + xmlText(m[n].read().toString('utf8'))).join('\n').trim();
}

function xlsx(entries) {
  const m = byName(entries);
  const shared = [];
  if (m['xl/sharedStrings.xml']) {
    const xml = m['xl/sharedStrings.xml'].read().toString('utf8');
    for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) || []) shared.push(decodeEntities((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
  }
  const names = {};
  if (m['xl/workbook.xml']) {
    const wb = m['xl/workbook.xml'].read().toString('utf8');
    let i = 1;
    for (const s of wb.match(/<sheet\b[^>]*>/g) || []) { const nm = (s.match(/name="([^"]*)"/) || [])[1]; names[`xl/worksheets/sheet${i++}.xml`] = decodeEntities(nm || ''); }
  }
  const out = [];
  for (const n of entries.map((e) => e.name).filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort(natural)) {
    const xml = m[n].read().toString('utf8');
    const rows = [];
    for (const row of xml.match(/<row\b[\s\S]*?<\/row>/g) || []) {
      const cells = [];
      for (const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
        const t = (c.match(/\bt="([^"]+)"/) || [])[1];
        const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        const is = (c.match(/<is>([\s\S]*?)<\/is>/) || [])[1];
        let val = '';
        if (t === 's' && v != null) val = shared[Number(v)] ?? '';
        else if (is != null) val = decodeEntities(is.replace(/<[^>]+>/g, ''));
        else if (v != null) val = decodeEntities(v);
        cells.push(val);
      }
      if (cells.some((x) => x !== '')) rows.push(cells.join('\t'));
    }
    out.push(`## ${names[n] || n}\n${rows.join('\n')}`);
  }
  return out.join('\n\n').trim();
}

function pptx(entries) {
  const m = byName(entries);
  return entries.map((e) => e.name).filter((n) => /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n)).sort(natural)
    .map((n) => `## ${n.replace(/^ppt\//, '')}\n${xmlText(m[n].read().toString('utf8'))}`).join('\n\n').trim();
}

function odf(entries) {
  const m = byName(entries);
  return m['content.xml'] ? xmlText(m['content.xml'].read().toString('utf8'), { para: /<\/(?:text:p|text:h|table:table-row)\s*>/g }) : '';
}

function epub(entries) {
  return entries.filter((e) => /\.(x?html?)$/i.test(e.name)).sort((a, b) => natural(a.name, b.name))
    .map((e) => `## ${e.name}\n${xmlText(e.read().toString('utf8'))}`).join('\n\n').trim();
}

function rtf(s) {
  return s.replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\par[d]?\b ?/g, '\n').replace(/\\tab\b ?/g, '\t')
    .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

async function pdf(buf) {
  let mod;
  try { mod = await import('unpdf'); } catch {
    return { status: 'unsupported', note: 'استخراجِ PDF روی این سرور نصب نیست (unpdf) — خودِ فایل را باز کن', text: '' };
  }
  const doc = await mod.getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await mod.extractText(doc, { mergePages: false });
  const pages = Array.isArray(text) ? text : [String(text || '')];
  const empty = pages.filter((p) => !String(p).trim()).length;
  const joined = pages.map((p, i) => `## صفحهٔ ${i + 1}\n${String(p).trim()}`).join('\n\n');
  if (!pages.some((p) => String(p).trim())) {
    return { status: 'unsupported', note: `PDF ِ ${totalPages} صفحه‌ای بدونِ لایهٔ متن (احتمالاً اسکن) — همهٔ صفحه‌ها را باید دید`, text: '', page_count: totalPages };
  }
  return { status: 'ok', note: empty ? `${empty} صفحه از ${totalPages} متن نداشت (تصویر/اسکن) — خودِ فایل را هم ببین` : '', text: joined, page_count: totalPages, truncated: empty > 0 };
}

const OFFICE = { docx, docm: docx, dotx: docx, xlsx, xlsm: xlsx, pptx, pptm: pptx, odt: odf, ods: odf, odp: odf, epub };

async function extractInner(buf, name, mime, depth) {
  const e = ext(name);
  const m = String(mime || '').toLowerCase();
  if (IMAGE_EXT.has(e) || m.startsWith('image/')) {
    if (e === 'svg' || m === 'image/svg+xml') return { status: 'ok', note: 'SVG (متنِ کاملِ XML)', text: buf.toString('utf8') };
    return { status: 'image', note: 'تصویر است — ناظر باید نگاهش کند', text: '' };
  }
  if (AV_EXT.has(e) || m.startsWith('audio/') || m.startsWith('video/')) {
    return { status: 'unsupported', note: 'صوت/ویدیو: رونویسیِ خودکار در این پروژه راه‌اندازی نشده — فایل را باز کن و کاملش را گوش کن/ببین', text: '' };
  }
  if (e === 'pdf' || m === 'application/pdf') return pdf(buf);
  if (e === 'rtf' || m === 'application/rtf' || m === 'text/rtf') {
    const t = rtf(buf.toString('latin1'));
    return t ? { status: 'ok', note: '', text: t } : { status: 'empty', note: 'RTF ِ بی‌متن', text: '' };
  }
  if (isZip(buf)) {
    const entries = listZip(buf);
    if (OFFICE[e]) {
      const t = OFFICE[e](entries);
      return t ? { status: 'ok', note: '', text: t } : { status: 'empty', note: 'سند باز شد ولی متنی نداشت', text: '' };
    }
    // a plain archive: every entry with its own reader, nested up to depth 2
    const parts = [`فهرستِ آرشیو (${entries.length} فایل):\n` + entries.map((x) => `- ${x.name} (${x.size} بایت)`).join('\n')];
    const notes = [];
    let truncated = false;
    let chars = parts[0].length;
    for (const ent of entries) {
      if (depth >= 2) { truncated = true; break; }
      if (chars > MAX_TEXT_CHARS) { truncated = true; notes.push('سقفِ متن پر شد؛ بقیهٔ آرشیو را خودت باز کن'); break; }
      try {
        const r = await extractInner(ent.read(), ent.name, '', depth + 1);
        if (r.status === 'ok') { parts.push(`## ${ent.name}\n${r.text}`); chars += r.text.length; }
        else { notes.push(`${ent.name}: ${r.status}`); truncated = true; }
        if (r.truncated) truncated = true;
      } catch (err) { notes.push(`${ent.name}: failed (${err.message})`); truncated = true; }
    }
    return { status: 'ok', note: notes.length ? `بخش‌هایی متن نشد و باید خودِ آرشیو را باز کرد: ${notes.slice(0, 20).join('؛ ')}` : '', text: parts.join('\n\n'), truncated };
  }
  if (OFFICE[e]) return { status: 'failed', note: `پسوندِ ${e} ولی ZIP نیست — فایل خراب یا قالبِ قدیمی است`, text: '' };
  if (['doc', 'xls', 'ppt', 'msg'].includes(e)) {
    return { status: 'unsupported', note: `قالبِ قدیمیِ ${e} — استخراج‌گر ندارد؛ خودِ فایل را باز کن`, text: '' };
  }
  const s = utf8Strict(buf);
  if (s != null && (TEXT_EXT.has(e) || m.startsWith('text/') || /json|xml|javascript|csv|yaml|message\/rfc822/.test(m) || e === 'eml' || s.length)) {
    const text = ['html', 'htm', 'xhtml'].includes(e) || m === 'text/html' ? `${xmlText(s)}\n\n--- HTML ِ خام ---\n${s}` : s;
    return text.trim() ? { status: 'ok', note: '', text } : { status: 'empty', note: 'فایلِ متنیِ خالی', text: '' };
  }
  return { status: 'unsupported', note: `نوعِ «${e || m || 'ناشناخته'}» استخراج‌گر ندارد — خودِ فایل را باز کن`, text: '' };
}

// Public entry: never throws; caps the text and says so.
export async function extractText(buf, name, mime) {
  let r;
  try { r = await extractInner(buf, name, mime, 0); } catch (err) {
    r = { status: 'failed', note: `استخراج شکست خورد: ${String(err && err.message || err).slice(0, 300)}`, text: '' };
  }
  let text = r.text || '';
  let truncated = !!r.truncated;
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    truncated = true;
    r.note = `${r.note ? r.note + ' · ' : ''}متن از سقفِ ${MAX_TEXT_CHARS} نویسه بیشتر بود — خودِ فایل را هم ببین`;
  }
  return { status: r.status, note: r.note || '', text, page_count: r.page_count || 0, truncated };
}
