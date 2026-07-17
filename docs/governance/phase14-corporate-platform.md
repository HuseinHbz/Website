# Phase 14 — HBZ Technology Corporate Platform (audit + integrity)

_Same honesty rule as Phases 10–13.5. The spec asks to "transform into the
corporate platform" with ~18 corporate modules — but the audit shows **almost all
of them already exist**. Per the phase's own rules ("do NOT duplicate modules /
replace validated implementations"), the right action is NOT to rebuild them. This
pass runs the required enterprise audit, ships the missing **link/media integrity
validator** (the phase's "Broken Internal Links / Broken Media References"
requirement), and honestly maps existing coverage vs. real gaps. No fabricated
180/180._

## Enterprise audit — corporate modules already present (do NOT duplicate)

| Phase 14 module | Existing admin/route |
| --- | --- |
| Corporate identity / company profile | `/admin/organization`, `/admin/about` |
| Organizations / offices | `/admin/organizations`, `/admin/sites`, `/admin/workspaces` |
| Services | `/admin/services` + `/services` |
| Solutions | `/admin/solutions` + `/solutions` |
| Technology catalog | `/admin/technologies` + `/technologies` |
| Industries | `/admin/industries` + `/industries` |
| Products | `/admin/products` + `/products` |
| Case studies / projects | `/admin/projects` + `/projects`, `/case-studies` |
| Partners | `/admin/partners` |
| Customers / clients + testimonials | `/admin/clients`, `/admin/testimonials` |
| Team / journey / credentials | `/admin/timeline`, `/admin/credentials` |
| Knowledge / blog / academy / docs | `/admin/blog`, `/admin/ai-kb`, `/academy`, `/docs` |
| Media center | `/admin/media` |
| Events | `/admin/events-mgr` + `/events` |
| Leads (contact/consultation/newsletter) | `/admin/contacts`, `/admin/consultations` |
| Search | `/api/search`, `/search` |
| Localization (FA/EN, RTL) | next-intl + `lib/admin/locale.tsx` |
| SEO | `/admin/seo`, `lib/schema.ts` (JSON-LD) |
| CMS building blocks (pages/sections/forms/menus/templates) | `/admin/{pages,sections,forms,menus,templates}` |

Rebuilding any of these would violate the phase's own no-duplication rule.

## Shipped this pass — Link & Media Integrity audit

`scripts/link-integrity-audit.mjs` (`npm run audit:links`, wired into CI):
- Enumerates the real public routes from the App Router
  (`app/[locale]/(marketing)/*` + `app/[locale]/*`).
- Scans every `href` literal in `src/`, normalizes the locale prefix, and **fails
  the build on any internal link whose first segment isn't a real route** — this is
  exactly the class of bug found in Phase 10 (a `Contact → /contact` menu preset
  with no `/contact` page).
- Reports `/uploads/` media references missing from `public/` as warnings
  (operator-seeded at runtime).

### Result (measured)
| Metric | Value |
| --- | --- |
| Public routes discovered | 15 |
| Files scanned | 283 |
| **Broken internal links** | **0** ✓ |
| Missing referenced media (warn) | 4 (`og/page-og.png`, `logos/client.png`, `certifications/cisco.png`, `knowledge/doc.pdf`) |

The 4 missing assets are binary operator-upload content (an OG image, a client
logo, a cert image, a KB PDF). They are **not** on high-traffic public pages (the
Phase-10 browser sweep already confirmed 0 visible console 404s after the 18 tech-
logo placeholders shipped). Fabricating solid-colour stand-ins for a "client logo"
or "certificate" would be exactly the placeholder content these phases forbid, so
they remain honest warnings to be seeded via `/admin/media`.

## Honest roadmap — real gaps NOT delivered this pass

These are genuine enhancements to existing modules (not new modules), each its own
focused effort:
- **CMS approval workflow + version history + scheduled publishing + revision
  comparison** across modules (today: draft/active/status flags exist; full
  workflow does not).
- **Bulk operations** (bulk delete/publish/import/export) in admin lists.
- **Corporate analytics** (top pages/services/downloads, conversion funnel) beyond
  the current `/admin/dashboard` analytics.
- **Lead management** fields (status/source/assignment/tags/notes) on top of the
  existing contact/consultation capture.
- **Semantic/global enterprise search** across all entity types + additional
  languages beyond FA/EN.

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest 37/37 · **all 5 governance audits pass**
(tokens/content/reuse/deps/links; 0 broken internal links) · production build OK.
No modules duplicated; no validated implementations replaced.
