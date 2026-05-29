// Regression guard for task 61f7b3ba ("broken feedback loop").
//
// The Inspector Bridge "ready" payload must report the full page URL via
// window.location.href. A reported/historical typo `window.locatio` (missing the
// trailing "n.href") would send an undefined/incorrect URL to the backend and break
// page-identification + monitoring. The current index.html is already correct; these
// tests lock that in so a future edit cannot silently reintroduce the typo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(resolve(here, '../../index.html'), 'utf8');

describe('Inspector Bridge feedback loop (index.html)', () => {
  it('does not contain the broken `window.locatio` typo', () => {
    // window.locatio NOT followed by `n` is the truncated/typo form.
    expect(indexHtml).not.toMatch(/window\.locatio(?!n)/);
  });

  it('each inspector-bridge-ready payload reports the real page URL', () => {
    const parts = indexHtml.split("type: 'inspector-bridge-ready'");
    // at least one ready payload exists (WebSocket + postMessage paths)
    expect(parts.length).toBeGreaterThan(1);
    for (let i = 1; i < parts.length; i++) {
      const objectLiteral = parts[i].slice(0, 220);
      expect(objectLiteral).toMatch(/pageUrl:\s*window\.location\.href/);
    }
  });

  it('every pageUrl field uses window.location.href (no truncated values)', () => {
    const assignments = indexHtml.match(/pageUrl:\s*[^,\n}]+/g) || [];
    expect(assignments.length).toBeGreaterThan(0);
    for (const a of assignments) {
      expect(a).toMatch(/window\.location\.href/);
    }
  });
});
