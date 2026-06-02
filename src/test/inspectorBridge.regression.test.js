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

// Extract a top-level `function name(...) { ... }` body from index.html and
// return a callable. Uses brace balancing so nested blocks are captured fully.
function extractFunction(name) {
  const start = indexHtml.indexOf('function ' + name + '(');
  if (start === -1) throw new Error('function ' + name + ' not found in index.html');
  const braceStart = indexHtml.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < indexHtml.length; i++) {
    const ch = indexHtml[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) throw new Error('unbalanced braces for ' + name);
  const source = indexHtml.slice(start, end);
  // eslint-disable-next-line no-new-func
  return new Function(source + '\nreturn ' + name + ';')();
}

describe('Inspector Bridge input validation (task 2fdbbff9)', () => {
  const sanitizeSelector = extractFunction('sanitizeSelector');
  const isSafeNavigationUrl = extractFunction('isSafeNavigationUrl');

  // AC: the raw unsafe sinks must be gone from the command handler.
  it('does not pass raw msg.selector/msg.url straight into the DOM sinks', () => {
    expect(indexHtml).not.toMatch(/document\.querySelector\(msg\.selector\)/);
    expect(indexHtml).not.toMatch(/window\.location\.href\s*=\s*msg\.url/);
  });

  describe('sanitizeSelector — selectors restricted to allowed characters', () => {
    it('keeps ordinary CSS selectors intact', () => {
      expect(sanitizeSelector('#main .btn[data-x="1"]')).toBe('#main .btn[data-x="1"]');
      expect(sanitizeSelector('a.link, button')).toBe('a.link, button');
    });

    it('strips characters outside the allowlist (e.g. angle/script noise)', () => {
      // `<`, backtick, `{`, `}`, `!`, `;`, `?`, `\` are not in the allowlist.
      expect(sanitizeSelector('div<script>')).toBe('divscript>');
      expect(sanitizeSelector('img onerror=`x`')).toBe('img onerror=x');
      expect(sanitizeSelector('a{}!;?\\b')).toBe('ab');
    });

    it('returns empty string for non-string input', () => {
      expect(sanitizeSelector(null)).toBe('');
      expect(sanitizeSelector(undefined)).toBe('');
      expect(sanitizeSelector({})).toBe('');
    });

    it('bounds the selector length', () => {
      const huge = '#' + 'a'.repeat(500);
      expect(sanitizeSelector(huge).length).toBeLessThanOrEqual(200);
    });
  });

  describe('isSafeNavigationUrl — only absolute https URLs allowed', () => {
    it('accepts https URLs', () => {
      expect(isSafeNavigationUrl('https://example.com/path')).toBe(true);
    });

    it('rejects http, javascript:, data:, and other schemes', () => {
      expect(isSafeNavigationUrl('http://example.com')).toBe(false);
      expect(isSafeNavigationUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeNavigationUrl('JavaScript:alert(1)')).toBe(false);
      expect(isSafeNavigationUrl('  javascript:alert(1)')).toBe(false);
      expect(isSafeNavigationUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeNavigationUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeNavigationUrl('file:///etc/passwd')).toBe(false);
    });

    it('rejects relative URLs, empty, and non-string input', () => {
      expect(isSafeNavigationUrl('/relative/path')).toBe(false);
      expect(isSafeNavigationUrl('')).toBe(false);
      expect(isSafeNavigationUrl(null)).toBe(false);
      expect(isSafeNavigationUrl(undefined)).toBe(false);
    });
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
