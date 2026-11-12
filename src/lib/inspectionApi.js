// Client for the «نظارت و سرکشی» API served by the bot service (server/inspection.mjs).
// The access boundary is the SERVER: every call carries the signed-in user's Firebase ID token
// and the server decides the role (admin = verified email in ADMIN_EMAILS on Render). The UI only
// hides buttons the server would refuse anyway.
import { auth } from './firebase.js';

// Public URL of the bot service (not a secret). Override per environment at build time.
export const INSPECTION_API = String(
  import.meta.env.VITE_INSPECTION_API_URL || import.meta.env.VITE_AI_PROXY_URL || 'https://quran-telegram-bot-tnr7.onrender.com',
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function authHeader() {
  const u = auth.currentUser;
  if (!u) return {};
  const token = await u.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// Sheet 2-۴: the bot service sleeps on the free tier, so the first call after a pause can die with
// «Failed to fetch» while it boots. A READ is safe to repeat, so it is retried quietly (and that retry
// is what wakes the service); a write is never repeated — it could create the same sheet twice.
export const RETRY_DELAYS_MS = [1500, 4000, 8000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function api(path, { method = 'GET', body, signal, retryDelays = RETRY_DELAYS_MS } = {}) {
  const headers = { ...(await authHeader()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const delays = method === 'GET' ? retryDelays : [];
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(INSPECTION_API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
      break;
    } catch (e) {
      const aborted = (signal && signal.aborted) || (e && e.name === 'AbortError');
      if (!aborted && attempt < delays.length) { await sleep(delays[attempt]); continue; }
      // A cold free-tier/sleeping service or no network: say so, never fail silently.
      throw new ApiError(0, `سرورِ نظارت در دسترس نیست (${e && e.message ? e.message : 'شبکه'}) — چند ثانیهٔ دیگر دوباره تلاش کنید`);
    }
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `HTTP ${res.status}`);
  return data;
}

// Bytes (screenshots / attachments) need the auth header too, so <img src> cannot fetch them
// directly: fetch → object URL. The caller revokes it.
// Screenshots are served by the server only as PNG/JPEG/WebP; attachments (download: true) are re-typed
// as opaque bytes so the browser can never render them as a document in this origin.
export async function fetchBlobUrl(path, { download = false } = {}) {
  const res = await fetch(INSPECTION_API + path, { headers: await authHeader() });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  const blob = await res.blob();
  const safe = download || !/^image\/(png|jpeg|webp)$/.test(blob.type) ? new Blob([blob], { type: 'application/octet-stream' }) : blob;
  return URL.createObjectURL(safe);
}

export const getMe = () => api('/api/me');
export const listSheets = (q = '') => api('/api/inspection' + (q ? `?${q}` : ''));
export const getSheet = (n) => api(`/api/inspection/${n}`);
export const createSheet = (body) => api('/api/inspection', { method: 'POST', body });
export const addNote = (n, body) => api(`/api/inspection/${n}/notes`, { method: 'POST', body });
export const setStatus = (n, status) => api(`/api/inspection/${n}/status`, { method: 'POST', body: { status } });
export const triage = (n, decision, note = '') => api(`/api/inspection/${n}/triage`, { method: 'POST', body: { decision, note } });
export const setUrgent = (n, on) => api(`/api/inspection/${n}/urgent`, { method: on ? 'POST' : 'DELETE' });
export const getRounds = () => api('/api/inspection/rounds');
// «درخواستِ عمومی»: a sheet tied to no page/box (same queue, colours, urgent, binder).
export const GENERAL_SPOT = { general: true };

// Human time on the READER's clock (the server sends instants, never a guessed timezone).
export const clockFa = (iso) => { try { return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
export function gapFa(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 1) return 'همین حالا';
  if (m < 60) return `${m.toLocaleString('fa-IR')} دقیقهٔ دیگر`;
  const h = Math.floor(m / 60); const r = m % 60;
  return `${h.toLocaleString('fa-IR')} ساعت${r ? ` و ${r.toLocaleString('fa-IR')} دقیقه` : ''} دیگر`;
}
// The message after «⚡ فوری»: where in the queue, and when the supervisor is expected.
export function rushMessage(position, nr) {
  const pos = position > 1 ? `نوبتِ ${Number(position).toLocaleString('fa-IR')} در صفِ فوری` : 'اولِ صفِ فوری';
  if (!nr) return `${pos}.`;
  if (nr.basis === 'stale') return `${pos} — ولی ناظرِ فوری مدتی است سر نزده؛ روتینش را بررسی کنید.`;
  const left = (Date.parse(nr.at) - Date.now()) / 60000;
  return `${pos} — ناظر حدودِ ساعتِ ${clockFa(nr.at)} (${gapFa(left)}) سراغش می‌آید${nr.basis === 'assumed' ? ' (تخمینی)' : ''}.`;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error || new Error('خواندنِ فایل ناموفق بود'));
    r.readAsDataURL(file);
  });
}

export const MAX_FILE_MB = 20;
export async function uploadFile(n, file, { caption = '', noteId = '' } = {}) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new ApiError(413, `«${file.name}» بیش از ${MAX_FILE_MB} مگابایت است`);
  const data_b64 = await fileToBase64(file);
  return api(`/api/inspection/${n}/files`, { method: 'POST', body: { filename: file.name, mime: file.type || 'application/octet-stream', caption, note_id: noteId, data_b64 } });
}

export const STATUS_FA = {
  pending: 'در انتظارِ تأییدِ مدیر', open: 'در انتظارِ ناظر', answered: 'ناظر پاسخ داد',
  approved: 'تأییدِ مالک', filed: 'بایگانی‌شده', declined: 'ردِ مدیر',
};
export const OUTCOME_FA = {
  fixed: '✓ درست شد', partial: '◑ نیمه‌کاره', 'needs-owner': '؟ منتظرِ انتخابِ مالک', 'not-done': '✗ درست نشد',
};
export const GLOW_COLOR = { orange: '#f59e0b', green: '#16a34a', blue: '#2563eb', grey: '#94a3b8' };
