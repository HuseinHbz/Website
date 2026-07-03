#!/usr/bin/env bash
# restore-postgresql.sh — restore a PostgreSQL dump (pg_dump custom or plain).
# Usage: restore-postgresql.sh <dump-file> [--yes]
set -euo pipefail

DUMP="${1:-}"; CONFIRM="${2:-}"
DATABASE_URL="${DATABASE_URL:-$(cat /root/.habibazar-pg-dsn 2>/dev/null || true)}"
PG_DB="${PG_DB:-habibazar}"; PG_USER="${PG_USER:-habibazar}"

[[ -z "$DUMP" || ! -f "$DUMP" ]] && { echo "Usage: $0 <dump-file> [--yes]"; exit 1; }
[[ -z "$DATABASE_URL" ]] && { echo "DATABASE_URL not set."; exit 1; }

if [[ "$CONFIRM" != "--yes" ]]; then
  read -r -p "This DROPS and recreates database '${PG_DB}'. Type RESTORE to proceed: " a
  [[ "$a" == "RESTORE" ]] || { echo "Aborted."; exit 1; }
fi

echo "[restore] terminating connections + recreating ${PG_DB}…"
sudo -u postgres psql -qc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${PG_DB}' AND pid<>pg_backend_pid();" || true
sudo -u postgres dropdb --if-exists "${PG_DB}"
sudo -u postgres createdb -O "${PG_USER}" -E UTF8 "${PG_DB}"

echo "[restore] loading dump: ${DUMP}"
if file "$DUMP" | grep -qi 'PostgreSQL custom'; then
  sudo -u postgres pg_restore --no-owner --role="${PG_USER}" -d "${PG_DB}" "$DUMP"
else
  sudo -u postgres psql -q -d "${PG_DB}" -f "$DUMP"
fi
echo "[restore] done. Run verify-postgresql.sh to confirm."
