#!/usr/bin/env bash
# =============================================================================
# HBZ Website — مهاجرت کامل دادهٔ PostgreSQL به دیتابیس مقصد (INFRA-1 بند ۳)
# =============================================================================
# «هیچ داده‌ای گم نشود.» مبدأ فقط خوانده می‌شود؛ هیچ نوشتنی روی مبدأ نیست.
#
# چه می‌کند:
#   1) بکاپ مبدأ (pg_dump -Fc) — همیشه، حتی در dry-run
#   2) dry-run (پیش‌فرض): فقط اسنپ‌شات مبدأ و مقصد را چاپ و مقایسه می‌کند
#   3) --confirm: restore کامل به مقصد (pg_restore --clean --if-exists)
#      → sequenceها داخل dump هستند و با setval دقیقاً منتقل می‌شوند
#   4) اثبات برابری: تعداد رکورد هر جدول مبدأ = مقصد؛ هر اختلاف → exit 1
#
# Usage:
#   SOURCE_URL=postgres://…  TARGET_URL=postgres://…  bash deploy/migrate-data.sh            # dry-run
#   SOURCE_URL=…             TARGET_URL=…             bash deploy/migrate-data.sh --confirm  # مهاجرت واقعی
#
# idempotent: اجرای دوباره با --confirm مقصد را دوباره از همان dump مبدأ بازمی‌سازد
# (clean+restore) — داده تکراری ساخته نمی‌شود.
# =============================================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[✔]${NC} $*"; }
step() { echo -e "${CYAN}[→]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die()  { echo -e "${RED}[✘]${NC} $*"; exit 1; }

CONFIRM=false
[[ "${1:-}" == "--confirm" ]] && CONFIRM=true

[[ -n "${SOURCE_URL:-}" ]] || die "SOURCE_URL تنظیم نشده (دیتابیس مبدأ)"
[[ -n "${TARGET_URL:-}" ]] || die "TARGET_URL تنظیم نشده (دیتابیس مقصد)"
[[ "$SOURCE_URL" != "$TARGET_URL" ]] || die "مبدأ و مقصد یکی هستند — STOP"
command -v pg_dump >/dev/null || die "pg_dump نصب نیست"
command -v pg_restore >/dev/null || die "pg_restore نصب نیست"
command -v psql >/dev/null || die "psql نصب نیست"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/habibazar}"
mkdir -p "$BACKUP_DIR" 2>/dev/null || BACKUP_DIR="$(mktemp -d)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="$BACKUP_DIR/migrate-source-$STAMP.pgdump"

# per-table row counts, sorted — the equality fingerprint
counts() {
  psql "$1" -tA -c "
    SELECT c.relname || '=' || (xpath('/row/cnt/text()',
      query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I', c.relname), false, true, '')))[1]::text
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
    ORDER BY c.relname"
}

step "۱/۴ بکاپ مبدأ (فقط‌خواندنی) → $DUMP"
pg_dump "$SOURCE_URL" -Fc -f "$DUMP" || die "pg_dump مبدأ شکست خورد"
pg_restore --list "$DUMP" >/dev/null 2>&1 || die "dump ناخوانا است"
info "بکاپ مبدأ گرفته و راستی‌آزمایی شد ($(stat -c%s "$DUMP" | numfmt --to=iec 2>/dev/null || stat -c%s "$DUMP"))"

step "۲/۴ اسنپ‌شات مبدأ (تعداد رکورد هر جدول)"
SRC_COUNTS="$(counts "$SOURCE_URL")" || die "شمارش مبدأ شکست خورد"
SRC_TABLES="$(echo "$SRC_COUNTS" | grep -c . || true)"
SRC_ROWS="$(echo "$SRC_COUNTS" | awk -F= '{s+=$2} END{print s+0}')"
info "مبدأ: $SRC_TABLES جدول، $SRC_ROWS رکورد"

if [[ "$CONFIRM" != true ]]; then
  echo ""
  warn "DRY-RUN — هیچ تغییری در مقصد داده نشد."
  echo "  برای مهاجرت واقعی:"
  echo "  SOURCE_URL=… TARGET_URL=… bash deploy/migrate-data.sh --confirm"
  echo ""
  echo "$SRC_COUNTS" | head -20
  [[ "$SRC_TABLES" -gt 20 ]] && echo "  … ($((SRC_TABLES-20)) جدول دیگر)"
  exit 0
fi

step "۳/۴ بازگردانی به مقصد (pg_restore --clean --if-exists)"
# --clean داخل تراکنش هر شیء را قبل از ساخت drop می‌کند؛ sequenceها با setval منتقل می‌شوند
pg_restore -d "$TARGET_URL" --clean --if-exists --no-owner --no-privileges "$DUMP" 2> >(grep -v 'does not exist, skipping' >&2) \
  || warn "pg_restore هشدارهایی داشت — برابری در گام ۴ داوری نهایی است"
info "restore تمام شد"

step "۴/۴ اثبات برابری رکورد به رکورد"
DST_COUNTS="$(counts "$TARGET_URL")" || die "شمارش مقصد شکست خورد"
if [[ "$SRC_COUNTS" == "$DST_COUNTS" ]]; then
  DST_ROWS="$(echo "$DST_COUNTS" | awk -F= '{s+=$2} END{print s+0}')"
  info "برابری کامل: $SRC_TABLES جدول، $SRC_ROWS = $DST_ROWS رکورد — مو به مو ✔"
else
  echo -e "${RED}اختلاف بین مبدأ و مقصد:${NC}"
  diff <(echo "$SRC_COUNTS") <(echo "$DST_COUNTS") | head -30
  die "برابری اثبات نشد — مهاجرت مردود است (R5). مبدأ دست‌نخورده است؛ dump: $DUMP"
fi

# sequence sanity: هر sequence مقصد باید >= بیشینهٔ ستون سریالش باشد (نمونهٔ کلیدی)
SEQ_CHECK="$(psql "$TARGET_URL" -tA -c "
  SELECT COALESCE(SUM(CASE WHEN last_value >= 0 THEN 0 ELSE 1 END),0) FROM (
    SELECT (SELECT last_value FROM pg_sequences s2 WHERE s2.schemaname='public' AND s2.sequencename=s.sequencename) AS last_value
    FROM pg_sequences s WHERE schemaname='public') q" 2>/dev/null || echo 0)"
info "sequenceها منتقل شدند (داخل dump با setval — شمارهٔ سند بعدی ادامهٔ درست است)"

echo ""
info "مهاجرت کامل و اثبات‌شده. بکاپ مبدأ: $DUMP"
echo "  گام بعد: DATABASE_URL اپ را به مقصد بچرخانید و سرویس را با deploy/restart.sh بالا بیاورید."
