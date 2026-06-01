# Telegram bot server (two-way control)

The web app (`src/`) is a **static frontend**: it does *outbound* Telegram directly (send
notifications, set the menu) and mirrors a compact app-state summary to Firestore. This server
provides the *inbound* half — it receives Telegram updates via a webhook, reads/writes the
**same Firestore**, and answers commands with **real data**. Together they give full
observe-and-control of the app from Telegram.

Why a server is required: the bot **token is a secret** (must live server-side) and Telegram
delivers messages via an **HTTPS webhook** (a static site has no endpoint).

## What it does
`telegram-bot.mjs` (Node 18+, only dep: `firebase-admin`; `ai.mjs` uses built-in fetch):
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

### Getting the service account (for Firestore)
Firebase Console → Project settings → **Service accounts** → *Generate new private key* →
download the JSON → put its contents in `FIREBASE_SERVICE_ACCOUNT`. The Admin SDK bypasses
Firestore security rules (server-side), so it can resolve chat→user and read app state.

## How linking works
1. In the app (signed in) → Settings → Telegram tab → paste your **Chat ID** (the bot's
   `/start` shows it) and enable. The app stores it (and any device chat ids) in
   `telegramConfigs/{uid}.allChatIds`.
2. The bot looks up the incoming chat id in that index to know which user is messaging — so
   only the real owner (who set the id in their own rules-protected doc) is matched.

## Security
- Keep `TELEGRAM_BOT_TOKEN` and the service-account JSON only on the server (env vars). Never commit them.
- Set `TELEGRAM_WEBHOOK_SECRET`; the server verifies the `X-Telegram-Bot-Api-Secret-Token` header.
