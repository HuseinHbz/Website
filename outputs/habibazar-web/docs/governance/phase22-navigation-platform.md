# Phase 22.3 — Enterprise Navigation Platform

Completes the workspace navigation experience on top of the Phase 22 foundation:
RBAC-aware sidebar, an automatic breadcrumb engine, in-sidebar search, per-user
favorites + recent items, and contextual quick actions. Navigation-only — no
business logic touched, zero regression.

## Architecture

```
 src/lib/admin/workspaces.ts   ← registry + pure nav engine
   ├─ roleCan / visibleWorkspaces / visibleGroups   (RBAC, client-safe mirror of canDo)
   ├─ QUICK_ACTIONS / quickActionsFor               (contextual, permission-filtered)
   └─ breadcrumbFor / findItem                      (auto breadcrumb)
              │
   AdminShell ─┬─ NavPrefsProvider (favorites + recents, visit tracking) ─► /api/admin/nav-prefs
               ├─ AdminSidebar (RBAC groups, search, favorites, quick actions, recent, ★ pins)
               └─ Breadcrumb (Workspaces › Workspace › Module)
```

- **RBAC navigation** — `roleCan` mirrors `auth.canDo` in a client-safe pure
  helper; `visibleWorkspaces(role)` / `visibleGroups(role, ws)` hide unauthorized
  workspaces, groups and items. Servers still enforce RBAC (`requireAdmin`); this
  only controls what renders. Editors, e.g., never see Security or System.
- **Breadcrumb engine** — `breadcrumbFor(pathname)` derives the trail from the
  registry (handles workspace landings + dashboard routes); no hardcoded crumbs.
- **In-sidebar search** — filters the active workspace's (RBAC-filtered) items by
  EN/FA label as you type.
- **Favorites + Recent** — persisted per user in `nav_prefs` (favorites/recents
  JSON) via `/api/admin/nav-prefs` (GET, POST toggleFavorite/visit/clearRecents).
  `NavPrefsProvider` loads them, records a visit on each admin route change
  (deduped, capped at 12), and drives the sidebar Favorites (★) + Recent sections.
  Hrefs are server-validated (`/admin/...` only) — external/junk rejected.
- **Quick actions** — per-workspace contextual shortcuts (New Invoice/Product/
  Journal for ERP, New Lead for CRM, New Prompt/Agent for AI, …), permission-
  filtered, rendered as a sidebar section. Real navigations, not fake handlers.
- **Accessibility** — skip-to-content link, `aria-current` on the active item,
  `aria-label`ed nav + search + breadcrumb, switcher as `listbox`, star buttons
  labelled. Bilingual FA/EN + RTL throughout.

## Files changed

`src/lib/admin/workspaces.ts` (RBAC + quick actions + breadcrumb + `requires` on
items), `navPrefs.tsx` (provider/hook), `AdminSidebar.tsx` (rewrite),
`Breadcrumb.tsx` (new), `AdminShell.tsx` (provider + breadcrumb + skip link +
role), `api/admin/nav-prefs/route.ts` (new), `migrate.ts` (+`nav_prefs`), plus
the workspace unit-test suite.

## Validation

- type-check 0 · lint 0 · **201 unit tests** (+8 RBAC/breadcrumb/quick-action
  tests) · six governance audits green · production build OK.
- **Live end-to-end on real PostgreSQL** (logged-in admin): breadcrumb renders
  (Workspaces › ERP Platform › Inventory Center); sidebar shows Favorites (★
  Financial Center), Quick Actions (New Invoice/Product/Journal), RBAC groups;
  sidebar search filters ("doc" → Document Center); nav-prefs API persists a
  favorite + a recent visit and **rejects an external href**. Screenshots
  captured. Existing module pages render unchanged (zero regression).

## Remaining roadmap (staged)

Persisted collapse/expanded-group state per user (currently local); virtualized
menu for very large workspaces; notification badges/unread counters on nav items;
role/department default favorite sets; full keyboard tree navigation in the
sidebar (arrow keys), building on the existing focus management.
