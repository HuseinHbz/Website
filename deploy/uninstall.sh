#!/usr/bin/env bash
# =============================================================================
# HBZ Website — حذف کامل پروژه از سرور (uninstall / purge)
# =============================================================================
# این اسکریپت دقیقاً معکوس install.sh است و همه‌ی موارد زیر را حذف می‌کند:
#   • پروسه‌ی PM2 و سرویس startup آن
#   • کانفیگ Nginx
#   • پوشه‌ی اپ (/var/www/habibazar) شامل دیتابیس و build
#   • فایل‌های لاگ و پوشه‌ی بکاپ
#   • کاربر سیستمی hbz
#
# استفاده:
#   sudo bash deploy/uninstall.sh                 # با تأیید تعاملی
#   sudo bash deploy/uninstall.sh --yes           # بدون سؤال (برای اتوماسیون)
#   sudo bash deploy/uninstall.sh --no-backup     # بدون بکاپ نهایی دیتابیس
#   sudo bash deploy/uninstall.sh --keep-user     # کاربر hbz را نگه دار
#   sudo bash deploy/uninstall.sh --keep-nginx    # کانفیگ nginx را دست نزن
#   sudo bash deploy/uninstall.sh --remove-repo /var/www/Website  # حذف کلون مخزن
#
# نکته: پکیج‌های سیستمی (Node.js، PM2، Nginx) عمداً حذف نمی‌شوند چون ممکن است
#       سرویس‌های دیگر به آن‌ها وابسته باشند. حذف آن‌ها در انتها یادآوری می‌شود.
# =============================================================================
set -uo pipefail   # عمداً بدون -e: می‌خواهیم پاکسازی حتی با خطای جزئی ادامه یابد

# ─── تنظیمات (باید با install.sh یکسان باشد) ─────────────────────────────────
APP_USER="hbz"
APP_DIR="/var/www/habibazar"
WEB_DIR="$APP_DIR/outputs/habibazar-web"
DB_FILE="$WEB_DIR/data/habibazar.db"
BACKUP_DIR="/var/backups/habibazar"
NGINX_SITE="habibazar"
PM2_APP="habibazar"
LOG_FILES=(/var/log/habibazar-error.log /var/log/habibazar-out.log)

# ─── فلگ‌ها ──────────────────────────────────────────────────────────────────
ASSUME_YES=false
DO_BACKUP=true
KEEP_USER=false
KEEP_NGINX=false
REMOVE_REPO=""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✔]${NC} $*"; }
step()  { echo -e "${CYAN}[→]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*"; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)      ASSUME_YES=true; shift ;;
    --no-backup)   DO_BACKUP=false; shift ;;
    --keep-user)   KEEP_USER=true; shift ;;
    --keep-nginx)  KEEP_NGINX=true; shift ;;
    --remove-repo) REMOVE_REPO="${2:-}"; shift 2 ;;
    *) error "آرگومان ناشناخته: $1" ;;
  esac
done

[[ $EUID -ne 0 ]] && error "با sudo اجرا کنید: sudo bash deploy/uninstall.sh"

# ─── نمایش آنچه حذف خواهد شد ──────────────────────────────────────────────────
echo ""
echo -e "${RED}═══════════════════════════════════════════════════${NC}"
echo -e "${RED}  ⚠  حذف کامل HBZ Website از این سرور${NC}"
echo -e "${RED}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  موارد زیر حذف خواهند شد:"
echo "    • پروسه PM2:        $PM2_APP  (کاربر $APP_USER)"
echo "    • سرویس startup:    pm2-$APP_USER (systemd)"
[[ "$KEEP_NGINX" == false ]] && echo "    • کانفیگ Nginx:     /etc/nginx/sites-*/$NGINX_SITE"
echo "    • پوشه اپ:          $APP_DIR  (شامل دیتابیس و build)"
echo "    • فایل‌های لاگ:      ${LOG_FILES[*]}"
echo "    • پوشه بکاپ:        $BACKUP_DIR"
[[ "$KEEP_USER" == false ]] && echo "    • کاربر سیستمی:     $APP_USER (و خانه‌ی /home/$APP_USER)"
[[ -n "$REMOVE_REPO" ]] && echo "    • کلون مخزن:        $REMOVE_REPO"
echo ""
if [[ "$DO_BACKUP" == true ]]; then
  echo -e "  ${GREEN}یک بکاپ نهایی از دیتابیس قبل از حذف گرفته می‌شود.${NC}"
else
  echo -e "  ${RED}بدون بکاپ — دیتابیس برای همیشه از بین می‌رود!${NC}"
fi
echo ""

# ─── تأیید ────────────────────────────────────────────────────────────────────
if [[ "$ASSUME_YES" != true ]]; then
  read -rp "  برای ادامه عبارت DELETE را تایپ کنید: " CONFIRM
  [[ "$CONFIRM" == "DELETE" ]] || { warn "لغو شد — چیزی حذف نشد."; exit 0; }
fi

# ─── ۰. بکاپ نهایی دیتابیس ────────────────────────────────────────────────────
if [[ "$DO_BACKUP" == true && -f "$DB_FILE" ]]; then
  step "گرفتن بکاپ نهایی از دیتابیس..."
  STAMP=$(date +%Y%m%d-%H%M%S)
  SAFE_BACKUP="/root/habibazar-final-backup-${STAMP}.db"
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_FILE" ".backup '$SAFE_BACKUP'" 2>/dev/null && info "بکاپ: $SAFE_BACKUP" \
      || { cp "$DB_FILE" "$SAFE_BACKUP" && info "بکاپ (cp): $SAFE_BACKUP"; }
  else
    cp "$DB_FILE" "$SAFE_BACKUP" && info "بکاپ (cp): $SAFE_BACKUP"
  fi
else
  [[ "$DO_BACKUP" == true ]] && warn "دیتابیسی برای بکاپ پیدا نشد ($DB_FILE)"
fi

# ─── ۱. توقف و حذف PM2 ────────────────────────────────────────────────────────
step "توقف و حذف پروسه PM2..."
if id "$APP_USER" &>/dev/null; then
  sudo -u "$APP_USER" pm2 delete "$PM2_APP" 2>/dev/null || true
  sudo -u "$APP_USER" pm2 save --force     2>/dev/null || true
  sudo -u "$APP_USER" pm2 kill             2>/dev/null || true
fi
# پروسه‌های احتمالی قدیمی تحت root
pm2 delete "$PM2_APP"     2>/dev/null || true
pm2 delete habibazar-web  2>/dev/null || true
info "پروسه‌های PM2 حذف شد"

# ─── ۲. حذف سرویس startup سیستمی PM2 ─────────────────────────────────────────
step "حذف سرویس systemd مربوط به PM2..."
if systemctl list-unit-files 2>/dev/null | grep -q "pm2-$APP_USER"; then
  systemctl stop    "pm2-$APP_USER" 2>/dev/null || true
  systemctl disable "pm2-$APP_USER" 2>/dev/null || true
fi
rm -f "/etc/systemd/system/pm2-$APP_USER.service" 2>/dev/null || true
systemctl daemon-reload 2>/dev/null || true
info "سرویس startup حذف شد"

# ─── حذف زمان‌بندی بکاپ (cron) ───────────────────────────────────────────────
rm -f /etc/cron.d/habibazar-backup 2>/dev/null || true

# ─── ۳. حذف کانفیگ Nginx ─────────────────────────────────────────────────────
if [[ "$KEEP_NGINX" == false ]]; then
  step "حذف کانفیگ Nginx..."
  rm -f "/etc/nginx/sites-enabled/$NGINX_SITE" 2>/dev/null || true
  rm -f "/etc/nginx/sites-available/$NGINX_SITE" 2>/dev/null || true
  if command -v nginx &>/dev/null; then
    if nginx -t 2>/dev/null; then
      systemctl reload nginx 2>/dev/null || true
    else
      warn "nginx -t خطا داد — کانفیگ را دستی بررسی کنید"
    fi
  fi
  info "کانفیگ Nginx حذف شد"
else
  warn "کانفیگ Nginx طبق درخواست نگه داشته شد"
fi

# ─── ۴. حذف پوشه اپ ──────────────────────────────────────────────────────────
step "حذف پوشه اپ..."
cd /   # از داخل مسیرهای در حال حذف خارج شویم
rm -rf "$APP_DIR" 2>/dev/null || true
[[ -d "$APP_DIR" ]] && warn "حذف کامل $APP_DIR ناموفق بود — دستی بررسی کنید" || info "$APP_DIR حذف شد"

# ─── ۵. حذف فایل‌های لاگ (شامل نسخه‌های -N) ───────────────────────────────────
step "حذف فایل‌های لاگ..."
for f in "${LOG_FILES[@]}"; do
  rm -f "$f" 2>/dev/null || true
  # PM2 گاهی نسخه‌های habibazar-out-2.log می‌سازد
  base="${f%.log}"
  rm -f "${base}"-*.log 2>/dev/null || true
done
info "فایل‌های لاگ حذف شد"

# ─── ۶. حذف پوشه بکاپ ────────────────────────────────────────────────────────
step "حذف پوشه بکاپ..."
rm -rf "$BACKUP_DIR" 2>/dev/null || true
info "پوشه بکاپ حذف شد"

# ─── ۷. حذف کاربر سیستمی ─────────────────────────────────────────────────────
if [[ "$KEEP_USER" == false ]]; then
  step "حذف کاربر سیستمی $APP_USER..."
  if id "$APP_USER" &>/dev/null; then
    pkill -u "$APP_USER" 2>/dev/null || true
    sleep 1
    userdel -r "$APP_USER" 2>/dev/null || userdel "$APP_USER" 2>/dev/null || true
    id "$APP_USER" &>/dev/null && warn "حذف کاربر ناموفق — شاید پروسه‌ای باز است" || info "کاربر $APP_USER حذف شد"
  else
    info "کاربر $APP_USER از قبل وجود نداشت"
  fi
else
  warn "کاربر $APP_USER طبق درخواست نگه داشته شد"
fi

# ─── ۸. حذف کلون مخزن (اختیاری) ──────────────────────────────────────────────
if [[ -n "$REMOVE_REPO" ]]; then
  if [[ -d "$REMOVE_REPO/.git" ]]; then
    step "حذف کلون مخزن: $REMOVE_REPO ..."
    rm -rf "$REMOVE_REPO" 2>/dev/null || true
    [[ -d "$REMOVE_REPO" ]] && warn "حذف $REMOVE_REPO ناموفق بود" || info "مخزن حذف شد"
  else
    warn "$REMOVE_REPO یک مخزن git نیست — برای ایمنی نادیده گرفته شد"
  fi
fi

# ─── پایان ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  حذف کامل شد.${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
[[ "$DO_BACKUP" == true && -f "${SAFE_BACKUP:-}" ]] && echo "  بکاپ دیتابیس: ${SAFE_BACKUP}"
echo ""
echo -e "${YELLOW}  پکیج‌های سیستمی حذف نشدند (ممکن است سرویس‌های دیگر لازمشان داشته باشند).${NC}"
echo "  اگر مطمئنید و می‌خواهید کاملاً پاک شوند:"
echo "    npm remove -g pm2"
echo "    apt-get purge -y nginx nodejs && apt-get autoremove -y"
echo ""
