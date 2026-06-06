# Core AI Chat Use Cases

This document defines the **core AI chat use cases** the app supports, their measurable
outcome target, and where each one is implemented and instrumented. It is the source of truth
for the `AI_USE_CASE` vocabulary in `src/lib/analytics.js`.

## Why this exists

The AI features (tafsir, memorization help, Q&A, exam generation) previously had **no shared
definition** and **no measurement**: there was no way to tell, in production, how often users
actually *initiated an AI conversation*, so the outcome could not be improved. This document
plus the `ai_chat_interaction` analytics event close that gap.

## Outcome target (measurable)

> **At least 30% of daily active users initiate at least one AI conversation**, contributing to
> the app-wide KPI of **≥ 500 unique daily interactions** (see `docs/engagement-kpi.md`).

Every successful AI conversation is recorded as a unique interaction in the engagement ledger
(`trackAIInteraction` → `trackInteraction` → local ledger + Firebase Analytics), so the rate is
observable both in the Firebase/GA4 console and in tests via
`uniqueDailyInteractions()` / `engagementReport()`.

## The use cases

| `AI_USE_CASE` | Description | Prompt builder (`src/lib/aiTasks.js`) | UI surface |
| ------------- | ----------- | -------------------------------------- | ---------- |
| `TAFSIR`   | Explain meaning/translation of an ayah | `tafsirPrompt`  | `AIAssistButton` (AIWidgets) |
| `HIFZ`     | Memorization help for an ayah/page     | `hifzPrompt`    | `AIAssistButton` (AIWidgets) |
| `QA`       | Free-form Quran question & answer      | `qaPrompt`      | `AIChat` (AIWidgets) |
| `EXAM_GEN` | Generate self-check exam questions     | `examGenPrompt` | `AIExamGenerator` |

## Instrumentation contract

- **Event name:** `ai_chat_interaction` (`INTERACTION.AI_CHAT_INTERACTION`).
- **Params:** `{ use_case: <AI_USE_CASE.*>, ... }`.
- **When fired:** only on a *successful* model response (so failed/blocked requests do not
  inflate the outcome rate).
- **Helper:** `trackAIInteraction(useCase, params?)` in `src/lib/analytics.js`.

## Pipeline / dependencies

- **upstream:** the AI `config` (provider/key/model) edited in `AISettings.jsx`, the provider
  registry in `aiProviders.js`, and the transport in `aiClient.js`.
- **downstream:** the engagement ledger + KPI reporting (`analytics.js`,
  `docs/engagement-kpi.md`) and the in-app stats/nudge surfaces.

## How the outcome is measured in tests

`tests/e2e/test_chat_ai_outcome_measurement.py` and the JS unit tests assert that recording an
AI interaction increases today's unique-interaction count, and that distinct use cases are
counted independently while the same use case fired repeatedly within a tight loop is
de-duplicated per the engagement ledger semantics.
