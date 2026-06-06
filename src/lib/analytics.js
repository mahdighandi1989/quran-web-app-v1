// Engagement analytics — the instrumentation layer behind the product's headline KPI:
// **unique daily interactions**. Before this module existed the app initialised Firebase
// Analytics (see firebase.js) but never logged a single custom event, so real usage was
// invisible: "interactions" could not be counted, let alone improved. That measurement gap
// is the root cause of the "Low User Engagement and Adoption" finding — you cannot move a
// number you do not record.
//
// This module does two complementary things for every meaningful user action:
//   1. Forwards it to the production analytics sink (Firebase Analytics `logEvent`) so the
//      outcome rate is observable in the Firebase console / GA4.
//   2. Records it in a local, per-day ledger (localStorage) so the same outcome can be
//      measured in tests and surfaced in-app (the engagement nudge / stats) without any
//      server round-trip.
//
// Pure-ish and dependency-injected: the analytics sink and the storage are both swappable,
// which keeps the module trivially unit- and e2e-testable.

// ── KPI definition (the measurable outcome target) ───────────────────────────
// Outcome target (from the engagement finding): at least 500 UNIQUE interactions per day.
// "Unique" = distinct (action + dedupe-key) within a single calendar day, so hammering the
// same button in a tight loop counts once, not a hundred times — this mirrors how a product
// analytics tool would de-duplicate to avoid vanity inflation.
export const DAILY_INTERACTION_TARGET = 500;

// How many days of ledger history to keep locally. Enough to chart the 30-day adoption trend
// the finding talks about, with headroom, while staying tiny in localStorage.
export const LEDGER_RETENTION_DAYS = 60;

const LEDGER_KEY = 'quran.engagement.ledger.v1';
const DAY = 24 * 60 * 60 * 1000;

// Canonical interaction names. Centralised so instrumentation call-sites and tests agree on
// the vocabulary instead of scattering magic strings. Add to this list as new surfaces are
// instrumented — never rename silently (production dashboards key off these).
export const INTERACTION = Object.freeze({
  APP_OPEN: 'app_open',
  TAB_VIEW: 'tab_view',
  SESSION_COMPLETE: 'session_complete',
  PRACTICE_ANSWER: 'practice_answer',
  ONBOARDING_SHOWN: 'onboarding_shown',
  ONBOARDING_CTA: 'onboarding_cta',
  ONBOARDING_DISMISS: 'onboarding_dismiss',
});

// ── Day helpers (kept local so this module has no import cycle with stats.js) ─
export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── Pluggable analytics sink ─────────────────────────────────────────────────
// In production firebase.js calls configureAnalytics() with the real Firebase Analytics
// instance + logEvent. In tests we either leave it unset (no-op) or inject a spy.
let _sink = null; // { logEvent: (analytics, name, params) => void, analytics }

export function configureAnalytics(sink) {
  _sink = sink && typeof sink.logEvent === 'function' ? sink : null;
}

function forwardToSink(name, params) {
  if (!_sink) return false;
  try {
    _sink.logEvent(_sink.analytics, name, params);
    return true;
  } catch {
    // Analytics must never break the app or a measurement: swallow transport errors.
    return false;
  }
}

// ── Pluggable storage ────────────────────────────────────────────────────────
// Defaults to localStorage but accepts any { getItem, setItem } so e2e/unit tests can use an
// isolated in-memory store and assert the outcome rate deterministically.
function defaultStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* access can throw in sandboxed iframes */
  }
  return null;
}

function readLedger(storage) {
  const s = storage || defaultStorage();
  if (!s) return {};
  try {
    const raw = s.getItem(LEDGER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLedger(storage, ledger) {
  const s = storage || defaultStorage();
  if (!s) return;
  try {
    s.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    /* quota / disabled storage — non-fatal, production sink still has the event */
  }
}

// Drop day-buckets older than the retention window so the ledger stays bounded.
function pruneLedger(ledger, now) {
  const cutoff = dayKey(now - LEDGER_RETENTION_DAYS * DAY);
  for (const k of Object.keys(ledger)) {
    if (k < cutoff) delete ledger[k];
  }
  return ledger;
}

// Monotonic-ish counter to keep distinct un-keyed interactions unique within the same ms.
let _seq = 0;

// ── Core: record one interaction locally, return today's unique count ────────
// `opts.dedupeKey` collapses repeated identical actions into a single unique interaction for
// the day (e.g. re-opening the same tab). Omit it for genuinely distinct events.
export function recordLocalInteraction(name, opts = {}, now = Date.now(), storage = null) {
  if (!name) return uniqueDailyInteractions(now, storage);
  const ledger = pruneLedger(readLedger(storage), now);
  const k = dayKey(now);
  const bucket = ledger[k] || (ledger[k] = {});
  const sig = opts.dedupeKey ? `${name}:${opts.dedupeKey}` : `${name}:${now}:${_seq++}`;
  bucket[sig] = now;
  writeLedger(storage, ledger);
  return Object.keys(bucket).length;
}

// ── Public: track an interaction (forward to production sink + record locally) ─
// Returns today's unique-interaction count after recording, so callers/tests can assert the
// outcome rate directly.
export function trackInteraction(name, params = {}, now = Date.now(), storage = null) {
  forwardToSink(name, params);
  return recordLocalInteraction(name, params, now, storage);
}

// ── Measurement / reporting helpers ──────────────────────────────────────────
export function uniqueDailyInteractions(now = Date.now(), storage = null) {
  const ledger = readLedger(storage);
  const bucket = ledger[dayKey(now)];
  return bucket ? Object.keys(bucket).length : 0;
}

// Last `days` days (oldest → newest) with the unique-interaction count for each. Powers the
// adoption trend and the gap-vs-target analysis the finding asks for.
export function interactionSeries(days = 30, now = Date.now(), storage = null) {
  const ledger = readLedger(storage);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * DAY;
    const k = dayKey(ts);
    const bucket = ledger[k];
    out.push({ day: k, count: bucket ? Object.keys(bucket).length : 0 });
  }
  return out;
}

// One-shot snapshot of where we stand against the KPI. `met` is the behaviour the e2e test
// asserts: today's unique interactions >= DAILY_INTERACTION_TARGET.
export function engagementReport(now = Date.now(), storage = null) {
  const days = interactionSeries(30, now, storage);
  const today = days.length ? days[days.length - 1].count : 0;
  const best = days.reduce((m, d) => Math.max(m, d.count), 0);
  return {
    target: DAILY_INTERACTION_TARGET,
    today,
    best,
    met: today >= DAILY_INTERACTION_TARGET,
    gapToTarget: Math.max(0, DAILY_INTERACTION_TARGET - today),
    days,
  };
}

// Test/maintenance hook: wipe the local ledger.
export function resetEngagementLedger(storage = null) {
  const s = storage || defaultStorage();
  if (!s) return;
  try {
    s.removeItem(LEDGER_KEY);
  } catch {
    /* ignore */
  }
}
