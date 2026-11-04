// Owner, urgent 2026-11-04: «several small login windows open on every visit». Never a popup on load, one window at
// most (a second request focuses it, a timeout closes it), and the Drive token reused until it expires.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { saveDriveToken, loadDriveToken, singlePopup, _resetPopupForTests, TOKEN_LS, drivePopupOutcome, PICK_MSG, POPUP_TIMEOUT_MS } from '../lib/driveAuth.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('stored Drive token with expiry', () => {
  it('is reused while valid, for the same account only', () => {
    const st = memStorage();
    saveDriveToken('tok', { expiresInS: 3600, email: 'a@b.c', storage: st });
    expect(loadDriveToken({ email: 'a@b.c', storage: st })).toBe('tok');
    expect(loadDriveToken({ email: 'x@y.z', storage: st })).toBeNull();
  });
  it('is dropped when about to expire', () => {
    const st = memStorage();
    saveDriveToken('tok', { expiresInS: 60, email: 'a@b.c', storage: st }); // inside the 2-minute margin
    expect(loadDriveToken({ email: 'a@b.c', storage: st })).toBeNull();
    expect(st.getItem(TOKEN_LS)).toBeNull();
  });
  it('null clears it', () => {
    const st = memStorage();
    saveDriveToken('tok', { storage: st });
    saveDriveToken(null, { storage: st });
    expect(loadDriveToken({ storage: st })).toBeNull();
  });
});

describe('singlePopup — at most one window', () => {
  beforeEach(() => _resetPopupForTests());

  function fakeWin() {
    const opened = [];
    const win = { open: (...a) => { const w = { closed: false, focus: vi.fn(), close() { this.closed = true; }, args: a }; opened.push(w); return w; } };
    return { win, opened };
  }

  it('a second request focuses the open window and shares the promise', async () => {
    const { win, opened } = fakeWin();
    let resolve;
    const run = () => { win.open('https://x.firebaseapp.com/__/auth/handler', 'p', 'width=500,height=600'); return new Promise((r) => { resolve = r; }); };
    const p1 = singlePopup(run, { win, timeoutMs: 5000 });
    const p2 = singlePopup(run, { win, timeoutMs: 5000 });
    expect(p2).toBe(p1);
    expect(opened.length).toBe(1);
    expect(opened[0].focus).toHaveBeenCalled();
    resolve('ok');
    expect(await p1).toBe('ok');
  });

  it('the timeout closes the window and a later click may open a fresh one', async () => {
    const { win, opened } = fakeWin();
    const run = () => { win.open('u'); return new Promise(() => {}); };
    await expect(singlePopup(run, { win, timeoutMs: 20 })).rejects.toMatchObject({ code: 'drive-popup-timeout' });
    expect(opened[0].closed).toBe(true);
    singlePopup(run, { win, timeoutMs: 20 }).catch(() => {});
    expect(opened.length).toBe(2);
  });

  it('window.open is restored after capture', () => {
    const { win } = fakeWin();
    const orig = win.open;
    singlePopup(() => { win.open('u'); return Promise.resolve(1); }, { win });
    expect(win.open).toBe(orig);
  });
});

describe('App never opens a sign-in popup on its own', () => {
  const src = readFileSync(resolvePath(process.cwd(), 'src/App.jsx'), 'utf8');
  it('every popup call goes through singlePopup (click handlers only)', () => {
    const calls = src.match(/(signInWithPopup|reauthenticateWithPopup)\(/g) || [];
    const inGuard = [...src.matchAll(/singlePopup\(\(\)\s*=>\s*\(?([^;]*?)\)\)/g)].map((m) => (m[1].match(/(signInWithPopup|reauthenticateWithPopup)\(/g) || []).length)
      .reduce((a, b) => a + b, 0);
    expect(calls.length).toBeGreaterThan(0);
    expect(inGuard).toBe(calls.length);
  });
  it('the Drive grant re-authenticates the signed-in user with login_hint (no account chooser, no forced consent)', () => {
    const body = src.slice(src.indexOf('async function authorizeDrive'), src.indexOf('// The Drive OAuth access token is short-lived'));
    expect(body).toMatch(/reauthenticateWithPopup\(u, provider\)/);
    expect(body).toMatch(/driveProviderFor\(u && u\.email\)/);
    expect(body).toMatch(/reauthenticateWithRedirect\(u, provider\)/);
    expect(body).not.toMatch(/driveProvider\)/);
    expect(body).not.toMatch(/setDriveStatus\("loading"\);\s*\n\s*try/); // never «بارگذاری» while the window waits
    const fb = readFileSync(resolvePath(process.cwd(), 'src/lib/firebase.js'), 'utf8');
    const fn = fb.slice(fb.indexOf('function driveProviderFor'), fb.indexOf('export {'));
    expect(fn).toMatch(/login_hint: email/);
    expect(fn).not.toMatch(/consent/);
  });
  it('the silent refresh (load / 401 path) has no popup', () => {
    const body = src.slice(src.indexOf('async function refreshDriveTokenSilently'), src.indexOf('// Renew the Drive token silently'));
    expect(body).not.toMatch(/signInWithPopup|singlePopup/);
  });
  it('no 45-second retry loop remains', () => {
    expect(src).not.toMatch(/45000/);
  });
});


describe('abandoned / closed / blocked Drive window ⇒ a clear message, never an endless «loading»', () => {
  it('closed or cancelled ⇒ «choose the account» + retry', () => {
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']) {
      const o = drivePopupOutcome({ code });
      expect(o).toMatchObject({ redirect: false, status: 'retry' });
      expect(o.msg).toContain(PICK_MSG);
      expect(o.msg).toContain('تلاش دوباره');
    }
  });
  it('the 60-second timeout says so', () => {
    expect(POPUP_TIMEOUT_MS).toBe(60000);
    expect(drivePopupOutcome({ code: 'drive-popup-timeout' }).msg).toMatch(/۶۰ ثانیه/);
  });
  it('blocked ⇒ redirect; another account ⇒ names the signed-in one', () => {
    expect(drivePopupOutcome({ code: 'auth/popup-blocked' }).redirect).toBe(true);
    expect(drivePopupOutcome({ code: 'auth/user-mismatch' }, 'a@b.c').msg).toContain('a@b.c');
  });
});
