---
task_id: telegram-bot-server
task_title: راه‌اندازی بات تلگرام برای کنترل دوطرفه (deploy سرور + webhook)
execution_priority: 9000
created_at: '2026-05-30T00:00:00+00:00'
updated_at: '2026-05-30T00:00:00+00:00'
status: pending
---

# TO-DO — راه‌اندازی تلگرام (بخش‌هایی که فقط شما می‌توانید انجام دهید)

## وضعیت بخش‌های خودکار (انجام و push شد)
- تب کامل تلگرام در **تنظیمات** که **فقط پس از ورود** و **برای هر حساب جداگانه** نمایش داده می‌شود.
- پیکربندی در **Firestore (per-user)** ذخیره می‌شود (realtime با onSnapshot)؛ **هیچ‌چیز در حافظهٔ مرورگر** نیست.
- برنامه خلاصهٔ وضعیت را در `appState/{uid}` mirror می‌کند (`src/lib/appStateStore.js`).
- **کنترل دوطرفهٔ کامل پیاده‌سازی شد**: `server/telegram-bot.mjs` با Firebase Admin، دستورهای
  `/status /progress /today /remind /settings` با دادهٔ واقعی، منوی ثابت پایین، و نگاشت chat→user
  از طریق `allChatIds`. (+ `src/lib/telegram.js`، `telegramStore.js`، `TelegramSettings.jsx`، تست‌ها)
- قوانین امنیتی `firestore.rules` (برای `telegramConfigs` و `appState`) + `server/package.json` + `server/README.md`.
- فقط **اجرا/پیکربندی روی سرویس‌های خارجی** باقی مانده (پایین) — کدنویسی تمام است.

## کارهای دستی شما

**۰) پیش‌نیاز Firestore (برای کارکردِ تبِ تلگرام لازم است):**
- در **Firebase Console → Firestore Database**، یک دیتابیس بسازید (Production یا Test mode).
- محتوای `firestore.rules` را در تب **Rules** جای‌گذاری و **Publish** کنید (هر کاربر فقط دادهٔ خودش).
- بدون این، تب تلگرام پیام «خواندن از سرور ناموفق بود» نشان می‌دهد (اپ کرش نمی‌کند).

**۱) برای کارکردِ اعلان‌های خروجی (همین حالا قابل استفاده):**
- توکن بات `@QuranApp2026_bot` را از @BotFather بگیرید.
- در برنامه: **تنظیمات → تب تلگرام** → توکن و سپس **Chat ID** خود را وارد کنید
  (دکمهٔ «تشخیص Chat ID» بعد از فرستادن `/start` به بات کمک می‌کند) → «فعال‌سازی» را بزنید
  → با «ارسال پیام آزمایشی» تست کنید.
- (اختیاری) دکمهٔ «تنظیم منوی بات» را بزنید تا منوی دستورات در تلگرام ظاهر شود.

**۲) deploy سرور بات برای کنترل دوطرفه (کد آماده است؛ فقط اجرا):**
- پوشهٔ `server/` را به‌عنوان یک سرویس جدا deploy کنید (Render Web Service با root=`server/`،
  build=`npm install`، start=`npm start`؛ یا VPS/Cloud Run).
- env: `TELEGRAM_BOT_TOKEN`، `TELEGRAM_WEBHOOK_SECRET`، و برای دسترسی Firestore یکی از
  `FIREBASE_SERVICE_ACCOUNT` (محتوای JSON سرویس‌اکانت) یا `GOOGLE_APPLICATION_CREDENTIALS`.
  - service account: Firebase Console → Project settings → **Service accounts** → Generate new private key.
- webhook را یک‌بار ثبت کنید:
  `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-HOST/webhook&secret_token=<SECRET>"`
- جزئیات کامل در `server/README.md`. (بدون این سرور، اعلان‌های خروجی و ساختِ یادآوری از داخل
  برنامه کار می‌کنند، ولی دستورها/دکمه‌های داخل تلگرام پاسخ نمی‌گیرند.)

## وقتی این کارها را تمام کردی
- این فایل و entry آن در `TO-DO/_index.json` را حذف کن (یا `status` را `done` کن).
