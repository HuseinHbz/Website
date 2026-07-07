# Phase 21.11 — Enterprise Numbering Engine (core, completed)

The single source of truth for document numbers across every ERP/CRM/Enterprise
module. A platform service — not a per-module helper. Concurrency-safe, verified
against real PostgreSQL. This first push lands the **engine + admin console**;
existing modules keep their current numbering until a focused migration phase
switches each caller onto `generateDocumentNumber` (no behaviour change here).

## Architecture

```
┌─ numbering_formats ─┐      ┌─ numbering_counters ──────┐   ┌─ numbering_audit ─┐
│ doc_type (unique)   │1───n │ (format,scope,period) uniq │   │ every mint/reserve │
│ pattern, prefix…    │      │ current_value (atomic)     │   │ /release/failed    │
│ reset_policy, pad…  │      │ last_number                │   │ number,user,ip,src │
└─────────────────────┘      └────────────────────────────┘   └────────────────────┘
```

- **Pure core** `src/lib/numbering/format.ts` (9 unit tests): `periodKey`
  (never/daily/weekly/monthly/quarterly/yearly/fiscal), `renderNumber` (14
  placeholders incl. {COMPANY}/{BRANCH}/{WAREHOUSE}/{DEPARTMENT}, empty-separator
  collapse), `padCounter` (numeric/hex), `validateFormat`, `formatRegex`. No I/O.
- **Service** `src/lib/numbering/service.ts`: `generateDocumentNumber`,
  `previewDocumentNumber`/`getNextNumber`, `validateDocumentNumber`,
  `reserveNumber`, `releaseReservedNumber`, `resetCounter`. Every ERP module must
  call this — never duplicate numbering logic.
- **Admin data** `src/lib/numbering/data.ts`: format list (+ live preview),
  counters, audit search, dashboard rollup.

## Concurrency strategy (zero duplicates)

Each mint runs in a transaction that (1) takes `pg_advisory_xact_lock` keyed on
`hashtextextended(format:scope:period)`, then (2) performs an atomic
`INSERT … ON CONFLICT (format_id, scope_key, period_key) DO UPDATE SET
current_value = current_value + increment RETURNING current_value`. The counter
row's unique index serialises concurrent increments; the advisory lock adds
defence-in-depth and guards the overflow check. First number in a bucket =
`start_number`; a new `period_key` (from the reset policy) restarts the counter;
a new `scope_key` (company/branch/warehouse/department) is fully independent.

## Multi-company / branch / warehouse

Independence comes from `scope_key = company|branch|warehouse|department`. Two
scopes share nothing, so Company A and Company B (or Tehran and Mashhad) each get
`…-000001`. No conflicts.

## Admin console (`/admin/numbering`, System group)

Dashboard (KPIs, last-number-per-type, by-module chart, recent activity) ·
Number Formats (CRUD with a **visual builder** — click-to-insert placeholder
chips + instant client-side preview via the pure `renderNumber`) · Counters
(live values + reset) · History & Audit (searchable). Bilingual FA/EN; RBAC
(`requireAdmin('edit'|'delete')`), zod-validated, audit-logged.

## Verification (real PostgreSQL)

- `type-check`, `lint` (0 warnings), unit tests (9/9), all six governance audits
  green, production build OK (`/admin/numbering` + two API routes compiled).
- **Concurrency**: 500 simultaneous `generateDocumentNumber` calls → 500 unique
  numbers, **0 duplicates**, a perfect 1..500 sequence; DB-side duplicate check =
  0. Yearly reset → 2027 restarts at counter 1. Scope independence → `B-TEH-001`
  and `B-MSH-001` both counter 1. Preview is stable and does not consume.
  Validation flags foreign patterns and duplicates. `resetCounter` clears buckets.

## Future extensibility

Unlimited document types (no hardcoding); custom reset rules and {CUSTOM_FIELD}
already flow through; a follow-up phase migrates Sales/Documents/Projects/Assets
callers onto the service and can add import/export (JSON/CSV) + per-permission
scopes on top of the same engine.
