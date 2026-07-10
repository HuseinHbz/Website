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

### GL auto-posting (continuation — double-entry integration)

Purchase invoices now post into the existing double-entry GL (reusing the Finance
module — no duplication). Pure `purchaseInvoicePostingLines(net, tax, total)` →
**Dr Inventory (1200) + Dr Taxes Payable (2100, VAT input) / Cr Accounts Payable
(2000)**, always balanced (`postingBalanced`); `purchasePaymentPostingLines` →
Dr AP / Cr Bank. Data layer `postPurchaseInvoiceToGl(docId)` resolves accounts by
code, writes a **posted** `gl_journal_entry` + lines, links `purchase_documents.
gl_entry_id`, and is **idempotent** (re-post returns the same entry). API
`doc.post` action is **administrator-gated** + audited; UI shows a "Post to GL"
row action on confirmed invoices and a GL badge once posted. Unit-tested (balanced
postings, VAT omitted at 0 tax) + live PG round-trip (invoice 1090 → entry
balances, AP credited 1090, Inventory 1000; second post idempotent).

### Purchase Analytics (continuation)

An **Analytics** tab on the Purchasing Center, on real data. Pure aggregation
`purchaseAnalytics(rows, months)` in `purchasing.ts` (unit-tested): **committed
spend** per month (orders + invoices, draft/void/rejected excluded), spend by
document type, top-8 vendors by spend, and document-count by status. Data layer
`analytics()` runs one query and feeds the engine; API `?view=analytics`
(RBAC-gated). UI: `PurchasingCharts.tsx` (recharts, standalone module loaded via
`next/dynamic` so the chart chunk only loads when the tab renders — the
`/admin/purchasing` page stays at 172 kB First Load) with a monthly-spend area
chart + top-vendor bar chart, plus spend-by-type and status-distribution cards.
Bilingual; token palette (`BRAND`/`chartColor`). Verified vs real PostgreSQL
(confirmed order + paid invoice aggregate; a draft order is excluded from spend
but counted in the status distribution).

## Honest scope note

Delivered for real: vendors, all 8 purchase document types (unified header),
multi-level approval workflow + budget validation, vendor evaluation/rating,
contracts schema, payments, PR→PO→GRN→invoice conversion, dashboard, numbering +
audit, **GL auto-posting** of purchase invoices, and **purchase analytics**
(charts on real data). **Deferred** (documented, not faked): a public **Vendor
Portal** — an external-facing auth surface that is a standalone build.

## Preserved (zero regression)

✓ All existing ERP modules · ✓ PostgreSQL-native · ✓ RBAC + audit on every write ·
✓ bilingual (fa/en) · ✓ numbering + currency/tax engines reused, not duplicated.
