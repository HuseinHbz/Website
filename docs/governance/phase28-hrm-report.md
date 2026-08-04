# Phase 28 — HRM platform

> **Scope reality, stated up front.** The phase brief calls this five sub-phases
> and says each closes independently with its own gate. **28.1 is complete and
> verified. 28.2–28.5 are not started.** This report covers 28.1 only; nothing
> below is claimed for the rest.

---

## 1. Sub-phase status

| Sub-phase | Status | Evidence |
|---|---|---|
| **28.1** پرسنل و پروندهٔ کارکنان | ✅ **بسته شد** | live-PG **27/27** · 30 unit tests · module audit **81/81** · browser fa/en × light/dark |
| **28.2** مرخصی، حضور و غیاب | ⏳ شروع نشده | — |
| **28.3** حقوق و دستمزد ایران | ⏳ شروع نشده | 🔴 نیازمند تأیید حسابدار — §5 |
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
