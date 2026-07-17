# Dependency & Bundle Governance

_Lean runtime, no dead weight, heavy libraries code-split out of the hot path._

## Runtime vs build dependencies

`npm ci` (full) → `next build` → `npm prune --omit=dev` is the deploy flow, so
anything only needed at build time belongs in `devDependencies` and is stripped
from the production install.

Moved build-only tooling out of runtime `dependencies` → `devDependencies`:
`typescript`, `tailwindcss`, `postcss`, `autoprefixer`, and the type package
`@types/qrcode`. The production install now ships **18 runtime deps** (was 23).

## Dependency inventory

| Dependency | Used by | Verdict |
| --- | --- | --- |
| next, react, react-dom | framework | core |
| better-sqlite3, drizzle-orm | 65 files (data layer) | core |
| next-intl | 17 files (i18n/RTL) | core |
| framer-motion | 22 files (animation) | core |
| jose, bcryptjs, otplib | auth (JWT / hash / TOTP) | core |
| zod | 5 files (API validation) | core |
| nanoid | 6 files (ids) | core |
| clsx + tailwind-merge | `lib/utils.ts` `cn()` | core (complementary, not duplicates) |
| recharts | 2 admin dashboards | heavy — **code-split** (see below) |
| qrcode | 2FA setup | core |
| react-image-crop | media upload/crop | core |
| nodemailer | `lib/notifications.ts` (dynamic import) | core |

No unused, duplicate, or deprecated runtime packages. `npm audit` reports **0
vulnerabilities**.

## Bundle optimization

**recharts (~130 kB)** was eagerly imported by the `/admin` landing dashboard.
Extracted the chart into `src/app/admin/ViewsChart.tsx` and loaded it via
`next/dynamic({ ssr: false })` with a skeleton fallback.

| Route | First Load JS before | after |
| --- | --- | --- |
| `/admin` | 247 kB | **136 kB** (−111 kB) |

recharts now ships as its own chunk that loads only when a dashboard with data
renders. Public marketing routes never referenced recharts (verified — their
First Load is 102–201 kB, driven by framer-motion on animated pages).

Tree-shaking / code-splitting is otherwise handled by Next's per-route bundling;
admin and marketing already live under separate route trees with separate root
layouts, so admin-only weight never reaches public visitors.

## Automated enforcement

`npm run audit:deps` (`scripts/dependency-audit.mjs`, wired into CI) **fails the
build** if a runtime dependency is never imported, if a build-only tool sits in
`dependencies`, or if a `@types/*` package leaks into runtime.

```
npm run audit          # run all four governance audits
npm run audit:deps     # dependency/bundle audit only
```

## Snapshot

| Metric | Value |
| --- | --- |
| Runtime dependencies | 18 (was 23) |
| Dev dependencies | 17 |
| Unused runtime deps | 0 ✓ |
| Build tools in runtime | 0 ✓ |
| `npm audit` vulnerabilities | 0 ✓ |
| `/admin` First Load JS | 136 kB (−111 kB) |
