import { describe, it, expect, beforeEach } from 'vitest';
import { requestDriveTokenSilently } from '../lib/gisToken.js';

describe('requestDriveTokenSilently', () => {
  beforeEach(() => { delete window.google; });
  it('resolves null without a client id (falls back to the reconnect button)', async () => {
    expect(await requestDriveTokenSilently('a@b.c', { clientId: '' })).toBeNull();
  });
  it('returns the token from prompt=none and passes the hint', async () => {
    let cfg;
    window.google = { accounts: { oauth2: { initTokenClient: (c) => { cfg = c; return { requestAccessToken: () => c.callback({ access_token: 'tok' }) }; } } } };
    expect(await requestDriveTokenSilently('a@b.c', { clientId: 'id' })).toBe('tok');
    expect(cfg.prompt).toBe('none'); expect(cfg.hint).toBe('a@b.c');
  });
  it('null when consent is needed (error_callback / error response)', async () => {
    window.google = { accounts: { oauth2: { initTokenClient: (c) => ({ requestAccessToken: () => c.callback({ error: 'interaction_required' }) }) } } };
    expect(await requestDriveTokenSilently('a@b.c', { clientId: 'id' })).toBeNull();
  });
  it('null on timeout', async () => {
    window.google = { accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken: () => {} }) } } };
    expect(await requestDriveTokenSilently('a@b.c', { clientId: 'id', timeoutMs: 20 })).toBeNull();
  });
});
