# Phase 21.11 — Enterprise Numbering Engine (final report)

The single source of truth for document numbers across every ERP/CRM/Enterprise
module. A concurrency-safe platform service — not a per-module helper. Built and
verified against real PostgreSQL, then wired into the live modules.

## Architecture overview

```
 module create routes            numbering service                PostgreSQL
 (sales / documents / ─── nextNumber() ─► generateDocumentNumber ─► BEGIN
  projects / future)                     preview / validate /        advisory_xact_lock
                                          reserve / release /         INSERT … ON CONFLICT
                                          resetCounter                  … RETURNING  (atomic)
                                                │                     audit insert
                                          pure format core           COMMIT
                                          (renderNumber, periodKey,
                                           padCounter, formatRegex)
```

- **Pure core** `src/lib/numbering/format.ts` (unit-tested) — deterministic, no I/O:
  `periodKey` (never/daily/weekly/monthly/quarterly/yearly/fiscal), `renderNumber`
  (15 placeholders), `padCounter` (numeric/hex), `validateFormat`, `formatRegex`.
- **Service** `src/lib/numbering/service.ts` — `generateDocumentNumber`,
  `previewDocumentNumber` (=`getNextNumber`), `validateDocumentNumber`,
  `reserveNumber`, `releaseReservedNumber`, `resetCounter`; auto-fills
  `{RANDOM}`/`{UUID}`.
- **Integration** `src/lib/numbering/integrate.ts` — `nextNumber()`, the one call
  every module uses (safe fallback if a format is somehow absent).
- **Admin data / io / templates** — `data.ts`, `io.ts` (JSON/CSV import-export),
  `templates.ts` (curated starters).

## Database schema (ER)

```
users ──┐
        │ created_by / user_id (SET NULL)
        ▼
┌───────────────────────┐        ┌──────────────────────────────┐
│ numbering_formats      │1      │ numbering_counters            │
│  id PK                 │───────│  id PK                        │
│  doc_type UNIQUE       │      n│  format_id FK ─► formats.id   │
│  name_en/fa            │        │  scope_key                    │
│  pattern, prefix,suffix│        │  period_key                   │
│  reset_policy          │        │  current_value BIGINT         │
│  padding, increment    │        │  last_number                  │
│  start/min/max_number  │        │  UNIQUE(format_id,scope_key,  │
│  alphabet, random_length│       │          period_key)          │
│  fiscal_start_month     │       └──────────────────────────────┘
│  active                 │
└───────────┬────────────┘        ┌──────────────────────────────┐
            │ format_id (SET NULL) │ numbering_audit               │
            └─────────────────────►│  id PK, format_id FK          │
                                   │  doc_type, number             │
┌──────────────────────────┐      │  scope_key, period_key        │
│ numbering_scopes          │      │  counter_value                │
│  id PK                    │      │  module, source, status       │
│  kind (company|branch|    │      │  user_id FK, ip, created_at   │
│        warehouse|dept)    │      └──────────────────────────────┘
│  code, name_en/fa, active │       indexes: (doc_type,created_at),
│  UNIQUE(kind, code)       │                (number), (format_id)
└──────────────────────────┘
```

## PostgreSQL sequence / concurrency strategy

Postgres native `SEQUENCE`s cannot express per-(scope, period) counters that
reset, so the engine uses a **counter row** as the sequence, incremented
atomically:

1. `BEGIN`.
2. `SELECT pg_advisory_xact_lock(hashtextextended('<format>:<scope>:<period>', 0))`
   — serialises this exact bucket across sessions; auto-released at COMMIT/ROLLBACK.
3. `INSERT INTO numbering_counters (…, current_value) VALUES (…, start_number)
   ON CONFLICT (format_id, scope_key, period_key)
   DO UPDATE SET current_value = numbering_counters.current_value + increment
   RETURNING current_value` — the unique index makes the increment atomic even
   without the advisory lock; the lock adds defence-in-depth + guards the overflow
   check.
4. Overflow check vs `max_number`, `renderNumber`, `last_number` update, audit
   insert, `COMMIT`.

A new `period_key` (from the reset policy) starts a fresh counter; a new
`scope_key` (company|branch|warehouse|department) is fully independent → SAP-style
multi-company/branch/warehouse numbering with no cross-talk.

## Files changed

- Schema: `src/lib/db/migrate.ts` (+`numbering_formats/counters/audit/scopes`,
  seed of 15 default formats, `random_length` ALTER).
- Engine: `src/lib/numbering/{format,service,integrate,data,io,templates}.ts` +
  `__tests__/format.test.ts`.
- APIs: `/api/admin/erp/numbering` (CRUD + views), `/generate`, `/io`, `/scopes`.
- UI: `src/app/admin/numbering/{page,NumberingCenter}.tsx` (7 tabs), sidebar entry,
  `num_*` locale keys.
- Module wiring: `sales/documents/route.ts`, `lib/erp/documentData.ts`,
  `projects/route.ts` now mint via `nextNumber()`.

## Test results (real PostgreSQL)

| Check | Result |
|---|---|
| Concurrency: 500 simultaneous generations | 500 unique · **0 duplicates** · perfect 1..500 sequence |
| DB-side duplicate query | 0 |
| Yearly reset (2026→2027) | counter restarts at 1 |
| Scope independence (TEH vs MSH) | both counter 1 (`B-TEH-001` / `B-MSH-001`) |
| Preview | stable, non-consuming |
| Module wiring: 200 concurrent sales invoices | 200 unique `INV-2026-NNNNNN` |
| Generated-doc series (`doc_*`) | independent, starts at 1 |
| `{RANDOM}` auto-fill (len 5) | `RN-9XNC8-001`, distinct per call |
| `{UUID}` auto-fill | valid v4 UUID |
| Import/export round-trip | export 17 · CSV has `randomLength` · import upsert (`IMP-0100`) · bad row skipped |
| Live HTTP flow (logged-in admin) | login 200 · 6 generations 200 · scope 200 · dashboard KPIs correct |

Unit tests: `format` 9/9, `pivot` 5/5. type-check 0 · lint 0 · six governance
audits green · production build OK (5 routes compiled). Screenshots captured from
the running app (FA dashboard, formats, visual builder, templates).

## Permissions

Granular perms mapped onto the app's RBAC: **view / export / audit** = any admin;
**manage formats / generate** = `edit` (editor+); **reset counter / import config**
= `manage_settings` (administrator+).

## Future extensibility

Unlimited document types (no hardcoding); `{CUSTOM_FIELD}` + `{RANDOM}`/`{UUID}`
already flow through; scopes registry ready for module-level company/branch
pickers; custom reset rules can extend `periodKey`. Excel export and a per-module
scope selector in each create form are the documented next step.
