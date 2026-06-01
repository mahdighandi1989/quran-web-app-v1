import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveActiveAI, isAIReady, chatComplete, askAI } from '../lib/aiClient.js';
import { getProviderById, DEFAULT_AI } from '../lib/aiProviders.js';

const okJson = (data) => ({ ok: true, status: 200, json: async () => data });

const cfg = (over = {}) => ({ ...DEFAULT_AI, activeProvider: 'openai', activeModel: 'gpt-4o', keys: { openai: 'sk-1' }, ...over });

describe('resolveActiveAI / isAIReady', () => {
  it('returns provider+key+model when fully configured', () => {
    const r = resolveActiveAI(cfg());
    expect(r.provider.id).toBe('openai');
    expect(r.key).toBe('sk-1');
    expect(r.model).toBe('gpt-4o');
    expect(isAIReady(cfg())).toBe(true);
  });
  it('returns null when key/model/provider missing', () => {
    expect(resolveActiveAI({ ...DEFAULT_AI })).toBeNull();
    expect(resolveActiveAI(cfg({ keys: {} }))).toBeNull();
    expect(resolveActiveAI(cfg({ activeModel: '' }))).toBeNull();
    expect(isAIReady({ ...DEFAULT_AI })).toBe(false);
  });
});

describe('chatComplete', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('openai-compatible: posts chat/completions and returns the message content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ choices: [{ message: { content: 'سلام' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const p = getProviderById(DEFAULT_AI, 'openai');
    const out = await chatComplete(p, 'sk-1', 'gpt-4o', [{ role: 'user', content: 'hi' }]);
    expect(out).toBe('سلام');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opts.headers.Authorization).toBe('Bearer sk-1');
    expect(JSON.parse(opts.body).model).toBe('gpt-4o');
  });

  it('anthropic: splits system, posts /messages, joins content blocks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ content: [{ text: 'A' }, { text: 'B' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const p = getProviderById(DEFAULT_AI, 'anthropic');
    const out = await chatComplete(p, 'sk-ant', 'claude-3-5-haiku-latest', [
      { role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' },
    ]);
    expect(out).toBe('AB');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe('be brief');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('gemini: maps roles, posts generateContent, reads candidate parts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ candidates: [{ content: { parts: [{ text: 'پاسخ' }] } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const p = getProviderById(DEFAULT_AI, 'google');
    const out = await chatComplete(p, 'AIza', 'gemini-2.5-flash', [{ role: 'user', content: 'hi' }]);
    expect(out).toBe('پاسخ');
    expect(fetchMock.mock.calls[0][0]).toContain('generateContent?key=AIza');
  });

  it('throws a readable error on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) }));
    const p = getProviderById(DEFAULT_AI, 'openai');
    await expect(chatComplete(p, 'k', 'gpt-4o', [{ role: 'user', content: 'x' }])).rejects.toThrow(/rate limited/);
  });
});

describe('askAI', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('throws a helpful error when AI is not configured', async () => {
    await expect(askAI({ ...DEFAULT_AI }, { user: 'hi' })).rejects.toThrow(/پیکربندی نشده/);
  });
  it('sends system+user and returns the reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ choices: [{ message: { content: 'ok' } }] })));
    const out = await askAI(cfg(), { system: 'sys', user: 'q' });
    expect(out).toBe('ok');
  });
});
