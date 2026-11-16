---
title: "clone ِ shallow کامیتِ مرزی را «منتشرنشده» نشان می‌دهد"
tags: ["git", "deploy", "monitoring", "ci", "routines"]
topic_canonical: "shallow-clone-fakes-undeployed-commits"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-16T01:30:00Z"
created_at: "2026-11-16T01:30:00Z"
updated_at: "2026-11-16T01:30:00Z"
merged_from: []
agents: ["ناظرِ خودکار (Claude Code routine)"]
---

# clone ِ shallow کامیتِ مرزی را «منتشرنشده» نشان می‌دهد

## 🎯 چالش / Challenge
ابزارِ پایشِ انتشار با `git log <live-commit>..origin/main -- <paths>` می‌شمرد کدام کامیت‌ها هنوز روی سرویس نرفته‌اند. در کانتینرِ تازه‌ای که مخزن را با `--depth` کلون کرده بود، کامیتِ مرزیِ shallow بی‌والد دیده می‌شد، به کامیتِ live وصل نبود و «همهٔ فایل‌ها را تغییر داده بود» ⇒ هشدارِ P1 «کامیتِ منتشرنشده» برای کامیتی که سه روز **قدیمی‌تر** از نسخهٔ live بود.

## 💡 راه‌حل / Solution
1. پیش از هر محاسبهٔ بازه‌ای روی تاریخچه: `git rev-parse --is-shallow-repository`؛ اگر `true`، `git fetch --unshallow`.
2. اگر unshallow نشد، عدد را «اندازه‌گیری‌نشده» (`null`) گزارش کن، نه «مشکل» و نه «صفر».
3. پیش از اقدام بر اساسِ هشدار، یک بار ببین کامیتِ گزارش‌شده والد دارد و از کامیتِ live جدیدتر است.

## 🧪 نمونه کد (Anonymized)
```python
def pending(paths, since):
    if run(["git", "rev-parse", "--is-shallow-repository"]).strip() == "true":
        return None            # unmeasured — caller must not turn this into a problem
    return run(["git", "log", "--format=%H", f"{since}..origin/main", "--", *paths]).split()
```

## ⚠️ دام‌ها / Pitfalls
- `git merge-base --is-ancestor` در clone ِ shallow هم دروغ می‌گوید (مرز ریشه است).
- «۰ کامیتِ منتشرنشده» از یک clone ِ shallow هم به همان اندازه بی‌اعتبار است که «۱».

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
هر اسکریپتی که در CI یا روتینِ ابری «بینِ دو کامیت» را می‌شمرد (changelog، تشخیصِ سرویسِ تغییرکرده، پایشِ انتشار) باید عمقِ تاریخچه را بسنجد یا عمق را کامل کند.

## 🔗 مرتبط / Related
- render-rootdir-skips-deploys-for-files-outside-it.md
