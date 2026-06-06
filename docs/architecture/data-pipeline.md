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

## Coherence fix: AI configuration in the app-state summary

`aiStore` (`src/lib/aiStore.js`, Firestore `aiConfigs/{uid}`) owns the user's **per-user
AI configuration** (active provider/model, API keys, custom providers) with real-time
sync. `appStateStore` is meant to be the *single, compact, read-only summary* of the
user's state for the bot. Originally the summary **omitted** the AI config entirely, so
the bot had to read `aiConfigs/{uid}` directly just to know whether AI was usable — two
parts of the pipeline holding conflicting assumptions about where "the user's state"
lives (a classic coherence gap).

**Ground truth chosen:** `appState` is the one summarization layer, so it now folds in a
**non-sensitive** AI summary via `summarizeAiConfig(aiConfig)`:

```
ai: { configured, provider, model, hasKey, customProviders }
```

- `configured` is `true` only when the user has an active provider **and** model **and**
  a key for that provider — i.e. the bot can actually run AI for them.
- `hasKey` reflects whether a key exists for the active provider; `customProviders` is a
  count. It is always a fully-formed zero object for a missing/empty config (same
  Assumption-1 zero-state contract as the rest of the summary).

**Security boundary (critical):** the API **keys are NEVER copied** into `appState`. They
remain only in `aiConfigs/{uid}` and are fetched directly when the bot actually calls a
provider (`server/ai.mjs` → `resolveAI`, and the AI proxy). `appState` exists only to
render status/answers, so it carries *whether/which* AI is set up, never the secret. The
app passes the live `aiConfig` into `buildAppStateSummary` (`src/App.jsx`); the bot reads
`st.ai` for `/status` (`fmtAiLine` in `server/telegram-bot.mjs`) instead of probing
`aiConfigs` just to answer "is AI set up?".

## Tests

- `src/test/appStateStore.test.js` — vitest unit tests (JS source of truth).
- `tests/backend/data_pipeline/test_app_state_store.py::test_empty_input_handling_ground_truth`
  — language-agnostic ground-truth guard (stdlib + pytest), mirrors the contract.
- `tests/backend/data_pipeline/test_integration.py` — pipeline integration guard for the
  empty → populated path.
