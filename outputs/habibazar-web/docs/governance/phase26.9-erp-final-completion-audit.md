# Phase 26.9 — ERP Final Completion: Audit & Gap Map

Code-verified audit (greps against `src/lib/erp`, `src/lib/db/migrate.ts`, the
`/api/admin/erp/*` routes and the admin UI) mapping the 12-task
"Enterprise ERP Final Completion Pack" against what already exists. Per the
no-duplicate rule, everything ✅ was **reused/verified**; only ❌ items were
built (see the sub-commit reports and CLAUDE.md).

| Task | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Finance / GL / Ledger / Journal | ✅ reuse | Double-entry GL, trial balance, income statement, balance sheet |
| 1 | Chart of Accounts (4 levels) | ❌→built | `parent_id` existed but unused → hierarchy engine + CoA tree + cycle guard |
| 1 | Accounting period open/close/lock | ❌→built | `gl_fiscal_periods` existed but **unenforced** → lifecycle + posting rejection |
| 1 | Opening balance | ❌→built | `postOpeningBalance` (normal-side placement, balanced, posted 'opening' entry) |
| 1 | Year-end closing | ❌→built | `runYearEndClosing` → revenue/expense → retained earnings (3900), idempotent |
| 1 | Trial balance / GL / journal / statement / BS / P&L | ✅+❌ | statements existed; **Account statement (per-account GL)** added |
| 2 | Tax profile (VAT/WHT/exempt/category) | ❌→built | `tax_profiles` + management over the existing `computeTaxes` engine |
| 2 | Invoice party (national ID/economic/reg/حقیقی-حقوقی/VAT) | ✅ reuse | Shipped in 26.2 — audited, printed on documents |
| 2 | Sales/Purchase invoice · Credit note · **Debit note** | ✅+❌ | credit notes existed; **debit_note** doc type added (both ledgers) |
| 3 | PR · RFQ · PO · GRN · Return · Evaluation · Score · Contract · Approval | ✅ reuse | All shipped in 26.1 (multi-level approval, vendor_contracts, vendorScore) — verified |
| 4 | Sales return | ❌→built | invoice→credit-note `return` op (source untouched, product link carried) |
| 4 | Discount / Credit limit / Balance control / Commission | ✅ reuse | Line discounts + `customerCredit` + 26.4 commission — verified |
| 4 | **Price list** | ❌→built | `price_lists`/`price_list_items` + line product link + picker + manager |
| 5 | Bank reconciliation · Cheque · Petty cash | ✅ reuse | Shipped in 26.3/26c (`banking.ts` match, cheque state machine, petty cash) |
| 6 | Workflow designer · rules · approvals | ✅ reuse | Workflow engine + visual canvas + Rules engine + purchase approval levels |
| 6 | Escalation | ⚠ partial | Amount-threshold approval levels exist; time-based escalation not wired (honest) |
| 7 | Report Builder / dashboards | ✅ reuse | Reporting Center (11 reports, pivot, CSV) + 6 dashboards + Dashboard Platform |
| 8 | AI Financial Assistant | ✅ reuse | 26e `financeAi` grounded chat + anomaly + payment-fraud + forecasts |
| 9 | Company group · branch · intercompany · consolidation | ✅ reuse | 26.5 `erp_companies` + intercompany 1150/2150 + `consolidateTallies` |
| 10 | Document engine (logo/sign/stamp/barcode/QR/currency) | ✅ reuse | 26.2/26.7 — all elements present; **server-side PDF = honest boundary** (below) |
| 11 | Audit trail (create/update/delete/approve/reject + user/IP/old/new) | ✅+❌ | infra existed; **IP + old→new wired** into the core financial mutation paths |
| 12 | Full-cycle verification | ❌→built | live-PG sales + purchase cycle round-trips |

## What was built (❌ items), by sub-commit
1. **Accounting Core** — periods lifecycle + enforcement, CoA hierarchy,
   opening balance, year-end closing, account statement. Pure engine (10 tests)
   + 6 live-PG round-trips.
2. **Tax profiles + debit note** — `tax_profiles` over the tax engine (3 tests),
   debit_note across both ledgers + customer statement.
3. **Price list + sales return** — catalogs + line product link + return op
   (2 live-PG round-trips).
4. **Audit trail completion** — IP + old/new on accounts/customers/journal/
   purchasing-approve (+ period lock on post/void); live-PG verified.
5. **Full-cycle verification** — this report + the final report.

## Honest boundaries (no fake)
- **Server-side PDF (Task 10)**: the platform deliberately renders print-ready
  HTML → browser "Save as PDF" (no heavy PDF runtime dependency — a standing
  architectural decision since Phase 21.5). All requested elements (logo,
  signature, stamp, QR, barcode, currency) are present on the HTML documents
  and survive Save-as-PDF. A true headless-Chromium server render was NOT added
  to avoid a heavy dependency the dependency audit forbids; documented rather
  than faked.
- **Escalation (Task 6)**: amount-threshold multi-level approval exists; a
  time-based escalation scheduler is not wired.
- **Report Builder drag-drop (Task 7)**: the Dashboard Platform provides
  drag/drop/resize widget dashboards + the Reporting Center's fixed,
  data-layer-backed catalog; a free-form arbitrary-SQL report builder was
  intentionally not added (it would bypass the governed data layers).

Everything above ships bilingual (fa/en), RBAC-gated, audited, unit-tested and
live-PostgreSQL-verified; the final report is
`docs/governance/phase26.9-final-completion-report.md`.
