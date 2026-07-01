#!/usr/bin/env bash
# =============================================================================
# HBZ Website — بکاپ دیتابیس و فایل‌های آپلود
# =============================================================================
# استفاده:
#   sudo bash deploy/backup.sh
#
# cron — هر روز ساعت ۳ صبح:
#   0 3 * * * root bash /var/www/habibazar/deploy/backup.sh >> /var/log/hbz-backup.log 2>&1
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/habibazar"
WEB_DIR="$APP_DIR/outputs/habibazar-web"
DB_PATH="${DB_PATH:-$WEB_DIR/data/habibazar.db}"
BACKUP_DIR="/var/backups/habibazar"
KEEP_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✔]${NC} $(date '+%H:%M:%S') $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $(date '+%H:%M:%S') $*"; }
error() { echo -e "${RED}[✘]${NC} $(date '+%H:%M:%S') $*"; exit 1; }

mkdir -p "$BACKUP_DIR/$TIMESTAMP"

# ─── دیتابیس SQLite ──────────────────────────────────────────────────────────
if [[ -f "$DB_PATH" ]]; then
  info "بکاپ دیتابیس..."
  sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/$TIMESTAMP/habibazar.db'"
  info "دیتابیس: $BACKUP_DIR/$TIMESTAMP/habibazar.db ($(du -sh "$BACKUP_DIR/$TIMESTAMP/habibazar.db" | cut -f1))"
else
  warn "دیتابیس یافت نشد: $DB_PATH"
fi

# ─── فایل‌های آپلود ──────────────────────────────────────────────────────────
UPLOADS_DIR="$WEB_DIR/public/uploads"
if [[ -d "$UPLOADS_DIR" ]]; then
  info "بکاپ فایل‌های آپلود..."
  tar -czf "$BACKUP_DIR/$TIMESTAMP/uploads.tar.gz" -C "$WEB_DIR/public" uploads/
  info "آپلودها: $BACKUP_DIR/$TIMESTAMP/uploads.tar.gz ($(du -sh "$BACKUP_DIR/$TIMESTAMP/uploads.tar.gz" | cut -f1))"
fi

# ─── فایل .env.local ─────────────────────────────────────────────────────────
if [[ -f "$WEB_DIR/.env.local" ]]; then
  cp "$WEB_DIR/.env.local" "$BACKUP_DIR/$TIMESTAMP/.env.local.bak"
  info ".env.local بکاپ شد"
fi

# ─── پاکسازی بکاپ‌های قدیمی ─────────────────────────────────────────────────
info "پاکسازی بکاپ‌های قدیمی‌تر از $KEEP_DAYS روز..."
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true

info "بکاپ کامل شد: $BACKUP_DIR/$TIMESTAMP"
