# Phase 22.4 — Enterprise Search & Command Platform

Unifies global search, an executable command registry, favorites, recent items
and recent searches into one keyboard-first command palette (Ctrl+K), fully
RBAC-aware and PostgreSQL-backed. Builds on Phase 22 (workspaces), 22.2
(dashboards) and 22.3 (navigation/favorites). Zero regression.

## What existed vs. what this phase adds

Already shipped (reused, not rebuilt): Module 13 global search API
(`/api/admin/search`, ranked + grouped), a registry-driven palette, favorites +
recent items (`nav_prefs`), quick actions. **New in 22.4:** an *executable*
command registry, recent-searches persistence, and a palette rewrite that fuses
all sources into one ranked, keyboard-navigable surface.

## Command registry (executable — no fakes)

`src/lib/admin/commands.ts` — pure, unit-tested. Two kinds:

- **execute** — POSTs a REAL existing endpoint. Shipped: **Run Backup Now**
  (`/api/admin/backup/run`) and **Sync AI Knowledge Base** (`/api/admin/ai-kb/
  sync`), both `manage_settings`-gated with a confirm prompt. No command targets
  a non-existent endpoint (test-enforced).
- **navigate** — global jumps (Global Search, All Workspaces, Documentation).

`visibleCommands(role, query)` RBAC-filters + query-filters. Executable commands
run inside the palette with an inline status (`Running… → Done/Failed`) and
auto-close on success.

## Unified command palette

`CommandPalette.tsx` composes one ranked `rows` list:

- **empty query** → Favorites (★) · Recent items · Recent searches (click to
  refill) · top Commands.
- **typing** → Commands · Workspaces (switch) · RBAC-filtered nav items (grouped
  by workspace) · live **Records** from the search API.

All rows share one keyboard model (↑↓ navigate, ↵ run, Esc close); `role="dialog"`
+ `role="listbox"`/`option` + `aria-selected`. Nav items are filtered through
`visibleWorkspaces`/`visibleGroups` so unauthorized modules never appear.

## Recent searches (persisted)

`nav_prefs.searches` (JSON, capped 8) via `/api/admin/nav-prefs` (`search` /
`clearSearches` actions; terms ≥2 chars, deduped). Recorded automatically after a
successful records search; surfaced in the empty-state palette.

## RBAC

Server routes enforce RBAC (`requireAdmin`, `manage_settings` on the executable
endpoints). The palette additionally hides commands/workspaces/nav the role can't
use, and the search API is already `requireAdmin`-gated.

## Files changed

`commands.ts` (new, +3 tests), `CommandPalette.tsx` (rewrite), `navPrefs.tsx`
(+searches/recordSearch), `api/admin/nav-prefs/route.ts` (+search actions),
`migrate.ts` (+`nav_prefs.searches`), `AdminShell.tsx` (pass role), governance +
CLAUDE.md.

## Validation

- type-check 0 · lint 0 · **204 unit tests** · six governance audits green ·
  build OK.
- **Live on real PostgreSQL** (logged-in admin): recent-search persists
  ("invoice"), too-short term ignored; executable commands hit real endpoints
  (`backup/run` → 202 `{started:true}`, `ai-kb/sync` → 200); palette "back" shows
  Run Backup Now + Switch to Backup Center + Backup & Recovery. Screenshots
  captured. Existing pages unchanged.

## Remaining roadmap (staged)

Executed-command history in Recent; popular-searches aggregate; typo-tolerant
fuzzy ranking in the search engine; virtualized result list for very large result
sets; entity-scoped quick actions (act on the currently open record).
