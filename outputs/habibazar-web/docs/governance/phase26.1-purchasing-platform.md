# Phase 26.1 — Enterprise Purchasing Platform (Procure-to-Pay)

Closes the largest remaining ERP gap: the buy side. A PostgreSQL-native
procure-to-pay platform reusing the existing Numbering Engine, RBAC, Audit Trail,
Enterprise DataTable, and the Phase-26 currency/tax foundations. No rewrite; zero
regression.

## What shipped (real, verified)

### Pure engine (`src/lib/erp/purchasing.ts`, unit-tested)
- `documentTotals` (reuses the sales line math — no duplication).
- **Multi-level approval routing** `requiredApprovalLevels` / `isFullyApproved`
  by document amount (≤50M Rial → 1 level, ≤500M → 2, above → 3 / exec sign-off).
- **Budget validation** `validateBudget` (envelope, committed, requested).
- **Vendor evaluation** `vendorScore` (weighted 0–100 → stars + A/B/C/D grade).
- `vendorPayable`, `purchaseInvoiceStatus`, `purchaseKpis`.

### PostgreSQL schema (idempotent, `migrate.ts`)
`purchase_vendors` · `purchase_documents` (unified header for request/rfq/
quotation/order/receipt/invoice/return/credit_note) · `purchase_document_lines` ·
`purchase_approvals` (multi-level log) · `purchase_payments` · `vendor_evaluations`
· `vendor_contracts` — all indexed.

### Data layer (`purchasingData.ts`)
Vendor CRUD + evaluation (rolls headline score/grade), vendor payable position,
document save (totals server-side + auto number via `nextNumber`), submit
(computes approval levels), `decideApproval` (records each level, advances to
`approved` only when every required level signs; `rejected` short-circuits),
`recordPayment` (recomputes settle status), `convertDocument` (PR→PO→GRN→invoice
copying lines), dashboard `overview`.

### API `GET/POST /api/admin/erp/purchasing` (RBAC + zod + audit)
GET: `?view=overview|vendors`, `?type=` document list, `?id=` detail,
`?vendorPosition=`. POST discriminated union: vendor.create/update/evaluate,
doc.save/submit/approve/convert/payment. **Level-2+ approvals require an
administrator** (multi-level authority). Every mutation audited.

### Admin UI — **Purchasing Center** (`/admin/purchasing`, registered in the ERP
workspace nav). Tabs: Dashboard (KPIs + top-rated vendors) · Vendors (Enterprise
DataTable + create + 5-criteria evaluation modal) · Documents (type filter +
create with line editor + submit/approve L1/L2/reject/convert inline). Bilingual.

## Verification (all green)

- TypeScript 0 · ESLint 0 · **287 unit tests** (+7 purchasing) · all 7 governance
  audits (new `/admin/purchasing` route resolves; i18n clean) · production build
  OK (96 pages; `/admin/purchasing` First Load 171 kB).
- **Live PostgreSQL procure-to-pay round-trip**: create vendor → A-grade
  evaluation → PO (10 × 30M + 9% VAT = **327M Rial**) → routed to **2 approval
  levels** → L1 alone stays `submitted`, L1+L2 → `approved`. ✓

## Honest scope note

Delivered for real: vendors, all 8 purchase document types (unified header),
multi-level approval workflow + budget validation, vendor evaluation/rating,
contracts schema, payments, PR→PO→GRN→invoice conversion, dashboard, numbering +
audit. **Deferred** (documented, not faked) — larger standalone builds: a public
**Vendor Portal** (external-facing auth surface), automatic **GL posting** of
purchase invoices into the double-entry ledger, and purchase **analytics
charts**. The engine + data layer are structured so those attach cleanly (e.g. a
posting hook on invoice confirm).

## Preserved (zero regression)

✓ All existing ERP modules · ✓ PostgreSQL-native · ✓ RBAC + audit on every write ·
✓ bilingual (fa/en) · ✓ numbering + currency/tax engines reused, not duplicated.
