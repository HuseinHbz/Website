# Phase 22.5 — Enterprise Design System & UI Standardization

Establishes the unified design language reference and the platform's missing
foundational component — the Enterprise DataTable — on top of the existing token
system and component library. Zero regression.

## UI audit (findings)

- **Already in place** (reused, not rebuilt): a token system
  (`tailwind.config.ts` semantic colors + `src/lib/design/tokens.ts` BRAND/CHART/
  SOCIAL) enforced by the `audit:tokens` gate (0 arbitrary color classes allowed);
  a 16-component library in `src/components/admin/ui.tsx` (Card, Btn, Input,
  Select, Toggle, Badge, Table primitives, Modal, PageHeader, EmptyState,
  useToast…); code-split charts (`ViewsChart`, `WidgetChart`).
- **The real gap**: **33 hand-rolled `<table>` blocks** across admin pages, each
  re-implementing sorting/filtering/pagination inconsistently — no single Data
  Table. This is the prompt's centerpiece ("Enterprise Table System").

## Delivered

- **Pure table engine** `src/lib/admin/dataTable.ts` (6 unit tests): `sortRows`
  (stable, string/numeric, both directions), `filterRows` (global, multi-column),
  `paginate` (clamped, with metadata), `nextSort` (asc→desc→cleared). No I/O.
- **Enterprise DataTable** `src/components/admin/DataTable.tsx` — one reusable,
  generic, accessible table: click-to-sort headers (`aria-sort`), global filter,
  **density** toggle (comfortable/compact), **column visibility** menu,
  pagination, loading skeletons + empty state, optional row click, RTL +
  bilingual. Logic delegates entirely to the pure engine.
- **Design System page** `/admin/design-system` (`DesignSystem`) — the living
  reference + component inventory deliverable: semantic **color tokens**,
  **typography scale**, **buttons** (all variants/sizes/disabled), **badges**,
  **form controls**, **states** (loading/empty), and a live **DataTable over the
  real admin route registry** (65 routes — genuine data, not mock). Added to the
  System workspace nav (RBAC `manage_settings`).

## Adoption model (honest)

The DataTable is shipped, unit-tested, and **used in production on the Design
System page with real data** — not a placeholder component sitting unused.
Migrating the other 33 hand-rolled tables is staged (per-module, verified
individually) to avoid a single high-risk sweep across ~50 pages.

## Validation

- type-check 0 · lint 0 · **210 unit tests** (+6 DataTable engine) · six
  governance audits green (tokens/content/reuse/deps/links/i18n) · build OK
  (`/admin/design-system`).
- **Live smoke test** (running app + real PostgreSQL, logged-in admin): the
  Design System page renders all sections; the DataTable sorts/filters/paginates
  the real 65-route registry (density + column-visibility working). Existing
  pages unchanged (zero regression).

## Remaining roadmap (staged)

Migrate module tables onto DataTable (numbering audit, users, CRM, sales…); add
row selection + bulk actions + CSV export to DataTable; saved views (per user);
virtualization for very large sets; a formal WCAG AA contrast report.
