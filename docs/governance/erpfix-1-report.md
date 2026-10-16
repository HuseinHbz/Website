# ERPFIX-1 — هستهٔ دفتر کل: نقطهٔ ورود واحد ثبت، اینواریانت‌های سطح DB، تصادم کد ۶۱۰۰

- **تاریخ:** 2026-10-16 · **اولویت:** P0 · **پوشش:** BUG-ERP-08، BUG-ERP-21، BUG-ERP-10
- **مبنا:** HEAD `84e4204` (همان commit شاخه‌های `claude/bold-lamport-a1d6tg` و `claude/relaxed-cerf-a8krji`)
- **روش:** برای هر بند اول باگ روی PostgreSQL واقعی با کد دست‌نخوردهٔ HEAD تکرار شد (قرمز)،
  بعد رفع، بعد همان سناریو با توابع تولیدی (سبز). شواهد خام: `docs/governance/erpfix-1-evidence/`.

## ۱. جدول بندها

| بند | شدت | وضعیت | خلاصه |
|---|---|---|---|
| BUG-ERP-08 | بالا | **built-new** | `insertPostedEntry` تنها نقطهٔ نوشتن سند posted؛ ۹ مسیر مهاجرت کرد؛ تاریخ نامعتبر و بیرون از دوره رد؛ بستن سال/افتتاحیه با `allowClosedPeriod` (closed آری، locked هرگز) + `requireOp`؛ گیت `audit:gl-writes` |
| BUG-ERP-21 | متوسط | **built-new** | trigger تراز deferred، CHECK سطرها، UNIQUE شمارهٔ سند به‌ازای شرکت، شماره‌گذاری IC/OB/YEC/FXR از موتور، بستن سال idempotent با `year-end-close:<id>` |
| BUG-ERP-10 | بحرانی | **built-new** (decision gate پاسخ داده شد: **6000**) | حقوق → 6000 «Salaries Expense»؛ INSERT بی‌اثر حذف؛ literalها از نقشه/`COA`؛ `coaContract.ts` + گیت `audit:coa`؛ اسکریپت‌های audit و remediation |

هیچ بندی deferred نماند.

## ۲. قرمز ← سبز (اعداد واقعی از اجرای زنده)

### قرمز — HEAD `84e4204` (`erpfix-1-evidence/red-output.txt`)

```
🔴 BUG-ERP-10 payroll lands on 6100: income statement expense 6100 «Rent Expense» = 352000000; 6000 «Salaries Expense» = 0
   gl_accounts 6100 = «Rent Expense»; map gl_map_payroll_expense = 6100
   period RED-CLOSED (2026-10-01..31) is closed; assertPostable(today).ok=false
🔴 BUG-ERP-08 intercompany posts into a CLOSED period: +2 posted entries
🔴 BUG-ERP-08 fx revaluation posts into a CLOSED period: +1 posted entry
🔴 BUG-ERP-08 journal import posts into a CLOSED period: +1 posted entry
🔴 BUG-ERP-08 cycle-count adjustment posts into a CLOSED period: +1 posted entry
🔴 BUG-ERP-08 inventory revaluation posts into a CLOSED period: +1 posted entry   (6 entries dated inside the closed period)
🔴 BUG-ERP-08 date 'abc' is postable: {"ok":true}
🔴 BUG-ERP-08 date outside every defined period is postable: {"ok":true}
🔴 BUG-ERP-08 year-end closing posts into a LOCKED period: {"ok":true,"entryId":8,...}
🔴 BUG-ERP-21 raw unbalanced posted entry commits: rows=1
🔴 BUG-ERP-21 duplicate entry_no accepted: rows=2
🔴 BUG-ERP-21 negative line amount accepted: debit=-5 stored
🔴 BUG-ERP-21 concurrent year-end closing books more than one entry: 2 closing entries for 2027 from 5 concurrent calls
   system entry numbers minted from Date.now(): IC-2026-6242141, IC-2026-6242152, FXR-2026-624221, YEC-RED-FY2026-4262, YEC-2027-4273, YEC-2027-4278
   (first run of the same script: the two concurrent closings even got the SAME number, YEC-2027-1945 ×2)
🔴 BUG-ERP-21 closing «2025» wrongly blocks closing «25»: 25 → "Year 25 is already closed (entry #16)"
```

گیت‌های جدید روی HEAD هم قرمزند: `audit:gl-writes` → **20 نوشتن دورزننده** (`red-audit-gl-writes.txt`)؛
`audit:coa` → **1 تصادم seed** (6100 «Rent Expense» در برابر «Salaries») + **5 مشکل قرارداد** (`red-audit-coa.txt`).

### سبز — `scripts/verify-erpfix-1.ts` → **71/71** (سوئیت رگرسیون ثبت‌شده در `ci-regressions.ts`)

```
✅ 6000 is «Salaries Expense» (expense) · ✅ 6100 is still «Rent Expense» · ✅ map = 6000 · ✅ gl_require_period 'strict' · ✅ OB/YEC/IC/FXR formats seeded
✅ intercompany posts with zero periods defined — IC-2026-00001, IC-2026-00002 (engine numbers)
✅ 🔴 income statement: «Salaries Expense» 6000 carries the gross — 352000000 = 352000000
✅ 🔴 income statement: 6100 «Rent Expense» carries nothing — 0
✅ salaries payable 2300 = -327360000 · ✅ insurance payable 2310 = -105600000 · ✅ tax 2320 · ✅ trial balance balanced · ✅ idempotent
✅ legacy fixture: a month of salaries sits on 6100 — 352000000
✅ dry-run lists exactly the legacy payroll entry · ✅ dry-run wrote nothing
✅ apply books ONE corrective entry for the open period · ✅ 🔴 after apply the salary part of 6100 is 0 · ✅ 6000 = 704000000
✅ the original posted entry is untouched (no edit, no void) · ✅ remediation is idempotent
✅ 🔴 intercompany / fx revaluation / journal import / cycle-count / inventory revaluation — each ERP-FINANCE-PERIOD-CLOSED, entries 5→5
✅ refused count wrote no move and stays approved · ✅ refused revaluation left cost 1000 · ✅ refused import job marked failed
✅ 🔴 'abc' refused · ✅ '2025-02-30' invalid · ✅ 🔴 date outside every period refused (strict) · ✅ 'off' restores legacy
✅ 🔴 year-end closing posts into a CLOSED year (net 1000, YEC-2026-00001, ref year-end-close:3)
✅ 🔴 year-end closing refused in a LOCKED year and writes nothing · ✅ opening balance refused in LOCKED, allowed in CLOSED (OB-2026-00001)
✅ 🔴 raw unbalanced POSTED entry rejected at COMMIT — pg:23514 · ✅ unbalanced DRAFT still allowed
✅ 🔴 raw draft→posted flip rejected at commit — pg:23514 · ✅ 🔴 duplicate entry_no — pg:23505 · ✅ 🔴 negative / two-sided line — pg:23514
✅ 20 concurrent opening/intercompany postings → 30 entries, ✅ 🔴 30/30 UNIQUE numbers
✅ 🔴 6 concurrent year-end closings book EXACTLY one entry
✅ 🔴 closing «2030» does not block closing «30» · ✅ second close → ERP-FINANCE-YEAR-ALREADY-CLOSED (fa: «سال 30 قبلاً بسته شده است»)
✅ 🔴 migration does NOT fail on existing duplicate numbers · ✅ no unique index while duplicates exist · ✅ business alert names EF1-LEGACY-DUP ×2
✅ no number changed automatically · ✅ after cleanup the next boot creates the unique index and resolves the alert
✅ trial balance balanced at the end · ✅ 6100 still 0
✅ audit:gl-writes passes / FAILS on a direct INSERT · ✅ audit:coa passes / FAILS on a colliding seed
```

## ۳. جدول ممیزی نقاط نوشتن (audit_first)

| مسیر (HEAD) | assertPostable | تراکنش | شماره | کنترل تراز | اکنون |
|---|---|---|---|---|---|
| `accountingData.postEntry` (افتتاحیه/بستن سال) | نادیده گرفته می‌شد | ❌ | `Date.now()` | ❌ | `insertPostedEntry` + `allowClosedPeriod` |
| `ledgerData.bookIntercompany` | ❌ | ✅ | `Date.now()` | engine | `insertPostedEntry` (`gl_intercompany`) |
| `revaluationData.bookRevaluation` | ❌ | ✅ | `Date.now()` | engine | `insertPostedEntry` (`gl_revaluation`) |
| `importData` journal | ❌ | ✅ (job) | پیش‌ساخته | اعتبارسنجی job | `insertPostedEntry` روی تراکنش job |
| `inventoryOpsData.postCount` | ❌ | ❌ | nextNumber | ✅ | moves+GL+status در یک تراکنش |
| `inventoryOpsData.revalueInventory` | ❌ | ❌ | nextNumber | ❌ | cost+GL در یک تراکنش |
| `salesData.postSalesInvoiceToGl` | ✅ | ✅ | nextNumber | ✅ | `insertPostedEntry` در همان تراکنش/قفل |
| `purchasingData.postPurchaseInvoiceToGl` | ✅ | ✅ | nextNumber | ✅ | همان (company/currency/cost center از options) |
| `payrollData.postPeriodToGl` | ✅ | ❌ | nextNumber | ✅ | تراکنش + قفل per-period + `insertPostedEntry` |
| `annualData.postAnnualEntry` | ✅ | ❌ | nextNumber | ✅ | تراکنش + `insertPostedEntry` |
| `glPosting.insertPostedEntry` (پرداخت‌ها، reversal، COGS، خزانه) | ✅ | ✅ | nextNumber | ❌ | خودِ هسته — اکنون تراز/تاریخ/قفل دوره را اجرا می‌کند |
| `journal/route` | — | ✅ | nextNumber | ✅ | فقط **draft** (allowlist با دلیل)؛ post از `postEntryById` |

دادهٔ DB تازه: صفر شمارهٔ تکراری، صفر سند posted نامتوازن، صفر سطر منفی/دوطرفه (مایگریشن همین‌ها را
هر boot می‌شمارد و در صورت وجود `business_alert` می‌سازد — هیچ داده‌ای خودکار تغییر نمی‌کند).

## ۴. فایل‌های تغییرکرده و مایگریشن

**هسته و مسیرهای ثبت:** `src/lib/erp/glPosting.ts` (insertPostedEntry، accountIdsByCodes،
loadPayrollExpenseCode، postEntryById)، `accountingCore.ts` (isValidPostingDate، canPostDate با
requirePeriod/allowClosedPeriod، yearEndClosingLines برای ماندهٔ contra)، `accountingData.ts`
(assertPostable، throwPostableError، postOpeningBalance، runYearEndClosing)، `ledgerData.ts`،
`revaluationData.ts`، `salesData.ts`، `purchasingData.ts`، `salesFulfillment.ts`،
`src/lib/inventory/inventoryOpsData.ts`، `src/lib/import/importData.ts`، `src/lib/hr/payroll.ts`،
`payrollData.ts`، `annual.ts`، `annualData.ts`، `src/lib/treasury/payments.ts`، `paymentData.ts`.
**شماره‌گذاری:** `src/lib/numbering/service.ts` (`generateDocumentNumberInTx`)، `integrate.ts` (`nextNumberInTx`).
**خطا:** `src/lib/errors/{codes,catalog,factory,index}.ts` (۴ کد دوزبانه + `BusinessErrorException`)،
`src/lib/api/respond.ts` (apiError → پاسخ کاتالوگ). **route:** `api/admin/erp/finance/periods/route.ts`.
**جدید:** `src/lib/erp/coaContract.ts`، `coaAudit.ts`، `coaRemediation.ts`،
`src/lib/governance/glWritesAudit.ts`، `scripts/gl-writes-audit.ts`، `scripts/coa-audit.ts`،
`scripts/verify-erpfix-1.ts`، `src/lib/erp/__tests__/erpfix1.test.ts`، `deploy/erp-coa-audit.ts`،
`deploy/erp-remediate-salary-account.ts`، `deploy/postgres/rollback-erpfix-1.sql`.
**گیت/CI:** `package.json` (`audit:gl-writes`، `audit:coa` در `npm run audit`)، `.github/workflows/ci.yml`،
`scripts/ci-regressions.ts` (سوئیت ۳۸)، `scripts/sql-injection-audit.mjs` (فقط شماره‌خط سه ورودی
allowlist موجود که با ویرایش جابه‌جا شدند — عبارت و دلیل همان).
**مستندات:** `CLAUDE.md` (قانون ۵۶)، `deploy/README.md`، `docs/governance/contract-changes.md` (CC-009..012).

**مایگریشن (انتهای `runMigrations`، idempotent، شمارش قبل از قید):** فرمت‌های شماره
`gl_opening/gl_year_end/gl_intercompany/gl_revaluation`؛ `gl_require_period='strict'`؛ جدول
`gl_remediation_links` (با `company_id`)؛ اصلاح نگاشت حقوق `6100→6000` فقط وقتی 6100 هنوز
«Rent Expense» است؛ ایندکس یکتای جزئی بستن سال؛ `chk_gl_lines_amounts` (NOT VALID → VALIDATE فقط اگر
دادهٔ نقض‌کننده نباشد)؛ ایندکس یکتای `(COALESCE(company_id,0), entry_no)` یا در صورت تکراری،
ایندکس غیریکتا + alert؛ گزارش سندهای posted نامتوازن موجود؛ تابع‌ها و دو constraint trigger
deferred. حذف `INSERT … ('6100','Salaries')` بی‌اثر. پیش‌فرض seed نگاشت حقوق → `6000`.
رول‌بک: `deploy/postgres/rollback-erpfix-1.sql` (روی DB تست اجرا و دوباره‌اجرا شد؛ boot بعدی همه را دوباره می‌سازد).

**Deploy:** مایگریشن در `instrumentation.ts` خودکار اجرا می‌شود؛ `update.sh`/`install.sh` تغییری لازم
نداشتند (env، پورت و ساختار فایل عوض نشده). دو ابزار عملیاتی جدید در `deploy/README.md` ثبت شد.

## ۵. تغییرات رفتار قابل‌مشاهده (همه در `contract-changes.md`)

- **CC-009:** هزینهٔ حقوق در صورت سود و زیان زیر 6000 «Salaries Expense» (نه «Rent Expense»).
- **CC-010:** دورهٔ اجباری: وقتی دست‌کم یک دورهٔ مالی تعریف شده، تاریخ بیرون از همهٔ دوره‌ها رد می‌شود
  (`ERP-FINANCE-DATE-OUTSIDE-PERIODS`)؛ تاریخ نامعتبر رد می‌شود. ⚠ اگر روی سرور برای سال جاری دوره
  تعریف نشده ولی برای سال دیگری شده، پس از deploy ثبت‌ها رد می‌شوند تا دوره تعریف شود (یا تنظیم `off`).
- **CC-011:** بستن سال در دورهٔ locked رد؛ در closed مجاز. افتتاحیه در closed مجاز (قبلاً رد می‌شد).
  هر دو `erp.finance:close_period` می‌خواهند. پاسخ «قبلاً بسته شده» دوزبانه با کد.
- **CC-012:** شمارهٔ سند posted داخل همان تراکنش؛ rollback شماره را هم برمی‌گرداند. dry-run ایمپورت
  افتتاحیه دیگر سند واقعی ثبت نمی‌کند.
- خطاهای دورهٔ بسته/تاریخ از هر route اکنون ۴۰۰ با `error`/`error_fa`/`code` (قبلاً گاه ۵۰۰ عمومی).

## ۶. یافته‌ها

**fixed-in-phase:**
1. **قحطی pool در شماره‌گذاری هم‌زمان:** با ۲۰ ثبت هم‌زمان، `nextNumber` روی اتصال دوم timeout می‌خورد و
   به شمارهٔ `Date.now()` برمی‌گشت؛ ۷ ثبت شکست خورد. → `nextNumberInTx` روی اتصال خودِ تراکنش.
2. `yearEndClosingLines` برای حساب با ماندهٔ contra (درآمد بدهکار، هزینهٔ بستانکار) سطر **منفی** می‌ساخت.
3. dry-run ایمپورت افتتاحیه سند واقعی ثبت می‌کرد (پیش از `BEGIN`، روی اتصال جدا).
4. `postPeriodToGl` غیراتمیک بود (در نبود حساب، هدر posted بدون سطر می‌ماند) و قفل نداشت.
5. شمارش انبار و ارزش‌گذاری مجدد: moves/cost حتی با شکست GL commit می‌شد.
6. `deploy/erp-coa-audit.ts` روی کپی دیتابیسی که هنوز مایگریشن ERPFIX-1 را boot نکرده بود (جدول `gl_remediation_links` نبود) crash می‌کرد — اکنون «هنوز هیچ اصلاحی انجام نشده» فرض می‌کند؛ روی همان کپی، remediation تا وقتی نگاشت حقوق 6100 است اجرا نمی‌شود و دورهٔ قفل را فقط گزارش می‌کند (هر دو آزموده شد).

**finding-for-later (خارج از دامنهٔ این فاز، بدون تغییر):**
1. `reverseEntry` شرکت/ارز سند اصلی را روی سند معکوس نمی‌گذارد (معکوس سند شرکت B در شرکت پیش‌فرض و IRR می‌نشیند). طبق do_not دست نخورد → پیشنهاد ERPFIX-2/3.
2. پرداخت حقوق خزانه (`salary_payment`) Dr هزینهٔ حقوق / Cr بانک می‌زند، در حالی که حقوق ماهانه Dr هزینه / Cr 2300 ثبت می‌شود؛ استفادهٔ هم‌زمان از هر دو هزینه را دوبار می‌شمارد و 2300 تسویه نمی‌شود — تصمیم حسابدار.
3. `rollbackJob` ایمپورت سندهای posted را **فیزیکی حذف** می‌کند (خلاف قانون ۱۱) → ERPFIX-3.
4. ثبت‌های سالانهٔ HR (عیدی/سنوات/تسویه/دستهٔ بانکی/مساعده): سند ثبت و سپس ردیف منبع جداگانه به‌روز می‌شود (پیوند غیراتمیک) → ERPFIX-5.
5. سند فاکتور فروش `company_id` را روی سند GL نمی‌نشاند (خرید می‌نشاند)؛ پرداخت‌های خزانه هم شرکت/ارز را پاس نمی‌دهند → ERPFIX-2.
6. قالب کدینگ «trading» ردیف‌هایی مثل 7403 «درآمد اجاره» را با نوع `expense` دارد (گروه ۷ یکسره expense) — بازبینی حسابدار.
7. چند نوع سند (`shipment`، `purchase_*`) فرمت شماره ندارند و به fallback `Date.now()` می‌افتند (از قبل؛ در لاگ رگرسیون‌ها).
8. **رگرسیون Phase 14، سناریو L ناپایدار است (از قبل):** `reversePayment` و `processPayment` هم‌زمان؛ assertion یک ترتیب خاص را فرض می‌کند در حالی که هر دو ترتیب از نظر مالی درست‌اند (پول حفظ می‌شود؛ در ترتیب دیگر پرداخت دوم «unapplied» ثبت می‌شود). اندازه‌گیری: HEAD دست‌نخورده **7/8**، این فاز **8/8** در اجرای مجزا و یک شکست در یکی از سه اجرای کامل. اصلاح assertion نیازمند ثبت در contract-changes و تصمیم مالک است → فاز بعدی.
9. قفل advisory شمارنده اکنون تا commit نگه داشته می‌شود؛ بررسی شد که هیچ مسیری قفل vendor را پیش از ثبت GL در همان تراکنش نمی‌گیرد (ترتیب معکوس قفل → deadlock وجود ندارد).

## ۷. تأییدهای لازم از مدیر / حسابدار

1. **حسابدار:** روی کپی دیتابیس تولید `npx tsx deploy/erp-coa-audit.ts` و سپس dry-run
   `npx tsx deploy/erp-remediate-salary-account.ts` را ببیند. سؤال: «این فهرست ثبت‌های حقوق روی ۶۱۰۰ و
   سندهای اصلاحیِ پیشنهادی (Dr 6000 / Cr 6100 برای هر دورهٔ باز) را تأیید می‌کنید تا با `--apply --confirm` اجرا شود؟ دوره‌های بسته فقط گزارش شده‌اند — برای آن‌ها چه تصمیمی دارید؟»
2. **مالک:** پیش از deploy: «برای سال مالی جاری در Finance → Accounting دوره تعریف شده است؟» اگر فقط برای سال‌های دیگر تعریف شده، یا دورهٔ سال جاری را تعریف کنید یا `gl_require_period` را `off` کنید.
3. **حسابدار:** نام/نوع ۲۴ کد در `src/lib/erp/coaContract.ts` (همان seed فعلی) را به‌عنوان قرارداد کدینگ سیستم تأیید کند.
4. **حسابدار:** یافتهٔ ۲ بالا (پرداخت حقوق خزانه: Dr 2300 یا Dr هزینه؟).
5. **مالک (شاخه):** پرامپت شاخه را `claude/bold-lamport-a1d6tg` نوشته بود، محیط اجرا شاخهٔ
   `claude/relaxed-cerf-a8krji` را مقرر کرده و CLAUDE.md `feature/v2-enterprise-upgrade` را. هر دو شاخهٔ
   claude روی همان commit `84e4204` بودند؛ کار روی شاخهٔ مقررشدهٔ محیط push شد. اگر باید به شاخهٔ دیگری برود، بگویید.

## ۸. نتیجهٔ گیت‌ها

| گیت | نتیجه |
|---|---|
| TypeScript (`tsc --noEmit`) | 0 خطا |
| ESLint (`npm run lint`) | 0 هشدار/خطا |
| Unit tests (vitest) | **1347/1347** (110 فایل؛ ۱۳ تست جدید در `erpfix1.test.ts` + ۱ تست به‌روزشده در `payroll.test.ts`) |
| Build (`npm run build`) | موفق |
| `npm run audit` (۱۵ گیت: tokens، content، reuse، deps، links، i18n، ui، tenancy، theme، nav، shell، rbac 171/12/0، sql، **gl-writes**، **coa**) | همه سبز؛ `audit:pgcompat` سبز |
| i18n | کلید ادمین جدیدی لازم نشد (UI تغییری نکرد)؛ پیام‌های جدید در کاتالوگ خطا دوزبانه‌اند |
| Regressions (`npm run regressions`) | اجرای کامل ۲: **37/38** — تنها شکست Phase 14 سناریو L (ناپایداری از قبل؛ HEAD دست‌نخورده 7/8، این فاز 8/8 در اجرای مجزا — یافتهٔ ۸). اجرای کامل ۳ (پس از آخرین ویرایش): **38/38 سبز**. ERPFIX-1: 71/71 |
