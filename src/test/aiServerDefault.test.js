import { describe, it, expect, beforeEach } from 'vitest';
import { refreshServerDefaultAI, isAnyAIReady, chatWithAnyAI, setAiIdTokenGetter, aiUnavailableHint, getServerDefaultAI } from '../lib/aiClient.js';

const okJson = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });

describe('server-side default AI (sheet 5-7)', () => {
  beforeEach(async () => {
    setAiIdTokenGetter(null);
    await refreshServerDefaultAI({ fetchImpl: async () => okJson({ available: false }) });
  });

  it('is off when the server says so (and when unreachable)', async () => {
    expect(isAnyAIReady({})).toBe(false);
    await refreshServerDefaultAI({ fetchImpl: async () => { throw new Error('net'); } });
    expect(getServerDefaultAI().available).toBe(false);
    expect(aiUnavailableHint({})).toMatch(/تنظیمات/);
  });

  it('needs sign-in: available + signed out ⇒ not ready, with a sign-in hint', async () => {
    await refreshServerDefaultAI({ fetchImpl: async () => okJson({ available: true, provider: 'google', model: 'gemini-x', dailyLimit: 50 }) });
    expect(isAnyAIReady({})).toBe(false);
    expect(aiUnavailableHint({})).toMatch(/وارد حساب/);
    setAiIdTokenGetter(async () => 'tok');
    expect(isAnyAIReady({})).toBe(true);
    expect(aiUnavailableHint({})).toBe('');
  });

  it('sends only the ID token + useDefault (no key, no provider) and returns the reply', async () => {
    await refreshServerDefaultAI({ fetchImpl: async () => okJson({ available: true, provider: 'google', model: 'gemini-x' }) });
    setAiIdTokenGetter(async () => 'tok');
    let sent;
    const out = await chatWithAnyAI({}, [{ role: 'user', content: 'سلام' }], { maxTokens: 100 }, {
      fetchImpl: async (url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return okJson({ response: ' جواب ', viaDefault: true }); },
    });
    expect(out).toBe('جواب');
    expect(sent.url).toMatch(/\/api\/ai\/proxy$/);
    expect(sent.body).toMatchObject({ idToken: 'tok', useDefault: true, options: { maxTokens: 100 } });
    expect(sent.body.key).toBeUndefined();
    expect(sent.body.provider).toBeUndefined();
  });

  it('surfaces the server error (e.g. daily quota) as the message', async () => {
    await refreshServerDefaultAI({ fetchImpl: async () => okJson({ available: true, model: 'm' }) });
    setAiIdTokenGetter(async () => 'tok');
    await expect(chatWithAnyAI({}, [{ role: 'user', content: 'x' }], {}, { fetchImpl: async () => okJson({ error: 'سهمِ روزانه تمام شد' }, 429) }))
      .rejects.toThrow('سهمِ روزانه');
  });

  it('a personal key wins over the default (no proxy call)', async () => {
    await refreshServerDefaultAI({ fetchImpl: async () => okJson({ available: true, model: 'm' }) });
    setAiIdTokenGetter(async () => 'tok');
    const cfg = { activeProvider: 'openai', activeModel: 'gpt', keys: { openai: 'k' } };
    const orig = globalThis.fetch;
    let url;
    globalThis.fetch = async (u) => { url = u; return okJson({ choices: [{ message: { content: 'own' } }] }); };
    try { expect(await chatWithAnyAI(cfg, [{ role: 'user', content: 'x' }])).toBe('own'); } finally { globalThis.fetch = orig; }
    expect(url).toMatch(/api\.openai\.com/);
  });
});
