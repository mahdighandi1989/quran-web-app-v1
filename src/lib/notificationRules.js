// Shared, pure notification RULES — the single source of truth for the proactive notification
// pipeline's time math + message text.
//
// WHY THIS EXISTS (the coherence fix):
//   The proactive "event -> notify_event" logic runs in TWO independent tiers:
//     • the browser app  -> src/lib/notificationScheduler.js  (in-app effect loop, fires while
//       the tab is open)
//     • the 24/7 server  -> server/telegram-bot.mjs::reminderTick (fires even when the app is
//       closed, on a 60s interval)
//   Both decide WHEN to send and WHAT text to send. Previously each tier kept its OWN copy of
//   localHHMMAndDay() / buildDailySummaryText() and the reminder-text format, "kept in sync"
//   only by hand + comments. That is a textbook coherence bug: a change to one side (e.g. the
//   daily-summary wording, the day-key format, or the tz math) silently drifts from the other,
//   so the same user gets two DIFFERENT messages depending on which tier fired — and no unit
//   test catches it because each tier is tested in its own silo.
//
//   This module is the GROUND TRUTH. Both tiers import these functions instead of redefining
//   them, so drift becomes structurally impossible. It has ZERO dependencies and NO side
//   effects, so it is safe to import from the browser bundle AND from the Node server.

export const DAY = 24 * 60 * 60 * 1000;

// Local "HH:MM" + a "YYYY-MM-DD" day key for a given instant, shifted by the user's tz offset
// (minutes to ADD to UTC). Reminders fire at the user's local wall-clock time even when the app
// is closed and the server runs in UTC. The caller passes `nowMs` so the function stays pure and
// unit-testable with a fixed clock (the server passes Date.now()).
export function localHHMMAndDay(nowMs, tzOffsetMinutes) {
  const off = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  const local = new Date(nowMs + off * 60000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const day = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  return { hhmm: `${hh}:${mm}`, day };
}

// Daily-summary text from the mirrored app-state summary (buildAppStateSummary output). Read
// identically by the in-app path and the 24/7 server path.
export function buildDailySummaryText(appState) {
  const s = appState && appState.sessions;
  const t = s && s.today;
  const head = '🌅 <b>خلاصهٔ روزانه</b>';
  if (!s) return head + '\nهنوز داده‌ای ثبت نشده. امروز یک تمرین کوتاه را شروع کن! 🌿';
  const todayLine = t ? `امروز: ${t.sessions} جلسه • ${t.correct} درست / ${t.wrong} غلط` : 'امروز هنوز جلسه‌ای ثبت نشده.';
  return head + `\n${todayLine}\nدقت کلی: ${s.accuracyPct ?? 0}% • جلسات ۷ روز اخیر: ${s.last7Days ?? 0}\nیک تمرین تازه را همین حالا شروع کن. 💪`;
}

// Goal-reached text when today's graded count crosses the daily goal.
export function buildGoalReachedText(doneToday, goal) {
  return `🎯 <b>هدف امروز محقق شد!</b>\nامروز ${doneToday} مورد تمرین کردی (هدف: ${goal}). آفرین — ادامه بده! 🌟`;
}

// Per-time reminder text. The format must be identical on both tiers so a reminder reads the
// same whether the in-app loop or the server scheduler delivered it.
export function buildReminderText(reminderText) {
  return `⏰ یادآوری: ${reminderText}`;
}
