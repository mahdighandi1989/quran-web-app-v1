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
اپ یک پیکربندی پیش‌فرضِ **عمومیِ** Firebase داخل `src/lib/firebase.js` دارد، پس بدون هیچ
تنظیمی کار می‌کند. اگر می‌خواهید برای محیط خودتان آن را override کنید، متغیرهای محیطی
`VITE_*` را تنظیم کنید — این مقادیر بر پیش‌فرض **اولویت** دارند (Vite آن‌ها را در زمان build
تزریق می‌کند). کلید web فایربیس «سِکرت» نیست؛ امنیت با محدودسازی کلید + Authorized domains اعمال می‌شود.

1) (اختیاری) فایل نمونه را کپی کنید:
```bash
cp .env.example .env
```
2) در `.env` مقادیر پروژهٔ Firebase خود را قرار دهید
   (`VITE_FIREBASE_API_KEY`، `VITE_FIREBASE_AUTH_DOMAIN`، `VITE_FIREBASE_PROJECT_ID`،
   `VITE_FIREBASE_STORAGE_BUCKET`، `VITE_FIREBASE_MESSAGING_SENDER_ID`،
   `VITE_FIREBASE_APP_ID`، `VITE_FIREBASE_MEASUREMENT_ID`) — از
   Firebase console → Project settings → General → Your apps.
3) فایل `.env` در `.gitignore` است و **نباید** commit شود.
4) برای **استقرار (deploy)** در صورت تمایل همین متغیرها را در environment پلتفرم میزبان
   (Render/Vercel/Netlify) ست کنید؛ در غیر این صورت پیش‌فرضِ داخلی استفاده می‌شود.

### Inspector Bridge (ابزار دیباگ، اختیاری)
اسکریپت Inspector Bridge داخل `index.html` فقط زمانی فعال می‌شود که
`VITE_ENABLE_INSPECTOR_BRIDGE=true` باشد. در production (پیش‌فرض) کاملاً غیرفعال است و
هیچ اتصال WebSocket یا خطایی در کنسول ایجاد نمی‌کند. برای فعال‌سازی در توسعهٔ محلی، آن را
در `.env` روی `true` بگذارید (و در صورت نیاز `window.__INSPECTOR_WS_URL__` را پیش از بارگذاری ست کنید).

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

## مجوز (License)
این پروژه تحت مجوز [MIT](./LICENSE) منتشر شده است. متن کامل در فایل `LICENSE` قرار دارد.
