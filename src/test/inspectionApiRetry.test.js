// Sheet 2-۴: «سرور نظارت در دسترس نیست (Failed to fetch)» right after opening the tool — the bot service was
// asleep. Reads are retried quietly (which also wakes it); writes are never repeated.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/firebase.js', () => ({ auth: { currentUser: { getIdToken: () => Promise.resolve('tok') } } }));
import { api, ApiError, RETRY_DELAYS_MS } from '../lib/inspectionApi.js';

const ok = (data) => ({ ok: true, status: 200, json: () => Promise.resolve(data) });
const down = () => Promise.reject(new TypeError('Failed to fetch'));

describe('inspection API: a sleeping server', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('a GET that fails while the server boots is retried and then succeeds', async () => {
    fetch.mockImplementationOnce(down).mockImplementationOnce(down).mockImplementationOnce(() => Promise.resolve(ok({ reports: [] })));
    await expect(api('/api/inspection', { retryDelays: [1, 1, 1] })).resolves.toEqual({ reports: [] });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer tok');
  });

  it('gives up after the last retry with the clear Persian message (never silent)', async () => {
    fetch.mockImplementation(down);
    const err = await api('/api/me', { retryDelays: [1, 1] }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/سرورِ نظارت در دسترس نیست \(Failed to fetch\)/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('a write is NOT repeated — a retried POST could create the same sheet twice', async () => {
    fetch.mockImplementation(down);
    await expect(api('/api/inspection', { method: 'POST', body: { text: 'x' }, retryDelays: [1, 1] })).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('an HTTP error is an answer, not an outage: no retry', async () => {
    fetch.mockImplementation(() => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ error: 'ممنوع' }) }));
    const err = await api('/api/me', { retryDelays: [1, 1] }).catch((e) => e);
    expect(err.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('an aborted request is not retried', async () => {
    const c = new AbortController(); c.abort();
    fetch.mockImplementation(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    await expect(api('/api/me', { signal: c.signal, retryDelays: [1, 1] })).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('the default schedule waits long enough for a cold start to begin answering', () => {
    expect(RETRY_DELAYS_MS.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(10000);
  });
});
