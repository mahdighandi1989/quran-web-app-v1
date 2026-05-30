// AI provider registry + validation. Pure/data + thin fetch wrappers (no React).
//
// Design goals (per user spec):
//  - several built-in providers, each with its latest models pre-listed;
//  - add a custom provider (OpenAI-compatible) with automatic validation;
//  - add/map new models per provider with validation;
//  - keys are stored per-user in Firestore when signed in, or kept only in memory
//    (session) when signed out — so a guest can paste a key and use it without saving.
//
// SECURITY NOTE: calling provider APIs directly from the browser exposes the key to that
// request (and to anyone with devtools). This is acceptable for a personal "bring-your-own-key"
// tool, which is exactly this feature. For a shared production key, proxy through a backend.

// Each built-in provider: how to call it (OpenAI-compatible chat unless noted), its base URL,
// docs link, and a starter list of current models. Users can add more models or providers.
export const BUILTIN_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',                       // request/response shape
    baseUrl: 'https://api.openai.com/v1',
    keyHint: 'sk-...',
    docs: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini', 'o1'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyHint: 'sk-ant-...',
    docs: 'https://console.anthropic.com/settings/keys',
    models: ['claude-opus-4-1', 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyHint: 'AIza...',
    docs: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'sk-or-...',
    docs: 'https://openrouter.ai/keys',
    models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro', 'meta-llama/llama-3.3-70b-instruct'],
  },
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyHint: 'gsk_...',
    docs: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    keyHint: 'sk-...',
    docs: 'https://platform.deepseek.com/api_keys',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
];

export const PROVIDER_KINDS = ['openai', 'anthropic', 'gemini'];

export function getProviderById(config, id) {
  const custom = (config && config.customProviders) || [];
  return BUILTIN_PROVIDERS.concat(custom).find((p) => p.id === id) || null;
}

export function allProviders(config) {
  return BUILTIN_PROVIDERS.concat((config && config.customProviders) || []);
}

// ---- Validation: a cheap "list models" / "ping" call that proves the key works. ----
// Returns { ok:true, models?:string[] } or throws Error with a readable message.
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

// Validate a key for a provider. For OpenAI-compatible, GET /models (also returns live models).
// For Anthropic & Gemini, do a minimal request that fails fast on a bad key.
export async function validateProviderKey(provider, key) {
  if (!key) throw new Error('کلید وارد نشده است.');
  const base = (provider.baseUrl || '').replace(/\/$/, '');
  if (provider.kind === 'anthropic') {
    // Anthropic has no public GET /models; a tiny messages call validates the key.
    const data = await http(`${base}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: (provider.models && provider.models[0]) || 'claude-3-5-haiku-latest', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
    });
    return { ok: true, models: provider.models || [] };
  }
  if (provider.kind === 'gemini') {
    const data = await http(`${base}/models?key=${encodeURIComponent(key)}`, { method: 'GET' });
    const models = (data && data.models ? data.models : []).map((m) => String(m.name || '').replace(/^models\//, '')).filter(Boolean);
    return { ok: true, models: models.length ? models : (provider.models || []) };
  }
  // openai-compatible
  const data = await http(`${base}/models`, { method: 'GET', headers: { Authorization: `Bearer ${key}` } });
  const models = (data && data.data ? data.data : []).map((m) => m.id).filter(Boolean);
  return { ok: true, models: models.length ? models : (provider.models || []) };
}

// Validate that a specific model exists/answers for a provider+key (cheap 1-token completion).
export async function validateModel(provider, key, model) {
  if (!key) throw new Error('ابتدا کلید را وارد و اعتبارسنجی کنید.');
  if (!model) throw new Error('نام مدل وارد نشده است.');
  const base = (provider.baseUrl || '').replace(/\/$/, '');
  if (provider.kind === 'anthropic') {
    await http(`${base}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
    });
    return { ok: true };
  }
  if (provider.kind === 'gemini') {
    await http(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 1 } }),
    });
    return { ok: true };
  }
  await http(`${base}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
  });
  return { ok: true };
}

// Default empty AI config shape.
export const DEFAULT_AI = {
  activeProvider: '',     // provider id selected for use
  activeModel: '',        // model selected for use
  keys: {},               // { [providerId]: "apiKey" }
  customProviders: [],    // [{ id, name, kind, baseUrl, models[], keyHint, docs, custom:true }]
  extraModels: {},        // { [providerId]: ["model-a", ...] } user-added models
};
