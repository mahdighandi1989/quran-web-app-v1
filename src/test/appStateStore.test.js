import { describe, it, expect, vi, beforeEach } from 'vitest';

// firebase.js initialises SDKs at import — mock them so importing the store is side-effect free.
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', () => ({ getAnalytics: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})), GoogleAuthProvider: class { addScope() {} setCustomParameters() {} },
  signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), getRedirectResult: vi.fn(),
  signOut: vi.fn(), onAuthStateChanged: vi.fn(),
}));
const setDocMock = vi.fn(() => Promise.resolve());
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})), doc: vi.fn((db, col, id) => ({ col, id })),
  setDoc: (...a) => setDocMock(...a),
}));

import { buildAppStateSummary, saveAppState, buildQuranSample } from '../lib/appStateStore.js';

const dayMs = 24 * 60 * 60 * 1000;

describe('buildAppStateSummary', () => {
  it('summarizes counts and accuracy', () => {
    const now = Date.now();
    const s = buildAppStateSummary({
      user: { displayName: 'Ali' },
      dataset: [{}, {}, {}],
      pageStructure: [{}, {}],
      flaggedAyahs: { '2:255': true },
      sessions: [
        { start: now, end: now, correctItems: [1, 2, 3], wrongItems: [1] },
        { start: now - 10 * dayMs, end: now - 10 * dayMs, correctItems: [1], wrongItems: [1] },
      ],
    });
    expect(s.user.name).toBe('Ali');
    expect(s.dataset.ayahs).toBe(3);
    expect(s.pages).toBe(2);
    expect(s.flagged).toBe(1);
    expect(s.sessions.total).toBe(2);
    expect(s.sessions.totalCorrect).toBe(4);
    expect(s.sessions.totalWrong).toBe(2);
    expect(s.sessions.accuracyPct).toBe(67); // 4/6
    expect(s.sessions.last7Days).toBe(1);    // only the recent one
  });

  it('counts today separately and handles empty input', () => {
    const now = Date.now();
    const s = buildAppStateSummary({ sessions: [{ start: now, end: now, correctItems: [1, 2], wrongItems: [] }] });
    expect(s.sessions.today).toEqual({ sessions: 1, correct: 2, wrong: 0 });

    const empty = buildAppStateSummary({});
    expect(empty.sessions.total).toBe(0);
    expect(empty.sessions.accuracyPct).toBe(0);
    expect(empty.dataset.ayahs).toBe(0);
  });
});

describe('saveAppState', () => {
  beforeEach(() => setDocMock.mockClear());
  it('no-ops without a uid', async () => {
    expect(await saveAppState('', {})).toBe(false);
    expect(setDocMock).not.toHaveBeenCalled();
  });
  it('writes via setDoc when uid present', async () => {
    await saveAppState('u1', { x: 1 });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });
});

describe('buildQuranSample', () => {
  const dataset = [
    { surah_number: 2, ayah_number: 255, surah_name: 'البقرة', tokens_with_diacritics: ['اللَّهُ', 'لَا'], tokens_plain: ['الله', 'لا'] },
    { surah_number: 1, ayah_number: 1, surah_name: 'الفاتحة', tokens_plain: ['بسم', 'الله'] },
  ];
  it('returns capped ayahs with text fields', () => {
    const out = buildQuranSample(dataset, 10, []);
    expect(out.count).toBe(2);
    expect(out.ayahs[0]).toMatchObject({ s: 2, a: 255, n: 'البقرة' });
    expect(out.ayahs[0].t).toContain('اللَّهُ');
  });
  it('builds topMistakes from sessions, sorted by wrong count, with ayah text', () => {
    const sessions = [
      { wrongItems: [{ surah: 2, ayah: 255 }, { surah: 2, ayah: 255 }, { surah: 1, ayah: 1 }] },
    ];
    const out = buildQuranSample(dataset, 10, sessions);
    expect(out.topMistakes[0]).toMatchObject({ s: 2, a: 255, wrong: 2 });
    expect(out.topMistakes[0].t).toBeTruthy();
    expect(out.topMistakes.length).toBe(2);
  });
  it('handles empty input', () => {
    const out = buildQuranSample([], 10, []);
    expect(out.count).toBe(0);
    expect(out.topMistakes).toEqual([]);
  });
});
