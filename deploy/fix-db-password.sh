#!/usr/bin/env bash
# =============================================================================
# HBZ Website — هم‌گام‌سازی رمز PostgreSQL (رفع انسداد فاز ۲۶.۳۰ بند ۰)
# =============================================================================
# مسئله: رمز کاربر `habibazar` در دیتابیس با آنچه در .env.local است یکی نیست،
# بنابراین اپلیکیشن نمی‌تواند وصل شود و هفت فاز کار روی سرور نرفته است.
#
# این اسکریپت رمز را در **هر دو جا** هم‌زمان ست می‌کند تا دیگر واگرا نشوند:
#   ۱) بکاپ .env.local  ۲) ALTER USER در PostgreSQL  ۳) نوشتن DATABASE_URL
#   ۴) تست اتصال واقعی  ۵) ری‌استارت PM2 با --update-env
#
# نکتهٔ مهم: رمزی که کاراکتر خاص دارد (@ : / ? # [ ] و فاصله) باید در
# DATABASE_URL به‌صورت percent-encoded نوشته شود، وگرنه رشتهٔ اتصال بی‌صدا
# اشتباه parse می‌شود — دقیقاً همان کلاس خطایی که این انسداد را ساخت.
#
# استفاده:
#   sudo bash deploy/fix-db-password.sh                 # رمز را می‌پرسد
#   sudo bash deploy/fix-db-password.sh --generate      # رمز امن تولید می‌کند
#   sudo bash deploy/fix-db-password.sh --check         # فقط تشخیص، بدون تغییر
# =============================================================================
set -Eeuo pipefail

APP_USER="hbz"
APP_DIR="/var/www/habibazar"
ENV_FILE="$APP_DIR/.env.local"
DB_NAME="${HBZ_DB_NAME:-habibazar}"
DB_USER="${HBZ_DB_USER:-habibazar}"
DB_HOST="${HBZ_DB_HOST:-127.0.0.1}"
DB_PORT="${HBZ_DB_PORT:-5432}"

MODE="prompt"
[[ "${1:-}" == "--generate" ]] && MODE="generate"
[[ "${1:-}" == "--check" ]]    && MODE="check"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
CURRENT_STEP="شروع"
info()  { echo -e "${GREEN}[✔]${NC} $*"; }
step()  { CURRENT_STEP="$*"; echo -e "${CYAN}[→]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*"; exit 1; }

on_error() {
  local code=$? line="${1:-?}" cmd="${BASH_COMMAND:-?}"
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo -e "${RED}[✘] متوقف شد${NC}"
  echo -e "${RED}    مرحله : ${CURRENT_STEP}${NC}"
  echo -e "${RED}    خط    : ${line}${NC}"
  echo -e "${RED}    دستور : ${cmd}${NC}"
  echo -e "${RED}    کد    : ${code}${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  [[ -n "${ENV_BACKUP:-}" && -f "${ENV_BACKUP:-}" ]] && \
    echo -e "${YELLOW}    بکاپ env دست‌نخورده است: ${ENV_BACKUP}${NC}"
  exit "$code"
}
trap 'on_error $LINENO' ERR
trap 'echo -e "\n${YELLOW}[!] با Ctrl+C لغو شد. هیچ تغییری اعمال نشد مگر مراحلی که ✔ گرفتند.${NC}"; exit 130' INT TERM

[[ $EUID -eq 0 ]] || error "این اسکریپت باید با sudo اجرا شود."
command -v psql >/dev/null || error "psql پیدا نشد — آیا PostgreSQL نصب است؟"

# ── percent-encoding برای رمز داخل DATABASE_URL ──────────────────────────────
urlencode() {
  local s="$1" out="" c
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

# ── ۱) تشخیص وضعیت فعلی ──────────────────────────────────────────────────────
step "تشخیص وضعیت فعلی"
[[ -f "$ENV_FILE" ]] || error "فایل env پیدا نشد: $ENV_FILE"

CURRENT_DSN="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
if [[ -z "$CURRENT_DSN" ]]; then
  warn "DATABASE_URL در env نیست — ساخته خواهد شد."
else
  echo "    DATABASE_URL فعلی (رمز پنهان): $(sed -E 's#(://[^:]+:)[^@]*(@)#\1********\2#' <<<"$CURRENT_DSN")"
fi

# آیا اتصال فعلی کار می‌کند؟
CONN_OK=false
if [[ -n "$CURRENT_DSN" ]] && psql "$CURRENT_DSN" -tAc 'SELECT 1' >/dev/null 2>&1; then
  CONN_OK=true
  info "اتصال فعلی سالم است."
else
  warn "اتصال فعلی برقرار نمی‌شود — همین انسداد است."
fi

if [[ "$MODE" == "check" ]]; then
  if $CONN_OK; then
    info "نتیجه: مشکلی نیست. نیازی به اجرای این اسکریپت ندارید."
    exit 0
  fi
  warn "نتیجه: رمز هم‌گام نیست. برای رفع، بدون --check اجرا کنید."
  exit 1
fi

if $CONN_OK; then
  read -r -p "اتصال هم‌اکنون سالم است. باز هم رمز عوض شود؟ [y/N] " ans
  [[ "${ans,,}" == "y" ]] || { info "بدون تغییر خارج شد."; exit 0; }
fi

# ── ۲) گرفتن/تولید رمز جدید ──────────────────────────────────────────────────
step "تعیین رمز جدید"
if [[ "$MODE" == "generate" ]]; then
  # فقط کاراکترهای امن برای URL — تا مسئلهٔ encoding اصلاً پیش نیاید.
  NEW_PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
  info "رمز امن ۳۲ کاراکتری تولید شد."
else
  read -r -s -p "رمز جدید کاربر ${DB_USER}: " NEW_PASS; echo
  read -r -s -p "تکرار رمز: " NEW_PASS2; echo
  [[ "$NEW_PASS" == "$NEW_PASS2" ]] || error "رمزها یکی نیستند."
  [[ ${#NEW_PASS} -ge 12 ]] || error "رمز باید حداقل ۱۲ کاراکتر باشد."
fi

ENC_PASS="$(urlencode "$NEW_PASS")"
if [[ "$ENC_PASS" != "$NEW_PASS" ]]; then
  warn "رمز کاراکتر خاص دارد → در DATABASE_URL به‌صورت encode‌شده نوشته می‌شود."
fi
NEW_DSN="postgresql://${DB_USER}:${ENC_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ── ۳) بکاپ env ──────────────────────────────────────────────────────────────
step "بکاپ فایل env"
ENV_BACKUP="${ENV_FILE}.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "$ENV_FILE" "$ENV_BACKUP"
chmod 600 "$ENV_BACKUP"
info "بکاپ: $ENV_BACKUP"

# ── ۴) اعمال رمز در PostgreSQL ───────────────────────────────────────────────
step "اعمال رمز در PostgreSQL"
# رمز در SQL باید single-quote-escape شود ('' برای هر ').
SQL_PASS="${NEW_PASS//\'/\'\'}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER \"${DB_USER}\" WITH PASSWORD '${SQL_PASS}';" >/dev/null
info "رمز کاربر ${DB_USER} در دیتابیس تغییر کرد."

# ── ۵) نوشتن DATABASE_URL در env ─────────────────────────────────────────────
step "نوشتن DATABASE_URL در env"
if grep -qE '^DATABASE_URL=' "$ENV_FILE"; then
  # از یک delimiter نامتعارف استفاده می‌کنیم چون DSN پر از / و : است.
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${NEW_DSN}|" "$ENV_FILE"
else
  echo "DATABASE_URL=${NEW_DSN}" >> "$ENV_FILE"
fi
chown "$APP_USER":"$APP_USER" "$ENV_FILE" 2>/dev/null || true
chmod 600 "$ENV_FILE"
info "env به‌روزرسانی شد."

# نسخهٔ مرجع برای اسکریپت‌های دیگر (update.sh از این می‌خواند اگر env نداشت)
echo "$NEW_DSN" > /root/.habibazar-pg-dsn
chmod 600 /root/.habibazar-pg-dsn

# ── ۶) تست اتصال واقعی ───────────────────────────────────────────────────────
step "تست اتصال با رمز جدید"
psql "$NEW_DSN" -tAc 'SELECT 1' >/dev/null || error "اتصال با رمز جدید برقرار نشد — بکاپ env: $ENV_BACKUP"
info "اتصال برقرار است."

# اثبات واقعی: خواندن یک جدول کسب‌وکاری، نه فقط SELECT 1
step "اثبات: خواندن جدول واقعی"
TABLES="$(psql "$NEW_DSN" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
echo "    تعداد جدول‌های public: ${TABLES}"
if [[ "$TABLES" -lt 100 ]]; then
  warn "تعداد جدول کمتر از انتظار (~۱۴۱) است — احتمالاً migrationها هنوز اجرا نشده‌اند."
  warn "این طبیعی است اگر هنوز deploy/update.sh را نزده‌اید."
else
  USERS="$(psql "$NEW_DSN" -tAc 'SELECT count(*) FROM users' 2>/dev/null || echo '?')"
  info "خواندن جدول users موفق بود (${USERS} کاربر)."
fi

# ── ۷) ری‌استارت PM2 با env جدید ─────────────────────────────────────────────
step "ری‌استارت PM2 با env تازه"
if command -v pm2 >/dev/null && sudo -u "$APP_USER" pm2 list 2>/dev/null | grep -q habibazar; then
  # --update-env اجباری است: بدون آن PM2 رمز قدیمی را در حافظه نگه می‌دارد.
  sudo -u "$APP_USER" pm2 restart habibazar --update-env >/dev/null
  info "PM2 با env جدید ری‌استارت شد."
  sleep 4
  CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health || echo 000)"
  if [[ "$CODE" == "200" ]]; then
    info "health = 200 — اپلیکیشن سالم بالا آمد."
  else
    warn "health = ${CODE} — اگر هنوز update.sh نزده‌اید طبیعی است (schema قدیمی)."
  fi
else
  warn "PM2 یا پروسهٔ habibazar پیدا نشد — ری‌استارت رد شد."
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}[✔] رمز هم‌گام شد.${NC}"
echo -e "    بکاپ env : ${ENV_BACKUP}"
if [[ "$MODE" == "generate" ]]; then
  echo -e "${YELLOW}    رمز تولیدشده را همین حالا در جای امن ذخیره کنید:${NC}"
  echo -e "${YELLOW}    ${NEW_PASS}${NC}"
fi
echo ""
echo -e "${CYAN}گام بعدی:${NC}"
echo -e "    sudo bash deploy/update.sh          # آوردن هفت فاز کار روی سرور"
echo -e "    sudo bash deploy/post-deploy-check.sh   # سلامت‌سنجی"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
