# Phase 23 — Enterprise Hero & Landing Experience Platform

The public-facing landing experience for **HBZ Technology** is now driven by a
versioned, template-driven, per-language configurable Hero platform with a
dedicated admin management center, A/B testing, personalization, analytics and a
publish-time validation gate. Built by extending the existing systems (Design
System, DataTable, RBAC, audit) — **zero regression**: when no Phase-23 hero is
published for a path the site falls back to the legacy `Hero.tsx` variants.

## Architecture

Pure, unit-tested engines (no I/O) do all the logic; the server data layer keeps
SQL in one place; the admin UI and public renderer consume them.

| Layer | File | Responsibility |
|-------|------|----------------|
| Types | `src/lib/hero/types.ts` | `HeroConfig`, content (en/fa), style, blocks, status |
| Templates | `src/lib/hero/templates.ts` | 30 templates (20 legacy `Hero.tsx` variants + 10 premium), constraints, `defaultConfig` |
| Rules | `src/lib/hero/rules.ts` | `validateHero` (title/subtitle/font/CTA bounds, WCAG contrast, background support, overflow/a11y heuristics), `canPublish` gate |
| Experiment | `src/lib/hero/experiment.ts` | deterministic `bucketOf`/`pickVariant`, `experimentResult` (winner needs sample+lift) |
| Personalize | `src/lib/hero/personalize.ts` | `ruleMatches` (device/locale/country/returning/loggedIn/campaign/referral/schedule), `resolveHero` |
| Analytics | `src/lib/hero/analytics.ts` | `summarizeHeroEvents` → views/CTR/conversion/scroll/time + top/worst |
| Data | `src/lib/hero/heroData.ts` | `listHeroes`/`getHero`/`snapshotVersion`/`resolveActiveHero` |

## The 10 premium templates

Executive Corporate · Technology Enterprise · AI Platform · Cyber Security ·
Cloud Infrastructure · Consulting · Minimal Portfolio · Fullscreen Video ·
Split Screen · Product Showcase. Each declares its category, hostable builder
blocks, supported backgrounds and validation constraints.

## Database (idempotent DDL in `migrate.ts`)

- `heroes` — header + `config` JSON, `status` (draft→review→approved→published→archived), `target_path`, `version`.
- `hero_versions` — immutable snapshots for rollback/compare/audit.
- `hero_experiments` — A/B variants (weighted), status, winner.
- `hero_rules` — personalization targeting rules (priority + match JSON).
- `hero_events` — analytics beacons (view/click/conversion/scroll/time).

## APIs

- `GET/POST /api/admin/heroes` — list (+ validation), detail (+ versions), lifecycle (create/update/submit/approve/publish/unpublish/archive/duplicate/rollback/bulk). Publish is **gated by `canPublish`**; one published hero per exact target path.
- `GET/POST /api/admin/heroes/experiments` — experiments + live results from `hero_events`; create/start/stop/promote/delete. Promote publishes the winner.
- `GET /api/admin/heroes/analytics` — 30-day KPI rollup with hero names.
- `POST /api/hero/track` — public, rate-limited, closed-vocabulary analytics beacon; never breaks the page.

All admin routes RBAC-gated (`edit`; delete needs elevated role), zod-validated, audit-logged.

## Admin — Hero Experience Platform (`/admin/hero`)

`HeroCenter` (tabs: Dashboard · Heroes · Templates · A/B Testing · Analytics) —
all tables use the Phase-22 Enterprise DataTable. `HeroBuilder` is a config-driven
editor: per-language content (independent en/fa), full style system
(typography/spacing/buttons/image/background), template + target selection,
**real-time rule validation panel** (blocks publish on errors), multi-breakpoint
(ultrawide→mobile) + dark/light + RTL/LTR live preview, and version history with
one-click rollback.

## Public rendering

`resolveActiveHero('/', ctx, subject)` resolves the hero for a path — running A/B
experiment (deterministic bucket) → personalization rules → published default —
building the request context from headers/cookies (device/locale/country/
returning/loggedIn/referral/schedule). `HeroExperience` renders any template from
config (category-driven layout + background treatment, honouring every style
token, reduced-motion aware) and emits real view/click/conversion/scroll/time
beacons.

## Verification

- Type-check 0 · lint 0 · **256 unit tests** (incl. 16 hero-engine tests) · six governance audits green · production build OK.
- Live PostgreSQL round-trip: publish executive hero for `/` → `resolveActiveHero` returns it → track view/click/conversion → analytics totals match. ✓
