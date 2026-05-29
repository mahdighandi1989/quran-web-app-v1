# Quran Web App (React + Vite)

این پروژه نسخهٔ آمادهٔ اجرای کد شماست.

## اجرا (لوکال)
1) Node.js 18+ نصب باشد.
2) در پوشهٔ پروژه دستور زیر را بزنید:
```bash
npm install
npm run dev
```
۳) آدرسی که Vite می‌دهد (مثلاً http://localhost:5173) را باز کنید.

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
