import { describe, it, expect } from 'vitest';
import { tafsirPrompt, hifzPrompt, qaPrompt, examGenPrompt, parseJsonArray, validateExamQuestions } from '../lib/aiTasks.js';

describe('AI task prompts', () => {
  it('tafsirPrompt embeds surah/ayah/text and asks for a structured answer', () => {
    const p = tafsirPrompt({ surahName: 'الفاتحة', ayahNumber: 2, ayahText: 'الحمد لله' });
    expect(p.system).toContain('قرآن');
    expect(p.user).toContain('الفاتحة');
    expect(p.user).toContain('الحمد لله');
    expect(p.maxTokens).toBeGreaterThan(0);
  });
  it('hifzPrompt includes memorization guidance', () => {
    const p = hifzPrompt({ surahName: 'البقرة', ayahNumber: 255, ayahText: 'الله لا اله الا هو' });
    expect(p.user).toContain('حفظ');
    expect(p.user).toContain('البقرة');
  });
  it('qaPrompt passes the question through', () => {
    const p = qaPrompt({ question: 'معنی تقوا چیست؟' });
    expect(p.user).toBe('معنی تقوا چیست؟');
  });
  it('examGenPrompt requests strict JSON and lists ayahs', () => {
    const p = examGenPrompt({ ayahs: [{ surah: 1, ayah: 1, text: 'بسم الله' }], count: 3, type: 'mcq' });
    expect(p.user).toContain('JSON');
    expect(p.user).toContain('بسم الله');
    expect(p.system).toContain('JSON');
  });
});

describe('parseJsonArray', () => {
  it('parses a clean JSON array', () => {
    expect(parseJsonArray('[{"q":"x","answer":0}]')).toEqual([{ q: 'x', answer: 0 }]);
  });
  it('extracts from json fences', () => {
    expect(parseJsonArray('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });
  it('extracts an array embedded in prose', () => {
    expect(parseJsonArray('در اینجا: [{"a":2}] پایان')).toEqual([{ a: 2 }]);
  });
  it('returns [] for unparseable input', () => {
    expect(parseJsonArray('نه جیسون')).toEqual([]);
    expect(parseJsonArray('')).toEqual([]);
  });
});

describe('validateExamQuestions', () => {
  it('returns the array for valid mcq questions', () => {
    const qs = [{ q: 'صورت سوال', choices: ['۱', '۲', '۳', '۴'], answer: 2, ref: '1:1' }];
    expect(validateExamQuestions(qs, { type: 'mcq' })).toBe(qs);
  });
  it('returns the array for valid fill questions', () => {
    const qs = [{ q: 'جای ___ خالی', answer: 'کلمه', ref: '1:1' }];
    expect(validateExamQuestions(qs, { type: 'fill' })).toBe(qs);
  });
  it('throws on empty or non-array input', () => {
    expect(() => validateExamQuestions([], { type: 'mcq' })).toThrow();
    expect(() => validateExamQuestions(null, { type: 'mcq' })).toThrow();
    expect(() => validateExamQuestions('x', { type: 'mcq' })).toThrow();
  });
  it('throws when a question is missing q', () => {
    expect(() => validateExamQuestions([{ choices: ['a', 'b'], answer: 0 }], { type: 'mcq' })).toThrow(/q/);
  });
  it('throws when an mcq question is missing choices', () => {
    expect(() => validateExamQuestions([{ q: 'x', answer: 0 }], { type: 'mcq' })).toThrow(/choices/);
  });
  it('throws when the mcq answer index is invalid', () => {
    expect(() => validateExamQuestions([{ q: 'x', choices: ['a', 'b'], answer: 5 }], { type: 'mcq' })).toThrow();
    expect(() => validateExamQuestions([{ q: 'x', choices: ['a', 'b'], answer: '0' }], { type: 'mcq' })).toThrow();
  });
  it('throws when a fill question is missing answer', () => {
    expect(() => validateExamQuestions([{ q: 'x' }], { type: 'fill' })).toThrow();
    expect(() => validateExamQuestions([{ q: 'x', answer: '  ' }], { type: 'fill' })).toThrow();
  });
  it('defaults to mcq validation', () => {
    expect(() => validateExamQuestions([{ q: 'x' }])).toThrow(/choices/);
  });
});
