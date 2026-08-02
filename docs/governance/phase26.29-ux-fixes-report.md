# Phase 26.29 — رفع باگ‌های گزارش‌شدهٔ کاربر + بازچینش منو + اصلاحات سایت عمومی

**Branch:** مستقیم روی `feature/v2-enterprise-upgrade` (دستور صریح نگهدارنده)
**Commits:** 94bed7f (بند ۱/۴/۵/۶) · 6677804 (بند ۰/۲/۳/۷) + این گزارش

## ⭐ ریشهٔ مشترک — یک باگ، نه یازده تا

بند ۱ حدس زده بود «شاید ریشهٔ مشترکی باشد». بود، و دقیقاً همان کلاسی نبود که حدس زده شده
بود (نه ۴۰۳ خاموش، نه drift قرارداد). با تست زندهٔ همهٔ روت‌ها روی PostgreSQL مشخص شد:

1. روت‌های CMS قدیمی بدنه را **مستقیم** به Drizzle می‌دادند و **هیچ try/catch نداشتند**
   (۹ فایل، ۰ فراخوانی `apiError`). یک ستون NOT NULL که فرم پر نمی‌کرد (اغلب `slug`) →
   استثنای PG → **۵۰۰ عمومی**.
2. `apiError` هر خطا را ۵۰۰ «Internal server error» می‌کرد — بدون نام فیلد.
3. ۲۱ مدیر UI خطا را با `toast(t('failed'))` می‌بلعیدند — کاربر فقط «ناموفق» می‌دید.

نتیجه: ماژول سالم بود، ولی از دید کاربر «کار نمی‌کرد». رفع در سه لایه، یک‌بار برای همیشه:
- `apiError` حالا PG **23502** (NOT NULL) → `400 Required field missing: <field>` و
  **23505** (unique) → `400 Duplicate <field>` برمی‌گرداند (خطای کاربر، نه خطای سرور).
- `ensureSlug` (خالص، ۷ تست): اگر فرم slug نفرستد، از عنوان/نام ساخته می‌شود — فارسی هم
  پشتیبانی می‌شود («راهکار امنیت» → `راهکار-امنیت`). هرگز slug دستی را بازنویسی نمی‌کند.
- `crud.errorOf` + sweep روی **۲۲ مدیر**: پیام واقعی سرور در toast دیده می‌شود.

## جدول اقرار

| شناسه | وضعیت | ریشهٔ واقعی | شاهد |
|---|---|---|---|
| BUG-101 content | انجام شد | `slug` NOT NULL؛ فرم آن را نمی‌فرستد؛ روت try/catch نداشت | live: `POST /api/admin/content {type,titleEn,titleFa}` → **201** (قبلاً 500)، DELETE → 200 |
| BUG-102 credentials | انجام شد | همان + پیام خطای بلعیده‌شده | live create=**201** / delete=**200** |
| BUG-103 hero | از قبل کار می‌کرد + verify | مسیر `action:'bulk',op:'delete'` سالم بود؛ آنچه نبود، نمایش دلیل خطا | live: create hero → 200، bulk delete → `{"ok":true,"count":1}` |
| BUG-104 technologies | انجام شد | `slug` NOT NULL بدون auto-fill | live create=**201** (slug `cisco` خودکار) / delete=**200** |
| BUG-105 projects ۵۰۰ | انجام شد | `slug`+`nameEn`+`nameFa` NOT NULL؛ ۵۰۰ عمومی | live create=**200** / delete=**200** |
| BUG-106 ولیدیشن اجباری | انجام شد | ولیدیشن اجباری نبود؛ **پیام خطا** نبود. حالا فقط نام لازم است و هر فیلد ناقص با نام خودش گزارش می‌شود | `{"error":"Required field missing: name en"}` |
| BUG-107 sections | انجام شد | `sectionType` لازم بود ولی خطایش دیده نمی‌شد | live create=**201** / delete=**200** (id رشته‌ای است) |
| BUG-108 menus | انجام شد | DnD نداشت (دکمهٔ بالا/پایین)؛ مشکل همان خطای بلعیده‌شده بود | live create=**200** / delete=**200** |
| BUG-109 templates | انجام شد | `slug` NOT NULL | live create=**201** / delete=**200** |
| BUG-110 academy delete | انجام شد | API DELETE وجود داشت، **row action در UI نبود** | `rowActions` حالا حذف دارد؛ live delete=**200** |
| BUG-111 certifications | از قبل سالم + verify | ماژول سالم بود؛ سردرگمی از هم‌نامی بود (بند ۳) | live create=**200** / delete=**200** |
| BUG-112 kanban DnD | انجام شد | `onDragStart` هرگز `dataTransfer.setData` صدا نمی‌زد → مرورگر drag را شروع نمی‌کرد | مهاجرت به **pointer events** (`lib/admin/pointerDnd.ts` + ۶ تست)؛ روی موبایل هم کار می‌کند؛ منوی «انتقال به مرحله» حفظ شد |
| BUG-113 case-studies | انجام شد | در فارسی state اولیه `'All'` بود ولی `allLabel='همه'` → شرط رد فیلتر هرگز برقرار نمی‌شد و **همه‌چیز فیلتر می‌شد** | `isAll()` دوزبانه؛ ۵ تست رگرسیون (`publicFilters.test.ts`) شامل تستی که رفتار باگ‌دار را قفل می‌کند |
| BUG-114 فیلتر معکوس | انجام شد | الگوی `(db && db.length>0) ? db : DEMO` در **۵ کامپوننت** → همه غیرفعال = نمایش دموی هاردکد | `activeOrNull`: جدول خالی→`null` (دمو مجاز)، رکورد هست ولی هیچ‌کدام فعال نیست→`[]` (هیچ). live: همه غیرفعال → «گروه سنسو» دمو **۰**؛ یکی فعال → فقط همان |
| BUG-115 تکرار شرکا | انجام شد | marquee همیشه آرایه را دوبرابر می‌کرد تا حلقه یکنواخت شود | زیر ۸ آیتم → گرید ثابت وسط‌چین بدون تکرار |
| BUG-116 گواهینامه در /about | انجام شد (با تصحیح) | بخش «گواهینامه‌های تخصصی» **از قبل در /about بود** (همان AboutSection). گپ واقعی: جدول `credentials` هرگز در کل سایت عمومی نمایش داده نمی‌شد | `getPublicCredentials` + `ProfessionalCredentials` روی /about؛ live: heading + نام مدرک + issuer هر سه رندر شدند |
| بند ۰ مهاجرت RBAC | انجام شد | جابجایی ماژول = تغییر کلید = از دست رفتن خاموش گرنت | `verify-2629-navkeys.ts` **36/36** (سوئیت ۱۴): شمارش قبل/بعد، صفر کلید یتیم، تصمیم‌ها یکسان، idempotent |
| بند ۲ بازچینش | انجام شد | ۱۲ ورک‌اسپیس با ۱۵ آیتم تکراری واقعی | **۹ ورک‌اسپیس، ۹۵ آیتم، ۰ تکرار**؛ هیچ ماژولی حذف نشد (۱۶ مسیر گزارش‌شده همه در منو ماندند) |
| بند ۳ نام‌ها | انجام شد | دو ماژول هم‌نام «گواهینامه‌ها»؛ ابزار **۲ هم‌نامی دیگر** هم پیدا کرد | مدارک تخصصی / گواهینامه‌های سازمانی / مطالعات موردی (پورتفولیو) / مرکز پروژه (ERP) / هویت شرکت در اسناد / پروفایل سازمان / کلیدهای اتصال / کاتالوگ یکپارچه‌سازی → **۰ برچسب تکراری** |
| بند ۶ آخرین ورود | انجام شد | مرکز امنیت اصلاً «آخرین ورود» نداشت؛ Users فقط تاریخ | `formatDateTime` مشترک (جلالی + ارقام فارسی + **ساعت**) در هر دو |
| بند ۷ بازبینی کل | انجام شد | — | ۸۰ صفحهٔ ادمین، ۷۸ در منو؛ ۲ استثنا (`/admin/home` انتخابگر، `/admin/login` پیش از احراز) |

## نگاشت کلید RBAC (بند ۰) — با اثبات عددی

| کلید قدیم | کلید جدید | | کلید قدیم | کلید جدید |
|---|---|---|---|---|
| `content.content` | `brand.content` | | `analytics.dashboard` | `executive.dashboard` |
| `content.blog` | `brand.blog` | | `analytics.reports` | `erp.reports` |
| `content.media` | `brand.media` | | `analytics.seo` | `brand.seo` |
| `content.docs` | `brand.docs` | | `analytics.ai-analytics` | `ai.ai-analytics` |
| `documentation.docs` | `brand.docs` | | `content.ai-kb` | `ai.ai-kb` |
| `crm.crm.tickets` | `operations.crm.tickets` | | `content.ai-prompts` | `ai.ai-prompts` |
| `erp.numbering` | `system.numbering` | | `system.company` | `erp.company` |
| `security.flags` | `system.flags` | | `system.logs-monitoring` | `operations.logs-monitoring` |
| `system.security` | `security.security` | | `system.seo` | `brand.seo` |
| `content` (ws) | `brand` | | `analytics` (ws) | `executive` |
| `documentation` (ws) | `brand` | | | |

**اثبات عددی:** ۱۵ گرنت قدیمی → ۱۴ گرنت (دقیقاً یک ادغام: `content.docs` و
`documentation.docs` هر دو به `brand.docs` می‌رسند) · opها و row-scopeها بدون تغییر ·
**صفر کلید یتیم** · تصمیم مؤثر هر ماژول یکسان (`brand.content`=write، `erp.reports`=write،
`operations.crm.tickets`=write + scope=own حفظ شد) · اجرای دوم = no-op.
کلیدهای داخل کد روت‌ها هم مهاجرت کردند (۱۴ فایل) — `audit:rbac` این را گرفت و حالا **۰ خطا**.

## ساختار منو: قبل / بعد

| | قبل | بعد |
|---|---|---|
| ورک‌اسپیس | ۱۲ | **۹** |
| آیتم منو | ۱۱۰ | ۹۵ |
| href یکتا | ۹۵ | **۹۵ (=آیتم‌ها)** |
| آیتم تکراری | **۱۵** | **۰** |
| برچسب فارسی تکراری | ۴ | **۰** |
| ماژول حذف‌شده | — | **۰** |

ادغام‌ها: «مرکز محتوا» + «مستندات» → **پلتفرم برند** · «مرکز تحلیل» → **اجرایی** ·
آیتم‌های AI فقط در **پلتفرم AI** · تیکت‌ها از CRM → **مرکز عملیات**.
مالکیت تکرارهای باقی‌مانده: company→ERP · numbering→System · security→Security ·
flags→System · logs→Operations · seo→Brand.
**استثنای مکتوب:** ۴ ورودی `?tab=`/`?view=` (currency، document designer، تب‌های
Treasury/BI) یک **تب مشخص** از یک ماژول‌اند، نه لینک دوم به کل ماژول.

## کوئری‌های سایت با fallback اشتباه (بند ۵ sibling hunt)

| کوئری | وضعیت |
|---|---|
| `getPublicClients` | **رفع شد** (BUG-114 اصلی) |
| `getPublicProjects` · `getPublicServices` · `getPublicSkills` · `getPublicCerts` | **رفع شد** — همان الگو، همان رفع |
| `getPublicTimeline` · `getPublicBlogPosts` · `getPublicBlogCategories` | سالم — کامپوننت‌شان fallback هاردکد ندارد |
| `AboutSection` (skills/certs/timeline) · `ProjectsSection` · `ServicesSection` · `CompanyPortfolio` | هر ۵ کامپوننت حالا فقط روی `null` به دمو برمی‌گردند |

## هم‌خانواده‌های DnD (بند ۴ sibling hunt)

| محل | وضعیت |
|---|---|
| CRM kanban | **رفع شد** — pointer events |
| `DataTable` جابجایی ستون | همان الگو (`onDragStart` بدون setData) — **بدهی ثبت‌شده**، خارج از دامنهٔ این فاز چون خرابی‌اش گزارش نشده و ستون‌ها با منوی column-picker هم قابل مدیریت‌اند |
| `DashboardEngine` | DnD دارد ولی از HTML5 استفاده نمی‌کند — سالم |
| Workflow designer | pointer-drag از قبل (فاز ۲۱.۶) — سالم |
| Menu builder | اصلاً DnD ندارد (دکمهٔ بالا/پایین) — سالم |

## گیت‌ها
TS **0** · ESLint **0** · **۸۳۳ تست** (۸۰۹→۸۳۳) · ۱۲ ممیزی **0** (شامل audit:rbac
«159 guarded · 12 exceptions · 0 failures»، audit:nav، audit:links) · build تمیز ·
**رگرسیون ۱۴/۱۴** (۱۱ سوئیت قدیمی بدون تغییر) · تأیید زندهٔ مرورگری هر ۱۶ باگ.
تغییر assertionها در `docs/governance/contract-changes.md` (CC-005) ثبت شد.

## Changelog
- **94bed7f** بند ۱/۴/۵/۶: `apiError` قیدهای PG را به ۴۰۰ با نام فیلد تبدیل می‌کند ·
  `ensureSlug` روی ۹ روت · `crud.errorOf` روی ۲۲ مدیر · حذف آکادمی ·
  `pointerDnd` + کانبان · فیلتر دوزبانهٔ case-studies · `activeOrNull` + ۵ کامپوننت ·
  آستانهٔ marquee · بخش مدارک تخصصی در /about · `formatDateTime` مشترک
- **6677804** بند ۰/۲/۳/۷: ادغام ۱۲→۹ ورک‌اسپیس با صفر تکرار · مهاجرت کلید RBAC در
  migrate.ts + `verify-2629-navkeys.ts` (سوئیت ۱۴) · مهاجرت کلید در ۱۴ روت ·
  تفکیک ۴ جفت نام هم‌شکل · اصلاح whitelist نقش viewer/auditor
