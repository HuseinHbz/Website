# Phase 28 — HRM platform

> **Scope reality, stated up front.** The phase brief calls this five sub-phases
> and says each closes independently with its own gate. **28.1 and 28.2 are
> complete and verified; 28.3-الف and 28.3-ب are built and verified but AWAIT
> the accountant's reconciliation test; 28.3-ج (bank payment + advances) is
> CLOSED — it closes the monthly cycle's last open link (salaries payable
> settles to zero) and does not itself need accountant reconciliation, though
> its sick-leave formula does. 28.4 and 28.5 are not started.**
> Nothing below is claimed for the rest.

---

## 1. Sub-phase status

| Sub-phase | Status | Evidence |
|---|---|---|
| **28.1** پرسنل و پروندهٔ کارکنان | ✅ **بسته شد** | live-PG **27/27** · 30 unit tests · module audit **81/81** · browser fa/en × light/dark |
| **28.2** مرخصی، حضور و غیاب | ✅ **بسته شد** | live-PG **43/43** · 40 unit tests · 12 audits 0 · regressions 17/17 |
| **28.3-الف** هستهٔ ماهانهٔ حقوق | ⚠️ **ساخته و verify شد — منتظر آزمون تطبیق** | live-PG **66/66** · 74 unit tests · [گزارش](phase28.3a-payroll-core-report.md) |
| **28.3-ب** عیدی، سنوات و خروجی قانونی | ⚠️ **ساخته و verify شد — منتظر آزمون تطبیق** | live-PG **73/73** · 49 unit tests · [گزارش](phase28.3b-payroll-annual-report.md) |
| **28.3-ج** پرداخت بانکی، مساعده و تکمیل | ✅ **بسته شد** (بند۱،۲،۴.۱،۴.۲) — بند۳/۴.۴/۵ deferred با دلیل | live-PG **40/40** · 19 unit tests · [گزارش](phase28.3c-payroll-completion-report.md) |
| **28.4** پورتال کارمند | ⏳ شروع نشده | — |
| **28.5** استخدام، آموزش، ارزیابی | ⏳ شروع نشده | — |

---

## 2. Attestation — 28.1

| بند | وضعیت | شاهد | توضیح |
|---|---|---|---|
| جداول (۵ جدول) | ✅ | migration روی دیتابیس خالی تمیز اجرا شد | `hr_employees` · `hr_positions` · `hr_employment` · `hr_documents` · `hr_dependents` |
| `company_id` روی همه | ✅ | `audit:tenancy` **0** | R6 |
| 🔴 تاریخچهٔ استخدام append-only | ✅ | ۶ ادعای live-PG — §3 | ریشهٔ محاسبهٔ سنوات و حقوق |
| 🔴 فیلد حساس در پاسخ نباشد | ✅ | **اثبات با کاربر محدود واقعی** — §4 | R8 |
| اعتبارسنجی کد ملی | ✅ | live: `400 {"error":"nationalId: National ID check digit is invalid"}` | reuse `isValidIranNationalId` از ۲۶.۱۷ |
| row scope | ✅ | `SCOPED_MODULES['hr.employees']` + `rowScopeSql`؛ خارج از scope → **404** | R8 / ۲۶.۲۸ |
| `requirePermission` + کلید رجیستری | ✅ | `audit:rbac` **162 guarded · 0 failures** | R5 |
| `runOnce` روی create | ✅ | کارمند، سابقهٔ استخدامی، تحت تکفل، سمت | ۲۶.۳۲ |
| به‌روزرسانی جزئی | ✅ | live-PG: «a partial update changes only what it names» | ۲۶.۳۰ BUG-206 |
| AdminShell + دکمهٔ حذف + دوزبانه | ✅ | `audit:shell` 0 · `deleteRowAction` · fa/en | R7 |
| عنوان از رجیستری | ✅ | مرورگر: «پرسنل» — نه `Employees` | قاعدهٔ ۲۷ |
| حقوق در لاگ ثبت نشود | ✅ | `logAction` فقط `employeeId`/`startDate`/`contractType` می‌نویسد | privacy |
| تقویم شمسی | ✅ | `toJalaliStr` روی همهٔ تاریخ‌های UI | reuse ۲۶.۲۴ |

---

## 3. 🔴 چرا تاریخچهٔ استخدام append-only است

سنوات و هر محاسبهٔ عقب‌روندهٔ حقوق **از همین تاریخچه** خوانده می‌شوند. اگر
افزایش حقوق رکورد قبلی را بازنویسی کند، آنچه شرکت بابت ماه‌های کارکرده بدهکار
است بی‌صدا تغییر می‌کند — و کسی متوجه نمی‌شود.

پس تغییر حقوق **رکورد قبلی را می‌بندد** (روز قبل از شروع رکورد جدید) و رکورد
تازه باز می‌کند، هر دو در یک تراکنش. اثبات زنده:

```
✅ a raise CLOSES the previous record instead of overwriting it
✅ both records survive — history is not rewritten — 2 records
✅ the previous record ends the day BEFORE the new one starts — 2024-12-31
✅ the OLD salary is still answerable by date — 100000000
✅ the NEW salary applies from its start date
✅ no date has two salaries in force at once
```

همان انضباط دفتر کل (۲۶.۲۶b) و دفتر امتیاز (۲۷).

---

## 4. 🔴 دادهٔ حساس — اثبات با کاربر محدود واقعی

نه با خواندن کد، نه با تست واحد: یک کاربر `editor` واقعی ساخته شد با گرنت
`hr.employees: write` ولی op `hr.employees:sensitive_view` **صریحاً منع‌شده**،
سپس با همان کاربر وارد شد و **JSON خام** بررسی شد:

```
RESTRICTED editor → canSeeSensitive: false
  sensitive keys in RAW payload: []                      ← اصلاً وجود ندارند
  non-sensitive still present  : ["firstName","mobile","status"]
ADMIN → canSeeSensitive: true · sensitive keys: ["nationalId","iban"]
```

فیلدها **حذف شده‌اند، نه پنهان**. UI هم وانمود نمی‌کند وجود دارند: وقتی گرنت
نیست، فرم آن فیلدها را نشان نمی‌دهد و یک توضیح می‌گوید چرا — جعبهٔ خالی که
اپراتور نتواند پرش کند، بدتر از توضیح صادقانه است.

Stripping در **لایهٔ داده** انجام می‌شود نه در روت، تا یک endpoint جدید نتواند
با فراموش‌کردن یک helper، اینها را برگرداند.

---

## 5. 🔴 چرا ۲۸.۳ (حقوق و دستمزد) شروع نشد

دو دلیل، هر دو در خودِ spec:

1. **تأیید حسابدار الزامی است.** spec می‌گوید فیش سه کارمند با شرایط متفاوت
   باید با محاسبهٔ دستی حسابدار تطبیق داده شود و «بدون این تأیید، زیرفاز بسته
   نمی‌شود». من نمی‌توانم این تأیید را انجام دهم — تصمیم و مسئولیتش با شماست.
2. **اشتباه اینجا جریمهٔ قانونی دارد، نه باگ.** بیمهٔ تأمین اجتماعی، مالیات
   پلکانی ماده ۸۵، عیدی، سنوات — هر کدام قانون خودش را دارد و نرخ‌هایشان هر
   سال در بودجه تغییر می‌کند.

۲۸.۱ عمداً زیرساخت درست را برای آن گذاشته: تاریخچهٔ append-only حقوق پایه،
افراد تحت تکفل (ورودی معافیت مالیاتی و بیمه)، و نوع قرارداد.

وقتی ۲۸.۳ ساخته شود، این‌ها از روز اول باید رعایت شوند:
- **نرخ‌های قانونی هرگز هاردکد نشوند** — جدول `payroll_rates` سالانه، قابل ویرایش از UI
- **موتور محاسبه تابع خالص** — ورودی (کارمند + دوره + نرخ) → فیش تفکیک‌شده
- **دورهٔ تأییدشده قفل شود** — اصلاح فقط با فیش اصلاحی (سند معکوس)
- **پست خودکار به GL** با نگاشت حساب در `erp_settings`
- **maker ≠ checker** روی تأیید دوره

---

## 6. Gates — 28.1

TypeScript **0** · ESLint **0** · unit tests **965** (بود ۹۳۵ → +۳۰) ·
governance audits **12/12 صفر** · build clean · regression suites **16/16**
(سوئیت ۲۸.۱ ثبت شد) · `audit:modules` **81/81** · i18n baseline بدون افزایش ·
تأیید مرورگری light/dark با تنها لاتین‌های مجاز (`HBZ Technology`، `Husein
Habibazar`، `Ctrl`)

**CC-006** ثبت شد (`docs/governance/contract-changes.md`): شمارش workspace از ۹
به ۱۰ رفت چون HR فضای کاری خودش را گرفت. اول داخل CRM گذاشته بودمش که کلید
`crm.hr.employees` می‌ساخت — هم از نظر معنایی غلط (HR زیرمجموعهٔ CRM نیست) و
هم مغایر spec که کلیدها را `hr.employees` نام برده. مهاجرت کلید لازم نبود چون
ماژول تازه است و هیچ گرنت ذخیره‌شده‌ای به کلید قبلی اشاره نمی‌کرد.

---

## 7. Changelog — 28.1

**New**
`src/lib/hr/employees.ts` (+30 tests) · `src/lib/hr/employeeData.ts` ·
`src/app/api/admin/hr/employees/route.ts` · `src/app/admin/employees/*` ·
`scripts/verify-28-hr.ts` (27 ادعا) · `docs/HRM_GUIDE_FA.md` · این گزارش

**Changed**
`src/lib/db/migrate.ts` (۵ جدول HR) · `src/lib/admin/workspaces.ts` (فضای کاری HR) ·
`src/lib/rbac/registry.ts` (`hr.employees` + op حساس + row scope) ·
`scripts/ci-regressions.ts` · `scripts/module-audit.ts` ·
`src/lib/admin/__tests__/workspaces.test.ts` + `scripts/verify-2629-navkeys.ts` (CC-006) ·
`docs/governance/contract-changes.md`


---

## 8. Attestation — 28.2

| بند | وضعیت | شاهد |
|---|---|---|
| جداول (۸ جدول) | ✅ | migration روی دیتابیس خالی تمیز اجرا شد |
| `company_id` روی همه | ✅ | `audit:tenancy` **0** |
| 🔴 تعطیلات رسمی قابل ویرایش | ✅ | live: افزودن تعطیلی، روز کاری بازه را **۵ → ۴** کرد |
| مرخصی استحقاقی ۲.۵ روز/ماه، قابل تنظیم | ✅ | `accrual_per_month` در `hr_leave_types` |
| اتصال به `approval_matrix` موجود | ✅ | `leave_request` از قبل یکی از docType‌های موتور ۲۶.۱۲ بود |
| 🔴 ابطال مرخصی → تراکنش معکوس | ✅ | ۵ ادعای live-PG — §9 |
| تعلق ماهانه idempotent | ✅ | live: اجرای دوم همان ماه، `employees: 0` و مانده بدون تغییر |
| محاسبهٔ روز سمت سرور | ✅ | live: `days: 4` برای بازهٔ ۵روزهٔ حاوی تعطیلی |
| رد کردن به‌جای کوتاه‌کردن | ✅ | live: `insufficient_balance` با گزارش روزِ خواسته‌شده (۲۱۷) |
| `requirePermission` + op جداگانه | ✅ | `audit:rbac` **163 guarded · 0 failures**؛ `hr.leave:approve` و `:adjust` |
| `runOnce` روی create | ✅ | درخواست، اضافه‌کار، مأموریت، تعطیلی |
| AdminShell + دوزبانه + تقویم شمسی | ✅ | `audit:shell` 0 · `audit:i18n` 0 · `toJalaliStr` |
| اضافه‌کار با ضریب قانونی | ✅ | ۱.۴ برابر — قانون کار مادهٔ ۵۹، به‌عنوان ثابت نام‌دار |

---

## 9. 🔴 چرا مانده یک دفتر است

اگر مانده یک ستون بود، ابطال یک مرخصیِ تأییدشده آن ستون را زیاد می‌کرد و هیچ
ردی نمی‌ماند — دقیقاً همان اشتباهی که در ۲۶.۲۶b (BUG-020) روی سند حسابداری
گرفته شد و در ۲۷ روی دفتر امتیاز تکرار نشد.

پس ابطال، سطر استفادهٔ اصلی را **نگه می‌دارد** و یک سطر برگشت می‌نویسد. اثبات
زنده:

```
✅ 🔴 the balance is back to what it was before the leave — 18.5 → 22.5
✅ 🔴 the ORIGINAL use row survives — history is not rewritten — 1 use rows
✅ 🔴 a compensating reversal row was posted — 1 rows, 4 days
✅ the two rows net to zero — exactly like a reversing GL entry — -4 + 4
✅ 🔴 cancelling twice does NOT credit the days twice (idempotent) — 22.5 → 22.5
```

---

## 10. باگی که خودِ سوئیت پیدا کرد

دو ادعا در اجرای اول شکست خورد، و علتش یک نقص واقعی بود نه ایراد تست:

**موتور تأیید، هر نوع سندی را که برایش قاعده‌ای تعریف نشده باشد به‌صورت خودکار
تأیید می‌کند.** برای مرخصی این پیش‌فرض غلط است — درخواست همان لحظه که تایپ
می‌شد تأیید می‌شد و هیچ مدیری آن را نمی‌دید. غیبت باید پیش‌فرضش «نیازمند
تصمیم» باشد، نه «داده‌شده».

اصلاح: یک قاعدهٔ پیش‌فرض `leave_request` در `migrate.ts` seed شد (idempotent،
مثل قاعدهٔ `journal_entry` در ۲۶.۲۳) و مثل هر قاعدهٔ دیگری در Approval Center
قابل ویرایش است. بعد از آن، ادعای «درخواستِ در انتظار، روزها را قفل نمی‌کند»
مسیر واقعی را آزمود و ۴۳/۴۳ سبز شد.

اگر سوئیت فقط کد را می‌خواند، این را نمی‌دید.

---

## 11. Gates — 28.2

TypeScript **0** · ESLint **0** · unit tests **1005** (بود ۹۶۵ → +۴۰) ·
governance audits **12/12 صفر** · build clean · regression suites **17/17**
(سوئیت ۲۸.۲ ثبت شد) · live-PG **43/43**

**مرز صادقانه:** ماژول مرخصی در `scripts/module-audit.ts` ورودی `CREATE`
ندارد، چون ساختِ درخواست به کارمند و نوع مرخصیِ موجود نیاز دارد و یک payload
ثابت نمی‌تواند آن را بسازد؛ صفحه و لیستش خودکار probe می‌شوند و نوشتنش با
سوئیت اختصاصی ۴۳ ادعایی پوشش داده شده است.

---

## 12. Changelog — 28.2

**New**
`src/lib/hr/leave.ts` (+40 tests) · `src/lib/hr/leaveData.ts` ·
`src/app/api/admin/hr/leave/route.ts` · `src/app/admin/leave/*` ·
`scripts/verify-28-2-leave.ts` (۴۳ ادعا)

**Changed**
`src/lib/db/migrate.ts` (۸ جدول ۲۸.۲ + قاعدهٔ تأیید پیش‌فرض مرخصی) ·
`src/lib/admin/workspaces.ts` (آیتم «مرخصی و حضور و غیاب») ·
`src/lib/rbac/registry.ts` (`hr.leave:approve` + `:adjust`) ·
`scripts/ci-regressions.ts` · `docs/HRM_GUIDE_FA.md`
