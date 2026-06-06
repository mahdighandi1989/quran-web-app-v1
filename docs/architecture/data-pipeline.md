# Frontend data pipeline — app-state summarization

This note documents the small "data" pipeline that mirrors a compact, read-only
summary of the user's app state to Firestore so the **Telegram bot server**
(Firebase Admin) can answer `/status`, `/progress` and `/today` with real data.

```
src/App.jsx (state)  ──▶  buildAppStateSummary / buildQuranSample  ──▶  saveAppState / saveQuranSample
   (upstream:                  (src/lib/appStateStore.js)                    (writes Firestore:
    sessions, dataset,                                                        appState/{uid},
    pageStructure, user,                                                      quranSamples/{uid})
    flaggedAyahs)                                                                   │
                                                                                    ▼
                                                              downstream: server/telegram-bot.mjs
                                                              (Firebase Admin reads the summary)
```

## Ambiguity: Empty input handling for appStateStore

`buildAppStateSummary` / `buildQuranSample` can be invoked with **no or partial
state** — a brand-new or signed-out user, an empty `sessions`/`dataset`, or even an
`undefined` argument. What the summary should be in that case was ambiguous, and the
two ends of the pipeline (the builder here vs. the bot that reads the document) must
agree on exactly one behaviour.

- **Assumption 1 (GROUND TRUTH, implemented):** empty/missing input is a *valid "zero"
  state*. The functions return a fully-formed object with every count `= 0` and
  `accuracyPct = 0` — never `null`/`undefined`, never throwing. The bot always receives
  a stable shape to render ("0 sessions"), and `saveAppState` can write it verbatim (an
  `undefined` field would otherwise reject the whole `setDoc`).
- **Assumption 2 (REJECTED):** treat empty input as "not loaded" and return `null` / skip
  the write. Rejected because it forces every consumer to null-check and makes a real
  *"user with zero sessions"* indistinguishable from *"data missing"*, corrupting answers.

The destructuring defaults (`sessions = []`, `flaggedAyahs = {}`, `… = {}`) in
`src/lib/appStateStore.js` encode Assumption 1: a missing argument and an explicit empty
collection behave identically.

## Tests

- `src/test/appStateStore.test.js` — vitest unit tests (JS source of truth).
- `tests/backend/data_pipeline/test_app_state_store.py::test_empty_input_handling_ground_truth`
  — language-agnostic ground-truth guard (stdlib + pytest), mirrors the contract.
- `tests/backend/data_pipeline/test_integration.py` — pipeline integration guard for the
  empty → populated path.
