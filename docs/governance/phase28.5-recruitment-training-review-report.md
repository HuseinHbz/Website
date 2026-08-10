# Phase 28.5 — Recruitment, training and performance review

> **Status, stated up front.** بند ۱ (recruitment) and بند ۲ (training) are
> built and verified against live PostgreSQL, unconditionally. بند ۳
> (performance review) is built and its own data gate is **implemented and
> tested both ways** (not-ready over an unmanaged workforce, ready once a
> real management chain exists) — the framework, cycles, templates and
> append-only scoring machinery are real and live-PG proven; the ANALYTICAL
> layer (trend/comparison reports) stays out of scope until a real
> organization populates `hr_employment.manager_id` at production scale, per
> the spec's own caution (27's lesson applied to HR). **32/32 live-PG.**

---

## 1. Attestation

| بند | وضعیت | شاهد (عدد/تست) | توضیح |
|---|---|---|---|
| audit اولیه — `courses` | ✅ | تصمیم مستند: کاتالوگ عمومی reuse شد، جدول ثبت‌نام/گواهی جدید ساخته شد | §2 |
| جداول ۱۰ + `company_id` | ✅ | migration روی دیتابیس خالی تمیز اجرا شد؛ همه با `company_id` | — |
| ۱ — کانبان با `usePointerDnd` موجود | ✅ | reuse دقیق همان helper استفاده‌شده در CRM/فرصت‌ها | §3 |
| 🔴 ۱ — عبور از یک مرحله رد می‌شود | ✅ | live: `screening → offer` رد شد | §3 |
| 🔴 ۱ — تبدیل کاندیدا به کارمند از مسیر واقعی ۲۸.۱ | ✅ | live: ردیف واقعی `hr_employees`+`hr_employment` | §3 |
| 🔴 ۱ — دوبار کلیک استخدام → یک کارمند | ✅ | live: `runOnce` + idempotent در لایهٔ داده | §3 |
| ۱ — اتصال دوطرفه کارمند↔کاندیدا | ✅ | `hr_candidates.converted_employee_id` | §3 |
| ۱ — پیشنهاد حقوق از `approval_matrix` | ✅ | doc type جدید `hr_offer` | — |
| ۱ — پورتال عمومی درخواست شغل | ⏳ deferred | دلیل: زمان کافی برای این بند اختیاری در همین پاس نبود؛ فرم عمومی نیازمند فاز جداگانه با ورودی ناشناس + آنتی‌اسپم است | §7 |
| 🔴 ۲ — reuse کاتالوگ آکادمی، نه جدول موازی | ✅ | `hr_training_enrollments.course_id → courses.id` | §2 |
| ۲ — اجباری‌سازی توسط HR | ✅ | `mandatory` flag | — |
| ۲ — پیگیری در پروندهٔ کارمند | ✅ | `allEnrollments` join به `hr_employees` | — |
| ۲ — گزارش پوشش آموزشی | ✅ | live: ۱ از ۱ = ۱۰۰٪، محاسبهٔ واقعی نه حدسی | §4 |
| ۲ — نمایش «دوره‌های من» در پورتال | ✅ | reuse لایهٔ داده پورتال — §6 | — |
| 🔴 ۳ — گیت داده پیش از ساخت تحلیل | ✅ | live: هر دو جهت — بدون مدیر → not ready، با مدیر → ready | §5 |
| ۳ — دفتر append-only ارزیابی | ✅ | live: پس از نهایی‌سازی، resubmit رد شد، نمره دست‌نخورده ماند | §5 |
| 🔴 ۳ — نمرهٔ کلی وزنی، نه میانگین ساده | ✅ | live: 90×0.6+70×0.4=82 | §5 |
| 🔴 ۴ — row scope ارزیابی (IDOR) | ✅ | live: مدیر واقعی می‌بیند، مدیر نامرتبط نمی‌بیند | §5 |
| ۴ — کلیدهای رجیستری + op حساس | ✅ | `hr.recruitment:{offer,hire}`، `hr.reviews:finalize`؛ `audit:rbac` 167/0 | §6 |
| ۴ — دسترسی به رزومه در لاگ | ✅ | `logAction` روی create کاندیدا | — |
| gates استاتیک | ✅ | TS 0 · ESLint 0 · ۱۲ ممیزی ۰ · build تمیز | — |
| رگرسیون‌ها | ✅ | **۲۲/۲۲** (سوئیت جدید #۱۶ اضافه شد) | — |

---

## 2. 🔴 Audit اولیهٔ `courses` — نتیجه

قبل از هر جدول جدید، `courses`/`course_categories`/`course_lessons` بررسی
شد: این جداول کاتالوگ **عمومی** سایت هستند — بدون `employee_id`، بدون
`company_id`، بدون مفهوم «ثبت‌نام اجباری» یا «وضعیت تکمیل»، و `instructor_id`
به `users` وصل است نه `hr_employees`. این یک تفاوت ساختاری واقعی است، نه
بهانه‌ای برای دوباره‌کاری — **تصمیم**: کاتالوگ reuse شد (`course_id` FK از
`hr_training_enrollments`)، فقط لایهٔ ثبت‌نام/تکمیل/گواهی جدید ساخته شد.
همچنین جدول `certifications` (نمایشگر عمومی مدارک حسین) بررسی و به همین
دلیل کنار گذاشته شد — آن یک ویترین تک‌مالکیتهٔ سایت است، نه جدول چندکارمندی.

```
✅ a course exists in the SAME courses table the public academy reads
```

## 3. بند ۱ — استخدام

کانبان مراحل دقیقاً از همان `usePointerDnd` استفاده می‌کند که CRM
فرصت‌ها/لیدها استفاده می‌کنند — بدون پیاده‌سازی drag جدید. ماشین‌حالت مراحل
(`canTransition`) خالص و واحدتست‌شده است؛ رد شدن پرش از یک مرحله در سطح
داده هم اثبات شده، نه فقط UI:

```
✅ 🔴 skipping interview_2 is refused by the same guard the kanban uses
```

تبدیل کاندیدا به کارمند دقیقاً از تابع ۲۸.۱ (`createEmployee` +
`addEmploymentRecord`) عبور می‌کند — بدون insert موازی — و در لایهٔ داده
هم idempotent است (نه فقط با `runOnce` سطح روت):

```
✅ 🔴 a REAL hr_employees row exists — the exact 28.1 table, no parallel insert
✅ 🔴 a REAL hr_employment row exists with the offered salary
✅ 🔴 the candidate keeps a two-way link to the employee it became
✅ 🔴 a repeated hire call (double-click) returns the SAME employee, not a second one
✅ 🔴 exactly ONE employee exists for this candidate
```

## 4. بند ۲ — آموزش

گزارش پوشش، حاصل جمع واقعی از دو کوئری روی همان جدول ثبت‌نام است — نه یک
عدد حدسی:

```
✅ 🔴 coverage report is real arithmetic — 1/1 completed = 100%
```

## 5. 🔴 بند ۳ — گیت داده و ارزیابی append-only

گیت (`reviewDataGate`) نسبت کارمندان فعال دارای مدیر واقعی در
`hr_employment.manager_id` را می‌سنجد؛ آستانه ۵۰٪. هر دو طرف گیت live-PG
اثبات شد — روی یک نیروی کار عملاً بدون مدیر «آماده نیست» و پس از ساخت یک
زنجیرهٔ مدیریتی واقعی «آماده است»:

```
✅ 🔴 with a workforce mostly WITHOUT a manager on file, the gate reports NOT ready — coverage 0% of 1
✅ 🔴 once most active employees have a real manager on file, the gate reports ready — coverage 50%
```

نمرهٔ کلی وزنی از معیارهای قالب محاسبه می‌شود، نه میانگین ساده (که در آن
همهٔ معیارها یکسان وزن می‌گیرند حتی اگر تعریف‌شده نباشند):

```
✅ 🔴 the overall score is the weighted average (90×0.6+70×0.4=82), not a plain mean
```

نهایی‌سازی مرز append-only است — پس از آن هیچ ثبت دوباره‌ای نمره را
بازنویسی نمی‌کند؛ نهایی‌سازی دوباره idempotent است نه خطا:

```
✅ 🔴 a finalized review REFUSES a resubmit — the score cannot be silently overwritten
✅ 🔴 the original score survives the resubmit attempt untouched
✅ finalizing an already-finalized review is idempotent, not an error
```

## 6. بند ۴ — امنیت و دسترسی

- کلیدهای رجیستری تولیدشده از `workspaces.ts`: `hr.recruitment` (با op
  حساس `offer`, `hire`)، `hr.training`، `hr.reviews` (با op حساس
  `finalize`) — `audit:rbac` **167 guarded · 0 failures**.
- 🔴 row scope دستی (نه از طریق `rowScopeSql` عمومی، چون شکل داده متفاوت
  است — مصاحبه‌کننده/مدیر، نه owner_id ساده): مصاحبه‌کننده بدون op
  `hr.recruitment:hire` فقط مصاحبه‌های خودش را می‌بیند؛ مدیر بدون op
  `hr.reviews:finalize` فقط ارزیابی گزارش‌دهندگان مستقیم خودش را (از
  `hr_employment.manager_id`) — این محدودیت صادق است، به `SCOPED_MODULES`
  عمومی اضافه نشد چون آن رجیستری فرض «all/own/department» عمومی دارد که
  الگوی این ماژول‌ها با آن تطبیق ندارد.
- دسترسی به رزومهٔ کاندیدا در `logAction` روی ایجاد کاندیدا ثبت می‌شود.

```
✅ 🔴 the real manager sees the review of their own report
✅ 🔴 an unrelated manager sees NONE of it
```

## 7. باقی‌ماندهٔ صریح — پورتال عمومی درخواست شغل

بند ۱ یک آیتم اختیاری («اگر زمان باقی بود») برای فرم عمومی ثبت رزومه در
سایت داشت. **deferred با دلیل صریح**: این فرم یک سطح احراز جدید (ورودی
ناشناس، آپلود فایل بدون نشست) نیاز دارد که خارج از زمان این پاس بود و باید
با همان انضباط ضدهرزنامه/rate-limit پیام‌های ورودی ۲۶.۲۵b طراحی شود، نه
عجولانه. ماژول کاندیدا از سمت ادمین کاملاً کار می‌کند؛ فقط منبع ورودی
دستی است تا این فرم ساخته شود.

## 8. Gates

TS 0 · ESLint 0 · **1153 unit tests** (93 files، ۶ تست جدید ماشین‌حالت) ·
12 audits 0 (`audit:rbac` 167/12/0) · build clean ·
**22/22 regression suites** (`npm run regressions`، سوئیت جدید
`scripts/verify-28-5-recruitment.ts` **32/32**).

## 9. تأیید مرورگری

طبق دستور spec، هر ماژول باید در هر دو زبان و هر دو تم تأیید مرورگری شود.
سه صفحهٔ جدید (`/admin/recruitment`, `/admin/training`, `/admin/reviews`)
هر سه از `AdminShell` عبور می‌کنند (`audit:shell` 91/0)، در رجیستری منو
ثبت‌شده‌اند (`audit:nav` 101/0) و از توکن‌های تم موجود استفاده می‌کنند
(`audit:theme` 0). چرخهٔ کامل داده (کاندیدا→کارمند، ثبت‌نام→تکمیل،
ارزیابی→نهایی‌سازی) روی PostgreSQL واقعی اثبات شده است؛ تأیید بصری
دومرحله‌ای (کلیک واقعی در مرورگر روی سرور در حال اجرا با دو کاربر) — مانند
۲۸.۴ — منتظر اجرای نگهدارنده روی محیط زنده می‌ماند.

## 10. خط سیر (Changelog)

- افزوده: `hr_job_openings`, `hr_candidates`, `hr_applications`,
  `hr_interviews`, `hr_offers`, `hr_training_enrollments`,
  `hr_training_certificates`, `hr_review_cycles`, `hr_review_templates`,
  `hr_reviews`, `hr_okrs` (idempotent، همه با `company_id`).
- افزوده: `hr_offer`, `hr_review` به `DOC_TYPES` موتور تأیید + قوانین
  پیش‌فرض.
- افزوده: `src/lib/hr/{recruitment,recruitmentData,trainingData,reviewData}.ts`.
- افزوده: `/api/admin/hr/{recruitment,training,reviews}` + سه صفحهٔ ادمین
  (Recruitment, Training, Performance Reviews) در گروه HR.
- افزوده: `hr.recruitment`, `hr.reviews` به `SENSITIVE_OPS`.
- افزوده: `scripts/verify-28-5-recruitment.ts` (رگرسیون #۱۶) +
  `src/lib/hr/__tests__/recruitment.test.ts`.
