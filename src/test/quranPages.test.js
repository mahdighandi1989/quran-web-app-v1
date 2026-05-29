// Validates the generated 604-page Quran layout (task 173fd615). The previous
// QURAN_PAGE_STRUCTURE_DEFAULT shipped only 5 of 604 pages, so most pages were
// un-browsable. This locks in completeness + structural correctness of the dataset.
import { describe, it, expect } from 'vitest';
import pages from '../data/quranPages.json';

describe('Quran page structure (src/data/quranPages.json)', () => {
  it('contains all 604 pages, contiguously numbered 1..604', () => {
    expect(pages).toHaveLength(604);
    pages.forEach((p, i) => expect(p.page).toBe(i + 1));
  });

  it('covers exactly the 6236 ayahs of the Quran', () => {
    const total = pages.reduce(
      (n, p) => n + p.surahs.reduce((m, s) => m + s.ayahs.length, 0), 0,
    );
    expect(total).toBe(6236);
  });

  it('every page has a well-formed, non-empty surahs array', () => {
    for (const p of pages) {
      expect(Array.isArray(p.surahs)).toBe(true);
      expect(p.surahs.length).toBeGreaterThan(0);
      for (const s of p.surahs) {
        expect(typeof s.surah).toBe('number');
        expect(s.surah).toBeGreaterThanOrEqual(1);
        expect(s.surah).toBeLessThanOrEqual(114);
        expect(typeof s.surah_name).toBe('string');
        expect(s.surah_name.length).toBeGreaterThan(0);
        expect(Array.isArray(s.ayahs)).toBe(true);
        expect(s.ayahs.length).toBeGreaterThan(0);
        s.ayahs.forEach((a, i) => {
          expect(a).toBeGreaterThanOrEqual(1);
          if (i > 0) expect(a).toBeGreaterThan(s.ayahs[i - 1]); // strictly ascending
        });
      }
    }
  });

  it('references every surah 1..114 across the dataset', () => {
    const seen = new Set();
    for (const p of pages) for (const s of p.surahs) seen.add(s.surah);
    expect(seen.size).toBe(114);
    for (let n = 1; n <= 114; n++) expect(seen.has(n)).toBe(true);
  });

  it('matches known Madani Mushaf page boundaries', () => {
    expect(pages[0]).toEqual({
      page: 1, surahs: [{ surah: 1, surah_name: 'الفاتحة', ayahs: [1, 2, 3, 4, 5, 6, 7] }],
    });
    expect(pages[1].surahs[0]).toMatchObject({ surah: 2, ayahs: [1, 2, 3, 4, 5] });
    expect(pages[603].surahs.map((s) => s.surah)).toEqual([112, 113, 114]);
  });
});
