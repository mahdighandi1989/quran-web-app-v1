// Proactive notification scheduler — the missing "event → notify_event" brain of the
// notification pipeline.
//
// WHY THIS EXISTS (the coherence fix):
//   • src/lib/appStateStore.js  -> PERSISTS a compact app-state summary (it never decides
//     *when* to notify; its job is mirroring data to Firestore).
//   • src/lib/telegramCommands.js -> REACTIVE responder: it answers commands the user sends
//     (pull). It never originates a message on its own.
//   • src/lib/telegram.js -> the OUTBOUND transport: notify()/shouldNotify()/sendMessage()
//     know HOW to send and WHETHER a type is enabled, but not WHICH application events are
//     happening right now.
// Nothing connected "an application event happened" to "send the matching notification". That
// logic lived ad-hoc and duplicated inside src/App.jsx (session-end, reminders, daily goal) and
// server/telegram-bot.mjs (reminderTick: reminders + daily summary). This module is the single,
// testable home for that decision so both the in-app effect loop and the server scheduler can
// share one definition of the proactive rules.
//
// DESIGN: every rule is a PURE function (event detection) layered over telegram.js's existing
// shouldNotify()/notify() (the ground truth for "is this type enabled + are there recipients").
// The stateful scheduler is a thin factory that injects time + transport, so unit tests run with
// zero network and a fixed clock. It does NOT modify appStateStore.js or telegramCommands.js —
// it only READS the app-state summary they/the app produce and CALLS the existing notify().

import { notify as defaultNotify, shouldNotify, buildSessionEndMessage } from './telegram.js';

const DAY = 24 * 60 * 60 * 1000;

/* ----------------------------- time helpers (pure) ---------------------------- */
// Local "HH:MM" + a "YYYY-MM-DD" day key for a given instant, shifted by the user's tz offset
// (minutes to ADD to UTC). Mirrors the server's localHHMMAndDay so reminders fire at the user's
// local wall-clock time even when the app is closed and the server runs in UTC.
export function localHHMMAndDay(nowMs, tzOffsetMinutes) {
  const off = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  const local = new Date(nowMs + off * 60000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const day = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  return { hhmm: `${hh}:${mm}`, day };
}

/* ------------------------------ message builders ------------------------------ */
// Daily-summary text from the mirrored app-state summary (kept in sync with the server's
// buildDailySummaryText so the in-app path and the 24/7 server path read identically).
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

/* --------------------------- event detection (pure) --------------------------- */
// Each detector returns a NotificationEvent: { kind, type, text, dedupKey } or null.
//   kind     -> the application event ('session_complete' | 'daily_goal' | 'reminder' | 'daily_summary')
//   type     -> the telegram.js notification TYPE used by shouldNotify()/notify()
//   text     -> the message body
//   dedupKey -> stable key so the same event fires at most once (per session / per day / etc.)

// Session finished (practice or exam). Reuses telegram.js's buildSessionEndMessage so the
// message + the session_complete/exam_result split stay defined in exactly one place.
export function detectSessionComplete(session) {
  if (!session) return null;
  const { type, text } = buildSessionEndMessage(session);
  // A session is identified by its end time (falling back to start, then a content hash) so the
  // same finished session never notifies twice if tick() and an explicit trigger both see it.
  const stamp = session.end || session.start || 0;
  const dedupKey = `session:${session.id || stamp}`;
  return { kind: 'session_complete', type, text, dedupKey };
}

// Today's graded count crossed the daily goal -> a once-per-day congratulation. Reported under
// the daily_summary type (the closest existing, user-toggleable proactive category). doneToday
// is derived purely from the app-state summary's sessions.today (correct + wrong), and the goal
// comes from the telegram config (set via /goal) — no dependency on App's local settings.
export function detectDailyGoalReached({ appState, dailyGoal, day }) {
  const goal = Number(dailyGoal);
  if (!goal || goal < 1) return null;
  const today = appState && appState.sessions && appState.sessions.today;
  if (!today) return null;
  const doneToday = (today.correct || 0) + (today.wrong || 0);
  if (doneToday < goal) return null;
  return {
    kind: 'daily_goal',
    type: 'daily_summary',
    text: buildGoalReachedText(doneToday, goal),
    dedupKey: `goal:${day}`,
  };
}

// Per-time reminders due at the current local minute. Honors each reminder's own enabled flag
// and the doc-level lastFiredDay (set when the server already fired it today). Returns a LIST.
export function detectDueReminders({ config, hhmm, day }) {
  const reminders = Array.isArray(config && config.reminders) ? config.reminders : [];
  const out = [];
  for (const r of reminders) {
    if (!r || r.enabled === false) continue;
    if (r.time !== hhmm) continue;
    if (r.lastFiredDay === day) continue; // already sent by the server today
    out.push({
      kind: 'reminder',
      type: 'reminder',
      text: `⏰ یادآوری: ${r.text}`,
      dedupKey: `reminder:${r.id || r.text}:${day}`,
      reminderId: r.id,
    });
  }
  return out;
}

// Daily summary at the user's configured local time (once per day). dailySummaryDay on the doc
// is the server's once-per-day guard; we respect it too.
export function detectDailySummaryDue({ config, appState, hhmm, day }) {
  if (!config || !config.dailySummaryTime) return null;
  if (config.dailySummaryTime !== hhmm) return null;
  if (config.dailySummaryDay === day) return null;
  return {
    kind: 'daily_summary',
    type: 'daily_summary',
    text: buildDailySummaryText(appState),
    dedupKey: `summary:${day}`,
  };
}

// Collect every time/state-driven event that is due at `nowMs` (everything EXCEPT session
// completion, which is event-driven and pushed in via the scheduler's trigger). Pure: given the
// same inputs it always returns the same events, which makes the whole pipeline unit-testable.
export function collectDueEvents({ config, appState, nowMs }) {
  if (!config) return [];
  const { hhmm, day } = localHHMMAndDay(nowMs, config.tzOffsetMinutes);
  const events = [];
  const goal = detectDailyGoalReached({ appState, dailyGoal: config.dailyGoal, day });
  if (goal) events.push(goal);
  events.push(...detectDueReminders({ config, hhmm, day }));
  const summary = detectDailySummaryDue({ config, appState, hhmm, day });
  if (summary) events.push(summary);
  return events;
}

/* ------------------------------ the scheduler --------------------------------- */
// Factory that wires the pure rules to live data + the real transport. Dependency-injected so
// tests can pass a fake clock and a spy notify().
//
//   getConfig()    -> latest telegram config (DEFAULT_TELEGRAM shape)
//   getAppState()  -> latest mirrored app-state summary (buildAppStateSummary output) or null
//   notify()       -> telegram.js notify(tg, type, text) (overridable for tests)
//   now()          -> () => ms epoch (overridable for tests; defaults to Date.now)
//   onReminderFired(id, day) -> optional persistence hook (e.g. set reminder.lastFiredDay)
//
// Returns { tick, notifySessionComplete, start, stop, _fired } where:
//   tick()                 -> evaluate + dispatch all currently-due time/state events (idempotent
//                             within the same day thanks to in-memory + doc-level dedup).
//   notifySessionComplete(session) -> dispatch the event-driven session-end notification.
//   start(intervalMs)/stop() -> run tick() on an interval (no-op-safe to call repeatedly).
export function createNotificationScheduler({
  getConfig,
  getAppState,
  notify = defaultNotify,
  now = () => Date.now(),
  onReminderFired,
} = {}) {
  const fired = new Set(); // in-memory dedup of dispatched dedupKeys
  let timer = null;
  let stopped = false;

  // Drop dedup keys that are not for "today" so the Set cannot grow unbounded across days.
  function pruneFired(day) {
    for (const k of fired) {
      // keys ending in a day stamp: reminder:<id>:<day>, goal:<day>, summary:<day>
      const m = k.match(/:(\d{4}-\d{2}-\d{2})$/);
      if (m && m[1] !== day) fired.delete(k);
    }
  }

  // Dispatch one event if it is enabled (shouldNotify) and not already fired. Returns true if a
  // send was attempted. Never throws (network failures are swallowed like the rest of the app).
  async function dispatch(config, event) {
    if (!event) return false;
    if (fired.has(event.dedupKey)) return false;
    if (!shouldNotify(config, event.type)) return false;
    fired.add(event.dedupKey);
    try {
      await notify(config, event.type, event.text);
      if (event.kind === 'reminder' && event.reminderId != null && onReminderFired) {
        try { onReminderFired(event.reminderId, event.dedupKey.split(':').pop()); } catch { /* ignore */ }
      }
      return true;
    } catch {
      return false; // best-effort; a failed send should not crash the scheduler
    }
  }

  async function tick() {
    const config = getConfig ? getConfig() : null;
    if (!config || !config.enabled || !config.botToken) return [];
    const appState = getAppState ? getAppState() : null;
    const nowMs = now();
    const { day } = localHHMMAndDay(nowMs, config.tzOffsetMinutes);
    pruneFired(day);
    const events = collectDueEvents({ config, appState, nowMs });
    const dispatched = [];
    for (const ev of events) {
      // eslint-disable-next-line no-await-in-loop
      if (await dispatch(config, ev)) dispatched.push(ev.kind);
    }
    return dispatched;
  }

  async function notifySessionComplete(session) {
    const config = getConfig ? getConfig() : null;
    if (!config || !config.enabled || !config.botToken) return false;
    return dispatch(config, detectSessionComplete(session));
  }

  function start(intervalMs = 30000) {
    if (timer || stopped) return stop;
    const loop = () => {
      if (stopped) return;
      tick().catch(() => {});
    };
    timer = setInterval(loop, intervalMs);
    return stop;
  }

  function stop() {
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
  }

  return { tick, notifySessionComplete, start, stop, _fired: fired };
}

export default createNotificationScheduler;
