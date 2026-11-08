# Telegram bot server (two-way control)

The web app (`src/`) is a **static frontend**: it does *outbound* Telegram directly (send
notifications, set the menu) and mirrors a compact app-state summary to Firestore. This server
provides the *inbound* half — it receives Telegram updates via a webhook, reads/writes the
**same Firestore**, and answers commands with **real data**. Together they give full
observe-and-control of the app from Telegram.

Why a server is required: the bot **token is a secret** (must live server-side) and Telegram
delivers messages via an **HTTPS webhook** (a static site has no endpoint).

## What it does
`telegram-bot.mjs` (Node 18+, deps: `firebase-admin`, `unpdf`; `ai.mjs` uses built-in fetch):
- persistent bottom menu + slash-command menu
- resolves an incoming chat id → app user via the `telegramConfigs.allChatIds` index
- `/status`, `/progress`, `/today` → read `appState/{uid}` (mirrored by the app)
- `/remind HH:MM <text>` → writes a reminder into `telegramConfigs/{uid}.reminders`
  (the app picks it up in realtime via onSnapshot)
- `/settings` → shows which notification types are enabled
- `/practice` → shows an ayah with the second half hidden; your next message is graded against
  the real text (reads the capped `quranSamples/{uid}` the app mirrors)
- `/hifz`, `/tafsir` → AI memorization tips / tafsir for a random ayah
- `/ask <question>` → free-form Quran Q&A via AI
  (AI commands read the user's own key/model from `aiConfigs/{uid}`; if unset, the bot asks the
  user to configure AI in the app. `ai.mjs` supports openai-compatible / anthropic / gemini.)

If Firestore creds aren't set, the server still boots and replies, but data/AI commands degrade
gracefully (they tell the user what to configure).

## AI proxy endpoint (`POST /api/ai/proxy`)

So the web app's AI key never ships in the browser bundle / network tab, this server also exposes
a small proxy (`ai-proxy.mjs`) that runs AI chat **server-side**. Point the frontend at it with
`VITE_AI_PROXY_URL=https://YOUR-BOT-HOST` at build time.

Request body (JSON), either `prompt` or a `messages` array, plus auth:
- **Signed-in user** — send `idToken` (a Firebase ID token). The server verifies it, maps it to a
  `uid`, reads that user's key from `aiConfigs/{uid}` and calls the provider. The key never
  leaves the server.
- **Guest** — send `key` + a `provider` descriptor (`{id, kind, baseUrl}`) + `model`. The session
  key is used transiently for that one call and is never persisted.

```bash
# guest example
curl -X POST https://YOUR-BOT-HOST/api/ai/proxy -H 'Content-Type: application/json' \
  -d '{"provider":{"id":"openai","kind":"openai","baseUrl":"https://api.openai.com/v1"},"model":"gpt-4o","key":"sk-...","prompt":"What is the capital of France?"}'
# -> {"response":"...","model":"gpt-4o","provider":"openai"}
```

Responses are JSON: `{ response, model, provider }` on success, or `{ error }` with a 4xx/5xx
status. CORS is enabled so the static frontend (different origin) can call it. ID-token
verification needs Firebase Admin creds (the same `FIREBASE_SERVICE_ACCOUNT` /
`GOOGLE_APPLICATION_CREDENTIALS` the bot already uses).

## Inspection board API («نظارت و سرکشی»)

`inspection.mjs` serves `/api/me` and `/api/inspection/*` for the app's inspection board (docs/supervisor/README.md).
Roles are decided here, never in the browser: **admin** = a Firebase ID token whose *verified* email is in
`ADMIN_EMAILS`; **supervisor** = `POST /api/inspection/supervisor/login {password}` with `SUPERVISOR_PASSWORD`
(→ 12-hour HMAC token, `Authorization: Supervisor <token>`); everyone else signed in = user. Data lives in Firestore
(collections `inspection*`, closed to clients by the default-deny rule). Attachments (≤ 20 MB) have their text
extracted at upload (`lib/extract.mjs`: text/code, docx/xlsx/pptx, odt/ods/odp, epub, rtf, zip, PDF via `unpdf`).
CORS for these routes is limited to `ALLOWED_ORIGINS` (default: the production site + localhost).
`GET /api/inspection/rounds` measures the supervisor's rounds from its own visits; until it has seen some it assumes
the routines' schedule: urgent queue **every 3 hours** at minute 23 UTC (`SUPERVISOR_URGENT_CRON`, default `23 */3 * * *`)
and the full round Mon/Thu 00:47 UTC (`SUPERVISOR_FULL_CRON`, default `47 0 * * 1,4`). Both optional.
Tests: `npm test` (here) or `node --test "server/test/*.test.mjs"` from the repo root.

## Deploy
```bash
cd server
npm install
export TELEGRAM_BOT_TOKEN=123456:ABC...                 # @BotFather (QuranApp2026_bot)
export TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 16)   # recommended
# Firestore access (one of):
export FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"   # paste the JSON (one env var)
#   or: export GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json
npm start                                                # listens on $PORT (default 3001)
```
Deploy it as its own service (Render **Web Service** — root directory `server/`, build
`npm install`, start `npm start`; or a VPS / Cloud Run / Fly.io). Then register the webhook
**once** (HTTPS required), pointing at the deployed URL:
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-HOST/webhook&secret_token=<SECRET>"
```

### Free 24/7 (Render free tier)
> Measured 2026-11-02: the live `quran-telegram-bot` runs on the paid **starter** plan (always on), so the
> self-ping below is harmless but not needed there.

Render's free web services sleep after ~15 min idle (which stops the reminder/daily-summary
scheduler and adds a cold-start lag to the first command). The server self-pings to stay awake:
on Render it uses the auto-injected `RENDER_EXTERNAL_URL`; elsewhere set `SELF_URL` to the public
URL. A single always-on service fits within the free 750 instance-hours/month. (Alternatively,
point an external uptime pinger — e.g. cron-job.org / UptimeRobot — at the health URL `/`.)

### Getting the service account (for Firestore)
Firebase Console → Project settings → **Service accounts** → *Generate new private key* →
download the JSON → put its contents in `FIREBASE_SERVICE_ACCOUNT`. The Admin SDK bypasses
Firestore security rules (server-side), so it can resolve chat→user and read app state.

## How linking works (proven ownership, since 2026-11-03)
1. In the app (signed in) → Settings → Telegram → **«🔗 اتصالِ امنِ این حساب»**: the server issues a one-time,
   15-minute code (`POST /api/telegram/link-code`) and a `https://t.me/<bot>?start=<code>` link.
2. The chat opens the link (or sends `/start <code>`). The bot consumes the code in a transaction and records
   `telegramLinks/{chatId} = {uid}`. Only then does the bot answer that chat with the account's data, and only linked
   chats receive the server's reminders/daily summary. Typing a chat id into the settings is NOT proof — anyone could
   type someone else's. (`telegramLink.mjs`; collections are server-only under the default-deny rules.)
3. Migration: at boot, once, chat ids that exactly ONE account had registered before this change are grandfathered.

## Security
- Keep `TELEGRAM_BOT_TOKEN` and the service-account JSON only on the server (env vars). Never commit them.
- Set `TELEGRAM_WEBHOOK_SECRET`; the server verifies the `X-Telegram-Bot-Api-Secret-Token` header.

## Drive offline access (`/api/drive/*`, 2026-11-08)
One click on «اتصال» → Google's authorization-code flow (GIS code client, popup; `access_type=offline`, `prompt=consent`;
redirect `postmessage` — no extra redirect URI). The server exchanges the code, checks the Google account equals the
signed-in user, and keeps the **refresh token encrypted** (AES-256-GCM) in `driveOfflineTokens/{uid}` (server-only;
`firestore.rules` default deny). Afterwards `POST /api/drive/token` renews the access token with no window.
`POST /api/drive/disconnect` revokes at Google and deletes the record. `GET /api/drive/health` → `{configured}` (anonymous).

| Variable | Value |
|---|---|
| `GOOGLE_OAUTH_CLIENT_SECRET` | secret of the «Web client (auto created by Google Service)» (`31712827799-6quvsi…`) |
| `DRIVE_TOKEN_KEY` | random, ≥ 32 chars; **never change it** (stored grants would need one more «اتصال») |
| `GOOGLE_OAUTH_CLIENT_ID` | optional; defaults to the public web client id |
