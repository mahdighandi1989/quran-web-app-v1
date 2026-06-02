// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite build/dev configuration (React 18 + Vite 5).
// Test configuration lives in vitest.config.js, which Vitest prefers over this file.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `@` -> project src/, for clean absolute imports (e.g. import x from '@/lib/...').
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
