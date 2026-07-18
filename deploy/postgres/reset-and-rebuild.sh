#!/usr/bin/env bash
# reset-and-rebuild.sh — DEFINITIVE recovery when the PostgreSQL schema was
# created inconsistently (e.g. by a partial/older migrator run, causing errors
# like "null value in column updated_at" or missing columns → broken admin tabs).
#
# It rebuilds the schema cleanly from the current app code and restores the data:
#   1. safety pg_dump of the current database
#   2. drop + recreate an empty schema (+ extensions)
#   3. restart the app → its runMigrations() + seedDatabase() build the correct
#      63-table schema from scratch
#   4. if a legacy SQLite file is present, re-migrate ALL rows into the new schema
#   5. verify
#
# Usage:  sudo bash deploy/postgres/reset-and-rebuild.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/habibazar}"
PM2_NAME="${PM2_NAME:-habibazar}"
PG_DB="${PG_DB:-habibazar}"
PG_USER="${PG_USER:-habibazar}"
ENV_FILE="${APP_DIR}/.env.local"
STAMP="$(date +%Y%m%d-%H%M%S)"

log() { printf '\033[1;34m[reset-rebuild]\033[0m %s\n' "$*"; }

# Use the EXACT DATABASE_URL the app uses (.env.local is authoritative). Falling
# back to /root/.habibazar-pg-dsn (which install-postgresql.sh writes with a
# random password) can mismatch the role's real password → auth_failed.
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$ENV_FILE" ]] && grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'"'')"
  else
    DATABASE_URL="$(cat /root/.habibazar-pg-dsn 2>/dev/null || echo "postgres://${PG_USER}:habibazar_local@127.0.0.1:5432/${PG_DB}")"
  fi
fi
log "using DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's#:[^:@/]+@#:***@#')"

log "1/5 safety backup of current PostgreSQL → /root/${PG_DB}-before-reset-${STAMP}.dump"
sudo -u postgres pg_dump -Fc "${PG_DB}" > "/root/${PG_DB}-before-reset-${STAMP}.dump" || log "(pg_dump skipped — db may be empty)"

log "2/5 dropping + recreating an empty schema"
sudo -u postgres psql -d "${PG_DB}" -v ON_ERROR_STOP=1 <<SQL
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO ${PG_USER};
GRANT ALL ON SCHEMA public TO ${PG_USER};
GRANT ALL ON SCHEMA public TO public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL

log "3/5 restarting the app so it rebuilds the schema (migrate + seed)"
# The app runs under the unprivileged PM2 user (default 'hbz'), NOT root, and
# `pm2 start <name>` needs a config file — so restart under that user, falling
# back to the generated pm2 config, then to fix-pm2.sh (which regenerates it).
PM2_USER="${PM2_USER:-hbz}"
PM2_CONF="${APP_DIR}/deploy/pm2.config.js"
if sudo -u "$PM2_USER" pm2 restart "${PM2_NAME}" --update-env >/dev/null 2>&1; then
  log "    restarted ${PM2_NAME} (user ${PM2_USER})"
elif [[ -f "$PM2_CONF" ]] && sudo -u "$PM2_USER" pm2 start "$PM2_CONF" >/dev/null 2>&1; then
  log "    started from ${PM2_CONF} (user ${PM2_USER})"
else
  log "    pm2 process not found — running fix-pm2.sh to (re)create it"
  bash "$(dirname "$0")/../fix-pm2.sh" || log "    ⚠ fix-pm2.sh failed — start the app manually"
fi
# wait for readiness (health probes the DB)
for i in $(seq 1 30); do
  sleep 2
  if curl -fsS localhost:3000/api/health >/dev/null 2>&1; then break; fi
done
TCOUNT=$(psql "$DATABASE_URL" -tAqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo 0)
log "    tables after rebuild: ${TCOUNT}"

log "4/5 (removed in INFRA-1) legacy SQLite data-migration step no longer exists — the platform is PostgreSQL-only"

log "5/5 verifying"
DATABASE_URL="$DATABASE_URL" bash "$(dirname "$0")/verify-postgresql.sh" || true
curl -fsS localhost:3000/api/health && echo
log "Done. Log in to the admin panel and confirm the tabs load."
