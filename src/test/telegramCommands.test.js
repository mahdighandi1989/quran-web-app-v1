import { describe, it, expect } from 'vitest';
import { buildCommandReply } from '../lib/telegramCommands.js';

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
