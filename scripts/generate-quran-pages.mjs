// Regenerates src/data/quranPages.json — the full 604-page Madani Mushaf (Hafs) page
// layout — from the `quran-meta` dataset (authoritative Hafs riwaya).
//
// Output shape matches the app's QURAN_PAGE_STRUCTURE format:
//   [{ page: 1, surahs: [{ surah: 1, surah_name: "الفاتحة", ayahs: [1,..,7] }] }, ...]
//
// Surah names are stored without diacritics to match the app's existing convention.
// Run:  node scripts/generate-quran-pages.mjs
import { createHafs } from 'quran-meta';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const hafs = createHafs();
const { numPages, numAyahs } = hafs.meta;

// Remove Arabic harakat/tatweel so names match the app's existing data style.
const stripDiacritics = (s) =>
  String(s).normalize('NFC').replace(/[ً-ْٰـ]/g, '');

// page -> (surah -> ayahs[]). Iterating ayahId in order keeps surahs/ayahs ordered.
const pagesMap = new Map();
for (let ayahId = 1; ayahId <= numAyahs; ayahId++) {
  const page = hafs.findPagebyAyahId(ayahId);
  const [surah, ayah] = hafs.findSurahAyahByAyahId(ayahId);
  if (!pagesMap.has(page)) pagesMap.set(page, new Map());
  const surahMap = pagesMap.get(page);
  if (!surahMap.has(surah)) surahMap.set(surah, []);
  surahMap.get(surah).push(ayah);
}

const structure = [];
for (let page = 1; page <= numPages; page++) {
  const surahMap = pagesMap.get(page);
  if (!surahMap) throw new Error(`Missing data for page ${page}`);
  const surahs = [];
  for (const [surah, ayahs] of surahMap) {
    surahs.push({
      surah,
      surah_name: stripDiacritics(hafs.getSurahMeta(surah).name),
      ayahs,
    });
  }
  structure.push({ page, surahs });
}

mkdirSync(resolve(here, '../src/data'), { recursive: true });
writeFileSync(
  resolve(here, '../src/data/quranPages.json'),
  JSON.stringify(structure, null, 2) + '\n',
);
const totalAyahs = structure.reduce(
  (n, p) => n + p.surahs.reduce((m, s) => m + s.ayahs.length, 0), 0,
);
console.log(`Wrote ${structure.length} pages, ${totalAyahs} ayahs to src/data/quranPages.json`);
