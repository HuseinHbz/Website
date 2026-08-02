# Phase 26.27 — سیستم دسترسی درختی جز به جز (RBAC + ABAC) + سخت‌سازی 2FA

**Branch:** `claude/bold-lamport-a1d6tg` → PR to `feature/v2-enterprise-upgrade`
**Commits:** cb06ccf (بند ۰–۳) · 6cd78d1 (بند ۴) · 7e0991c (بند ۵) · 7cbea0f (بند ۶) · 9b3cbb1 (بند ۷)

## جدول اقرار (mandatory attestation)

| شناسه | وضعیت | شاهد | توضیح |
|---|---|---|---|
| 0.1 role_assignments | انجام شد | migrate.ts `DROP TABLE IF EXISTS role_assignments` + schema.ts block removed (cb06ccf) | تصمیم (ب): اسکلت خفتهٔ فاز ۷ — صفر call site، مدل role-per-scope با گرنت گره‌ای این فاز نمی‌خواند → drop تا یک مدل بماند |
| 0.2 کشف سطح فعلی | انجام شد | جدول «وضعیت کشف‌شده» پایین همین گزارش | ROLE_PERMS/canDo، ROLE_WORKSPACE_WHITELIST، requireAdmin (۱۵۱ فایل)، ۱۷۱ روت admin، financeRbac (additive، دست‌نخورده)، روت 2FA قدیمی |
| ۱ رجیستری درختی | انجام شد | `src/lib/rbac/registry.ts` — ۱۲۸ گره تولیدشده از WORKSPACES + EXTRA_MODULES؛ audit:rbac سبز (matrix run #1) | تب‌ها از `?tab=` با hrefPath (درس BUG-010)؛ SENSITIVE_OPS = ۲۷ op در ۱۰ ماژول |
| ۲ موتور خالص | انجام شد | `src/lib/rbac/engine.ts` + ۱۱ تست واحد (engine.test.ts) + matrix ۴–۱۲ | ارث‌بری، منع غالب، خاص‌ترین برنده، op تلویحی نمی‌شود، null→legacy (R5) |
| ۲ مدل داده | انجام شد | migrate.ts: rbac_user_grants/ops/row_scope/role_templates/audit (idempotent) | UNIQUE(user,key,company)؛ هر تغییر → rbac_audit (matrix #26) |
| ۳ مهاجرت سرور | انجام شد | codemod ۱۵۱ فایل → requirePermission؛ audit:rbac: «157 guarded · 14 explicit exceptions · failures: 0» | کلید در کد روت، نه هدر (طرح x-pathname رد شد)؛ requireOp دستی در مسیرهای مالی |
| ۳ SoD | انجام شد | matrix #18–19 + گیت maker/checker 26.24b regressions سبز | گرنت :approve سازنده را دور نمی‌زند (isSeparationViolation روی effective owner) |
| ۴ UI درخت | انجام شد | `/admin/users/[id]/permissions` (PermissionTree.tsx) + E2E test 1 (گرنت از طریق همین API) | سه‌وضعیتی، ارث‌بری کم‌رنگ + منشأ، none قفل، جستجو، قالب، کپی، پیش‌نمایش |
| ۴ ماتریس CSV | انجام شد | `/api/admin/users/permissions-matrix?format=csv` (BOM + RFC-4180) | برای حسابرس |
| ۴ اجرای منو | انجام شد | visibleWorkspaces/visibleGroups(grants) + WorkspaceHome grant-aware؛ E2E test 4 (ERP برای none رندر نشد) | گرهٔ none اصلاً رندر نمی‌شود |
| ۴ قالب‌های نقش | انجام شد | ۹ قالب سیستمی seed شده؛ matrix #27–28 (کارشناس مالی = write بدون :post) | CEO/CFO/کارشناس مالی/حسابرس/HR/مارکتینگ/IT/سهامدار/کارمند |
| 5.1 کد بازیابی | انجام شد | matrix #35–39: ۱۰ کد هش‌شده، تک‌مصرف، شمارنده؛ ورود با کد + هشدار ایمیلی (auth.ts) | نمایش یک‌بار در UI (phase='codes')، بازتولید |
| 5.2 replay | انجام شد | matrix #31: همان کد بار دوم → rejected (totp_last_step) | پنجرهٔ ±۱ step کامل بسته می‌شود |
| 5.3 rate-limit TOTP | انجام شد | matrix #32–33: ۵ خطا → قفل ۱۰ دقیقه؛ کد معتبر هم در قفل رد | per-user، timing-safe compare در recovery |
| 5.4 رمزنگاری راز | انجام شد | matrix #29 + #34: AES-256-GCM `enc:v1:`؛ راز plaintext قدیمی همچنان کار می‌کند و در enable ارتقا می‌یابد | tamper → GCM auth fail (unit test) |
| 5.5 سیاست اجباری | انجام شد | requireOp: فلگ `2fa_required_sensitive` → op مالی بدون 2FA → ۴۰۳؛ matrix #40 (پیش‌فرض ۰ = R5) | روشن‌کردن با یک کلید erp_settings |
| 5.6 UI مدیریت | انجام شد | UsersManager: شمارندهٔ کد بازیابی + Regenerate + نمایش یک‌بار؛ ریست دیگری = op reset_2fa + ایمیل به هدف (2fa route) | |
| 5.7 بدهی کد | انجام شد | روت 2FA بازنویسی: zod (readJson)، حذف کد مرده (double null-check)، targetGate با requireOp | |
| 6.1 دامنهٔ سطر | انجام شد | crm leads (GET فیلتر، PUT/DELETE مالکیت) + customer 360؛ ۴۰۴ نه ۴۰۳؛ matrix #20–22 | `sales_customers.owner_id` ساخته + backfill از لیدهای convert شده |
| 6.2 فیلد حساس | انجام شد | inventory products: value/avgCost از پاسخ حذف بدون `erp.inventory:cost_view`؛ matrix #23–24 | حذف در API نه CSS؛ کاربر legacy می‌بیند (R5، matrix #17) |
| ۷ ماتریس امنیتی | انجام شد | `scripts/verify-2627-rbac.ts` — **41/41** روی PostgreSQL زنده؛ در `npm run regressions` ثبت شد (سوئیت #12) | همهٔ اثبات‌ها از توابع production (R3) |
| ۷ E2E | انجام شد | `e2e/rbac.spec.ts` — **4/4**: super_admin گرنت می‌دهد، کارشناس مالی draft 200/post 403، حسابرس write 403، کارمند none → GET 403 + منو خالی | الگوی storageState 26.26c |
| R5 رگرسیون | انجام شد | `npm run regressions` = **12/12 سبز** (۱۱ سوئیت قبلی بدون تغییر + 26.27) | کاربر بدون گرنت دقیقاً رفتار امروز |
| Gates نهایی | انجام شد | TS 0 · ESLint 0 · **787 تست** (۷۸۲→۷۸۷) · ۱۲ ممیزی 0 شامل audit:rbac · build تمیز | |

## تصمیم role_assignments (بند ۰.۱)
جدول از فاز ۷ باقی مانده بود: `role_assignments(user_id, role, scope)` — هیچ کدی نمی‌خواندش
و شکل آن (نقش-به-ازای-scope) با مدل این فاز (سطح مستقل به‌ازای هر گرهٔ درخت + op جدا)
ناسازگار است. **Drop شد** (migration idempotent) تا دو مدل موازی سردرگمی نسازد.

## گرامر کلید درخت
```
<workspace>                 erp
<workspace>.<module>        erp.finance          (slug مسیر ادمین، / → .)
<workspace>.<module>.<tab>  erp.treasury.reconcile   (از ?tab= در href)
<module>:<op>               erp.finance:post     (op حساس — هرگز از write تلویحی نمی‌شود)
```
قواعد تصمیم: منع غالب (none در هر سطح زیر‌درخت را می‌کشد، حتی write خاص‌تر) → خاص‌ترین صریح
برنده → بدون گرنت = null = دقیقاً رفتار نقش امروز (R5).

## جدول SENSITIVE_OPS (۲۷ op)
| ماژول | opها |
|---|---|
| erp.finance | post, void, delete, close_period, reopen_period |
| erp.sales | confirm, void, return, post, payment_create, refund |
| erp.purchasing | confirm, void, post |
| erp.treasury | reconcile, cheque_state |
| erp.approvals | approve, reject, delegate |
| erp.moadian | submit |
| erp.inventory | cost_view (بند ۶.۲ — فیلد حساس) |
| security.users | create, role_change, reset_2fa, grant_edit |
| system.settings.integrations | write |
| backup.backup | restore¹ |

¹ `backup.backup:restore` **رزرو** است: بازیابی بکاپ فقط از CLI (`deploy/restore.sh`) انجام
می‌شود و هیچ روت API برای restore وجود ندارد؛ اگر روزی ساخته شد، کلیدش از الان ثبت است.

## وضعیت کشف‌شده (بند ۰.۲ — قبل از کدنویسی)
| مؤلفه | یافته |
|---|---|
| ROLE_PERMS/canDo | ۵ نقش درشت (super_admin/administrator/editor/auditor/viewer) — دست‌نخورده، مبنای fallback R5 |
| ROLE_WORKSPACE_WHITELIST | در workspaces.ts — حفظ شد؛ گرنت درختی به‌صورت additive فیلتر اضافه می‌کند |
| requireAdmin | ۱۵۱ فایل روت — با codemod به requirePermission(key, need, legacyAction) مهاجرت کرد (همان شکل خروجی) |
| روت‌های /api/admin | ۱۷۱ (۱۵۷ گارد + ۱۴ استثنای صریح auth/nav/prefs/dashboards) |
| financeRbac (26.11) | additive و ارتوگونال (دامنهٔ cost-center) — دست‌نخورده؛ لایهٔ درخت بالای آن می‌نشیند |
| 2FA قدیمی | QR + verifyTotpCode plaintext، بدون replay/rate-limit/recovery → بند ۵ همه را بست |

## ماتریس تست امنیتی — نتیجه
اجرا: `DATABASE_URL=… npx tsx scripts/verify-2627-rbac.ts` → **41/41** (لاگ کامل در CI regressions).
پوشش: ارث‌بری/منع غالب/read≠write/op تلویحی‌نشدن/none-zیر‌درخت/R5-صفر-گرنت/SoD/scope=own→404/
فیلد حساس/کپی/audit-trail/قالب‌ها/2FA (رمزنگاری، replay، قفل، plaintext-legacy، recovery تک‌مصرف)/فلگ 5.5/grant_edit.
سطح HTTP: audit:rbac (کلید در کد هر روت) + E2E چهار-کاربره 4/4.

## نگاشت کامل روت → کلید (۱۷۱ روت، ۰ بدون نگاشت)
| روت (api/admin/) | کلید |
|---|---|
| about | brand.about |
| ai-analytics | analytics.ai-analytics |
| ai-kb | ai.ai-kb |
| ai-kb/sync | ai.ai-kb |
| ai-modules | ai.ai-control |
| ai/agents | ai.ai-agents |
| ai/analytics | ai.ai-agents |
| ai/prompts | ai.ai-agents |
| audit-logs | security.audit |
| auth/2fa | (exception) |
| auth/login | (exception) |
| auth/logout | (exception) |
| auth/me | (exception) |
| backup | backup.backup |
| backup/engine | backup.backup |
| backup/run | backup.backup |
| blog | content.blog |
| blog/[id] | content.blog |
| blog/categories | content.blog |
| certifications | brand.certifications |
| clients | crm.clients |
| consultations | crm.consultations |
| contacts | crm.contacts |
| content | content.content |
| courses | brand.academy |
| credentials | brand.credentials |
| crm/activities | crm.crm |
| crm/campaigns | crm.crm |
| crm/customers/[id] | crm.crm.customers |
| crm/dashboard | crm.crm.dashboard |
| crm/inbound | crm.crm |
| crm/leads | crm.crm |
| crm/leads/convert | crm.crm |
| crm/tickets | crm.crm.tickets |
| dashboard | executive.dashboard |
| dashboards | (exception) |
| dashboards/data | (exception) |
| dashboards/shares | (exception) |
| dashboards/templates | (exception) |
| database/health | operations.database |
| docs | documentation.docs |
| erp/approvals | erp.approvals |
| erp/approvals/ai | erp.approvals |
| erp/approvals/delegations | erp.approvals |
| erp/approvals/matrix | erp.approvals |
| erp/assets | erp.assets |
| erp/assets/lifecycle | erp.assets |
| erp/assets/overview | erp.assets |
| erp/bi/advisor | erp.business-intelligence |
| erp/bi/alerts | erp.business-intelligence |
| erp/bi/cockpit | erp.business-intelligence |
| erp/bi/data-quality | erp.business-intelligence |
| erp/bi/kpi | erp.business-intelligence |
| erp/bi/okr | erp.business-intelligence |
| erp/bi/process | erp.business-intelligence |
| erp/bi/sla | erp.business-intelligence |
| erp/documents | erp.documents |
| erp/documents/email | erp.documents |
| erp/documents/render | erp.documents |
| erp/documents/templates | erp.documents |
| erp/finance/accounts | erp.finance |
| erp/finance/ai | erp.finance |
| erp/finance/alerts | erp.finance |
| erp/finance/banking | erp.finance |
| erp/finance/budgets | erp.finance |
| erp/finance/cost-centers | erp.finance |
| erp/finance/currency | erp.finance |
| erp/finance/forecast | erp.finance |
| erp/finance/intelligence | erp.finance |
| erp/finance/journal | erp.finance |
| erp/finance/overview | erp.finance |
| erp/finance/periods | erp.finance |
| erp/finance/reports | erp.finance |
| erp/finance/revaluation | erp.finance |
| erp/finance/statement | erp.finance |
| erp/finance/tax | erp.finance |
| erp/finance/validate | erp.finance |
| erp/health | operations.health |
| erp/import | erp.import-center |
| erp/integrations | erp.integration-hub |
| erp/integrations/dispatch | erp.integration-hub |
| erp/inventory/moves | erp.inventory |
| erp/inventory/ops | erp.inventory |
| erp/inventory/overview | erp.inventory |
| erp/inventory/products | erp.inventory |
| erp/inventory/warehouses | erp.inventory |
| erp/master-data | erp.master-data |
| erp/master-data/advanced | erp.master-data |
| erp/moadian | erp.moadian |
| erp/numbering | erp.numbering |
| erp/numbering/generate | erp.numbering |
| erp/numbering/io | erp.numbering |
| erp/numbering/scopes | erp.numbering |
| erp/payments | erp.payments |
| erp/projects | erp.project-management |
| erp/projects/costing | erp.project-management |
| erp/projects/items | erp.project-management |
| erp/purchasing | erp.purchasing |
| erp/reports | erp.reports |
| erp/reports/ttms | erp.reports |
| erp/rules | erp.rules |
| erp/rules/simulate | erp.rules |
| erp/sales/customers | erp.sales |
| erp/sales/documents | erp.sales |
| erp/sales/overview | erp.sales |
| erp/sales/payments | erp.sales |
| erp/sales/performance | erp.sales |
| erp/sales/pricelists | erp.sales |
| erp/settings | system.settings |
| erp/treasury/ai | erp.treasury |
| erp/treasury/banks | erp.treasury |
| erp/treasury/cash | erp.treasury |
| erp/treasury/cheques | erp.treasury |
| erp/treasury/liquidity | erp.treasury |
| erp/treasury/overview | erp.treasury |
| erp/treasury/payments | erp.treasury |
| erp/treasury/receipts | erp.treasury |
| erp/treasury/reconcile | erp.treasury |
| erp/treasury/risk | erp.treasury |
| erp/treasury/statements | erp.treasury |
| events | brand.events-mgr |
| flags | system.flags |
| forms | brand.forms |
| hero | brand.hero |
| heroes | brand.hero |
| heroes/ai | brand.hero |
| heroes/analytics | brand.hero |
| heroes/animations | brand.hero |
| heroes/experiments | brand.hero |
| industries | brand.industries |
| integrations | system.integrations |
| logs/export | operations.logs-monitoring |
| logs/query | operations.logs-monitoring |
| logs/stream | operations.logs-monitoring |
| media | brand.media |
| nav-badges | (exception) |
| nav-prefs | (exception) |
| navigation | (exception) |
| operations/overview | operations.operations |
| organization | system.organization |
| organizations | crm.organizations |
| overview | executive.home |
| page-templates | brand.templates |
| pages | brand.pages |
| partners | system.partners |
| products | brand.products |
| projects | brand.projects |
| redirects | system.seo |
| resync | system.settings |
| search | executive.search |
| sections | brand.sections |
| seo | system.seo |
| services | brand.services |
| settings | system.settings |
| settings/integrations | system.settings.integrations |
| settings/onboarding | system.settings.onboarding |
| sites | system.sites |
| skills | brand.skills |
| soc/overview | security.soc |
| solutions | brand.solutions |
| table-prefs | (exception) |
| table-views | (exception) |
| technologies | brand.technologies |
| testimonials | brand.testimonials |
| timeline | brand.timeline |
| users | security.users |
| users/[id]/permissions | security.users |
| users/permissions-matrix | security.users |
| workflows | erp.workflows |
| workflows/run | erp.workflows |
| workspaces | (exception) |

## Changelog
- **بند ۰–۳ (cb06ccf):** registry (۱۲۸ گره از WORKSPACES) · موتور خالص + ۱۱ تست · ۵ جدول rbac + drop role_assignments · requirePermission/requireOp/checkTreePermission · codemod ۱۵۱ فایل · audit:rbac گیت جدید (در `npm run audit`).
- **بند ۴ (6cd78d1):** صفحهٔ درخت `/admin/users/[id]/permissions` + ماتریس CSV + ۹ قالب نقش + nav grant-aware + auth/me grants.
- **بند ۵ (7e0991c):** totpSecurity.ts (AES-GCM/replay/قفل/recovery) · signIn recovery-login + هشدار ایمیلی · روت 2FA بازنویسی (zod/targetGate/reset ایمیلی) · سیاست 2fa_required_sensitive در requireOp · UI کدهای بازیابی · ۵ تست واحد.
- **بند ۶ (7cbea0f):** sales_customers.owner_id + scope=own در leads/customer360 (۴۰۴) · sensitiveFieldVisible + ماسک cost در inventory · erp.inventory:cost_view.
- **بند ۷ (9b3cbb1):** verify-2627-rbac.ts 41/41 + ثبت در regressions (سوئیت ۱۲) · e2e/rbac.spec.ts 4/4 · بستن حفرهٔ create-and-post ژورنال بدون :post · WorkspaceHome grant-aware · fix playwright launchOptions.
