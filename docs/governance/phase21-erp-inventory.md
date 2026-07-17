# Phase 21 ERP — Module 4: Enterprise Inventory

## Scope note — honest, verified increment

The full "Enterprise ERP" master prompt spans 14 modules (Financial/GL, Sales,
Purchasing, Inventory, Assets, Projects, Costing, Document Engine, Workflow
Designer, Rules Engine, Integration Hub, Reporting, Global Search, Dashboards) at
SAP/Oracle/Odoo quality. That is a multi-quarter program and cannot be honestly
"completed" in one pass without shipping mocks — which the prompt itself forbids.

Per the maintainer's chosen order (Inventory → Assets → Financial → Dashboard),
this pass ships **Enterprise Inventory, complete and verified**. No placeholder,
no mock data, no TODO.

## Shipped & verified — Enterprise Inventory

- **Valuation engine** (`src/lib/erp/inventory.ts`, pure, 11 unit tests):
  **FIFO, LIFO and weighted-average** costing computed from a product's ordered
  move history (on-hand, remaining value, average cost, COGS). Outbound-beyond-
  stock is clamped. Plus reorder logic — `stockStatus` (out / below-safety /
  reorder / ok / overstock), `suggestedReorderQty`, and `inventoryKpis` rollup.
- **Data model** (PostgreSQL, `migrate.ts`): `inv_warehouses` (multi-warehouse +
  branch), `inv_locations` (rack/shelf/bin), `inv_products` (SKU, barcode, unit,
  cost/price, lot/serial flags, valuation method, reorder/min/max/safety), and
  `inv_moves` — a signed-quantity move ledger (receipt/issue/transfer/adjustment/
  return/count); a transfer writes two rows (out of source, into destination)
  sharing a ref.
- **Server data layer** (`src/lib/erp/inventoryData.ts`): loads products + the
  move ledger and computes live on-hand/valuation/status via the pure engine —
  one place, reused by the products API and the dashboard (no duplication).
- **APIs** (`/api/admin/erp/inventory/{products,warehouses,moves,overview}`):
  full CRUD + movement posting + dashboard aggregates. zod-validated, RBAC-gated
  (`requireAdmin('edit'|'delete')`), audit-logged. All PostgreSQL (`pgQuery`,
  `$n` params) — no SQLite.
- **UI** (`/admin/inventory`, `InventoryCenter`, fully bilingual FA/EN): tabbed
  Dashboard (6 KPI cards, low-stock, stock-by-warehouse bars, recent moves) ·
  Products (live on-hand/avg-cost/value/status + full editor) · Warehouses ·
  Stock Moves (post any movement incl. transfers + ledger). Sidebar entry under
  Business/ERP.

**Verified:** tsc 0 · ESLint 0 · vitest 95/95 (11 inventory) · 6 governance audits
pass (i18n 0 missing) · build OK · **PostgreSQL round-trip proven** — real moves
seeded, read through the production code path: FIFO value=$10/COGS=$20, LIFO
value=$5/COGS=$25, WAVG value=$7.50/COGS=$22.50 (classic worked example).

## Remaining ERP roadmap (documented, not yet built)

Ordered per the maintainer: **Assets → Financial/GL → Dashboard redesign**, then
Sales, Purchasing, Projects, Costing, Document Engine, Workflow Designer (visual),
Rules Engine, Integration Hub, Reporting, Global Search. Each will be built the
same way — pure tested core → PostgreSQL schema → RBAC/zod API → bilingual UI →
verified — one complete module at a time, never as a mock.
