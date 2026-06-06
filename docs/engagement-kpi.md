# Engagement & Adoption KPI — Definition, Gap Analysis, and Measurement

> Task: `edc122de` — *Increase User Engagement and Adoption* (effectiveness / `logic_audit`).
> This document is the measurable rewrite of the outcome target plus the effectiveness
> criteria that future verification must check **behaviour/outcome**, not file existence.

## 1. Outcome target (measurable KPI)

**KPI — Unique Daily Interactions (UDI):** the count of *distinct* meaningful user
interactions recorded in a single calendar day.

| Field | Value |
| --- | --- |
| **Metric** | `unique_daily_interactions` |
| **Target** | **≥ 500 per day** |
| **Window** | sustained over a rolling 30-day period |
| **"Unique"** | distinct `(interaction_name, dedupe_key)` within one calendar day |
| **Source of truth (prod)** | Firebase Analytics / GA4 custom events |
| **Source of truth (client/tests)** | local per-day ledger in `src/lib/analytics.js` |
| **Code constant** | `DAILY_INTERACTION_TARGET` (`src/lib/analytics.js`) = `500` |

A "meaningful interaction" is one of the instrumented events in
`INTERACTION` (`src/lib/analytics.js`):

| Event | Meaning |
| --- | --- |
| `app_open` | the app was opened/mounted |
| `tab_view` | a primary tab was viewed (deduped per tab per day) |
| `session_complete` | a practice/exam/page session was completed — the core value event |
| `practice_answer` | an individual answer was submitted |
| `onboarding_shown` / `onboarding_cta` / `onboarding_dismiss` | onboarding nudge funnel |

## 2. Gap analysis (current vs target)

| | Value |
| --- | --- |
| Recorded interactions (prior 30 days) | **100 total** (`info_count`) |
| Implied rate | ≈ **3.3 interactions/day** |
| Target rate | **500 interactions/day** |
| **Gap** | ~**496.7/day**, i.e. roughly a **150×** increase needed |
| Error rate | 0% (the system is *stable* — the problem is adoption, not correctness) |

### Root cause identified during this task

The dominant cause of the near-zero number was **missing instrumentation**: the app
initialised Firebase Analytics (`src/lib/firebase.js`) but **never logged a single custom
event**. Interactions were therefore invisible — you cannot grow, or even honestly report,
a metric you do not record. The `info_count` of 100 reflected only incidental signal, not
real usage.

This task closes that measurement gap **and** adds an adoption driver:

1. **Measurement** — `src/lib/analytics.js` records every meaningful interaction to a local
   per-day ledger and forwards it to GA4, so UDI is now observable in production and in tests.
2. **Driver** — `src/components/EngagementNudge.jsx` gives low-activity users a single, clear
   call-to-action into the core practice flow.

## 3. Effectiveness criteria (outcome, not file existence)

Future verification of this finding **must measure outcome**. A change is only "done" when:

- [ ] The app records interactions through `trackInteraction()` at every core surface
      (app open, tab view, session complete) — verifiable by `engagementReport().today > 0`
      after exercising the UI, **not** by the file merely existing.
- [ ] `engagementReport()` returns `met === true` once today's unique interactions reach
      `DAILY_INTERACTION_TARGET` (asserted by `src/test/engagement.e2e.test.jsx`).
- [ ] Interactions are forwarded to the production analytics sink (GA4) so the rate is
      observable in the Firebase console (the same `logEvent` path, verified by the e2e test
      via an injected sink spy).
- [ ] The onboarding nudge is shown to low-activity users and its impression→CTA funnel is
      tracked, so the A/B variants can be compared on real conversion data.

**Anti-pattern (explicitly rejected):** "the analytics file exists" or "a `logEvent` line is
present" is **not** sufficient. Verification reads the *measured outcome rate*.

## 2.b Product-discovery / A/B onboarding (codeable scaffolding)

The finding's suggested action includes user interviews and A/B testing of onboarding flows.
Real interviews require real users (out of scope for code), but the **A/B test
infrastructure** is implemented here so the experiment can run as soon as there is traffic:

- Each browser is deterministically and persistently assigned to **variant A or B**
  (`EngagementNudge` → `assignVariant()`), so a user always sees the same flow.
- The two variants use different onboarding copy/CTA framing (`COPY.A` / `COPY.B`).
- Impressions, CTA clicks, and dismissals are all tracked with the `variant` attached, so the
  more effective onboarding flow is identified from data, not guessed.

The remaining manual parts (recruiting interviewees, choosing final marketing copy) are
genuine product/business decisions — see `TO-DO/` only if/when a real credential or human
decision is actually required; none was needed for this implementation.

## How to read the metric

- **Production:** Firebase console → Analytics → Events → filter the `session_complete`,
  `app_open`, `tab_view`, `onboarding_*` custom events; build a "unique events per day"
  exploration to chart UDI against the 500 target.
- **Client / tests:** `engagementReport()` from `src/lib/analytics.js` returns
  `{ target, today, best, met, gapToTarget, days[] }`.
