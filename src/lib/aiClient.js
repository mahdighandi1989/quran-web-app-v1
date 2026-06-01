// Unified AI chat client over the three provider shapes (openai-compatible / anthropic / gemini).
// Used by app features (tafsir, hints, Q&A, ...). Keys come from the per-user/guest AI config.
import { getProviderById } from './aiProviders.js';

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
  const { temperature = 0.4, maxTokens = 800, signal } = options;

  if (provider.kind === 'anthropic') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    const data = await http(`${base}/messages`, {
      method: 'POST', signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
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

// Convenience: run a single prompt with the app's active AI config.
export async function askAI(config, { system, user, ...options } = {}) {
  const active = resolveActiveAI(config);
  if (!active) throw new Error('هوش مصنوعی پیکربندی نشده است. در تنظیمات → هوش مصنوعی، پروایدر/کلید/مدل را تنظیم کنید.');
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user || '' });
  return chatComplete(active.provider, active.key, active.model, messages, options);
}
