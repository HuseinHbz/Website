# Phase 26.16 — Enterprise Master Data & Operational Excellence (Completion Report)

Audit-first master-data phase (six hats: CFO · Controller · External Auditor ·
Procurement · Warehouse · Architect). Per the mandate — *audit first, reuse the
existing customer/supplier/inventory/sales/purchase/accounting/tax/currency/
workflow/approval/audit/RBAC/reporting engines, build ONLY verified gaps, no fake
UI* — this pass built a real **Master-Data Governance** layer over the existing
tables and closed the one product-master field gap.

## 1. Audit result (see `phase26.16-master-data-audit.md`)
The customer (`sales_customers` + party حقیقی/حقوقی + national/economic/reg codes),
supplier (`purchase_vendors` + evaluation A/B/C/D), and product (`inv_products`)
masters, global master search, workflow, approval, reporting, RBAC and audit trail
already ship (26.1–26.15). Verified gaps: **no per-record duplicate detection, no
cross-module relation-integrity engine, no per-domain master-data score, and no
product default-supplier link.**

## 2. Existing modules reused (not rebuilt)
Customer/Supplier/Product masters · vendor evaluation `vendorScore` · Global Search
(`globalSearch`, PART 10) · Workflow + Approval engines (PART 8) · Reporting Center
(PART 11) · `logAction` audit (user/date/IP/old/new) · `canDo`+`finance_role` RBAC
· BI data-quality COUNTs (`bi/dataQuality`) — kept; master-data governance is
**complementary**, not a duplicate.

## 3. New capability (the verified gap)
**Master-Data Governance** — pure engine `src/lib/masterdata/quality.ts` +
data layer `masterDataData.ts` + admin page `/admin/master-data`:
- **Completeness score per domain** (customers/suppliers/products): required-field
  coverage → 0–100 + grade (excellent/good/fair/poor). Reuses no BI code.
- **Duplicate Detection** (PART 5): per-record groups by identity key — customer
  national_id/phone/email, supplier economic_code/tax_id, product sku/barcode
  (active records only; archived/merged duplicates drop out). Returns member
  ids+labels so an admin can act — distinct from BI’s aggregate count.
- **Relation Integrity** (PART 7): 8 cross-module business checks FKs don’t enforce
  — product with no warehouse stock, product without / dangling default supplier,
  product without a real category, customer over credit limit, inactive customer
  with an open balance, company customer with invoices but no tax identity,
  purchase document without a supplier → error/warning/recommendation + score.
- **Customer merge** (PART 1/5): safe, transactional repoint of the financial
  children (`sales_documents`, `sales_payments`) onto the primary, then archive
  the duplicate (`active=0`, kept for audit). Administrator-only, audited.

## 4. Database changes
- `ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS default_supplier_id INTEGER;`
  (idempotent; enables PART 3 “Default Supplier” + the product-supplier integrity
  check). No new master tables — reuses `sales_customers`/`purchase_vendors`/
  `inv_products`/`sales_documents`/`sales_payments`/`inv_moves`.

## 5. API changes
- `GET /api/admin/erp/master-data?view=overview|duplicates|integrity` (RBAC).
- `POST /api/admin/erp/master-data` `{action:'merge',primaryId,duplicateId}` —
  administrator-gated, zod-validated, audited (`masterdata.customer.merge`, IP).
- `POST/PUT /api/admin/erp/inventory/products` gained `defaultSupplierId`.

## 6. UI changes
- New **Master Data Governance** module (ERP → Documents & Reports) with three
  bilingual RTL/EN tabs on the Enterprise DataTable: **Overview** (overall +
  per-domain score cards with field-coverage bars + duplicate/integrity tiles),
  **Duplicates** (groups + admin Merge action), **Relation integrity** (severity
  badges + affected counts + score). Registered in the workspace registry so it
  appears in the sidebar, switcher, home grid and command palette.

## 7. Security changes
- Read views require an admin session; the merge write requires
  administrator/super_admin and is audited with old→new values + client IP.
  RBAC + `finance_role` reused, no new role system.

## 8. Workflow changes
- None built — PART 8 approval workflows (New Customer / Supplier / Product) reuse
  the existing Approval + Workflow engines (26.12); no duplicate executor added.

## 9. Test results
- **Unit: 20 new cases** (`masterdata/quality.test.ts`) — scorePct/grade/
  domainQuality/overallScore/normalizeKey/duplicateGroups/duplicateBurden/
  integritySummary. Full suite **503 pass**.
- **Live PostgreSQL: 16/16 assertions** — 3-domain scoring, national_id + barcode
  duplicate groups, 8 integrity checks (no-stock, dangling supplier, etc.), and
  the customer merge (1 invoice + 1 payment repointed, duplicate archived,
  national_id duplicate resolved after merge).
- TypeScript 0 · ESLint 0 · 7 governance audits 0 (broken links 0) · build clean.

## 10. Known limitations (honest, not faked)
- Extended individual-customer fields (birth date/gender/province/city/postal/
  group/type) and a **drag-drop category tree** (PART 4) are larger master-UI
  features not built this pass — recorded, not stubbed. Category stays a
  free-text field; the tree builder is a future phase.
- **Alternative suppliers** M2M was not added — only the single default-supplier
  link (the minimal verified gap enabling PART 3 + the integrity check).
- Merge is implemented for **customers** (financial children repointed); supplier/
  product merge is detection-only for now (safer — those touch inventory ledgers).
- Nine dedicated business roles (Sales/Purchase/Warehouse Manager, Auditor,
  Viewer) remain mapped onto the 3 core roles × `finance_role`, not new DB roles.

---
**Final gates:** TypeScript 0 · ESLint 0 · 503 unit tests pass · production build
successful · live PostgreSQL verification successful · no duplicate engines · no
fake implementations.

**Phase 26.16 — Enterprise Master Data & Operational Excellence Complete.**
