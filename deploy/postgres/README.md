# PostgreSQL Migration Suite (`deploy/postgres/`)

Optional, production-ready tooling to migrate the HBZ platform's **data tier**
from SQLite to PostgreSQL on Debian 12 / Ubuntu 24.04.

> **Status (honest).** The migration **engine + scripts are real and executed**:
> the live SQLite database has been migrated into a real PostgreSQL server with
> exact per-table row-count + checksum parity (64 tables). The **application
> runtime still uses the synchronous `better-sqlite3` driver** — the async-driver
> cutover is the remaining step, tracked by `npm run audit:pgcompat` (target: 0).
> Until that cutover lands, production continues to run on SQLite; these scripts
> provision PostgreSQL and migrate/verify the data so the cutover is a config
> switch, not a data operation. See
> `outputs/habibazar-web/docs/governance/phase20-postgres-migration.md`.

## Scripts

| Script | What it does |
| --- | --- |
| `install-postgresql.sh` | Adds the PGDG repo, installs PostgreSQL 17 + client + contrib + `pgvector`, sets UTF-8 locale + timezone, creates the cluster, role, database and extensions (`pgcrypto`, `pg_trgm`, `uuid-ossp`, `pg_stat_statements`, `vector`), configures `pg_hba.conf` (scram-sha-256), enables auto-start, and writes `DATABASE_URL` to `/root/.habibazar-pg-dsn`. |
| `sqlite-to-postgresql.sh` | Takes a WAL-safe SQLite backup (+ sha256), then runs the migration engine and asserts the report is `ok`. |
| `verify-postgresql.sh` | Read-only checks: connectivity, extensions, table census, row counts, FK validation, cache-hit ratio, DB size. |
| `restore-postgresql.sh` | Restores a `pg_dump` (custom or plain) into a freshly recreated database. |
| `rollback-to-sqlite.sh` | One-command revert to the checksum-verified pre-migration SQLite snapshot. |

The migration engine itself is `outputs/habibazar-web/scripts/migrate-to-postgres.mjs`
(`npm run db:migrate:pg`): introspect → FK-topological order → value-preserving
schema → batched load → sequence sync → row-count + checksum validation → JSON report.

## Usage

```bash
# 1) provision PostgreSQL 17 (writes DATABASE_URL to /root/.habibazar-pg-dsn)
sudo PG_DB=habibazar PG_USER=habibazar deploy/postgres/install-postgresql.sh

# 2) migrate the data (backs up SQLite first, then validates parity)
sudo APP_DIR=/var/www/habibazar deploy/postgres/sqlite-to-postgresql.sh

# 3) verify against the live PostgreSQL
DATABASE_URL="$(cat /root/.habibazar-pg-dsn)" deploy/postgres/verify-postgresql.sh

# 4) track the remaining runtime cutover (target: 0 hits)
cd /var/www/habibazar && npm run audit:pgcompat

# rollback (revert to SQLite snapshot) if needed
sudo deploy/postgres/rollback-to-sqlite.sh
```

## Environment

| Var | Default | Used by |
| --- | --- | --- |
| `PG_VERSION` | `17` | install |
| `PG_DB` / `PG_USER` | `habibazar` | install, restore |
| `PG_PASSWORD` | random | install |
| `PG_LOCALE` / `PG_TIMEZONE` | `en_US.UTF-8` / `UTC` | install |
| `DATABASE_URL` | `/root/.habibazar-pg-dsn` | migrate, verify, restore |
| `APP_DIR` | `/var/www/habibazar` | migrate, rollback |
| `DB_PATH` | `$APP_DIR/data/habibazar.db` | migrate, rollback |
| `BATCH` | `500` | migrate |
