import { describe, it, expect } from 'vitest';
import { buildCommandReply, searchDataset, topMistakeCards, BOT_VERSION } from '../lib/telegramCommands.js';

const state = {
  dataset: { ayahs: 6236 }, pages: 604, flagged: 2,
  sessions: { total: 5, accuracyPct: 80, totalCorrect: 8, totalWrong: 2, last7Days: 3,
    today: { sessions: 1, correct: 4, wrong: 1 } },
};

describe('buildCommandReply (in-app Telegram responder)', () => {
  it('ignores empty input', () => {
    expect(buildCommandReply('', { appState: state })).toBeNull();
  });

  it('answers /status (command and menu label) with real numbers', () => {
    for (const t of ['/status', '📊 وضعیت']) {
      const r = buildCommandReply(t, { appState: state });
      expect(r.text).toContain('وضعیت برنامه');
      expect(r.text).toContain('6236');
      expect(r.menu).toBe(true);
    }
  });

  it('answers /progress and /today', () => {
    expect(buildCommandReply('📈 پیشرفت', { appState: state }).text).toContain('دقت کلی: 80%');
    expect(buildCommandReply('🗓 امروز', { appState: state }).text).toContain('خلاصهٔ امروز');
  });

  it('parses /remind and returns an addReminder payload', () => {
    const r = buildCommandReply('/remind 08:30 مرور صبح', { appState: state });
    expect(r.addReminder).toEqual({ time: '08:30', text: 'مرور صبح' });
    expect(r.text).toContain('یادآوری ثبت شد');
  });

  it('rejects a malformed /remind without an addReminder', () => {
    const r = buildCommandReply('/remind بدون‌زمان', { appState: state });
    expect(r.addReminder).toBeUndefined();
    expect(r.text).toContain('قالب درست');
  });

  it('handles /start and /help and unknown input', () => {
    expect(buildCommandReply('/start', {}).text).toContain('خوش آمدید');
    expect(buildCommandReply('❓ راهنما', {}).text).toContain('دستورها');
    expect(buildCommandReply('بلابلا', {}).text).toContain('ناشناخته');
  });

  it('degrades gracefully when there is no app state', () => {
    expect(buildCommandReply('/status', {}).text).toContain('هنوز داده‌ای');
    expect(buildCommandReply('/progress', {}).text).toContain('هنوز پیشرفتی');
  });
});

const dataset = [
  { surah_number: 2, ayah_number: 255, surah_name: 'البقرة', tokens_with_diacritics: ['اللَّهُ', 'لَا', 'إِلَٰهَ', 'إِلَّا', 'هُوَ'], tokens_plain: ['الله', 'لا', 'اله', 'الا', 'هو'] },
  { surah_number: 1, ayah_number: 1, surah_name: 'الفاتحة', tokens_plain: ['بسم', 'الله', 'الرحمن', 'الرحيم'] },
];

describe('buildCommandReply (new commands)', () => {
  it('/version reports the build tag', () => {
    expect(buildCommandReply('/version', {}).text).toContain(BOT_VERSION);
  });

  it('/search with a query returns matching ayahs synchronously (no defer)', () => {
    const r = buildCommandReply('/search 2:255', { dataset });
    expect(r.defer).toBeUndefined();
    expect(r.text).toContain('البقرة');
    expect(r.text).toContain('اللَّهُ');
  });

  it('/search by text matches the (normalized) ayah body', () => {
    const r = buildCommandReply('/search الرحمن', { dataset });
    expect(r.text).toContain('الفاتحة');
  });

  it('bare /search (and the menu button) defers to await a follow-up', () => {
    expect(buildCommandReply('/search', { dataset }).defer).toBe('search-await');
    expect(buildCommandReply('🔎 جستجو', { dataset }).defer).toBe('search-await');
  });

  it('/goal sets the daily goal (clamped) and rejects junk', () => {
    const ok = buildCommandReply('/goal 30', {});
    expect(ok.setGoal).toBe(30);
    expect(ok.text).toContain('هدف روزانه');
    const bad = buildCommandReply('/goal abc', {});
    expect(bad.setGoal).toBeUndefined();
    expect(bad.text).toContain('قالب');
  });

  it('/notif toggles a notification type via patchConfig', () => {
    const r = buildCommandReply('/notif exam_result off', {});
    expect(r.patchConfig.notifications.exam_result.enabled).toBe(false);
    expect(r.text).toContain('خاموش');
    expect(buildCommandReply('/notif nope on', {}).text).toContain('قالب');
  });

  it('interactive/AI commands defer to the responder (commands + menu labels)', () => {
    expect(buildCommandReply('/practice', { dataset }).defer).toBe('practice');
    expect(buildCommandReply('📝 تمرین', { dataset }).defer).toBe('practice');
    expect(buildCommandReply('🔁 مرور اشتباهات', { dataset }).defer).toBe('review');
    expect(buildCommandReply('✨ تفسیر', { dataset }).defer).toBe('tafsir');
    expect(buildCommandReply('🧠 حفظ', { dataset }).defer).toBe('hifz');
    expect(buildCommandReply('💬 پرسش', { dataset }).defer).toBe('ask-await');
    const ask = buildCommandReply('/ask معنی توکل چیست؟', { dataset });
    expect(ask.defer).toBe('ask');
    expect(ask.query).toContain('توکل');
  });
});

describe('searchDataset / topMistakeCards', () => {
  it('finds an ayah by surah:ayah and by text, ignores empty', () => {
    expect(searchDataset(dataset, '2:255')[0]).toMatchObject({ s: 2, a: 255, n: 'البقرة' });
    expect(searchDataset(dataset, 'الرحمن').some((c) => c.s === 1)).toBe(true);
    expect(searchDataset(dataset, '')).toEqual([]);
  });

  it('ranks most-mistaken ayahs first, with ayah text', () => {
    const sessions = [{ wrongItems: [{ surah: 2, ayah: 255 }, { surah: 2, ayah: 255 }, { surah: 1, ayah: 1 }] }];
    const tm = topMistakeCards(dataset, sessions);
    expect(tm[0]).toMatchObject({ s: 2, a: 255, wrong: 2 });
    expect(tm[0].full).toContain('اللَّهُ');
    expect(tm.length).toBe(2);
  });
});
