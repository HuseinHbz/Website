# CLAUDE.md — Project guide for the HBZ Website

> Persistent context for developing, updating, and deploying this project.
> Read this first before making changes.

## Working rules (from the maintainer — always follow)

1. **Keep deploy in sync.** Whenever the app changes (dependencies, build, env
   vars, ports, file layout, DB init, etc.), update the deploy scripts/docs too
   — `deploy/install.sh`, `deploy/update.sh`, `deploy/fix-pm2.sh`,
   `deploy/uninstall.sh`, README/docs — so a fresh deploy always matches the
   code. (هر دفعه پروژه آپدیت شد، بعدش deploy رو هم آپدیت کن.)
2. **Read before you act.** Always read the relevant files and current state
   before editing or running a build/deploy flow — never act on assumptions.
   (همیشه قبل از هر flow، اول فایل‌ها/وضعیت فعلی رو بخون.)
3. **Never stop mid-task on a limit.** If a context/usage limit is hit, resume
   automatically after it resets and keep going until the requested work is
   fully finished and pushed — don't leave the project half-done.
   (هر وقت به لیمیت خوردی، بعد از اتمامش پروژه رو ادامه بده و تمومش کن.)
4. **⭐ TOP PRIORITY — Finish every phase COMPLETELY, item by item.** This rule
   always outranks every other instinct (scoping down, batching, "later passes").
   When a phase / prompt / master prompt is given, execute it **بند به بند** —
   item by item, in the order listed — and do not stop until EVERY item is fully
   built, verified and pushed. Do not split a phase into pieces, do not deliver a
   partial subset, do not mark items "deferred"/"remaining"/"next pass", do not
   silently stage work for later. A phase is DONE only when 100% of its listed
   items are done. If one pass/session is not enough, keep going in the next pass
   automatically until the phase is closed — but never present a partial result
   as the finished phase. The only hard limit is the no-fake rule (see below): if
   an item genuinely cannot be built for real (e.g. it needs a DB column/UI/data
   that does not exist yet, or a heavy dependency the audits forbid), then BUILD
   what it truly needs — the missing column, table, UI, or a light-weight
   dependency-free implementation — rather than skipping it. If after that it is
   still genuinely impossible, STOP and say so explicitly and ask; never quietly
   leave a listed item undone.
   **Already-exists exception:** if a listed item was already built in an earlier
   phase, do NOT rebuild or duplicate it — audit it, verify it still works, reuse
   it, and count it as done for the phase. An item is complete when it is either
   (a) newly built + verified, or (b) confirmed already existing and working.
   (⭐ قانون همیشه در اولویت: هر فازی که داده می‌شود باید کامل کاملِ نهایی شود —
   تیکه‌تیکه نشود؛ کل فاز بند به بند و به ترتیب اجرا شود و تا وقتی همهٔ بندها
   واقعاً ساخته، verify و push نشده‌اند فاز تمام‌شده اعلام نشود. هیچ بندی
   deferred یا «باقی‌مانده» نماند؛ اگر یک پاس کافی نبود، خودکار ادامه بده تا فاز
   بسته شود. اگر موردی واقعاً بدون جعل قابل ساخت نیست، همان زیرساخت لازمش را
   بساز؛ اگر باز هم غیرممکن بود، صریح بگو و بپرس، نه اینکه بی‌صدا رهایش کنی.
   **استثنا:** مگر آن درخواست/بند از قبل وجود داشته باشد — در آن صورت دوباره
   نساز و duplicate نکن؛ فقط audit و verify کن، reuse کن و همان را به‌عنوان
   انجام‌شدهٔ فاز حساب کن.)
5. **Never switch branches unless I explicitly say so.** Always stay on the
   current working branch (`feature/v2-enterprise-upgrade`). Do not `git checkout`,
   `switch`, create, rename, or push to any other branch without an explicit
   instruction from the maintainer. If a workflow seems to need a different branch,
   STOP and ask first — never change branches on your own.
   (هیچ‌وقت برنچ را عوض نکن مگر من صریحاً گفته باشم؛ همیشه روی همین برنچ کاری بمان و
   بدون دستور من به برنچ دیگری checkout/push نکن.)

---

## Overview
Bilingual (FA/EN) personal/enterprise site for **Husein Habibazar** (HBZ),
infrastructure architect. **One** Next.js 15 app serves both the public site
and a full admin CMS. Data lives in **PostgreSQL** (async `pg` pool via Drizzle).

- Repo layout: the app is at **`outputs/habibazar-web/`** (run all npm commands there).
- On the server the repo is cloned to `/var/www/Website`; the app is installed/run
  from `/var/www/habibazar`.
- Default working branch: **`feature/v2-enterprise-upgrade`**.

## Tech stack
- **Next.js 15** (App Router, React 19), **TypeScript** (strict; no `any`).
- **PostgreSQL** (`pg`, async pool) + **drizzle-orm** (`pg-core`). Runtime DB
  access is async: Drizzle query builder (`await db.select()…`, `[0]` for one row)
  or the raw `pgQuery(sql, params)` helper (`$n` placeholders) in `lib/db/index.ts`.
  Schema created by the Drizzle migrator (`drizzle/0000_init.sql`) + raw DDL for 5
  non-ORM tables (`migrate.ts`). `better-sqlite3` is a **devDependency** only (the
  one-time SQLite→PG migration reader — see Phase 20). `DATABASE_URL` configures
  the connection. (Migrated from SQLite in Phase 20; `audit:pgcompat` = 0.)
- **next-intl v4** (i18n, RTL); **Tailwind CSS** (+ `tailwind-merge`, `clsx`).
- **jose** (JWT), **bcryptjs** (hashing), **otplib** (TOTP 2FA).
- **framer-motion** (animation), **recharts** (charts), **react-image-crop**
  (image upload/crop), **zod** (new/ERP routes validate via `readJson`+schemas;
  legacy CMS routes are guarded by `guardJson` — see Conventions), **nodemailer** (SMTP, dynamic import), **qrcode**.
- Tests: **vitest** (unit), **@playwright/test** (E2E). Lint: `eslint-config-next`.

## Directory map (`outputs/habibazar-web/src`)
- `app/[locale]/(marketing)/…` — public pages (FA/EN), RTL-aware. Root layout
  `app/[locale]/layout.tsx` sets `<html lang dir>` + fonts + providers.
- `app/admin/…` — admin CMS (separate root layout, English UI). ~50 sections,
  each a `page.tsx` + a `*Manager`/`*Editor`/`*Hub` client component.
- `app/api/…` — route handlers. `api/admin/*` (44 CRUD routes, auth-gated),
  plus public: `ai, blog, consultation, health, search, solutions, track`.
- `middleware.ts` — JWT gate for `/admin` + `/api/admin`, rate limiting,
  next-intl for public routes.
- `instrumentation.ts` — runs on server startup: `assertEnv()` + **DB init**
  (`runMigrations()` + `seedDatabase()`), both idempotent.
- `lib/db/` — `schema.ts` (59 tables), `migrate.ts` (raw idempotent
  `CREATE TABLE IF NOT EXISTS` + `ALTER` + secondary indexes + inline seeds),
  `seed.ts`, `index.ts` (`getDb()` singleton, WAL + FK on).
- `lib/admin/` — `auth.ts` (signIn/getAdminUser/canDo, JWT+bcrypt+TOTP),
  `audit.ts` (`logAction`).
- `lib/` — `rateLimit.ts`, `logger.ts`, `env.ts` (validate+assert),
  `publicData.ts` (public read helpers), `site.ts` (`SITE.url`), `schema.ts` (JSON-LD).
- `components/` — `admin/` (AdminShell, AdminSidebar, ui.tsx, MediaPicker),
  `sections/` (marketing sections), `ui/` (shared form controls — the active
  library), `ds/` (only `ThemeProvider` + `Toast` — the app-wide theme + toast
  providers used by the root layout), `seo/`, `forms/`, `ai/`, `layout/`.
- `i18n/` (`request.ts`, `navigation.ts`), `messages/{fa,en}.json`.

## Data & content model
- **`site_settings`** (key/value) holds global config. Edited via
  `/api/admin/settings` (GET → `{key:value}`, PUT upserts each key). Keys include:
  `site_name/tagline/url`, `logo_text/url`, `primary_color/accent_color`,
  `contact_email/phone`, `contact_location_en/fa`,
  `social_linkedin/github/twitter/instagram/telegram/whatsapp`,
  `smtp_host/port/user/pass/from`, `sms_ir_*`, `ai_*`.
- **Contact & social links** are managed under **«پروفایل اجرایی» (`/admin/about`,
  AboutEditor)** — its main **Save** persists both About content (`about_content`)
  and the contact/social keys to `site_settings`. They were removed from the
  Settings page to avoid duplication. The public `/about` reads them via
  `getPublicSetting(...)`.
- Content tables (projects, services, solutions, blog_posts, technologies,
  industries, testimonials, timeline_items, skills, certifications, pages,
  sections, ai_modules, …) are bilingual (`*_en` / `*_fa` columns) with
  `active` / `status` / `sort_order` filters (indexed in migrate.ts).

## Conventions
- API write routes: `const user = await getAdminUser()` then Drizzle insert/update;
  audit via `logAction`. Middleware already guarantees a valid admin JWT.
  Hardening (Phase 26 closure): every legacy CMS admin route now parses bodies
  through `guardJson` (`lib/api/respond.ts` — zod-era structural guard: 512 KB
  size cap, depth/array bounds, prototype-pollution key rejection → 400 via
  `BodyError`); DELETE handlers enforce `canDo(role,'delete')` (34 gates) and
  writes reject a null user (72 gates); no route returns raw `e.message`
  (login + documents leaks fixed). New routes must use `readJson` + a zod schema.
- **AI chat** (`POST /api/ai/chat`) — multi-provider (OpenAI/Claude/Gemini/Grok/
  Conduit, chosen by `ai_provider` setting), RAG over `ai_knowledge_base` with
  citations, circuit-breaker + retry. Guarded by `lib/ai/guard.ts`: zod-validated
  body (client may only send `user`/`assistant` roles — a client `system` role is
  rejected), 20 req/min rate limit (`limiters.ai`), and prompt-injection/jailbreak/
  secret-exfiltration detection → blocked requests get a safe refusal + a
  `logger.security` audit entry (source `ai`). Injected RAG delimiters are
  sanitized. Unit-tested in `src/lib/ai/__tests__/guard.test.ts`.
- **CMS → AI knowledge sync** (`src/lib/ai/sync.ts`) — keeps `ai_knowledge_base`
  current with published content (blog/projects/solutions/technologies/journey).
  Each synced row is keyed by `source_url = cms://<type>/<id>` → idempotent upsert
  + orphan cleanup + duplicate detection. Auto-runs debounced from
  `audit.logAction` on content edits; manual via `POST /api/admin/ai-kb/sync`.
  Mapping is a pure, unit-tested function (`buildEntry`).
- Images from the CMS use plain `<img>` (dynamic/uploaded) — `no-img-element`
  is intentionally disabled project-wide in `.eslintrc.json`.
- Fonts via `next/font/google` (Inter, JetBrains_Mono, Vazirmatn→`--font-persian`).
- Uploads are saved under `public/uploads/` (via `POST /api/admin/media`) and
  served at `/uploads/` by `src/app/uploads/[...path]/route.ts` — a Next route,
  **not** an nginx alias, so freshly uploaded files always work under `next start`.
- **Internal BackupEngine** (`src/lib/backup/`, cron-free) — the primary backup
  system. Runs in-process; started by `instrumentation.ts` via
  `scheduler.start()`. Triggers: app-level scheduler (`scheduler.ts`,
  hourly→yearly by cadence, no OS cron), event-driven data-change (debounced from
  `logAction`), uploads `fs.watch`, and manual (`POST /api/admin/backup/run`).
  Each backup = WAL-safe SQLite `.backup()` + config + media + manifest.json →
  tar.gz → AES-256 (`crypto.ts`) → SHA-256 → distributed to 3-2-1 storage
  adapters (`storage.ts`: local + `BACKUP_MIRROR_DIR` + `BACKUP_REMOTE`
  rclone/rsync) → **verified by an isolated dry restore** (decrypt + untar +
  integrity_check + schema compare) before status=success; retries ≤3. Catalog in
  the `backups` table; status/alerts/3-2-1 via `GET /api/admin/backup/engine`.
  Env: `BACKUP_ENCRYPTION_KEY` (else falls back to `ADMIN_JWT_SECRET`),
  `BACKUP_ROOT`, `BACKUP_MIRROR_DIR`, `BACKUP_REMOTE`, `BACKUP_KEEP`,
  `BACKUP_SCHEDULER_DISABLED=1`.
- Legacy `POST /api/admin/backup` (manual WAL-safe `.backup()` into
  `data/backups/`) + `/admin/backup` UI remain for on-demand DB snapshots.
- **Log bus** (`src/lib/logs/bus.ts`) — every `logger.*` call, audit event and
  backup event fans out to (1) live SSE subscribers, (2) a ring buffer, (3) the
  `system_logs` table (deferred, non-blocking). `fingerprint` groups duplicates.
- Admin **Logs & Monitoring** (`/admin/logs-monitoring`, `LogsMonitoring`) — the
  real-time module: SSE live console (`GET /api/admin/logs/stream`), filter by
  level/source/service/date, search, pause/resume, error grouping,
  JSON/CSV export (`/api/admin/logs/export`), history query
  (`/api/admin/logs/query`), backup-engine status strip + alert badge.
- Admin **Operations Center** (`/admin/operations`, `OperationsCenter`) — SRE
  dashboard on **real** telemetry via `GET /api/admin/operations/overview`
  (`lib/ops/snapshot.ts`): live CPU/memory/disk, DB probe latency, log-derived
  requests/min + error rate, a subsystem health matrix (app/db/backup/scheduler/
  logging/memory/storage/email/AI/cache/queue → healthy|warning|critical|offline),
  infra facts (OS/kernel/node/sqlite/CPU/uptime), recent real errors, and
  SLI/SLO/error-budget. Auto-refreshes every 10s. (Replaced the old mock data.)
- Admin **Database Center** (`/admin/database`, `DatabaseHealth`) — read-only
  diagnostics via `GET /api/admin/database/health`: integrity_check + quick_check,
  foreign_key_check, WAL/journal + page/free stats, table+index census, per-table
  row counts, critical-schema validation, and a 0–100 health score. Never mutates.
- **CRM Leads** (`/admin/crm`, `LeadsManager`) — Phase-15 business foundation.
  `crm_leads` table (pipeline stage/source/score/owner, distinct from raw
  contact/consultation requests). `GET/POST/PUT/DELETE /api/admin/crm/leads`:
  zod-validated, RBAC-gated (`requireAdmin('edit'|'delete')`), audit-logged. Lead
  scoring + pipeline stats are pure, unit-tested (`src/lib/crm/leads.ts`); writes
  re-score server-side. GET returns leads + aggregate sales KPIs.
- **Asset Center** (`/admin/assets`, `AssetManager`) — Phase-21 ERP Module 5
  (Enterprise Asset Management, completed). Tabbed: Dashboard · Assets (with a
  per-asset detail drawer). Extended `assets` table (category/model/manufacturer/
  purchase price/residual/useful life/depreciation method/insurance/contract/
  barcode/GPS/department/employee/cost-center/project) + `asset_assignments`,
  `asset_maintenance` (schedule + history), `asset_activity` (timeline). Pure
  **depreciation engine** `src/lib/erp/depreciation.ts` (straight-line/declining-
  balance/sum-of-years-digits, unit-tested) + `warrantyState` (`assets.ts`).
  Server layer `src/lib/erp/assetData.ts` enriches each asset with book value +
  warranty/insurance/calibration health + open-maintenance, shared by list and
  dashboard. APIs `/api/admin/erp/assets` (CRUD), `/assets/lifecycle` (detail +
  add assignment/maintenance/mark-done), `/assets/overview` (dashboard) —
  zod/RBAC/audited, every change writes an `asset_activity` row. Verified against
  real PostgreSQL (depreciation round-trip).
- **Document Center** (`/admin/documents`, `DocumentCenter`) — Phase-21.5 ERP
  Module 8 (Document Generation Engine). Generates 10 document types (invoice/
  quotation/purchase-order/contract/proposal/warranty/delivery-note/service-
  report/completion-certificate/financial-report) to **print-ready HTML** (browser
  "Save as PDF" — no heavy PDF dependency) with a **QR verify code**. Pure engine
  `src/lib/erp/documents.ts` (`buildSalesPayload`, `renderDocumentHtml` with XSS
  escaping, `escapeHtml`/`money`; 7 unit tests). Server layer
  `src/lib/erp/documentData.ts` creates a doc from a **live sales source** (pulls
  invoice/quote lines + customer) or a **manual composition**, catalogs it in
  `gen_documents`, and renders HTML with a `qrcode` data-URL. APIs
  `/api/admin/erp/documents` (list/generate/void) + `/documents/render` (HTML).
  Public verification page `/[locale]/verify/[code]` (the QR target) confirms a
  document is issued. Verified vs real PostgreSQL (generate→render→verify).
- **Company Profile & Invoice Designer** (Phase 26) — `/admin/company`
  (`CompanyProfile`): legal identity/registration+tax/address/banking/branding
  media persisted as `company_*` keys in site_settings; the Document Engine
  (`loadCompanyProfile`) prints them automatically on every generated document
  (logo, reg/national/economic/tax/VAT block, bank+contact footers, seal +
  signature). **Invoice Designer**: `doc_templates` (seeded official/unofficial/
  tax/service variants) + `DocTemplateConfig` (variant/accent w/ `safeAccent`
  guard/watermark/terms/payment instructions/footer/toggles/custom fields);
  API `/api/admin/erp/documents/templates` (CRUD) + render `?template=` override
  + POST live-preview; Document Center **Invoice Designer** tab (form + debounced
  preview iframe) and a template selector on generation (`gen_documents.
  template_key`). Verified vs real PostgreSQL (branding + watermark on rendered
  HTML; override wins).
  **Persian/RTL + rich contracts (Phase 26.10)**: `DocTemplateConfig.rtl` renders
  the whole document `dir="rtl" lang="fa"` with a localized label set; **20 seeded
  `fa-*` Persian templates** (all customizable in the designer) + `fa-contract`/
  `fa-letterhead` (`doc_type=contract`, «بسمه تعالی» + Iranian terms). Contract
  bodies are authored in a **Word-like `RichTextEditor`** (contentEditable +
  bold/italic/underline, H1–H3, lists, align, font-size, RTL/LTR) → stored as
  `DocPayload.bodyHtml`, **sanitized at render** by the pure allowlist sanitizer
  `src/lib/erp/richtext.ts` (`sanitizeRichHtml`, 13 XSS tests — drops script/
  handlers/`href`/`src`, keeps only re-validated inline style). A full-width
  uploaded **letterhead banner** (`company_letterhead_url` → `DocBranding.
  letterheadUrl`) prints atop every document. Verified vs real PostgreSQL
  (contract rich RTL HTML + letterhead + XSS-safe round-trip).
- **Reporting Center** (`/admin/reports`, `ReportingCenter`) — Phase 21.9 Reporting
  Platform. A fixed report catalog reads live from each module's already-verified
  data layer (no arbitrary SQL, no duplicated aggregation). Pure core
  `src/lib/reports/pivot.ts` (`groupBy`/`aggregate`/`summarize`/`pivot`/`toCsv`
  RFC-4180; 5 unit tests). Catalog + `runReport(id)` → `{columns,rows,summary}`
  in `src/lib/reports/reportData.ts`, reusing `ledgerData`/`salesData`/
  `inventoryData`/`assetData`/`costingData`. 7 reports: trial balance, income
  statement, sales-by-customer, invoice register, inventory valuation, asset
  register, project costing. API `GET /api/admin/erp/reports` (catalog / run /
  `format=csv`), RBAC-gated. Bilingual UI: module-grouped picker, summary cards,
  Table + group-by Summary views, CSV export. 7 reports: trial balance, income
  statement, sales-by-customer, invoice register, inventory valuation, asset
  register, project costing. **Purchasing reports added after Phase 26.1**
  (Purchase Register + Spend by Vendor → 9 total). **Bilingual labels (Phase
  26.10)**: `LABEL_FA`/`faLabel()` translate column + summary labels for the fixed
  catalog (the report data was always correct; e.g. trial balance legitimately
  filters zero-balance accounts, so an empty result on fresh books is expected,
  not a bug). Verified vs real PostgreSQL.
- **Enterprise Numbering Engine** (`/admin/numbering`, `NumberingCenter`) — Phase
  21.11. The single source of truth for document numbers across every module (a
  platform service, not a per-module helper). Tables `numbering_formats` (pattern
  + reset policy + counter rules per doc_type), `numbering_counters` (atomic
  counter per format×scope×period — scope keys give multi-company/branch/warehouse
  independence, period keys drive resets), `numbering_audit` (append-only log of
  every mint/reserve/release/failure). Pure core `src/lib/numbering/format.ts`
  (`periodKey`/`renderNumber` 14 placeholders/`padCounter` numeric|hex/
  `validateFormat`/`formatRegex`; 9 unit tests). Service `src/lib/numbering/
  service.ts` — `generateDocumentNumber`/`previewDocumentNumber`(=`getNextNumber`)/
  `validateDocumentNumber`/`reserveNumber`/`releaseReservedNumber`/`resetCounter`;
  **every ERP module must call this — never number on its own**. Concurrency-safe:
  a transaction takes `pg_advisory_xact_lock` then does an atomic `INSERT … ON
  CONFLICT (format,scope,period) DO UPDATE … RETURNING current_value` (unique index
  serialises increments) → zero duplicates. APIs `/api/admin/erp/numbering` (CRUD +
  `?view=dashboard|formats|counters|audit`) + `/numbering/generate` (generate/
  preview/validate/reserve/release/reset), RBAC/zod/audited. Admin console
  (System group): Dashboard · Formats (visual builder: click-to-insert placeholder
  chips + live client-side preview) · Counters (reset) · History & Audit (search).
  Verified vs real PostgreSQL: 500 concurrent generations → 500 unique / 0
  duplicates / perfect 1..N sequence; yearly reset + scope independence confirmed.
  **Module wiring**: Sales documents (`sales/documents`), generated documents
  (`documentData`, namespaced `doc_*`) and Projects (auto-code when blank) mint
  through `nextNumber()` (`src/lib/numbering/integrate.ts`) instead of the old
  timestamp scheme; 15 default formats seeded idempotently in migrate.ts.
  **`{RANDOM}`/`{UUID}`** are auto-filled server-side (crypto; `random_length`
  configurable). **Import/Export** of format configs (JSON/CSV, upsert-by-doc_type,
  each row `validateFormat`-checked) via `/api/admin/erp/numbering/io` +
  `src/lib/numbering/io.ts`. **Scopes** registry (`numbering_scopes`,
  company/branch/warehouse/department) via `/numbering/scopes`; curated
  **Templates** (`src/lib/numbering/templates.ts`). Console tabs: Dashboard ·
  Formats · Companies&Branches · Templates · Counters · History&Audit · Settings.
  **Granular perms** on RBAC: reset counter + import config = administrator
  (`manage_settings`); manage/generate = `edit`; view/export/audit = any admin.
  Full report: `docs/governance/phase21-numbering-engine.md`.
- **Global Search** (`/admin/search`, `GlobalSearch`) — Module 13. One admin-side
  search layer over live business data (distinct from the public CMS `/api/search`).
  Pure engine `src/lib/search/engine.ts` (`tokenize`/`scoreField` exact>prefix>
  word-boundary>substring/`scoreCandidate` title×3>subtitle×2>keywords/`rankHits`/
  `groupByModule`; 8 unit tests). Server layer `src/lib/search/globalSearch.ts` — a
  closed registry of 13 parametrised-ILIKE sources across 10 modules (CRM leads,
  sales customers/documents, GL accounts/journals, inventory products, assets,
  projects/tasks, generated documents, workflows, rules, integrations); the search
  pattern is the ONLY bound param (no arbitrary SQL), sources run concurrently, a
  missing table never breaks search. API `GET /api/admin/search` (`?q=` ≥2 chars,
  `?modules=` filter), RBAC-gated. Debounced bilingual UI: module filter chips +
  grouped result cards linking into each module. Verified vs real PostgreSQL.
- **Executive Dashboard** (`/admin`, `ExecutiveDashboard`) — the redesigned admin
  home. Aggregates KPIs from every module via `GET /api/admin/overview`
  (`lib/admin/executiveOverview.ts`, each module guarded so one failure never
  breaks the page): 6 hero cards (net income/cash/inventory value/asset book
  value/CRM pipeline/AI calls), per-module panels (Finance/Inventory/Assets/CRM/
  AI/Traffic), cross-module alerts (out-of-stock, warranty, failed AI…), a live
  site-traffic chart and an audit-driven activity feed. Website analytics moved
  to `/admin/dashboard` (`AnalyticsPanel`). Reuses each module's data layer — no
  duplicated aggregation.
- **Project Center** (`/admin/project-management`, `ProjectCenter`) — Phase-21 ERP
  Module 6 (Enterprise Project Management). Distinct from `/admin/projects` (CMS
  Case Studies). Tabbed: Dashboard · Projects → per-project hub with **Kanban ·
  Gantt · Milestones · Timesheet**. Tables `pm_projects`, `pm_tasks` (todo/
  in_progress/review/done, priority, estimate, dates), `pm_milestones`,
  `pm_timesheets`. Pure engine `src/lib/erp/projects.ts` (`projectProgress`
  hours-weighted, `kanbanColumns`, `projectHealth` on-track/at-risk/overdue/done,
  `ganttLayout` date→%, `loggedHours`, `projectKpis`; 11 unit tests). Server layer
  `src/lib/erp/projectData.ts` enriches projects + builds the detail hub + Gantt
  range. APIs `/api/admin/erp/projects` (CRUD/list/detail/overview) +
  `/projects/items` (task/milestone/timesheet create/move/delete) — zod/RBAC/
  audited. Verified vs real PostgreSQL (progress/health/Gantt round-trip).
  **Project Costing** (Phase-21.4, subsystem 7) is a "Costing" view in the detail
  hub: pure engine `src/lib/erp/costing.ts` (`costByCategory`, `costingSummary`
  with profit/margin, budget variance and earned-value forecast EAC/VAC,
  `costingKpis`; 8 unit tests). Server layer `src/lib/erp/costingData.ts` derives
  labor from timesheet hours × rate + manual cost/revenue entries + % progress.
  API `/api/admin/erp/projects/costing` (detail/overview/add/delete). Verified vs
  real PostgreSQL (profit + EVM forecast round-trip).
- **Sales Center** (`/admin/sales`, `SalesCenter`) — Phase-21 ERP Module 2
  (Enterprise Sales). Tabbed: Dashboard · Customers · Quotations · Sales Orders ·
  Invoices · Payments. Tables `sales_customers` (credit limit), `sales_documents`
  (unified quote/order/invoice/credit_note header, draft→sent→confirmed→partial→
  paid→void), `sales_document_lines` (qty/unit price/discount %/tax %),
  `sales_payments`. Pure engine `src/lib/erp/sales.ts` (`lineTotals`,
  `documentTotals`, `customerCredit`, `invoiceStatus`, `salesKpis`; 7 unit tests)
  — line = qty×price then discount then tax on net. Server layer
  `src/lib/erp/salesData.ts` computes each customer's live credit position + the
  dashboard. APIs `/api/admin/erp/sales/{customers,documents,payments,overview}`:
  zod/RBAC/audited; totals computed server-side; quote→order→invoice convert;
  recording an invoice payment recomputes its paid status. Verified vs real
  PostgreSQL (credit position + invoice status round-trip).
- **Financial Center** (`/admin/finance`, `FinanceCenter`) — Phase-21 ERP Module 1
  (Enterprise Financial System). Tabbed: Dashboard · Chart of Accounts · Journal
  Entries · Reports. Double-entry GL: `gl_accounts` (seeded standard chart),
  `gl_journal_entries` (draft/posted/void) + `gl_journal_lines`, `gl_fiscal_periods`.
  Pure engine `src/lib/erp/ledger.ts` (normal sides, `entryBalanced`, `trialBalance`,
  `incomeStatement`, `balanceSheet`, `financialKpis`; 8 unit tests). Server layer
  `src/lib/erp/ledgerData.ts` tallies **only posted** lines (CASE-gated, drafts
  excluded) → statements. APIs `/api/admin/erp/finance/{accounts,journal,reports,
  overview}`: zod/RBAC/audited; journal POST is server-side balanced-validated
  (debits=credits) before accepting; post/void lifecycle. UI journal editor shows
  a live balance check. Verified vs real PostgreSQL (books tie out; drafts excluded).
  **Multi-Currency (Phase 26)**: base = **Iranian Rial (IRR)**, **Toman (IRT)** a
  first-class display unit (exact 10:1). Pure engine `src/lib/erp/currency.ts`
  (`convert` via the Rial base, `toBase`, `rialToToman`/`tomanToRial`,
  `exchangeDifference`, `formatMoney` Persian-digit/Rial-Toman, `dualRialToman`;
  built-ins IRR/IRT/USD/EUR/AED) + **Tax engine** `src/lib/erp/tax.ts`
  (`computeTaxes` VAT/custom add + withholding subtract, tax groups/exemptions,
  Iran VAT 9%; `extractInclusive`, `vatOf`) — both unit-tested. Tables
  `erp_currencies` (seeded) + `erp_exchange_rates` (daily Rial rate per code×date);
  data layer `currencyData.ts` (`latestRates`/`setRate`/`rateHistory`). API
  `GET/POST /api/admin/erp/finance/currency` (rates + `?convert`/`?history`,
  setRate RBAC+audit). Finance Center **Currency** tab (set rate + converter +
  rates table). Verified vs real PostgreSQL (seed + rate + convert).
  **Banking (Phase 26)**: pure engine `src/lib/erp/banking.ts` (statement
  auto-match by amount+date-window w/ confidence, cheque lifecycle state machine
  issued/received→…→cleared/bounced, petty-cash balance w/ low-balance flag;
  tested) + tables `bank_accounts`/`bank_statement_lines`/`cheques`/
  `petty_cash_entries`, data layer `bankingData.ts` (auto-match vs sales+purchase
  payments), API `/api/admin/erp/finance/banking`, Finance **Banking** tab
  (Reconciliation/Cheques/Petty cash). **Multi-company (Phase 26)**:
  `erp_companies` (seeded HQ default) + `gl_journal_entries.company_id`;
  `loadTallies(companyId?)` scopes books (NULL→default co.), pure
  `consolidateTallies`; reports API `?company=<id|all>` + UI scope selector +
  company create. **AI Financial Assistant (Phase 26)**: `financeAi.ts`
  (deterministic anomaly scan — duplicate totals/5×-median outliers — + grounded
  prompt builder; tested) → `POST /api/admin/erp/finance/ai` through the shared
  `runCompletion` with a live read-only snapshot (KPIs/receivables/payables/
  recent entries), audited; Finance Dashboard AI card. All verified vs real
  PostgreSQL. Report: `docs/governance/phase26-erp-currency-tax.md`.
- **Purchasing Center** (`/admin/purchasing`, `PurchasingCenter`) — Phase-26.1
  procure-to-pay (the ERP buy side). Pure engine `src/lib/erp/purchasing.ts`
  (`documentTotals` reusing sales line-math; multi-level approval routing
  `requiredApprovalLevels`/`isFullyApproved` by amount — ≤50M Rial→1, ≤500M→2,
  above→3; `validateBudget`; `vendorScore` weighted 0–100→stars+A/B/C/D grade;
  `vendorPayable`/`purchaseInvoiceStatus`/`purchaseKpis`; 7 unit tests). Tables
  `purchase_vendors`/`purchase_documents` (unified header: request/rfq/quotation/
  order/receipt/invoice/return/credit_note)/`purchase_document_lines`/
  `purchase_approvals`/`purchase_payments`/`vendor_evaluations`/`vendor_contracts`.
  Data layer `purchasingData.ts` (vendor CRUD+eval, doc save w/ server totals +
  `nextNumber`, submit→approval-levels, `decideApproval` advances to approved only
  when every level signs, `recordPayment`, `convertDocument` PR→PO→GRN→invoice,
  `overview`). API `/api/admin/erp/purchasing` (`?view=overview|vendors`, type
  list, detail; POST vendor.create/update/evaluate + doc.save/submit/approve/
  convert/payment — L2+ approvals need administrator; RBAC/zod/audit). UI tabs:
  Dashboard · Vendors (+ 5-criteria evaluation) · Documents (line editor + submit/
  approve/convert). Verified vs real PostgreSQL (327M PO → 2-level approval flow).
  **GL auto-posting**: pure `purchaseInvoicePostingLines` (Dr Inventory 1200 + Dr
  Taxes Payable 2100 / Cr Accounts Payable 2000, balanced) + `postPurchaseInvoice
  ToGl` writes a posted `gl_journal_entry` (idempotent, links `gl_entry_id`),
  reusing the Finance GL — API `doc.post` (administrator-gated) + "Post to GL" UI
  action. Verified vs real PostgreSQL (invoice 1090 → balanced entry, AP credited).
  **Analytics tab**: pure `purchaseAnalytics` (committed spend/month — drafts
  excluded, spend by type, top vendors, status distribution; unit-tested) →
  `?view=analytics` → `PurchasingCharts.tsx` (recharts via `next/dynamic`, page
  stays 172 kB). Verified vs real PostgreSQL. **Vendor Portal**: token-gated
  read-only supplier view — `vendor_portal_tokens` (128-bit, expiring,
  revocable) + `vendorPortal.ts` (fails closed; own-vendor isolation), admin
  `vendor.portalLink`/`portalRevoke` actions, public noindex page
  `/[locale]/vendor/[token]`. Verified vs real PostgreSQL. Report:
  `docs/governance/phase26.1-purchasing-platform.md`.
- **Phase 26 — Enterprise ERP Completion** (audit-first gap closure; report:
  `docs/governance/phase26-enterprise-erp-completion-report.md`, audit:
  `phase26-erp-completion-audit.md`). **26.1**: `purchase_documents.priority` +
  budget-gated submit (`validateBudget` vs department committed spend, blocked
  400 stays draft), **GRN→inventory** (`receiveDocument` writes real `inv_moves`
  per product line, `received_qty` partial→received, `product_id` carried
  through conversion), RFQ `compareQuotes` (`?compare=` + modal, cheapest-first
  w/ vendor rating). **26.2**: customer party identity `kind` حقیقی/حقوقی +
  `national_id/reg_no/economic_code` printed on sales-sourced documents; shared
  `sendMail()` (notifications.ts, fails closed) + `POST /api/admin/erp/
  documents/email` (HTML attachment, audited) + Email action; pure **Code 39
  barcode** engine (`erp/barcode.ts`) + `DocTemplateConfig.showBarcode`.
  **26.3**: live bank balances (opening + statement movements) + pure
  `cashFlowSeries` (MA-3 forecast) → `?view=cashflow` → Banking Cash-flow
  section. **26.4**: `salesPerformance.ts` (targets/attainment/commission =
  invoiced × rate, least-squares `forecastSales`, `runStatement` ledger) +
  `sales/performance` API + dashboard Performance section + customer
  `?statement=` modal; `sales_targets` table. **26.5**: `erp_companies` legal
  identity (reg/national/economic/tax/address/phone) + creation modal;
  **intercompany** pure engine (`erp/intercompany.ts`: mirrored balanced pairs
  on seeded 1150 Due-From / 2150 Due-To + 1010 Bank; transfer/settle) →
  `bookIntercompany` posts two company-scoped entries, admin-gated
  `intercompany.transfer` action + modal; clearing offsets in consolidation.
  **26.6**: `scanPaymentAnomalies` (double-pay + 5×-median outliers over both
  payment ledgers) + deterministic 6-month sales/spend series with trend
  forecasts injected into the finance-AI snapshot (reuses `forecastSales`).
  All engines pure+unit-tested; every sub-phase live-PG round-trip verified.
- **Phase 26.7 — ERP Final UX & Currency Architecture** (report:
  `docs/governance/phase26.7-erp-ux-currency-report.md`). **Navigation Resolver
  Engine** (`workspaces.ts`: `hrefPath`/`hrefMatches`/`resolveActiveHref` —
  exact > longest boundary match, ONE active item; quick actions carry unique
  `?new=` route identities and the ERP ones deep-link into the create modal of
  Sales/Inventory/Finance; 10 regression tests). **Currency**: `erp_settings`
  (default/display currency, precision — seeded IRR) + `/api/admin/erp/settings`
  + `lib/erp/settings.ts`; `formatCurrency()`/`fmtMoney` in `lib/format.ts` is
  THE money-formatting standard (ریال/تومان suffix, $/€ prefix), configured by
  AdminShell from settings — no hardcoded $. **Multi-currency transactions**:
  `currency`/`exchange_rate`/`base_total` on sales+purchase documents,
  `currency`/`exchange_rate` on journal entries + both payment ledgers,
  `currency` on assets; `rialRateFor()` (IRR=1, IRT=10, USD/EUR via
  `erp_exchange_rates`, null→API rejects) + currency selects in the doc forms.
  **Sales soft delete**: `deleted_at/deleted_by/delete_reason` + status='void'
  (aggregates unchanged), reason-prompting Delete action, admin-roles only.
  **Template Center**: 24 seeded invoice templates (Professional/Corporate/
  Minimal/Retail/International/Iranian-Accounting) + `company_ceo` branding +
  new gen doc types receipt/payment_voucher/journal_voucher (RC/PV/JV).
  **System Management**: dashboards with no widgets render the workspace's
  module grid (never blank); System workspace links Company/Currency/Document/
  Security/Audit pages. Live-PG verified (10 round-trip tests incl. IRR/IRT/
  USD/EUR invoices).
- **Phase 26.8 — Multi-Currency Conversion + Revaluation Engine** (report:
  `docs/governance/phase26.8-multi-currency-engine-report.md`). **NO DATA
  MUTATION**: documents keep original currency/amount/registration-rate;
  conversion is display-time only. `formatMoney(amount, source, target,
  rates)` + `convertFromBase` in `lib/format.ts` (mandate-exact tests);
  **CurrencyDisplayProvider/useDisplayCurrency/CurrencyPicker**
  (`lib/admin/currencyDisplay.tsx`, per-user localStorage pref, mounted in
  AdminShell) drive dynamic KPIs on the 6 ERP dashboards (Finance/Sales/
  Purchasing/Inventory/Assets/Executive). KPI aggregates are Rial-base
  (`SUM(total×exchange_rate)`, legacy rate=1 unchanged) across sales/
  purchasing/credit/payables; assets gained an immutable registration
  `exchange_rate` (book value depreciates on the Rial base); GRN receipts
  write Rial-base `unit_cost`; consolidated bank cash converts per-account.
  **Revaluation Engine** (`erp/revaluation.ts` pure + `revaluationData.ts`):
  live FX positions (assets + open AR/AP) vs booked rates → delta-only
  posted entry on seeded 1190/4900/6980 (gain: Dr 1190/Cr 4900; loss:
  Dr 6980/Cr 1190; payables invert; cumulative — re-runs book nothing),
  admin-gated API + Finance→Currency Revaluation section. Reports: Currency
  Exposure + Currency Gain/Loss (11 total). setRate audits old+new rate.
  Live-PG verified: 2000-USD asset → USD/IRT/IRR/EUR views; 5000-USD invoice
  immutable through a rate change; 3.5B gain booked once + 700M incremental.
- **Financial Intelligence Platform** (`/admin/financial-intelligence`,
  `FinancialIntelligence`) — Phase 26.11, audit-first upgrade of the Financial
  System (report: `docs/governance/phase26.11-enterprise-financial-intelligence-report.md`,
  audit: `phase26.11-financial-intelligence-audit.md`). Reuses GL/AP/AR/sales/
  purchasing/inventory/assets/treasury/currency/tax/reporting/AI — only gaps
  built. **Pure engines** (unit-tested): `erp/budget.ts` (variance/consumption/
  forecast-remaining + lifecycle draft→review→approved→locked), `erp/costCenter.ts`
  (cost/profit-center roll-up + margin + allocation + tree — a profit center is a
  cost center `kind='profit'`, one engine), `erp/forecast.ts` (trend/moving-average/
  growth%/seasonal), `erp/kpiEngine.ts` (revenue/profit/cash/AR/AP/inventory KPIs +
  runway/DSO/turnover), `erp/financialAlerts.ts` (budget>90%/cash-shortage/AR-
  overdue/FX/tax rules + fingerprints). **Data layers** reuse verified module data
  (no duplicated aggregation): `budgetData` (CRUD + immutable version snapshots +
  lifecycle + actuals from **POSTED GL** by account×cost-center×fiscal-year),
  `costCenterData`, `financialIntelligenceData` (KPI assembly, CFO + department
  dashboards, forecasting, FX exposure, tax liability, snapshots),
  `financialAlertsData` (idempotent upsert-by-fingerprint + auto-resolve),
  `financeRbac` (**additive** `users.finance_role` + `erp_cost_center_members`
  scope over the 3-role core — dept managers see only their centers, CFO/CEO
  consolidated). APIs `/api/admin/erp/finance/{budgets,cost-centers,intelligence,
  forecast,alerts}` + `finance/ai` **`diagnose`** root-cause analyst (MoM deltas
  through `runCompletion`); Reporting Center +6 reports (budget/variance/cost-
  center/profit-center/CFO/forecast). Tables `erp_cost_centers(+_members)`,
  `erp_budgets/_lines/_versions`, `erp_forecasts`, `erp_kpi_snapshots`,
  `erp_financial_alerts` + additive `cost_center_id` on GL/sales/purchase lines
  (idempotent; `deploy/postgres/rollback-phase26.11.sql`). UI: CFO dashboard +
  budgets(variance+lifecycle) + cost/profit centers + forecasting + alerts + AI
  analyst, every figure repriced live via `useDisplayCurrency`/`CurrencyPicker`
  (IRR/IRT/USD/EUR, transactions unchanged). Verified vs real PostgreSQL:
  budget(100)→posted GL expense(120, cost_center_id)→variance +20% over→center
  rollup 120→approve snapshot+lock→KPI dashboard→budget_overrun alert.
- **Phase 26.9 — Enterprise ERP Final Completion** (audit-first; report:
  `docs/governance/phase26.9-final-completion-report.md`, audit:
  `phase26.9-erp-final-completion-audit.md`). Most of the 12-task pack already
  existed (26.1–26.8) and was reused/verified — only gaps built. **Accounting
  Core** (`erp/accountingCore.ts` pure + `accountingData.ts`): 4-level chart-of-
  accounts hierarchy (`gl_accounts.parent_id` surfaced, cycle-guarded), fiscal-
  period lifecycle open→closed→locked (`gl_fiscal_periods` kind/parent_id/
  stamps) with **posting enforcement** (journal post/void rejected in a closed/
  locked period via `assertPostable`), opening balance (posted `opening` entry,
  normal-side placement), year-end closing (revenue/expense → retained earnings
  3900, date-bounded + idempotent), account statement (per-account GL running
  balance). APIs `/finance/periods` + `/finance/statement`; Finance **Accounting**
  tab. **Tax profiles** (`tax_profiles` over the existing `computeTaxes` engine,
  Iran seeds) + `/finance/tax` + Currency-tab card; **debit_note** sales doc
  type. **Price lists** (`price_lists`/`price_list_items` + `sales_document_lines.
  product_id`) + `/sales/pricelists` + modal picker + Customers-tab manager;
  **sales return** op (invoice→credit-note, source untouched). **Audit trail
  completion**: `clientIp()` + old→new value wired into gl accounts / sales
  customers / journal post-void-delete / purchasing approve. Pure engines
  unit-tested (accountingCore 10, taxProfile 3); live-PG verified incl. full
  **sales cycle** (Customer→Quote→Order→Invoice→Payment→statement/ledger) and
  **purchase cycle** (Supplier→PR→approve→PO→GRN→receive→Invoice→Payment→GL).
  Honest boundaries: server-side PDF stays print-HTML→Save-as-PDF (no heavy dep);
  time-based escalation + arbitrary-SQL report builder intentionally not added.
- **Inventory Center** (`/admin/inventory`, `InventoryCenter`) — Phase-21 ERP
  Module 4 (Enterprise Inventory). Tabbed: Dashboard · Products · Warehouses ·
  Stock Moves. Tables `inv_warehouses`/`inv_locations`/`inv_products`/`inv_moves`
  (signed-qty move ledger; a transfer writes two rows sharing a ref). Valuation
  is a pure, unit-tested engine (`src/lib/erp/inventory.ts`): **FIFO/LIFO/
  weighted-average** cost from the move history, plus reorder status (out/below-
  safety/reorder/ok/overstock), suggested reorder qty and KPI rollup. Server data
  layer `src/lib/erp/inventoryData.ts` computes live on-hand/valuation once,
  shared by the products list and dashboard. APIs under `/api/admin/erp/inventory/*`
  (products/warehouses/moves/overview) — zod-validated, RBAC-gated, audited.
  Verified end-to-end against real PostgreSQL (FIFO/LIFO/WAVG round-trip).
  **Opening stock (Phase 26.10)**: the product-create form takes a warehouse +
  opening qty and writes a real `receipt` `inv_moves` row (`ref='Opening stock'`),
  so on-hand/valuation are correct immediately (no more spurious ناموجود); stocked
  products are selectable directly on a **sales invoice line** (`SalesCenter`
  inventory-product picker) in addition to the price-list picker.
- **Security Operations Center** (`/admin/soc`, `SocDashboard`) — Phase-17 SOC on
  **real** signal via `GET /api/admin/soc/overview`: aggregates failed logins,
  brute-force IPs (from `system_logs` security meta), AI prompt-injection blocks,
  permission-denied, rate-limit and security-error events + audit LOGINs into a
  24h threat posture. Risk level/score is pure, unit-tested (`src/lib/soc/risk.ts`).
  Distinct from `/admin/security` (2FA/sessions) and Logs & Monitoring (raw stream).
- **Workflow Designer** (`/admin/workflows`, `WorkflowManager`) — Phase-21 automation
  foundation. `workflows` + `workflow_runs` tables (definition graph JSON, versioned,
  status-gated, full run history). The execution engine `src/lib/workflow/engine.ts`
  is pure + unit-tested: `executeWorkflow(def, input, {handlers})` walks a node graph
  (`start·end·set·condition·log·task·delay·approval`), deterministic, loop-safe (step
  budget), pauses at `approval` (→ `waiting`), side effects only via injected
  `TaskHandler`s. `GET/POST/PUT/DELETE /api/admin/workflows` + `POST/GET
  /api/admin/workflows/run`: zod-validated, RBAC-gated, audit-logged; definition is
  engine-validated before persist; external task actions (email/webhook/http) are
  recorded as intents, not executed, until wired. **Visual designer** (Phase-21.6,
  `WorkflowCanvas`): an n8n-style canvas in the workflow editor — a node palette,
  draggable node cards (pointer-drag persists `x`/`y`, ignored by execution), SVG
  edges with true/false branch labels, and a property panel for editing node
  fields + connections. Pure geometry helpers `src/lib/workflow/layout.ts`
  (`graphEdges`, `autoLayout` BFS-ranked; 5 unit tests). Reads/writes the exact
  definition JSON the engine runs (Canvas/JSON toggle). The Rules Engine (21.7)
  and Integration Hub (21.8) were subsequently built and compose via the
  engine's handler seam (no duplicated logic) — see their bullets below.
- **Approval Center** (`/admin/approvals`, `ApprovalCenter`) — Phase 26.12,
  centralized approval orchestration over the workflow system (report:
  `docs/governance/phase26.12-approval-workflow-intelligence-report.md`, audit:
  `phase26.12-approval-workflow-audit.md`). **NOT a second graph executor** — a
  matrix-driven approval store alongside the graph engine; routing conditions
  reuse the Business Rules `evalCondition`; RBAC reuses `canDo`+`finance_role`;
  audit/notifications/AI reuse `logAction`/`notifications`/`runCompletion`. Pure
  engines (unit-tested): `approval/matrix.ts` (amount-tiered + condition-routed
  matrix over 15 doc types → ordered levels; generalises purchasing's
  `ApprovalTier`), `approval/engine.ts` (`approvalState` multi-level + parallel
  all/any/min completion + any-rejection-stops; delegation `canActFor`/
  `effectiveApprovers`), `approval/escalation.ts` (SLA 24h reminder/48h manager/
  72h CEO, idempotent), `approval/analytics.ts` (avg time/bottlenecks/rejection
  rate/SLA/dept). Data layer `erp/approvalData.ts` (matrix CRUD, request creation
  snapshots the resolved plan, act with RBAC+delegation+IP audit, bulk approve,
  comments, escalation scan, notification log, inbox, analytics; `advanceDocument`
  advances the source ERP doc on full approval). APIs `/api/admin/erp/approvals`
  (inbox/decide/bulk/comment/escalate) + `/approvals/{matrix,delegations,ai}`
  (matrix administrator-gated; AI is **advisory only, never decides**). Workflow
  engine gained additive node types **parallel/notification/ai_decision** (graph
  executor unchanged). Tables `approval_matrix`, `approval_requests`,
  `approval_actions`, `approval_delegations`, `workflow_escalations`,
  `workflow_comments`, `workflow_notifications` (idempotent+indexed;
  `deploy/postgres/rollback-phase26.12.sql`). UI: inbox (pending/approved/
  rejected/delegated/expired + approve/reject/request-change/comment/bulk + AI
  brief) + matrix + delegations + analytics, amounts via the display-currency
  engine. Verified vs real PostgreSQL: 2B purchase → 3 levels → approve L1/L2/L3
  → doc advances to approved → rejection stops → 73h-stale → escalation stages
  1,2,3 + SLA breach (idempotent) → analytics.
- **Business Rules Engine** (`/admin/rules`, `RulesCenter`) — Phase-21.7. Pure
  engine `src/lib/rules/engine.ts` (`evalCondition` with eq/ne/gt/gte/lt/lte/in/
  nin/contains/between/truthy/falsy + dotted paths, `ruleMatches` all/any,
  `runRules` priority first-match or collect-merge with a trace, `validateRuleSet`;
  7 unit tests). Versioned decision tables: `business_rules` (head + active
  version + status) × `business_rule_versions` (immutable history for rollback).
  APIs `/api/admin/erp/rules` (CRUD/newVersion/setActive-rollback/activate/
  archive) + `/rules/simulate` (test facts → matches+outputs+trace) — RBAC/zod/
  audit. **Workflow integration**: the run route's `rule` task handler
  (`runRuleByKey`, `src/lib/rules/ruleData.ts`) evaluates a rule's active version
  against the workflow variables and merges its outputs back — so a `task` node
  `{action:'rule', config:{ruleKey}}` lets workflows branch on rule results.
  Verified: a workflow rule-task drives a downstream condition (gold→20% →big
  branch; bulk→10% →small branch). **Visual builder (Phase 26.10)**: pure
  `src/lib/rules/builder.ts` (`parseDef`/`serializeDef`/`coerce`/`RULE_OPS_UI`,
  round-trip tested) drives a `RuleBuilder` (Visual/JSON toggle) in `RulesCenter`
  — condition rows (field·operator·value across 12 ops) + output rows + match
  all/any + first/collect, emitting the exact **engine-valid JSON** `runRules`
  runs; exotic JSON falls back to the raw textarea. Replaces the raw-JSON editors.
- **Integration Hub** (`/admin/integration-hub`, `IntegrationHub`) — Phase-21.8
  (distinct from `/admin/integrations`, the CMS integrations catalog). Connectors
  to external systems: REST/GraphQL/Webhook (native fetch) + SMTP (nodemailer) are
  **executed**; Kafka/RabbitMQ/SFTP are recorded as **queued intents** (no broker
  wired — honest, not faked). Pure engine `src/lib/integration/engine.ts`
  (`isExecutable`, `buildRequest`, `redactConfig` secret-masking, `backoffDelays`,
  `validateConnector`; 7 unit tests). Dispatcher `src/lib/integration/dispatch.ts`
  performs the call with retry + dead-letter, logging every attempt to
  `integration_dispatches` (status success/failed/queued/dead; DLQ = dead+
  unresolved). APIs `/api/admin/erp/integrations` (CRUD, config redacted) +
  `/integrations/dispatch` (dispatch/test, DLQ list, re-dispatch, metrics).
  **Workflow seam**: the run route's `integration` task handler (`dispatchByKey`)
  sends the workflow variables through a connector — closing workflows → rules →
  integrations. Verified vs real PostgreSQL (HTTP success, retry→dead, queued
  intent, logging).
- **AI Platform** (Phase-22) — the shared intelligent core. **Shared engine**
  `src/lib/ai/engine.ts` (`runCompletion({messages, systemPrompt, useRag})`)
  centralizes provider dispatch (ChatGPT/Claude/Gemini/Grok/Copilot/Conduit),
  settings load, RAG over `ai_knowledge_base`, and circuit-breaker+retry — the
  ONE execution path shared by the public chat (`/api/ai/chat`, refactored onto
  it) and every admin AI feature. **AI Agents** (`/admin/ai-agents`,
  `AiAgentsManager`): a pure, unit-tested registry (`src/lib/ai/agents.ts`) of 10
  role-scoped bilingual personas (content/seo/sales/crm/erp/security/infra/backup/
  marketing/hr) each with an anti-fabrication guardrail; `GET/POST /api/admin/ai/
  agents` (RBAC `edit`, zod, audited) runs an agent through the shared engine
  (RAG per agent). Public AI page (`/[locale]/ai`) now linked in `NAV_ITEMS`.
  **Roadmap closed**: embeddings + vector search (`src/lib/ai/embeddings.ts`,
  `ai_knowledge_base.embedding`, blended keyword+cosine retrieval w/ keyword
  fallback, verified vs real PG) and AI Automation (workflow `agent` task
  handler → shared `runCompletion`, reply in `ctx.variables.aiReply`). Chat
  Center UX extras (folders/compare/voice) remain optional product enhancements
  (`docs/governance/phase22-ai-platform.md`).
- **AI Analytics** (`/admin/ai-analytics`, `AiAnalyticsDashboard`) — real
  telemetry: the shared engine records every completion into `ai_usage`
  (provider/model/source/latency/success/real token counts/rag/feedback,
  best-effort). Pure `summarize` (`src/lib/ai/analytics.ts`, unit-tested) →
  `GET /api/admin/ai/analytics` (calls, success rate, avg/p95 latency, tokens,
  est. cost via `ai_cost_per_1k`, RAG-hit, thumbs, daily + by-provider/model/
  source, recent failures). Thumbs feedback `POST` wired into the agent UI.
- **Prompt Center** (`/admin/ai-prompts`, `PromptCenter`) — versioned prompts:
  `ai_prompts` (head + active version + status draft/approved/archived) ×
  `ai_prompt_versions` (immutable history). Pure helpers `src/lib/ai/prompts.ts`
  (`extractVariables`/`renderPrompt`/`missingVariables`/`isUsable`, unit-tested)
  for `{{var}}` templating + preview. `GET/POST/PUT/DELETE /api/admin/ai/prompts`
  (create/newVersion/setActive-rollback/approve/archive/meta) — RBAC+zod+audit.
- **AI Agents v2** — data-backed agents (crm/erp/security/backup/infrastructure)
  ground answers in a live read-only module snapshot injected server-side
  (`src/lib/ai/agentTools.ts`, the workflow handler-seam applied to agents; the
  LLM never touches the DB). Grounded agents show a "Live data" badge.
- **Feature Flag Center** (`/admin/flags`, `FlagsManager`) — Phase-18 SaaS building
  block. `feature_flags` table (key/enabled/rollout_percent). Evaluation
  `src/lib/flags/evaluate.ts` is pure + unit-tested: `isEnabled(flag, subject)`
  with **deterministic, monotonic** percentage rollout (stable sha1 bucket).
  `GET/POST/PUT/DELETE /api/admin/flags`: zod-validated, RBAC-gated, audit-logged;
  GET previews each flag's evaluation for the current admin.

## Admin navigation (Phase 22 — Enterprise Workspace Platform)
- The admin is organized into **12 workspaces** (Executive/Brand/Content/CRM/ERP/
  AI/Security/Operations/Backup/Analytics/Documentation/System) defined in
  `src/lib/admin/workspaces.ts` — the single source of truth for admin nav. Each
  workspace owns its own bilingual sidebar (groups → items). Pure helpers
  `workspaceForPath` (active workspace by longest-href match) / `workspaceById` /
  `workspaceHome` / `allNavItems` (unit-tested). **Every href must be a real admin
  page** — `audit:links` fails on broken internal links. Add a module here and it
  shows up in the sidebar, workspace switcher, `/admin/home` selector grid, and
  command palette automatically (no separate lists to maintain).
- `AdminSidebar` renders only the active workspace's groups + a workspace switcher
  dropdown. `/admin/home` (`WorkspaceHome`) is the enterprise workspace selector.
- `CommandPalette` (Ctrl+K, mounted by `AdminShell`) derives its commands from the
  workspace registry (switch-workspace + every module) and adds a live **Records**
  group from the Module 13 search API (`/api/admin/search`) when typing ≥2 chars.
  Keyboard-first. Full report: `docs/governance/phase22-workspace-platform.md`.
- **Dashboard Platform** (Phase 22.2) — a per-workspace **Dashboard Engine** at
  `/admin/dashboards/[workspace]` (`DashboardEngine`). Pure **widget registry**
  `src/lib/admin/widgets.ts` (metadata + `defaultLayout`/`sanitizeLayout`; unit-
  tested) drives everything; server resolver `src/lib/admin/widgetData.ts`
  (`resolveWidgets`) maps each widget to **real** data from existing services
  (`executiveOverview`/`opsSnapshot`/`backups`), computing shared snapshots once
  per request. APIs `/api/admin/dashboards` (layout GET/PUT/DELETE, per
  user×workspace via `dashboard_layouts`) + `/dashboards/data?ids=` (batched,
  RBAC-filtered → `denied` payload). UI: 4-col grid with add/remove/resize/drag-
  reorder, Customize edit mode, Save/Reset, lazy recharts, loading/empty/error/
  denied states. 15 widgets (KPI/chart/table/list/ops). Verified vs real
  PostgreSQL. Report: `docs/governance/phase22-dashboard-platform.md`.
  **Patch (enterprise hardening):** role-based layouts via `dashboard_role_layouts`
  (role×workspace) with pure `pickLayout` resolution **User → Role → Workspace
  default** (GET returns `source`; role save needs `manage_users`; reset falls
  back to role). Widget `config` (`refreshInterval`/`warn`/`critical`) sanitised +
  persisted in the layout JSON; per-widget auto-refresh polling (SSE-ready seam).
  `resolveWidgets` gained a per-widget in-memory TTL cache (`widgetTtl`: ops 30s /
  others 5min; `?fresh=1` bypasses). Layout import/export (JSON) + audit logging
  (`dashboard.layout.save`/`role_layout.save`/`layout.reset`).
  **Completion:** `users.department` column (assignable in the Users form) +
  `dashboard_dept_layouts` make `pickLayout` a 4-tier chain **User → Department →
  Role → Default** (`scope=department` save needs `manage_users`). **Templates**
  (`dashboard_templates` + `/api/admin/dashboards/templates`) — save/apply/clone/
  delete via the engine's Templates menu. **Sharing** (`dashboard_shares`, target
  user/role/department × view/edit/manage, self-contained layout snapshot +
  `/api/admin/dashboards/shares`) — Share action + "Shared with you" strip.
  Report: `docs/governance/phase22-dashboard-platform-patch.md`.
- **Navigation Platform** (Phase 22.3) — RBAC-aware sidebar + breadcrumb + search
  + favorites/recent + quick actions, all driven by the workspace registry. Pure
  helpers in `src/lib/admin/workspaces.ts`: `roleCan` (client-safe RBAC mirror of
  `canDo`) / `visibleWorkspaces` / `visibleGroups` (hide unauthorized nav),
  `quickActionsFor`, `breadcrumbFor`/`findItem`. `NavPrefsProvider`
  (`src/lib/admin/navPrefs.tsx`) loads per-user favorites + recents and records a
  visit on each admin route change; persisted in `nav_prefs` via
  `/api/admin/nav-prefs` (toggleFavorite/visit/clearRecents, hrefs server-
  validated to `/admin/...`). `AdminSidebar` renders Dashboard + Favorites (★
  pins) + Quick Actions + RBAC groups + Recent, with an in-sidebar search filter;
  `Breadcrumb` shows Workspaces › Workspace › Module. Skip-to-content link +
  `aria-current`/`aria-label`s for WCAG. **Completion:** live **notification
  badges** (`/api/admin/nav-badges` — real pending counts: new contacts/
  consultations/leads, failed backups, integration DLQ; polled 60s) rendered on
  nav items; **persisted collapsed groups** per user (`nav_prefs.ui.collapsedGroups`
  via `toggleGroup`); **role default favorites** (`roleDefaultFavorites`, seeded on
  first load); **keyboard ↑/↓** roving focus in the sidebar. **Final closure:**
  advanced workspace switcher (in-dropdown search + Favorites/Recent/All sections,
  per-user `favWorkspaces`/`recentWorkspaces` in `nav_prefs.ui`, keyboard ↑/↓/
  Enter/Esc) + full sidebar tree keyboard nav (↑/↓ rove links + group headers,
  ←/→ collapse/expand focused group RTL-aware, `data-group`/`aria-expanded`).
  Report: `docs/governance/phase22-navigation-platform.md`.
- **Search & Command Platform** (Phase 22.4) — a keyboard-first command palette
  (Ctrl+K, `CommandPalette`) that fuses executable commands + workspace switches +
  RBAC-filtered nav + live records + favorites + recent items + recent searches
  into one ranked list. Executable **Command Registry** `src/lib/admin/commands.ts`
  (pure, tested) — `execute` commands POST **real** endpoints only (Run Backup →
  `/api/admin/backup/run`, Sync AI KB → `/api/admin/ai-kb/sync`, both
  `manage_settings`-gated, confirm + inline status); `visibleCommands(role,query)`
  RBAC/query-filters. Recent searches persist in `nav_prefs.searches` via
  `/api/admin/nav-prefs` (`search`/`clearSearches`; ≥2 chars, deduped, recorded
  after a successful search). Palette is `role=dialog`/`listbox`, hides
  unauthorized modules via `visibleWorkspaces`/`visibleGroups`. **Completion:**
  typo-tolerant **fuzzy ranking** (`engine.ts` `editDistance`/`fuzzyTermScore` —
  bounded Levenshtein + subsequence fallback, small weights so exact/substring
  still win); **popular searches** cross-user aggregate (`search_stats` table,
  atomic increment per search → 🔥 group); **executed-command history**
  (`nav_prefs.commands`, capped 8, RBAC-filtered Recent-commands group); and
  **entity-scoped quick actions** (pure `entityActions(module,url)` → Open / Copy
  link / View-all chips under a selected record). Report:
  `docs/governance/phase22-search-command-platform.md`.
- **Design System** (Phase 22.5) — the unified design-language reference +
  the platform's Enterprise DataTable. Pure table engine
  `src/lib/admin/dataTable.ts` (`sortRows`/`filterRows`/`paginate`/`nextSort`;
  6 unit tests) + `src/components/admin/DataTable.tsx` (one reusable accessible
  table: click-to-sort `aria-sort` headers, global filter, density toggle,
  column-visibility menu, pagination, loading/empty states, RTL/bilingual).
  Reference page `/admin/design-system` (`DesignSystem`, System workspace):
  color tokens · typography scale · buttons · badges · form controls · states ·
  a live DataTable. Tokens stay gate-enforced (`audit:tokens` = 0 arbitrary
  colors). Report: `docs/governance/phase22-design-system.md`.
- **Enterprise DataTable Platform** (Phase 22.6) — **the** single reusable table
  powering every admin module (Dynamics/Fiori/Lightning/ServiceNow-class). Pure
  engine `src/lib/admin/dataTable.ts` (columns metadata + multi-sort
  (`nextMultiSort`/`multiSortRows`) + per-column filters (text/number/date/
  boolean/enum/tag, `applyColumnFilters`) + grouping/aggregation (`groupRows`) +
  selection (`toggleSelect`/`rangeSelect`/`invertSelection`/`selectionState`) +
  view resolution (`applyColumnView`)) and `src/lib/admin/dataTableExport.ts`
  (CSV RFC-4180 / Excel SpreadsheetML / JSON export + `importCsv` parse-validate-
  dedupe) — both fully unit-tested. `src/components/admin/DataTable.tsx` is the
  one shell: toolbar (search/filters/column-picker+pin/density/group-by/export/
  saved-views/refresh/quick-create), selection column (shift-range + tri-state),
  multi-sort headers, column resize/reorder/pin with **per-user persistence** by
  `tableId`, per-column filter row, grouping, virtualization, row + bulk actions,
  all states (loading/empty/no-results/error+retry), RBAC (`can`), WCAG/ARIA, RTL.
  Persistence: `table_prefs` (per-user column layout) + `table_views` (named,
  RBAC-shared private/role/department/global; pure visibility `tableViews.ts`)
  via `/api/admin/table-prefs` + `/api/admin/table-views` (zod/RBAC/audited).
  **Every** hand-rolled module table (raw `<table>` and the `Table`/`TR`/`TD`
  primitive) was migrated — CMS/CRM/ERP/AI/Security/Ops/Analytics/Backup/Users/
  Reports/Numbering/etc. — no duplicate module table implementations remain. Only
  the `ui.tsx` `Table` primitive (now unused), financial-statement layouts, the
  Dashboard-Platform widget, and the live SSE log console are intentionally kept.
  Verified live vs real PostgreSQL (prefs + shared views round-trip). Report:
  `docs/governance/phase22-datatable-platform.md`.
- **Enterprise Hero Platform** (Phase 23, `/admin/hero`, `HeroCenter`) — the
  public landing experience is now a versioned, template-driven, per-language
  configurable Hero platform. Pure engines in `src/lib/hero/`: `types.ts`,
  `templates.ts` (30 templates — 20 legacy `Hero.tsx` variants + 10 premium:
  executive/tech-enterprise/ai-platform/cyber-security/cloud-infra/consulting/
  portfolio-minimal/video-fullscreen/split-screen/product-showcase — each with
  blocks/constraints/backgrounds), `rules.ts` (`validateHero` title/subtitle/font/
  CTA bounds + WCAG contrast + overflow/a11y heuristics; `canPublish` gate),
  `experiment.ts` (deterministic `pickVariant`/`experimentResult`), `personalize.ts`
  (`resolveHero` by device/locale/country/returning/loggedIn/campaign/referral/
  schedule), `analytics.ts` (`summarizeHeroEvents`); 16 unit tests. Tables
  `heroes`/`hero_versions`/`hero_experiments`/`hero_rules`/`hero_events`. APIs
  `/api/admin/heroes` (lifecycle draft→review→approved→published→archived +
  duplicate/rollback/bulk, publish gated by `canPublish`, one published per target
  path), `/heroes/experiments` (A/B live results + promote), `/heroes/analytics`,
  public `/api/hero/track` (rate-limited beacon). Admin: `HeroCenter` (Dashboard·
  Heroes·Templates·A/B·Analytics, all on the Enterprise DataTable) + `HeroBuilder`
  (per-language content, style system, real-time validation panel blocking
  publish, multi-breakpoint/theme/RTL live preview, version rollback). Public:
  `resolveActiveHero` (A/B → personalization → published default) →
  `HeroExperience` (config-driven category layout + backgrounds, reduced-motion,
  emits view/click/conversion/scroll/time). Falls back to legacy `Hero.tsx` when no
  hero is published (zero regression). Verified vs real PostgreSQL. Report:
  `docs/governance/phase23-hero-platform.md`.
- **Hero Animation Engine** (Phase 25, `src/lib/hero/animations.ts`) — extends the
  Hero Platform (no rewrite; legacy `Hero.tsx` + its 196 framer-motion animations
  stay the public fallback, untouched). Pure, unit-tested registry of **75 presets**
  (+`none`) across entrance/emphasis/text/background/scroll/interactive/**orbit**;
  `resolveAnimation(a,{reduceMotion,lowEnd})` → `{className,style}` with `--hx-*`
  custom props, auto-suppressing heavy/looping under reduced-motion / low-end;
  `animationConflicts` feeds the rule engine. CSS `hx-*` keyframes/classes in
  `globals.css` (reduced-motion guarded; JS-only presets fall back to fade). The
  **`orbit` category** (Phase 26.10) adds 20 network/constellation loops
  (orbit-spin/radar-sweep/satellite/aurora/sonar/galaxy-spin/vortex …); the
  `HeroBuilder` Animations picker shows a **looping live-preview tile** so every
  preset previews on selection.
  `HeroConfig.animations` (per-element, optional → backward compatible) is applied
  by `HeroExperience` (public) and assigned in `HeroBuilder`'s Animations section
  (per-element preset + duration/delay/easing + live preview). Templates: 20
  legacy = **Classic** library + **30 premium** (10 Phase-23 + 20 new verticals)
  = **50 total**; Hero Center Templates tab has a Classic/Premium/All switch.
  Verified vs real PostgreSQL (hero with animations round-trips). Report:
  `docs/governance/phase25-hero-animation-engine.md`.
- **Hero Intelligence** (Phase 25.1) — AI + scoring layer on the Hero Platform,
  reusing the existing AI Platform (no second AI system). **AI Content Assistant**:
  pure prompt builder `src/lib/hero/aiAssist.ts` (14 actions × 7 tones × en/fa) +
  `POST /api/admin/heroes/ai` dispatching through `runCompletion` (provider mgr +
  telemetry + audit), returning **editable** suggestions; wired into HeroBuilder's
  Content card (Headline/Subtitle/Improve/SEO/Meta). **Smart recommendation**
  `src/lib/hero/recommend.ts` (`recommendAnimations` category→recipe, auto-lightens
  under reduced-motion/mobile) — API + one-click builder button. **Performance +
  A11y engines** `src/lib/hero/performance.ts` (`animationPerformance` → score/
  weight/estFps/warnings; `accessibilityReport` → WCAG score/issues) surfaced as a
  live **Insights** card in the builder (real-time warnings). All engines pure +
  unit-tested. Report: `docs/governance/phase25.1-hero-ai-intelligence.md`.
- **Hero Animation Library CMS** (Phase 25.2) — PostgreSQL-native managed library
  on top of the 53 built-in presets. Tables `hero_animation_presets` (custom
  presets: config JSON/tags/collection/enabled/archived/favorite/usage_count/
  version) + `hero_animation_versions` (rollback) + `hero_collections`. Pure
  engine `src/lib/hero/animationLibrary.ts` — `buildPackage`/`verifyPackage`
  (SHA-256 checksum over canonical JSON + HMAC-SHA256 signature → tamper
  detection), `validateDependencies` (rejects unknown built-in preset/template
  refs), `planImport` (new/conflict/invalid), `animationAnalytics`; unit-tested.
  API `GET/POST /api/admin/heroes/animations` (list/search/`?view=analytics|export`
  signed package; create/update+version/toggle/rollback/bulk/import — import+delete
  need administrator, RBAC+zod+audit). Admin: Hero Center **Animation Library** tab
  (Enterprise DataTable, favorite/enable/archive, bulk, export signed pkg / import
  verified pkg). Verified vs real PostgreSQL (version rollback + sign/verify/import
  round-trip). **Timeline Studio** (completion): pure keyframe engine
  `src/lib/hero/timeline.ts` (tracks opacity/scale/rotate/x/y, per-segment
  cubic-bezier solver, scrubber sampler, WAAPI compiler, snap/validation; 11
  tests) + `TimelineStudio.tsx` (multi-track visual editor: drag keyframes,
  scrubber+playhead, WAAPI playback, undo/redo, bezier inspector, copy/paste,
  zoom/snap) persisting into `config.timeline` via the versioned API — opened
  from a row action in the Animation Library. Report:
  `docs/governance/phase25.2-hero-animation-library.md`.

## Auth
- Login `POST /api/admin/auth/login` → bcrypt check (+ optional TOTP) → HS256 JWT
  (jose, 8h) in an httpOnly cookie `admin_token`; a DB session row is created.
- `getAdminUser()` re-verifies JWT + live DB session + active user.
- Roles: `super_admin | administrator | editor` (`canDo(role, action)`).
- Seeded admin: **`admin@habibazar.com` / `HBZ@Admin2025!`** (change after first login).

## Testing & validation (run in `outputs/habibazar-web`)
- `npm run type-check` · `npm run lint` · `npm run test` (vitest) ·
  `npm run build` · `npm audit` · `npm run test:e2e` (playwright).
- E2E seeds/logs in via the seeded admin above (see `e2e/helpers.ts`).
- Target: zero TS errors, zero lint warnings, 0 vulnerabilities, all tests green.

## Governance audits (`npm run audit` runs all seven; docs in `docs/governance/`)
- `audit:tokens` — design tokens: fails on arbitrary Tailwind color classes
  (drift). Source of truth: `tailwind.config.ts` + `src/lib/design/tokens.ts`
  (`BRAND`, `CHART_PALETTE`, `SOCIAL_BRAND`) for values that can't be a class.
- `audit:content` — CMS content: fails on Lorem/placeholder filler; reports
  `/uploads/` media coverage.
- `audit:reuse` — component reusability (informational): tracks raw admin-fetch
  duplication. Shared primitive: `src/lib/admin/crud.ts` (`crud.*` + `useResource`).
- `audit:deps` — dependency/bundle: fails on unused runtime deps, build tools in
  `dependencies`, or `@types/*` in runtime. Heavy recharts is code-split via
  `next/dynamic` (`src/app/admin/ViewsChart.tsx`) — `/admin` First Load 136 kB.
- `audit:links` — link & media integrity: enumerates real public routes from the
  App Router and **fails on broken internal links** (a nav/CTA pointing at a
  non-existent page); warns on `/uploads/` media missing from `public/`.
- `audit:i18n` — translation-key integrity: **fails on any admin `t('key')` that is
  missing from `src/lib/admin/locale.tsx` or has an empty fa/en**. Scoped to files
  importing `@/lib/admin/locale` (public marketing uses next-intl `messages/*.json`
  — a separate system, not audited here). Orphan keys reported informationally.
- `audit:ui` — UI Consistency Engine (Phase 24): governs the **type scale** —
  **fails on any arbitrary Tailwind font-size** (`text-[13px]`, `text-[0.9rem]`,
  …) instead of a named scale token (`text-4xs`…`text-9xl`/`text-display` in
  `tailwind.config.ts`; budget 0). Arbitrary interactive control heights reported
  informationally. Micro sizes are on-scale via `4xs` (9px)/`3xs` (10px)/`2xs`
  (11px). Complements `audit:tokens` (colour). Report:
  `docs/governance/phase24-quality-platform.md`.
- `tokens`, `content`, `deps`, `links`, `i18n` and `ui` audits gate CI (in the ESLint job).

## CI (`.github/workflows/ci.yml`)
Jobs: TypeScript, ESLint, Unit Tests, Build, Security Audit
(`npm audit --audit-level=critical --omit=dev` + secret grep), E2E, Lighthouse
(non-blocking). Build uploads `.next` as an artifact; E2E/Lighthouse download it,
start the app, `wait-on /api/health`, then run.
- The build artifact upload uses `include-hidden-files: true` (`.next` is a dotfile).

## Deploy
- App runs under **PM2** as user **`hbz`** on port **3000**, behind **nginx**.
- Installed at `/var/www/habibazar`; scripts run from `/var/www/Website/deploy`.
- **PM2 logs live in `/home/hbz/logs`** (the `hbz` user cannot write to `/var/log`).
- The DB **auto-initializes on startup** via `instrumentation.ts` — no manual step.
- Scripts:
  - `install.sh` — fresh install (deps, Node, PM2, clone, `.env.local`, build,
    nginx, firewall). `npm ci` → build → `npm prune --omit=dev`.
  - `update.sh` — pull + rebuild + zero-downtime `pm2 reload` (with `.next`
    rollback on build failure).
  - `fix-pm2.sh` — regenerate `start.sh` + `pm2.config.js` and clean-restart PM2
    (use this to migrate an existing server to the `/home/hbz/logs` config).
  - `uninstall.sh` — full removal (PM2, nginx, app dir, logs, user) with a safety
    DB backup + typed `DELETE` confirmation.
  - `backup.sh [bucket]` — automated encrypted backup: consistent SQLite snapshot
    (+`integrity_check`) + media + config → tar.gz → **AES-256** (openssl pbkdf2)
    → sha256 → verify (decrypt+list) → retention purge → `last-status.json`.
    Buckets: hourly(48h)/daily(30d)/weekly(12w)/monthly(24m)/yearly(10y). Optional
    offsite via `BACKUP_REMOTE` (rclone/rsync). Key at `/home/hbz/.backup-key`.
  - `restore.sh <file.enc> [--test|--db-only|--with-config|--yes]` — verify sha256
    → decrypt → `integrity_check` → restore (snapshots current DB first). `--test`
    is an isolated recovery test that never touches the live system.
  - **No cron.** Automated backups are now driven by the in-app, event-driven
    `BackupEngine` (see above), started with the Node process — there is no
    `backup-cron.sh` and no `/etc/cron.d/habibazar-backup`. `install.sh`/`update.sh`
    remove any legacy cron file and ensure `BACKUP_ENCRYPTION_KEY` in `.env.local`.
    The `backup.sh`/`restore.sh` shell scripts remain as optional manual CLI DR
    tools; monitor the engine at `/admin/logs-monitoring` + `/api/admin/backup/engine`.
- First-time/after-config-change: `git pull && sudo bash deploy/update.sh &&
  sudo bash deploy/fix-pm2.sh`. Routine updates: `git pull && sudo bash deploy/update.sh`.
- **PostgreSQL (`deploy/postgres/`).** The runtime is **fully PostgreSQL** (Phase 20
  cutover complete; `audit:pgcompat` = 0). Provision/migrate/verify scripts for
  Debian/Ubuntu: `install-postgresql.sh` (PG17 + extensions, writes `DATABASE_URL`),
  `bootstrap-postgresql.sh` (Drizzle migrate + seed), `sqlite-to-postgresql.sh`
  (legacy SQLite backup → data migrate → validate), `verify-postgresql.sh`,
  `restore-postgresql.sh` (`pg_dump`/`pg_restore`), `rollback-to-sqlite.sh`
  (fallback snapshot). Data-migration engine: `scripts/migrate-to-postgres.mjs`
  (`npm run db:migrate:pg`) — introspect SQLite → load into the Drizzle schema
  (boolean/NUL coercion) → sequence sync → row-count + FK validation → JSON report.
  `pg`/`@types/pg` are runtime deps; `better-sqlite3`/`drizzle-kit` are devDeps
  (migration + schema-gen tooling). See `deploy/postgres/README.md` +
  `docs/governance/phase20-postgres-migration.md`.

## Gotchas learned
- Parallel Next build workers each run seed → use `INSERT OR IGNORE` (fixed).
- `next build` needs devDeps (eslint, @types) — install full, prune after build.
- `upload-artifact@v4` excludes hidden files by default → `.next` needs
  `include-hidden-files: true`.
- Health check probes the DB (`SELECT 1`); returns 503 if the DB is missing —
  so the DB must be initialized before/at startup (handled by instrumentation).
- Hook returns used as effect deps must be stable: `useToast()`'s `toast` is
  `useCallback`-memoized. An unstable `toast` in `useEffect(…, [toast])` re-ran
  load effects every render, refetching in a loop and wiping form input.
