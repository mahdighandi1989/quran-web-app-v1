// Unit tests for src/App.jsx.
//
// App.jsx initialises Firebase at module scope and contains the app's critical
// auth + Google Drive sync logic. We mock firebase/* so importing the module is
// side-effect free, then exercise the pure utilities, the auth error mapper, and
// the Drive sync helpers (fetch mocked). See task abb2dab4.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Firebase mocks (hoisted by Vitest above the App import) --------------
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'mock-app' })),
}));
vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
}));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    addScope() { return this; }
    setCustomParameters() { return this; }
  }
  return {
    getAuth: vi.fn(() => ({ currentUser: null })),
    GoogleAuthProvider,
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => {}),
  };
});

import * as authMod from 'firebase/auth';
import {
  normAR, eq, levenshtein, getSimilarity, segGraphemes, normalizeWS, isAllGreen,
  toAr, pad3, slugAyah, joinTokens,
  describeAuthError,
  buildSyncPayload, serializeSync, validateDrivePayload,
  driveFindFile, driveDownload, driveCreate, driveUpdate,
} from './App.jsx';

/* ============================ Utility functions ============================ */
describe('Arabic text utilities', () => {
  it('normAR removes diacritics and normalizes (بِسْمِ اللَّهِ)', () => {
    expect(normAR('بِسْمِ اللَّهِ')).toBe('بسم الله');
  });
  it('normAR returns empty string for falsy input', () => {
    expect(normAR('')).toBe('');
    expect(normAR(null)).toBe('');
    expect(normAR(undefined)).toBe('');
  });
  it('normAR unifies yeh/kaf/teh-marbuta variants', () => {
    // ي(064a)+ى(0649) -> ی(06cc); ك(0643) -> ک(06a9); ة(0629) -> ه(0647)
    expect(normAR('يحيى')).toBe('یحیی');
    expect(normAR('مكتبة')).toBe('مکتبه');
  });
  it('normAR collapses whitespace and trims', () => {
    expect(normAR('  سلام    دنیا  ')).toBe('سلام دنیا');
  });

  it('eq treats diacritic-only differences as equal', () => {
    expect(eq('بِسْمِ', 'بسم')).toBe(true);
  });
  it('eq returns false for genuinely different text', () => {
    expect(eq('سلام', 'دنیا')).toBe(false);
  });

  it('levenshtein is 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });
  it('levenshtein counts a single substitution', () => {
    expect(levenshtein('hello', 'hallo')).toBe(1);
  });
  it('levenshtein handles empty input via length fallback', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
  it('levenshtein computes the classic kitten/sitting distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });

  it('getSimilarity returns 1.0 for identical (normalized) strings', () => {
    expect(getSimilarity('سلام', 'سلام')).toBe(1.0);
    expect(getSimilarity('', '')).toBe(1.0);
  });
  it('getSimilarity returns a fraction for partial matches', () => {
    // normAR keeps latin as-is; levenshtein('abc','abd')=1, maxLen=3 -> 2/3
    expect(getSimilarity('abc', 'abd')).toBeCloseTo(2 / 3, 5);
  });

  it('segGraphemes splits a string into graphemes', () => {
    expect(segGraphemes('abc')).toEqual(['a', 'b', 'c']);
    expect(segGraphemes('بسم')).toHaveLength(3);
  });
  it('segGraphemes returns [] for empty input', () => {
    expect(segGraphemes('')).toEqual([]);
  });

  it('normalizeWS collapses internal whitespace and trims', () => {
    expect(normalizeWS('  a   b  ')).toBe('a b');
    expect(normalizeWS(null)).toBe('');
  });

  it('isAllGreen is true when every grapheme matches (whitespace-insensitive)', () => {
    expect(isAllGreen('بسم الله', 'بسم الله')).toBe(true);
    expect(isAllGreen('بسم   الله', 'بسم الله')).toBe(true);
  });
  it('isAllGreen is false on any grapheme or length mismatch', () => {
    expect(isAllGreen('بسم', 'بسن')).toBe(false);
    expect(isAllGreen('بسم', 'بسم الله')).toBe(false);
  });
});

describe('formatting helpers', () => {
  it('toAr converts ASCII digits to Arabic-Indic digits', () => {
    expect(toAr(123)).toBe('١٢٣');
    expect(toAr('2026')).toBe('٢٠٢٦');
  });
  it('pad3 left-pads numbers to 3 digits', () => {
    expect(pad3(7)).toBe('007');
    expect(pad3(123)).toBe('123');
  });
  it('slugAyah builds a surah:ayah key', () => {
    expect(slugAyah({ surah_number: 2, ayah_number: 255 })).toBe('2:255');
  });
  it('joinTokens joins token arrays and tolerates nullish', () => {
    expect(joinTokens(['a', 'b', 'c'])).toBe('a b c');
    expect(joinTokens(null)).toBe('');
  });
});

/* ============================ Firebase auth ============================ */
describe('Firebase auth (firebase/auth mocked)', () => {
  it('firebase/auth module is mocked', () => {
    expect(vi.isMockFunction(authMod.signInWithPopup)).toBe(true);
    expect(vi.isMockFunction(authMod.getAuth)).toBe(true);
    expect(vi.isMockFunction(authMod.onAuthStateChanged)).toBe(true);
  });
  it('describeAuthError maps unauthorized-domain to actionable guidance', () => {
    const msg = describeAuthError({ code: 'auth/unauthorized-domain' });
    expect(msg).toContain('Authorized domains');
  });
  it('describeAuthError maps popup-blocked', () => {
    expect(describeAuthError({ code: 'auth/popup-blocked' })).toContain('مسدود');
  });
  it('describeAuthError returns empty (benign) for cancelled-popup-request', () => {
    expect(describeAuthError({ code: 'auth/cancelled-popup-request' })).toBe('');
  });
  it('describeAuthError includes the raw code for unknown errors', () => {
    const msg = describeAuthError({ code: 'auth/some-new-code' });
    expect(msg).toContain('ورود ناموفق');
    expect(msg).toContain('auth/some-new-code');
  });
  it('describeAuthError is safe when passed null/undefined', () => {
    expect(describeAuthError(null)).toContain('ورود ناموفق');
    expect(describeAuthError(undefined)).toContain('ورود ناموفق');
  });
});

/* ============================ Google Drive sync ============================ */
describe('Google Drive sync (fetch mocked)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('buildSyncPayload picks exactly the synced slice (drops unknown keys)', () => {
    const state = {
      dataset: [{ a: 1 }], sessions: [{ s: 1 }], pageStructure: [1, 2],
      flaggedAyahs: { '2:255': true }, settings: { theme: 'dark' },
      somethingElse: 'ignored',
    };
    expect(buildSyncPayload(state)).toEqual({
      dataset: [{ a: 1 }], sessions: [{ s: 1 }], pageStructure: [1, 2],
      flaggedAyahs: { '2:255': true }, settings: { theme: 'dark' },
    });
  });
  it('buildSyncPayload supplies empty defaults for missing fields', () => {
    expect(buildSyncPayload({})).toEqual({
      dataset: [], sessions: [], pageStructure: [], flaggedAyahs: {}, settings: {},
    });
  });
  it('serializeSync equals JSON of the payload', () => {
    const state = { dataset: [1], sessions: [], pageStructure: [], flaggedAyahs: {}, settings: {} };
    expect(serializeSync(state)).toBe(JSON.stringify(buildSyncPayload(state)));
  });

  it('driveFindFile returns the first file and authorizes the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ files: [{ id: 'file-1', name: 'quran_backup_full.json' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const file = await driveFindFile('tok-123', 'quran_backup_full.json');
    expect(file).toEqual({ id: 'file-1', name: 'quran_backup_full.json' });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('https://www.googleapis.com/drive/v3/files');
    expect(opts.headers.Authorization).toBe('Bearer tok-123');
  });
  it('driveFindFile returns null when no files match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ files: [] }),
    }));
    expect(await driveFindFile('tok', 'x')).toBeNull();
  });
  it('driveFindFile throws a status-bearing error on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403, json: async () => ({ error: { message: 'Forbidden' } }),
    }));
    await expect(driveFindFile('tok', 'x')).rejects.toMatchObject({
      message: 'Forbidden', status: 403,
    });
  });

  it('driveDownload fetches file media and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ sessions: [1, 2, 3] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const data = await driveDownload('tok', 'file-1');
    expect(data).toEqual({ sessions: [1, 2, 3] });
    expect(fetchMock.mock.calls[0][0]).toContain('files/file-1?alt=media');
  });

  it('driveCreate POSTs a multipart upload and returns the new id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ id: 'new-file' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await driveCreate('tok', 'quran_backup_full.json', { a: 1 });
    expect(res).toEqual({ id: 'new-file' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('uploadType=multipart');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toContain('multipart/related');
  });

  it('driveUpdate PATCHes existing file media', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ id: 'file-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await driveUpdate('tok', 'file-1', { a: 2 });
    expect(res).toEqual({ id: 'file-1' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('files/file-1?uploadType=media');
    expect(opts.method).toBe('PATCH');
  });
});

/* ===== Downloaded-payload validation (task 60d2a8a0: AI/IO without validation) ===== */
describe('Drive download payload validation', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('validateDrivePayload accepts the sync object and a legacy bare array', () => {
    const obj = { dataset: [1], sessions: [] };
    expect(validateDrivePayload(obj)).toBe(obj);
    const arr = [1, 2, 3];
    expect(validateDrivePayload(arr)).toBe(arr);
  });
  it('validateDrivePayload rejects null and primitive payloads', () => {
    expect(() => validateDrivePayload(null)).toThrow();
    expect(() => validateDrivePayload(42)).toThrow();
    expect(() => validateDrivePayload('corrupt')).toThrow();
    expect(() => validateDrivePayload(true)).toThrow();
  });

  it('driveDownload throws a clear error when the file is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => { throw new SyntaxError('Unexpected end of JSON input'); },
    }));
    await expect(driveDownload('tok', 'file-1')).rejects.toThrow(/قابل تجزیه نیست/);
  });

  it('driveDownload throws when the JSON is a primitive (corrupted backup)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => 12345,
    }));
    await expect(driveDownload('tok', 'file-1')).rejects.toThrow(/نامعتبر/);
  });

  it('driveDownload passes through a structurally valid object unchanged', async () => {
    const payload = { dataset: [{ surah_number: 1 }], sessions: [], settings: { theme: 'dark' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => payload,
    }));
    await expect(driveDownload('tok', 'file-1')).resolves.toEqual(payload);
  });
});
