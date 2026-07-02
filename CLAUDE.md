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
and a full admin CMS. Data lives in a local SQLite file — no external DB/service.

- Repo layout: the app is at **`outputs/habibazar-web/`** (run all npm commands there).
- On the server the repo is cloned to `/var/www/Website`; the app is installed/run
  from `/var/www/habibazar`.
- Default working branch: **`feature/v2-enterprise-upgrade`**.

## Tech stack
- **Next.js 15** (App Router, React 19), **TypeScript** (strict; no `any`).
- **better-sqlite3** + **drizzle-orm** (SQLite, synchronous driver).
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
- Images from the CMS use plain `<img>` (dynamic/uploaded) — `no-img-element`
  is intentionally disabled project-wide in `.eslintrc.json`.
- Fonts via `next/font/google` (Inter, JetBrains_Mono, Vazirmatn→`--font-persian`).
- Uploads are saved under `public/uploads/` (via `POST /api/admin/media`) and
  served at `/uploads/` by `src/app/uploads/[...path]/route.ts` — a Next route,
  **not** an nginx alias, so freshly uploaded files always work under `next start`.
- Admin **Backup** (`/admin/backup`) is a real feature: `POST /api/admin/backup`
  makes a WAL-safe SQLite `.backup()` into `data/backups/`; GET lists / downloads.
- Admin **System Logs** (`/admin/logs`) reads the app's PM2 stdout/stderr logs
  via `GET /api/admin/logs` from `PM2_LOG_DIR` (default `/home/hbz/logs`) —
  parses the logger's JSON lines and plain lines, filter by level / search.

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

## Governance audits (`npm run audit` runs all four; docs in `docs/governance/`)
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
- `tokens`, `content` and `deps` audits gate CI (in the ESLint job).

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
  - `backup-cron.sh` — generates the encryption key + installs `/etc/cron.d/
    habibazar-backup` (the schedule above + a weekly auto recovery-test). Run by
    `install.sh`. Admin monitors it at `/admin/backup` via `/api/admin/backup/system`.
- First-time/after-config-change: `git pull && sudo bash deploy/update.sh &&
  sudo bash deploy/fix-pm2.sh`. Routine updates: `git pull && sudo bash deploy/update.sh`.

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
