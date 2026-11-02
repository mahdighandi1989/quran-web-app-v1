---
title: "همگام‌سازی هنگامِ ورود باید ادغام کند، نه جایگزین"
tags: ["sync", "data-loss", "offline", "cloud-backup", "frontend"]
topic_canonical: "sync-on-login-must-merge-not-replace"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-02T21:00:00Z"
created_at: "2026-11-02T21:00:00Z"
updated_at: "2026-11-02T21:00:00Z"
merged_from: []
agents: ["Claude Code"]
---

# Sync on login must merge, not replace

## 🎯 چالش / Challenge
اپ داده را محلی نگه می‌دارد و پس از ورود با یک فایلِ ابری همگام می‌کند و «نسخهٔ ابری مرجع است». هر رکوردی که در
فاصلهٔ ناهمگامی (خروج، توکنِ منقضی، آفلاین) فقط محلی ساخته شده بود، با ورودِ بعدی بی‌صدا پاک می‌شد.

## 💡 راه‌حل / Solution
1. برای مجموعه‌های **افزایشی** (جلسه، رویداد، نشان) اجتماع بگیر با کلیدِ پایدار (id)؛ روی همان کلید نسخهٔ ابری برنده.
2. برای مقدارهای **تکی** (تنظیمات) «ابری برنده» بماند.
3. نشانگرِ «آخرین وضعیتِ همگام» را **نسخهٔ ابریِ بی‌ادغام** بگذار تا ذخیرهٔ خودکار نتیجهٔ ادغام را بالا بفرستد.

## 🧪 نمونه کد (Anonymized)
```js
function mergeRecords(remote, local) {
  const m = new Map();
  for (const r of local || []) m.set(String(r.id), r);
  for (const r of remote || []) m.set(String(r.id), r); // remote wins on same id
  return [...m.values()].sort((a, b) => a.createdAt - b.createdAt);
}
```

## ⚠️ نکات حیاتی / Pitfalls
- اگر نشانگرِ همگام را برابرِ نتیجهٔ ادغام بگذاری، ادغام هرگز آپلود نمی‌شود.
- رکوردِ بی‌id ⇒ کلیدِ جایگزین (زمانِ شروع) لازم است، وگرنه تکراری می‌شود.
- callbackِ ثبت‌شده یک‌بار (مثلاً listenerِ auth) مقادیرِ رندرِ اول را می‌بیند؛ مطمئن شو «محلی» همان چیزی است که فکر می‌کنی.

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
- [ ] هر جا «remote wins on login» هست، داده را به افزایشی/تکی تقسیم کن.
- [ ] تست: رکوردِ فقط‌محلی + رکوردِ مشترک + رکوردِ فقط‌ابری ⇒ هر سه بمانند.
- [ ] بعد از ادغام، یک‌بار آپلود را مشاهده کن (نه فقط state).

## 🔗 References
- مرتبط: debug-tooling-must-gate-every-copy
