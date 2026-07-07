# Phase 22.2 — Enterprise Dashboard Platform (Dashboard Engine + Widget Registry)

A scalable, per-workspace dashboard engine built on the Phase 22 workspace
foundation. Users compose their own layout from a registry of widgets; every
widget renders **real data** from existing, already-verified module services —
no mock data, no demo components.

## Architecture

```
 Workspace ──► DashboardEngine (client) ──► /api/admin/dashboards      (layout GET/PUT/DELETE)
                     │                    └► /api/admin/dashboards/data (batched real data GET)
                     ▼
              Widget Registry  src/lib/admin/widgets.ts   (pure metadata + defaults)
                     │
                     ▼
              Widget Resolver  src/lib/admin/widgetData.ts (maps id → REAL data)
                     │
        executiveOverview() · opsSnapshot() · backups table  (existing services)
```

- **Widget registry** `src/lib/admin/widgets.ts` — pure metadata (id, bilingual
  title, category kpi|chart|table|list|ops, workspace, size, RBAC `requires`,
  icon). Helpers `widgetsForWorkspace` / `defaultLayout` / `sanitizeLayout`
  (drops foreign/duplicate/invalid entries). 4 unit tests. No I/O, no React.
- **Data resolver** `src/lib/admin/widgetData.ts` — `resolveWidgets(ids[])`
  computes the shared snapshots (`executiveOverview`, `opsSnapshot`) **at most
  once per request**, only if a requested widget needs them, then slices each
  widget's real payload. Per-widget try/catch → an `error` payload never breaks
  the batch.
- **APIs** — `/api/admin/dashboards` (GET layout+available widgets, PUT save,
  DELETE reset — per user+workspace, RBAC-filtered) and
  `/api/admin/dashboards/data?ids=` (batched real data; widgets the user can't
  access return a `denied` payload). Zod-validated, `requireAdmin`.
- **Dashboard engine UI** `DashboardEngine.tsx` — responsive 4-col grid; per
  widget **add / remove / resize (sm→md→lg) / drag-reorder**; **Customize** edit
  mode; **Save layout** (persisted) + **Reset to default**; lazy chart loading
  (`next/dynamic` recharts); every widget handles **loading / empty / error /
  permission-denied** states. Route `/admin/dashboards/[workspace]`, linked from
  each workspace sidebar (Dashboard item) and reachable per workspace.
- **Persistence** — `dashboard_layouts` table (user_id × workspace UNIQUE, layout
  JSON), atomic upsert.

## Widgets shipped (all real data)

KPI: Net Income, Cash, Revenue, Inventory Value, Active Assets, Open Pipeline,
Total Leads, AI Calls (30d). Chart: AI Usage Trend (area). Data: Recent Activity
(audit table), Cross-Module Alerts (list). Ops: System Health (live CPU/mem/
availability), Subsystem Status, Backup Status. Sources: `executiveOverview`
(finance/inventory/assets/crm/ai/activity/alerts), `opsSnapshot` (host + SRE),
`backups` table.

## Permissions

Widget catalogue + data are RBAC-filtered: finance/ERP KPIs require `edit`; a user
lacking a widget's requirement can neither add it nor fetch its data (`denied`).

## Validation

- type-check 0 · lint 0 · **193 unit tests** (+ widget registry & workspace-
  dashboard resolver) · six governance audits green · production build OK
  (`/admin/dashboards/[workspace]` + 2 API routes).
- **Live end-to-end on real PostgreSQL** (fresh migrate + logged-in admin):
  GET default layout + RBAC-filtered widget catalogue; widget data returns real
  values (System Health CPU 24% / Memory 5.6% / Availability 60% from the live
  host; Recent Activity = real LOGIN audit rows); PUT saves + GET reflects it;
  DELETE resets; ERP dashboard exposes only ERP widgets. Screenshots captured
  (Operations dashboard, Executive edit mode with the add-widget menu).

## Remaining roadmap (staged)

Pixel drag-resize grid + free positioning; role/department default layouts;
widget-level configuration (date range, thresholds); real-time push (SSE) for
ops widgets; a widget marketplace as modules grow; per-widget cache TTL.
