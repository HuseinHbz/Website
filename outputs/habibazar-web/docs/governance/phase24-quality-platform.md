# Phase 24 — Enterprise Quality Platform & UI Consistency Engine

A quality/hardening release — **no new business modules**. The goal is to make
the platform feel like a finished commercial product: one enforced design
language, no dead code, and an automated gate that keeps it that way. Everything
remains fully functional; **zero regression**.

## Baseline (verified before any change)

| Gate | Result |
|------|--------|
| TypeScript | 0 errors |
| ESLint | 0 warnings |
| Unit tests | 256 passing (37 files) |
| Governance audits | 6/6 pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| SQLite refs in runtime `src/` | 0 (PostgreSQL-native confirmed) |
| TODO/FIXME/HACK debt | 0 |

## What shipped

### 1. UI Consistency Engine (7th governance audit)

`scripts/ui-consistency-audit.mjs` (`npm run audit:ui`) governs the **type scale**,
complementing the colour-focused `audit:tokens`. It **fails CI on any arbitrary
Tailwind font-size** (`text-[13px]`, `text-[0.9rem]`, …) — the single largest
source of visual drift across the ~50 admin modules — forcing every size onto a
named scale token. Arbitrary interactive control heights are reported
informationally. Wired into `npm run audit` and the CI ESLint job.

### 2. Type-scale standardization (150 fixes)

The scale in `tailwind.config.ts` gained on-scale micro tokens **`4xs`
(0.5625rem/9px)**, **`3xs` (0.625rem/10px)** alongside the existing **`2xs`
(11px)**. All **150** arbitrary micro font-sizes across `src/` were migrated:

- `text-[11px]` → `text-2xs` (46)
- `text-[10px]` → `text-3xs` (82)
- `text-[9px]`/`text-[8px]` → `text-4xs` (22)

Result: `audit:ui` arbitrary font sizes **0 (budget 0)**.

### 3. Dead-code removal

Removed the orphaned `src/app/admin/hero/HeroEditor.tsx` (401 lines) — fully
superseded by the Phase-23 `HeroCenter` + `HeroBuilder` and no longer referenced
anywhere. The legacy public `Hero.tsx` renderer and its DB-backed fallback
content are untouched, so the home page is unaffected.

### 4. PostgreSQL foreign-key index audit

Live schema introspection (against real PostgreSQL) found **83** foreign-key
columns lacking a covering index. Rather than index all 83 blindly, **24 covering
indexes** were added for the *hot* structural/lookup FKs that actually participate
in JOIN/WHERE — session & RBAC lookups, join tables (`page_sections`,
`section_versions`), tree parents (`gl_accounts.parent_id`), and
category/product/period/source lookups. Audit-trail FKs
(`created_by`/`updated_by`/`author_id`/`owner_id`/…) are **intentionally left
unindexed** — they are almost never filtered on and indexing them only adds write
cost + bloat. All new indexes are idempotent (`CREATE INDEX IF NOT EXISTS`) in
`migrate.ts`. Re-audit: FK-without-index **83 → 59**; every hot FK covered.
Verified via a live introspection round-trip.

### 5. Utility de-duplication — `money()`

Seven near-identical `money()` formatters had drifted across the admin
ERP/CRM/dashboard modules (different fraction digits, sign handling,
dash-for-zero). Consolidated the formatting logic into one options-driven
`fmtMoney` (`src/lib/format.ts`); each module keeps a one-line binding that
preserves its exact house style. Verified **byte-for-byte identical over 63
cases** (7 variants × 9 inputs) — zero visual regression. The domain-specific
`slugify` in the heroes route (60-char cap + fallback) and the currency/rounding
`money` in `erp/documents`+`reports` are purpose-distinct and left as-is.

### 6. Design-system reference completeness

The `/admin/design-system` type-scale reference now lists the micro tokens
(`2xs`/`3xs`/`4xs`) so the design-language reference stays truthful to the scale
the `audit:ui` gate enforces.

## Verification (all green, post-change)

- TypeScript 0 · ESLint 0 · **256 unit tests** pass
- **All 7 governance audits pass** (tokens/content/reuse/deps/links/i18n/**ui**)
- Production build OK — 96 static pages generated, shared First Load JS 102 kB
- `npm audit --omit=dev` — 0 vulnerabilities

## Acceptance snapshot

✓ PostgreSQL only (0 SQLite refs) · ✓ 0 arbitrary font sizes · ✓ 0 broken
internal links · ✓ 0 missing/empty translations · ✓ 0 arbitrary colour classes ·
✓ 0 orphaned Hero editor · ✓ 0 lint/type errors · ✓ build green · ✓ no regression.
