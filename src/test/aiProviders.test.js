import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BUILTIN_PROVIDERS, allProviders, getProviderById, validateProviderKey, validateModel,
  isValidProviderBaseUrl, DEFAULT_AI,
} from '../lib/aiProviders.js';

const okJson = (data) => ({ ok: true, status: 200, json: async () => data });
const errJson = (status, data) => ({ ok: false, status, json: async () => data });

describe('isValidProviderBaseUrl — custom provider Base URL validation (task 3)', () => {
  it('accepts absolute http(s) URLs', () => {
    expect(isValidProviderBaseUrl('https://api.example.com/v1')).toBe(true);
    expect(isValidProviderBaseUrl('http://localhost:1234/v1')).toBe(true);
    expect(isValidProviderBaseUrl('  https://api.openai.com/v1  ')).toBe(true);
  });
  it('rejects javascript:, data:, file:, vbscript:, blob: and other schemes', () => {
    expect(isValidProviderBaseUrl('javascript:alert(1)')).toBe(false);
    expect(isValidProviderBaseUrl('JavaScript:alert(1)')).toBe(false);
    expect(isValidProviderBaseUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isValidProviderBaseUrl('file:///etc/passwd')).toBe(false);
    expect(isValidProviderBaseUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isValidProviderBaseUrl('blob:https://x/y')).toBe(false);
    expect(isValidProviderBaseUrl('ftp://example.com')).toBe(false);
  });
  it('rejects relative paths, empty, and non-string input', () => {
    expect(isValidProviderBaseUrl('/v1')).toBe(false);
    expect(isValidProviderBaseUrl('api.example.com')).toBe(false);
    expect(isValidProviderBaseUrl('')).toBe(false);
    expect(isValidProviderBaseUrl('   ')).toBe(false);
    expect(isValidProviderBaseUrl(null)).toBe(false);
    expect(isValidProviderBaseUrl(undefined)).toBe(false);
    expect(isValidProviderBaseUrl({})).toBe(false);
  });
});

describe('AI provider registry', () => {
  it('ships several built-in providers, each with models', () => {
    expect(BUILTIN_PROVIDERS.length).toBeGreaterThanOrEqual(5);
    for (const p of BUILTIN_PROVIDERS) {
      expect(p.id && p.name && p.baseUrl && p.kind).toBeTruthy();
      expect(Array.isArray(p.models) && p.models.length).toBeTruthy();
    }
    expect(BUILTIN_PROVIDERS.map((p) => p.id)).toEqual(
      expect.arrayContaining(['openai', 'anthropic', 'google', 'openrouter', 'groq', 'deepseek']),
    );
  });

  it('allProviders merges custom providers; getProviderById finds them', () => {
    const cfg = { ...DEFAULT_AI, customProviders: [{ id: 'x1', name: 'Mine', baseUrl: 'https://h/v1', kind: 'openai', models: ['m'] }] };
    expect(allProviders(cfg).length).toBe(BUILTIN_PROVIDERS.length + 1);
    expect(getProviderById(cfg, 'x1').name).toBe('Mine');
    expect(getProviderById(cfg, 'openai').id).toBe('openai');
    expect(getProviderById(cfg, 'nope')).toBeNull();
  });
});

describe('validateProviderKey', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('throws when no key given', async () => {
    await expect(validateProviderKey(BUILTIN_PROVIDERS[0], '')).rejects.toThrow();
  });

  it('openai-compatible: GETs /models and returns live model ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ data: [{ id: 'gpt-4o' }, { id: 'o1' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const p = getProviderById(DEFAULT_AI, 'openai');
    const r = await validateProviderKey(p, 'sk-123');
    expect(r.models).toEqual(['gpt-4o', 'o1']);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(opts.headers.Authorization).toBe('Bearer sk-123');
  });

  it('gemini: GETs /models?key= and strips the models/ prefix', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ models: [{ name: 'models/gemini-2.5-pro' }] })));
    const r = await validateProviderKey(getProviderById(DEFAULT_AI, 'google'), 'AIza-x');
    expect(r.models).toEqual(['gemini-2.5-pro']);
  });

  it('anthropic: POSTs a tiny message with x-api-key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ id: 'msg' }));
    vi.stubGlobal('fetch', fetchMock);
    await validateProviderKey(getProviderById(DEFAULT_AI, 'anthropic'), 'sk-ant-1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/messages');
    expect(opts.headers['x-api-key']).toBe('sk-ant-1');
  });

  it('surfaces a readable error on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errJson(401, { error: { message: 'Invalid key' } })));
    await expect(validateProviderKey(getProviderById(DEFAULT_AI, 'openai'), 'bad')).rejects.toThrow(/Invalid key/);
  });
});

describe('validateModel', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('openai: POSTs chat/completions with the model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ choices: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await validateModel(getProviderById(DEFAULT_AI, 'openai'), 'sk-1', 'gpt-4o');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o');
  });
  it('requires key and model', async () => {
    await expect(validateModel(getProviderById(DEFAULT_AI, 'openai'), '', 'm')).rejects.toThrow();
    await expect(validateModel(getProviderById(DEFAULT_AI, 'openai'), 'k', '')).rejects.toThrow();
  });
});
