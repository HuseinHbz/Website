# Phase 16 — Enterprise ERP Foundation (Asset Center)

_Same honesty rule as Phases 10–15. Phase 16 (full ERP: org/employees/HR/assets/
inventory/vendors/finance/procurement/workflow) is a multi-quarter programme, not
a one-pass "220/220" deliverable. This pass ships the **verified Asset Center** —
the ERP module with the clearest fit for an infrastructure company like HBZ
Technology — reusing every validated subsystem, and honestly documents the rest.
No fabricated score._

## Enterprise audit (no duplication)
No pre-existing asset/ERP/inventory/vendor admin module (`ls src/app/admin` — none).
The `assets` table and `/admin/assets` module are net-new; nothing is duplicated or
replaced. Reuses the CRM-established pattern (validated + audited CRUD + pure
domain logic + admin UI).

## Shipped this pass — Asset Center

- **`assets` table** (migrate.ts, idempotent) — IT asset lifecycle with
  CHECK-constrained `type` (server/network/firewall/switch/router/access_point/
  storage/vm/cloud/laptop/license/other) and `status`
  (active/maintenance/retired/spare), plus serial, vendor, location, assignment,
  purchase date, warranty expiry, owner. Indexed on (type,status) and warranty.
- **Pure domain logic** `src/lib/erp/assets.ts`: `warrantyState()`
  (ok/expiring≤30d/expired/none + signed days), `daysUntil()`, `assetStats()`
  (per-type/per-status rollup + warranty-risk counts). Deterministic,
  **unit-tested** (`__tests__/assets.test.ts`, 3 tests).
- **API** `GET/POST/PUT/DELETE /api/admin/erp/assets` — reuses **zod** validation,
  **requireAdmin** RBAC (`edit`/`delete`), and **audit logging**. GET returns
  assets + computed warranty health + portfolio KPIs.
- **Admin UI** `/admin/assets` (`AssetManager`): asset-health KPI tiles (active /
  in-maintenance / warranty-expiring / expired), type filter + search, create/edit
  modal, per-row status + warranty badges. Semantic token classes; sidebar entry
  under the "Business" group.

### Verified live (seeded admin)
| Check | Result |
| --- | --- |
| RBAC — unauth POST | **401** |
| Create firewall asset | id 1 |
| Validation — invalid type | **400** (zod + CHECK) |
| Warranty health | `{ state: expiring, days: 10 }` (computed) |
| Portfolio stats | byType firewall 1, active 1, warrantyExpiring 1 |
| Audit trail | `CREATE · assets · 1` |

Covers the spec's **Asset Management** (servers/network/firewalls/switches/routers/
APs/storage/VMs/cloud/laptops/licenses; serial/warranty/location/assignment/status
lifecycle) + **Asset-health dashboard** + **Security** (RBAC + audit trail).

## Honest roadmap — NOT delivered this pass
Each is a real ERP module; stubbing them to claim "220/220" would be dishonest:
- **Organization/Employee/HR** (business units, org chart, employee profiles,
  recruitment, leave, performance).
- **Inventory** (stock/warehouses/PO/receiving/low-stock alerts),
  **Vendor management**, **Finance foundation** (budgets/expenses/cost centers),
  **Procurement** (purchase requests/approval).
- **Workflow engine** (approval chains/escalation/rules), **resource planning**,
  **internal knowledge center**, **AI ERP assistant** (builds on the existing
  chat + CMS→KB sync), **executive dashboards**, **OpenAPI docs**.
- Asset depth: maintenance schedule, assignment history, software-license seat
  tracking.

The reusable foundation shipped (validated+audited CRUD pattern, pure domain
logic + stats, warranty-lifecycle model) is what these modules build on.

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest **45/45** (incl. 3 asset) · all 5 governance audits
pass (0 broken links — `/admin/assets` recognized) · production build OK. Asset
Center verified live (RBAC, warranty health, stats, audit). No module duplicated.
