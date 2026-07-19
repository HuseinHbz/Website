#!/usr/bin/env bash
# =============================================================================
# HBZ Website — تعمیر سریع PM2 بدون نصب مجدد
# =============================================================================
# استفاده روی سرور (اگر install.sh PM2 را درست راه‌اندازی نکرده):
#   sudo bash /var/www/repo/deploy/fix-pm2.sh
# =============================================================================
set -euo pipefail

APP_USER="hbz"
APP_DIR="/var/www/habibazar"
WEB_DIR="$APP_DIR"
ENV_FILE="$WEB_DIR/.env.local"
APP_PORT="3000"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${GREEN}[✔]${NC} $*"; }
step() { echo -e "${CYAN}[→]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "با sudo اجرا کنید"
[[ ! -f "$ENV_FILE" ]] && error "فایل .env.local یافت نشد: $ENV_FILE"
[[ ! -d "$WEB_DIR/.next" ]] && error "پوشه .next یافت نشد — ابتدا build کنید"

NODE_PATH=$(dirname "$(which node)")
START_SCRIPT="$APP_DIR/deploy/start.sh"
PM2_CONF="$APP_DIR/deploy/pm2.config.js"

step "ساخت پوشه لاگ (متعلق به $APP_USER)..."
LOG_DIR="/home/$APP_USER/logs"
mkdir -p "$LOG_DIR"
chown -R "$APP_USER":"$APP_USER" "$LOG_DIR"
info "پوشه لاگ آماده شد: $LOG_DIR"

step "ساخت start.sh..."
cat > "$START_SCRIPT" <<SCRIPT
#!/usr/bin/env bash
set -a
source "$ENV_FILE"
set +a
cd "$WEB_DIR"
exec node_modules/.bin/next start -p $APP_PORT
SCRIPT
chmod +x "$START_SCRIPT"
chown "$APP_USER":"$APP_USER" "$START_SCRIPT"
info "start.sh ساخته شد: $START_SCRIPT"

step "ساخت pm2.config.js..."
cat > "$PM2_CONF" <<EOF
module.exports = {
  apps: [{
    name: 'habibazar',
    cwd: '${WEB_DIR}',
    script: '${START_SCRIPT}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    error_file: '${LOG_DIR}/habibazar-error.log',
    out_file: '${LOG_DIR}/habibazar-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      PATH: '${NODE_PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    },
  }]
}
EOF
chown "$APP_USER":"$APP_USER" "$PM2_CONF"
info "pm2.config.js ساخته شد"

step "پاکسازی و restart PM2..."
# پروسه قدیمی root را هم پاک کن
pm2 delete habibazar-web 2>/dev/null || true
pm2 delete habibazar     2>/dev/null || true
# ریست کامل daemon کاربر hbz تا نام‌گذاری قدیمی لاگ (پسوند -2) پاک شود
sudo -u "$APP_USER" pm2 delete habibazar 2>/dev/null || true
sudo -u "$APP_USER" pm2 kill 2>/dev/null || true
sudo -u "$APP_USER" pm2 start "$PM2_CONF"
sudo -u "$APP_USER" pm2 save
info "PM2 restart شد"

step "بررسی سلامت (۵ ثانیه صبر)..."
sleep 5
for i in 1 2 3; do
  if curl -sf "http://localhost:$APP_PORT/api/health" &>/dev/null; then
    info "سرویس پاسخ می‌دهد ✓"
    echo ""
    sudo -u "$APP_USER" pm2 status
    exit 0
  fi
  sleep 3
done

echo ""
echo -e "${RED}[!] سرویس پاسخ نداد — لاگ:${NC}"
cat "$LOG_DIR/habibazar-error.log" 2>/dev/null | tail -30
sudo -u "$APP_USER" pm2 logs habibazar --lines 20 --nostream 2>/dev/null || true
