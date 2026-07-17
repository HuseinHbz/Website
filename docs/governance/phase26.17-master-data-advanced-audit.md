# Phase 26.17 — Master Data Advanced Audit (Before Coding)

Audit-first review (MDM Expert · CFO · Data Governance Manager · ERP Architect ·
Software Auditor). Legend: ✅ already exists · ❌ missing gap · ⚠️ needs enhancement.

## Existing infrastructure to REUSE (do not duplicate)
- ✅ **Business Rules Engine** (`src/lib/rules/engine.ts` — `runRules`/`evalCondition`/
  `ruleMatches`, versioned `business_rules`, visual `RuleBuilder`, 26.10-E) → **M6**.
- ✅ **Approval + Workflow engines** (`approval_matrix`/`createApprovalRequest`,
  26.12) → **M4** templates (seed, don't rebuild).
- ✅ **RBAC** (`canDo` + `finance_role`) + **Audit trail** (`logAction` user/date/
  IP/old/new) → security for every M.
- ✅ **Data-quality / master-data engine** (Phase 26.16 `src/lib/masterdata/
  quality.ts` + `masterDataData.ts` — completeness, duplicate groups, relation
  integrity, customer merge) → **M5/M7** extend this, no second engine.
- ✅ Inventory/Finance/Reporting engines → reused by M2/M8.

## Module-by-module gap analysis
| M | Capability | Status | Action |
|---|---|---|---|
| M1 | Product **category tree** | ❌ `inv_products.category` is a flat free-text column; no hierarchy table | **Build** `erp_categories` (parent_id, level, cycle-guarded move/merge/archive) + migrate distinct existing categories |
| M2 | **Alternative suppliers** | ❌ 26.16 added only `inv_products.default_supplier_id` (single) | **Build** `inv_product_suppliers` M2M (price/lead-time/scores/is_primary) + ranking + comparison |
| M3 | Master-data **versioning** | ⚠️ generic `logAction` audit exists but no per-entity version store with **restore** | **Build** `master_data_history` (old/new JSON, reason) + timeline/compare/restore |
| M4 | Approval **templates** | ✅ engine exists | **Seed** master-data approval matrix rows (customer/supplier/product) — reuse 26.12 |
| M5 | **Data Steward** dashboard | ⚠️ 26.16 governance overview exists; no issue assign/resolve/ignore | **Build** `master_data_issues` (assign/resolve/ignore-with-reason + audit) over the 26.16 scan |
| M6 | Governance **rules** | ✅ Business Rules Engine | **Wire** `runRules` over master-data facts (product/customer/supplier) — no 2nd engine |
| M7 | Data-quality **dimensions** | ⚠️ 26.16 has completeness+duplicate+relation | **Extend** `quality.ts` with consistency/validity/uniqueness dimension scoring |
| M8 | Audit **intelligence** | ⚠️ report data layers exist | **Add** master-data audit report endpoints (customer/supplier/product/category/duplicate/change) reusing the data layers + CSV export |

## Decision
Build the genuine new data capabilities (**M1 category tree, M2 alternative
suppliers, M3 versioning**) fully (schema · engine · API · UI · tests · live-PG);
**extend** the 26.16 quality engine (M7) and **reuse** the Business Rules (M6),
Approval (M4), Audit and Reporting (M8) engines. New permissions
(`MASTER_DATA_*`) map onto the existing RBAC actions. No duplicate engines.
