// 2026-11-16 — sheet 6-د «محوشدنِ تدریجی»، 6-ج «سخت/خوب/آسان» + «نقشهٔ ۶۰۴ صفحه».
import { describe, it, expect } from 'vitest';
import { fadeHidden, maskTokens, nextFadeLevel, FADE_LEVELS, revealEntry, isRevealMode } from '../lib/revealMode.js';
import { dueReviews, reviewStep } from '../lib/todayPlan.js';
import { pageProgress, juzOfPage, JUZ_START, pageIndex } from '../lib/pageMap.js';
import pages from '../data/quranPages.json';

const DAY = 24 * 3600 * 1000;
const words = 'إِنَّ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ لَهُمْ جَنَّاتٌ تَجْرِي مِنْ تَحْتِهَا الْأَنْهَارُ'.split(' ');

describe('gradual fade', () => {
  it('hides about level% of the words, at least one, and 100% hides all', () => {
    expect(isRevealMode('reveal_fade')).toBe(true);
    expect(fadeHidden(10, 20, '2:25').size).toBe(2);
    expect(fadeHidden(10, 60, '2:25').size).toBe(6);
    expect(fadeHidden(3, 20, 'x').size).toBe(1);
    expect(fadeHidden(10, 100, '2:25').size).toBe(10);
  });
  it('each level hides a superset of the previous one (words only disappear)', () => {
    let prev = new Set();
    for (const l of FADE_LEVELS) {
      const h = fadeHidden(words.length, l, '2:25');
      for (const i of prev) expect(h.has(i)).toBe(true);
      prev = h;
    }
  });
  it('is stable for the same ayah and differs between ayahs', () => {
    expect([...fadeHidden(10, 40, '2:25')]).toEqual([...fadeHidden(10, 40, '2:25')]);
    const a = [...fadeHidden(10, 40, '2:25')].join(), b = [...fadeHidden(10, 40, '3:7')].join();
    expect(a === b && [...fadeHidden(10, 40, '4:1')].join() === a).toBe(false);
  });
  it('mask keeps the visible words verbatim', () => {
    const m = maskTokens(words, 'reveal_fade', { level: 40, seed: '2:25' });
    const hidden = fadeHidden(words.length, 40, '2:25');
    m.forEach((t, i) => expect(t).toBe(hidden.has(i) ? '•••' : words[i]));
  });
  it('next level', () => {
    expect(nextFadeLevel(20)).toBe(40);
    expect(nextFadeLevel(80)).toBe(100);
    expect(nextFadeLevel(100)).toBe(100);
  });
});

describe('hard / good / easy', () => {
  const ayah = { surah_number: 2, ayah_number: 25, tokens_with_diacritics: words };
  it('records the ease only on a known answer', () => {
    expect(revealEntry(ayah, true, 'easy').ease).toBe('easy');
    expect(revealEntry(ayah, true, 'good').ease).toBeUndefined();
    expect(revealEntry(ayah, false, 'easy').ease).toBeUndefined();
  });
  const now = 100 * DAY;
  const sess = (ease) => [
    { wrongItems: [{ surah: 2, ayah: 25, skip: true, when: now - 10 * DAY }] },
    { correctItems: [{ surah: 2, ayah: 25, when: now - 9 * DAY }, { surah: 2, ayah: 25, when: now - 2 * DAY, ...(ease ? { ease } : {}) }] },
  ];
  it('easy pushes the next review further, hard brings it closer', () => {
    // two right answers after the mistake ⇒ step 2 (3 days) for good; easy ⇒ step 3 (7 days); hard ⇒ step 1 (1 day)
    expect(dueReviews(sess(), { now })).toHaveLength(0);           // 2 days < 3
    expect(dueReviews(sess('easy'), { now })).toHaveLength(0);     // 2 days < 7
    expect(dueReviews(sess('hard'), { now })).toHaveLength(1);     // 2 days ≥ 1
    expect(reviewStep({ correctAfter: 1, lastEase: 'hard' })).toBe(1);
  });
});

describe('604-page map', () => {
  it('juz boundaries match the page structure', () => {
    const at = pageIndex(pages);
    expect(at.get('2:142')).toBe(JUZ_START[1]);
    expect(at.get('78:1')).toBe(JUZ_START[29]);
    expect(juzOfPage(1)).toBe(1); expect(juzOfPage(21)).toBe(1); expect(juzOfPage(22)).toBe(2); expect(juzOfPage(604)).toBe(30);
  });
  it('colours pages: none / solid / due', () => {
    const now = 100 * DAY;
    const sessions = [
      { correctItems: [{ surah: 1, ayah: 1, when: now - DAY }] },                         // page 1 solid
      { wrongItems: [{ surah: 2, ayah: 6, skip: true, when: now - 2 * DAY }] },          // page 3 due (no right answer since)
    ];
    const { status, counts } = pageProgress(sessions, pages, { now });
    expect(status).toHaveLength(604);
    expect(status[0]).toBe('solid');
    expect(status[1]).toBe('none');
    expect(status[2]).toBe('due');
    expect(counts).toEqual({ none: 602, due: 1, learning: 0, solid: 1 });
  });
});
