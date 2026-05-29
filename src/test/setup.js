// Global test setup, loaded once before the test suite (see vitest.config.js).
// 1) Register @testing-library/jest-dom custom matchers (toBeInTheDocument, ...).
// 2) Unmount React trees and clear the DOM after every test to avoid leakage.
// 3) Reset browser storage the app relies on (localStorage / sessionStorage).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // The app persists sessions/settings/dataset in browser storage; start each
  // test from a clean slate so tests do not leak state into one another.
  try {
    window.localStorage?.clear();
    window.sessionStorage?.clear();
  } catch {
    // jsdom may not expose storage in every environment — safe to ignore.
  }
});
