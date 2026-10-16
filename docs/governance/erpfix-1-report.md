# ERPFIX-1 — GL Core: single posting entry point, DB-level invariants, account-6100 collision

Covers BUG-ERP-08, BUG-ERP-21, BUG-ERP-10 (per `erp-audit-report.md`).

## بند۰ — Audit-first (completed before any code)

Grepped every `INSERT INTO gl_journal_entries`/`gl_journal_lines` under
`src/` + `scripts/`. Confirmed the audit's claim exactly: **13 real
production insert sites** outside any shared function —
`accountingData.ts` (opening balance + year-end closing), `ledgerData.ts`
(intercompany), `revaluationData.ts`, `glPosting.ts` (already the partial
core — `insertPostedEntry` already existed, used by COGS/treasury/
reversal/payment paths, but WITHOUT a balance check or `options`),
`salesData.ts`, `purchasingData.ts`, `payrollData.ts`, `annualData.ts`,
`importData.ts`, `inventoryOpsData.ts` ×2 (count-post + revalue), and the
journal route. Of the 5 BUG-ERP-08-evidence sites (ledgerData:106,
revaluationData:77, importData:364, inventoryOpsData:236, :462), **none**
called `assertPostable` — confirmed by direct read, not assumed.
`canPostDate` (`accountingCore.ts:107-112`) confirmed to return `ok:true`
unconditionally for a date outside every defined period — the exact gap
claimed. `runYearEndClosing` confirmed to have **zero** gate call at all
(not even the broken kind). `postEntry` (accountingData.ts) confirmed
non-atomic (bare sequential `pgQuery` calls, no transaction). Account
`6100` confirmed seeded twice — once as `Rent Expense` (line ~1264), once
as a no-op `Salaries` (`ON CONFLICT DO NOTHING` against the already-
existing Rent row, line ~2278) — and 5 literal `'6100'` references
confirmed across `payroll.ts`, `annual.ts`, `treasury/payments.ts`,
`payrollData.ts`, `annualData.ts` (the last two are translate-map KEYS,
not raw writes — see بند۴).

## بند۱ — Items

### BUG-ERP-08 — fiscal-period lock bypassed in 5 paths + no gate on year-end + unlimited "ungoverned" dates

**Status: built-new.**

- `insertPostedEntry` (`glPosting.ts`) is now the single real posting
  function: gate (`assertPostable`, with an `allowClosedPeriod` option for
  year-end closing only) → `entryBalanced` check → mint via `nextNumber`
  (or reuse a caller-supplied `entryNo`/`docType`) → header insert → line
  inserts, all inside the caller's transaction.
- **Migrated to it:** `ledgerData.ts` (intercompany, both mirrored
  entries), `revaluationData.ts` (`bookRevaluation`), `importData.ts`
  (journal entity, reusing its pre-minted number), `inventoryOpsData.ts`
  (`postCount`, `revalueInventory` — both now also wrapped in one
  transaction, closing an atomicity gap too), `accountingData.ts`
  (`postEntry` — opening balance AND year-end closing, which previously
  had **no gate at all**).
- `canPostDate` gained a `requirePeriod` parameter (default `true`):
  once at least one period exists, a date outside every one of them is
  now rejected — backed by `erp_settings.gl_require_period` (`'strict'`
  default | `'off'`). Logged as CC-009 in `contract-changes.md` (a real
  behavior change, per the master prompt's own instruction).
- Year-end closing's idempotency key moved from `memo LIKE '%<name>%'`
  (a "25" vs "2025" collision risk) to an exact `reference =
  'year-end-close:<fiscal_period_id>'`, backed by a partial unique index.
- New CI gate `audit:gl-writes` (`npm run audit:gl-writes`): fails on any
  `INSERT INTO gl_journal_entries` outside `glPosting.ts`, unless
  allowlisted with a written reason. 3 genuine exceptions allowlisted
  (journal route's own create-and-post, `purchasingData.ts`/`salesData.ts`
  invoice auto-posting) — each already independently gated + transactional
  + regression-tested since earlier phases; forcing them onto the shared
  function would rewrite already-correct financial code for no bug this
  phase found.
- `runYearEndClosing`'s route (`finance/periods/route.ts`) gained an
  explicit `requireOp('erp.finance:close_period')` check (it previously
  relied only on the generic `manage_settings` action).

**Red → Green (live, see بند۵):** all 5 paths + year-end closing proven
in `verify-erpfix-1.ts` assertions 1-7.

### BUG-ERP-21 — non-atomic posting, `Date.now()` numbering, no DB-level invariant

**Status: built-new.**

- Every migrated path above now posts header+lines in ONE transaction
  (via `insertPostedEntry`), replacing bare sequential `pgQuery` calls.
- `Date.now()`-based entry numbers (`OB-`, `YEC-`, `IC-`, `FXR-`) removed;
  two new seeded `numbering_formats` rows (`opening_balance`,
  `year_end_closing`) mint through the same engine every other document
  type uses; intercompany/revaluation now mint via `insertPostedEntry`'s
  default `nextNumber('journal', …)`.
- **New finding, fixed in this phase (not deferred):** `payrollData.ts`'s
  `postPeriodToGl` and `annualData.ts`'s `postAnnualEntry` both resolved
  each line's `account_id` ONE AT A TIME, *after* the header was already
  inserted — a missing account mid-loop left a posted, PARTIAL entry
  already committed. Both now resolve every account first (fail before
  writing anything), then post atomically via `insertPostedEntry`.
- **DB-level invariants** (count-first, never auto-correct existing data,
  per stop_conditions):
  - `gl_journal_lines_sign_check` CHECK (`debit>=0 AND credit>=0 AND NOT
    (debit>0 AND credit>0)`) — 0 existing violations found → validated;
    would have been added `NOT VALID` + reported otherwise.
  - `uq_gl_entries_entryno_company` UNIQUE on `(entry_no,
    COALESCE(company_id,-1))` — 0 existing duplicates found → created.
  - `uq_gl_yearend_close_ref` partial UNIQUE on `reference` for
    `'year-end-close:%'` — 0 existing duplicates → created.
  - A **deferred constraint trigger** (`trg_erpfix1_gl_entry_balance`,
    `AFTER INSERT OR UPDATE ... DEFERRABLE INITIALLY DEFERRED`) checks, at
    COMMIT, that every `status='posted'` entry's lines sum to zero — a
    draft is explicitly exempt. Proven live against a real transaction
    (not just the pure engine) — see بند۵.

**Red → Green (live, see بند۵):** assertions 8-11.

### BUG-ERP-10 — account 6100 seeded twice, payroll silently posts to Rent

**Status: built-new. Decision_gate resolved by the maintainer: use
existing 6000 (Salaries Expense).**

- `migrate.ts`'s no-op `INSERT INTO gl_accounts ... ('6100','Salaries',…)`
  removed; `gl_map_payroll_expense` default seed changed `'6100'` →
  `'6000'`, with an idempotent `UPDATE` repairing an already-seeded
  install (safe — `'6100'` was never a valid choice for payroll, not an
  operator customization being overwritten).
- `payroll.ts`/`annual.ts`'s pure engines still emit the internal literal
  `'6100'` as a MAP KEY (the existing `applyGlMap`-style translate
  pattern this codebase already uses elsewhere) — `payrollGlMap()`/
  `annualGlMap()` translate it through `erp_settings` before anything is
  written, so the actual posted account is now `6000` with zero changes
  needed to the pure engines themselves.
- `src/lib/erp/coaContract.ts` (new): the chart-of-accounts contract — one
  name/type per code, covering the standard seeded chart + every
  payroll/treasury/revaluation/intercompany code. `findCoaCollisions` is
  the pure detection function (unit-tested with the exact BUG-ERP-10
  shape as a case).
- New CI gate `audit:coa` (`npm run audit:coa`): parses every `INSERT INTO
  gl_accounts` in `migrate.ts` and fails if any code has 2+ distinct
  (name, type) pairs. **27 codes seeded, 0 collisions** (down from the
  real 1 before the fix).
- `deploy/erp-coa-audit.ts` (read-only): reports seed collisions (reuses
  `findCoaCollisions`) + live postings on 6100 by likely origin
  (payroll/treasury/other) — for the maintainer to inspect an existing
  install.
- `deploy/erp-remediate-salary-account.ts`: dry-run by default; lists
  every `payroll:%`-referenced posted line on 6100 and, with `--apply`,
  posts a REAL correction entry (Dr 6000 / Cr 6100) through
  `insertPostedEntry` for each one whose period is still open — never
  edits or voids the original posted entry (BUG-020 discipline); an entry
  in a closed/locked period is reported, never auto-corrected.

**Red → Green (live, see بند۵):** assertions 12-16.

## بند۲ — Already-existing, verified, NOT rebuilt

- `insertPostedEntry` itself (the function) already existed from Phase
  26.23/26.26b — reused and extended (balance check + `options`), not
  duplicated.
- `reverseEntry`'s two-way-link discipline (BUG-020) — untouched.
- `salesData.ts`/`purchasingData.ts`/journal route's own
  create-and-post paths — audited, confirmed already correctly gated +
  transactional + regression-tested, left as-is (allowlisted in
  `audit:gl-writes` with written reasons, per بند۱).

## بند۳ — Finding-for-later (not fixed, out of this phase's scope)

None beyond what's listed as fixed-in-phase above — the payrollData.ts/
annualData.ts atomicity gap was genuinely related (same defect class as
BUG-ERP-21) and was fixed, not deferred, per the master prompt's own
instruction to fix related findings in-phase.

## بند۴ — Live PostgreSQL proof

`scripts/verify-erpfix-1.ts` — **18/18 assertions pass**, registered as a
regression suite in `scripts/ci-regressions.ts`. Covers (production
functions only, per CLAUDE.md rule 15): all 5 former bypass paths rejected
inside a CLOSED period; year-end closing succeeds in CLOSED (never
needing LOCKED), is idempotent; a raw unbalanced posted entry rejected at
COMMIT by the trigger; a duplicate `entry_no` rejected by the unique
index; a negative line rejected by the sign CHECK; an unbalanced DRAFT
still allowed; `gl_map_payroll_expense='6000'`; 6100 stays at exactly 0
after a payroll posting while 6000 correctly carries it; the production
`trialBalance`/`loadTallies` engine reports balanced; `audit:gl-writes`
and `audit:coa` both pass clean on the current codebase.

**Full regression suite (39 suites incl. the 2 new ones from this
session's earlier SEC-FIX-1/PROC-FLOW-1 phases): all green** after fixing
5 pre-existing suites whose fixtures (not production code) assumed the
old "ungoverned date always postable" behavior — see `contract-changes.md`
CC-009/CC-010 for the exact, logged assertion/fixture changes.

Gates: TypeScript 0 errors · ESLint 0 · `npm run build` clean · full
`npm run audit` (12 governance audits incl. the 2 new ones) clean ·
1341/1341 unit tests · full regression suite green.

## بند۵ — Required confirmations from the maintainer/accountant

- **BUG-ERP-10 decision_gate: answered.** Payroll posts to existing 6000
  (Salaries Expense); 6100 stays Rent Expense only.
- **No other decision_gate existed in this phase's 3 items** (BUG-ERP-08
  and BUG-ERP-21 had none — both are pure mechanism fixes).
- **Recommended next step, not done in this phase:** if the live
  production database already has real payroll postings on 6100, run
  `deploy/erp-coa-audit.ts` (read-only) to see the count, then
  `deploy/erp-remediate-salary-account.ts` (dry-run first) with the
  accountant's sign-off before `--apply`.

## New CLAUDE.md rule

> «سند `posted` فقط از `insertPostedEntry` نوشته می‌شود؛ کد حساب سیستمی
> فقط از `coaContract.ts`؛ هر دو با گیت CI اعمال می‌شود.»
