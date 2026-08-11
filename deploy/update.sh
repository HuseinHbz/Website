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
#
# 🔴🔴🔴 هرگز روی این کلون (/var/www/habibazar) دستی git pull / git fetch /
# git checkout / npm ci / npm run build نزنید — فقط همیشه همین اسکریپت.
# هر دستور دستی می‌تواند فایل با مالکیت root بسازد و اجرای بعدی این اسکریپت را
# با «Permission denied» متوقف کند (رجوع کنید به deploy/README.md و
# docs/governance/deploy-fix-2-report.md). برای دیباگ مستقیم روی این مسیر:
# `sudo -u hbz -i` — هرگز به‌عنوان root کار نکنید.
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

# ─── محافظت از خودِ اسکریپت (مثل install.sh): اجرا از کپی خارج از کلون ──────
# reset --hard فایل‌های کلون را عوض می‌کند؛ اگر اسکریپت از داخل همان پوشه اجرا
# شده باشد، bash وسط اجرا فایل تغییر‌یافته را می‌خواند.
SELF="$(readlink -f "${BASH_SOURCE[0]}")"
if [[ -z "${HBZ_SELF_COPY:-}" && "$SELF" == "$APP_DIR"/* ]]; then
  SAFE_DIR="$(mktemp -d /tmp/hbz-deploy-XXXXXX)"
  cp -r "$(dirname "$SELF")/." "$SAFE_DIR/"
  export HBZ_SELF_COPY=1
  echo "[i] اجرا از کپی امن: $SAFE_DIR/$(basename "$SELF")"
  exec bash "$SAFE_DIR/$(basename "$SELF")" "$@"
fi

# لاگ کامل روی دیسک
if [[ -z "${HBZ_UPDATE_LOGGING:-}" ]]; then
  export HBZ_UPDATE_LOGGING=1
  LOG_FILE="/var/log/habibazar-update-$(date +%Y%m%d-%H%M%S).log"
  touch "$LOG_FILE" 2>/dev/null && exec > >(tee -a "$LOG_FILE") 2>&1 || LOG_FILE=""
  [[ -n "$LOG_FILE" ]] && echo "[i] لاگ کامل آپدیت: $LOG_FILE"
fi
[[ ! -d "$APP_DIR/.git" ]] && error "مخزن یافت نشد: $APP_DIR — ابتدا install.sh اجرا کنید"

# 🔴 اولین چیزی که دیده می‌شود، نه فقط چیزی که در لاگ گم می‌شود (DEPLOY-FIX-2 بند ۲).
echo -e "${RED}🔴 یادآوری: فقط از همین اسکریپت استفاده کنید — هرگز git/npm/build دستی روی $APP_DIR${NC}"

# ─── حسابرسی drift مالکیت — قبل از هر ترمیمی، شمارش و لاگ می‌شود ─────────────
# (DEPLOY-FIX-2 بند ۰) — self-heal بی‌قید-و-شرط علامت را رفع می‌کند، ولی بدون
# ثبت شدنِ «چند بار و چقدر drift داشتیم»، الگوی تکرار قابل ردیابی نیست. این خط
# فقط می‌شمارد و به یک لاگ دائمی (جدا از لاگ هر اجرا) اضافه می‌کند — چیزی را
# تغییر نمی‌دهد، فقط شاهد جمع می‌کند.
DRIFT_LOG="/var/log/habibazar-ownership-drift.log"
DRIFT_COUNT=$(find "$APP_DIR" -mindepth 1 \
  \( -path "$APP_DIR/node_modules" -o -path "$APP_DIR/.git" -o -path "$APP_DIR/.next" \) -prune \
  -o \( ! -user "$APP_USER" -o ! -group "$APP_USER" \) -print 2>/dev/null | wc -l)
if [[ "$DRIFT_COUNT" -gt 0 ]]; then
  warn "🔴 $DRIFT_COUNT مسیر با مالکیت غیر از $APP_USER پیدا شد — ترمیم می‌شود (جزئیات: $DRIFT_LOG)"
  { echo "$(date '+%Y-%m-%d %H:%M:%S')  drift=$DRIFT_COUNT  branch=${BRANCH:-?}"
    find "$APP_DIR" -mindepth 1 \
      \( -path "$APP_DIR/node_modules" -o -path "$APP_DIR/.git" -o -path "$APP_DIR/.next" \) -prune \
      -o \( ! -user "$APP_USER" -o ! -group "$APP_USER" \) -printf '  %u:%g  %p\n' 2>/dev/null
  } >> "$DRIFT_LOG" 2>/dev/null || true
fi

# ─── ترمیم خودکار مالکیت کلون (self-heal) ────────────────────────────────────
# 26.30-fix-ownership: نسخهٔ اول self-heal ابتدا با find تشخیص می‌داد که آیا
# مالکیت اشتباهی وجود دارد، و فقط در آن صورت chown -R می‌زد. حادثهٔ بعدی نشان
# داد این کافی نیست: پس از یک git pull دستیِ خارج از این اسکریپت (که خودش
# می‌تواند فایل با مالکیت root بسازد)، یک اجرای بعدیِ update.sh دوباره با
# «Permission denied» روی فایل‌های تازه‌ساخته‌شدهٔ فاز ۲۸.۵ متوقف شد.
# 🔴 راه‌حل قطعی: به‌جای «تشخیص بده بعد تصمیم بگیر»، مالکیت کل درخت — فایل و
# پوشه، بدون قید و شرط — پیش از **هر دو** نقطهٔ بحرانی (fetch و reset --hard)
# تضمین می‌شود. هزینهٔ chown روی یک درخت سالم ناچیز است؛ idempotent و بی‌خطر.
heal_ownership() {
  sudo find "$APP_DIR" -mindepth 1 \
    \( -path "$APP_DIR/node_modules" -o -path "$APP_DIR/.git" -o -path "$APP_DIR/.next" \) -prune \
    -o -exec chown "$APP_USER":"$APP_USER" {} +
}

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
warn "🔴 روی این کلون هرگز git pull/fetch/checkout دستی نزنید — همیشه فقط از همین اسکریپت (sudo bash deploy/update.sh) استفاده کنید."
echo ""

# ─── commit فعلی ─────────────────────────────────────────────────────────────
PREV_COMMIT=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
PREV_BRANCH=$(git -C "$APP_DIR" branch --show-current 2>/dev/null || echo "unknown")
step "نسخه فعلی: $PREV_COMMIT (branch: $PREV_BRANCH)"

# ─── git pull ─────────────────────────────────────────────────────────────────
step "دریافت آخرین تغییرات از branch $BRANCH..."
step "ترمیم مالکیت کلون پیش از fetch..."
heal_ownership
sudo -u "$APP_USER" git -C "$APP_DIR" config core.fileMode false 2>/dev/null || true
sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin "$BRANCH"
# مثل install.sh: تغییرات محلی روی فایل‌های تحت گیت، checkout را abort می‌کرد.
if ! sudo -u "$APP_USER" git -C "$APP_DIR" diff --quiet; then
  PATCH="/root/habibazar-local-changes-$(date +%Y%m%d-%H%M%S).patch"
  sudo -u "$APP_USER" git -C "$APP_DIR" diff HEAD > "$PATCH" 2>/dev/null || true
  warn "تغییرات محلی کنار گذاشته شد (بکاپ: $PATCH)"
fi
# 🔴 نقطهٔ بحرانی دوم — بین fetch و reset --hard هم یک git pull دستیِ موازی یا
# یک مرحلهٔ دیگر می‌تواند دوباره مالکیت را بهم بزند؛ درست پیش از reset دوباره
# ترمیم می‌کنیم، نه فقط یک‌بار در ابتدای اسکریپت.
step "ترمیم مالکیت کلون پیش از reset --hard..."
heal_ownership
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
  # ─── snapshot + شروع تازه برای .next ──────────────────────────────────────────
  # build همیشه به‌عنوان $APP_USER اجرا می‌شود (خط پایین‌تر) و Next.js حین build
  # داخل .next می‌نویسد (.next/trace و غیره). یک chown -R روی .next موجود اینجا
  # قبلاً امتحان و رد شد: حتی بعد از آن، build باز هم دقیقاً همان
  # «EACCES: permission denied, open '.../.next/trace'» را داد — یعنی صرفِ عوض‌
  # کردن مالکیت پوشهٔ قدیمی کافی نبود (fs بیگانه/overlay، فایل باقی‌ماندهٔ قفل‌شده
  # از یک build نیمه‌کاره، یا هر علت دیگری که بدون SSH به سرور قابل عیب‌یابی
  # دقیق نبود). راه‌حل قطعی‌تر: به‌جای تعمیر یک .next که تاریخچهٔ نامعلومی دارد،
  # از آن snapshot می‌گیریم (با root — چون فقط root تضمینی همه‌چیز را می‌خواند،
  # صرف‌نظر از مالکیت فعلی) و بعد snapshot را صریحاً hbz-مالک می‌کنیم، سپس خودِ
  # .next زنده را کامل حذف می‌کنیم — build روی یک .next کاملاً تازه اجرا می‌شود که
  # از همان لحظهٔ ساخته‌شدن مالکیتش hbz است (چون خودِ فرایند build با
  # sudo -u hbz آن را می‌سازد)، پس هیچ ابهامی دربارهٔ مالکیت باقی نمی‌ماند.
  if [[ -d "$WEB_DIR/.next" ]]; then
    step "ذخیره snapshot برای rollback..."
    rm -rf "$WEB_DIR/.next.bak"
    cp -r "$WEB_DIR/.next" "$WEB_DIR/.next.bak"
    chown -R "$APP_USER":"$APP_USER" "$WEB_DIR/.next.bak"
    rm -rf "$WEB_DIR/.next"
  fi

  # ─── npm ci ──────────────────────────────────────────────────────────────────
  if git -C "$APP_DIR" diff "$PREV_COMMIT" HEAD -- package.json package-lock.json 2>/dev/null | grep -q . || [[ ! -d node_modules/eslint ]]; then
    # node_modules عمداً از heal_ownership مستثنی است (اسکن سریع سورس/گیت را کند
    # نکند) — اما همان خانوادهٔ مشکل اینجا هم ممکن است رخ دهد (DEPLOY-FIX-2 بند
    # ۱/R3). فقط وقتی واقعاً npm ci قرار است اجرا شود ترمیم می‌کنیم — نه در مسیر
    # «تغییر نکرده»، تا آن مسیر سریع بماند.
    if [[ -d "$WEB_DIR/node_modules" ]]; then
      chown -R "$APP_USER":"$APP_USER" "$WEB_DIR/node_modules" 2>/dev/null || true
    fi
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
    # 🔴 DEPLOY-FIX-2 بند ۴ — اگر بین دو اجرا default branch مخزن عوض شده باشد
    # (مثلاً V3-Codex → claude/bold-lamport-a1d6tg)، $PREV_BRANCH با $BRANCH فرق
    # دارد؛ یک `reset --hard $PREV_COMMIT` ساده روی برنچِ فعلی ($BRANCH) در این
    # حالت اشارگر همان برنچ را به کامیتی از یک تاریخچهٔ کاملاً نامرتبط (برنچ قبلی)
    # می‌برد — دقیقاً همان چیزی که در لاگ‌های واقعی به‌صورت «Your branch and
    # origin have diverged» ظاهر شد. اگر برنچ عوض شده، به همان نام برنچ قبلی
    # برمی‌گردیم (نه این‌که برنچ فعلی را به کامیت بیگانه ریست کنیم) تا هیچ
    # برنچی با تاریخچهٔ اشتباه آلوده نشود.
    if [[ "$PREV_BRANCH" != "$BRANCH" && "$PREV_BRANCH" != "unknown" && -n "$PREV_BRANCH" ]]; then
      warn "برنچ قبلی ($PREV_BRANCH) با برنچ فعلی ($BRANCH) فرق دارد — به‌جای reset روی $BRANCH، به خودِ $PREV_BRANCH برمی‌گردیم"
      sudo -u "$APP_USER" git -C "$APP_DIR" checkout -f "$PREV_BRANCH" 2>/dev/null \
        || sudo -u "$APP_USER" git -C "$APP_DIR" checkout -f -B "$PREV_BRANCH" "$PREV_COMMIT"
    else
      sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "$PREV_COMMIT"
    fi
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
