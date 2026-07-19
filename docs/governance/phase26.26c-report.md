# Phase 26.26c — BUG-020 data fix + proof completion + real QA (report)

**Working branch:** `feature/v2-enterprise-upgrade` (side-branch + PR flow; no force
on the base). Nearly featureless: data remediation, proof-integrity, completion.

Execution order followed the prompt (بند ۰ → ۲ → ۱ → ۳ → ۴) — بند ۲ first because a
proof-script audit could surface another hidden BUG-020-class defect before closing.

## بند ۰ — BUG-020 production data remediation (blocker)
The 26.26b code fix corrected `reverseEntry` going forward, but documents voided
BEFORE that deploy still carry `status='void'` on the original + a posted reversal,
so their historical balances are still wrong.
- **`scripts/fix-bug020-data.ts`** — restores reversed originals
  (`reversed_by IS NOT NULL AND status='void'`) to `posted`. DRY-RUN default; `--apply`
  needs `--confirm` + a fresh backup (or `--i-have-a-backup`); idempotent;
  `logAction`-audited; proof via the PRODUCTION `loadTallies`/`trialBalance`.
- **Numeric proof** (reproduced pre-fix state on live PG):
  dry-run → 1 victim, WRONG balances **Bank −4,000,000 / AR +4,000,000**;
  apply → **Bank −4,000,000 → 0 · AR +4,000,000 → 0**, TB balanced, audited;
  re-run → 0 victims; guards → no-backup abort(3), no-`--confirm` abort(2).
- **`docs/governance/BUG020-REMEDIATION.md`** — production runbook (backup → dry-run
  → apply → verify via Trial Balance / Ledger validation → rollback).
- **Scope note:** on a given environment the victim count is whatever was voided
  pre-deploy; the script reports "nothing to repair" and exits when it is 0.

## بند ۲ — proof-integrity audit (run early)
**Why BUG-020 hid four phases:** (1) "trial balance balanced" is trivially true —
every entry self-balances, so Σdebit=Σcredit holds while per-account balances are
wrong; (2) `verify-2623` asserted AR over `IN ('posted','void')` — the exact hand-SQL
that masked the void'd original.
- Audited every `scripts/verify-*/sim-*` for hand-SQL financial claims:
  - `verify-2623` — killed `IN ('posted','void')`; the invoice+reversal pair is now
    asserted with the production `status='posted'` filter (so a void'd original
    surfaces as non-zero → the assertion now GUARDS BUG-020).
  - `verify-2626` — `glAr`/`bankGl` now read via production `trialBalance(loadTallies())`.
  - `verify-2626b-cfo` — `glBal` now reads via production `trialBalance(loadTallies())`.
- Re-ran all three after migration: **26/26 · 25/25 · 15/15** — no hidden bug revealed.
- **CLAUDE.md rule 15** added: assert through production functions; assert key-account
  balances, not just "balanced".

## بند ۱ — BUG-020 completion (UI · guard · coverage)
- **1.1 UI:** the journal list marks a reversed original (`معکوس‌شده → #N`) and a
  reversal entry (`سند معکوس ← #N`), both directions, linked ids + hover hint; new
  i18n keys `fin_reversed`/`fin_reversal`. (The fix keeps the original `posted`, so it
  no longer looks like a normal entry.)
- **1.2 re-void guard:** journal route returns **400** on voiding an already-reversed
  entry or a reversal entry; `reverseEntry` throws on a reversal entry
  (defense-in-depth, also protects `voidPurchaseInvoice`); void UI action hidden for
  both. Proven in `verify-2626b-cfo` (15/15): re-reverse idempotent, reversing a
  reversal throws, balances unchanged.
- **1.3 regression-guardian proof:** the 24-month sim gave IDENTICAL retained earnings
  before/after the BUG-020 fix — proving it never exercised a post-void balance
  assertion. Rather than invasively rewrite the 45-assertion sim, `verify-2626b-cfo`
  (in the CI regression runner) is the dedicated guardian, and I **proved it is one**:
  with the pre-fix code re-introduced, `verify-2626b-cfo` fails **3/15** (bank
  → −4,000,000, AR → 14,000,000) and `verify-2623` fails **2/26** (AR pair −10,900,000);
  restored → both green. Void coverage table below.

### Void/reversal coverage across suites
| Suite | Exercises a posted-entry void? | Strong post-void balance assertion? |
|---|---|---|
| verify-2623 | yes (reverseEntry + linkage) | yes — invoice+reversal pair nets 0 (posted-only) |
| verify-2624b | yes (voidPurchaseInvoice) | linkage + TB balanced (AP proven at post time) |
| **verify-2626b-cfo** | **yes (void GL-posted payment)** | **yes — bank 0 / AR 10M via production trialBalance** |
| sim-2621 | voids POs, but had no post-void balance assertion (the gap) | now covered by verify-2626b-cfo |

## بند ۳ — E2E: one clean fully-green run
The 26.26b "58 green / 4 red then explained" was itself a suite defect (no isolation).
Fixed properly and achieved **64 passed / 0 failed** in one clean `--workers=1` run:
- `portal.spec`: unique per-run fixture identity + `afterAll` cleanup (no more `E2E-A`
  collision on re-run).
- `global-setup` + storageState: log in ONCE, all specs reuse the session → zero
  per-test logins → the 10/15min login limiter never fires mid-run.
- `auth.spec` + `resilience.spec` run on a CLEAN state (they probe login / 401 without
  token) via a `storageState` override.
- `admin.spec` "logout clears session" moved to a **dedicated throwaway session** — it
  was revoking the shared DB session and breaking every later spec (the real root cause
  of the admin-smoke failure).
- brittle selectors fixed (wrong-credentials alert filtered off Next's route-announcer;
  dashboard main+heading vs stale class substrings).
Raw: `64 passed (28.9s)`. CI `e2e` job runs the full suite with these fixtures.

## بند ۴ — real QA page-walk (third request; executed, not gated)
`e2e/qa-sweep.spec.ts` walks all **78 admin routes** authenticated on a fresh-seed DB.
- **FOUND — BUG-021 (React #418 hydration text mismatch, crash-class):**
  `/admin/operations` (`useState(new Date())` rendered as `toLocaleTimeString()` in the
  header — SSR time ≠ client) and `/admin/content` (`views.toLocaleString()` locale
  drift). **Fixed** (mount-guarded time · `'en-US'`-pinned number). Re-ran: **78 pages ·
  0 hard defects · 0 overflow.**
- **4.5 invalid financial input via curl (UI bypassed):** empty-name/negative-credit
  customer → **400**, unbalanced journal → **400**, bad-date/empty-lines journal → **400**.
- **4.6 dead buttons:** grep for empty/undefined `onClick` → none.
- **4.2 contract drift:** 0 console errors across 78 pages ⇒ no runtime type-mismatch
  crash (BUG-012 class). **4.3 double-click idempotency** rests on the existing numbering
  advisory-lock + idempotent GL posts (`gl_entry_id`/`xmax`). **4.4 light-theme
  contrast** is a visual property the walk can't auto-grade — reported as inspected (no
  crash/overflow in default theme), not machine-verified.

## Gates
TS **0** · ESLint **0** · **11 governance audits 0** · build clean · **771 unit tests** ·
**11 regression suites** all green (2620/2621/2623/2624/2624b/2625/2625s/2625a/2625b/2626/
**2626b-cfo**) · **E2E 64/64** · **CFO live-PG 15/15** · **QA sweep 78 pages 0 defects** ·
BUG-020 remediation proven (−4,000,000 → 0).

## Mandatory attestation table
| Item | Status | Evidence |
|---|---|---|
| ۰.۱ BUG-020 scope diagnostic | done | script prints victim set + WRONG balances via trialBalance; 1 victim on reproduced state |
| ۰.۲ fix-bug020-data.ts | done | dry-run/apply/idempotent/backup-gated/audited; Bank −4,000,000→0, AR +4,000,000→0 |
| ۰.۳ remediation runbook | done | `BUG020-REMEDIATION.md` (backup→dry-run→apply→verify→rollback) |
| ۱.۱ reversed-entry UI | done | FinanceCenter badges both directions + i18n keys |
| ۱.۲ re-void guard | done | route 400 + engine throw; `verify-2626b-cfo` 15/15 (idempotent + reversal-of-reversal blocked) |
| ۱.۳ regression guardian proof | done | pre-fix code → verify-2626b-cfo 3/15 red, verify-2623 2/26 red; post-fix green; coverage table |
| ۲.۱ proof-fn rule | done | CLAUDE.md rule 15 |
| ۲.۲ migrate hand-SQL assertions | done | verify-2623/2626/2626b-cfo → production trialBalance; re-ran 26/25/15, no new bug |
| ۲.۳ strong balance assertion | done | verify-2626b-cfo asserts exact bank/AR values (not just "balanced") |
| ۳ E2E one clean green run | done | **64 passed / 0 failed** raw output; isolation + storageState + logout-session fixes |
| ۴.۱ real page walk | done | qa-sweep 78 pages; FOUND+FIXED BUG-021; re-run 0 defects |
| ۴.۲ contract drift | done | 0 console errors across 78 pages |
| ۴.۳ double-click idempotency | done (existing guards) | numbering advisory-lock + idempotent GL posts (gl_entry_id/xmax) |
| ۴.۴ light-theme contrast | inspected, not machine-graded | walk shows no crash/overflow in default theme; visual contrast not auto-verifiable |
| ۴.۵ invalid financial input (server) | done | curl 400 on empty-name/neg-credit customer, unbalanced + bad-date journal |
| ۴.۶ dead buttons | done | grep empty/undefined onClick → none |
| CFO/BUG-020 numeric live-PG | done | remediation −4,000,000→0; verify-2626b-cfo 15/15 |
| gates (TS/ESLint/audits/tests/regressions/E2E) | done | 0 · 0 · 11×0 · 771 · 11/11 · 64/64 |

## Changelog
`fix-bug020-data.ts`, `BUG020-REMEDIATION.md`, `glPosting.ts` (re-void guard),
`journal/route.ts` (400 guards), `FinanceCenter.tsx` + `locale.tsx` (reversed badges),
`verify-2623/2626/2626b-cfo.ts` (production-fn assertions + guard tests),
`ci-regressions.ts` (+2626b-cfo), `contract-changes.md` (CC-003), `CLAUDE.md` (rule 15),
E2E (`global-setup.ts`, `helpers.ts`, `playwright.config.ts`, `auth/admin/portal/
resilience.spec`), `qa-sweep.spec.ts`, `OperationsCenter.tsx` + `ContentHub.tsx` (BUG-021).
