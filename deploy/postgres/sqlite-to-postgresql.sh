#!/usr/bin/env bash
# sqlite-to-postgresql.sh — automated data migration (SQLite → PostgreSQL).
# Backs up SQLite first, then runs the Node migration engine
# (scripts/migrate-to-postgres.mjs): introspect → create schema → copy data in
# FK order → sync sequences → validate row counts + checksums → JSON report.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/habibazar}"
SQLITE_DB="${DB_PATH:-${APP_DIR}/data/habibazar.db}"
DATABASE_URL="${DATABASE_URL:-$(cat /root/.habibazar-pg-dsn 2>/dev/null || true)}"
BATCH="${BATCH:-500}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-${APP_DIR}/data/pre-pg-migration}"

log() { printf '\033[1;34m[sqlite→pg]\033[0m %s\n' "$*"; }

[[ -z "$DATABASE_URL" ]] && { echo "DATABASE_URL not set (run install-postgresql.sh first)."; exit 1; }
[[ -f "$SQLITE_DB" ]] || { echo "SQLite DB not found: $SQLITE_DB"; exit 1; }

log "1/3 Backing up SQLite (consistent snapshot) → ${BACKUP_DIR}"
mkdir -p "$BACKUP_DIR"
# WAL-safe copy via sqlite3 .backup (consistent even under load)
if command -v sqlite3 >/dev/null; then
  sqlite3 "$SQLITE_DB" ".backup '${BACKUP_DIR}/habibazar-${STAMP}.db'"
else
  cp "$SQLITE_DB" "${BACKUP_DIR}/habibazar-${STAMP}.db"
fi
sha256sum "${BACKUP_DIR}/habibazar-${STAMP}.db" > "${BACKUP_DIR}/habibazar-${STAMP}.db.sha256"
log "    backup: ${BACKUP_DIR}/habibazar-${STAMP}.db (+ sha256)"

log "2/3 Running migration engine (batch=${BATCH})…"
cd "$APP_DIR"
DATABASE_URL="$DATABASE_URL" node scripts/migrate-to-postgres.mjs \
  --sqlite "$SQLITE_DB" \
  --pg "$DATABASE_URL" \
  --batch "$BATCH" \
  --report "${BACKUP_DIR}/migration-report-${STAMP}.json"

log "3/3 Migration report: ${BACKUP_DIR}/migration-report-${STAMP}.json"
node -e "const r=require('${BACKUP_DIR}/migration-report-${STAMP}.json'); if(!r.ok){console.error('MIGRATION NOT OK'); process.exit(1)} console.log('OK — tables:',r.tables.length,'rows:',r.totalRows)"
log "Data migration complete + validated."
