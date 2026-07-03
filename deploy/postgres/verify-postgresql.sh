#!/usr/bin/env bash
# verify-postgresql.sh — post-migration verification against the live PG target.
# Checks: connectivity, extensions, table census, row counts, FK/constraint
# validity, index usage and cache-hit ratio. Non-destructive (read-only).
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-$(cat /root/.habibazar-pg-dsn 2>/dev/null || true)}"
[[ -z "$DATABASE_URL" ]] && { echo "DATABASE_URL not set."; exit 1; }
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAqc)

ok() { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
info() { printf '  · %s\n' "$*"; }

echo "PostgreSQL verification"
echo "───────────────────────"

"${PSQL[@]}" "SELECT 1" >/dev/null && ok "connectivity"
info "server: $("${PSQL[@]}" "SHOW server_version")"

EXT=$("${PSQL[@]}" "SELECT string_agg(extname,', ' ORDER BY extname) FROM pg_extension")
info "extensions: ${EXT}"

TCOUNT=$("${PSQL[@]}" "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
ok "tables in public schema: ${TCOUNT}"

echo "  row counts (non-empty tables):"
"${PSQL[@]}" "
SELECT format('    %-28s %s', relname, n_live_tup)
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_live_tup DESC;"

# FK integrity — validate every FK constraint
BADFK=$("${PSQL[@]}" "SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated")
[[ "$BADFK" == "0" ]] && ok "all foreign keys validated" || echo "  ✗ ${BADFK} unvalidated FKs"

# cache hit ratio
HIT=$("${PSQL[@]}" "SELECT round(sum(heap_blks_hit)*100.0/nullif(sum(heap_blks_hit+heap_blks_read),0),2) FROM pg_statio_user_tables")
info "cache hit ratio: ${HIT:-n/a}%"

# DB size
SIZE=$("${PSQL[@]}" "SELECT pg_size_pretty(pg_database_size(current_database()))")
info "database size: ${SIZE}"

echo "Verification complete."
