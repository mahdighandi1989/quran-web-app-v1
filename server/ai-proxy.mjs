// Backend AI proxy — keeps API keys OFF the client.
//
// The browser bundle must never carry a shared/persistent provider key. This endpoint accepts
// an AI chat request and runs it server-side:
//   - Signed-in user: the client sends only a Firebase ID token. We verify it, read that user's
//     key from Firestore (aiConfigs/{uid}) and call the provider. The key never leaves the server.
//   - Guest (not signed in): no server-stored key exists, so the client sends its in-session key
//     in the request body over TLS. We use it transiently for this one call and never persist it.
//
// Wire it into an http server with handleAiProxy(req, res, deps). Dependencies are injected so the
// handler stays unit-testable without Firestore/network: { resolveAI, chat, getAiConfig, verifyIdToken }.

import { assertPublicHttpsUrl, createRateLimiter, UnsafeUrlError } from './lib/netguard.mjs';

// Server-side DEFAULT AI (inspection sheet 5-7, 2026-11-19): so a user who never configured a key can still use
// «پرسش‌وپاسخ», «ساخت آزمون» and the tafsir/hifz buttons. OFF until the owner sets all three on the bot service
// (Render › quran-telegram-bot › Environment — never in the repo):
//   AI_DEFAULT_PROVIDER = a BUILT-IN provider id (google | openai | anthropic | openrouter | groq | deepseek)
//   AI_DEFAULT_MODEL    = the model id (e.g. gemini-2.0-flash)
//   AI_DEFAULT_KEY      = the owner's key for that provider
// Only signed-in users (verified ID token) may use it — never guests — and each account has a daily cap
// (AI_DEFAULT_DAILY_LIMIT, default 50) so the owner's key cannot be drained. A user's own key always wins.
const DEFAULT_PROVIDERS = {
  openai: { kind: 'openai', baseUrl: 'https://api.openai.com/v1' },
  anthropic: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  google: { kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  openrouter: { kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1' },
  groq: { kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
  deepseek: { kind: 'openai', baseUrl: 'https://api.deepseek.com/v1' },
};
export function serverDefaultAI(env = process.env) {
  const id = String((env && env.AI_DEFAULT_PROVIDER) || '').trim().toLowerCase();
  const model = String((env && env.AI_DEFAULT_MODEL) || '').trim();
  const key = String((env && env.AI_DEFAULT_KEY) || '').trim();
  const prov = DEFAULT_PROVIDERS[id];
  if (!prov || !model || !key) return null;
  return { kind: prov.kind, baseUrl: prov.baseUrl, key, model, provider: id };
}
export function defaultDailyLimit(env = process.env) {
  const n = Number(env && env.AI_DEFAULT_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}
// Per-uid daily quota (UTC day, in memory — a restart resets it; that is a soft cap, the provider's own quota is the hard one).
export function createDailyQuota(max) {
  const used = new Map();
  return (uid, now = Date.now()) => {
    const day = new Date(now).toISOString().slice(0, 10);
    const k = `${day}|${uid}`;
    if (used.size > 5000) for (const key of used.keys()) if (!key.startsWith(day)) used.delete(key);
    const n = used.get(k) || 0;
    if (n >= max) return false;
    used.set(k, n + 1);
    return true;
  };
}
const defaultQuota = createDailyQuota(defaultDailyLimit());
// Same daily cap for the bot's AI commands (one shared counter per account across app + bot).
export const allowDefaultFor = (uid) => defaultQuota(uid);

// The client controls the FIRST X-Forwarded-For entry; the hop appended by Render's proxy is the LAST.
export function clientIp(req) {
  const xff = String((req && req.headers && req.headers['x-forwarded-for']) || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : String((req && req.socket && req.socket.remoteAddress) || '');
}

// Read + JSON-parse a request body with a hard size cap (defends against oversized payloads).
export function readJsonBody(req, { limit = 256 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    // Collect Buffers and decode ONCE: decoding per chunk split multi-byte (Persian) characters.
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c) => {
      if (aborted) return;
      size += c.length;
      if (size > limit) { aborted = true; req.destroy(); reject(new Error('payload too large')); return; }
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    req.on('end', () => {
      if (aborted) return;
      const body = Buffer.concat(chunks).toString('utf8');
      if (!body.trim()) return resolve({});
      try { const v = JSON.parse(body); resolve(v && typeof v === 'object' ? v : {}); } catch { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

// CORS: only the app's own origins (ALLOWED_ORIGINS; default = production site + localhost). It was
// `*`, which let any website use this server as a free AI relay. Non-browser clients send no Origin.
const ORIGINS = String(process.env.ALLOWED_ORIGINS || 'https://quran-web-app-8rwy.onrender.com,http://localhost:5173,http://localhost:4173')
  .split(',').map((x) => x.trim()).filter(Boolean);
function corsFor(req) {
  const h = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
  const o = req && req.headers && req.headers.origin;
  if (o && ORIGINS.includes(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}
function send(req, res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsFor(req) });
  res.end(JSON.stringify(obj));
}

// 30 AI calls per minute per client IP (the proxy spends a provider key per call).
const allow = createRateLimiter({ max: 30, windowMs: 60_000 });

// Normalize a chat request into a list of {role, content} messages. Accepts either a ready
// `messages` array or a single `prompt`/`system` pair.
function toMessages({ messages, prompt, system }) {
  if (Array.isArray(messages) && messages.length) {
    return messages.filter((m) => m && typeof m.content === 'string').map((m) => ({ role: m.role || 'user', content: m.content }));
  }
  const out = [];
  if (system) out.push({ role: 'system', content: String(system) });
  if (prompt) out.push({ role: 'user', content: String(prompt) });
  return out;
}

// Resolve the AI target ({kind, baseUrl, key, model}) for a request, server-side.
//  - idToken present -> verify -> load Firestore aiConfig -> resolveAI (key from server).
//  - else key+provider in body -> guest transient config.
// Returns { ai } on success or { error, status } on failure.
export async function resolveTarget(payload, deps) {
  const { resolveAI, getAiConfig, verifyIdToken } = deps;
  const { idToken, provider, model, key, useDefault } = payload || {};

  if (idToken) {
    if (typeof verifyIdToken !== 'function') return { error: 'auth not available', status: 503 };
    let uid;
    try { uid = await verifyIdToken(idToken); } catch { return { error: 'invalid or expired token', status: 401 }; }
    if (!uid) return { error: 'invalid or expired token', status: 401 };
    const cfg = !useDefault && typeof getAiConfig === 'function' ? await getAiConfig(uid) : null;
    const ai = cfg && resolveAI(cfg);
    if (!ai) {
      // No personal key (or the client asked for the default): the owner's server-side default, if configured.
      const def = deps.defaultAI === undefined ? serverDefaultAI() : deps.defaultAI;
      if (!def) return { error: 'no AI key configured for this account', status: 400 };
      if (!(deps.defaultQuota || defaultQuota)(uid)) return { error: 'سهمِ روزانهٔ هوش مصنوعیِ پیش‌فرض تمام شد — فردا دوباره، یا کلیدِ شخصی در تنظیمات.', status: 429 };
      // The model is fixed by the owner; a per-request override is ignored on the default.
      return { ai: { kind: def.kind, baseUrl: def.baseUrl, key: def.key, model: def.model }, viaDefault: true };
    }
    // Honor a per-request model override only if the user actually has it; otherwise stored model.
    if (model) ai.model = model;
    return { ai };
  }

  // Guest path: build a transient target from the descriptor + in-session key in the body.
  if (key && provider && (provider.baseUrl || provider.id) && model) {
    const cfg = {
      activeProvider: provider.id || 'custom',
      activeModel: model,
      keys: { [provider.id || 'custom']: key },
      customProviders: provider.baseUrl ? [{ id: provider.id || 'custom', kind: provider.kind || 'openai', baseUrl: provider.baseUrl }] : [],
    };
    const ai = resolveAI(cfg);
    if (ai) return { ai };
    // Fallback: construct directly if resolveAI can't map an unknown custom id.
    if (provider.baseUrl) {
      return { ai: { kind: provider.kind || 'openai', baseUrl: String(provider.baseUrl).replace(/\/$/, ''), key, model } };
    }
  }

  return { error: 'AI not configured (sign in, or send a session key + provider)', status: 400 };
}

// GET /api/ai/default — is the server-side default AI on? Never returns the key.
export function aiDefaultStatus(env = process.env) {
  const def = serverDefaultAI(env);
  return def ? { available: true, provider: def.provider, model: def.model, dailyLimit: defaultDailyLimit(env), signInRequired: true } : { available: false };
}
export function handleAiDefaultStatus(req, res, deps = {}) {
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...corsFor(req), 'Access-Control-Allow-Methods': 'GET, OPTIONS' }); return res.end(); }
  if (req.method !== 'GET') return send(req, res, 405, { error: 'method not allowed' });
  return send(req, res, 200, aiDefaultStatus(deps.env || process.env));
}

// http(req,res) handler for POST /api/ai/proxy (+ CORS preflight).
export async function handleAiProxy(req, res, deps) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsFor(req)); return res.end(); }
  if (req.method !== 'POST') return send(req, res, 405, { error: 'method not allowed' });
  const ip = clientIp(req);
  if (!(deps.allow || allow)(ip)) return send(req, res, 429, { error: 'too many requests — try again in a minute' });

  let payload;
  try { payload = await readJsonBody(req); } catch (e) { return send(req, res, 400, { error: e.message }); }

  const messages = toMessages(payload);
  if (!messages.length) return send(req, res, 400, { error: 'prompt or messages required' });

  const { ai, error, status, viaDefault } = await resolveTarget(payload, deps);
  if (error) return send(req, res, status || 400, { error });
  // SSRF guard: the base URL may come from the request (guest) or a user's stored custom provider.
  try { await (deps.assertUrl || assertPublicHttpsUrl)(ai.baseUrl); } catch (e) {
    if (e instanceof UnsafeUrlError) return send(req, res, 400, { error: e.message });
    throw e;
  }

  try {
    const opts = (payload && payload.options) || {};
    const response = await deps.chat(ai, messages, {
      maxTokens: Number(opts.maxTokens) || 800,
      temperature: opts.temperature != null ? Number(opts.temperature) : 0.4,
    });
    return send(req, res, 200, { response, model: ai.model, provider: ai.kind, ...(viaDefault ? { viaDefault: true } : {}) });
  } catch (e) {
    return send(req, res, 502, { error: 'upstream AI request failed', detail: String(e && e.message || e) });
  }
}
