// Integrity test for package-lock.json (task 5e99a172 — "over-engineering").
//
// The scan flagged the exhaustive platform-specific optional deps (e.g. @esbuild/*) as
// over-engineering. As the scan ITSELF notes, this is the STANDARD, correct behaviour of
// npm lockfileVersion 3: it guarantees reproducible installs across every OS/arch. Removing
// them — or hand-editing the npm-generated lockfile at all — is the real anti-pattern: it
// breaks cross-platform reproducibility and is clobbered on the next `npm install`.
// So the correct fix is to NOT touch the lockfile and instead lock in its integrity here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

describe('package-lock.json integrity', () => {
  it('is valid JSON and uses lockfileVersion 3', () => {
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.name).toBe(pkg.name);
  });

  it('tracks every package.json dependency at the root entry', () => {
    const rootPkg = lock.packages[''];
    expect(rootPkg).toBeTruthy();
    for (const dep of Object.keys(pkg.dependencies || {})) {
      expect(rootPkg.dependencies).toHaveProperty(dep);
    }
    for (const dep of Object.keys(pkg.devDependencies || {})) {
      expect(rootPkg.devDependencies).toHaveProperty(dep);
    }
  });

  it('keeps platform-specific optional deps (intentional cross-platform reproducibility)', () => {
    // NOT over-engineering: this is how lockfileVersion 3 guarantees reproducible installs
    // on any OS/arch. Asserting they exist guards against a well-meaning but harmful
    // "cleanup" that would break installs on other platforms.
    const esbuildOptional = Object.keys(lock.packages).filter((k) => k.includes('@esbuild/'));
    expect(esbuildOptional.length).toBeGreaterThan(0);
  });
});
