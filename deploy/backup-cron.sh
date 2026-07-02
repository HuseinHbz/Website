#!/usr/bin/env bash
# =============================================================================
# HBZ Website — نصب زمان‌بندی بکاپ خودکار (cron) + کلید رمزنگاری
# =============================================================================
# Usage:  sudo bash deploy/backup-cron.sh
# Installs /etc/cron.d/habibazar-backup with the enterprise schedule and creates
# the AES encryption key if missing. Idempotent.
# =============================================================================
set -euo pipefail

APP_USER="${APP_USER:-hbz}"
APP_DIR="${APP_DIR:-/var/www/habibazar}"
KEY_FILE="/home/$APP_USER/.backup-key"
BACKUP_ROOT="/var/backups/habibazar"
CRON_FILE="/etc/cron.d/habibazar-backup"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${GREEN}[✔]${NC} $*"; }
step() { echo -e "${CYAN}[→]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "با sudo اجرا کنید"

# ── Encryption key (256-bit) ─────────────────────────────────────────────────
if [[ ! -f "$KEY_FILE" ]]; then
  step "ساخت کلید رمزنگاری بکاپ..."
  openssl rand -hex 32 > "$KEY_FILE"
  chown "$APP_USER":"$APP_USER" "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  info "کلید ساخته شد: $KEY_FILE (این کلید را جای امنی نگه دارید — بدون آن بکاپ‌ها قابل بازیابی نیستند!)"
else
  info "کلید رمزنگاری از قبل وجود دارد"
fi

# ── Backup dirs (owned by app user) ──────────────────────────────────────────
mkdir -p "$BACKUP_ROOT" "/home/$APP_USER/logs"
chown -R "$APP_USER":"$APP_USER" "$BACKUP_ROOT" "/home/$APP_USER/logs"

# ── Cron schedule ────────────────────────────────────────────────────────────
step "نصب زمان‌بندی cron..."
cat > "$CRON_FILE" <<CRON
# HBZ Website — automated backup schedule (managed by deploy/backup-cron.sh)
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SHELL=/bin/bash

# Hourly database backup (retention 48h)
0 * * * *   $APP_USER  bash $APP_DIR/deploy/backup.sh hourly  >> /home/$APP_USER/logs/backup.log 2>&1
# Daily full backup at 03:00 (retention 30d)
0 3 * * *   $APP_USER  bash $APP_DIR/deploy/backup.sh daily   >> /home/$APP_USER/logs/backup.log 2>&1
# Weekly full backup Sunday 02:00 (retention 12w)
0 2 * * 0   $APP_USER  bash $APP_DIR/deploy/backup.sh weekly  >> /home/$APP_USER/logs/backup.log 2>&1
# Monthly full backup 1st at 01:00 (retention 24m)
0 1 1 * *   $APP_USER  bash $APP_DIR/deploy/backup.sh monthly >> /home/$APP_USER/logs/backup.log 2>&1
# Yearly archive Jan 1 at 00:30 (retention 10y)
30 0 1 1 *  $APP_USER  bash $APP_DIR/deploy/backup.sh yearly  >> /home/$APP_USER/logs/backup.log 2>&1
# Weekly automated recovery test on the latest daily backup (Monday 04:00)
0 4 * * 1   $APP_USER  f=\$(ls -t $BACKUP_ROOT/daily/*.enc 2>/dev/null | head -1); [ -n "\$f" ] && bash $APP_DIR/deploy/restore.sh --test "\$f" >> /home/$APP_USER/logs/backup.log 2>&1
CRON

chmod 644 "$CRON_FILE"
info "زمان‌بندی نصب شد: $CRON_FILE"

echo ""
info "بکاپ خودکار فعال شد. تست دستی: sudo -u $APP_USER bash $APP_DIR/deploy/backup.sh daily"
