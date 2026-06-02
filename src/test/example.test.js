// Minimal example test proving the Vitest infrastructure runs end-to-end.
// Kept as a standalone, dependency-free smoke test (the canonical "1 + 1 = 2").
import { describe, it, expect } from 'vitest';

describe('example', () => {
  it('runs a trivial assertion (1 + 1 = 2)', () => {
    expect(1 + 1).toBe(2);
  });
});
