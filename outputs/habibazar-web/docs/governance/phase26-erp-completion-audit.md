# Phase 26.0 — ERP Completion Audit & Architecture Review

Code-verified audit (greps against `src/lib/erp`, `src/lib/db/migrate.ts`, the
`/api/admin/erp/*` routes and the admin UI) mapping the Phase-26 mandate against
what actually exists. Per the no-duplication rule, everything marked ✅ is
**reused as-is**; only ❌ items are built in the completion passes.

## Module inventory (existing, verified)

| Module | Engine (pure, tested) | Data layer | API | UI | Status |
|---|---|---|---|---|---|
| Finance / GL (double-entry) | `ledger.ts` (8+) | `ledgerData.ts` | `finance/{accounts,journal,reports,overview}` | Finance Center | ✅ |
| Currency (IRR/IRT/FX) | `currency.ts` (9) | `currencyData.ts` | `finance/currency` | Currency tab | ✅ |
| Tax (VAT/WHT/groups) | `tax.ts` (4) | — (pure) | used by engines | — | ✅ |
| Banking (recon/cheque/petty) | `banking.ts` (6) | `bankingData.ts` | `finance/banking` | Banking tab | ✅ |
| Multi-company GL | `consolidateTallies` | `loadTallies(companyId?)` | reports `?company=` | scope selector | ✅ |
| AI Financial Assistant | `financeAi.ts` (2) | snapshot in route | `finance/ai` | Dashboard card | ✅ |
| Sales (quote→order→invoice→payment) | `sales.ts` (7) | `salesData.ts` | `sales/*` | Sales Center | ✅ |
| Purchasing (8 doc types, approvals, GL-post) | `purchasing.ts` (13) | `purchasingData.ts` | `purchasing` | Purchasing Center | ✅ |
| Vendor Portal | — | `vendorPortal.ts` | portal actions | public token page | ✅ |
| Inventory (FIFO/LIFO/WAVG) | `inventory.ts` | `inventoryData.ts` | `inventory/*` | Inventory Center | ✅ |
| Assets (depreciation/lifecycle) | `depreciation.ts`, `assets.ts` | `assetData.ts` | `assets/*` | Asset Center | ✅ |
| Projects + Costing (EVM) | `projects.ts`, `costing.ts` | `projectData.ts`, `costingData.ts` | `projects/*` | Project Center | ✅ |
| Document Engine (10 types, QR, branding, designer) | `documents.ts` | `documentData.ts` | `documents/*` | Document Center | ✅ |
| Company Profile branding | — | `loadCompanyProfile` | settings | `/admin/company` | ✅ |
| Reporting (9 reports) | `pivot.ts` | `reportData.ts` | `reports` | Reporting Center | ✅ |
| Numbering Engine | `format.ts` (9) | `service.ts` | `numbering/*` | Numbering Center | ✅ |

Security posture (verified): every ERP route goes through `requireAdmin` (RBAC),
zod (`readJson`) on new routes + `guardJson` structural guard on legacy CMS
routes, audit logging on every mutation, generic error bodies (no `e.message`).

## Gaps found (code-verified ❌ → built in completion passes)

### 26.1 Purchasing
- ❌ `purchase_documents.priority` does not exist (PR priority).
- ❌ `validateBudget` engine exists but is **not wired** into submit — over-budget
  PRs sail through.
- ❌ GRN does **not** touch inventory: `purchasingData.ts` has zero references to
  `inv_moves`; receipt lines have no `product_id`/`received_qty` → no warehouse
  update, no partial receive.
- ❌ RFQ → multi-vendor quotation comparison view (quotes exist + `source_id`
  linkage exists; no comparison endpoint/UI).

### 26.2 Invoice & Document Designer
- ❌ `sales_customers` has no `kind` (حقیقی/حقوقی) and no `national_id` /
  `reg_no` / `economic_code` — invoices cannot carry the mandated party fields.
- ❌ No **email** export of documents (SMTP/nodemailer exists in the platform but
  documents cannot be emailed).
- ❌ No **barcode** element (QR exists; barcode does not).
- ✅ Everything else in 26.2 (branding, templates, watermark/seal/signature/QR,
  live-preview designer, PDF-via-print) already exists.

### 26.3 Treasury
- ❌ Bank **balance** is not computed anywhere (accounts list has opening balance
  only).
- ❌ No **cash-flow dashboard** (monthly in/out, forecast).
- ✅ Accounts, statement import, auto-reconciliation, cheques, petty cash exist.

### 26.4 Sales
- ❌ Sales **targets**, **commission**, **forecast** — none exist.
- ❌ Per-customer **statement** (ledger of invoices + payments) has no endpoint/UI
  (aggregates exist).
- ✅ Cycle (CRM lead → quote → order → invoice → payment), credit limit,
  line discounts, delivery note (document engine) exist.

### 26.5 Multi-company & Branch
- ❌ `erp_companies` carries no **legal identity** (reg/national/economic/tax/
  address) — companies are code+name only.
- ❌ **Intercompany** transfer/entries/settlement do not exist (no Due-From /
  Due-To accounts, no paired entries).
- ✅ Multi-company GL + consolidation exist. Branch primitives exist by reuse:
  `numbering_scopes` (company/branch/warehouse registry), `inv_warehouses`,
  `users.department` + RBAC — no duplicate "branches" table is built.

### 26.6 AI Financial Assistant
- ❌ Anomaly scan covers journal entries only — **payments** (abnormal/duplicate
  payment detection) are not scanned.
- ❌ Forecast prompt is grounded on totals but carries no **deterministic
  forecast series** (sales/expense/cash trends) in the snapshot.
- ✅ Grounded chat, summary/explanation/recommendation, duplicate-entry +
  outlier detection exist.

## Database / API / UI gap summary

- DB: `purchase_documents.priority`, `purchase_document_lines.product_id` +
  `received_qty`, `sales_customers.kind/national_id/reg_no/economic_code`,
  `erp_companies` legal columns, `sales_targets` table, GL accounts `1150/2150`
  (intercompany) — all as idempotent migrations with indexes/FKs.
- API: `doc.receive` (GRN→inventory), `?compare=` (RFQ quotes),
  `documents/email`, banking `?view=cashflow`, `sales/performance`,
  customers `?statement=`, `intercompany.transfer`.
- UI: priority select + budget block, receive dialog, compare modal, customer
  legal fields, Email action, Cash-flow section, Performance section, statement
  modal, company legal fields.

Everything above ships bilingual (fa/en), RBAC-gated, audited, unit-tested and
live-PostgreSQL-verified in passes 26.1–26.6; the final report is
`docs/governance/phase26-enterprise-erp-completion-report.md`.
