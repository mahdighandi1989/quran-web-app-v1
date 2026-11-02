---
title: "آدرسِ پایه‌ای که کاربر تعیین می‌کند = SSRF در سرور"
tags: ["security", "ssrf", "proxy", "llm", "node"]
topic_canonical: "user-supplied-base-url-is-ssrf"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-02T21:00:00Z"
created_at: "2026-11-02T21:00:00Z"
updated_at: "2026-11-02T21:00:00Z"
merged_from: []
agents: ["Claude Code"]
---

# A user-supplied base URL is SSRF

## 🎯 چالش / Challenge
یک پراکسیِ LLM («پروایدرِ سفارشی» با Base URL) درخواست را از طرفِ کاربر به هر آدرسی می‌فرستاد؛ پس هر کسی می‌توانست
سرور را وادار کند به `169.254.169.254` (metadata)، localhost یا شبکهٔ خصوصی وصل شود. CORS هم `*` بود، یعنی هر سایتی
سرور را رله می‌کرد.

## 💡 راه‌حل / Solution
1. پیش از هر fetch: فقط `https`، بی‌نام‌کاربری/رمز، نامِ میزبانِ داخلی ممنوع، و **همهٔ** آدرس‌های resolveشده عمومی.
2. همین نگهبان در **هر** مسیری که آدرس را مصرف می‌کند (پراکسیِ وب و دستورهای بات) — بهتر در خودِ کلاینتِ HTTP.
3. CORS فقط برای originهای خودِ اپ؛ محدودیتِ نرخ برای هر IP.
4. تست: درخواست با آدرسِ داخلی ⇒ 400 **و** هیچ fetchی انجام نشده.

## 🧪 نمونه کد (Anonymized)
```js
const addrs = await dns.lookup(host, { all: true });
if (addrs.some(a => isPrivate(a.address))) throw new Error('internal address');
```

## ⚠️ نکات حیاتی / Pitfalls
- DNS می‌تواند به آدرسِ داخلی اشاره کند — فقط رشتهٔ URL را نسنج.
- `::ffff:127.0.0.1` و `100.64/10` و `fd00::/8` را فراموش نکن.
- متغیرِ ماژولیِ مشترک برای هدرهای CORS در سرورِ async بینِ درخواست‌ها نشت می‌کند؛ per-request بساز.

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
- [ ] `grep` برای هر `fetch(` که بخشی از URL از ورودی/داده‌ی کاربر می‌آید.
- [ ] نگهبان را در لایهٔ HTTP بگذار، نه در یک endpoint.
- [ ] یک بررسیِ production که آدرسِ داخلی را می‌فرستد و 400 می‌خواهد.

## 🔗 References
- مرتبط: debug-tooling-must-gate-every-copy
