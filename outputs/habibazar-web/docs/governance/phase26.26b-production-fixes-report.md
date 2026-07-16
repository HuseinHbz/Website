# Phase 26.26b — Production Fixes + 26.26 Completion (report)

**Working branch:** `feature/v2-enterprise-upgrade` (all commits land here directly this
pass; no side-branch/PR was needed — see branch note). **No new features** — fix the
production defects the maintainer saw on habibazar.ir despite a green build, complete
the half-finished 26.26 work, and prove every item with evidence.

Compliance contract honoured: R1 every item has a row below · R2 no ✅ without a test
name / number / commit / run output · R3 a failed assertion → the CODE was assumed
wrong first (BUG-020), the one assertion edit is logged in `contract-changes.md`
(CC-003) · R4 no gate softened · R5 every question answered · R6 granular RBAC NOT
implemented (ADR only).

## بند ۱ — production bugs (blocker, done in pass 1)

- **BUG-014 (AdminShell missing).** `crm/dashboard`, `crm/tickets`,
  `settings/onboarding` rendered chrome-less (no sidebar/header). Fixed: all three
  wrapped in `AdminShell` (mirroring `database/page.tsx`). New **`audit:shell`** gate
  (`scripts/shell-audit.mjs`) fails the build if any admin `page.tsx` (login exempt)
  omits `AdminShell` — **82 scanned, 0 violations**. Page sizes after (build): each
  ~164 kB First Load, in line with every other AdminShell page.
- **BUG-015 (no integration UI).** The مودیان/Zarinpal/SMS/WhatsApp/Telegram
  credentials lived as `erp_settings` rows with **no UI** — three phases seeded rows
  only. Built `/admin/settings/integrations` (`IntegrationSettings.tsx` +
  `/api/admin/settings/integrations`): a registry-driven form
  (`src/lib/erp/integrationSettings.ts`). **Secrets are write-only** — the API returns
  only a masked hint (`•••• 1234`) + a boolean, never the value; `manage_settings`-gated;
  audit records the key + set/cleared, **never the secret value**. Per-provider **Test
  connection** reports live/sandbox honestly (no faked remote round-trip). Registered
  in the System workspace nav. **Honesty split** (per the prompt): the providers now
  have a **complete UI awaiting only the customer's key** — that is what
  "blocked-external" legitimately means from here on; before this bug they had *no UI at
  all*. Unit test: `integrationSettings.test.ts` (4) — masking never leaks, allow-list,
  live/sandbox derivation.
- **BUG-016 (WhatsApp/Telegram absent from checklist).** Added both to
  `onboarding.ts` (now 10 items) and **fixed a real latent bug**: the checklist read
  stale keys (`sms_ir_api_key`, `zarinpal_merchant_id`) that nothing writes, so a
  configured provider still showed *not ready*; now reads the live keys
  (`sms_api_key`, `pay_zarinpal_merchant`, `whatsapp_token`, `telegram_bot_token`) and
  each item **deep-links to the integration-settings anchor** (`#sms`, `#zarinpal`, …).
- **BUG-017 (English funnel labels in Persian UI).** CRM dashboard funnel now renders
  `t('lead_st_<stage>')` — reusing the existing `lead_st_*` keys (no parallel
  translation).
- **BUG-018 (mixed digits).** `formatCurrency`/`fmtMoney` shape digits to the UI
  locale (fa → Persian digits) via a module default set from `AdminShell` +
  per-call `locale` override. Pure test: `format.test.ts` (+4) — `۱,۲۳۴,۰۰۰ ریال`,
  `۰ ریال`, `$۱,۰۰۰` in fa; Latin in en; `toFaDigits('0 ریال') === '۰ ریال'`.
- **BUG-019 (card overflow).** Root cause was BUG-014's missing width constraint (now
  fixed); added `break-words min-w-0` to `StatCard` value as the defensive guard so a
  long fa Rial amount wraps instead of overflowing.

## بند ۲ — deploy-log findings
- **2.1** `/admin/dashboard` was **121 kB / 292 kB** First Load (static recharts) — the
  one outlier. Extracted the Area/Pie charts into `AnalyticsCharts.tsx`, lazy-loaded via
  `next/dynamic({ssr:false})` (the `ViewsChart` precedent). Top-pages bars were already
  pure HTML.
- **2.2** `/[locale]/portal` is **`force-dynamic`** and renders only `<PortalApp>`
  (client); all customer data is fetched from `/api/portal/*` post-auth — **nothing
  baked into static HTML**. Verified, no change needed.
- **2.3** `npm audit`: production (`--omit=dev`) = **0 vulnerabilities**. The 4 moderate
  are devDep-only (`drizzle-kit → @esbuild-kit → esbuild` dev-server SSRF), never in
  prod/CI; `audit fix --force` would break the migration tooling. **Decision:
  accept/defer** — not force-upgraded in a bug-fix phase.

## بند ۳ — four unanswered 26.26 questions
- **3.1 (contract change 26.25s)** — logged as **CC-001** (prior pass), still present.
- **3.2 (has Playwright EVER run?)** — it had only been type-checked. **It has now been
  EXECUTED for real** this pass against a live Postgres + `next start`:
  `portal.spec.ts` **3/3**, `auth.spec.ts` **5/5** (workers=1, fresh limiter), full
  suite **58 passed**. The only failures were the in-memory login rate-limiter (10/15
  min) tripping under repeated + concurrent (2-worker) auth-heavy runs, and a fixture
  duplicate-key from a deliberate double-run — **not code regressions** (wrong creds →
  clean 401, right creds → login works, portal green). New **`e2e` CI job** (postgres
  service + build + `next start` + `RATE_LIMIT_DISABLED` + `--workers=1`) runs them on
  every push; `playwright.config` pins the sandbox Chromium only when present, else uses
  CI's installed browser.
- **3.3 (i18n baseline)** — locked at **28** in `scripts/i18n-baseline.json`;
  `audit:i18n` fails on any increase + flags hardcoded-Persian JSX bidirectionally.
- **3.4 (scrypt params)** — **YES, self-describing**: `scrypt$N$r$p$salt$hash`;
  `verifyPassword` reads N/r/p from the string. Test `password.test.ts`
  "is self-describing" (N=16384 & 8192 both verify).

## بند ۴ — BUG-010 second root + BUG-011
- Context-aware `workspaceForPath(pathname, currentWorkspaceId?)` + sticky sidebar
  (prior pass), `workspaces.test.ts` 25.
- **BUG-011 (super_admin count):** verified deterministically —
  `visibleWorkspaces('super_admin') = 12 = total`; `AdminSidebar` (dropdown) and
  `WorkspaceHome` (grid) **both** derive from `visibleWorkspaces(role)`, so parity is
  structural. By role: super_admin 12 / administrator 11 / editor 10 / auditor 5 /
  viewer 3.

## بند ۵ — CFO financial-integrity hunt (numeric live-PG)

Found + fixed a real GL bug and proved the guards.

- **BUG-020 (CONFIRMED, CRITICAL) — reversal double-negation.** `reverseEntry` set the
  original entry to `status='void'` **and** posted a reversal; balance sums count
  `status='posted'` only, so the void'd original was excluded while the reversal stayed
  posted → **every account touched by a void netted to −original instead of 0**.
  Isolated live-PG proof: `Dr 1010 100` → reverse → **1010 = −100** (must be 0).
  **Fix:** a reversing entry now keeps the original **posted** (standard reversing-entry
  accounting); reversed-ness is carried by `reversed_by` alone. After fix: **0 / 0**.
  Regression assertion `verify-2623` ch.14 guarded the buggy `status='void'` → updated +
  logged **CC-003**. Blast radius verified SAFE: **sim-2621 45/45 with identical retained
  earnings 1,180,866,212.8**, verify-2624b 13/13, verify-2626 25/25, verify-2625b 41/41.
- **CFO evidence:** `scripts/verify-2626b-cfo.ts` **12/12** live-PG (S3 void→reversal
  restores bank 0 / AR 10M; S2 over-payment → visible −2,000,000 customer credit, never
  silent 0; S7 closed-period `assertPostable` rejects sales-invoice + payment GL posts,
  books unchanged) — added to the CI regression runner (**11 suites**).
  `cfo-hunt-2626b.test.ts` **7** pure (S1 bounced cheque excluded from open inflow, S5
  Iran VAT 9% rounds to 2 dp, S6 petty-cash negative balance flagged). S4 FX-reval
  idempotency + S8 credit-guard-on-credit-note reuse existing 26.8/26.25 coverage.

## بند ۶ — QA hunt (automated gates + structural)
The reported production symptoms are now **structurally impossible** and gate-enforced:
missing chrome → `audit:shell` (82/0); dead internal links → `audit:links` (0 broken);
hardcoded colours / off-scale type → `audit:tokens`/`audit:ui`/`audit:theme` (0);
missing/one-language admin strings → `audit:i18n` (0 missing, baseline 28); nav
mis-resolution → `audit:nav`. **403 role matrix** for the read-only roles is a single
central gate: `middleware.ts` `READ_ONLY_ROLES = {auditor, viewer}` → any non-GET on
`/api/admin/*` (except logout) returns **403**, so every write route is covered at once;
`canDo` grants those roles zero write perms. Double-click idempotency (numbering
advisory-lock + idempotent GL posts) and financial-form validation (zod on every ERP
route) are the existing engine guards. Empty-DB safety: the CRM dashboard, tickets and
portal pages render on a freshly-seeded DB (E2E ran against exactly that).

## بند ۷ — ADR-002 (design only, R6)
`docs/governance/ADR-002-granular-rbac.md` resolves the two 26.26 flaws: the
`x-pathname` header is rejected as sole mechanism (route-literal keys, middleware
overwrites the header, forged-header pen-test) and permission keys are operation-scoped
(`…:post` ≠ `…:draft`), AND-ed with SoD. **No RBAC table/route/UI built.**

## Gates
TS **0** · ESLint **0** · **771 unit tests** · **11 governance audits 0** (incl.
`audit:shell`) · build clean · **E2E executed** (portal 3/3, auth 5/5) · **CFO live-PG
12/12** · regressions unaffected (sim 45/45, 2624b 13/13, 2626 25/25, 2625b 41/41).

## Mandatory attestation table

| Item | Status | Evidence |
|---|---|---|
| BUG-014 AdminShell + gate | done | 3 pages wrapped; `audit:shell` 82/0; build page sizes ~164 kB |
| BUG-015 integration UI (write-only) | done | `/admin/settings/integrations`; masked secrets; `integrationSettings.test.ts` 4; Test-connection honest live/sandbox |
| BUG-015 honesty split | done | UI-complete-awaiting-key vs no-UI stated above; blocked-external now legitimate |
| BUG-016 WA/Telegram + key fix | done | 10-item checklist; stale-key bug fixed → live keys + anchors |
| BUG-017 fa funnel labels | done | `t('lead_st_*')` reuse |
| BUG-018 fa-IR money digits | done | `format.test.ts` +4 (fa/en/`toFaDigits`) |
| BUG-019 card overflow | done | root=BUG-014 fixed + `break-words min-w-0` guard |
| بند۲.۱ dynamic recharts | done | `AnalyticsCharts.tsx` + `next/dynamic`; was 121/292 kB |
| بند۲.۲ portal SSG | done | `force-dynamic`, client-fetch only — verified |
| بند۲.۳ npm audit decision | done | prod 0 vulns; devDep drizzle-kit/esbuild accept/defer |
| بند۳.۲ E2E real run | **done (executed)** | portal 3/3 · auth 5/5 · 58 passed; `e2e` CI job added |
| بند۳.۱/۳.۳/۳.۴ | done | CC-001; baseline 28; scrypt self-describing test |
| بند۴ BUG-011 parity | done | `visibleWorkspaces` shared; 12=12 super_admin |
| بند۵ BUG-020 reversal fix | **done (found+fixed)** | live-PG 1010 −100→0; CC-003; sim 45/45 identical |
| بند۵ CFO hunt | done | `verify-2626b-cfo.ts` 12/12 + `cfo-hunt-2626b.test.ts` 7; 6/8 scenarios direct, 2 reuse existing |
| بند۶ QA sweep | done | 11 audits 0; central 403 gate (auditor/viewer); zod + advisory-lock |
| بند۷ ADR-002 (design only) | done | x-pathname + operation-scoped resolved; no RBAC built (R6) |
| R1 every item a row | done | this table |
| R2 evidence for every ✅ | done | test names/numbers/run output throughout |
| R3 no weakened assertion | done | CC-003: code fixed first, assertion follows, logged |
| gates | done | TS 0 · ESLint 0 · 771 tests · 11 audits 0 · build clean |

## Branch note
The environment's "develop on side-branch + PR" flow was confirmed legitimate in the
prior pass (PR #5/#6 merged cleanly, main never force-pushed). This pass's commits are
fast-forward on `feature/v2-enterprise-upgrade` — no force-push (rule 5).
