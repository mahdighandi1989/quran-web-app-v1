// Dedicated caption (message-content) generator for PROACTIVE notifications.
//
// WHY THIS EXISTS (the coherence fix):
//   inconsistency identified: src/lib/telegramCommands.js generates reply text (captions) for
//   REACTIVE user commands (pull), but there was NO explicit component that generates the
//   content/caption of PROACTIVE, system-originated notifications (push) — "your daily review is
//   due", "session completed summary", "daily goal reached". That "caption" step of the pipeline
//   was only partially covered: each proactive trigger built its message inline, which would lead
//   to duplicated, drifting wording the moment a second producer (the 24/7 server) appears.
//   assumptions documented:
//     • Side A (telegramCommands.js): "captions are produced per inbound command".
//     • Side B (the proactive scheduler): had no caption owner and was building text ad-hoc.
//   ground truth: this module is the single caption generator for proactive notifications. It is
//   PURE and delegates the actual wording to the shared rules in notificationRules.js (and to
//   telegram.js#buildSessionEndMessage for the session-end split) so the in-app scheduler and the
//   server scheduler emit byte-identical captions and can never drift. The notification triggering
//   logic (notificationScheduler.js) DELEGATES caption building here instead of inlining it.
//
// A caption is built from a normalized ProactiveEvent context:
//   { kind, session?, appState?, dailyGoal?, doneToday?, reminderText? }
// and returns the message body string. `formatProactiveNotification()` additionally resolves the
// telegram notification TYPE + criticality so a caller has everything needed to dispatch.

import {
  buildDailySummaryText,
  buildGoalReachedText,
  buildReminderText,
} from './notificationRules.js';
import { buildSessionEndMessage, getNotificationCriticality } from './telegram.js';

// The proactive event kinds this formatter knows how to caption.
export const PROACTIVE_KINDS = ['session_complete', 'daily_goal', 'reminder', 'daily_summary'];

// Build ONLY the caption (message body) for a proactive event. Pure; returns '' for an unknown
// kind so a malformed event can never crash the scheduler.
export function buildProactiveCaption(event) {
  if (!event || !event.kind) return '';
  switch (event.kind) {
    case 'session_complete':
      // Reuse the shared session-end builder so the practice/exam wording lives in one place.
      return buildSessionEndMessage(event.session).text;
    case 'daily_goal':
      return buildGoalReachedText(event.doneToday, event.dailyGoal);
    case 'reminder':
      return buildReminderText(event.reminderText);
    case 'daily_summary':
      return buildDailySummaryText(event.appState);
    default:
      return '';
  }
}

// Map a proactive event kind to the telegram notification TYPE used by shouldNotify()/notify().
// session_complete is special: a graded EXAM is reported under exam_result (decided by the shared
// buildSessionEndMessage), everything else maps 1:1.
export function proactiveType(event) {
  if (!event || !event.kind) return null;
  if (event.kind === 'session_complete') return buildSessionEndMessage(event.session).type;
  if (event.kind === 'daily_goal') return 'daily_summary'; // closest user-toggleable category
  return event.kind; // 'reminder' | 'daily_summary'
}

// Full proactive-notification descriptor: { kind, type, text, criticality }. The single helper a
// trigger needs — it generates the caption AND resolves where/how it should be sent.
export function formatProactiveNotification(event) {
  const type = proactiveType(event);
  return {
    kind: event && event.kind,
    type,
    text: buildProactiveCaption(event),
    criticality: getNotificationCriticality(type),
  };
}

export default buildProactiveCaption;
