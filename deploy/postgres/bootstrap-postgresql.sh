#!/usr/bin/env bash
# bootstrap-postgresql.sh — create the schema + seed on a freshly provisioned
# PostgreSQL database. Idempotent: the app's own runMigrations() (Drizzle
# migrator + raw DDL for the non-ORM tables) + seedDatabase() run on startup, so
# bootstrapping is simply "start the app once" — but this script makes it explicit
# for CI / first-deploy, and validates the result.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/habibazar}"
DATABASE_URL="${DATABASE_URL:-$(cat /root/.habibazar-pg-dsn 2>/dev/null || true)}"

log() { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
[[ -z "$DATABASE_URL" ]] && { echo "DATABASE_URL not set (run install-postgresql.sh first)."; exit 1; }

cd "$APP_DIR"

log "Applying Drizzle migrations (schema) + raw non-ORM tables…"
# The migrator + raw DDL live in src/lib/db/migrate.ts and run automatically on
# server boot. Trigger them headlessly via a tiny loader.
DATABASE_URL="$DATABASE_URL" node --input-type=module -e "
  const { runMigrations } = await import('./.next/server/chunks/_lib_db_migrate.js').catch(async () => await import('./src/lib/db/migrate.ts'))
  await runMigrations()
  console.log('migrations ok')
" 2>/dev/null || {
  log "Direct import unavailable in this build; falling back to a one-shot app boot."
  log "Start the app once (systemd/pm2) — instrumentation.ts runs migrate + seed automatically."
}

log "Verifying schema…"
TCOUNT=$(psql "$DATABASE_URL" -tAqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
log "public tables: ${TCOUNT}"
[[ "${TCOUNT:-0}" -ge 58 ]] && log "Bootstrap OK (schema present)." || log "Schema incomplete — start the app once to let instrumentation build it."
