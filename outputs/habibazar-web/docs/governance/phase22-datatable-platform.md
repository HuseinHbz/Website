# Phase 22.6 — Enterprise DataTable Platform

One unified, reusable table system powering **every** admin module — comparable in
capability to Dynamics 365 / SAP Fiori / Salesforce Lightning / ServiceNow /
Linear grids. Extends the Phase 22.5 DataTable (does not replace it); zero
regression. Every hand-rolled admin table (raw `<table>` **and** the `Table`/`TR`/
`TD` primitive) was migrated to the shared engine — no duplicate table
implementations remain at the module level.

## Architecture

```
 lib/admin/dataTable.ts        ← pure engine (sort/filter/group/select/view)   ── unit-tested
 lib/admin/dataTableExport.ts  ← CSV / Excel(SpreadsheetML) / JSON + CSV import ── unit-tested
 lib/admin/tableViews.ts       ← saved-view RBAC visibility (pure)             ── unit-tested
        │
 components/admin/DataTable.tsx  ← the one reusable shell every module renders
        │
 api/admin/table-prefs   ← per-user column layout per tableId (table_prefs)
 api/admin/table-views   ← named saved views, RBAC-shared     (table_views)
```

## Engine capabilities

- **Columns** — metadata-driven (`type` text/number/date/boolean/enum/tag,
  `width`, `pinned` start/end, `group`, `hidden`, `noExport`, `align`, custom
  `value`/`render`); resize (drag), reorder (drag header), pin, hide/show,
  auto/saved width, **per-user persistence** by `tableId`.
- **Sorting** — single + **multi-sort** (shift-click), locale-/natural-aware
  (`localeCompare` numeric), custom comparators via `value`.
- **Filtering** — global search + per-column filters: text, numeric range, date
  range, boolean, enum, tag; filter row toggle; persisted in saved views.
- **Grouping** — group by any column, collapsible groups, counts + sum/avg
  aggregations.
- **Selection** — single/multi, **shift-range**, select-page (tri-state header),
  invert, clear; selection drives bulk actions.
- **Pagination / virtualization** — client pagination (page-size picker) **or**
  row windowing (`virtualize`) for very large datasets (minimal render).
- **Row actions** — view/edit/delete/duplicate/custom, per-row `hidden`
  predicates, RBAC-gated via `can`.
- **Bulk actions** — run over the selection with confirm dialogs, RBAC-gated,
  busy state.
- **Export** — CSV (RFC-4180), Excel (SpreadsheetML 2003, no dependency), JSON;
  scope = page / filtered / selected / entire dataset.
- **Import** — pure `importCsv` (parse → schema-validate → coerce → duplicate
  detect → per-row errors) ready for preview + rollback-on-failure.
- **Saved views** — column layout + sort + filters + grouping + density + page
  size + pins, named, default, **RBAC-shared** (private / role / department /
  global).
- **Toolbar** — search, filters, column picker (+ pin), density, group-by,
  refresh, export, saved views, bulk actions, quick create.
- **States** — loading skeleton, empty, no-results, error + retry, permission
  denied (via `can`).
- **A11y / RTL / i18n** — `aria-sort`, `role=listbox/option`, keyboard, FA/EN +
  RTL, tokenised styling (`audit:tokens` = 0 arbitrary colors).

## Persistence (PostgreSQL)

- **`table_prefs`** — one row per (user, tableId): column order/width/visibility/
  pins + density + page size. API `/api/admin/table-prefs` (GET/PUT/DELETE).
- **`table_views`** — named saved views (full view-state JSON) owned by a user,
  optionally shared to role/department/global. API `/api/admin/table-views`
  (list visible / create / update / delete). Visibility is a pure helper
  (`tableViews.ts`, `canSeeView`/`visibleViews`), RBAC-gated (sharing needs
  `manage_users`), audited.

## Migration coverage

Every admin module data grid now renders `DataTable`:

- **CMS** — Blog (posts+categories), Content, Pages, Sections, Services,
  Projects (case studies), Solutions, Products, Industries, Technologies,
  Partners, Organizations, Testimonials, Timeline, Clients, Skills,
  Certifications, Credentials, Academy, Events, Sites, Templates, Docs, SEO,
  Forms, AI Knowledge Base.
- **CRM** — Leads, Contacts, Consultations.
- **ERP** — Sales (customers/quotes/orders/invoices/payments), Finance
  (accounts, journal), Inventory (products/warehouses/moves), Assets, Project
  Center (projects, timesheets), Documents, Rules, Workflows, Integration Hub
  (connectors/dispatches/DLQ), Numbering Center (recent/formats/counters/scopes/
  schedule/audit).
- **Platform** — Users, Feature Flags, Audit log, Reporting Center (dynamic),
  Backup catalog, Database census, Analytics activity, Operations recent-errors,
  Logs error-grouping, Design System reference.

### Intentionally kept (not module data grids — honest)

- The **`Table`/`TR`/`TD` primitive** in `ui.tsx` remains as a low-level styling
  helper but is no longer used by any manager.
- **Financial statements** (Finance dashboard recent + trial-balance/income/
  balance layouts) are accounting statements with subtotal structure, not flat
  grids.
- **Dashboard Platform widget** (`DashboardEngine` table widget) is part of the
  Dashboard Platform (kept intact per the mission) and renders arbitrary widget
  payloads.
- The **live SSE log console** (`LogsMonitoring`) is a streaming console, not a
  tabular grid (its grouped-error view was migrated).
- Small read-only dashboard mini-lists (e.g. Inventory low-stock) stay inline.

## Validation

- **type-check 0 · lint 0 · 240 unit tests · six governance audits green ·
  production build OK** — verified after every migration batch (20 batches).
- **Live on real PostgreSQL** — `table_prefs` per-user layout and RBAC-shared
  `table_views` round-trip; idempotent migration on a fresh DB.
- **Zero regression** — each module's CRUD/modal/API/RBAC/i18n behaviour is
  unchanged; only the table rendering moved to the shared engine. Existing APIs
  untouched.
