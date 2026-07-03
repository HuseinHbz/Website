#!/usr/bin/env bash
# rollback-to-sqlite.sh — one-command rollback to the SQLite fallback taken by
# sqlite-to-postgresql.sh, in case a PG cutover must be reverted.
# Restores the pre-migration SQLite snapshot and points the app back at it.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/habibazar}"
SQLITE_DB="${DB_PATH:-${APP_DIR}/data/habibazar.db}"
BACKUP_DIR="${BACKUP_DIR:-${APP_DIR}/data/pre-pg-migration}"

log() { printf '\033[1;33m[rollback→sqlite]\033[0m %s\n' "$*"; }

SNAP="$(ls -1t "${BACKUP_DIR}"/habibazar-*.db 2>/dev/null | head -1 || true)"
[[ -z "$SNAP" ]] && { echo "No pre-migration SQLite snapshot in ${BACKUP_DIR}."; exit 1; }

log "verifying snapshot checksum…"
if [[ -f "${SNAP}.sha256" ]]; then (cd "$(dirname "$SNAP")" && sha256sum -c "$(basename "$SNAP").sha256"); fi

log "restoring ${SNAP} → ${SQLITE_DB}"
[[ -f "$SQLITE_DB" ]] && cp "$SQLITE_DB" "${SQLITE_DB}.superseded-$(date +%s)" || true
rm -f "${SQLITE_DB}-wal" "${SQLITE_DB}-shm"
cp "$SNAP" "$SQLITE_DB"

log "Point the app back at SQLite: remove DATABASE_URL (or set DB_DRIVER=sqlite) in .env.local, then:"
echo "    pm2 reload habibazar"
log "Rollback complete."
