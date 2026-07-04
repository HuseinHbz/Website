#!/usr/bin/env bash
# =============================================================================
# HBZ Website — آپدیت به آخرین نسخه (zero-downtime)
# =============================================================================
# استفاده:
#   sudo bash deploy/update.sh                               # branch پیش‌فرض
#   sudo bash deploy/update.sh --branch feature/my-branch   # branch خاص
#   sudo bash deploy/update.sh --skip-build                 # فقط pull + restart
# =============================================================================
set -euo pipefail

APP_USER="hbz"
APP_DIR="/var/www/habibazar"
BRANCH="feature/v2-enterprise-upgrade"
SKIP_BUILD=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✔]${NC} $*"; }
step()  { echo -e "${CYAN}[→]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "با sudo اجرا کنید: sudo bash deploy/update.sh"
[[ ! -d "$APP_DIR/.git" ]] && error "مخزن یافت نشد: $APP_DIR — ابتدا install.sh اجرا کنید"

while [[ $# -gt 0 ]]; do
  case $1 in
    --branch)     BRANCH="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    *) error "آرگومان ناشناخته: $1" ;;
  esac
done

# git safe.directory برای جلوگیری از خطای dubious ownership
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

WEB_DIR="$APP_DIR/outputs/habibazar-web"
ENV_FILE="$WEB_DIR/.env.local"

# The app runs on PostgreSQL (Phase 20). For installs migrating from the old
# SQLite runtime, ensure DATABASE_URL is present in .env.local.
if [[ -f "$ENV_FILE" ]] && ! grep -q '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null; then
  if [[ -f /root/.habibazar-pg-dsn ]]; then
    echo "DATABASE_URL=$(cat /root/.habibazar-pg-dsn)" >> "$ENV_FILE"
    echo "[update] DATABASE_URL به .env.local اضافه شد"
  else
    echo "[update] ⚠ DATABASE_URL تنظیم نشده و PostgreSQL provision نشده — deploy/postgres/install-postgresql.sh را اجرا کنید"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  HBZ Website — آپدیت  (branch: $BRANCH)"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── commit فعلی ─────────────────────────────────────────────────────────────
PREV_COMMIT=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
PREV_BRANCH=$(git -C "$APP_DIR" branch --show-current 2>/dev/null || echo "unknown")
step "نسخه فعلی: $PREV_COMMIT (branch: $PREV_BRANCH)"

# ─── git pull ─────────────────────────────────────────────────────────────────
step "دریافت آخرین تغییرات از branch $BRANCH..."
sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin "$BRANCH"
sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$BRANCH"
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH"

NEW_COMMIT=$(git -C "$APP_DIR" rev-parse --short HEAD)
if [[ "$PREV_COMMIT" == "$NEW_COMMIT" ]]; then
  warn "هیچ commit جدیدی وجود ندارد ($NEW_COMMIT)"
  read -rp "  با این حال build و restart انجام شود؟ [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { info "لغو شد"; exit 0; }
else
  info "نسخه جدید: $NEW_COMMIT"
fi

cd "$WEB_DIR"

if [[ "$SKIP_BUILD" == "false" ]]; then
  # ─── snapshot برای rollback ──────────────────────────────────────────────────
  if [[ -d "$WEB_DIR/.next" ]]; then
    step "ذخیره snapshot برای rollback..."
    rm -rf "$WEB_DIR/.next.bak"
    cp -r "$WEB_DIR/.next" "$WEB_DIR/.next.bak"
  fi

  # ─── npm ci ──────────────────────────────────────────────────────────────────
  if git -C "$APP_DIR" diff "$PREV_COMMIT" HEAD -- outputs/habibazar-web/package.json outputs/habibazar-web/package-lock.json 2>/dev/null | grep -q . || [[ ! -d node_modules/eslint ]]; then
    step "نصب پکیج‌ها (همه + devDeps برای build)..."
    sudo -u "$APP_USER" npm ci
    info "پکیج‌ها آپدیت شدند"
  else
    info "package.json تغییر نکرده — نصب مجدد لازم نیست"
  fi

  # ─── build ───────────────────────────────────────────────────────────────────
  step "build پروژه..."
  if ! sudo -u "$APP_USER" bash -c "set -a; source $ENV_FILE; set +a; npm run build"; then
    warn "build ناموفق — rollback به نسخه قبلی..."
    if [[ -d "$WEB_DIR/.next.bak" ]]; then rm -rf "$WEB_DIR/.next"; mv "$WEB_DIR/.next.bak" "$WEB_DIR/.next"; fi
    sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "$PREV_COMMIT"
    sudo -u "$APP_USER" pm2 reload habibazar 2>/dev/null || true
    error "آپدیت ناموفق — به $PREV_COMMIT برگشتیم"
  fi
  info "build کامل شد"
  rm -rf "$WEB_DIR/.next.bak"

  step "حذف devDependencies بعد از build..."
  sudo -u "$APP_USER" npm prune --omit=dev 2>/dev/null || true
fi

# ─── اطمینان از وجود پوشه لاگ (متعلق به hbz) ─────────────────────────────────
mkdir -p "/home/$APP_USER/logs"
chown -R "$APP_USER":"$APP_USER" "/home/$APP_USER/logs" 2>/dev/null || true

# ─── حذف cron قدیمی بکاپ (اکنون موتور داخلی برنامه است) ──────────────────────
# Backups are now handled by the in-app BackupEngine — remove any legacy OS cron.
rm -f /etc/cron.d/habibazar-backup 2>/dev/null || true

# ─── reload zero-downtime ────────────────────────────────────────────────────
# reload پروسه را restart می‌کند → instrumentation.register() اجرا و DB
# به‌صورت خودکار مقداردهی می‌شود. موتور بکاپ داخلی هم با همین پروسه استارت می‌خورد.
step "reload سرویس (zero-downtime)..."
sudo -u "$APP_USER" pm2 reload habibazar
info "سرویس reload شد"

# ─── health check ────────────────────────────────────────────────────────────
step "بررسی سلامت سرویس..."
sleep 5
for i in 1 2 3; do
  if curl -sf "http://localhost:3000/api/health" &>/dev/null; then
    info "سرویس پاسخ می‌دهد ✓"; break
  fi
  [[ $i -eq 3 ]] && warn "health check پاسخ نداد — لاگ: sudo -u $APP_USER pm2 logs habibazar"
  sleep 3
done

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  آپدیت با موفقیت انجام شد!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo "  قبلی: $PREV_COMMIT → جدید: $NEW_COMMIT"
echo "  لاگ:  sudo -u $APP_USER pm2 logs habibazar"
echo ""
