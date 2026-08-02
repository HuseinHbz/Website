#!/usr/bin/env bash
# =============================================================================
# HBZ Website — آپدیت به آخرین نسخه (zero-downtime)
# =============================================================================
# استفاده:
#   sudo bash deploy/update.sh                               # شاخهٔ default مخزن
#   sudo bash deploy/update.sh --branch feature/my-branch   # branch خاص
#   sudo bash deploy/update.sh --skip-build                 # فقط pull + restart
#
# شاخه: همیشه **default branch مخزن** (زنده از remote خوانده می‌شود). هیچ شاخه‌ای
# در اسکریپت ثابت نیست؛ با عوض‌کردن default در GitHub، سرور خودکار دنبال می‌کند.
# فقط برای موارد خاص: --branch <x> یا HBZ_BRANCH=<x>.
# =============================================================================
# -E : تلهٔ ERR در توابع/subshellها هم اجرا شود (جلوگیری از خروج خاموش)
set -Eeuo pipefail

APP_USER="hbz"
APP_DIR="/var/www/habibazar"
SKIP_BUILD=false

# شاخهٔ دیپلوی از deploy/branch.env تعیین می‌شود (پیش‌فرض: default مخزن).
BRANCH_ENV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/branch.env"
# shellcheck source=/dev/null
[[ -f "$BRANCH_ENV" ]] && source "$BRANCH_ENV"
BRANCH="${HBZ_BRANCH:-}"   # خالی = بعداً از default مخزن کشف می‌شود

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
CURRENT_STEP="شروع"
info()  { echo -e "${GREEN}[✔]${NC} $*"; }
step()  { CURRENT_STEP="$*"; echo -e "${CYAN}[→]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*"; exit 1; }

# هیچ خروج خاموشی: هر دستور شکست‌خورده با مرحله/خط/دستور/کد گزارش می‌شود.
on_error() {
  local code=$? line="${1:-?}" cmd="${BASH_COMMAND:-?}"
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo -e "${RED}[✘] آپدیت متوقف شد${NC}"
  echo -e "${RED}    مرحله  : ${CURRENT_STEP}${NC}"
  echo -e "${RED}    خط     : ${line}${NC}"
  echo -e "${RED}    دستور  : ${cmd}${NC}"
  echo -e "${RED}    کد خروج: ${code}${NC}"
  [[ -n "${LOG_FILE:-}" ]] && echo -e "${YELLOW}    لاگ کامل: ${LOG_FILE}${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  exit "$code"
}
trap 'on_error $LINENO' ERR
trap 'echo -e "\n${YELLOW}[!] با Ctrl+C لغو شد (مرحله: ${CURRENT_STEP})${NC}"; exit 130' INT TERM

[[ $EUID -ne 0 ]] && error "با sudo اجرا کنید: sudo bash deploy/update.sh"

# لاگ کامل روی دیسک
if [[ -z "${HBZ_UPDATE_LOGGING:-}" ]]; then
  export HBZ_UPDATE_LOGGING=1
  LOG_FILE="/var/log/habibazar-update-$(date +%Y%m%d-%H%M%S).log"
  touch "$LOG_FILE" 2>/dev/null && exec > >(tee -a "$LOG_FILE") 2>&1 || LOG_FILE=""
  [[ -n "$LOG_FILE" ]] && echo "[i] لاگ کامل آپدیت: $LOG_FILE"
fi
[[ ! -d "$APP_DIR/.git" ]] && error "مخزن یافت نشد: $APP_DIR — ابتدا install.sh اجرا کنید"

while [[ $# -gt 0 ]]; do
  case $1 in
    --branch)     BRANCH="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --allow-agent-branch) shift ;;   # منسوخ: دیگر لازم نیست (default همیشه دنبال می‌شود)
    *) error "آرگومان ناشناخته: $1" ;;
  esac
done

# ─── تعیین شاخه: فقط default مخزن (مگر صریحاً override شده باشد) ────────────
if [[ -z "$BRANCH" ]]; then
  step "کشف شاخهٔ default مخزن..."
  BRANCH="$(resolve_default_branch "$APP_DIR" 2>/dev/null || true)"
  [[ -z "$BRANCH" ]] && error "شاخهٔ default مخزن کشف نشد (دسترسی به remote؟).
        اتصال شبکه را بررسی کنید یا شاخه را صریح بدهید: sudo bash deploy/update.sh --branch <branch>"
  info "شاخهٔ default مخزن: $BRANCH"
  if [[ "$BRANCH" =~ ${AGENT_BRANCH_PATTERN:-^(claude/|codex/|tmp/|wip/)} ]]; then
    warn "⚠ توجه: «$BRANCH» شبیه یک شاخهٔ کاری موقت است — طبق تنظیم شما از همان دیپلوی می‌شود."
  fi
else
  info "شاخهٔ دستی (override): $BRANCH"
fi
# origin/HEAD محلی هم با remote هم‌گام شود تا ابزارهای دیگر گیج نشوند
sudo -u "$APP_USER" git -C "$APP_DIR" remote set-head origin -a &>/dev/null || true

# git safe.directory برای جلوگیری از خطای dubious ownership
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

WEB_DIR="$APP_DIR"
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
sudo -u "$APP_USER" git -C "$APP_DIR" config core.fileMode false 2>/dev/null || true
sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin "$BRANCH"
# مثل install.sh: تغییرات محلی روی فایل‌های تحت گیت، checkout را abort می‌کرد.
if ! sudo -u "$APP_USER" git -C "$APP_DIR" diff --quiet; then
  PATCH="/root/habibazar-local-changes-$(date +%Y%m%d-%H%M%S).patch"
  sudo -u "$APP_USER" git -C "$APP_DIR" diff HEAD > "$PATCH" 2>/dev/null || true
  warn "تغییرات محلی کنار گذاشته شد (بکاپ: $PATCH)"
fi
sudo -u "$APP_USER" git -C "$APP_DIR" checkout -f "$BRANCH" 2>/dev/null \
  || sudo -u "$APP_USER" git -C "$APP_DIR" checkout -f -B "$BRANCH" "origin/$BRANCH"
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
  if git -C "$APP_DIR" diff "$PREV_COMMIT" HEAD -- package.json package-lock.json 2>/dev/null | grep -q . || [[ ! -d node_modules/eslint ]]; then
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
