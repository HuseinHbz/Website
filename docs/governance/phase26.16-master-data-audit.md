# Phase 26.16 — Master Data Audit (PART 0)

Audit-first review of the ERP master-data foundation before writing any code, in
six hats (CFO · Controller · External Auditor · Procurement · Warehouse ·
Architect). Legend: ✓ already implemented · ❌ real gap · ⚠ exists but incomplete.

## Customer master (`sales_customers`)
- ✓ Party identity `kind` (حقیقی/حقوقی), `national_id`, `reg_no`, `economic_code`
  (26.2/26.9), `code` (unique), `email`, `phone`, `tax_id`, `credit_limit`,
  `active`, soft-delete (26.7). Multi-currency on documents; customer statement +
  360-ish ledger (26.4/26.9). CRUD API + DataTable UI.
- ⚠ Extended individual fields (first/last name, birth date, gender, province,
  city, postal code, customer group/type, per-customer default currency, bank
  account, board members) are **not** discrete columns — recorded as an honest
  boundary; the core financial + legal identity a CFO/auditor needs exists.

## Supplier master (`purchase_vendors`)
- ✓ `kind` (individual/company/international), `national_id`(tax_id), `economic_code`,
  `iban`, `currency`, `payment_terms`, categories, contracts, **evaluation scoring
  engine** (`vendorScore` weighted 0–100 → A/B/C/D, 26.1). CRUD + eval UI.

## Product master (`inv_products`)
- ✓ SKU (unique), barcode, name_en/name_fa, category (TEXT), unit, cost, price,
  valuation (FIFO/LIFO/WAVG), reorder point, min/max/safety, lot/serial flags,
  opening stock (26.10), server-limited search picker (26.15).
- ❌ **No default-supplier link** — PART 3 “Default Supplier” + PART 7 “product
  without supplier” need `inv_products.default_supplier_id`. **→ gap to build.**
- ⚠ Category is a free-text column, not a tree (`category`); a drag-drop tree
  builder (PART 4) is a larger UI feature — honest boundary this pass.

## Relations
- ✓ Sales→GL (26.15.1), Purchase→GL (26.1), GRN→inventory (`inv_moves`), numbering,
  audit trail (`logAction` user/date/IP/old/new), RBAC (`canDo`+`finance_role`).
- ✓ Global master search (`globalSearch.ts`, 13 sources incl. customers/vendors/
  products/documents, FA/EN partial ILIKE, 26.13) — PART 10 already shipped.
- ✓ Workflow + Approval engines (26.12) — PART 8 reuses them.
- ⚠ Generic **data-quality** COUNT checks + one overall score exist in BI
  (`bi/dataQuality`, 26.13) — but only aggregate missing-field counts.

## Verified gaps this phase will build (PARTS 5/6/7 + 3-field)
1. ❌ **Duplicate Detection Engine** — surfaces the actual duplicate *record
   groups* by identity keys (customer national_id/phone/email; supplier
   economic_code/tax_id; product sku/barcode) with member ids/labels — distinct
   from BI’s aggregate count — plus a safe, administrator-gated **customer merge**.
2. ❌ **Relation Integrity Engine** — cross-module referential/business checks
   (product with no warehouse stock, product without supplier, invalid category,
   orphan invoice/purchase, stock in a missing warehouse) → error/warning/
   recommendation. Distinct from anything existing.
3. ❌ **Master-Data Governance score per domain** (customers/suppliers/products
   completeness %) — a per-domain rollup, not one blended BI score.
4. ❌ **`inv_products.default_supplier_id`** (schema + product field + UI).

Everything else (customer/supplier/product masters, evaluation, search, workflow,
approval, reporting, RBAC, audit) is **reused, not rebuilt**, per the mandate.
