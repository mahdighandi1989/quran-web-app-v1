import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', () => ({ getAnalytics: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})), GoogleAuthProvider: class { addScope() {} setCustomParameters() {} },
  signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), getRedirectResult: vi.fn(),
  signOut: vi.fn(), onAuthStateChanged: vi.fn(),
}));
const getDocMock = vi.fn();
const setDocMock = vi.fn(() => Promise.resolve());
const onSnapshotMock = vi.fn(() => () => {});
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})), doc: vi.fn((db, col, id) => ({ col, id })),
  getDoc: (...a) => getDocMock(...a), setDoc: (...a) => setDocMock(...a), onSnapshot: (...a) => onSnapshotMock(...a),
}));

import { withAiDefaults, loadAiConfig, saveAiConfig, subscribeAiConfig } from '../lib/aiStore.js';

describe('aiStore (per-user Firestore, guest = no persistence)', () => {
  beforeEach(() => { getDocMock.mockReset(); setDocMock.mockClear(); onSnapshotMock.mockClear(); });

  it('withAiDefaults normalizes shape', () => {
    const c = withAiDefaults({ activeProvider: 'openai', keys: { openai: 'k' } });
    expect(c.activeProvider).toBe('openai');
    expect(c.keys.openai).toBe('k');
    expect(Array.isArray(c.customProviders)).toBe(true);
    expect(typeof c.extraModels).toBe('object');
  });

  it('loadAiConfig(null) returns defaults and does NOT touch Firestore (guest)', async () => {
    const c = await loadAiConfig(null);
    expect(c.keys).toEqual({});
    expect(getDocMock).not.toHaveBeenCalled();
  });

  it('loadAiConfig(uid) reads the per-user doc', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ activeProvider: 'groq', keys: { groq: 'gsk' } }) });
    const c = await loadAiConfig('u1');
    expect(getDocMock).toHaveBeenCalledTimes(1);
    expect(c.activeProvider).toBe('groq');
    expect(c.keys.groq).toBe('gsk');
  });

  it('saveAiConfig requires a uid (guests cannot persist keys)', async () => {
    await expect(saveAiConfig('', { keys: { openai: 'k' } })).rejects.toThrow();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('saveAiConfig writes for a signed-in user', async () => {
    await saveAiConfig('u1', { activeProvider: 'openai' });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('subscribeAiConfig(null) yields defaults + no-op unsub (guest)', () => {
    const onData = vi.fn();
    const unsub = subscribeAiConfig(null, onData);
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData.mock.calls[0][0].keys).toEqual({});
    expect(onSnapshotMock).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });
});
