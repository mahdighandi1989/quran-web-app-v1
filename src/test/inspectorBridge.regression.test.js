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

describe('Inspector Bridge WebSocket endpoint (task 43dafd3f)', () => {
  it('no longer hardcodes the dead external ai-creator backend URL', () => {
    expect(indexHtml).not.toContain('ai-creator-backend-q677.onrender.com');
  });

  it('reads the WS URL from a configurable source (not a baked-in literal)', () => {
    expect(indexHtml).toMatch(/window\.__INSPECTOR_WS_URL__/);
  });

  it('only opens a WebSocket when a URL is configured (no connection by default)', () => {
    // the connect guard must bail out on a falsy WS_URL before constructing a socket
    expect(indexHtml).toMatch(/if\s*\(\s*!WS_URL\s*\)/);
    // and there should be no leftover "URL === <itself>" sentinel comparison
    expect(indexHtml).not.toMatch(/WS_URL\s*===\s*['"]wss:/);
  });

  it('gates the entire bridge behind VITE_ENABLE_INSPECTOR_BRIDGE (off in production) — task 37d678ef', () => {
    // Vite leaves the %VITE_*% token literal in production builds (var unset), so the
    // guard returns early and the bridge — WebSocket included — never runs.
    expect(indexHtml).toMatch(/%VITE_ENABLE_INSPECTOR_BRIDGE%'\s*!==\s*'true'\)\s*return/);
  });
});
