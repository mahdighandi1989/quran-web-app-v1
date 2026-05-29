# Quran Web App (React + Vite)

این پروژه نسخهٔ آمادهٔ اجرای کد شماست.

## اجرا (لوکال)
1) Node.js 18+ نصب باشد.
2) متغیرهای محیطی Firebase را تنظیم کنید (بخش «پیکربندی محیط» پایین).
3) در پوشهٔ پروژه دستور زیر را بزنید:
```bash
npm install
npm run dev
```
۴) آدرسی که Vite می‌دهد (مثلاً http://localhost:5173) را باز کنید.

## پیکربندی محیط (Firebase)
مقادیر پیکربندی Firebase دیگر در کد قرار ندارند و از متغیرهای محیطی خوانده می‌شوند
(Vite متغیرهای با پیشوند `VITE_` را در زمان build تزریق می‌کند).

1) فایل نمونه را کپی کنید:
```bash
cp .env.example .env
```
2) در فایل `.env`، مقادیر واقعی پروژهٔ Firebase خود را قرار دهید
   (`VITE_FIREBASE_API_KEY`، `VITE_FIREBASE_AUTH_DOMAIN`، `VITE_FIREBASE_PROJECT_ID`،
   `VITE_FIREBASE_STORAGE_BUCKET`، `VITE_FIREBASE_MESSAGING_SENDER_ID`،
   `VITE_FIREBASE_APP_ID`، `VITE_FIREBASE_MEASUREMENT_ID`). این مقادیر در
   Firebase console → Project settings → General → Your apps در دسترس‌اند.
3) فایل `.env` در `.gitignore` است و **نباید** commit شود.
4) برای **استقرار (deploy)** همین متغیرها را در تنظیمات environment پلتفرم میزبان
   (مثل Render/Vercel/Netlify) ست کنید تا build مقادیر را دریافت کند.

## تست
این پروژه از [Vitest](https://vitest.dev/) (همراه با React Testing Library و jsdom) برای تست استفاده می‌کند.

```bash
npm test          # اجرای یک‌بارهٔ همهٔ تست‌ها
npm run test:watch  # اجرای تست‌ها در حالت watch
```
- پیکربندی تست در `vitest.config.js` و تنظیمات global در `src/test/setup.js` قرار دارد.
- فایل‌های تست با الگوی `src/**/*.{test,spec}.{js,jsx}` شناسایی می‌شوند.

## نکات
- کتابخانهٔ XLSX به‌صورت داینامیک از CDN لود می‌شود.
- داده‌ها (sessions, settings, dataset) در LocalStorage مرورگر ذخیره می‌شود.
- برای پخش صوت، اتصال اینترنت لازم است.
- برای تشخیص گفتار (🎙️) مرورگر باید Web Speech API را پشتیبانی کند و زبان آن روی `ar-SA` ست شده است.
