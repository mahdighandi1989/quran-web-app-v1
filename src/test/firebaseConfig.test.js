// Regression guard for the production crash `FirebaseError: auth/invalid-api-key`.
// It happened because firebaseConfig read VITE_FIREBASE_* with no fallback, so a build
// without those env vars (e.g. the Render deploy) produced an undefined apiKey and getAuth
// threw at module load — white-screening the whole app. Each field must keep a non-empty
// literal fallback so the app initialises even with no env configured.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const src = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../lib/firebase.js'),
  'utf8',
);

describe('Firebase config fallbacks (regression: auth/invalid-api-key)', () => {
  const fields = [
    'API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET',
    'MESSAGING_SENDER_ID', 'APP_ID', 'MEASUREMENT_ID',
  ];

  it.each(fields)('VITE_FIREBASE_%s has a non-empty || fallback', (field) => {
    const re = new RegExp(
      `import\\.meta\\.env\\.VITE_FIREBASE_${field}\\s*\\|\\|\\s*["'][^"']+["']`,
    );
    expect(src).toMatch(re);
  });
});

describe('Auth wiring (regression: COOP popup + GoogleAuthProvider import)', () => {
  const appSrc = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../App.jsx'),
    'utf8',
  );

  it('firebase.js exports the symbols App.jsx needs', () => {
    for (const name of ['GoogleAuthProvider', 'signInWithRedirect', 'getRedirectResult']) {
      expect(src).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it('App.jsx imports GoogleAuthProvider (used by authorizeDrive credentialFromResult)', () => {
    // it is referenced as GoogleAuthProvider.credentialFromResult(...) — must be imported,
    // otherwise Drive connect throws ReferenceError (the bug this guards against).
    expect(appSrc).toMatch(/GoogleAuthProvider\.credentialFromResult/);
    expect(appSrc).toMatch(/import\s*\{[^}]*\bGoogleAuthProvider\b[^}]*\}\s*from\s*["']\.\/lib\/firebase/s);
  });

  it('handleLogin falls back to signInWithRedirect when the popup fails (COOP)', () => {
    expect(appSrc).toMatch(/signInWithRedirect\s*\(\s*auth\s*,\s*googleProvider\s*\)/);
    expect(appSrc).toMatch(/getRedirectResult\s*\(\s*auth\s*\)/);
  });
});
