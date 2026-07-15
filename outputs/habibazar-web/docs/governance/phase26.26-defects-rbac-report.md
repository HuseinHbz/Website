# Phase 26.26 — Navigation/Accounting defects + role-based hunt (+ granular RBAC)

Branch `feature/v2-enterprise-upgrade`. Method for every bug: symptom → root cause
→ fix → regression test → sibling hunt.

## بند ۰ — prerequisite (already green from 26.25b)
All regression suites pass in the CI `regressions` job (`npm run regressions`,
now **10** suites): 26.20 28 · 26.21 45 · 26.23 26 · 26.24 24 · 26.24b 13 ·
26.25 14 · 26.25s 16 · 26.25a 19 · 26.25b 41 · 26.26 25. Login numbers +
journal-p99 explained in the 26.25a/26.25b reports (scrypt migration).

## بند ۱ — reported bugs

| ID | Sev | Root cause | Fix | Test |
|---|---|---|---|---|
| **BUG-010** | high | `workspaceForPath` compared the raw `it.href`; a `?tab=` href never equals a pathname (nor `startsWith`, href is longer) → `best=null` → `WORKSPACES[0]` (executive). Treasury/BI/finance/etc. jumped to Executive. | Compare `hrefPath(it.href)` with boundary `startsWith(p+'/')` (so `/admin/sales-returns ≠ /admin/sales`). Explicit default-fallback comment. | New **`audit:nav`** gate (109 items, 0 mis-resolved) + registry membership table test + `?tab=` regression (treasury/BI → erp). |
| **BUG-011** | med | The `/admin/home` grid rendered **all 12** `WORKSPACES` ignoring RBAC (leaked unauthorized workspaces AND differed from the role-filtered sidebar dropdown → read as "6 vs 12"). | `WorkspaceHome` takes `role` → both grid and dropdown read `visibleWorkspaces(role)` (one source). Dropdown gained an explicit count + scroll affordance. | Per-role parity test (all 5 roles). |
| **BUG-012** | high | `/api/admin/database/health` returned a `storage` object WITHOUT `pageSize/pageCount/freelistPages` (SQLite PRAGMA leftovers from pre-Phase-20) but `DatabaseHealth.tsx` called `data.storage.pageCount.toLocaleString()` → TypeError → **white-screen**. Contract drift (client interface never checked vs the API). | API now returns REAL PG metrics (size, bloat = dead/live tuples, active connections, last (auto)vacuum/analyze, real WAL bytes). Component rewritten to those + **bilingual** + every access guarded (`?.`/`??`). New **admin `error.tsx` boundary** so one widget can't white-screen the panel. | Live-PG storage-contract assertion; defensive render (partial payload never crashes). SQLite-drift hunt: only offender was DatabaseHealth. |
| **BUG-013** | critical | The `return` op built a credit note from a paid invoice with ZERO guards — no status/idempotency/partial, and **no second leg** → AR went silently negative; paid invoices unhandled. | CFO verdict honored (delete-with-payment guard STAYS; return-on-paid is legitimate). Pure guards (`isInvoiceReturnable`/`remainingReturnable`/`validateReturnRequest`/`canVoidInvoice`); `createSalesReturn` (guards + **partial** line/qty); `settleReturnIfPaid` on confirm → `erp_settings.sales_return_settlement` = **refund** (negative `sales_payment 'refund'` + Dr AR/Cr Bank → AR 0, bank ↓) or **credit** (explicit customer-credit balance + pending-settlement alert). Void-a-paid-invoice → 400. `'refund'` method added. | **Numeric AR proof** (verify-2626): unpaid return→AR 0; paid+refund→AR **0 & non-negative** + bank −2M + GL AR control restored; paid+credit→explicit −3M + alert; over/draft/paid-void rejected; partial→AR = remainder. + 7 pure unit tests. |

**BUG-013 sibling (purchase):** `convertDocument → credit_note/return` now guarded
(confirmed invoice only, no duplicate return, pending-vendor-settlement alert on a
paid invoice) → no silent negative AP. Proven in verify-2626 (3 assertions).

## بند ۲ — role-based hunt (findings)

| Finding | Role | Sev | Status | Evidence/Test |
|---|---|---|---|---|
| Payment against a **void/draft** invoice accepted | CFO | high | **FIXED** | pure `validatePayment` (3 tests) + route 400 + live-PG |
| **Overpayment** beyond invoice total accepted (silent negative AR) | CFO | high | **FIXED** | same |
| **Duplicate conversion** (quote/order converted twice → twin doc) | CFO | med | **FIXED** | convert rejects an existing non-void child of the target type; live-PG |
| Nav mis-resolution class (BUG-010) elsewhere | QA | — | **CLOSED by gate** | `audit:nav` + registry table test cover the whole registry |
| Empty-DB / partial-API white-screen class (BUG-012) | QA | — | **CLOSED systemically** | global admin `error.tsx` boundary + defensive `DatabaseHealth` |
| auditor/viewer write on `/api/admin/*` → 403 | QA | — | **VERIFIED (26.22)** | central middleware role gate re-confirmed |

## بند ۳ — granular per-user RBAC
See the dedicated section below once delivered. **Note (per the phase
scope_warning):** granular RBAC is phase-sized and a half-implemented access layer
is itself a security hole, so it is delivered as a single complete unit (tables +
pure resolution + server enforcement + UI + tests + backward-compat migration) —
never partially.

## Gates (بند ۰–۲)
TS 0 · ESLint 0 · **752 unit tests** · **10 governance audits 0** (+`audit:nav`) ·
build clean · live-PG verify-2626 **25/25** · regressions **10/10**.

## Changelog (بند ۰–۲)
- `lib/admin/workspaces.ts` (`workspaceForPath` hrefPath+boundary), `WorkspaceHome`
  (role-filtered), `AdminSidebar` (count/affordance), `scripts/nav-audit.ts` +
  `audit:nav`.
- `api/admin/database/health` (PG metrics), `admin/database/DatabaseHealth.tsx`
  (rewrite+defensive+bilingual), `app/admin/error.tsx` (boundary).
- `lib/erp/sales.ts` (return + payment pure guards), `salesData.ts`
  (`createSalesReturn`/`settleReturnIfPaid`/`returnableInfo`), `glPosting.ts`
  (`postCustomerRefundToGl`), `purchasingData.ts` (return guard), sales
  documents/payments routes.
- `migrate.ts` (`'refund'`/`'gateway'` method enum, `sales_return_settlement` seed).
- `scripts/verify-2626.ts` + regression runner.
