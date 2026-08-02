# Phase 26.28 — بستن کامل سیستم دسترسی (ABAC + تکمیل 26.27)

**Branch:** مستقیم روی `feature/v2-enterprise-upgrade` (دستور صریح نگهدارنده — بدون برنچ جانبی)
**Commits:** 987c179 (بند ۰) · 0652106 (بند ۱) · 9276df5 (بند ۲) · d773781 (بند ۳) · 720f3e3 (بند ۴) + گزارش‌ها

**نکتهٔ مبنا (R8):** بازبینی کدی که مبنای این فاز بود، وضعیت برنچ را در میانهٔ 26.27
(کامیت 6cd78d1) دیده بود. بند ۵ (هر هفت گپ 2FA)، callerهای اولیهٔ ABAC، ماتریس
41/41، E2E چهار-کاربره، گزارش 26.27 (`phase26.27-rbac-2fa-report.md` با جدول اقرار +
تصمیم role_assignments + نگاشت کامل روت→کلید)، `RBAC_GUIDE_FA.md` و قواعد CLAUDE.md
در کامیت‌های 7e0991c…270fd07 ساخته و در PR #10 مرج شده بودند. آن موارد اینجا
**verify** شدند (نه دوباره‌سازی)؛ یافته‌های جدید بازبینی — که واقعی بودند — ساخته شدند.

## جدول اقرار

| شناسه | وضعیت | شاهد | توضیح |
|---|---|---|---|
| 0.1 حفرهٔ navigation | انجام شد | روت بازنویسی شد: `requirePermission('brand.menus', read/write)` روی هر ۴ متد؛ E2E: unauthenticated GET → 401، auditor POST → 403 | GET هیچ چک درون-روتی نداشت (middleware همچنان JWT می‌گرفت — «باز برای اینترنت» دقیق نبود، ولی نقض قانون ۱۶ بود) |
| 0.2 حفرهٔ workspaces | انجام شد | `requirePermission('system.workspaces', …)`؛ E2E: auditor POST → 403 | POST/PUT فقط `if (!user)` داشتند؛ جدول DB است نه ثابت WORKSPACES (تأیید شد، جدا) |
| 0.3 بازبینی EXCEPTIONS | انجام شد | `rbac-route-map.ts`: ۱۴→۱۲ استثنا؛ هر ۱۲ باقی‌مانده یک خط دلیل مکتوب دارد؛ audit:rbac «159 guarded · 12 exceptions · 0 failures» | navigation/workspaces خارج شدند؛ dashboards/* ماندند با دلیل (per-user layouts؛ data با موتور درختی فیلتر می‌شود — ۰.۴) |
| 0.4 ویجت‌ها → موتور درختی | انجام شد | `dashboards/data`: `effectiveLevel(grants, w.workspace)` اول، fallback به canDo فقط وقتی گرنتی نیست (R5)؛ E2E: erp=none → payload `denied` | |
| 0.5 بدهی‌ها | انجام شد | `e2e/__debug2.spec.ts` حذف؛ role_assignments از قبل drop+مستند (گزارش 26.27 سطر 0.1)؛ کد مردهٔ 2FA در بازنویسی 26.27 رفته بود (دو `if (!adminUser)` فعلی یکی-per-handler است) | |
| 1.1 کد بازیابی | از قبل بود + verify | matrix 26.27 #35–39 (۱۰ کد هش‌شده، تک‌مصرف، شمارنده)؛ UI نمایش یک‌بار + Regenerate | ساخته‌شده در 7e0991c |
| 1.2 replay | از قبل بود + verify | matrix #31: همان کد بار دوم → رد (totp_last_step) | |
| 1.3 rate-limit TOTP | انجام شد (تکمیل) | قفل ۵/۱۰د از قبل (matrix #32–33)؛ **جدید:** قفل حالا logger.security + ایمیل به کاربر می‌فرستد (0652106) | timing-safe در recovery از قبل |
| 1.4 رمزنگاری راز | از قبل بود + verify | matrix #29/#34: `enc:v1:` AES-256-GCM؛ plaintext قدیمی verify + ارتقا در enable؛ tamper→fail (unit) | |
| 1.5 سیاست اجباری | انجام شد (تکمیل) | چک داخل requireOp از قبل؛ **جدید:** `backup.backup:*` به الگو اضافه شد + گذرگاه: auth/me → `needs2fa` → بنر مسدودکنندهٔ `TwoFaGate` در AdminShell؛ matrix 2628 #18–21 | پیش‌فرض ۰ = R5 |
| 1.6 UI مدیریت | از قبل بود + verify | UsersManager: وضعیت/QR/شمارندهٔ کد بازیابی/Regenerate/نمایش یک‌بار؛ ریست دیگری = op reset_2fa + ایمیل به هدف (روت 2FA)؛ آخرین ورود در ستون Last Login | |
| 1.7 بدهی روت 2FA | از قبل بود + verify | روت zod (readJson) + targetGate(requireOp reset_2fa)؛ استثنا ماند با دلیل مکتوب (self-service؛ مسیر کاربر دیگر op-گیت درون-روتی) | |
| 2.1 scope در WHERE | انجام شد | helper مشترک `rowScopeSql` (own + department؛ company صادقانه اعلام‌نشده — users ستون company ندارد) + caller روی **leads / activities / tickets / customer360 / sales documents / projects**؛ matrix 2628 #3–4، #12 | «rowScopeFor بدون caller» بسته شد |
| 2.2 رکورد مستقیم → ۴۰۴ | انجام شد | `rowInScope` + ۴۰۴ در هر ۶ روت؛ matrix #6/#9؛ E2E: timeline لید غیرخودی → 404 | الگوی 26.25a |
| 2.3 UI انتخابگر scope | انجام شد | `SCOPED_MODULES` در رجیستری (۵ ماژول واقعی) → PermissionTree فقط برای آن‌ها select نشان می‌دهد (همه/فقط خودم/واحد من) | وعدهٔ توخالی نه: company در UI نیست |
| 2.4 سازگاری عقب‌رو | انجام شد | matrix #10–12: صفر ردیف scope → all، کوئری دست‌نخورده؛ رگرسیون‌ها سبز | |
| 3.1 حذف فیلد از payload | انجام شد | helper `stripFields` + پوشش **products** (از قبل) و **overview** (kpis.totalValue/lowStock/moves/topValue — جدید)؛ `SENSITIVE_FIELDS` در رجیستری؛ اسرار integrations از قبل ماسک (BUG-015، verify شد) | حقوق/HR: فقط طراحی — ماژول HR وجود ندارد |
| 3.2 تست فیلد | انجام شد | matrix #14 (کلید ABSENT، نه null)؛ E2E: auditor بدون cost_view → `value`/`avgCost` در پاسخ خام نیست | |
| ۴ ماتریس | انجام شد | `verify-2628-abac.ts` **21/21** + 26.27 matrix **41/41** (سوئیت‌های ۱۲/۱۳ رگرسیون)؛ **باگ واقعی پیدا و رفع شد:** upsert های rbac با company_id NULL هرگز ON CONFLICT نمی‌گرفتند (NULLهای SQL متمایزند) → ردیف تکراری؛ DELETE+INSERT + dedupe + ایندکس یکتای COALESCE | R3: همه از توابع production |
| ۴ E2E | انجام شد | `e2e/rbac.spec.ts` **6/6**: چهار کاربر + حفره‌های بسته‌شده + scope=own→404 + ویجت درختی + پوشش فیلد | storageState 26.26c |
| R5 رگرسیون | انجام شد | `npm run regressions` = **۱۳/۱۳ سبز** (۱۱ سوئیت قدیمی بدون تغییر + 2627 + 2628) | |
| Gates | انجام شد | TS 0 · ESLint 0 · **۸۰۹ تست** (۷۸۷→۸۰۹) · ۱۲ ممیزی 0 (audit:rbac: 159/12/0) · build تمیز | |

## دو حفرهٔ سرور — جزئیات
- **navigation:** GET بدون هیچ چک؛ حالا هر ۴ متد `brand.menus` (ماژول Menu Builder که مالک `navigation_items` است). DELETE سطح write + legacyAction `delete` را نگه داشت.
- **workspaces:** POST/PUT فقط لاگین؛ حالا `system.workspaces` + legacy `manage_settings`. این جدولِ DB است (صفحهٔ /admin/workspaces)، نه رجیستری RBAC — دور زدن درخت ممکن نبود، ولی حفرهٔ کنترل دسترسی بود.

## scope روی کدام روت‌ها اعمال شد
| روت | مالک سطر | لیست | رکورد مستقیم |
|---|---|---|---|
| crm/leads | `owner_id` | WHERE (rowScopeSql) | PUT/DELETE → rowInScope → ۴۰۴ |
| crm/activities | مالک لیدِ والد | — (per-lead) | GET/POST → ۴۰۴ |
| crm/tickets | `owner_id` | own=فیلتر مستقیم؛ department=پس‌فیلتر | ?id= → ۴۰۴ |
| crm/customers/[id] | `sales_customers.owner_id` | — | GET → ۴۰۴ |
| erp/sales/documents | `COALESCE(customer.owner_id, created_by)` | WHERE | ?id= → ۴۰۴ |
| erp/projects | `created_by` | پس‌فیلتر rowInScope | ?id= → ۴۰۴ |

## فیلدهای پوشش‌داده‌شده (`erp.inventory:cost_view`)
`erp/inventory/products`: `value`, `avgCost` · `erp/inventory/overview`: `kpis.totalValue`,
`lowStock[].value/avgCost`, `recentMoves[].unitCost`, `topValue` (کل ویجت). کاربر legacy
(صفر ردیف rbac) همه را می‌بیند (R5)؛ کاربر rbac-managed بدون op → کلیدها **غایب**.

## ماتریس تست امنیتی — نتیجه
- `verify-2627-rbac.ts` (سوئیت ۱۲): 41/41 — ارث‌بری/منع غالب/op تلویحی‌نشدن/SoD/تفویض/R5/2FA کامل/grant_edit
- `verify-2628-abac.ts` (سوئیت ۱۳): 21/21 — scope own/department در WHERE، ۴۰۴، R5-scope، stripFields، سیاست 2FA روی requireOp (روشن→403، 2FA→مجاز، خاموش→legacy)
- E2E شش‌گانه: دستکاری کلاینت عملاً پوشش داده می‌شود چون تصمیم فقط از session+DB است (کلید در کد روت؛ هیچ هدر/بدنه‌ای خوانده نمی‌شود — audit:rbac این را ثابت نگه می‌دارد)

## Changelog
- **987c179** بند ۰: navigation/workspaces گارد واقعی؛ EXCEPTIONS ۱۲تایی مستند؛ ویجت‌ها tree-first؛ حذف debug spec
- **0652106** بند ۱: backup ops زیر سیاست 2FA؛ هشدار قفل TOTP (لاگ+ایمیل)؛ بنر گذرگاه needs2fa
- **9276df5** بند ۲: rowScopeSql/rowInScope + شش caller + SCOPED_MODULES + انتخابگر UI
- **d773781** بند ۳: stripFields + پوشش overview + SENSITIVE_FIELDS
- **720f3e3** بند ۴: ماتریس 21/21 (سوئیت ۱۳) + رفع باگ NULL-upsert rbac + E2E 6/6 + ۸۰۹ تست
