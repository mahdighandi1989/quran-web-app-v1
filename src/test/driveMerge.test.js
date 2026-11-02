// 2026-11-02: on login the Drive copy replaced local sessions outright, so practice done while not
// synced (signed out / token expired) was lost. Sessions and flags are now merged.
import { describe, it, expect } from 'vitest';
import { mergeSessions, mergeFlags } from '../lib/drive.js';

describe('Drive login merge', () => {
  it('keeps local-only sessions, remote wins on the same id, sorted by time', () => {
    const remote = [{ id: 1, start: 1, tag: 'r1' }, { id: 3, start: 3, tag: 'r3' }];
    const local = [{ id: 1, start: 1, tag: 'local-old' }, { id: 2, start: 2, tag: 'offline' }];
    expect(mergeSessions(remote, local).map((s) => s.tag)).toEqual(['r1', 'offline', 'r3']);
  });
  it('tolerates missing lists and sessions without id (falls back to start)', () => {
    expect(mergeSessions(undefined, [{ start: 5 }])).toEqual([{ start: 5 }]);
    expect(mergeSessions([{ id: 9 }], null)).toEqual([{ id: 9 }]);
  });
  it('flags: union, remote wins on a shared key', () => {
    expect(mergeFlags({ a: true, b: false }, { b: true, c: true })).toEqual({ a: true, b: false, c: true });
  });
});
