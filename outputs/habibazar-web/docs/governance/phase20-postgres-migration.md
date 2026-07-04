# Phase 20 — SQLite → PostgreSQL Migration (COMPLETE)

## Status — the runtime now runs exclusively on PostgreSQL

The application no longer uses SQLite at runtime. The Drizzle schema is
`pg-core`, the driver is async `pg` (node-postgres) with a connection pool, the
data was migrated + validated, and `npm run audit:pgcompat` reports **0**.
Verified end-to-end against a live PostgreSQL server (see "Verification").

`better-sqlite3` remains only as a **devDependency** — used by the one-time
migration reader (`scripts/migrate-to-postgres.mjs`) to read a legacy SQLite
file. It is not imported by any runtime code and is not in the production bundle.

## What changed

| Area | Before | After |
| --- | --- | --- |
| Schema (`lib/db/schema.ts`) | `sqlite-core` / `sqliteTable` | `pg-core` / `pgTable` (native `boolean`, `serial`, `text` timestamps, 58 tables) |
| Driver (`lib/db/index.ts`) | `better-sqlite3` (sync) | `pg` `Pool` + `drizzle-orm/node-postgres` (async); `getPool()`, `pgQuery()` helper |
| Migrations (`lib/db/migrate.ts`) | raw `CREATE TABLE` on SQLite | Drizzle migrator (`drizzle/0000_init.sql`) + raw pg DDL for the 5 non-ORM tables |
| Seed (`lib/db/seed.ts`) | sync `INSERT OR IGNORE` | async Drizzle inserts + `onConflictDoNothing` |
| Content resync (`lib/db/resync.ts`) | sync prepared statements | async `?`→`$n` runner over the pool |
| Data-access (66 files) | sync `.get()/.all()/.run()` | `await` (arrays / `[0]`) |
| Raw SQL (14 files) | `$client.prepare()` (better-sqlite3) | `await pgQuery(sql, params)` with `$n` placeholders |
| Backup snapshot | `better-sqlite3 .backup()` | `pg_dump -Fc` (+ `pg_restore -l` archive verification) |
| Health/ops/DB-center | `PRAGMA` / `sqlite_master` | `pg_catalog` / `information_schema` / `pg_database_size` |
| `queries` `INSERT OR IGNORE`/`json_extract`/`datetime('now')` | SQLite | `ON CONFLICT` / JSONB `->>` / `to_char(now(), …)` |

## Data migration engine — `scripts/migrate-to-postgres.mjs`

`npm run db:migrate:pg -- --pg "$DATABASE_URL"` — reads the live SQLite DB,
introspects it, loads every row into the **existing Drizzle-created schema**
(target-column-type aware: coerces SQLite `0/1` → native `boolean`, strips NUL
from text), synchronises `serial` sequences, and validates per-table row-count
parity + full-DB foreign-key validity. Idempotent (`TRUNCATE … RESTART IDENTITY`).

## Provisioning / bootstrap / verify / rollback — `deploy/postgres/`

`install-postgresql.sh` (PG 17 + extensions on Debian/Ubuntu) →
`bootstrap-postgresql.sh` (Drizzle migrate + seed) →
`sqlite-to-postgresql.sh` (backup + data migrate) →
`verify-postgresql.sh` (executed against live PG) →
`rollback-to-sqlite.sh` (checksum-verified fallback snapshot). See
`deploy/postgres/README.md`.

## Verification (executed)

On a clean database the app's own `runMigrations()` + `seedDatabase()` built
**63 tables** (58 ORM + 5 raw) and seeded the admin user + settings. Then, live:

- `GET /api/health` → `{status:"ok"}` (pg probe)
- `POST /api/admin/auth/login` (bcrypt + JWT + DB session) → authenticated
- `POST /api/admin/crm/leads` → `INSERT … RETURNING id` = 1, server-side score 80
- `POST /api/admin/flags` → created (unique-key handling)
- `GET /api/admin/dashboard` → drizzle count aggregates via `Promise.all`
- `GET /api/admin/database/health` → **score 100**, `driver: node-postgres`,
  all checks pass (integrity, FKs, wal, schema)
- `GET /api/admin/operations/overview` → real pg telemetry (probe latency, DB
  size via `pg_database_size`, `server_version`)
- `GET /en`, `/en/blog` → 200 (marketing SSR reads content via Drizzle)
- `GET /api/blog/<slug>` → raw pg JOIN query returns the post

`tsc` 0 · ESLint 0 · vitest 56/56 · all 6 governance audits pass ·
`audit:pgcompat` **0** · production build OK.

## Acceptance
Every SQLite dependency is out of the runtime; every table exists in PostgreSQL;
`pg-core` is used everywhere; `audit:pgcompat` = 0. From here, PostgreSQL is the
only supported runtime database.
