# Phase 26.21 — Enterprise Full Company Simulation · ERP Quality Report

A complete two-year company operation executed against the **real** module data
layers on live PostgreSQL 16 (ephemeral DB, deterministic seed, 45/45
assertions). Nothing was mocked: every transaction passed through the module
that owns it — numbering, approval tiers, GRN→inventory, GL posting, treasury,
imports, master data, self-heal.

## What was operated (24 months, 2024-01 → 2025-12)
- **Company setup**: 3 fiscal years (FY2024/25/26), standard chart + opening
  balance (7B = 7B, normal-side), 2 bank accounts + petty-cash float, 8
  evaluated suppliers, 13 customers (one deliberate duplicate identity),
  16 products / 4 categories, 3 warehouses, opening stock as real receipt
  moves, IMEI-checked serials + an expiring batch, 2 depreciable assets.
- **Dynamics**: Q4 seasonality ×1.35, +2 %/mo growth, +1.2 %/mo price
  inflation, USD climbing 500k→~740k Rial with monthly noise (rates set via
  the currency engine each month).
- **Sales** — 92 invoices: quote→order→invoice→confirm→**GL post on the
  document date**→collection (70 % full, 15 % partial/late, 15 % aging pool),
  monthly shipment lifecycle (reserve→pick→pack→ship→deliver), 5 customer
  returns → GL-reversing credit notes, an advance payment, a bad-debt
  write-off (36.3M: Dr expense / Cr AR).
- **Purchasing** — 24 procure-to-pay cycles: PR (budget-checked submit) →
  amount-tiered approvals → PO → GRN (**partial then final receipt**, real
  `inv_moves`) → invoice → GL → partial + final payments. Exception paths: a
  rejected approval, a voided PO, an RFQ with 3 quotations ranked
  cheapest-first.
- **Warehouse** — quarterly cycle counts (shrinkage → posted `count`
  adjustment + balanced GL), damage holds consumed, negative-stock attempt
  **rejected** by the availability guard, WAVG valuation reconciled against
  the move ledger.
- **Finance/Treasury** — monthly payroll + straight-line depreciation
  journals (period-gated), quarterly FX revaluation runs, bank-statement
  import + auto-match every month, cheque lifecycle, petty-cash expenses,
  year-end closings.
- **Imports** — legacy CSV: validate (Persian digits cleansed) → approve →
  execute (3 customers) → **full rollback restored the DB**.
- **Master data** — duplicate identity detected (national_id), customer merge
  repointed children + archived the duplicate, 3-domain quality scoring.
- **Reports** — the entire 25-report catalog executed; ABC/XYZ/dead-stock/
  aging intelligence; treasury cash-flow; Health Center assembly.
- **Stress** — 100 000 additional stock moves: insert 1.3 s, on-hand
  aggregate 15 ms, stock intelligence 262 ms, trial balance 2 ms.

## 🐛 Bug discovered and fixed (the point of the exercise)
**Severity: HIGH — accounting period misattribution.**
`postSalesInvoiceToGl` and `postPurchaseInvoiceToGl` dated every journal
entry `to_char(now(),'YYYY-MM-DD')` instead of the **document date**. Every
backdated/imported/self-healed invoice posted into the *current* period, so:
- FY2024/FY2025 year-end closings swept **zero revenue** (both years closed
  at a loss equal to payroll+depreciation only);
- 6.98B of revenue sat stranded in the post-closing income statement;
- period-bounded reports (income statement, VAT, closing) were all wrong for
  any document not posted on its own calendar day.

**Fix** (`src/lib/erp/salesData.ts` + `src/lib/erp/purchasingData.ts`): the
GL entry now carries the source document's date, is `assertPostable`-gated
(closed/locked periods refuse the posting — the fiscal-period lock now truly
covers auto-posting and self-heal), and records `period_id`. No schema change.
**Regression proof**: re-run FY2024 closed at **+1 180 866 213** and FY2025 at
**+1 704 820 170**, post-closing stranded revenue **0**, trial balance
Dr = Cr = 17 574 509 347.34, ledger integrity 100/100, the 26.20 self-heal E2E
(28/28) and all 645 unit tests still pass.

Root cause: the posting helpers were written in 26.15.1/26.1 when documents
were always posted same-day; the 24-month simulation was the first flow that
backdated at scale. Detection credit: the year-end-closing reconciliation
assertion (CFO stage), exactly as designed.

## Quality gates after the fix
TypeScript 0 · ESLint 0 · 645 unit tests · 7 governance audits 0 · production
build clean · live-PG simulation 45/45 · 26.20 regression 28/28.

## Honest boundaries (documented, not faked)
HR payroll/leave/loans and manufacturing remain roadmap modules — payroll and
depreciation were booked as real balanced journals (the controller's path),
not through a faked HR module. Volumes ran at CI scale (92 invoices/24 PO
cycles + a 100k-row stress stage) — every FLOW is real and reconciled;
seeding 5 000 literal documents adds load, not coverage. Word/`.docx` export
remains out (no heavy dependency); documents export print-HTML→PDF + CSV/
Excel-XML as before.
