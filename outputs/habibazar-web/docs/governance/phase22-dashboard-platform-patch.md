# Phase 22.2 Patch — Dashboard Platform Enterprise Hardening

Extends the existing Dashboard Engine (not a rewrite) with role-based layouts,
layout inheritance, widget configuration, a widget cache, import/export and audit
logging. Reuses the Widget Registry, Widget Resolver, layout APIs and
`dashboard_layouts` table. Zero regression.

## Delivered (extends existing architecture)

1. **Role-based layouts + inheritance** — new `dashboard_role_layouts`
   (role × workspace UNIQUE). Pure resolver `pickLayout` (unit-tested) applies the
   priority **User → Role → Workspace default**; GET returns the resolved layout +
   its `source`. Saving a role default requires `manage_users` (`?scope=role`);
   the DELETE (reset) drops the user layout and **falls back to the role layout**.
2. **Widget configuration** — `LayoutEntry.config` (`refreshInterval`, `warn`,
   `critical`), sanitised + clamped server-side (`sanitizeLayout`), persisted in
   the layout JSON and round-tripped through save/resolve.
3. **Widget cache (TTL)** — `resolveWidgets` now keeps a per-widget in-memory
   cache with a widget-level TTL (`widgetTtl`: ops health 30s, everything else
   5min); only stale widgets recompute their snapshot. `?fresh=1` (manual
   refresh) bypasses the cache.
4. **Real-time-ready refresh** — each widget with a `refreshInterval` polls fresh
   data on its own timer in the DashboardEngine — a polling seam a future
   SSE/WebSocket feed can replace without redesign. Config is edited per widget in
   the customize view (Off/30s/60s/5m).
5. **Import / Export** — export the resolved layout as JSON (`?export=1`
   download); import a JSON layout in the engine (validated by `sanitizeLayout` on
   save, unknown/foreign widgets dropped).
6. **Audit logging** — every save/role-save/reset writes an `audit_logs` entry via
   `logAction` (`dashboard.layout.save` / `dashboard.role_layout.save` /
   `dashboard.layout.reset`).

## UI additions (same engine)

Layout-source badge (Your layout / Role layout / Default), Export + Import
buttons, "Save as role default" (admins only), and a per-widget auto-refresh
selector in edit mode. Bilingual FA/EN.

## Validation

- type-check 0 · lint 0 · **213 unit tests** (+3: layout resolution, config
  clamp, widget TTL) · six governance audits green · build OK.
- **Live end-to-end on real PostgreSQL** (super-admin): default→role→user
  resolution confirmed (source flips default→role→user); reset falls back to role;
  widget config (`refreshInterval:60`) round-trips; export returns JSON; audit
  rows written (`dashboard.role_layout.save` / `.layout.save` / `.layout.reset`).
  Existing dashboard behaviour unchanged.

## Completion (previously staged — now built for real)

- **Department/team layouts** — `users.department` column added (Drizzle schema +
  idempotent ALTER + `getAdminUser`), assignable in the Users admin form. New
  `dashboard_dept_layouts` table; `pickLayout` is now a 4-tier chain **User →
  Department → Role → Workspace default** (unit-tested); PUT `scope=department`
  (manage_users) and reset falls through dept→role→default. Verified: an admin in
  "Finance" with a saved dept layout resolves to `source=department`.
- **Dashboard template system** — `dashboard_templates` table + API
  (`/api/admin/dashboards/templates` GET/POST/DELETE); DashboardEngine "Templates"
  menu: save current layout as a template, apply (clone into the editor), delete.
  Verified: create + list round-trip.
- **Dashboard sharing** — `dashboard_shares` table (owner × workspace × target
  type/key × permission, self-contained layout snapshot) + API
  (`/api/admin/dashboards/shares` GET mine/inbox, POST upsert, DELETE); "Share"
  action + a "Shared with you" strip that applies a shared layout. Targets:
  user/role/department; permissions view/edit/manage. Verified: share to
  role=editor + `mine=1` listing.

All three write audit rows (`dashboard.dept_layout.save`, `dashboard.template.
create`, `dashboard.share`, …). type-check 0 · lint 0 · 213 tests · six audits ·
build OK · live-verified on real PostgreSQL.
