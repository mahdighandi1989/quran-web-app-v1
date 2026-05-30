import { describe, it, expect, vi, beforeEach } from 'vitest';

// firebase.js (imported transitively) initialises the SDKs at module load — mock them all.
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', () => ({ getAnalytics: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: class { addScope() {} setCustomParameters() {} },
  signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), getRedirectResult: vi.fn(),
  signOut: vi.fn(), onAuthStateChanged: vi.fn(),
}));
const getDocMock = vi.fn();
const setDocMock = vi.fn(() => Promise.resolve());
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((db, col, id) => ({ col, id })),
  getDoc: (...a) => getDocMock(...a),
  setDoc: (...a) => setDocMock(...a),
}));

import { withTelegramDefaults, loadTelegramConfig, saveTelegramConfig } from '../lib/telegramStore.js';
import { DEFAULT_TELEGRAM } from '../lib/telegram.js';

describe('telegramStore (per-user Firestore persistence)', () => {
  beforeEach(() => { getDocMock.mockReset(); setDocMock.mockClear(); });

  it('withTelegramDefaults fills missing fields and merges notifications', () => {
    const merged = withTelegramDefaults({ enabled: true, notifications: { reminder: { enabled: false } } });
    expect(merged.enabled).toBe(true);
    expect(merged.notifications.reminder.enabled).toBe(false);
    expect(merged.notifications.exam_result).toBeDefined(); // default kept
    expect(Array.isArray(merged.devices)).toBe(true);
    expect(Array.isArray(merged.reminders)).toBe(true);
  });

  it('loadTelegramConfig(null) returns defaults without touching Firestore', async () => {
    const cfg = await loadTelegramConfig(null);
    expect(cfg.enabled).toBe(DEFAULT_TELEGRAM.enabled);
    expect(getDocMock).not.toHaveBeenCalled();
  });

  it('loadTelegramConfig(uid) reads the user doc and merges with defaults', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ enabled: true, primaryChatId: '42' }) });
    const cfg = await loadTelegramConfig('user-1');
    expect(getDocMock).toHaveBeenCalledTimes(1);
    expect(cfg).toMatchObject({ enabled: true, primaryChatId: '42' });
    expect(cfg.notifications.reminder).toBeDefined();
  });

  it('saveTelegramConfig requires a uid', async () => {
    await expect(saveTelegramConfig('', {})).rejects.toThrow();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('saveTelegramConfig writes via setDoc', async () => {
    await saveTelegramConfig('user-1', { enabled: true });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });
});
