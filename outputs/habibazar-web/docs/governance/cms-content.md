# CMS Content Governance

_Every user-facing string and asset is CMS-managed; source carries only structural
chrome and safe fallbacks._

## Content ownership model

| Content type | Source of truth | Notes |
| --- | --- | --- |
| Marketing copy (hero, about, services, projects, solutions, blog, …) | SQLite tables (`hero`, `about_content`, `services`, `projects`, …) — bilingual `*_en` / `*_fa` columns | Edited in `/admin`; read via `lib/publicData.ts`. |
| Global config (name, contact, social, SEO) | `site_settings` key/value | Edited under `/admin/about` + `/admin/settings`. |
| Static UI chrome (labels, buttons, states) | `messages/{fa,en}.json` (next-intl) + `lib/admin/locale.tsx` | Not content — interface strings, fully translated. |
| In-source **fallback defaults** | Component `_defaults` objects | Rendered only when the matching CMS row is empty, so a fresh install is never blank. |
| Media | `public/uploads/` via `POST /api/admin/media` | Uploaded at runtime; served by `app/uploads/[...path]/route.ts`. |

## Policy

1. No Lorem Ipsum or placeholder filler ships in source.
2. User-facing copy lives in a CMS table or the i18n message catalog — never a
   bare inline literal, except a clearly-labelled fallback default.
3. Empty states are intentional, translated messages ("Products coming soon"),
   not junk content.
4. Referenced media must be seedable through the CMS.

## Automated enforcement

`npm run audit:content` (`scripts/content-governance-audit.mjs`, wired into CI):

- **Fails** the build on any Lorem Ipsum / placeholder filler in source.
- Reports every `/uploads/` reference and flags those not present in the repo —
  these are CMS-runtime assets the operator seeds through `/admin/media` (they
  render as broken images until uploaded, by design).

```
npm run audit:content            # human report
npm run audit:content -- --json  # machine report with file/line + media list
```

## Current compliance snapshot

| Metric | Value |
| --- | --- |
| Files scanned | 262 |
| **Lorem / placeholder filler** | **0** ✓ |
| `/uploads/` references | 22 |
| Referenced media not in repo (CMS-seeded) | 22 |

## Findings & disposition

- **Lorem Ipsum / dummy content:** none. ✓
- **Duplicate content:** marketing copy is single-sourced per CMS row; the only
  repetition is bilingual `_en`/`_fa` pairs (required) and fallback defaults that
  mirror seed data (intentional).
- **Placeholder strings:** the `coming soon` / `Untitled` strings are translated
  empty-state and list-fallback labels, not unfinished content — retained.
- **Referenced media (22):** logo/certification/OG assets referenced by fallback
  data. They are seeded by the operator via `/admin/media`; until then the CMS
  serves the default reference. Documented so a fresh deploy knows to upload them.

## Backlog

- Consider shipping the default brand/tech logos into `public/uploads/logos/` as
  committed seed assets so fallback data renders without a manual upload step.
- Add graceful `onError` image fallbacks for CMS media so a missing asset degrades
  to a neutral placeholder rather than a broken-image icon.
