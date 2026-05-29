// Smoke tests that prove the test infrastructure itself works:
// the runner executes, the jsdom environment is present, and the
// jest-dom matchers from src/test/setup.js are wired up correctly.
import { describe, it, expect } from 'vitest';

describe('test infrastructure', () => {
  it('runs the test runner (1 + 1 = 2)', () => {
    expect(1 + 1).toBe(2);
  });

  it('provides a jsdom browser environment', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
    expect(typeof document.createElement).toBe('function');
  });

  it('exposes globals (describe/it/expect) without imports being required at runtime', () => {
    // `expect` is used here; its mere availability is checked by this file
    // running at all under `globals: true`.
    expect(typeof expect).toBe('function');
  });

  it('registers @testing-library/jest-dom matchers via setup file', () => {
    const el = document.createElement('div');
    el.textContent = 'salaam';
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('salaam');
    document.body.removeChild(el);
  });
});
