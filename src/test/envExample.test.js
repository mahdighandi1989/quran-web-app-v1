// Guards task 794928b2: every VITE_* env var the source reads must be documented in
// .env.example, and .env must stay git-ignored. This keeps new contributors from missing
// required configuration and prevents secrets from being committed. The .env.example file
// itself was added in task d5df1b79; this test enforces it stays complete going forward.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function walkAppSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'test') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkAppSources(p));
    else if (/\.(js|jsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(p);
  }
  return out;
}

const usedVars = new Set();
for (const file of walkAppSources(resolve(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) usedVars.add(m[1]);
}

const envExample = readFileSync(resolve(root, '.env.example'), 'utf8');
const documented = new Set(
  [...envExample.matchAll(/^(VITE_[A-Z0-9_]+)\s*=/gm)].map((m) => m[1]),
);
const gitignore = readFileSync(resolve(root, '.gitignore'), 'utf8');

describe('.env.example completeness', () => {
  it('exists and documents at least the 7 Firebase config vars', () => {
    expect(documented.size).toBeGreaterThanOrEqual(7);
  });

  it('documents every VITE_* env var the app source reads', () => {
    const missing = [...usedVars].filter((v) => !documented.has(v));
    expect(missing).toEqual([]);
  });

  it('keeps .env git-ignored (secrets never committed)', () => {
    expect(/^\.env$/m.test(gitignore)).toBe(true);
  });
});
