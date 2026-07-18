# Phase 26.26d / 26.M1 / INFRA-1 — infrastructure restructure (report)

One migration executed under three successive prompts (26.26d flatten →
26.M1 additions → INFRA-1 data/nginx layer); this is the single canonical report.

**Branch:** `claude/bold-lamport-a1d6tg` → PR to `feature/v2-enterprise-upgrade`.
Pure structural refactor — zero feature/content changes; the move commit is a
926-file `git mv` with **0 content diff**.

## بند ۰ — discovery

### 0.1 `/var/www/Website` vs `/var/www/habibazar` (resolved from live-server evidence)
The maintainer's own terminal session (2026-07-17) settled this:
- `/var/www/Website` is a **second, stale clone** (it was 9 commits ahead / 153
  behind before being hard-reset to origin during the reset-erp-data work). It has
  its own `.git` and was only used to run deploy scripts by hand.
- `/var/www/habibazar` is the **live clone PM2 serves**: it has its own `.git`,
  `node_modules`, and the running app under `outputs/habibazar-web/` (with
  `.env.local`, `.next`, `data/`). `pm2.config.js` cwd points inside it.
- Verdict: **migrate `/var/www/habibazar`**; retire `/var/www/Website` as a deploy
  source (guide step 0 tells the maintainer to confirm with `pm2 describe habibazar`
  and stop deploying from the second clone).

### 0.2 reference list — grep `outputs/habibazar-web` (pre-change)
15 real files (the prompt's list confirmed complete, `docs/OPERATIONS_GUIDE.md`
included; a 16th hit was an accidentally-committed `node_modules/.vite` cache file):
`deploy/{install,update,fix-pm2,backup,restore,uninstall}.sh` ·
`deploy/.env.example` · `deploy/postgres/{reset-and-rebuild.sh,README.md}` ·
`.github/workflows/ci.yml` · `README.md` · `CLAUDE.md` ·
`docs/{DEPLOYMENT,OPERATIONS,DISASTER_RECOVERY}_GUIDE.md`

### 0.3 baseline count
`git ls-files outputs/habibazar-web | wc -l` → **926**; repo total **957**
(926 app + 30 root deploy/docs/CI + 1 junk tracked cache file).

## بند ۱ — the move (R3/R4 proof)
- Every tracked file moved with **`git mv`** (R4); move committed separately from
  reference edits so history/renames stay reviewable.
- Merges: app `docs/` (PILOT_GO_LIVE.md, USER_GUIDE_FA.md, governance/) into root
  `docs/` — **no filename conflicts**; app `deploy/postgres/rollback-phase26.1[1-4].sql`
  into root `deploy/postgres/` — **no conflicts**. App `.gitignore`/`.env.example`/
  configs promoted to root (root had no `.gitignore` — which is how the
  `node_modules/.vite` cache got committed; now untracked).
- Untracked artifacts (`node_modules`, `.next`, `data/`, `test-results`) physically
  moved with plain `mv` (git doesn't track them); empty `outputs/` removed.
- **R3:** `git status` after the move showed exactly **926 renames (R)**; tracked
  total 957 → **956** (Δ = the deliberately-untracked junk cache file, not an app
  file); `git ls-files | grep -c outputs/` → **0**.

## بند ۲ — reference updates (15 files)
- **deploy scripts:** `WEB_DIR="$APP_DIR"` (single path; variable kept to minimize
  diff risk in 6 scripts). 🔴 `update.sh` silent bug fixed: the package-change
  detection diffed `-- outputs/habibazar-web/package*.json`, which after the flatten
  would never match → `npm ci` would silently stop running on dependency changes;
  now `-- package.json package-lock.json`.
- **install.sh** PM2 `cwd` now the repo root (via WEB_DIR); **backup/restore**
  `UPLOADS_DIR` follows; `.env.example`, `fix-pm2.sh`, `uninstall.sh`,
  `postgres/reset-and-rebuild.sh` + its README updated.
- **CI:** `defaults.run.working-directory` removed; `cache-dependency-path:
  package-lock.json` (5×); header comment updated. No artifact paths referenced the
  nesting (verified by reading the whole workflow).
- **Docs:** CLAUDE.md (repo-layout + testing sections + new ops-separation rule),
  README (architecture block + env instructions), DEPLOYMENT/OPERATIONS/DR guides.
- **2.4 final check:** `grep -rn 'outputs/habibazar-web'` over the tree
  (node_modules/.next excluded) → **ZERO hits**.

## بند ۳ — ops consolidation
- **3.1** one `deploy/` remains (app-side `deploy/postgres` merged in بند ۱).
- **3.2** new **`deploy/restart.sh`** — safe restart: validates `.env.local`/`.next`/
  `pm2.config.js`, rejects a stale config whose `cwd` ≠ `APP_DIR` (points to
  fix-pm2), then `pm2 delete` + `start` (never reload — reload keeps the old cwd/env)
  + 30s health-gate + status/last-error-log output.
- **3.3** new **`deploy/README.md`** — one-line what/when/prereq table for all 11
  scripts + postgres/*, and the codified separation rule: shell ops → `deploy/`
  (root on server), npm tsx tooling → `scripts/` (needs node_modules + `@/` alias,
  run from repo root).

## بند ۴ — gates (all from the repo root)
| Gate | Result |
|---|---|
| `npm ci` from repo root | ✔ clean |
| TypeScript | **0 errors** |
| ESLint | **0 warnings** |
| Unit tests | **771/771** (77 files) |
| Governance audits | **11/11 = 0** (incl. `audit:pgcompat` **0 hits** after residue removal) |
| `npm run build` | clean — **136 static pages** (exact pre-move count preserved) |
| Regression suites | **11/11 green** (`npm run regressions`, incl. 26.21 sim + 26.26b CFO 15/15) |
| E2E | **66 passed / 0 failed** in ONE clean `--workers=1` run |
| `bash -n` on every `deploy/*.sh` + `deploy/postgres/*.sh` | ✔ |
| CI on the side branch | queued on push — ci.yml fully root-relative (verified line-by-line) |

**E2E defect found & fixed during the gate run:** the portal spec failed at
`GET /api/portal/me` → 401 — the `portal_token` cookie is `Secure` in
production and Playwright's request context only retains Secure cookies on a
trustworthy origin: `http://localhost` qualifies, `http://127.0.0.1` does
NOT. `ci.yml`'s `PLAYWRIGHT_BASE_URL` used 127.0.0.1 → switched to
`http://localhost:3000` (environment fix; no product code or assertion
changed). Verified by A/B: same server, 127.0.0.1 → 401, localhost → 200.

Path-assumption check: `playwright.config.ts` / `vitest.config.ts` /
`tsconfig.json` / `tsconfig.e2e.json` / `drizzle.config.ts` / `next.config.mjs` /
`package.json` scripts — all relative or `__dirname`-anchored (the only absolute-ish
construct is vitest's `path.resolve(__dirname,'src')`, which moves with the file).
No edits were needed.

## بند ۵ — server migration guide
`deploy/RESTRUCTURE_RUNBOOK_FA.md` — the 10-step runbook: clone-ambiguity resolution →
pg_dump + full-tree tar → preserve `.env.local` → preserve `public/uploads/` →
`git reset --hard` to the new structure → restore env+uploads at the **root** →
remove `outputs/ node_modules .next` → `npm ci && npm run build` → **fix-pm2
(delete+start, never reload — cwd changed)** → verify (health + /admin + an
/uploads file + an ERP page) → rollback plan (tar restore + old-config start).
Explicit note: **nginx untouched** — it only proxies the port; uploads are served
by the Next route `src/app/uploads/[...path]/route.ts`.

## Attestation table
| شناسه | وضعیت | شاهد (خروجی خام/عدد/کامیت) | توضیح |
|---|---|---|---|
| 26.26d ۰.۱ ابهام دو کلون | انجام شد | ترمینال maintainer: `/var/www/Website` کلون دومِ 9↑/153↓؛ `pm2.config.js` cwd داخل `/var/www/habibazar` | گام ۰ runbook |
| 26.26d ۰.۲ فهرست ارجاعات | انجام شد | grep → ۱۵ فایل واقعی (فهرست بالا) + ۱ فایل cache اشتباهاً track شده | |
| 26.26d ۰.۳ شمارش پایه | انجام شد | `git ls-files outputs/habibazar-web` = **926**؛ کل repo = 957 | معیار R3 |
| 26.26d ۱ جابه‌جایی (R3/R4) | انجام شد | کامیت `996fece`: **926 rename (R)** با `git mv`؛ `git ls-files | grep -c outputs/` = **0** | هیچ فایلی گم نشد |
| 26.26d ۲ به‌روزرسانی ۱۵ فایل | انجام شد | کامیت `01e3577`؛ باگ خاموش update.sh (diff مسیر قدیمی package.json) فیکس | grep نهایی = **صفر** |
| 26.26d ۳.۱ یک deploy | انجام شد | rollback-phase26.1[1-4].sql به deploy/postgres؛ پوشهٔ دوم حذف | |
| 26.26d ۳.۲ restart.sh | انجام شد | `deploy/restart.sh` — delete+start (نه reload) + گارد cwd کهنه + health-gate ۳۰ث | کامیت `e521f03` |
| 26.26d ۳.۳ deploy/README.md | انجام شد | جدول چه/کِی/پیش‌نیاز همهٔ اسکریپت‌ها + قاعدهٔ تفکیک | |
| 26.26d ۴ گیت‌ها | انجام شد | جدول Gates بالا — TS 0 · ESLint 0 · 771 · 11×0 · 136 صفحه · 11/11 رگرسیون · E2E 66/66 | R5/R6 |
| 26.26d ۵ راهنمای سرور | انجام شد | `deploy/RESTRUCTURE_RUNBOOK_FA.md` (۱۰ گام + rollback + نکتهٔ nginx) | |
| 26.M1 تگ pre-restructure | انجام شد | `pre-restructure` → `6f0faaa` (آخرین کامیت قبل از جابه‌جایی) | بازگشت یک‌خطی |
| 26.M1 ابزار عملیاتی tsx → deploy | انجام شد | `git mv` reset-erp-data.ts + fix-bug020-data.ts؛ ارجاعات/usage به‌روز | کامیت `8b2cfa5` |
| 26.M1 bash -n همهٔ deploy | انجام شد | «bash -n: ALL deploy scripts OK» | |
| 26.M1/INFRA-1 اثبات دست‌نخوردگی داده | انجام شد | ci-live-pg (migrate+seed) ۲بار روی DB تمیز: **198 جدول، seedها یکسان، صفر تغییر** | مهاجرت فقط فایل‌سیستم است |
| INFRA-1 ۲ بازماندهٔ SQLite | انجام شد | better-sqlite3+@types حذف؛ migrate-to-postgres.mjs/sqlite-to-postgresql.sh/rollback-to-sqlite.sh حذف؛ **audit:pgcompat = 0 hits** | باقی‌مانده فقط peer-meta اختیاری drizzle در lock |
| INFRA-1 backup/restore → PG | انجام شد | backup.sh حالا pg_dump -Fc + pg_restore --list verify + تولید خودکار کلید گم‌شده (خطای maintainer)؛ restore.sh → pg_restore --clean + snapshot ایمنی | قبلاً فایل SQLite کهنه را بکاپ می‌گرفتند |
| INFRA-1 ۳ migrate-data.sh + برابری | انجام شد | **198 جدول، 253=253 رکورد مو به مو**؛ sequence ادامه می‌یابد (id بعدی > max، بدون تکرار/شروع از ۱)؛ trialBalance تولیدی دو طرف برابر؛ اجرای دوباره idempotent | dry-run پیش‌فرض، اختلاف → exit 1 (R5) |
| INFRA-1 ۵ nginx دامنه‌محور | انجام شد | قالب+generator؛ رندر نمونه: primary→proxy، redirect→301، تک‌دامنه بدون بلوک ریدایرکت، دامنهٔ نامعتبر reject؛ install.sh سیم‌کشی شد | تصمیم هدر: فقط اپ (بدون تکرار)؛ وب‌هوک‌ها باز؛ `nginx -t` روی سرور (اینجا باینری nginx نیست — در README علامت «اجرا روی سرور») |
| INFRA-1 گیت‌ها (بند ۶) | انجام شد | همان جدول Gates + fix محیطیِ E2E (Secure-cookie/127.0.0.1) | |
| برنچ | انجام شد + قید محیطی | کار روی `claude/bold-lamport-a1d6tg` (برنچ جانبی تعیین‌شدهٔ محیط اجرا) از نوک feature/v2؛ PR به feature/v2 | محیط فقط این برنچ را برای push مجاز می‌داند — نام‌های `chore/restructure-root`/`infra/production-restructure` قابل استفاده نبود؛ ایزوله‌سازی همان است |

## Changelog
Move commit (926 renames) · reference commit (15 files) · `deploy/restart.sh` (new) ·
`deploy/README.md` (new) · `deploy/RESTRUCTURE_RUNBOOK_FA.md` (new) · CLAUDE.md (layout +
ops rule) · this report.
