// Unified AI chat client over the three provider shapes (openai-compatible / anthropic / gemini).
// Used by app features (tafsir, hints, Q&A, ...). Keys come from the per-user/guest AI config.
//
// NAMING: the file name `aiClient.js` is intentional and accurate — this module is the single
// client/transport layer for outbound AI chat requests. Pipeline position — upstream: the AI
// `config` edited in src/components/AISettings.jsx and the provider registry in
// src/lib/aiProviders.js; downstream: feature components (AIExamGenerator, AIWidgets) and the
// optional backend proxy in server/ai-proxy.mjs. No rename needed.
//
// KEY SECURITY MODEL:
//  - When a backend proxy is configured (VITE_AI_PROXY_URL / globalThis.__AI_PROXY_URL__),
//    app chat traffic is routed through it. Signed-in users send only an ID token; the proxy
//    reads their key from Firestore server-side, so the key is NEVER in the browser bundle,
//    request, or network tab.
//  - Guests (not signed in) have no server-stored key. Their key lives only in this browser
//    session (in memory). It is sent to the proxy per-request over TLS and used transiently —
//    it is never persisted and never baked into the client bundle.
//  - With no proxy configured the client falls back to calling the provider directly with the
//    in-memory key (legacy "bring-your-own-key" behavior; only that single request sees it).
import { getProviderById } from './aiProviders.js';

// Resolve the backend AI proxy URL, if one is configured. Build-time VITE_AI_PROXY_URL takes
// precedence; a host page may also set globalThis.__AI_PROXY_URL__ at runtime. Empty = no proxy.
export function getAiProxyUrl() {
  try {
    // import.meta.env is defined under Vite/Vitest; guard for plain-Node (server) contexts.
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    const fromEnv = env.VITE_AI_PROXY_URL;
    if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  } catch { /* import.meta unavailable */ }
  const fromGlobal = (typeof globalThis !== 'undefined' && globalThis.__AI_PROXY_URL__) || '';
  return fromGlobal ? String(fromGlobal).replace(/\/$/, '') : '';
}

// Build Anthropic request headers.
//
// ANTI-PATTERN NOTE (was a stale "always in the browser" assumption): the
// `anthropic-dangerous-direct-browser-access: 'true'` header tells Anthropic to allow a call
// straight from a browser — which only makes sense, and is only safe-ish, when we truly have
// no backend and the user is spending their OWN key. It is meaningless (and signals key
// exposure) on a server/proxy. So we add it ONLY for the explicit direct-from-browser path
// and omit it whenever the request originates server-side (e.g. server/ai-proxy.mjs passes
// directBrowser:false). This keeps the dangerous opt-in scoped to the one case that needs it.
export function anthropicHeaders(key, { directBrowser = true } = {}) {
  const headers = {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
  if (directBrowser) headers['anthropic-dangerous-direct-browser-access'] = 'true';
  return headers;
}

async function http(url, opts) {
  const res = await fetch(url, opts);
  let body = null;
  try { body = await res.json(); } catch { /* non-json */ }
  if (!res.ok) {
    const msg = (body && (body.error?.message || body.error || body.message)) || `HTTP ${res.status}`;
    const e = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    e.status = res.status; throw e;
  }
  return body;
}

// Resolve the currently selected provider+key+model from an AI config.
// Returns { provider, key, model } or null if not fully configured.
export function resolveActiveAI(config) {
  if (!config || !config.activeProvider || !config.activeModel) return null;
  const provider = getProviderById(config, config.activeProvider);
  if (!provider) return null;
  const key = (config.keys && config.keys[provider.id]) || '';
  if (!key) return null;
  return { provider, key, model: config.activeModel };
}

export function isAIReady(config) {
  return !!resolveActiveAI(config);
}

// messages: [{ role: 'system'|'user'|'assistant', content: string }]
// options: { temperature, maxTokens, signal }
// Returns the assistant's text reply (string).
export async function chatComplete(provider, key, model, messages, options = {}) {
  const base = (provider.baseUrl || '').replace(/\/$/, '');
  // directBrowser defaults to true: this function historically runs in the browser with the
  // user's own key. A server/proxy caller passes directBrowser:false (see anthropicHeaders).
  const { temperature = 0.4, maxTokens = 800, signal, directBrowser = true } = options;

  if (provider.kind === 'anthropic') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    const data = await http(`${base}/messages`, {
      method: 'POST', signal,
      headers: anthropicHeaders(key, { directBrowser }),
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, ...(system ? { system } : {}), messages: rest }),
    });
    return (data.content || []).map((b) => b.text || '').join('').trim();
  }

  if (provider.kind === 'gemini') {
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const data = await http(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
        contents, generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });
    const cand = data.candidates && data.candidates[0];
    return ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('').trim();
  }

  // openai-compatible (OpenAI, OpenRouter, Groq, DeepSeek, custom)
  const data = await http(`${base}/chat/completions`, {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages }),
  });
  const choice = data.choices && data.choices[0];
  return ((choice && choice.message && choice.message.content) || '').trim();
}

// Send a chat through the backend proxy. The key is NEVER put in this request when an ID token
// is available (the server reads the user's stored key); for guests the in-session key is sent
// transiently over TLS. Returns the assistant reply text.
// auth: { idToken } for signed-in users. config is the resolved active AI ({provider,key,model}).
export async function chatViaProxy(proxyUrl, active, messages, { idToken, signal, temperature, maxTokens } = {}) {
  const payload = {
    provider: { id: active.provider.id, kind: active.provider.kind, baseUrl: active.provider.baseUrl },
    model: active.model,
    messages,
    options: { ...(temperature != null ? { temperature } : {}), ...(maxTokens != null ? { maxTokens } : {}) },
  };
  if (idToken) payload.idToken = idToken;       // signed-in: server uses the stored key
  else if (active.key) payload.key = active.key; // guest: transient session key, never persisted
  const data = await http(`${proxyUrl.replace(/\/$/, '')}/api/ai/proxy`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return String((data && (data.response ?? data.reply ?? data.text)) || '').trim();
}

// Convenience: run a single prompt with the app's active AI config.
// When a proxy is configured the request is routed through it (key stays server-side for
// signed-in users); otherwise it falls back to a direct provider call.
export async function askAI(config, { system, user, idToken, ...options } = {}) {
  const active = resolveActiveAI(config);
  if (!active) throw new Error('هوش مصنوعی پیکربندی نشده است. در تنظیمات → هوش مصنوعی، پروایدر/کلید/مدل را تنظیم کنید.');
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user || '' });
  const proxyUrl = getAiProxyUrl();
  if (proxyUrl) return chatViaProxy(proxyUrl, active, messages, { idToken, ...options });
  return chatComplete(active.provider, active.key, active.model, messages, options);
}
