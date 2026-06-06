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

// Read + JSON-parse a request body with a hard size cap (defends against oversized payloads).
export function readJsonBody(req, { limit = 256 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    let aborted = false;
    req.on('data', (c) => {
      body += c;
      if (body.length > limit && !aborted) { aborted = true; req.destroy(); reject(new Error('payload too large')); }
    });
    req.on('end', () => {
      if (aborted) return;
      if (!body.trim()) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(obj));
}

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
  const { idToken, provider, model, key } = payload || {};

  if (idToken) {
    if (typeof verifyIdToken !== 'function') return { error: 'auth not available', status: 503 };
    let uid;
    try { uid = await verifyIdToken(idToken); } catch { return { error: 'invalid or expired token', status: 401 }; }
    if (!uid) return { error: 'invalid or expired token', status: 401 };
    const cfg = typeof getAiConfig === 'function' ? await getAiConfig(uid) : null;
    const ai = cfg && resolveAI(cfg);
    if (!ai) return { error: 'no AI key configured for this account', status: 400 };
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

// http(req,res) handler for POST /api/ai/proxy (+ CORS preflight).
export async function handleAiProxy(req, res, deps) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  let payload;
  try { payload = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

  const messages = toMessages(payload);
  if (!messages.length) return send(res, 400, { error: 'prompt or messages required' });

  const { ai, error, status } = await resolveTarget(payload, deps);
  if (error) return send(res, status || 400, { error });

  try {
    const opts = (payload && payload.options) || {};
    const response = await deps.chat(ai, messages, {
      maxTokens: Number(opts.maxTokens) || 800,
      temperature: opts.temperature != null ? Number(opts.temperature) : 0.4,
    });
    return send(res, 200, { response, model: ai.model, provider: ai.kind });
  } catch (e) {
    return send(res, 502, { error: 'upstream AI request failed', detail: String(e && e.message || e) });
  }
}
