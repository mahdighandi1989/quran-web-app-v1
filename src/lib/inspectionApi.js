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

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { ...(await authHeader()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(INSPECTION_API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
  } catch (e) {
    // A cold free-tier/sleeping service or no network: say so, never fail silently.
    throw new ApiError(0, `سرورِ نظارت در دسترس نیست (${e && e.message ? e.message : 'شبکه'}) — چند ثانیهٔ دیگر دوباره تلاش کنید`);
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `HTTP ${res.status}`);
  return data;
}

// Bytes (screenshots / attachments) need the auth header too, so <img src> cannot fetch them
// directly: fetch → object URL. The caller revokes it.
export async function fetchBlobUrl(path) {
  const res = await fetch(INSPECTION_API + path, { headers: await authHeader() });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export const getMe = () => api('/api/me');
export const listSheets = (q = '') => api('/api/inspection' + (q ? `?${q}` : ''));
export const getSheet = (n) => api(`/api/inspection/${n}`);
export const createSheet = (body) => api('/api/inspection', { method: 'POST', body });
export const addNote = (n, body) => api(`/api/inspection/${n}/notes`, { method: 'POST', body });
export const setStatus = (n, status) => api(`/api/inspection/${n}/status`, { method: 'POST', body: { status } });
export const triage = (n, decision, note = '') => api(`/api/inspection/${n}/triage`, { method: 'POST', body: { decision, note } });
export const setUrgent = (n, on) => api(`/api/inspection/${n}/urgent`, { method: on ? 'POST' : 'DELETE' });

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
