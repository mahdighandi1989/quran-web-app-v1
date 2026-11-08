// 2026-11-08: the sign-in window on firebaseapp.com hit NXDOMAIN on the owner's network. The app must (1) never pick an
// auth host whose redirect URI Google does not know (that is «redirect_uri_mismatch» for everyone), and (2) never open
// a window it already knows cannot load.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FIREBASE_AUTH_DOMAIN, SAME_SITE_AUTH_HOSTS, pickAuthDomain, probeAuthDomain,
  authDomainKnownUnreachable, _resetProbeForTests,
} from '../lib/authDomain.js';

describe('pickAuthDomain', () => {
  it('env wins; never empty', () => {
    expect(pickAuthDomain({ envDomain: 'x.example', host: 'quran-web-app-8rwy.onrender.com' })).toBe('x.example');
    expect(pickAuthDomain({})).toBe(FIREBASE_AUTH_DOMAIN);
    expect(pickAuthDomain({ host: 'localhost:5173' })).toBe(FIREBASE_AUTH_DOMAIN);
  });
  it('the site host only once its redirect URI is registered', () => {
    const h = 'quran-web-app-8rwy.onrender.com';
    const was = SAME_SITE_AUTH_HOSTS[h];
    try {
      SAME_SITE_AUTH_HOSTS[h] = false;
      expect(pickAuthDomain({ host: h })).toBe(FIREBASE_AUTH_DOMAIN);
      SAME_SITE_AUTH_HOSTS[h] = true;
      expect(pickAuthDomain({ host: h.toUpperCase() })).toBe(h);
    } finally { SAME_SITE_AUTH_HOSTS[h] = was; }
  });
  it('ON for the site since the owner registered the redirect URI (probe OK 2026-11-08 20:22 UTC)', () => {
    expect(SAME_SITE_AUTH_HOSTS['quran-web-app-8rwy.onrender.com']).toBe(true);
    expect(pickAuthDomain({ host: 'quran-web-app-8rwy.onrender.com' })).toBe('quran-web-app-8rwy.onrender.com');
  });
});

describe('probeAuthDomain', () => {
  beforeEach(() => _resetProbeForTests());

  it('DNS failure ⇒ known unreachable; a click can read it synchronously', async () => {
    const nx = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(authDomainKnownUnreachable(FIREBASE_AUTH_DOMAIN)).toBe(false);   // unknown ⇒ do not block
    expect(await probeAuthDomain(FIREBASE_AUTH_DOMAIN, { host: 'a.b', fetchImpl: nx })).toBe(false);
    expect(authDomainKnownUnreachable(FIREBASE_AUTH_DOMAIN)).toBe(true);
  });
  it('an opaque answer counts as reachable; one request while pending; cached', async () => {
    let n = 0;
    const ok = (url, opts) => { n += 1; expect(url).toBe(`https://${FIREBASE_AUTH_DOMAIN}/__/auth/handler.js`); expect(opts.mode).toBe('no-cors'); return Promise.resolve({ type: 'opaque' }); };
    const [a, b] = await Promise.all([probeAuthDomain(FIREBASE_AUTH_DOMAIN, { host: 'a.b', fetchImpl: ok }), probeAuthDomain(FIREBASE_AUTH_DOMAIN, { host: 'a.b', fetchImpl: ok })]);
    expect(a && b).toBe(true);
    expect(await probeAuthDomain(FIREBASE_AUTH_DOMAIN, { host: 'a.b', fetchImpl: ok })).toBe(true);
    expect(n).toBe(1);
    expect(authDomainKnownUnreachable(FIREBASE_AUTH_DOMAIN)).toBe(false);
  });
  it('same host as the page needs no request', async () => {
    const boom = () => { throw new Error('should not fetch'); };
    expect(await probeAuthDomain('site.example', { host: 'site.example', fetchImpl: boom })).toBe(true);
  });
  it('a hang is cut by the timeout and counts as unreachable', async () => {
    const hang = (_u, { signal }) => new Promise((_r, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
    expect(await probeAuthDomain(FIREBASE_AUTH_DOMAIN, { host: 'a.b', fetchImpl: hang, timeoutMs: 20 })).toBe(false);
  });
});

describe('pickGisClientId (silent Drive refresh) — 2026-11-08', () => {
  it('env wins; public id only for a host whose JS origin is registered; ships OFF', async () => {
    const { pickGisClientId, GIS_ORIGIN_REGISTERED, PUBLIC_OAUTH_WEB_CLIENT_ID } = await import('../lib/authDomain.js');
    const h = 'quran-web-app-8rwy.onrender.com';
    expect(GIS_ORIGIN_REGISTERED[h]).toBe(false);                 // OFF by design: GIS token flow opens a window
    expect(pickGisClientId({ envId: 'x', host: h })).toBe('x');
    expect(pickGisClientId({ host: h })).toBe('');
    expect(pickGisClientId({ host: 'localhost:5173' })).toBe('');
    try { GIS_ORIGIN_REGISTERED[h] = true; expect(pickGisClientId({ host: h })).toBe(PUBLIC_OAUTH_WEB_CLIENT_ID); }
    finally { GIS_ORIGIN_REGISTERED[h] = false; }
    expect(PUBLIC_OAUTH_WEB_CLIENT_ID).toMatch(/^31712827799-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  });
  it('no technical footnote under «درایو وصل نیست» (removed 2026-11-08 once the origin was registered)', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../App.jsx'), 'utf8');
    expect(src).not.toMatch(/VITE_GOOGLE_OAUTH_CLIENT_ID در تنظیمات Render/);
    expect(src).not.toMatch(/ADMIN_GIS_NOTE|Authorized JavaScript origin/);
  });
});
