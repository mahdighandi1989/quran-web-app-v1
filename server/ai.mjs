// Minimal AI client for the bot server. Standalone (no frontend imports) but mirrors the
// shapes of src/lib/aiProviders.js so the same per-user aiConfigs/{uid} doc works here.
// kinds: 'openai' (openai-compatible), 'anthropic', 'gemini'.

const BUILTIN = {
  openai:     { kind: 'openai',    baseUrl: 'https://api.openai.com/v1' },
  anthropic:  { kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  google:     { kind: 'gemini',    baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  openrouter: { kind: 'openai',    baseUrl: 'https://openrouter.ai/api/v1' },
  groq:       { kind: 'openai',    baseUrl: 'https://api.groq.com/openai/v1' },
  deepseek:   { kind: 'openai',    baseUrl: 'https://api.deepseek.com/v1' },
};

// Resolve {kind, baseUrl, key, model} from an aiConfigs doc (built-in or custom provider).
export function resolveAI(aiConfig) {
  if (!aiConfig || !aiConfig.activeProvider || !aiConfig.activeModel) return null;
  const id = aiConfig.activeProvider;
  let prov = BUILTIN[id];
  if (!prov) {
    const custom = (aiConfig.customProviders || []).find((p) => p.id === id);
    if (custom) prov = { kind: custom.kind || 'openai', baseUrl: (custom.baseUrl || '').replace(/\/$/, '') };
  }
  if (!prov) return null;
  const key = (aiConfig.keys || {})[id];
  if (!key) return null;
  return { kind: prov.kind, baseUrl: prov.baseUrl.replace(/\/$/, ''), key, model: aiConfig.activeModel };
}

async function http(url, opts) {
  const res = await fetch(url, opts);
  let body = null; try { body = await res.json(); } catch { /* */ }
  if (!res.ok) {
    const msg = (body && (body.error?.message || body.error || body.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body;
}

// One-shot completion. messages: [{role, content}]. Returns the reply text.
export async function chat(ai, messages, { maxTokens = 800, temperature = 0.4 } = {}) {
  const { kind, baseUrl, key, model } = ai;
  if (kind === 'anthropic') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    const data = await http(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, ...(system ? { system } : {}), messages: rest }),
    });
    return (data.content || []).map((b) => b.text || '').join('').trim();
  }
  if (kind === 'gemini') {
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const data = await http(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}), contents, generationConfig: { temperature, maxOutputTokens: maxTokens } }),
    });
    const cand = data.candidates && data.candidates[0];
    return ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('').trim();
  }
  const data = await http(`${baseUrl}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages }),
  });
  const choice = data.choices && data.choices[0];
  return ((choice && choice.message && choice.message.content) || '').trim();
}

const SYSTEM_FA = 'تو یک دستیار متخصص قرآن کریم هستی. پاسخ‌ها کوتاه، دقیق، محترمانه و به فارسیِ روان باشند. اگر چیزی را با قطعیت نمی‌دانی صادقانه بگو.';
export const prompts = {
  tafsir: (a) => [{ role: 'system', content: SYSTEM_FA }, { role: 'user', content: `این آیه را کوتاه توضیح بده (ترجمهٔ روان + پیام اصلی + یک نکتهٔ تدبر):\nسوره ${a.n || a.s} آیه ${a.a}\n«${a.t}»` }],
  hifz: (a) => [{ role: 'system', content: SYSTEM_FA }, { role: 'user', content: `برای حفظِ این آیه کمک بده: تقطیع معنایی به بخش‌های کوچک + یک تداعی کمک‌حافظه. کوتاه بنویس.\nسوره ${a.n || a.s} آیه ${a.a}\n«${a.t}»` }],
  qa: (q) => [{ role: 'system', content: SYSTEM_FA + ' اگر سوال خارج از حوزهٔ قرآن بود مودبانه یادآوری کن.' }, { role: 'user', content: String(q || '') }],
};
