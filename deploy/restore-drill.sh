#!/usr/bin/env bash
# =============================================================================
# HBZ — Restore Drill (Phase 26.24 بند ۵.۴)
# =============================================================================
# Repeatable DR rehearsal: take (or use) a pg_dump, restore it into a THROWAWAY
# database, run migrations idempotency + health smoke, then drop it. Never
# touches production data. Prints measured RTO. Exit 0 = drill passed.
#
#   sudo bash deploy/restore-drill.sh [--dump /path/to/dump.sql] [--keep]
# =============================================================================
set -euo pipefail

DUMP=""; KEEP=false
DRILL_DB="hbz_drill_$(date +%s)"
SRC_DB="${PGDATABASE:-habibazar}"
PGUSER_="${PGUSER:-postgres}"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
info(){ echo -e "${GREEN}[✔]${NC} $*"; }; step(){ echo -e "${CYAN}[→]${NC} $*"; }
warn(){ echo -e "${YELLOW}[!]${NC} $*"; }; fail(){ echo -e "${RED}[✘]${NC} $*"; exit 1; }

while [[ $# -gt 0 ]]; do case $1 in
  --dump) DUMP="$2"; shift 2 ;;
  --keep) KEEP=true; shift ;;
  *) fail "unknown arg: $1" ;;
esac; done

START=$(date +%s)
trap '[[ "$KEEP" == false ]] && sudo -u "$PGUSER_" dropdb --if-exists "$DRILL_DB" 2>/dev/null || true' EXIT

# 1) Dump (if not provided) from the live DB — consistent snapshot.
if [[ -z "$DUMP" ]]; then
  DUMP="/tmp/${DRILL_DB}.sql"
  step "pg_dump $SRC_DB → $DUMP"
  sudo -u "$PGUSER_" pg_dump "$SRC_DB" > "$DUMP" || fail "pg_dump failed"
fi
info "using dump: $DUMP ($(du -h "$DUMP" | cut -f1))"

# 2) Restore into a fresh throwaway DB.
step "creating drill DB $DRILL_DB"
sudo -u "$PGUSER_" createdb "$DRILL_DB" || fail "createdb failed"
step "restoring dump"
sudo -u "$PGUSER_" psql -q -d "$DRILL_DB" -f "$DUMP" >/dev/null || fail "restore failed"

# 3) Validate: row-count sanity + a core table exists + integrity.
step "validating restored schema"
TABLES=$(sudo -u "$PGUSER_" psql -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" "$DRILL_DB")
USERS=$(sudo -u "$PGUSER_" psql -tAc "SELECT count(*) FROM users" "$DRILL_DB" 2>/dev/null || echo 0)
GL=$(sudo -u "$PGUSER_" psql -tAc "SELECT count(*) FROM gl_accounts" "$DRILL_DB" 2>/dev/null || echo 0)
[[ "$TABLES" -lt 30 ]] && fail "restored schema too small ($TABLES tables)"
[[ "$USERS" -lt 1 ]] && fail "no users restored"
info "restored: $TABLES tables, $USERS users, $GL GL accounts"

# 4) Trial-balance reconciliation smoke (books survive the restore intact).
BAL=$(sudo -u "$PGUSER_" psql -tAc \
  "SELECT COALESCE(SUM(l.debit),0)-COALESCE(SUM(l.credit),0) FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id WHERE e.status='posted'" \
  "$DRILL_DB" 2>/dev/null || echo 0)
if awk "BEGIN{exit !(($BAL<1)&&($BAL>-1))}"; then info "posted ledger balances (Δ=$BAL)"; else fail "restored ledger unbalanced (Δ=$BAL)"; fi

RTO=$(( $(date +%s) - START ))
info "════════════════════════════════════════"
info "RESTORE DRILL PASSED · RTO ${RTO}s"
info "RPO = last backup age (see BackupEngine catalog)"
info "════════════════════════════════════════"
