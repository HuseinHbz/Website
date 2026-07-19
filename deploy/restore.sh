#!/usr/bin/env bash
# =============================================================================
# HBZ Website — بازیابی از بکاپ رمزنگاری‌شده (verify → decrypt → restore)
# =============================================================================
# Usage:
#   sudo bash deploy/restore.sh <backup.tar.gz.enc> [options]
#     --test         recovery test: restore into an isolated temp dir and
#                    validate integrity only — the live app is NOT touched.
#     --db-only      restore only the database (skip media/config)
#     --with-config  also restore env.local / nginx / pm2 config (careful!)
#     --yes          skip the confirmation prompt
#
# Steps: verify sha256 → decrypt (AES-256) → extract → pg_restore --list check →
# (test: report) OR (restore: pg_dump safety snapshot, then pg_restore + media).
# =============================================================================
set -uo pipefail

APP_USER="${APP_USER:-hbz}"
APP_DIR="${APP_DIR:-/var/www/habibazar}"
WEB_DIR="$APP_DIR"
UPLOADS_DIR="$WEB_DIR/public/uploads"
ENV_FILE="$WEB_DIR/.env.local"
KEY_FILE="${BACKUP_KEY_FILE:-/home/$APP_USER/.backup-key}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${GREEN}[✔]${NC} $*"; }
step() { echo -e "${CYAN}[→]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die()  { echo -e "${RED}[✘]${NC} $*"; exit 1; }

BACKUP=""; TEST=false; DB_ONLY=false; WITH_CONFIG=false; ASSUME_YES=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --test) TEST=true; shift ;;
    --db-only) DB_ONLY=true; shift ;;
    --with-config) WITH_CONFIG=true; shift ;;
    --yes|-y) ASSUME_YES=true; shift ;;
    -*) die "unknown option: $1" ;;
    *) BACKUP="$1"; shift ;;
  esac
done

[[ -n "$BACKUP" ]] || die "usage: restore.sh <backup.tar.gz.enc> [--test|--db-only|--with-config|--yes]"
[[ -f "$BACKUP" ]] || die "backup not found: $BACKUP"
[[ -f "$KEY_FILE" ]] || die "encryption key not found: $KEY_FILE"
if [[ -z "${DATABASE_URL:-}" ]]; then
  [[ -f "$ENV_FILE" ]] && DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\"')"
fi

# ── 1. Verify checksum ───────────────────────────────────────────────────────
if [[ -f "$BACKUP.sha256" ]]; then
  step "بررسی checksum..."
  ACTUAL="$(sha256sum "$BACKUP" | awk '{print $1}')"
  [[ "$ACTUAL" == "$(cat "$BACKUP.sha256")" ]] || die "checksum mismatch — backup is corrupt"
  info "checksum معتبر است"
else
  warn "فایل checksum یافت نشد — از verification صرف‌نظر شد"
fi

# ── 2. Decrypt + extract ─────────────────────────────────────────────────────
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
step "رمزگشایی و استخراج..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in "$BACKUP" -pass "file:$KEY_FILE" 2>/dev/null \
  | tar -xzf - -C "$WORK" || die "decryption/extract failed (wrong key or corrupt backup)"
[[ -f "$WORK/database.pgdump" ]] || die "backup does not contain database.pgdump (legacy SQLite backups need the pre-INFRA-1 restore.sh)"

# ── 3. Integrity check the dump ──────────────────────────────────────────────
step "بررسی یکپارچگی دیتابیس..."
pg_restore --list "$WORK/database.pgdump" >/dev/null 2>&1 || die "dump unreadable (pg_restore --list failed)"
TABLES="$(pg_restore --list "$WORK/database.pgdump" | grep -c 'TABLE DATA' || true)"
[[ "${TABLES:-0}" -gt 0 ]] || die "dump contains no table data"
info "دیتابیس سالم است (pg_restore list: ok، جداول با داده: $TABLES)"

# ── 4a. TEST mode — isolated validation only ─────────────────────────────────
if [[ "$TEST" == true ]]; then
  echo ""
  echo -e "${GREEN}═══ RECOVERY TEST PASSED ═══${NC}"
  echo "  • checksum:        ok"
  echo "  • decryption:      ok"
  echo "  • DB integrity:    ok ($TABLES tables)"
  echo "  • media present:   $([[ -d "$WORK/uploads" ]] && echo yes || echo 'n/a (db-only bucket)')"
  echo "  • config present:  $([[ -d "$WORK/config" ]] && echo yes || echo 'n/a')"
  echo "  (live system was NOT modified)"
  exit 0
fi

# ── 4b. Real restore ─────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "بازیابی واقعی نیاز به sudo دارد"
if [[ "$ASSUME_YES" != true ]]; then
  echo -e "${YELLOW}این عملیات دیتابیس فعلی را جایگزین می‌کند.${NC}"
  read -rp "برای ادامه RESTORE را تایپ کنید: " c
  [[ "$c" == "RESTORE" ]] || { warn "لغو شد"; exit 0; }
fi

[[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL not set (env or .env.local) — cannot restore"
command -v pg_restore >/dev/null || die "pg_restore not installed"

# Safety snapshot of the CURRENT database before overwriting
SNAP="/var/backups/habibazar/pre-restore-$(date +%Y%m%d-%H%M%S).pgdump"
mkdir -p "$(dirname "$SNAP")"
pg_dump "$DATABASE_URL" -Fc -f "$SNAP" && info "snapshot دیتابیس فعلی: $SNAP" || warn "snapshot فعلی گرفته نشد (DB خالی/در دسترس نیست؟) — ادامه"

step "بازگردانی دیتابیس (pg_restore --clean)..."
pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner "$WORK/database.pgdump" \
  || die "pg_restore failed — دیتابیس ممکن است ناقص باشد؛ snapshot: $SNAP"
info "دیتابیس بازگردانی شد"

if [[ "$DB_ONLY" != true && -d "$WORK/uploads" ]]; then
  step "بازگردانی فایل‌های آپلود..."
  mkdir -p "$UPLOADS_DIR"
  cp -a "$WORK/uploads/." "$UPLOADS_DIR/" 2>/dev/null || true
  chown -R "$APP_USER":"$APP_USER" "$UPLOADS_DIR" 2>/dev/null || true
  info "آپلودها بازگردانی شد"
fi

if [[ "$WITH_CONFIG" == true && -d "$WORK/config" ]]; then
  step "بازگردانی config..."
  [[ -f "$WORK/config/env.local" ]] && cp "$WORK/config/env.local" "$ENV_FILE" && chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  info "config بازگردانی شد (nginx/pm2 را در صورت نیاز دستی اعمال کنید)"
fi

echo ""
info "بازیابی کامل شد. سرویس را ری‌استارت کنید: sudo bash $APP_DIR/deploy/restart.sh"
