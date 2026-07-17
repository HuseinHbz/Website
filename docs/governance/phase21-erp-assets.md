# Phase 21 ERP — Module 5: Enterprise Asset Management (completed)

Second complete ERP module (order: Inventory → **Assets** → Financial →
Dashboard). The former Asset Center was ~20% (a flat register); this brings it to
a full lifecycle system. No placeholder, no mock, no TODO.

## Shipped & verified

- **Depreciation engine** (`src/lib/erp/depreciation.ts`, pure, 7 unit tests):
  straight-line, double-declining balance, sum-of-years-digits and none. Computes
  book value, accumulated depreciation, current-year expense and life-used% from
  purchase price / residual / useful life / age. Floored at residual, age-clamped.
- **Extended data model** (PostgreSQL, idempotent `ALTER … ADD COLUMN IF NOT
  EXISTS`): assets gain category, model, manufacturer, barcode, purchase price,
  residual value, useful-life years, depreciation method, insurance policy +
  expiry, contract ref, department, employee, cost center, project, GPS lat/lng,
  calibration due. New tables: `asset_assignments` (assignment history),
  `asset_maintenance` (maintenance/calibration/repair/inspection schedule +
  history), `asset_activity` (per-asset timeline / audit trail).
- **Server layer** (`src/lib/erp/assetData.ts`): loads assets and enriches each
  with computed book value + warranty/insurance/calibration state + open-
  maintenance count; `assetKpisFrom` + `assetOverview` roll up the dashboard.
  One computation path, shared by the list API and the dashboard.
- **APIs**: `/api/admin/erp/assets` (CRUD, all fields), `/assets/lifecycle`
  (GET full lifecycle; POST add assignment / add maintenance / mark done),
  `/assets/overview` (dashboard). zod-validated, RBAC-gated, audit-logged; every
  mutation writes an `asset_activity` row (create/status/assign/maintenance).
- **UI** (`/admin/assets`, `AssetManager`, fully bilingual FA/EN): tabbed
  Dashboard (12 KPI cards — cost/book/depreciation/warranty/insurance/calibration/
  maintenance — by-type bars, upcoming maintenance, attention list) and Assets
  (table → grouped editor with Identity/Financial/Coverage/Assignment sections →
  per-asset detail drawer showing depreciation summary, assignment history +
  add, maintenance schedule/history + add + mark-done, and the activity timeline).

**Verified:** tsc 0 · ESLint 0 · vitest 102/102 (7 depreciation) · 6 governance
audits pass · build OK · **real PostgreSQL round-trip** — a $10k asset (residual
$1k, 5-yr straight-line) bought 2 years ago read through the production path:
book value $6,401, accumulated $3,599, 40% life used.

## Remaining ERP roadmap

Next per the maintainer's order: **Financial / General Ledger** (double-entry,
chart of accounts, trial balance, statements), then the **Dashboard redesign**,
then Sales, Purchasing, Projects, Costing, Document Engine, visual Workflow
Designer, Rules Engine, Integration Hub, Reporting, Global Search — each built
the same way (pure tested core → PostgreSQL → RBAC/zod API → bilingual UI →
verified), one complete module at a time.
