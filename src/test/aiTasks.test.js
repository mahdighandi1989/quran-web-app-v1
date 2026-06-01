import { describe, it, expect } from 'vitest';
import { tafsirPrompt, hifzPrompt, qaPrompt, examGenPrompt, parseJsonArray } from '../lib/aiTasks.js';

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
