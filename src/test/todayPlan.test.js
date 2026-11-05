// Sheet 9 («۵ نقطهٔ ضعفِ امروز» per ayah and word) and sheet 6-الف («برنامهٔ امروز»): derived from recorded sessions.
import { describe, it, expect } from 'vitest';
import { weakSpots, dueReviews, todayPlan, mistakeKind, gradedToday, asPracticeItems } from '../lib/todayPlan.js';

const NOW = Date.parse('2026-11-05T10:00:00Z');
const H = 3600 * 1000;
const tok = (ayah, typed, target, when, extra = {}) => ({ scope: 'token', surah: 1, ayah, typed, target, when, ...extra });

describe('mistake kinds', () => {
  it('empty = forgot, same letters other marks = diacritics, else another word', () => {
    expect(mistakeKind({ typed: '', target: 'يوم' })).toBe('forgot');
    expect(mistakeKind({ skip: true, typed: 'x', target: 'y' })).toBe('forgot');
    expect(mistakeKind({ typed: 'يَوْمَ', target: 'يَوْمِ' })).toBe('diacritics');
    expect(mistakeKind({ typed: 'الدين', target: 'يوم' })).toBe('other');
  });
});

describe('weak spots — per ayah and word, recent first, corrected ones fade', () => {
  const sessions = [
    { id: 1, wrongItems: [tok(4, '', 'يَوْمِ', NOW - 2 * H), tok(4, 'يَوْمَ', 'يَوْمِ', NOW - 2 * H), tok(4, 'الدين', 'يَوْمِ', NOW - 1 * H),
      tok(4, '', 'الدِّينِ', NOW - 1 * H), tok(5, '', 'نَعْبُدُ', NOW - 10 * 24 * H)], correctItems: [] },
    { id: 2, wrongItems: [tok(6, '', 'اهْدِنَا', NOW - 3 * H)], correctItems: [{ surah: 1, ayah: 6, when: NOW - 1 * H }] },
  ];
  it('Fatiha 4 is first, with its weak words and kinds', () => {
    const w = weakSpots(sessions, { now: NOW });
    expect(w[0]).toMatchObject({ surah: 1, ayah: 4, wrong: 4 });
    expect(w[0].words[0]).toMatchObject({ word: 'يَوْمِ', count: 3 });
    expect(w[0].words[0].kinds).toEqual({ forgot: 1, diacritics: 1, other: 1 });
  });
  it('an old mistake weighs less than a recent one; a correction after the mistake lowers the ayah', () => {
    const w = weakSpots(sessions, { now: NOW, limit: 0 });
    const by = Object.fromEntries(w.map((e) => [e.ayah, e.score]));
    expect(by[4]).toBeGreaterThan(by[6]);
    expect(by[6]).toBeLessThan(1);           // corrected once after its mistake
    expect(by[5]).toBeLessThan(0.2);         // 10 days old
  });
  it('practice items match the existing starter', () => {
    expect(asPracticeItems(weakSpots(sessions, { now: NOW })).map((x) => x.key)).toContain('1:4');
  });
});

describe('spaced review and today plan', () => {
  it('an ayah answered right once after its mistake is due again after 1 day, not before', () => {
    const s = [{ id: 1, wrongItems: [tok(2, '', 'x', NOW - 30 * H)], correctItems: [{ surah: 1, ayah: 2, when: NOW - 12 * H }] }];
    expect(dueReviews(s, { now: NOW })).toHaveLength(0);
    expect(dueReviews(s, { now: NOW + 13 * H })).toHaveLength(1);
  });
  it('plan: reviews, page to continue, goal left today', () => {
    const s = [{ id: 1, wrongItems: [tok(4, '', 'x', NOW - H)], correctItems: [{ surah: 1, ayah: 1, when: NOW - H }] }];
    const p = todayPlan(s, { now: NOW, lastHifzPage: 7, dailyGoal: 20 });
    expect(p.reviews.map((r) => r.key)).toEqual(['1:4']);
    expect(p.hifzPage).toBe(7);
    expect(p.goal).toEqual({ done: 2, target: 20, left: 18 });
    expect(gradedToday(s, NOW + 2 * 24 * H)).toBe(0);
  });
});

import { RECITERS, buildAyahUrl } from '../lib/reciters.js';
describe('sheet 5-۵: the working audio source is tried first', () => {
  it('https everyayah first for every reciter; the old sources stay as fallbacks', () => {
    for (const r of RECITERS) {
      expect(r.templates[0]).toMatch(/^https:\/\/everyayah\.com\/data\//);
      expect(r.templates.length).toBeGreaterThanOrEqual(4);
    }
    expect(buildAyahUrl('parhizgar', 1, 4)).toBe('https://everyayah.com/data/Parhizgar_48kbps/001004.mp3');
  });
});
