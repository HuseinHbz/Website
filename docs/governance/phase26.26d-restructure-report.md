# Phase 26.26d — repo flatten: `outputs/habibazar-web` → root (report)

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
<!-- GATES -->

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
<!-- ATTEST -->

## Changelog
Move commit (926 renames) · reference commit (15 files) · `deploy/restart.sh` (new) ·
`deploy/README.md` (new) · `deploy/RESTRUCTURE_RUNBOOK_FA.md` (new) · CLAUDE.md (layout +
ops rule) · this report.
