# Telegram bot server (two-way control)

The web app (`src/`) is a **static frontend** — it can only do *outbound* Telegram (send
notifications, set the menu) directly from the browser. To make the bot **interactive**
(commands FROM Telegram, the bottom menu actually doing things, reminders while the app is
closed) you need this small backend, because:

- a bot **token is a secret** and must live server-side (an env var), not in the browser;
- Telegram delivers incoming messages via a **webhook** to an HTTPS endpoint — a static site
  has none.

## What's here
- `telegram-bot.mjs` — a zero-dependency Node (18+) webhook server. It replies to
  `/start`, `/help`, `/status`, `/progress`, `/today`, `/remind`, `/settings` and shows a
  persistent bottom menu. The data-backed commands are stubs until you wire a shared store.

## Run / deploy
```bash
export TELEGRAM_BOT_TOKEN=123456:ABC...        # from @BotFather (QuranApp2026_bot)
export TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 16)   # optional but recommended
node server/telegram-bot.mjs                   # listens on $PORT (default 3001), POST /webhook
```
Deploy it as its own service (Render **Web Service**, a VPS, Cloud Run, Fly.io, …). Then
register the webhook **once** (HTTPS required):
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-HOST/webhook&secret_token=<SECRET>"
```

## Making commands return REAL app data (full control)
The bot and the web app must share a store. The app already uses **Firebase**, so the clean
path is **Firestore**:

1. In the web app, mirror the relevant state (sessions, progress, reminders, settings) to a
   Firestore document keyed by the user (you already mirror to Google Drive — Firestore is the
   server-readable equivalent).
2. In `telegram-bot.mjs`, add the Firebase Admin SDK and, in each command handler, read/write
   that document (e.g. `/status` reads it; `/remind <time> <text>` writes a reminder the app
   then honours).
3. Map a Telegram `chatId` to an app user (the app's Telegram tab already lets the user paste
   their `chatId`; store that mapping in Firestore so the bot knows who is who).

With that store in place, every capability of the app can be both **observed and controlled**
from Telegram — which is the end goal of the in-app Telegram tab.

## Security
- Keep `TELEGRAM_BOT_TOKEN` only on the server (env var). Never commit it.
- Set `TELEGRAM_WEBHOOK_SECRET` and verify the `X-Telegram-Bot-Api-Secret-Token` header
  (this server already checks it) so only Telegram can post to `/webhook`.
