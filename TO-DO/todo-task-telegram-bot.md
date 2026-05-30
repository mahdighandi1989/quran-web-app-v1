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
- پیکربندی در **Firestore (per-user)** ذخیره می‌شود؛ **هیچ‌چیز در حافظهٔ مرورگر** نیست.
- سرویس خروجی `src/lib/telegram.js` + ذخیرهٔ `src/lib/telegramStore.js` + کامپوننت `TelegramSettings.jsx` + تست‌ها.
- قوانین امنیتی `firestore.rules` + اسکلت سرور بات `server/telegram-bot.mjs` (+ `server/README.md`).

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

**۲) برای کنترل دوطرفه (اجرای دستور از داخل تلگرام، عملکرد منوی پایین) — نیازمند سرور:**
- `server/telegram-bot.mjs` را به‌عنوان یک سرویس جدا deploy کنید (Render Web Service / VPS / …).
- روی آن سرور env بگذارید: `TELEGRAM_BOT_TOKEN` (و `TELEGRAM_WEBHOOK_SECRET`).
- webhook را یک‌بار ثبت کنید:
  `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-HOST/webhook&secret_token=<SECRET>"`
- جزئیات کامل در `server/README.md`.

**۳) برای اینکه دستورها دادهٔ واقعی برنامه را نشان/کنترل کنند (اختیاری، پیشرفته):**
- یک store مشترک بین برنامه و سرور بسازید (پیشنهاد: **Firestore**، چون برنامه از قبل Firebase دارد).
- برنامه state را به Firestore mirror کند؛ سرور بات از همان‌جا بخواند/بنویسد (راهنما در `server/README.md`).

## وقتی این کارها را تمام کردی
- این فایل و entry آن در `TO-DO/_index.json` را حذف کن (یا `status` را `done` کن).
