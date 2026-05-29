import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vitest configuration for the Quran web app (Vite 5 + React 18).
// Kept separate from vite.config.js so build/dev config and test config can evolve
// independently. Vitest prefers this file when present. The `@` alias mirrors
// vite.config.js so absolute imports resolve identically in tests and builds.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // jsdom gives us a browser-like environment (window/document) for React.
    environment: 'jsdom',
    // expose describe/it/expect/vi globally (no per-file imports required).
    globals: true,
    // global setup: jest-dom matchers + automatic cleanup between tests.
    setupFiles: './src/test/setup.js',
    // only treat these patterns as test files.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    // App data lives in localStorage; reset jsdom storage between files.
    clearMocks: true,
    restoreMocks: true,
  },
});
