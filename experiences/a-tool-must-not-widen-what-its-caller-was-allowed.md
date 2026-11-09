---
title: "ابزار نباید بی‌صدا از اجازهٔ فراخواننده‌اش فراتر برود"
tags: ["routines", "secrets", "supervisor", "tooling"]
topic_canonical: "a-tool-must-not-widen-what-its-caller-was-allowed"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-09T04:40:00Z"
created_at: "2026-11-09T04:40:00Z"
updated_at: "2026-11-09T04:40:00Z"
merged_from: []
agents: ["Claude Code"]
---

# ابزار نباید بی‌صدا از اجازهٔ فراخواننده‌اش فراتر برود

## 🎯 چالش / Challenge
پرامپتِ یک روتینِ بی‌ناظر فقط اجازهٔ خواندنِ رمز از متغیرِ محیطی می‌داد؛ ابزارِ مشترک وقتی متغیر نبود «برای راحتی» رمز را از API ِ میزبان می‌خواند. روتین تخلف را پس از اجرا دید، خودش را متوقف کرد و کاری که برداشته بود بی‌جواب ماند — بیش از یک بار، با وضعیتِ «موفق».

## 💡 راه‌حل / Solution
1. راهِ جایگزینِ خواندنِ اسرار را **opt-in ِ صریح** کن (یک متغیرِ جدا)، نه fallback ِ خودکار.
2. نبودِ راز ⇒ خطای روشن با «کجا بگذار» و کدِ خروجِ «نتوانستم ببینم».
3. نامی که پرامپت‌ها می‌برند و نامی که ابزار می‌خواند یکی باشد (یا هر دو پذیرفته شوند)، با تست.

## 🧪 نمونه کد (Anonymized)
```
if not password and env("ALLOW_HOST_SECRET") != "1":
    raise ToolError("secret not in this run's environment — set it in the routine environment")
```

## ⚠️ نکات حیاتی / Pitfalls
- منبعِ هر راز را در **کدِ** ابزار بخوان، نه در مستنداتش.
- «SUCCEEDED» ِ روتین یعنی تمام شد، نه یعنی کاری انجام داد؛ رونوشت را بخوان.

## ✅ Resolution
- Status: resolved
- Evidence: سه تستِ واحد: نبودِ رمز ⇒ خطا بی‌خواندنِ env-vars؛ نامِ متغیرِ پرامپت پذیرفته؛ خواندن از میزبان فقط با opt-in.

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
### Applies when
- هر ابزارِ مشترکی که روتین‌ها/agentهای با مجوزهای متفاوت صدا می‌زنند و راز می‌خواند.
### Does NOT apply when (anti-pattern)
- اسکریپتِ شخصیِ یک‌نفره که منبعِ راز را خودِ اجراکننده انتخاب می‌کند.
### Prerequisites
- یک تستِ واحد که فراخوانیِ API ِ میزبان را mock و شمارش کند.
