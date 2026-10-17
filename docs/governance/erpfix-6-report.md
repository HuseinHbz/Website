# ERPFIX-6 — Inventory Costing & COGS From One Reference (report)

Covers BUG-ERP-12, BUG-ERP-07 from `erp-audit-report.md`.
Branch: `claude/bold-lamport-a1d6tg` (unchanged). No force-push used.

## بند ← وضعیت

| بند | وضعیت |
|---|---|
| BUG-ERP-12 (COGS/valuation from one reference + reconciliation) | built-new |
| BUG-ERP-07 (direct-invoice stock handling, 3 modes) | built-new |
| audit_first finding: `createSalesReturn` never restocked | built-new (confirmed via live code audit, fixed per decision_gate) |

All three decision_gates were answered by the maintainer BEFORE
implementation — none deferred:

- **BUG-ERP-12**: the valuation method is the one already configured PER
  PRODUCT (`inv_products.valuation_method`), default WAVG when unset. ✅
  implemented as answered — no global override was added.
- **BUG-ERP-07**: all three modes (`auto_issue`/`require_delivery`/`warn`)
  are built; `erp_settings.invoice_stock_mode` defaults to `warn`. ✅
  implemented as answered.
- **audit_first finding** (not one of the two formal items, but explicitly
  surfaced in this phase's own `audit_first` list and resolved via
  `AskUserQuestion` before any code was written): a confirmed sales return
  restocks at the ORIGINAL issue cost. ✅ implemented as answered.

## Per-item: red → fix → green (real numbers from a live PostgreSQL run)

All assertions below are from `scripts/verify-erpfix-6.ts` (25/25) run
against a fresh database (`rg_erpfix6`), through production functions
(`deliverSalesOrder`, `issueCost`/`valuate`, `trialBalance` via
`loadTallies`, `inventoryGlReconciliation`) per CLAUDE.md rule 15.

### BUG-ERP-12 — COGS/valuation from one reference
- **Red** (confirmed by direct code read, not re-broken on purpose):
  `deliverSalesOrder` read `p.cost::float AS cost` from `inv_products` and
  used that STATIC figure as both the `inv_moves.unit_cost` and the COGS
  amount — `advanceShipment` did the exact same thing. Neither ever
  consulted the FIFO/LIFO/WAVG engine (`erp/inventory.ts#valuate`) that the
  Inventory Center's own valuation report already used, so a product's
  displayed inventory value and its actual COGS could silently disagree.
- **Fix**: new pure `issueCost(moves, qty, method)` (reuses `valuate` — the
  COGS delta of "history" vs "history + this issue", correct for every
  method with zero duplicated layer logic) + a DB-aware wrapper
  `costOfIssuing(query, productId, qty)` (`inventoryOpsData.ts`) that reads
  the product's own `valuation_method` and its move history through the
  CALLER's transaction. `deliverSalesOrder`, `advanceShipment`'s ship
  branch, and the new `autoIssueDirectInvoiceStock` all route through it;
  `advanceShipment`'s RETURN branch restocks at the ORIGINAL issue's own
  `unit_cost` (read back by `ref`), never a recomputed one.
- **Green**: assertions #1–#9 — three otherwise-identical products (same
  two receipts: 10@100, 10@200), one per method, each issuing 15 units:
  WAVG books 2,250 (avg 150/unit), FIFO books 2,000 (10@100+5@200), LIFO
  books 2,500 (10@200+5@100) — all three VERIFIABLY different from the
  static `inv_products.cost` of 999, and each exactly matching
  `issueCost`'s own figure (not a hand-computed expectation).
- **Reconciliation**: assertions #10–#13 — a GRN received but not yet
  invoiced shows up entirely inside `unbilledReceiptsValue` (1,500 = 5×300)
  and the reconciliation's `unexplained` figure does not move; once the
  invoice is confirmed, the receipt leaves the unbilled bucket and
  `unexplained` is still unchanged — proving the gap is fully accounted
  for by the explainable component in both states, not just coincidentally
  zero.

### BUG-ERP-07 — a direct invoice with no delivery
- **Red** (confirmed by direct code read): the invoice confirm branch in
  `sales/documents/route.ts` posted AR/Revenue/VAT only — COGS and
  inventory issue existed ONLY inside `deliverSalesOrder`/`advanceShipment`,
  both keyed off a sales ORDER/shipment, never an invoice directly. A
  standalone invoice with a stock line (no source order) passed its
  confirm with zero inventory effect and zero COGS.
- **Fix**: `erp_settings.invoice_stock_mode` (`auto_issue`|
  `require_delivery`|`warn`, default `warn`) read once per confirm, applied
  ONLY to a direct invoice (`source_id IS NULL` — `directInvoiceStockLines`)
  with at least one stock line:
  - `require_delivery` → `ERP-SALES-DIRECT-INVOICE-REQUIRES-DELIVERY` (409)
    before the confirm transaction even opens.
  - `auto_issue` → `autoIssueDirectInvoiceStock` runs INSIDE the same
    transaction as the credit check/status write/GL post; insufficient
    stock or a missing warehouse throws and rolls the WHOLE confirm back
    (mapped to `ERP-SALES-DIRECT-INVOICE-INSUFFICIENT-STOCK`, 409).
  - `warn` → confirms exactly as before this phase, but now raises a
    visible `business_alert` (`direct_invoice_stock_not_issued`) instead of
    silently never touching inventory — the precise bug, now observable.
- **Green**: assertion #14 — a direct invoice's stock line is correctly
  detected; #15/#16 — `auto_issue` issues 10 units and books COGS of 600
  (10×60, the real `issueCost`, not the static cost of 50); #17 —
  re-running is idempotent (no double-issue); #18 — insufficient stock (3
  on hand, 10 requested) is rejected outright; #19 — no warehouse set is
  rejected; #20 — an invoice converted from an ALREADY-DELIVERED order
  (`source_id` set) is never subject to `invoice_stock_mode` at all —
  proving the `do_not` ("never re-issue for an order-sourced invoice") by
  direct assertion, not just by absence of a counterexample.

### audit_first finding — `createSalesReturn` never restocked
- **Red** (confirmed by direct code read): `createSalesReturn` builds the
  `credit_note` document and its lines; it never touches `inv_moves` at
  all — a returned physical item vanished from the books (money came back
  via `settleReturnIfPaid`, but the goods were never recorded as back in
  the warehouse).
- **Fix**: new `restockSalesReturn(creditNoteId, userId)` — for each
  product line, finds the ORIGINAL issue move by `ref` (either this
  invoice's own direct auto-issue tag `INV-<invoiceId>-%`, or, for an
  order-sourced invoice, the order's shipment tag `SHP-<id>`) and restocks
  at that EXACT unit cost; a line with no traceable original issue is
  skipped (nothing was ever actually taken out of stock). Called
  best-effort right after `settleReturnIfPaid` in the credit_note confirm
  path (same existing pattern — never blocks a confirm that already
  committed its GL post). Idempotent per credit note.
- **Green**: assertion #21 — a return credit note is created; #22 — the
  exact product line is restocked; #23 — at the ORIGINAL issue cost (60),
  not a freshly recomputed one; #24 — on-hand increases by the full
  returned quantity; #25 — re-running the restock is idempotent.

## Files changed

- `src/lib/erp/inventory.ts` — new `issueCost` (pure).
- `src/lib/inventory/inventoryOpsData.ts` — new `costOfIssuing`;
  `advanceShipment`'s ship branch uses it, its return branch restocks at
  the original issue's own `unit_cost`.
- `src/lib/erp/salesFulfillment.ts` — `deliverSalesOrder` uses
  `costOfIssuing` instead of the static `inv_products.cost`.
- `src/lib/erp/purchasingData.ts` — `receiveDocument`/`stockPurchaseInvoice`
  now also update `inv_products.last_cost` (informational only).
- `src/lib/erp/inventoryData.ts` — new `totalInventoryValue`,
  `inventoryGlReconciliation`.
- `src/lib/erp/salesData.ts` — new `autoIssueDirectInvoiceStock`,
  `directInvoiceStockLines`, `restockSalesReturn`.
- `src/app/api/admin/erp/sales/documents/route.ts` — invoice confirm now
  dispatches on `invoice_stock_mode`; credit_note confirm now also calls
  `restockSalesReturn`.
- `src/lib/health/selfheal.ts` / `selfhealData.ts` — new
  `inventory_gl_drift` check (non-auto-fixable, warning).
- `src/lib/reports/reportData.ts` — new `inventory_gl_reconciliation`
  report.
- `src/lib/errors/codes.ts` / `catalog.ts` — two new codes.
- `src/lib/db/migrate.ts` — `inv_products.last_cost` column;
  `erp_settings.invoice_stock_mode='warn'` seed.
- `deploy/postgres/rollback-erpfix-6.sql` — new.
- `scripts/verify-erpfix-6.ts` — new, 25/25 live assertions.
- `scripts/ci-regressions.ts` — registered.
- `scripts/gl-writes-audit.mjs` — allowlist line-number re-sync (pure
  line-shift from this phase's own edits to `purchasingData.ts`/
  `salesData.ts`, no behavior change).
- `src/lib/erp/__tests__/inventory.test.ts`,
  `src/lib/health/__tests__/selfheal.test.ts` — new/updated unit tests.
- `CLAUDE.md` (rule 61).

## Contract changes (`docs/governance/contract-changes.md`)

One regression-suite assertion was edited — logged as **CC-013**:
- **Old assertion**: `HEAL_CHECKS` has exactly 14 entries.
- **New assertion**: `HEAL_CHECKS` has exactly 15 entries (the new
  `inventory_gl_drift` check).
- **What is no longer guaranteed**: nothing financial — the registry's own
  size, same class of edit as CC-011.
- **Reason**: ERPFIX-6 (BUG-ERP-12) added the inventory↔GL drift
  visibility check the master prompt's own `audit_first`/`required_changes`
  asked for.
- **Approver**: maintainer (via this phase's own master prompt global_rule).

## New findings

### Fixed in this phase
- `createSalesReturn` never restocking inventory — found during this
  phase's own `audit_first` step exactly as the master prompt anticipated
  ("نتیجه را در گزارش بنویس… اگر برنمی‌گرداند … رفع کن") — confirmed,
  decision_gate answered, fixed (`restockSalesReturn`).
- `gl-writes-audit.mjs`'s allowlist line numbers for `purchasingData.ts`/
  `salesData.ts` had drifted from this phase's own edits — re-synced.

### Finding-for-later (out of this phase's scope — logged, not fixed)
- A sales return does not reverse the ORIGINAL sale's COGS entry (the
  purchase-side equivalent, `advanceShipment`'s return branch, DOES reverse
  its COGS GL entry — but a credit_note's own `postSalesInvoiceToGl` only
  posts AR/Revenue/VAT, never a COGS reversal). This phase's decision_gate
  only asked about the PHYSICAL restock (answered, built); a GL-level COGS
  reversal on a sales return is a related but distinct gap, worth its own
  decision_gate in a future phase (should a sales return book Dr Inventory
  / Cr COGS the same way the shipment-return path already does?).
- `src/lib/erp/accountingCore.ts#periodForDate`'s span-based tie-break
  (already logged in `erpfix-5-report.md`) remains unfixed — out of this
  phase's scope too.

## Confirmations needed from the maintainer/accountant

1. **No new accounts were seeded this phase** (COGS still 5000, inventory
   still 1200 — both already accountant-reviewed from earlier phases). No
   new sign-off needed on chart-of-accounts codes.
2. **The sales-return COGS-reversal gap** noted above — confirm whether a
   future phase should add it (mirroring the shipment-return path), and
   whether the accounting policy is "reverse the exact original COGS" or
   "re-cost at the CURRENT valuation" (these can differ if other issues
   happened between the sale and the return).
3. **`invoice_stock_mode` default of `warn`**: confirm this is the
   intended steady-state default for your operation, or whether it should
   move to `auto_issue`/`require_delivery` once operators are trained on
   the new behavior.

## Gates

- `npx tsc --noEmit -p .` — 0 errors.
- `npm run lint` — 0 warnings/errors.
- `npx vitest run` — 1376 tests passed (112 files).
- `npm run build` — succeeded.
- `npm run audit` — all 14 gates clean (including the re-synced
  `gl-writes` allowlist).
- `npm run regressions` — see this phase's final push message for the
  live run's pass count; `verify-erpfix-6.ts` itself is 25/25 and is now
  permanently part of the suite.
