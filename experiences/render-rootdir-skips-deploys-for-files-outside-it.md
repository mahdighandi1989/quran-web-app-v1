---
title: "rootDir در Render: تغییرِ فایلِ بیرون از آن سرویس را دیپلوی نمی‌کند"
tags: ["render", "deploy", "monorepo", "node"]
topic_canonical: "render-rootdir-skips-deploys-for-files-outside-it"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-02T20:30:00Z"
created_at: "2026-11-02T20:30:00Z"
updated_at: "2026-11-02T20:30:00Z"
merged_from: []
agents: ["Claude Code"]
---

# Render rootDir skips deploys for files outside it

## 🎯 چالش / Challenge
سرویسِ نود با `rootDir: server` ساخته شده، ولی کدش یک ماژولِ مشترک را از بیرون (`../src/lib/x.js`) import
می‌کند. Render فقط وقتی سرویس را دوباره می‌سازد که کامیت فایلی **داخلِ** rootDir را عوض کند؛ پس اصلاحِ ماژولِ
مشترک در frontend منتشر می‌شود ولی سرور با نسخهٔ قدیمی می‌ماند — دو لایه بی‌صدا واگرا می‌شوند.

## 💡 راه‌حل / Solution
یکی از این‌ها:
1. `buildFilter.paths` را در blueprint شاملِ مسیرهای مشترک کن (`server/**`, `src/lib/x.js`).
2. یا هر بار که ماژولِ مشترک عوض شد، یک نشانهٔ نسخه داخلِ rootDir (مثلاً `BUILD_TAG`) را هم عوض کن.
3. پس از push، شناسهٔ کامیتِ deployِ زندهٔ **هر** سرویس را با `main` مقایسه کن (Render API: `/services/{id}/deploys`).

## 🧪 نمونه کد (Anonymized)
```yaml
services:
  - type: web
    rootDir: api
    buildFilter:
      paths: ["api/**", "shared/rules.js"]
```

## ⚠️ نکات حیاتی / Pitfalls
- سرویسی که دستی (نه از blueprint) ساخته شده، `render.yaml` را نمی‌خواند؛ تنظیم را در خودِ سرویس ببین.
- «Deploy live» روی داشبورد یعنی آخرین deploy ِ آن سرویس، نه آخرین کامیتِ main.

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
- [ ] هر import ِ بیرون از rootDir را فهرست کن (`grep -rn "\.\./" api/`).
- [ ] برای هرکدام buildFilter یا نشانهٔ نسخه بگذار.
- [ ] در بازرسیِ دوره‌ای، کامیتِ live ِ هر سرویس را با main و با مسیرهایش مقایسه کن.

## 🔗 References
- مرتبط: debug-tooling-must-gate-every-copy
