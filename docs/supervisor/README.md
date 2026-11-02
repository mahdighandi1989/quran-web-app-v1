# «نظارت و سرکشی» و ناظرِ خودکار — مرکز حفظ قرآن

مالک (مدیر) در برنامه دکمهٔ **«📝 نظارت»** (گوشهٔ پایینِ صفحه، فقط پس از ورود) را روشن می‌کند، روی هر صفحه دورِ
ایراد یا پیشنهاد **کادر** می‌کشد، متن می‌نویسد و **هر نوع فایلی** پیوست می‌کند. برگه در تبِ **«نظارت»** (`/inspection`)
دیده می‌شود. دو **Routine** (زمان‌بندِ Claude Code) برگه‌ها را می‌خوانند، کار را انجام می‌دهند، زیرِ برگه جواب
می‌نویسند و سامانه را بازرسی می‌کنند. کارِ مالک فقط ثبتِ برگه، «⚡ فوری» در صورتِ نیاز، و **تیکِ تأیید** است.

## چرخهٔ یک برگه
| وضعیت (`status`) — گفت‌وگو کجاست | چه کسی | |
|---|---|---|
| `pending` | برگهٔ کاربرِ غیرِمدیر | تا مدیر «پذیرش» نزند به ناظر نمی‌رسد |
| `open` | منتظرِ ناظر | |
| `answered` | ناظر جواب داد | جوابِ `partial`/`not-done` دورِ بعد برمی‌گردد |
| `approved` | **فقط مالک** تیک زد | |
| `filed` | ناظر/مالک بایگانی کرد (زونکن‌های ۴۰تایی) | بسته |
| `declined` | مدیر رد کرد | نگه داشته می‌شود، بسته |

نتیجهٔ واقعی (`outcome`، روی یادداشتِ ناظر): `fixed` · `partial` · `not-done` · `needs-owner`. رنگِ هایلایت از نتیجه
مشتق می‌شود: نارنجی = منتظر · سبز = `fixed` **با** تصویرِ بعد · آبی = تأییدِ مالک.

**نگهبان‌های سمتِ سرور** (`server/inspection.mjs`، تست در `server/test/inspection.test.mjs`): `fixed` بی‌تصویرِ بعد یا
بی‌کامیت رد می‌شود؛ برگهٔ «اینجا»دار بی‌`place` رد می‌شود؛ جوابِ بی‌زنجیرهٔ وابستگی رد می‌شود؛ جوابِ برگه‌ای که پیوستِ
خوانده‌نشده دارد رد می‌شود؛ تیک/فوری/پذیرش فقط مدیر (حسابِ ناظر ۴۰۳)؛ **حذف برای هیچ‌کس** (۴۰۵).

## روتین‌ها
| مورد | دورِ کامل | صفِ فوری |
|---|---|---|
| نام | ناظرِ خودکار — قرآن (دورِ کامل) | صفِ فوریِ نظارت — قرآن (ساعتی) |
| شناسه | `trig_01UvNwtggi9d2xP4MtszJGpo` | `trig_01Ut8dq6SDo5RG8pJiDrRStr` |
| زمان‌بندی | `CRON_TZ=Asia/Dubai 47 4 * * 1,4` — دوشنبه و پنجشنبه ۰۴:۴۷ دبی | هر ساعت، دقیقهٔ ۲۳ (UTC) |
| دستور (تنها مرجع) | [`PROMPT.md`](PROMPT.md) | [`URGENT_PROMPT.md`](URGENT_PROMPT.md) |
| نشست | هر اجرا نشستِ تازه · اعلان push | هر اجرا نشستِ تازه · صفِ خالی = بی‌صدا |

پرامپتِ داخلِ هر Routine **عمداً کوتاه و ثابت** است: مخزن را بگیر، `main` را بگیر، این فایل را بخوان و اجرا کن.

> **کارِ یک‌باره‌ی مالک (2026-11-02):** روتینی که با ابزار ساخته می‌شود **مخزن ندارد** (`sources: []`). در
> claude.ai › Routines › هر دو روتین › Edit › «Select a repository» ⇒ `mahdighandi1989/quran-web-app-v1` ⇒ Save.
> صفِ فوری تا آن موقع **خاموش** است تا هر ساعت خطا نفرستد؛ بعد از افزودنِ مخزن روشنش کن.

## حسابِ ناظر و مدیر — بی‌هیچ رازی در ریپو
روی سرویسِ `quran-telegram-bot` در Render:
- `SUPERVISOR_PASSWORD` — رمزِ تصادفی که مستقیم روی Render ساخته شد (2026-11-02). ناظر با آن وارد می‌شود و یک نشستِ
  ۱۲ساعته (HMAC) می‌گیرد؛ ۵ ورودِ ناموفق در ۱۵ دقیقه ⇒ ۴۲۹. ناظر هیچ‌گاه مدیر نیست.
- `ADMIN_EMAILS` — ایمیل(های) گوگلِ مدیر، جدا با ویرگول. فقط ایمیلِ **تأییدشده** در توکنِ Firebase حساب می‌شود.

اسکریپت‌ها آدرس و رمز را **در زمانِ اجرا** از Render API می‌خوانند (پروکسیِ محیطِ Claude Code میزبانِ `api.render.com`
را احراز می‌کند). رمز نه چاپ می‌شود نه روی دیسک می‌رود. اجرای محلی: `QS_API_BASE`، `QS_SUPERVISOR_PASSWORD`.

## اسکریپت‌ها
```bash
python3 scripts/supervisor/inspection.py whoami   # ورودِ ناظر
python3 scripts/supervisor/inspection.py file     # تیک‌خورده‌ها → زونکن
python3 scripts/supervisor/inspection.py pull     # QUEUE.md + shots/ + files/ (خروجِ ۴ = بدهی)
python3 scripts/supervisor/inspection.py urgent   # یک برگهٔ فوری (۰ خالی · ۵ برداشته شد · ۳ خطا)
python3 scripts/supervisor/inspection.py answer N --text-file a.md --outcome … [--after x.png] [--commit sha] --dep '…' [--place …]
python3 scripts/supervisor/screenshot.py /practice --selector "…" --out after.png   # عکسِ «بعد» در Chromium
python3 scripts/supervisor/prod_check.py          # بازرسیِ فقط‌خواندنیِ production (جریانِ واقعی، نه ping)
python3 scripts/supervisor/deploys.py             # وضعیتِ انتشار در Render
```

## چطور دستورِ ناظر را عوض کنم؟
**فایل را ویرایش کن، نه پرامپتِ Routine را:**
1. `cp docs/supervisor/PROMPT.md docs/supervisor/archive/PROMPT-v{N}-{YYYY-MM-DD}.md` (برای صفِ فوری `URGENT_PROMPT-v{N}-…`).
2. ویرایش؛ در frontmatter `version` را یک واحد جلو ببر، `updated` امروز، `supersedes` مسیرِ بایگانی؛ عنوانِ «نسخهٔ N» را هم عوض کن.
3. `scripts/ship.sh "docs(supervisor): …"`. اجرای بعدیِ روتین نسخهٔ تازه را می‌خواند. نسخه‌های قبلی هرگز پاک نمی‌شوند.

## فایل‌ها
| فایل | نقش |
|---|---|
| `PROMPT.md` / `URGENT_PROMPT.md` | دستورِ روتین‌ها — تنها مرجع |
| `archive/` | نسخه‌های قبلیِ دستورها |
| `RUNLOG.md` | گزارشِ هر اجرا، جدیدترین در انتها |
| `OPEN_ITEMS.md` | کارهای بازِ انتقالی بینِ اجراها |
| `inspection/` | پوشهٔ کاریِ کارتابل (QUEUE/URGENT/shots/files — در git نیستند) |
| `last_prod_check.json`، `last_deploys.json` | خروجیِ آخرین بازرسی (در git نیستند) |

## داده
Firestore ِ همین پروژه: `inspectionReports/{number}`، `inspectionFiles/{id}` (متنِ استخراج‌شده + پیشرفتِ خواندنِ ناظر)،
`inspectionBlobs` + `inspectionBlobChunks` (بایت‌های تصویر و پیوست، تکه‌های ۷۰۰KB)، `inspectionMeta` (شمارنده، زونکن).
این مجموعه‌ها با قاعدهٔ پیش‌فرضِ `firestore.rules` به روی مرورگر بسته‌اند؛ فقط سرور (Admin SDK) می‌خواند/می‌نویسد.
