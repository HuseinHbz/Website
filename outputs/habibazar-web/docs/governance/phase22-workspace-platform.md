# Phase 22 — Enterprise Workspace & Navigation Platform (foundation)

Replaces the single ~60-item admin sidebar with a workspace-based navigation
architecture that scales to hundreds of modules. This push lands the
**architectural spine** — workspace registry, workspace-scoped sidebar +
switcher, workspace home selector, and a registry-driven command palette with
live global search. Dashboards/widgets, drag-drop layouts, favorites, and
virtualized tables are the documented next increments (built on this spine).

## Pre-implementation analysis

- Current admin: one `AdminSidebar` with 16 hardcoded groups (~60 links);
  `AdminShell` already mounts a `CommandPalette` (Ctrl+K) with a **stale,
  hand-maintained** static command list; Module 13 Global Search API exists.
- Zero-regression constraint: every existing `/admin/*` route must stay
  reachable and unchanged. The 62 real routes were enumerated from the App
  Router before mapping.

## Architecture

```
        src/lib/admin/workspaces.ts   ← single source of truth (12 workspaces)
                 │
     ┌───────────┼───────────────────────────┐
     ▼           ▼                           ▼
 AdminSidebar   WorkspaceHome            CommandPalette
 (active ws +   (/admin/home grid)       (nav + ws-switch cmds
  switcher)                               + live /api/admin/search)
     │
 workspaceForPath(pathname) → longest-href match → active workspace
```

- **Workspace registry** `src/lib/admin/workspaces.ts` — 12 workspaces
  (Executive, Brand, Content, CRM, ERP, AI, Security, Operations, Backup,
  Analytics, Documentation, System), each with its own bilingual groups → items.
  Pure helpers `workspaceForPath` / `workspaceById` / `workspaceHome` /
  `allNavItems` (6 unit tests). Every href is a real page (`audit:links` = 0).
- **Workspace-scoped sidebar** — `AdminSidebar` renders only the active
  workspace's groups, with a **workspace switcher** dropdown (all 12 + "All
  workspaces") and the ⌘K launcher. Collapsible, RTL/LTR, mobile drawer — all
  preserved.
- **Workspace Home** `/admin/home` — an enterprise selector grid of workspace
  cards (icon, description, module count) linking into each workspace.
- **Command palette** — commands are now **derived from the registry** (kills the
  stale static list = debt removed): "Switch to <workspace>" + every module,
  grouped by workspace; typing ≥2 chars adds a live **Records** group from the
  Module 13 search API. Keyboard-first (↑↓/↵/Esc), `role="dialog"`.

## Navigation tree (workspaces → module count)

Executive 3 · Brand Platform 23 · Content Center 6 · CRM Platform 5 ·
ERP Platform 11 · AI Platform 5 · Security Center 5 · Operations Center 3 ·
Backup Center 1 · Analytics Center 4 · Documentation 1 · System Administration 9.
(Cross-listed modules — e.g. Reporting appears in ERP + Analytics — resolve to a
single primary workspace via longest-href match.)

## Zero-regression verification

- type-check 0 · lint 0 · **189 unit tests** (+6 workspace tests) · six
  governance audits green — crucially **`audit:links` = 0 broken internal links**
  (the new nav only points at real pages) · production build OK.
- **Live smoke test** (running app + real PostgreSQL, logged-in admin): workspace
  home grid renders; switching to ERP shows only ERP modules; the Finance page
  (and other module pages) render unchanged; Ctrl+K palette shows nav commands +
  a live record hit ("Inventory — 1200 · FINANCE") from the search API.
  Screenshots captured.

## Design system / accessibility notes

Reuses the existing token-based design system (brand/surface/text tokens, no
arbitrary colors — `audit:tokens` = 0). Palette is a labelled dialog with full
keyboard control; switcher is a `listbox`. Fully bilingual FA/EN + RTL.

## Staged next increments (built on this spine)

1. Per-workspace dashboards with draggable/resizable widgets + saved layouts.
2. Favorites & recent-items (persisted per user).
3. Breadcrumb bar (workspace › module › record).
4. RBAC workspace visibility filtering in the sidebar/home (registry already
   carries a `requires` hint per workspace).
5. Virtualized enterprise data-table component + saved views.
6. WCAG AA audit pass (contrast + focus management report).
