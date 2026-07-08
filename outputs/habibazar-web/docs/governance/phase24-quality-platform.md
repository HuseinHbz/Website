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

## Verification (all green, post-change)

- TypeScript 0 · ESLint 0 · **256 unit tests** pass
- **All 7 governance audits pass** (tokens/content/reuse/deps/links/i18n/**ui**)
- Production build OK — 96 static pages generated, shared First Load JS 102 kB
- `npm audit --omit=dev` — 0 vulnerabilities

## Acceptance snapshot

✓ PostgreSQL only (0 SQLite refs) · ✓ 0 arbitrary font sizes · ✓ 0 broken
internal links · ✓ 0 missing/empty translations · ✓ 0 arbitrary colour classes ·
✓ 0 orphaned Hero editor · ✓ 0 lint/type errors · ✓ build green · ✓ no regression.
