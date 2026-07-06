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
- **Asset Center** (`/admin/assets`, `AssetManager`) — Phase-16 ERP foundation.
  `assets` table (IT asset lifecycle: type/serial/vendor/status/location/
  assignment/warranty). `GET/POST/PUT/DELETE /api/admin/erp/assets`: zod-validated,
  RBAC-gated, audit-logged. Warranty state (ok/expiring/expired) + portfolio stats
  are pure, unit-tested (`src/lib/erp/assets.ts`); GET returns assets + warranty
  health + rollup KPIs.
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
  recorded as intents, not executed, until wired. Rules Engine + Integration Hub are
  the documented roadmap (`docs/governance/phase21-automation-platform.md`) — they
  compose via the engine's handler seam (no duplicated logic).
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
