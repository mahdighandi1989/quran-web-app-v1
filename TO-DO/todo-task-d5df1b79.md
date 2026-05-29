---
task_id: d5df1b79-e2d9-4c1f-bff5-63d8e2ced6ee
task_title: Firebase API Key و سایر credentials در کد فرانت‌اند به صورت plain text قرار دارند
execution_priority: 1000
created_at: '2026-05-29T20:22:00+00:00'
updated_at: '2026-05-29T20:22:00+00:00'
status: pending
---

# TO-DO — انتقال credential های Firebase به متغیرهای محیطی

## چرا این فایل ساخته شد
تمام بخش‌های کدیِ این تسک به‌صورت خودکار انجام و push شد. تنها بخش باقی‌مانده
یک اقدام دستی روی **پلتفرم استقرار (deploy) شماست** که agent به آن دسترسی ندارد:
ست‌کردن متغیرهای محیطی build روی پنل میزبان (Render/Vercel/Netlify/…). بدون این،
نسخهٔ deploy‌شده مقادیر Firebase را در زمان build دریافت نمی‌کند.

## وضعیت بخش‌های خودکار (انجام‌شده)
- `src/App.jsx`: `firebaseConfig` اکنون از `import.meta.env.VITE_FIREBASE_*` خوانده می‌شود (کلید hardcode حذف شد).
- `.env.example`: با placeholder برای هر ۷ متغیر اضافه شد (tracked).
- `.gitignore`: `.env`, `.env.local`, `.env.*.local` نادیده گرفته می‌شوند و `!.env.example` حفظ شد.
- `README.md`: بخش «پیکربندی محیط (Firebase)» اضافه شد.
- اعتبارسنجی: کلید نه در `src/` و نه در `dist/` (build بدون `.env`) ظاهر نمی‌شود؛ ۴۰ تست سبز.

## کارهایی که باید انجام دهی (تو، کاربر)

**اولویت بالا — برای کارکردِ نسخهٔ deploy‌شده ضروری:**
1. در پنل پلتفرم میزبان، این متغیرهای محیطیِ build را تعریف کن (مقادیر واقعیِ پروژهٔ Firebase خودت):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
2. یک build/deploy جدید بزن تا مقادیر اعمال شوند.

**اولویت بالا — توصیهٔ امنیتی (چون کلید قبلاً در تاریخچهٔ git و bundleهای قبلی public بوده):**
3. در Google Cloud Console، روی این API key محدودیت بگذار (HTTP referrer / API restrictions)
   یا یک کلید جدید بساز و کلید قدیمی را rotate کن. کلید فعلی در commitهای قبلیِ مخزن
   باقی می‌ماند؛ rotate امن‌ترین کار است. (یادآوری: کلید Firebase web ذاتاً client-side
   است و «secret» نیست، ولی محدودسازی‌اش از سوءاستفاده جلوگیری می‌کند.)

**اولویت متوسط — برای توسعهٔ لوکال:**
4. `cp .env.example .env` و مقادیر واقعی را در `.env` بگذار (این فایل commit نمی‌شود).

## وقتی این کارها را تمام کردی
- این فایل و entry آن در `TO-DO/_index.json` را حذف کن (یا `status` را به `done` تغییر بده).
