// Drive offline access (owner 2026-11-08: «همه چیز خودکار»): one click consents via Google's CODE flow; afterwards the
// server mints access tokens with no window. These pin the client half.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { serverDriveToken, connectDriveOffline, connectErrorMessage, gisCodeReady, DRIVE_SCOPE, DRIVE_API } from '../lib/driveOffline.js';

const jsonRes = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });

describe('serverDriveToken', () => {
  it('returns the server token, sends the Firebase ID token, POST /api/drive/token', async () => {
    const f = vi.fn(() => jsonRes(200, { access_token: 'AT', expires_in: 3599 }));
    expect(await serverDriveToken('ID', { fetchImpl: f })).toEqual({ token: 'AT', expiresIn: 3599 });
    const [url, opts] = f.mock.calls[0];
    expect(url).toBe(`${DRIVE_API}/api/drive/token`); expect(opts.method).toBe('POST'); expect(opts.headers.Authorization).toBe('Bearer ID');
  });
  it('not connected / revoked ⇒ reconnect flag; network error ⇒ null token, no throw', async () => {
    expect(await serverDriveToken('ID', { fetchImpl: () => jsonRes(410, { error: 'x', reconnect: true }) })).toMatchObject({ token: null, reconnect: true, status: 410 });
    expect(await serverDriveToken('ID', { fetchImpl: () => jsonRes(503, { error: 'not configured' }) })).toMatchObject({ token: null, reconnect: false, status: 503 });
    expect(await serverDriveToken('ID', { fetchImpl: () => Promise.reject(new TypeError('offline')) })).toMatchObject({ token: null });
  });
});

describe('connectDriveOffline (must run inside the click)', () => {
  let cfg;
  beforeEach(() => {
    cfg = null;
    window.google = { accounts: { oauth2: { initCodeClient: vi.fn((c) => { cfg = c; return { requestCode: vi.fn() }; }) } } };
  });
  afterEach(() => { delete window.google; });

  it('opens Google synchronously with the Drive scope, popup mode and the user as hint; posts the code to the server', async () => {
    expect(gisCodeReady()).toBe(true);
    const f = vi.fn(() => jsonRes(200, { access_token: 'AT', expires_in: 3599, email: 'o@x.com' }));
    const p = connectDriveOffline({ clientId: 'CID', email: 'o@x.com', getIdToken: async () => 'ID', fetchImpl: f });
    // synchronous: the client was created before any await (user activation preserved)
    expect(cfg).toMatchObject({ client_id: 'CID', scope: DRIVE_SCOPE, ux_mode: 'popup', login_hint: 'o@x.com' });
    cfg.callback({ code: '4/0Aabc' });
    await expect(p).resolves.toEqual({ token: 'AT', expiresIn: 3599, email: 'o@x.com' });
    const [url, opts] = f.mock.calls[0];
    expect(url).toBe(`${DRIVE_API}/api/drive/connect`); expect(JSON.parse(opts.body)).toEqual({ code: '4/0Aabc' });
  });
  it('closed window / server refusal reject with a code the message maps to Persian', async () => {
    const p1 = connectDriveOffline({ clientId: 'CID', getIdToken: async () => 'ID', fetchImpl: vi.fn() });
    cfg.error_callback({ type: 'popup_closed' });
    const e1 = await p1.catch((e) => e);
    expect(e1.code).toBe('popup_closed'); expect(connectErrorMessage(e1)).toMatch(/بسته شد/);
    const p2 = connectDriveOffline({ clientId: 'CID', getIdToken: async () => 'ID', fetchImpl: () => jsonRes(409, { error: 'حسابِ گوگلِ انتخاب‌شده با حسابِ واردشده یکی نیست' }) });
    cfg.callback({ code: '4/0Aabc' });
    const e2 = await p2.catch((e) => e);
    expect(e2.code).toBe('409'); expect(connectErrorMessage(e2)).toMatch(/یکی نیست/);
  });
  it('GIS not loaded ⇒ rejects at once (caller falls back to the previous path)', async () => {
    delete window.google;
    await expect(connectDriveOffline({ clientId: 'CID', getIdToken: async () => 'ID' })).rejects.toMatchObject({ code: 'gis-not-ready' });
  });
});
