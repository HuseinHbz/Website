#!/usr/bin/env bash
# =============================================================================
# HBZ Website — ری‌استارت امن سرویس (PM2 delete + start، نه reload)
# =============================================================================
# چرا delete+start و نه reload؟ اگر cwd یا env پروسه عوض شده باشد (مثل مهاجرت
# flatten در فاز 26.26d)، «pm2 reload» همان کانفیگ قدیمیِ در حافظه را نگه می‌دارد
# و مسیر جدید را نمی‌خواند. این اسکریپت پروسه را کامل حذف و از pm2.config.js
# فعلی از نو start می‌کند، بعد با health-gate تأیید می‌کند بالا آمده.
#
# استفاده:  sudo bash /var/www/habibazar/deploy/restart.sh
# =============================================================================
set -euo pipefail

APP_USER="hbz"
APP_DIR="${APP_DIR:-/var/www/habibazar}"
ENV_FILE="$APP_DIR/.env.local"
PM2_CONF="$APP_DIR/deploy/pm2.config.js"
APP_PORT="${APP_PORT:-3000}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${GREEN}[✔]${NC} $*"; }
step() { echo -e "${CYAN}[→]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "با sudo اجرا کنید"
[[ ! -f "$ENV_FILE" ]] && error "فایل .env.local یافت نشد: $ENV_FILE"
[[ ! -d "$APP_DIR/.next" ]] && error "پوشه .next یافت نشد — ابتدا build کنید (npm run build)"
[[ ! -f "$PM2_CONF" ]] && error "pm2.config.js یافت نشد: $PM2_CONF — اول deploy/fix-pm2.sh را اجرا کنید"

# اگر cwd کانفیگ با APP_DIR فعلی نمی‌خواند، کانفیگ کهنه است → fix-pm2 لازم است.
if ! grep -q "cwd: '$APP_DIR'" "$PM2_CONF"; then
  error "cwd داخل pm2.config.js با $APP_DIR نمی‌خواند — اول deploy/fix-pm2.sh را اجرا کنید تا کانفیگ بازسازی شود"
fi

step "حذف کامل پروسه (delete، نه reload — تا cwd/env تازه خوانده شود)..."
pm2 delete habibazar 2>/dev/null || true
sudo -u "$APP_USER" pm2 delete habibazar 2>/dev/null || true

step "استارت از pm2.config.js..."
sudo -u "$APP_USER" pm2 start "$PM2_CONF"
sudo -u "$APP_USER" pm2 save

step "health-gate (تا ۳۰ ثانیه)..."
for i in $(seq 1 10); do
  sleep 3
  if curl -sf "http://localhost:$APP_PORT/api/health" &>/dev/null; then
    info "سرویس سالم است ✓"
    echo ""
    sudo -u "$APP_USER" pm2 status
    exit 0
  fi
done

echo ""
echo -e "${RED}[!] سرویس بعد از ۳۰ ثانیه پاسخ نداد — آخرین لاگ خطا:${NC}"
tail -30 "/home/$APP_USER/logs/habibazar-error.log" 2>/dev/null || true
sudo -u "$APP_USER" pm2 logs habibazar --lines 20 --nostream 2>/dev/null || true
exit 1
