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
  (image upload/crop), **zod** (validation lib present but not yet wired into API
  routes), **nodemailer** (SMTP, dynamic import), **qrcode**.
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
  (Known hardening backlog: no zod input validation yet; raw `e.message` returned
  on 500; RBAC granularity not enforced per-route.)
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
  Table + group-by Summary views, CSV export. Purchasing report deferred until
  its module ships. Verified vs real PostgreSQL (all 7 reports aggregate correctly).
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
  definition JSON the engine runs (Canvas/JSON toggle). Rules Engine + Integration
  Hub remain the documented roadmap
  (`docs/governance/phase21-automation-platform.md`) — they compose via the
  engine's handler seam (no duplicated logic).
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
  branch; bulk→10% →small branch).
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
  Chat Center upgrades, Automation and embeddings are the documented roadmap
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

## Governance audits (`npm run audit` runs all six; docs in `docs/governance/`)
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
- `tokens`, `content`, `deps`, `links` and `i18n` audits gate CI (in the ESLint job).

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
