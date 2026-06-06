// Security tests for the AI client: backend-proxy routing (key off the client) and the
// Anthropic direct-browser-access header anti-pattern fix.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { anthropicHeaders, chatViaProxy, getAiProxyUrl, askAI } from '../lib/aiClient.js';
import { getProviderById, DEFAULT_AI } from '../lib/aiProviders.js';

const okJson = (data) => ({ ok: true, status: 200, json: async () => data });

describe('anthropicHeaders — dangerous direct-browser opt-in is scoped (task 4 anti-pattern)', () => {
  it('includes the dangerous header ONLY for the explicit direct-browser path', () => {
    const direct = anthropicHeaders('sk-ant', { directBrowser: true });
    expect(direct['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(direct['x-api-key']).toBe('sk-ant');
    expect(direct['anthropic-version']).toBe('2023-06-01');
  });

  it('omits the dangerous header for server/proxy calls (directBrowser:false)', () => {
    const server = anthropicHeaders('sk-ant', { directBrowser: false });
    expect(server['anthropic-dangerous-direct-browser-access']).toBeUndefined();
    expect(server['x-api-key']).toBe('sk-ant');
  });

  it('defaults to the browser behavior when no option is passed', () => {
    expect(anthropicHeaders('k')['anthropic-dangerous-direct-browser-access']).toBe('true');
  });
});

describe('getAiProxyUrl', () => {
  afterEach(() => { delete globalThis.__AI_PROXY_URL__; });
  it('returns empty string when nothing configured', () => {
    expect(getAiProxyUrl()).toBe('');
  });
  it('reads a runtime global override and trims a trailing slash', () => {
    globalThis.__AI_PROXY_URL__ = 'https://proxy.example.com/';
    expect(getAiProxyUrl()).toBe('https://proxy.example.com');
  });
});

describe('chatViaProxy — key never sent when an ID token is present', () => {
  beforeEach(() => vi.restoreAllMocks());
  const active = { provider: getProviderById(DEFAULT_AI, 'openai'), key: 'sk-secret', model: 'gpt-4o' };

  it('signed-in: sends idToken, NOT the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ response: 'پاریس' }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await chatViaProxy('https://proxy.example.com', active, [{ role: 'user', content: 'q' }], { idToken: 'tok' });
    expect(out).toBe('پاریس');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proxy.example.com/api/ai/proxy');
    const body = JSON.parse(opts.body);
    expect(body.idToken).toBe('tok');
    expect(body.key).toBeUndefined();
    expect(body.provider.id).toBe('openai');
    // The raw secret must not appear anywhere in the request payload.
    expect(opts.body).not.toContain('sk-secret');
  });

  it('guest: sends the transient session key (no idToken)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ response: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await chatViaProxy('https://proxy.example.com', active, [{ role: 'user', content: 'q' }], {});
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.key).toBe('sk-secret');
    expect(body.idToken).toBeUndefined();
  });
});

describe('askAI routes through the proxy when one is configured', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => { delete globalThis.__AI_PROXY_URL__; });
  const cfg = { ...DEFAULT_AI, activeProvider: 'openai', activeModel: 'gpt-4o', keys: { openai: 'sk-1' } };

  it('hits /api/ai/proxy (not the provider) and returns the response field', async () => {
    globalThis.__AI_PROXY_URL__ = 'https://proxy.example.com';
    const fetchMock = vi.fn().mockResolvedValue(okJson({ response: 'سلام' }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await askAI(cfg, { user: 'سلام', idToken: 'tok' });
    expect(out).toBe('سلام');
    expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.example.com/api/ai/proxy');
  });

  it('falls back to a direct provider call when no proxy is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ choices: [{ message: { content: 'direct' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await askAI(cfg, { user: 'hi' });
    expect(out).toBe('direct');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
  });
});
