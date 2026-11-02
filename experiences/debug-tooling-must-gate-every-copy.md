---
title: "ابزارِ دیباگ باید در همهٔ کپی‌هایش پشتِ پرچم باشد"
tags: ["security", "privacy", "frontend", "build", "debug-tooling"]
topic_canonical: "debug-tooling-must-gate-every-copy"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-02T20:30:00Z"
created_at: "2026-11-02T20:30:00Z"
updated_at: "2026-11-02T20:30:00Z"
merged_from: []
agents: ["Claude Code"]
---

# Debug tooling must be gated in every copy

## 🎯 چالش / Challenge
یک اسکریپتِ دیباگ (هوک روی console، fetch، XHR، کلیک و ارسالِ همه به `window.parent` با `postMessage(…, '*')`)
در `index.html` پشتِ یک پرچمِ build-time بود و مستندات می‌گفت «در production خاموش است». ولی همان اسکریپت
بی‌پرچم در دو فایلِ JS ِ ورودی هم کپی شده بود؛ پس در production فعال بود و در bundle دیده می‌شد. تست‌ها فقط
نسخهٔ `index.html` را می‌سنجیدند.

## 💡 راه‌حل / Solution
1. همهٔ کپی‌ها را پیدا کن (`grep` روی نشانهٔ یکتا، مثل نامِ متغیرِ global) — نه فقط جایی که مستند شده.
2. یک منبعِ واحد بساز (یک ماژول) و هر کپیِ دیگر را حذف یا به آن ارجاع کن.
3. پرچم را در خودِ ماژول بخوان (`import.meta.env.X === 'true'`) تا bundler در production شاخهٔ مرده را حذف کند.
4. تستی بنویس که **bundle ِ ساخته‌شده** را بگردد، نه فقط سورس را.

## 🧪 نمونه کد (Anonymized)
```js
// debugBridge.js — the only copy
export function installDebugBridge(env = import.meta.env) {
  if (env.VITE_ENABLE_DEBUG_BRIDGE !== 'true') return false;
  /* hooks … */
  return true;
}
```

## ⚠️ نکات حیاتی / Pitfalls
- `postMessage(data, '*')` از داخلِ iframe یعنی هر صفحه‌ای که اپ را embed کند لاگ‌ها و URLهای شبکه را می‌گیرد.
- ماسک‌کردنِ query-string کافی نیست؛ بدنه و هدرها هم ممکن است حساس باشند.
- تستِ «سورس شاملِ شرط است» ثابت نمی‌کند خروجیِ build هم شامل نیست.

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
- [ ] برای هر ابزارِ دیباگ/تلمتری یک نشانهٔ یکتا انتخاب کن و کلِ ریپو (+ `dist/`) را برایش بگرد.
- [ ] یک ماژول، یک پرچم؛ پیش‌فرض خاموش.
- [ ] تستِ پس از build: `grep` روی bundle برای نشانه ⇒ باید صفر باشد وقتی پرچم خاموش است.
- [ ] مستندات را با خروجیِ واقعی تطبیق بده، نه با نیت.

## 🔗 References
- مرتبط: health-ping-is-not-evidence
