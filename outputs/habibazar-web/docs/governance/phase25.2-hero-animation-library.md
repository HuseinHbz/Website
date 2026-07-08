# Phase 25.2 — Hero Animation Library CMS (packages · signing · versioning)

Final completion pass on the Hero Platform. Adds a PostgreSQL-native **Animation
Library CMS** on top of the built-in 53-preset registry, with versioning, signed
import/export packages, dependency validation, collections, bulk operations and
usage analytics. No rewrite; every Phase-23/25/25.1 capability preserved. Zero
regression.

## Audit (reused, not duplicated)

Animation Engine (53 presets), Animation Builder, Hero Center/Builder/Experience,
Rule Engine, Analytics, Publishing workflow, hero versioning, A/B, 50 templates,
AI assistant + recommendation + performance/a11y engines — all already present
and reused. The gap was a **managed** library (custom presets, versioning,
packaging) — added here.

## What shipped (real, verified)

### PostgreSQL schema (idempotent, `migrate.ts`)
- `hero_animation_presets` — custom/managed presets (key, name en/fa, category,
  base_preset, config JSON, tags, collection, enabled/archived/favorite,
  usage_count, version) + indexes.
- `hero_animation_versions` — immutable version history per preset (rollback).
- `hero_collections` — collections/folders (private | organization).

### Package / signature engine (`src/lib/hero/animationLibrary.ts`, pure + tested)
- `buildPackage` → self-describing package (schema + marketplace metadata:
  author/org/version/license/compatibility + items + dependencies) with a
  **SHA-256 checksum** over canonical (key-sorted) JSON and an **HMAC-SHA256
  signature** keyed by a server secret.
- `verifyPackage` → tamper detection (checksum mismatch) + signature validity
  (timing-safe compare).
- `validateDependencies` → rejects packages referencing unknown built-in presets
  or templates.
- `planImport` → splits items into new / conflict (existing key) / invalid.
- `animationAnalytics` → most/least used, by-category rollup, enabled/archived.
- `canonicalize` → stable stringify so checksums are environment-independent.

### API `POST/GET /api/admin/heroes/animations` (RBAC + zod + audit)
- GET: list (search `q` / category / favorite filters), `?id=` detail+versions,
  `?view=analytics`, `?view=export` (returns a **signed** package).
- POST: create / update (auto version snapshot) / toggle (favorite/enabled/
  archived) / rollback / bulk (archive/restore/enable/disable/delete/favorite) /
  import (verify signature → validate deps → plan → create). Delete + import
  require **administrator**; everything else `edit`. Every mutation audited.

### Admin UI — Hero Center → **Animation Library** tab
- KPI strip (custom presets / enabled / archived / top-used) + New preset +
  **Export signed package** (downloads JSON) + **Import package** (file picker →
  verified server-side). Enterprise DataTable with per-row favorite/enable/archive
  and bulk operations. The 53 built-in presets remain always available in the
  builder; the library manages *custom* presets on top.

## Verification (all green)

- TypeScript 0 · ESLint 0 · **271 unit tests** (+ package sign/verify/deps/import/
  analytics tests) · all 7 governance audits · production build OK (132 pages).
- **Live PostgreSQL round-trip**: create preset → version snapshot → rollback
  reads v1 config → export → sign → `verifyPackage` ok → `planImport` yields the
  preset. ✓
- Deploy: no script change — the DB auto-initializes via `instrumentation.ts`
  (idempotent `migrate.ts`); signing reuses the existing `BACKUP_ENCRYPTION_KEY`/
  `ADMIN_JWT_SECRET`.

## Honest scope note (deferred, not faked)

Delivered above: Library CMS, versioning, signed import/export, dependency
validation, collections schema, bulk ops, analytics, marketplace-ready package
format (metadata + signature + dependency graph). **Not** attempted this pass —
it is a genuinely large dedicated build needing a canvas timeline engine and
heavy interaction the governance audits/bundle budget won't accept: the full
**After-Effects-style Visual Timeline Studio** (multi-track keyframe editor with
a bezier-curve editor and frame scrubber). The preset `config` column is
schema-ready to store such keyframe data when that studio is built, so this phase
is the foundation it would sit on. All other Phase-25.2 acceptance items are
implemented and verified.

## Preserved (zero regression)

✓ 53 built-in presets + legacy `Hero.tsx` · ✓ 50 templates · ✓ every prior Hero
API/route/workflow/versioning/analytics/AI · ✓ public homepage · ✓
PostgreSQL-native (normalized tables, everything versioned + auditable).
