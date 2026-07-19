# Phase 21 ERP — Module 2: Enterprise Sales (completed)

Fourth complete ERP module (Inventory → Assets → Financial → **Sales**). Real,
verified — the full quote-to-cash flow with customer credit.

## Shipped & verified

- **Sales engine** (`src/lib/erp/sales.ts`, pure, 7 unit tests): `lineTotals`
  (net = qty×price, then a per-line discount %, then tax % on the discounted net),
  `documentTotals` (subtotal/discount/tax/total), `customerCredit`
  (outstanding = invoiced − paid − credit notes; available; over-limit;
  utilization %), `invoiceStatus` (sent/partial/paid), `salesKpis`.
- **Data model** (PostgreSQL): `sales_customers` (code, contact, tax id, credit
  limit), `sales_documents` — one unified header for **quote / order / invoice /
  credit_note** (status draft→sent→confirmed→partial→paid→void, with a
  `source_id` linking a converted document to its origin), `sales_document_lines`
  (qty, unit price, discount %, tax %, line total), `sales_payments` (applied to
  invoices; method cash/bank/card/cheque/other).
- **Server layer** (`src/lib/erp/salesData.ts`): each customer's live credit
  position (invoiced/paid/credit-notes → outstanding/available/over-limit) and
  the dashboard KPIs — computed via the pure engine, one place.
- **APIs** `/api/admin/erp/sales/{customers,documents,payments,overview}`:
  customer CRUD with credit; document create with **server-computed totals**
  (client cannot spoof the total), quote→order and order→invoice **convert**
  (copies lines into a new draft referencing the source), send/confirm/void
  lifecycle; payments that **recompute the invoice's paid status** on receipt;
  dashboard aggregates. zod-validated, RBAC-gated, audit-logged.
- **UI** (`/admin/sales`, `SalesCenter`, fully bilingual FA/EN): tabbed Dashboard
  (8 KPI cards — customers/quotes/orders/won value/invoiced/collected/outstanding/
  tax — top customers, recent documents) · Customers (with live outstanding /
  available credit + over-limit badge) · Quotations · Sales Orders · Invoices
  (shared document editor with a **multi-line grid + live subtotal/discount/tax/
  total**, convert & void actions, and record-payment) · Payments ledger.

**Verified:** tsc 0 · ESLint 0 · vitest 117/117 (7 sales) · 6 governance audits
pass · build OK · **real PostgreSQL round-trip** — invoice $981 (10×$100 −10%
discount +9% tax), credit note $100, payment $400 → outstanding **$481**,
available credit **$9,519**, invoice status **partial**.

## Remaining ERP roadmap

Purchasing, Project Management, Project Costing, Document Generation Engine,
visual Workflow Designer, Business Rules Engine, Integration Hub, Reporting
Platform, Global Search — each built the same way (pure tested core → PostgreSQL
→ RBAC/zod API → bilingual UI → verified), one complete module at a time.
