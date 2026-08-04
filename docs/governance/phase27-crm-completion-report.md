# Phase 27 — CRM completion: opportunities and the loyalty club

---

## 1. Attestation table

| بند | Status | Evidence |
|---|---|---|
| **گیت پیش‌نیاز** (data gate for بند۳) | ✅ اجرا شد — نتیجه: **ناکافی** | `scripts/crm-data-gate.ts` روی دیتابیس زنده: مشتری فعال **۰ از ۲۰** · تاریخچه **۰ از ۳ ماه** · تراکنش **۰ از ۵۰** |
| **بند۱** فرصت فروش | ✅ انجام شد | ۲۲ تست واحد + ۱۲ ادعای live-PG؛ ارزش وزنی ۳٬۵۰۰٬۰۰۰ محاسبه‌شده، تبدیل به سند `INV-2026-000001` با ۲ سطر و مبلغ ۲٬۵۰۰٬۰۰۰ |
| **بند۲** باشگاه مشتریان | ✅ انجام شد | ۳۶ تست واحد + ۲۰ ادعای live-PG؛ **معکوس‌شدن امتیاز اثبات شد** (§3) |
| **بند۳** هوش تجاری CRM | 🔴 **DEFERRED با عدد** | گیت رد شد — §2 |
| **بند۴** داشبورد و گزارش | ✅ انجام شد | خط لولهٔ وزنی، تحلیل دلیل باخت، و وضعیت باشگاه (با بدهی باز) به داشبورد CRM اضافه شد |
| **پورتال مشتری** | ✅ انجام شد | `/api/portal/loyalty` + تب «امتیازهای من»؛ `customerId` از **نشست سرور** خوانده می‌شود، نه از درخواست |
| **تأیید مرورگری** | ✅ ۸ ترکیب | هر دو ماژول × fa/en × light/dark → همه ۲۰۰، بدون `Error`/`undefined`/`NaN` |

---

## 2. 🔴 بند۳ — deferred، با عدد صریح

```
  ✘ مشتری فعال                              0  (حداقل 20)
  ✘ تراکنش فروش (فاکتور غیرپیش‌نویس)        0  (حداقل 50)
  ✘ تاریخچه (ماه)                           0  (حداقل 3)
    فاکتور ۹۰ روز اخیر                      0
    لید بسته‌شده (برد/باخت)                 0
```

**ساخته نشد، و این یک تصمیم است نه یک کمبود.** Churn prediction روی صفر مشتری،
پیش‌بینی تولید نمی‌کند — یک **عدد** تولید می‌کند که مدیر فروش به آن اعتماد
خواهد کرد. نبودِ یک قابلیت دیده می‌شود؛ یک امتیاز بی‌پایه دیده نمی‌شود.

گیت به‌صورت اسکریپت دائمی باقی می‌ماند: پس از اجرای پایلوت (۲۶.۳۰) کافی است
`npx tsx scripts/crm-data-gate.ts` اجرا شود. وقتی سبز شد، بند۳ قابل ساخت است —
و بندهای ۱ و ۲ همین حالا داده‌ای تولید می‌کنند که آن گیت را تغذیه می‌کند
(فرصت‌های بسته‌شده، دلیل باخت، تاریخچهٔ امتیاز).

---

## 3. بند۲ — چرا امتیاز مثل دفتر کل ساخته شد

قاعدهٔ حاکم: **امتیاز یک بدهی مالی است، نه یک شمارنده.** هر امتیاز، تخفیفی
است که شرکت قول داده. پس موجودی هرگز مستقیم نوشته نمی‌شود؛ **مجموع یک دفتر
append-only** است — دقیقاً همان انضباطی که GL دارد.

نتیجهٔ عملی: وقتی فاکتور برگشت می‌خورد، امتیازش قابل پس‌گرفتن است.

```
✅ a confirmed invoice earns points — 2000 pts
✅ a DRAFT earns nothing — no liability for an unmade sale
✅ earning is idempotent — a retry cannot mint points twice
✅ returning the invoice reverses its points — 2000 pts
✅ balance after reversal is arithmetically correct — -500
✅ the original earn row SURVIVES — history is not erased
✅ reversing twice does not double-subtract
```

آن `-500` عمدی است: مشتری ۲۰۰۰ گرفته، ۵۰۰ خرج کرده، و بعد فاکتور برگشت خورده.
موجودی منفی **نمایش داده می‌شود**، نه اینکه بی‌صدا صفر شود — چون این یک بدهی
واقعی است که اپراتور باید ببیند و دربارهٔ آن تصمیم بگیرد.

همان اصل ۲۶.۲۶b BUG-020: سند اصلی posted می‌ماند و یک سند معکوس اضافه می‌شود؛
هر دو دیده می‌شوند و جمعشان صفر است.

### اثر مالی (نگاشت GL)

`loyalty_gl_enabled` **پیش‌فرض خاموش** است، با `loyalty_gl_expense=6900` و
`loyalty_gl_liability=2900` به‌عنوان نگاشت پیشنهادی. این یک تصمیم حسابداری است
نه فنی: تا وقتی حسابدار سازمان پایلوت حساب‌ها را تأیید نکند، سیستم سند نمی‌زند.

### کوپن — همهٔ محدودیت‌ها سمت سرور

```
✅ below the minimum order it is refused
✅ an unknown code is refused
✅ the per-customer limit is enforced from the DATABASE, not the client
✅ never discounts more than the order — a sale must not become a payout
```

---

## 4. بند۱ — چرا فرصت از لید جدا شد

ارزش معامله روی خود لید بود، که نمی‌تواند یک حساب واقعی را توصیف کند: یک مشتری
معمولاً هم‌زمان چند معامله دارد (پروژهٔ شبکه + قرارداد پشتیبانی). لید کسی است که
دارید صلاحیتش را می‌سنجید؛ فرصت معامله‌ای است که رویش کار می‌کنید.

**ارزش وزنی** عددی است که مدیر فروش واقعاً لازم دارد: جمع خام فرصت‌های باز همیشه
پیش‌بینی را خوش‌بینانه می‌کند، چون معاملهٔ ۱۰٪ را مثل معاملهٔ امضاشده می‌شمارد.

تبدیل عمداً **پیش‌نویس** می‌سازد: تبدیل یک تحویل به بخش فروش است، نه یک رویداد
حسابداری. ثبت در دفتر همان‌جا می‌ماند که هست (تأیید فاکتور)، پس دقیقاً یک مسیر
به دفتر کل وجود دارد.

مهاجرت داده: لیدهای `won` که مبلغ داشتند، فرصت متناظر گرفتند (idempotent).
لیدهای باز دست نخوردند — آن‌ها هنوز لیدند، نه معامله.

---

## 5. یک رفع ریشه‌ای فراتر از این فاز

هنگام تأیید مرورگری، عبارت انگلیسی `Loyalty Club` در UI فارسی دیده شد. ریشه‌اش
ماژول من نبود: **هر صفحهٔ ادمین** عنوانش را به‌صورت انگلیسی هاردکد به
`AdminShell` می‌داد و هدر همان را خام نمایش می‌داد.

رجیستری منو از قبل برای هر ماژول `labelFa` دارد، پس هدر حالا عنوان را از مسیر
resolve می‌کند و فقط برای صفحات خارج از رجیستری به prop برمی‌گردد.

**نتیجه — روی همهٔ صفحات ادمین، نه فقط دو ماژول جدید:**

| صفحه | قبل | بعد |
|---|---|---|
| `/admin/crm/loyalty` | `Loyalty Club` | «باشگاه مشتریان» |
| `/admin/crm/opportunities` | `Opportunities` | «فرصت‌های فروش» |
| `/admin/sales` | `Sales Center` | «مرکز فروش» |

باقی‌ماندهٔ لاتین در UI فارسی: `HBZ Technology`، `Husein Habibazar` (نام تجاری/شخص)
و `Ctrl` (نام کلید فیزیکی) — هر سه در فهرست استثنائات ۲۶.۳۳.

---

## 6. رعایت قواعد فازهای قبل

| قاعده | رعایت |
|---|---|
| ۲۶.۲۷ `requirePermission` با کلید رجیستری | هر دو روت جدید — `audit:rbac` **۱۶۱ guarded · ۰ failure** |
| ۲۶.۲۸ row scope در WHERE، خارج از scope = ۴۰۴ | `rowScopeSql`/`rowInScope` روی فرصت‌ها |
| ۲۶.۳۰ BUG-206 به‌روزرسانی جزئی | `updateSchema = createSchema.partial()` از ابتدا |
| ۲۶.۳۲ `runOnce` روی create | فرصت، برنامه، سطح، کوپن، و مصرف کوپن |
| ۲۶.۳۲ `company_id` روی جدول تراکنشی | هر ۷ جدول جدید — `audit:tenancy` **۰** |
| ۲۶.۳۳ دکمهٔ حذف | `deleteRowAction` در هر دو ماژول |
| ۲۶.۳۳ خطای ۴۰۰ با نام فیلد | `outcomeReason: required when the stage is lost` |
| ۲۶.۲۶b AdminShell | هر دو `page.tsx` — `audit:shell` **۰** |

---

## 7. Gates

TypeScript **0** · ESLint **0** · unit tests **935** (بود ۸۷۷ → +۵۸) ·
governance audits **12/12 صفر** · build clean · regression suites **15/15**
(سوئیت جدید ۲۷ ثبت شد) · `audit:modules` **80/80** (دو ماژول جدید هم پوشش
داده شدند) · i18n baseline **بدون افزایش** (۲۸ / ۲۱۶، هر دو قفل)

---

## 8. Changelog

**New**
`src/lib/crm/opportunities.ts` (+22 tests) · `src/lib/crm/opportunityData.ts` ·
`src/lib/crm/loyalty.ts` (+36 tests) · `src/lib/crm/loyaltyData.ts` ·
`src/app/api/admin/crm/opportunities/route.ts` · `src/app/api/admin/crm/loyalty/route.ts` ·
`src/app/api/portal/loyalty/route.ts` ·
`src/app/admin/crm/opportunities/*` · `src/app/admin/crm/loyalty/*` ·
`scripts/crm-data-gate.ts` · `scripts/verify-27-crm.ts` (۳۲ ادعا) ·
`docs/CRM_GUIDE_FA.md` · این گزارش

**Changed**
`src/lib/db/migrate.ts` (۷ جدول + مهاجرت لیدهای برنده + نگاشت GL خاموش) ·
`src/lib/admin/workspaces.ts` (دو آیتم منو) ·
`src/lib/crm/crmDashboardData.ts` + `src/app/admin/crm/dashboard/CrmDashboard.tsx` (بند۴) ·
`src/lib/crm/customer360Data.ts` (فرصت‌ها + وفاداری) ·
`src/app/[locale]/portal/PortalApp.tsx` (تب امتیازها) ·
`src/components/admin/AdminHeader.tsx` (عنوان دوزبانه — §5) ·
`scripts/ci-regressions.ts` · `scripts/module-audit.ts`
