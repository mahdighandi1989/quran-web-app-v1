---
task_id: d5df1b79-e2d9-4c1f-bff5-63d8e2ced6ee
task_title: Firebase API Key و سایر credentials در کد فرانت‌اند به صورت plain text قرار دارند
execution_priority: 1000
created_at: '2026-05-29T20:22:00+00:00'
updated_at: '2026-05-29T21:32:00+00:00'
status: pending
---

# TO-DO — سخت‌سازیِ امنیتیِ کلید Firebase (اختیاری؛ برای کارکرد لازم نیست)

## وضعیت فعلی
- پیکربندی Firebase اکنون از `import.meta.env.VITE_FIREBASE_*` خوانده می‌شود **و** یک
  fallback عمومی داخل `src/lib/firebase.js` دارد. بنابراین اپ **بدون هیچ تنظیم env** کار می‌کند
  (خطای `auth/invalid-api-key` در deploy برطرف شد) و در صورت تمایل می‌توان با env override کرد.
- `.env.example` و بخش README متغیرها را مستند می‌کنند؛ `.env` در `.gitignore` است.

## کارهای دستی (همگی **اختیاری** — اپ بدون این‌ها کار می‌کند)

**اولویت بالا — توصیهٔ امنیتی (چون کلید web فایربیس ذاتاً public است و در bundle/تاریخچهٔ git قرار دارد):**
1. در Google Cloud Console روی این API key محدودیت بگذار: **Application restrictions → HTTP referrers**
   (فقط دامنه(های) خودت، مثل `quran-app-8rwy.onrender.com`) و **API restrictions** (فقط APIهای لازم).
   این کاری است که واقعاً از سوءاستفاده جلوگیری می‌کند — نه پنهان‌کردن کلید.
2. در Firebase Console → Authentication → Settings → **Authorized domains**، دامنهٔ deploy خود را اضافه کن
   (وگرنه ورود با گوگل روی آن دامنه کار نمی‌کند).
3. (اختیاری) اگر می‌خواهی کلید را rotate کنی: کلید جدید بساز، مقدار را در محیط build قرار بده و
   مقدار fallback در `src/lib/firebase.js` را به‌روزرسانی کن.

**اولویت متوسط — override چندمحیطی (اختیاری):**
4. برای جدا کردن config محیط‌ها، متغیرهای `VITE_FIREBASE_*` را در پنل پلتفرم (Render/Vercel/…) یا
   در `.env` لوکال ست کن؛ این مقادیر بر fallback اولویت دارند.

## وقتی این کارها را تمام کردی
- این فایل و entry آن در `TO-DO/_index.json` را حذف کن (یا `status` را به `done` تغییر بده).
