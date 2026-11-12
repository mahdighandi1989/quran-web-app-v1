// Sheets 19-۳ / 21-۲,۳ / 6-هـ: range loop, per-ayah repeat and «مکث برای تکرارِ من» in continuous play.
import { describe, it, expect } from 'vitest';
import { clampRange, advanceQueue, echoPauseMs, rangeOptionLabel } from '../lib/continuousPlay.js';

// Plays the queue to the end and returns the order the ayah indexes were heard in.
const play = (cfg, startIndex = cfg.start) => {
  const heard = []; let s = { index: startIndex, rep: 0, loop: 0 };
  for (let guard = 0; guard < 1000 && !s.done; guard++) { heard.push(s.index); s = advanceQueue(s, cfg); }
  return heard;
};

describe('clampRange', () => {
  it('no range = the whole page', () => expect(clampRange(null, 8)).toEqual({ start: 0, end: 7, whole: true }));
  it('a sub-range is kept, a reversed one is repaired, an out-of-page one is clamped', () => {
    expect(clampRange({ from: 2, to: 4 }, 8)).toEqual({ start: 2, end: 4, whole: false });
    expect(clampRange({ from: 5, to: 1 }, 8)).toEqual({ start: 1, end: 5, whole: false });
    expect(clampRange({ from: 3, to: 99 }, 8)).toEqual({ start: 3, end: 7, whole: false });
    expect(clampRange({ from: 'x', to: undefined }, 3)).toEqual({ start: 0, end: 2, whole: true });
  });
  it('an empty page does not throw', () => expect(clampRange({ from: 1, to: 2 }, 0)).toEqual({ start: 0, end: 0, whole: true }));
});

describe('advanceQueue', () => {
  it('plain page: each ayah once, then done', () => {
    expect(play({ start: 0, end: 3, ayahRepeat: 1, rangeRepeat: 1 })).toEqual([0, 1, 2, 3]);
  });
  it('the owner\'s example: ayahs 138–142 three times', () => {
    expect(play({ start: 2, end: 6, ayahRepeat: 1, rangeRepeat: 3 })).toEqual([2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6]);
  });
  it('per-ayah repeat inside a looped range', () => {
    expect(play({ start: 1, end: 2, ayahRepeat: 3, rangeRepeat: 2 })).toEqual([1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 2]);
  });
  it('starting in the middle of the range finishes the first pass from there', () => {
    expect(play({ start: 0, end: 2, ayahRepeat: 1, rangeRepeat: 2 }, 1)).toEqual([1, 2, 0, 1, 2]);
  });
  it('junk settings fall back to once', () => {
    expect(play({ start: 0, end: 1, ayahRepeat: 'x', rangeRepeat: 0 })).toEqual([0, 1]);
    expect(play({ start: 0, end: 0, ayahRepeat: 99, rangeRepeat: 1 })).toHaveLength(10);
  });
});

describe('echoPauseMs', () => {
  it('lasts as long as the ayah took at the chosen speed', () => {
    expect(echoPauseMs(6, 1)).toBe(6000);
    expect(echoPauseMs(6, 0.75)).toBe(8000);
    expect(echoPauseMs(6, 1.25)).toBe(4800);
  });
  it('is bounded and survives an unknown duration', () => {
    expect(echoPauseMs(0.4, 1)).toBe(1500);
    expect(echoPauseMs(600, 1)).toBe(90000);
    expect(echoPauseMs(NaN, 1)).toBe(4000);
    expect(echoPauseMs(Infinity, 1)).toBe(4000);
    expect(echoPauseMs(5, 0)).toBe(5000);
  });
});

describe('rangeOptionLabel', () => {
  it('adds the surah name only on a page with more than one surah', () => {
    const a = { surah_number: 7, surah_name: 'الأعراف', ayah_number: 138 };
    expect(rangeOptionLabel(a, false)).toBe('138');
    expect(rangeOptionLabel(a, true)).toBe('الأعراف 138');
  });
});
