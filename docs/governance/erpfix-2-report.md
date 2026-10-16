# ERPFIX-2 — ارز در دفتر کل: خطوط به ریال پایه، سود و زیان ارزی تحقق‌یافته، آستانه‌ها با مبلغ پایه

- **تاریخ:** 2026-10-16 · **اولویت:** P0 · **پوشش:** BUG-ERP-03 · **پیش‌نیاز:** ERPFIX-1 (`95f0b95`)
- **روش:** باگ اول روی PostgreSQL واقعی با کد پیش از این فاز تکرار شد (قرمز)، بعد رفع، بعد همان
  سناریوها با توابع تولیدی (سبز). شواهد خام: `docs/governance/erpfix-2-evidence/`.
- **decision gate:** روش اصلاح دادهٔ قدیمی از مالک پرسیده شد — پاسخ: **«سند معکوس + ثبت مجدد به ریال پایه»** (توصیه‌شده).
  اجرای `--apply` همچنان منتظر تأیید حسابدار است.

## ۱. جدول بند

| بند | شدت | وضعیت |
|---|---|---|
| BUG-ERP-03 خطوط دفتر کل به ارز تراکنش | بحرانی | **built-new** (رفع ساختاری + ابزار survey/remediation؛ `--apply` منتظر حسابدار) |

## ۲. قرمز ← سبز

### قرمز — کد `95f0b95` (`erpfix-2-evidence/red-output.txt`)

```
🔴 invoice 100 USD @ 600,000 → AR 1100: trialBalance 1100 = 100 (should be 60,000,000); 4000 = -100
🔴 original foreign amount kept on the GL line: gl_journal_lines.fx_amount column exists: false
   entry header currency=USD rate=600000 — lines carry the raw USD amounts
🔴 receipt 40 USD @ 650,000: bank 1010 = 40 (should be 26,000,000); AR 1100 = 60 (should be 36,000,000); FX gain 4900 = 0 (should be −2,000,000)
🔴 credit guard compares the raw 100 USD against a 50,000,000 IRR limit: exceeded=false, projected=160
🔴 purchase approval tier uses the raw total: 1,000 USD (base 600,000,000) → 1 level (a 600M doc needs 3)
🔴 purchase invoice 1,000 USD → AP 2000 = -1000 (should be −600,000,000)
🔴 treasury payment approval matrix reads the raw amount: approval request amount = 1000, levels = 1
🔴 purchase doc in EUR with NO rate configured is silently booked at rate 1: exchange_rate=1 base_total=10
   trial balance "balanced"=true (Dr 1100 = Cr 1100) — balanced, yet every account mixes USD and IRR
```

### سبز — `scripts/verify-erpfix-2.ts` → **53/53** (`erpfix-2-evidence/green-output.txt`)

```
✅ 🔴 AR 1100 = 60,000,000 (was 100) · revenue 4000 = −60,000,000 · AR line fx_amount = 100 USD · header USD @ 600,000, balanced · document untouched
✅ 🔴 receipt 40 USD @ 650,000: bank 26,000,000 · AR at booked rate → 36,000,000 · realized gain 2,000,000 on 4900
✅ revaluation: unrealized on open 60 USD = 3,000,000 · second run books nothing
✅ 🔴 after a further 20 USD receipt, revaluation releases only the settled part: −1,000,000
✅ net FX = 3,000,000 realized + 2,000,000 unrealized = 5,000,000 (= 100 USD × 50,000) · nothing left to revalue
✅ 🔴 rate 600,001.7: Dr = Cr to the Rial (21,798,062 = 21,798,062), whole Rials · AR absorbs the residue
✅ IRT 1,090 @ 10 → AR 10,900 · EUR 273.05 @ 700,000.3 balanced (191,135,082), fx kept
✅ 🔴 1,000 USD needs 3 approval levels; 1,000 IRR needs 1 · 🔴 a currency with no rate is refused (GBP)
✅ 🔴 budget on base: 100 USD = 60,000,000 > 50,000,000 → blocked
✅ 🔴 AP 2000 = −600,000,000 (was −1,000)
✅ 🔴 partial payment 400 USD @ 620,000: bank −248,000,000 · AP relieved 240,000,000 at booked → −360,000,000 · loss 8,000,000 on 6980
✅ 🔴 EUR payment on a USD invoice refused without conversion · with conversionRate 1.1 stored as 11 USD, bank 7,000,003
✅ 🔴 credit guard: 100 USD (60,000,000) exceeds a 50,000,000 limit; 1,000 IRR does not
✅ 🔴 Treasury: approval on 300 × 620,000 = 186,000,000 → 2 levels · allocates only to the USD invoice
✅ bank −186,000,000 · 🔴 AP relieved at booked 180,000,000 · 🔴 FX loss 6,000,000 via TRZPAY-FX · reversal undoes bank/AP/6980
✅ legacy data: survey finds both shapes (USD-header invoice AND IRR-header receipt) · dry-run writes nothing
✅ apply: AR of the legacy invoice → 3,600,000 at base · bank 4 USD × 650,000 · realized gain 200,000 reconstructed
✅ original stays posted + reversed; the document points at the restated entry · second apply restates nothing
✅ 🔴 revaluation unaffected by the restatement (−12,133,462 → −12,133,462)
✅ trial balance balanced (851,944,047) · every converted foreign line carries fx_amount
```

## ۳. ممیزی (audit_first)

**مفهوم ستون‌ها:** `sales_documents/purchase_documents.exchange_rate` نرخ ریالی لحظهٔ ثبت سند است
(`rialRateFor`: IRR=1، IRT=10، بقیه آخرین نرخ `erp_exchange_rates`)؛ `base_total = total × rate`
(از 26.7؛ ردیف‌های قدیمی‌تر `0` — برای آستانه‌ها `total × exchange_rate` جایگزین می‌شود). فروش در نبود
نرخ رد می‌کرد، **خرید بی‌صدا نرخ ۱ می‌گذاشت** (رفع شد). `decimal_precision` پیش‌فرض `0`.

**موتور تسعیر:** positionهای باز را از **اسناد** می‌خواند (AR = total − Σ پرداخت‌ها؛ AP = total − paid_total)
با «نرخ ثبت‌شده» = `exchange_rate` سند، و «قبلاً ثبت‌شده» را فقط از سندهای `fx-reval%`. تغییر مبلغ خطوط
دفتر روی آن اثری ندارد؛ چون پرداخت‌ها اکنون به ارز سند ذخیره می‌شوند، position باز سازگار می‌ماند.
سود تحقق‌یافته روی ارجاع‌های پرداخت (SPAY/…) است، نه `fx-reval` — پس در «قبلاً ثبت‌شده» شمرده نمی‌شود.
اثبات زنده: آزادشدن فقط بخش تسویه‌شده (−1,000,000) و بی‌اثری restatement روی دلتا.

**نقاط ورود مبلغ به دفتر:**

| مسیر | ارز مبدأ مبلغ | اکنون |
|---|---|---|
| `postSalesInvoiceToGl` / `postPurchaseInvoiceToGl` | ارز سند | `linesToBase` با نرخ ثبت سند؛ مانده روی AR/AP؛ fx روی خطوط |
| `postSalesPaymentToGl` / `postPurchasePaymentToGl` | ارز پرداخت | `settlementLines`: بانک به نرخ روز، کنترل به نرخ ثبت (نسبتی)، اختلاف 4900/6980 |
| `postCustomerRefundToGl` | ارز اعتبارنامه (= نرخ ثبت) | `linesToBase` |
| Treasury `processPayment` / `createReceipt` | ارز payment_order/receipt | سند نقدی به پایه با نرخ روز + سند true-up به نرخ ثبت |
| Treasury مصرف پیش‌پرداخت (فاز ۱۲/۱۷) | ارز ردیف منبع | فقط هم‌ارز + true-up |
| `reverseEntry` | — | قرینهٔ پایه + ارز/نرخ/شرکت/مرکز هزینه/fx سند اصلی |
| COGS (`salesFulfillment`/`inventoryOpsData`)، حقوق، بین‌شرکتی، تسعیر، ایمپورت، افتتاحیه | ریال | بدون تغییر (already base) |

**آستانه‌ها:** `requiredApprovalLevels`/`isFullyApproved` (خرید)، بودجهٔ دپارتمان، ماتریس پرداخت Treasury،
`evaluateCredit` — همه اکنون مبلغ پایه.

**`erp-fx-survey` روی DB موجود:** این محیط پایگاه دادهٔ تولید/پایلوت ندارد. روی نصب تازه (migrate + seed):
`foreign-currency rows: none · legacy entries: 0` (`survey-fresh.txt`). روی DB قرمز (کد قبل از فاز، با یک
فاکتور/دریافت/خرید دلاری): ۳ ثبت قدیمی، اعوجاج 1100 = 33,999,940 و 2000 = −599,999,000 (`survey-red.txt`).
**اجرای survey روی دیتابیس تولید با مالک است** (بند تأییدها).

## ۴. فایل‌ها و مایگریشن

- **جدید:** `src/lib/erp/money.ts` (toBase، linesToBase، documentControlBase، proportionalRelief،
  settlementLines، fxTrueUpLines، documentBase، BASE_TOTAL_SQL، normalizePayment)،
  `src/lib/erp/fxRemediation.ts`، `src/lib/erp/__tests__/money.test.ts` (۱۸ تست)،
  `scripts/verify-erpfix-2.ts`، `deploy/erp-fx-survey.ts`، `deploy/erp-fx-remediate.ts`،
  `deploy/postgres/rollback-erpfix-2.sql`.
- **تغییر:** `glPosting.ts` (fx روی خطوط، reverseEntry با ارز/شرکت و تراکنش بیرونی، planSettlement،
  پرداخت‌ها روی موتور تسویه، basePrecision)، `salesData.ts`، `purchasingData.ts` (پست پایه، آستانه‌ها،
  رد ارز بی‌نرخ، recordPayment ارزی، ردیف‌های مشتق با ارز)، `currencyData.ts` (`rialRateOn`)،
  `treasury/paymentData.ts`، `crm/customer360Data.ts`، routeهای `sales/payments`، `sales/documents`،
  `purchasing`، `errors` (۲ کد دوزبانه)، `coaContract.ts` (`COA.fxGain/fxLoss`)،
  `scripts/sql-injection-audit.mjs` (فقط شماره‌خط یک ورودی موجود)، `ci-regressions.ts` (سوئیت ۳۹)،
  `CLAUDE.md` (قانون ۵۷)، `deploy/README.md`، `contract-changes.md` (CC-013، CC-014).
- **مایگریشن:** `gl_journal_lines.fx_amount NUMERIC`، `fx_currency TEXT` (نال‌پذیر، idempotent، بدون تغییر
  ردیف‌های قبلی). رول‌بک: ستون‌ها فقط وقتی هیچ خط posted مبلغ ارزی ندارد حذف می‌شوند (آزموده شد).

## ۵. تغییرات رفتار قابل‌مشاهده

CC-013 (خطوط پایه، FX تحقق‌یافته، true-up خزانه، reverseEntry با ارز/شرکت) و CC-014 (پرداخت به ارز سند،
نرخ روزِ پرداخت، رد ارز بی‌نرخ، آستانه‌ها به پایه، Customer 360 به پایه، تخصیص هم‌ارز). هیچ assertion
رگرسیونی ویرایش نشد.

## ۶. یافته‌ها

**fixed-in-phase:**
1. سند خرید به ارز بدون نرخ، بی‌صدا با نرخ ۱ ثبت می‌شد (۱۰ یورو = ۱۰ ریال).
2. پرداخت‌ها با «آخرین نرخ» (نه نرخ روز پرداخت) و در نبود نرخ با ۱ ثبت می‌شدند.
3. پرداخت مستقیم خرید بدون ارز همیشه IRR فرض می‌شد و با total دلاری فاکتور مقایسه می‌شد.
4. تخصیص خزانه و مصرف پیش‌پرداخت مبلغ دلاری را با ماندهٔ ریالی (و برعکس) مقایسه می‌کرد.
5. ردیف‌های مشتق (معکوس، مصرف، بازگشت ابطال) بدون ارز درج می‌شدند و پیش‌فرض IRR می‌گرفتند.
6. `reverseEntry` سند معکوس را همیشه در شرکت پیش‌فرض و IRR ثبت می‌کرد (یافتهٔ ۱ ERPFIX-1).
7. Customer 360: ماندهٔ مشتری و aging ارزها را با هم جمع می‌کرد.
8. ثبت‌های پرداخت پیش از این فاز سرآیند IRR/نرخ ۱ روی خطوط دلاری داشتند — survey بر اساس سرآیند آن‌ها را
   نمی‌دید؛ اکنون از روی ردیف پرداخت شناسایی می‌شوند.

**finding-for-later:**
1. ابطال فاکتور ارزی خرید که پیش‌تر از طریق خزانه/پرداخت مستقیم با FX تسویه شده: پرداخت‌ها به «unapplied»
   برمی‌گردند ولی سود/زیان ارزی تحقق‌یافتهٔ آن تخصیص معکوس نمی‌شود (true-up خزانه تجمیعی به‌ازای پرداخت است) → ERPFIX-3.
2. تبدیل سند (پیش‌فاکتور → سفارش → فاکتور) نرخ جاری را دوباره می‌گیرد، نه نرخ سند منبع (BUG-ERP-04) → ERPFIX-3.
3. اسناد ارزی خزانه/دستی/ایمپورت قدیمی خودکار بازنویسی نمی‌شوند (فقط گزارش) — نیازمند تصمیم حسابدار.
4. داشبوردهای خزانه مبلغ `payment_orders.amount` را خام نمایش می‌دهند (نمایشی، نه دفتری).

## ۷. تأییدهای لازم

1. **مالک/حسابدار:** روی کپی دیتابیس تولید پس از آپدیت: `npx tsx deploy/erp-fx-survey.ts`. سؤال: «فهرست
   سندهای ارزی قدیمی و اعوجاج هر حساب را دیدید؛ اجرای `npx tsx deploy/erp-fx-remediate.ts --apply --confirm`
   (معکوس + ثبت مجدد پایه، فقط دوره‌های باز) را تأیید می‌کنید؟ برای موارد «REPORT ONLY» (دورهٔ بسته یا
   خزانه/دستی) چه تصمیمی دارید؟»
2. **حسابدار:** سیاست گردکردن: تبدیل به `decimal_precision` (اکنون ۰ = ریال صحیح)، مانده روی حساب کنترل،
   تسویهٔ نسبی با گردکردن تجمعی. تأیید می‌کنید؟
3. **حسابدار:** حساب‌های سود/زیان تحقق‌یافته همان 4900/6980 تسعیر است؛ آیا حساب جداگانه برای «تحقق‌یافته»
   در برابر «تحقق‌نیافته» می‌خواهید؟ (نیاز به کد حساب جدید — حدس زده نشد.)
4. **مالک:** پس از deploy، پرداخت به ارزی که برای تاریخ پرداخت نرخ ندارد رد می‌شود — نرخ‌های ارز را در
   مالی ← ارز به‌روز نگه دارید.

## ۸. نتیجهٔ گیت‌ها

| گیت | نتیجه |
|---|---|
| TypeScript | 0 خطا |
| ESLint | 0 |
| Unit tests | **1365/1365** (۱۸ تست جدید `money.test.ts`) |
| Build | موفق (exit 0؛ ۱۰۵ صفحه — سه صفحهٔ عمومی روی DB خالیِ build به empty state افتادند، رفتار مستند 26.30) |
| `npm run audit` (۱۵ گیت، شامل gl-writes و coa) | همه سبز (rbac 171/12/0، tenancy 0، sql 0) |
| Regressions (`npm run regressions`) | **39/39 سبز** (ERPFIX-1: 71/71، ERPFIX-2: 53/53) |
