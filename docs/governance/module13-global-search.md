# Module 13 — Global Search (completed)

One search layer across every operational module. Distinct from the public CMS
`/api/search` (marketing content): this is the admin-side search over live
business data — CRM, sales, finance, inventory, assets, projects, documents,
workflows, rules and integrations. Real, verified.

## Design note — fixed sources, parametrised queries

There is **no arbitrary SQL**. A closed registry (`SOURCES`) defines one
parametrised ILIKE query per searchable entity; the search pattern is the only
bound parameter (`$1`). Sources run concurrently; a missing table in a fresh
environment is caught per-source and never breaks the whole search. Ranking is a
pure, unit-tested engine — every module's results share one scoring scale.

## Shipped & verified

- **Pure engine** (`src/lib/search/engine.ts`, 8 unit tests): `tokenize`,
  `scoreField` (exact > prefix > word-boundary > substring), `scoreCandidate`
  (title×3 > subtitle×2 > keywords), `rankHits` (score desc, drop zero), and
  `groupByModule`. No I/O.
- **Server data layer** (`src/lib/search/globalSearch.ts`): 13 sources across 10
  modules; `globalSearch(q, {modules, limit})` → hits grouped by module + a flat
  ranked list + total. Min query length 2.
- **API** `GET /api/admin/search` — `?q=` (+ optional `?modules=` filter);
  no `q` returns the module list for filter chips. RBAC-gated (`requireAdmin`).
- **Global Search UI** (`/admin/search`, `GlobalSearch`) — debounced live search,
  module filter chips, module-grouped result cards linking straight into each
  module. Bilingual FA/EN; sidebar entry in Overview.

## Searchable sources

CRM leads · sales customers · sales documents · GL accounts · GL journal entries
· inventory products · assets · projects · tasks · generated documents ·
workflows · business rules · integrations.

## Verification

- `type-check`, `lint` (0 warnings), unit tests (8/8), all six governance audits
  green, production build OK (`/admin/search` compiled).
- **Real PostgreSQL round-trip**: seeded a customer, an asset and a project;
  `acme` → Acme (sales), `server` → Server R740 (assets), `rollout` → Rollout
  (projects); the `modules=['sales']` filter narrows correctly; a 1-char query
  returns 0 (min-length guard).
