// Sheet 5-۴: «آیهٔ بعدی کدام است؟»، «آیهٔ قبلی؟»، «این آیه در کدام صفحه/جزء؟»
import { describe, it, expect } from 'vitest';
import { buildHafizQuestion, HAFIZ_MCQ_TYPES, isHafizMcqType, snippet } from '../lib/mcqHafiz.js';

const ay = (s, a, words, page = 1, juz = 1) => ({ surah_number: s, ayah_number: a, surah_name: `س${s}`, page, juz, tokens_with_diacritics: words.split(' '), tokens_plain: words.split(' ') });
const dataset = [
  ay(1, 1, 'بسم الله الرحمن الرحيم'), ay(1, 2, 'الحمد لله رب العالمين'), ay(1, 3, 'الرحمن الرحيم'), ay(1, 4, 'مالك يوم الدين'),
  ay(1, 5, 'اياك نعبد واياك نستعين'), ay(1, 6, 'اهدنا الصراط المستقيم'), ay(1, 7, 'صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين'),
  ay(2, 1, 'الم', 2), ay(2, 2, 'ذلك الكتاب لا ريب فيه هدى للمتقين', 2),
];
const same = (a) => [...a]; // no shuffling: deterministic

describe('hafiz multiple-choice types', () => {
  it('lists four types', () => {
    expect(HAFIZ_MCQ_TYPES.map((t) => t.id)).toEqual(['next_ayah', 'prev_ayah', 'page', 'juz']);
    expect(isHafizMcqType('page')).toBe(true);
    expect(isHafizMcqType('surah_name')).toBe(false);
  });

  it('next ayah: the answer is the following ayah of the same surah, with three different wrong ones', () => {
    for (let i = 0; i < 20; i++) {
      const q = buildHafizQuestion(dataset[3], 'next_ayah', dataset);
      expect(q.options[q.correctIndex]).toBe('اياك نعبد واياك نستعين');
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).not.toContain('مالك يوم الدين'); // the asked ayah is never an option
      expect(q.key).toBe('1:4');
      expect(q.questionDisplay).toBe('مالك يوم الدين');
    }
  });

  it('previous ayah', () => {
    const q = buildHafizQuestion(dataset[3], 'prev_ayah', dataset, { shuffle: same });
    expect(q.options[q.correctIndex]).toBe('الرحمن الرحيم');
    expect(q.questionText).toMatch(/قبل/);
  });

  it('cannot be asked at the edge of a surah — skipped, not invented', () => {
    expect(buildHafizQuestion(dataset[6], 'next_ayah', dataset)).toBeNull(); // 1:7 is the last ayah
    expect(buildHafizQuestion(dataset[0], 'prev_ayah', dataset)).toBeNull(); // 1:1 is the first
  });

  it('an ayah that reads like the answer is not offered as a wrong option', () => {
    const rep = [ay(55, 12, 'ا ب'), ay(55, 13, 'فباي الاء ربكما تكذبان'), ay(55, 14, 'ج د'), ay(55, 15, 'ه و'), ay(55, 16, 'فباي الاء ربكما تكذبان'), ay(55, 17, 'ز ح')];
    for (let i = 0; i < 20; i++) {
      const q = buildHafizQuestion(rep[0], 'next_ayah', rep);
      expect(q.options.filter((o) => o === 'فباي الاء ربكما تكذبان')).toHaveLength(1);
    }
  });

  it('too few ayahs to make three wrong options ⇒ null', () => {
    expect(buildHafizQuestion(dataset[0], 'next_ayah', dataset.slice(0, 3))).toBeNull();
  });

  it('page: the right page among neighbouring pages, in ascending order, inside 1…604', () => {
    const q = buildHafizQuestion(ay(7, 138, 'x y z', 167, 9), 'page', dataset, { toAr: (n) => `#${n}` });
    expect(q.options[q.correctIndex]).toBe('صفحهٔ #167');
    const nums = q.options.map((o) => Number(o.split('#')[1]));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(new Set(nums).size).toBe(4);
    nums.forEach((n) => { expect(Math.abs(n - 167)).toBeLessThanOrEqual(3); });
    const edge = buildHafizQuestion(ay(114, 1, 'x y', 604, 30), 'page', dataset);
    edge.options.forEach((o) => expect(Number(o.replace(/\D/g, ''))).toBeLessThanOrEqual(604));
    const first = buildHafizQuestion(ay(1, 1, 'x y', 1, 1), 'page', dataset);
    first.options.forEach((o) => expect(Number(o.replace(/\D/g, ''))).toBeGreaterThanOrEqual(1));
  });

  it('juz stays inside 1…30; a missing page/juz number ⇒ null', () => {
    const q = buildHafizQuestion(ay(78, 1, 'x y', 582, 30), 'juz', dataset);
    expect(q.options[q.correctIndex]).toBe('جزء 30');
    q.options.forEach((o) => expect(Number(o.replace(/\D/g, ''))).toBeLessThanOrEqual(30));
    expect(buildHafizQuestion({ ...ay(2, 5, 'x y'), page: undefined }, 'page', dataset)).toBeNull();
    expect(buildHafizQuestion({ ...ay(2, 5, 'x y'), juz: 0 }, 'juz', dataset)).toBeNull();
  });

  it('a long ayah is cut to its opening words on the button', () => {
    expect(snippet(dataset[6])).toBe('صراط الذين انعمت عليهم غير المغضوب عليهم ولا …');
    expect(snippet(dataset[3])).toBe('مالك يوم الدين');
  });
});
