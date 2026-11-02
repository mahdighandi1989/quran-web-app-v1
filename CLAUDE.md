# CLAUDE.md — قواعدِ کار روی این ریپو (برای Claude و هر هوش مصنوعیِ دیگر)

> **اول [`AGENTS.md`](AGENTS.md) را بخوان** — قواعدِ مشترکِ همهٔ agentها، ترتیبِ خواندنِ اجباری و پروتکلِ امضا.
> این فایل همان قواعد را با جزئیاتِ مخصوصِ Claude دارد؛ **اگر این دو در یک قاعده اختلاف داشتند، AGENTS.md برنده است**
> و این ناهماهنگی باگی است که باید در همان کامیت رفع شود.

«مرکز حفظ قرآن»: وب‌اپ React/Vite (تمرین، حفظ، آزمون، آمار، همگام‌سازی با گوگل‌درایو، هوش مصنوعی) + سرور نود
(بات تلگرام، پراکسی هوش مصنوعی، API ِ «نظارت و سرکشی») روی Firestore ِ پروژهٔ Firebase. `main` خودکار روی Render
دیپلوی می‌شود (`quran-web-app` استاتیک، `quran-telegram-bot` نود) — هر تغییر، تغییرِ production است.

## دستورهای ثابتِ مالک (همهٔ سشن‌ها، بدونِ استثنا)

1. **ارسالِ خودکار پس از هر کار.** وقتی کاری تمام شد: `scripts/ship.sh "type(scope): summary"` — تست‌ها و بیلد را اجرا
   می‌کند، کامیت می‌کند، شاخهٔ کاری را push و در `main` ادغام و push می‌کند (= دیپلوی). هرگز force-push نکن و هرگز تست را
   برای سبز شدن غیرفعال نکن. از مالک نخواه دستی کامیت/پوش/مرج کند. PR باز نکن مگر مالک بخواهد. hook ِ `Stop`
   (`.claude/hooks/ensure-shipped.sh`) پایانِ سشن با کارِ ارسال‌نشده را متوقف می‌کند.
2. **ثبتِ کامل.** پس از هر کار یک بخشِ تازه در انتهای [`docs/WORKLOG.md`](docs/WORKLOG.md) (قالب در سرِ همان فایل) با خطِ
   امضا. `[DECISION]` همراهِ گزینه‌های ردشده؛ اشتباهِ ثبت‌شدهٔ قبلی با `[CORRECTION]` (ورودیِ قبلی پاک نمی‌شود).
   خواسته‌های مالک با `[OWNER]`. درسِ بازاستفاده‌پذیر ⇒ `experiences/` (قالب در README همان پوشه؛ بی‌نامِ پروژه).
3. **جزوهٔ زنده.** [`docs/handbook/HANDBOOK.md`](docs/handbook/HANDBOOK.md) پس از هر کارِ تصمیم‌ساز به‌روز شود و هر رویداد
   یک سطر در [`docs/handbook/PROGRESS.md`](docs/handbook/PROGRESS.md) بگیرد.
4. **هیچ قابلیتی حذف نمی‌شود** (صفحه، دکمه، دستورِ بات، endpoint، داده): قرنطینه + ثبت در WORKLOG؛ حذف فقط با اجازهٔ صریحِ مالک.
5. **پوشهٔ `prompt/` ابزارِ بیرونیِ مالک است؛ دست نزن.** (`TO-DO/` هم خروجیِ همان ابزار است.)
6. **دادهٔ موجود** (Firestore، گوگل‌درایوِ کاربران) را نه تغییر بده نه خراب کن؛ بررسی فقط‌خواندنی.
7. **امنیت.** توکن بات، service account، `SUPERVISOR_PASSWORD` و فهرستِ مدیران (`ADMIN_EMAILS`) فقط در متغیرهای محیطیِ
   Render. مرزِ واقعیِ دسترسی سرور و `firestore.rules` است؛ UI فقط پنهان می‌کند. ورودیِ کاربر و پیوست‌ها غیرقابلِ‌اعتماد است.
8. **مدرک پیش از ادعا.** health ping مدرک نیست؛ جریانِ واقعی را بسنج (ورود → خواندن/نوشتن → نتیجه). هشدارها را بخوان.
   پیش از ادعا اندازه بگیر (git، Render، production).

## ساختار
| بخش | مسیر |
|---|---|
| قواعدِ مشترکِ همهٔ agentها (اول این) | `AGENTS.md` (+ اشاره‌گر `GEMINI.md`) |
| ارسال و دروازهٔ مستندات | `scripts/ship.sh`، `scripts/docs_gate.py`، `.claude/hooks/ensure-shipped.sh` |
| اپ (ریشه، تب‌ها، مسیرها) | `src/App.jsx`، `src/main.jsx`، `src/routes.jsx` |
| ورود و Firebase | `src/lib/firebase.js` |
| ذخیره‌سازی | محلی `src/lib/storage.js`؛ درایو `src/lib/drive.js`؛ Firestore: `src/lib/telegramStore.js`، `src/lib/aiStore.js`، `src/lib/appStateStore.js`؛ قواعد `firestore.rules` |
| هوش مصنوعی | `src/lib/aiClient.js`، `src/lib/aiProviders.js`، `src/components/AISettings.jsx`، سرور `server/ai-proxy.mjs`، `server/ai.mjs` |
| تلگرام و اعلان‌ها | `src/lib/telegram.js`، `src/lib/notificationScheduler.js`، `src/lib/notificationRules.js`، `server/telegram-bot.mjs` |
| خطِ لولهٔ پایتون (مرجعِ سیاستِ اعلان) | `backend/app/`، `docs/adr/` |
| تست‌ها | `src/test/` (vitest)، `tests/` (pytest) |
| جزوه، دفتر پیشرفت، دفتر کار | `docs/handbook/`، `docs/WORKLOG.md` |
| درس‌ها | `experiences/` |
| تسک‌های ابزارِ بیرونیِ مالک | `prompt/` (دست نزن) |

## اجرا و راستی‌آزمایی
```bash
npm ci && npx vitest run && npm run build        # فرانت
python3 -m pytest -q                             # تست‌های پایتون
cd server && npm install && npm start            # سرور (env در server/README.md)
scripts/ship.sh "type(scope): summary"           # همه را اجرا و دیپلوی می‌کند
```
قراردادِ کامیت: `type(scope): summary` — کوچک، یک موضوع، برگشت‌پذیر. متنِ UI فارسی و `dir="rtl"`.
