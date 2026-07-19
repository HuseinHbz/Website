# Phase 21.9 ERP — Reporting Platform (completed)

Enterprise reporting across the ERP modules. A fixed report catalog reads live
from each module's already-verified data layer — no arbitrary SQL, no duplicated
aggregation. Real, verified.

## Design note — reuse over re-query

Reports do **not** re-implement any module's maths. Each report projects the
existing server data layer (`ledgerData`, `salesData`, `inventoryData`,
`assetData`, `costingData`) into flat rows + typed columns + a summary. The
catalog is a closed list of report ids (no user-supplied SQL → no injection
surface). Purchasing has no module yet, so its report is deferred (documented,
not faked).

## Shipped & verified

- **Pure core** (`src/lib/reports/pivot.ts`, 5 unit tests): `groupBy`,
  `aggregate` (sum/count/avg/min/max), `summarize` (group→aggregate, sorted),
  `pivot` (row×col with row/col/grand totals), `toCsv` (RFC-4180 quoting). No I/O.
- **Report catalog + data layer** (`src/lib/reports/reportData.ts`): `REPORTS`
  (7 reports across financial/sales/inventory/assets/projects) + `runReport(id)`
  → `{ columns, rows, summary }`, reusing existing layers + one direct read for
  the invoice register.
- **API** `GET /api/admin/erp/reports` — catalog (no `id`), run a report (`?id=`),
  or CSV download (`?id=&format=csv`). RBAC-gated (`requireAdmin`), unknown id →
  400.
- **Reporting Center** (`/admin/reports`, `ReportingCenter`) — bilingual FA/EN
  report picker (grouped by module), summary stat cards, a Table view and a
  group-by Summary bar view (both from the pure helpers), and CSV export.
- **Sidebar** entry under Business; `rep_*` keys in the admin locale dict.

## Reports

| id | module | report |
|---|---|---|
| `fin_trial_balance` | financial | Trial Balance |
| `fin_income` | financial | Income Statement |
| `sales_by_customer` | sales | Sales by Customer |
| `sales_invoices` | sales | Invoice Register |
| `inv_valuation` | inventory | Inventory Valuation |
| `assets_register` | assets | Asset Register |
| `projects_costing` | projects | Project Costing |

Purchasing report: **deferred** until the purchasing module ships.

## Verification

- `type-check`, `lint` (0 warnings), unit tests (pivot 5/5), all six governance
  audits (tokens/content/reuse/deps/links/i18n) green, production build OK
  (`/admin/reports` compiled).
- **Real PostgreSQL round-trip** of `runReport` over all 7 reports on a fresh
  migrate+seed DB with sample transactions: sales invoiced = 10,000, invoice
  register total = 10,000, inventory valuation = 120 (10 × 12 avg cost), asset
  book value = 5,476.6 (straight-line depreciation), project profit = 5,000
  (8,000 revenue − 3,000 cost), financial statements tie out with drafts
  excluded; unknown id → null.
