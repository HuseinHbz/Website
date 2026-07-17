# Component Reusability Governance

_Shared primitives for the patterns every screen repeats; drift tracked by audit._

## Shared libraries (source of truth)

| Concern | Primitive | Location |
| --- | --- | --- |
| Marketing UI atoms | `Button`, `Card`, `Input`, `Select`, `Textarea`, `Section`, `SectionHeading`, `LoadingSpinner`, `StatusNode` | `src/components/ui/` |
| Admin UI kit | `Card`, `Btn`, `Input`, `Select`, `Table`, `Modal`, `Badge`, `PageHeader`, `useToast`, `ColorDot`, … | `src/components/admin/ui.tsx` |
| Admin shell / chrome | `AdminShell`, `AdminSidebar`, `AdminHeader`, `CommandPalette`, `MediaPicker`, `ImageUploadCrop` | `src/components/admin/` |
| **Admin data access** | `crud` client + `useResource` hook | `src/lib/admin/crud.ts` |
| Theme / toast providers | `ThemeProvider`, `Toast` | `src/components/ds/` |
| i18n strings | `useT`, `useAdminLocale` | `src/lib/admin/locale.tsx` |

## The extracted primitive

Every admin manager was hand-rolling the same fetch idiom:

```ts
// before — repeated in ~45 files
const r = await fetch('/api/admin/x'); setItems(await r.json())
await fetch('/api/admin/x', { method: e.id ? 'PUT' : 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) })
```

`src/lib/admin/crud.ts` centralizes it:

```ts
// after
const { data: items, reload } = useResource<X>('/api/admin/x')
await crud.save('/api/admin/x', editing)         // POST or PUT by id
await crud.remove('/api/admin/x', id)            // DELETE
await crud.patch('/api/admin/x', { id, active }) // partial update
```

`useResource` also owns loading state and a **stable** `reload` (memoized with
`useCallback`), avoiding the refetch-loop class of bug documented in CLAUDE.md.

## Automated tracking

`npm run audit:reuse` (`scripts/reusability-audit.mjs`) counts remaining
hand-rolled fetch idioms per admin component and lists the top migration
candidates. Informational (does not fail CI) — the number is a debt metric to
drive toward zero.

```
npm run audit:reuse            # ranked migration candidates
npm run audit:reuse -- --json  # machine-readable per-file breakdown
```

## Progress

| Metric | Before | Now |
| --- | --- | --- |
| Admin files using raw fetch | 45 | 43 |
| Raw write idioms | 74 | 68 |
| Raw list idioms | 60 | 58 |

Migrated as reference implementations: **SkillsManager**, **ClientsManager**,
**ProjectsManager** (two-resource, single-resource, and case-study variants) —
each now uses `useResource` + `crud.*` with no behavior change.

## Duplicate-component review

- `components/ui/*` (marketing) vs `components/admin/ui.tsx` (admin) intentionally
  stay separate — different design languages (public dark-glass vs dense admin
  tables). Merging would couple two design systems; **kept apart by design.**
- No >80%-identical component pairs were found within either library; the real
  duplication was behavioral (the fetch idiom), now centralized.

## Backlog

Migrate the remaining 43 managers to `crud` + `useResource` opportunistically
(top candidates: `AiControlCenter`, `SeoManager`, `UsersManager`,
`BlogManager`, `MenuBuilder`). Each is mechanical and independently shippable;
re-run `npm run audit:reuse` to watch the count fall.
