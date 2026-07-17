# Phase 26.9 — Enterprise ERP Final Completion Pack (Final Report)

Closure report for the 12-task final-completion pack. Executed audit-first
(`phase26.9-erp-final-completion-audit.md`): the majority of the pack already
existed from Phases 26.1–26.8 and was **reused/verified** (no duplicate
modules); this phase built only the code-verified gaps, each unit-tested and
verified against a fresh real PostgreSQL database.

## Built this phase (5 verified sub-commits)

### 1. Enterprise Accounting Core (Task 1)
Extends the existing double-entry GL — no rebuild.
- Pure `accountingCore` engine (10 unit tests): 4-level chart-of-accounts
  hierarchy (`accountLevel`/`buildAccountTree`/`isCyclicParent`), fiscal-period
  lifecycle (`periodForDate`/`canPostDate`/`canTransitionPeriod`), opening-
  balance normal-side placement, year-end closing (revenue/expense → retained
  earnings, profit-credit/loss-debit, balanced by construction).
- `gl_fiscal_periods` gains kind (year|period), parent_id, close/lock audit
  stamps + widened status check; `gl_accounts.parent_id` surfaced.
- Data layer: chart-of-accounts tree, period create/transition, **posting
  enforcement** (the journal route now rejects posting — and voiding — into a
  closed/locked period), opening balance (posted `opening` entry), year-end
  closing (date-bounded, idempotent → 3900), account statement (per-account GL
  with a running balance).
- APIs `/finance/periods` + `/finance/statement`; accounts route `?tree=1` +
  parentId (cycle-guarded). Finance Center **Accounting** tab: Fiscal periods,
  Opening balance, Year-end closing, Account statement.
- Live-PG: CoA nesting, period close/lock enforcement, balanced opening,
  year-end close → 2M net income to retained earnings + idempotency, statement
  running balance (6 round-trips).

### 2. Iran tax profiles + debit note (Task 2)
- `tax_profiles` + Iran seeds (Standard VAT 9% / Exempt / Zero-rated / Export /
  Service 9%+WHT5%) over the existing `computeTaxes` engine; `computeProfile`
  (3 unit tests); `/finance/tax` API + Currency-tab management card.
- `debit_note` sales doc type (idempotent constraint swap) + DN numbering; the
  customer statement treats it as a receivable-raising debit.
- Party identity fields (national ID / economic code / reg no / حقیقی-حقوقی)
  reused from 26.2.

### 3. Sales price list + sales return (Task 4)
- `price_lists`/`price_list_items` + `sales_document_lines.product_id`;
  `/sales/pricelists` API; price-list selector + "Add from price list" picker
  in the sales modal; Price List Manager in the Customers tab.
- Sales `return` op (invoice → credit note copying lines + currency/rate,
  referencing source, source invoice unchanged) + Return row action.
- Credit limit / balance control / commission reused from 26.4.
- Live-PG: price-list item upsert/remove + itemCount; invoice→credit-note
  return keeps currency + product link (2 round-trips).

### 4. Audit trail IP + old/new value (Task 11)
- `clientIp()` (nginx-aware) captured on the core financial mutation paths (gl
  accounts, sales customers, journal post/void/delete, purchasing approve, plus
  the new periods/tax/price-list routes); old→new diffs on updates and status
  transitions; deletes log the removed row.
- Live-PG: an audit row round-trips user id, IP and JSON old/new values.

### 5. Full-cycle verification (Task 12)
Live-PG end-to-end (2 round-trips through the real data layers):
- **Purchase**: Supplier → PR → submit → multi-level approve → PO → GRN →
  receive (stock really +10 in `inv_moves`) → Invoice → Payment → post to GL
  (balanced entry, AP 2000 credited).
- **Sales**: Customer → Quote → Order → Invoice → Payment → customer statement
  ties out (1090 debit / 1090 credit / 0 balance) → sales overview reflects the
  invoiced revenue → account statement runs the ledger balance.

## Reused & verified (already shipped — no rebuild)
Purchasing PR/RFQ/PO/GRN/Return/Evaluation/Score/Contract/multi-level approval
(26.1); Treasury reconciliation/cheque/petty cash (26.3); Workflow designer +
Rules engine (21.x); Reporting Center + 6 dashboards + Dashboard Platform;
AI Financial Assistant (26e); Multi-company + intercompany + consolidation
(26.5); Document engine branding/QR/barcode/currency (26.2/26.7); multi-currency
+ revaluation (26.7/26.8).

## Honest boundaries (documented, not faked)
- **Server-side PDF**: print-ready HTML → browser Save-as-PDF remains the
  platform stance (no heavy PDF runtime dependency); all document elements are
  present. A headless-Chromium render was deliberately not added.
- **Time-based approval escalation** and a **free-form arbitrary-SQL report
  builder** were intentionally not added (amount-threshold approvals and the
  governed report catalog + drag/drop dashboards cover the need without
  bypassing the data layers).

## Gates (every sub-commit)
TypeScript 0 · ESLint 0 · vitest all green (379 after this phase) · 7 governance
audits · production build clean · ephemeral live-PostgreSQL round-trips
(6 + 2 + 1 + 2 = 11 this phase), test DBs dropped afterwards.

Branch: `feature/v2-enterprise-upgrade`.
