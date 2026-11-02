# AGENTS.md

All agents (Claude, Codex, Gemini, Copilot, …) working on this repository must follow
[`CLAUDE.md`](CLAUDE.md): ship every finished task with `scripts/ship.sh`, log every change in
`docs/WORKLOG.md`, keep `docs/handbook/` (handbook + progress ledger) current, record reusable
lessons in `experiences/`, and never delete a capability without the owner's approval.

---

**These rules bind ANY agent or human working here — not one tool.** `main` auto-deploys to
production on Render: the static site `quran-web-app` (Vite build of `src/`) and the Node
service `quran-telegram-bot` (`server/`, also serves the AI proxy and the inspection API).
Every push to `main` is a production change.

## 1. STOP — read these first, in this order

| # | Read | Why you cannot skip it |
|---|---|---|
| 1 | `AGENTS.md` (this file) | Shared rules for every agent; wins over any tool-specific file. |
| 2 | [`CLAUDE.md`](CLAUDE.md) | The owner's standing directives (Persian) + repo map + run commands. Auto-loaded by Claude Code only — other tools must open it themselves. |
| 3 | every file in [`experiences/`](experiences/) | Each one is a mistake that already cost a project (e.g. a green health ping hiding a dead flow; a `.gitignore` rule that silently dropped a source file). They are binding. |
| 4 | the **last 5 entries** of [`docs/WORKLOG.md`](docs/WORKLOG.md) — **newest is at the BOTTOM** | Where the work stopped, what is `[TODO]`/`[BLOCKED]`, what the owner last asked (`[OWNER]`). |
| 5 | [`docs/handbook/HANDBOOK.md`](docs/handbook/HANDBOOK.md) §6 (decisions) and §9 (open items) + [`docs/handbook/PROGRESS.md`](docs/handbook/PROGRESS.md) | Decisions already taken and why; the open-items list; the ledger you must extend. |
| 6 | [`docs/supervisor/README.md`](docs/supervisor/README.md) | The inspection board («نظارت و سرکشی») and the automated supervisor routines. |
| 7 | [`README.md`](README.md) and [`server/README.md`](server/README.md) | Architecture, Render services, setup steps the owner must do. |

Decisions live in HANDBOOK §6 and in WORKLOG `[DECISION]` lines (with their rejected alternatives);
`docs/adr/` holds older ADRs. **State in your first message which of these you have actually read.**

## 2. Non-negotiable rules

- **`experiences/` is binding.** Read it before changing the area it covers.
- **Never delete a capability** (endpoint, page, button, bot command, data). Quarantine it and record
  it in the WORKLOG; deletion only with the owner's explicit approval.
- **Never touch `prompt/`** — it belongs to the owner's external tooling (`TO-DO/` is fed by it too).
- **Existing user data (Firestore, Google Drive) is never altered or deleted** by an agent: read-only
  checks only, unless the owner asks for a specific change.
- **No secrets in the repo** — bot token, service-account JSON, `SUPERVISOR_PASSWORD`, admin list
  (`ADMIN_EMAILS`) live only in Render env vars. The Firebase *web* config is public by design.
- **The real access boundary is the server / Firestore rules**; the UI only hides.
- **Verification — what `scripts/ship.sh` runs, and what each one protects:**

  | Command (as run by `scripts/ship.sh`) | Protects what the others do not |
  |---|---|
  | the ignored-source check inside `scripts/ship.sh` | Source files that exist locally but are hidden by `.gitignore` (they would be missing on Render). |
  | `npm ci` (only when `node_modules` is missing) | The lockfile is in sync — Render runs `npm install`/`npm ci` and a drifted lock breaks builds. |
  | `npx vitest run` | Frontend logic and components (`src/**/*.test.{js,jsx}`). |
  | `npm run build` | The Vite production bundle Render's static site deploys. |
  | `node --test "server/test/*.test.mjs"` | The bot / AI-proxy / inspection API server (`server/`), with injected fakes — no network. |
  | `pytest` (`python3 -m pytest -q`, tests in `tests/`) | Python guards + `backend/` pipeline tests + repo-wide checks. |
  | `scripts/docs_gate.py` (`python3 scripts/docs_gate.py`) | These multi-agent rules: entry files, this command list, docs-map paths, signed newest WORKLOG entry, lessons frontmatter. |

- **Documentation duty after EVERY task:** (a) a new section at the bottom of `docs/WORKLOG.md`
  (FINDING/DECISION/CHANGE/VERIFY/REVERT/CORRECTION/OWNER/TODO/BLOCKED), **ending with the signature
  line (§4)**; (b) a reusable lesson in `experiences/` when there is one — merge into an existing topic
  when it fits; (c) HANDBOOK + PROGRESS updated; (d) new env vars → `render.yaml`, `.env.example`
  and README.

## 3. Owner's standing directives

- **Ship automatically after every finished task:** `scripts/ship.sh "type(scope): summary"` — checks,
  commit, push the working branch, merge into `main`, push `main` (= deploy). Never force-push, never
  disable a test to get green. Do not ask the owner to commit/push/merge; do not open a PR unless asked.
  A `Stop` hook (`.claude/hooks/ensure-shipped.sh`, registered in `.claude/settings.json`) blocks
  Claude Code sessions from ending with unshipped work.
- Reply to the owner **in Persian**, plainly and briefly. UI text is Persian, `dir="rtl"`.
- **A health ping is not evidence.** Measure the real flow (sign in → read/write → result) before claiming.
- **Read warnings** (build, test, runtime). **Measure before you claim.**

## 4. Signature protocol — who did what

1. **WORKLOG:** the last line of every entry:
   `> **امضا:** \`<agent-id>\` · YYYY-MM-DD · <one line: how it was verified>`
   `<agent-id>` = the tool you are (e.g. `Claude Code`, `Codex CLI`, `human (owner)`, `ناظرِ خودکار (Claude Code routine)`).
   Do not put model names/ids in anything pushed to the repo.
2. **experiences/:** frontmatter field `agents:` listing who produced/merged the file; append, never overwrite.
3. **git commits:** a `Co-Authored-By:` trailer.

`scripts/docs_gate.py` fails the build when the newest WORKLOG entry is unsigned.

## 5. Mistakes that actually happened (here or in the sibling projects)

- **"Deployed" ≠ working.** A service showed *Deployed* while the real flow returned 500 — verify the flow.
- **A green local build proved nothing** when `.gitignore` hid a source file; `ship.sh` now checks it.
- **Render `rootDir` skips deploys** for files outside it: `server/` imports `src/lib/notificationRules.js`,
  so a change to that file alone does NOT redeploy the bot (see `experiences/render-rootdir-skips-deploys-for-files-outside-it.md`).
- **Debug tooling shipped to production:** an "Inspector Bridge" that hooks console/fetch was gated in
  `index.html` but copied ungated into `main.jsx`/`App.jsx` (WORKLOG, 2026-11-02).

## 6. Conflict rule

`CLAUDE.md` carries the same rules plus tool-specific detail (in Persian). **If the two disagree,
AGENTS.md wins and the drift is a bug to fix in the same commit.** [`GEMINI.md`](GEMINI.md) only points here.
