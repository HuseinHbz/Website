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

## Completion (previously staged — now built for real)

- **Notification badges** — `GET /api/admin/nav-badges` returns live "pending /
  unread" counts from real tables (new contact requests / consultations / CRM
  leads, failed backups, unresolved integration DLQ), mapped to nav hrefs.
  `NavPrefsProvider` polls it (mount + 60s + route change); the sidebar renders a
  red count badge on the item + a dot on its collapsed group. Verified: 3 new CRM
  leads → `/admin/crm: 3`.
- **Persisted collapsed groups (per user)** — `nav_prefs.ui` (JSON) stores
  `collapsedGroups`; workspace sidebar groups are collapsible (click the header),
  persisted via `/api/admin/nav-prefs` (`toggleGroup`). Verified: toggling
  `erp:Operations` survives reload.
- **Role default favorites** — pure `roleDefaultFavorites(role)` (RBAC-filtered);
  on a user's first nav-prefs load (no row yet) their favorites are seeded from
  the role default. Verified: super-admin seeded 5 role-appropriate pins;
  editor's set excludes Security.
- **Keyboard tree navigation** — ↑/↓ move focus between sidebar links (roving
  focus via an `onKeyDown` on the `<nav>`), on top of the existing skip-link +
  `aria-current`.

## Final closure — advanced switcher + full keyboard nav

- **Advanced Workspace Switcher** — the sidebar switcher dropdown now has an
  in-dropdown **search**, and three sections: **Favorites** (★ pinned), **Recent**
  (auto-recorded), **All** — all RBAC-filtered. Star toggles a favorite workspace;
  the active workspace is recorded as recent on navigation. Both persist per user
  in `nav_prefs.ui` (`favWorkspaces` / `recentWorkspaces`) via
  `toggleFavWorkspace` / `visitWorkspace`; workspace ids are server-validated.
  Fully keyboard-driven: ↑/↓ move the highlight, Enter opens, Esc closes.
  Verified: fav `erp`, recent `[ai, crm]` persist across reload; junk id rejected.
- **Complete keyboard navigation** — the sidebar `<nav>` is a tree: ↑/↓ rove
  between links **and group headers**; ←/→ collapse/expand the focused group
  (RTL-aware direction); Enter activates natively; Esc blurs. Group headers carry
  `data-group` and `aria-expanded`; roving focus + `aria-current` complete the
  WCAG picture.

## Not needed at current scale (honest)

- **Virtualized menu** — the largest workspace has 23 items; windowing would add
  machinery (and a dependency or complex code) for lists this small with zero real
  benefit. The registry-driven render stays O(items) and fast; virtualization can
  be added the day a single workspace holds hundreds of items.
