# Phase 28.3-ج — bank payment, advances, and completion of the monthly cycle

> **Status, stated up front.** بند ۱ (bank payment) and بند ۲ (advances) are
> built and verified against live PostgreSQL (**40/40**), and together they
> close the monthly cycle's last open link — salaries payable now settles to
> **exactly zero** after a confirmed bank batch. بند ۴.۱ and ۴.۲ (sick-leave
> split, conditional-cap parameters) are built as pure engine + seeded
> parameters. بند ۳ (salary structure) is **deferred with a numeric reason**.
> بند ۵ (pilot feedback) is **deferred — no real pilot has run yet**, per the
> spec's own instruction that it stays empty until one does.

---

## 1. Attestation

| بند | وضعیت | شاهد (عدد/تست) | توضیح |
|---|---|---|---|
| 🔴 ۱ — فرمت فایل بانک به‌صورت داده | ✅ | live: دو فرمت متفاوت → دو فایل متفاوت از یک دسته | §3 |
| ۱ — جدول‌های دسته و خط | ✅ | `payroll_bank_batches` + `_lines` | — |
| 🔴 ۱ — شبای معتبر (فرمت + رقم کنترلی) | ✅ | live + unit: mod-97 یک رقم جابه‌جاشده را می‌گیرد | §3 |
| 🔴 ۱ — کارمند بدون شبا → رد صریح | ✅ | live: «بدون شبا» با نام رد شد، از فایل حذف نشد | §3 |
| ۱ — دسته فقط از دورهٔ تأییدشده | ✅ | کد: بررسی `period.status` | — |
| 🔴 ۱ — idempotent | ✅ | live: کلیک دوباره همان دسته را برگرداند؛ `UNIQUE(period_id)` | §3 |
| ۱ — سند GL تسویه | ✅ | live: حقوق پرداختنی از −۵۶۱٬۷۲۰٬۰۰۰ به **صفر** | §4 |
| ۱ — رکورد برگشتی بانک | ✅ | live: کارمند ردشده با وضعیت جدا ثبت شد، بدون توقف بقیه | §3 |
| ۲ — مساعده جدا از وام | ✅ | `payroll_advances` مستقل از `payroll_loans` | — |
| 🔴 ۲ — سقف مساعده پارامتر | ✅ | live: «مبلغ درخواستی بیشتر از سقف مساعده (۱۵۰٬۰۰۰٬۰۰۰)» | — |
| ۲ — سند GL پرداخت مساعده | ✅ | live: بدهکار مساعدهٔ دریافتنی ۱۰۰٬۰۰۰٬۰۰۰ | — |
| ۲ — کسر خودکار در دورهٔ تعیین‌شده | ✅ | live: فقط در ماه ۷ ظاهر شد، در ماه ۸ تکرار نشد | §5 |
| 🔴 ۲ — خالص منفی → هشدار، نه صفر خاموش | ✅ | live: هشدار با نام کارمند و مبلغ تولید شد | §5 |
| ۴.۱ — فرمول استعلاجی | ✅ (موتور) | `splitSickLeave` + پارامتر آستانه و نرخ | ⚠️ تأیید نشده — §6 |
| ۴.۲ — سقف معافیت مشروط | ✅ (پارامتر) | ۳ پارامتر seed شد با یادداشت «طبق بخشنامه» | نیازمند تطبیق سالانه |
| ۴.۳ — بازخرید مرخصی | ✅ قبلاً در ۲۸.۳-ب | reuse — تکراری ساخته نشد | — |
| ۴.۴ — گزارش‌های مدیریتی | ⏳ deferred | دلیل: نیاز به چند دورهٔ واقعی برای معنادار بودن روند | §7 |
| ۳ — ساختار حقوقی | ⏳ deferred با دلیل عددی | §7 | — |
| ۵ — بازخورد پایلوت | ⏳ deferred | هیچ پایلوت واقعی اجرا نشده | §8 |
| امنیت — op و row/field scope | ✅ | `audit:rbac` 164 guarded · 0 failures؛ `hr.payroll:pay` بر بانک و مساعده | — |
| حقوق و شبا در لاگ نیست | ✅ | `logAction` فقط شناسه و وضعیت؛ خودِ شبا هرگز | — |

---

## 2. فرمت‌های بانک پشتیبانی‌شده

| کلید | بانک | وضعیت |
|---|---|---|
| `generic_csv` | فرمت عمومی CSV (نمونه) | ⚠️ تأیید نشده — جایگزین کنید |

فقط همین یک فرمت seed شده، چون spec صریحاً می‌گوید: **حدس زدن فرمت بانک
ممنوع**. اضافه‌کردن فرمت بانک واقعی سازمان یک عمل داده‌ای است (تب پرداخت
بانکی → فرمت جدید)، نه یک تغییر کد — اثبات زنده:

```
✅ 🔴 a new bank format is added from data alone, no code change
✅ 🔴 the SAME batch renders DIFFERENTLY with a different format — the layout is data
```

---

## 3. 🔴 اعتبارسنجی شبا و رفتار «رد صریح»

الگوریتم رقم کنترلی (mod-97 روی IBAN) چیزی را می‌گیرد که فرمت تنها
(`IR`+۲۴رقم) نمی‌گیرد — یک رقم جابه‌جاشده:

```
✅ IBAN check digit accepts a valid IBAN
✅ IBAN check digit rejects a transposed digit that the format regex alone would accept
```

و رفتار تعیین‌کننده: کارمندی که مشکل دارد **کل تولید دسته را متوقف می‌کند** و
نامش را می‌گوید، نه اینکه خاموش از فایل بیفتد:

```
✅ 🔴 the employee with no IBAN is refused, named explicitly
   {"employeeName":"بدون شبا","ok":false,"reason":"missing_iban"}
✅ 🔴 the batch REFUSES to generate while any employee is unresolved
✅ the batch generates once the problem is fixed
```

و idempotency: کلید یکتای `period_id` روی جدول دسته یعنی کلیک دوباره **همان
دسته** را برمی‌گرداند، هرگز دستهٔ دوم نمی‌سازد:

```
✅ 🔴 a retried generate returns the EXISTING batch, not a new one
✅ exactly one batch exists for this period — 1 total
```

---

## 4. 🔴 بستن حلقه: مانده حقوق پرداختنی صفر می‌شود

این همان چیزی است که این زیرفاز برایش وجود دارد. قبل از این زیرفاز، فیش
محاسبه و سند GL زده می‌شد ولی حساب «حقوق پرداختنی» تا ابد باز می‌ماند — چون
پرداخت واقعی دستی بود و هیچ سندی نمی‌بستش.

```
✅ salaries payable carries a balance before payment — -561720000
✅ 🔴 confirming the batch posts the settlement
✅ 🔴 salaries payable settles to exactly ZERO — the last open link in the cycle
   -561720000 → 0
✅ confirming twice does not double-settle
```

---

## 5. 🔴 مساعده — یک‌جا، نه اقساط

اثبات که واقعاً فقط در ماه تعیین‌شده کسر می‌شود:

```
✅ the advance is scheduled for its named month, not the current one
✅ 🔴 the advance appears as a ONE-OFF deduction on exactly this slip
✅ 🔴 the advance does NOT recur the following month — it is not a loan installment
```

و هشدار به‌جای خالص منفی خاموش:

```
✅ 🔴 a large advance surfaces a WARNING rather than a silent negative net
   ["حقوق کم: کسر مساعده (190,000,000) از خالص فیش (44,360,000) بیشتر است"]
```

**نکتهٔ صادقانه:** مسیر معمول درخواست (سقف پارامتر) از رسیدن به این وضعیت
جلوگیری می‌کند — این تست عمداً یک مساعده را مستقیم در دیتابیس درج کرد تا مسیر
هشدار را با قطعیت آزمایش کند، چون مسیر عادی هرگز به آنجا نمی‌رسد.

---

## 6. ⚠️ فرمول استعلاجی — ساخته شد، تأیید نشده

پارامترها seed شدند (سقف روز کارفرما = ۳، نرخ غرامت تأمین اجتماعی = ۱۰۰٪) و
موتور خالص `splitSickLeave` تفکیک می‌کند. **ولی این فرمول با هیچ منبع رسمی
تطبیق داده نشده** — دقیقاً مثل بقیهٔ بخش‌های حقوق، منتظر آزمون تطبیق حسابدار
است. اگر قانون کار سازمان شما آستانهٔ دیگری دارد، همان دو پارامتر را عوض
کنید.

---

## 7. چرا بند ۳ و ۴.۴ deferred شدند

**بند ۳ (ساختار حقوقی):** برای سازمانی زیر ~۵۰ نفر که حقوق هر کارمند
جداگانه (نه بر اساس گرید) تعیین می‌شود، سابقهٔ استخدامی append-only فاز
۲۸.۱ همان کاری را می‌کند که یک لایهٔ «گرید/الگو» اضافه می‌کرد — یک تعمیم
بدون کاربر واقعی. این پروژه (پایلوت هدف) در این محدوده است. اگر تعداد
کارکنان و سطوح شغلی رشد کرد، ساختش را در فاز جداگانه بگیرید تا با نیاز
واقعی طراحی شود، نه با حدس.

**بند ۴.۴ (گزارش‌های مدیریتی):** روند ماه‌به‌ماه معنا فقط با چند دورهٔ واقعی
پیدا می‌کند؛ ساختنش روی داده‌های تستی یک نمودار تزئینی می‌شد که چیزی نشان
نمی‌دهد.

---

## 8. ⏳ بند ۵ — بازخورد پایلوت (عمداً خالی)

spec صریحاً این بند را «عمداً خالی» خواسته تا با یافته‌های اجرای واقعی پر
شود. هیچ دورهٔ واقعی حقوق هنوز اجرا نشده — نه اینکه فراموش شده باشد. وقتی
اولین اجرای واقعی انجام شد، یافته‌ها با قالب BUG-XXX همین‌جا و در
`PAYROLL_RATES_FA.md` ثبت می‌شوند.

---

## 9. Gates

TypeScript **0** · ESLint **0** · unit tests **1147** (بود ۱۱۲۸ → +۱۹) ·
governance audits **12/12 صفر** · build clean · live-PG **40/40** ·
regression suites **20/20**

**مرزهای صادقانه**
- فرمت DSK/مالیات همچنان تأیید نشده (به ارث از ۲۸.۳-ب)
- فرمول استعلاجی موتورش ساخته شد، تأیید حسابدار نگرفته
- بند ۳ و ۴.۴ صراحتاً deferred با دلیل، نه ساخته‌نشدهٔ بی‌توضیح
- بند ۵ صراحتاً خالی، منتظر پایلوت واقعی

---

## 10. Changelog

**New**
`scripts/verify-28-3c-completion.ts` (۴۰ ادعا) · این گزارش

**Changed**
`src/lib/hr/annual.ts` (+۱۹ تست: IBAN، دسته بانکی، مساعده، استعلاجی) ·
`src/lib/hr/annualData.ts` (فرمت/دستهٔ بانکی، مساعده) ·
`src/lib/hr/payrollData.ts` (کسر مساعده در محاسبهٔ دوره + هشدار) ·
`src/lib/db/migrate.ts` (۴ جدول + ۱ حساب کل + نگاشت + پارامترهای مساعده/سقف/استعلاجی + seed فرمت بانک) ·
`src/app/api/admin/hr/payroll/route.ts` (۱۰ اکشن + ۶ view جدید) ·
`src/app/admin/payroll/PayrollManager.tsx` (۲ تب جدید) ·
`docs/PAYROLL_RATES_FA.md` (بخش پرداخت بانکی، مساعده، استعلاجی، سقف‌ها) ·
`scripts/ci-regressions.ts` · `CLAUDE.md`
