#!/usr/bin/env bash
# =============================================================================
# HBZ Website — عیب‌یابی آپلود رسانه در Production (26.34)
# =============================================================================
# ساخته شد چون این Session به سرور Production دسترسی مستقیم ندارد. اگر آپلود
# ویدیوی پس‌زمینه یا عکس پروفایل روی سایت واقعی شکست می‌خورد اما در بازتولید
# محلی/Build تولیدی موفق است، علت تقریباً همیشه یکی از موارد زیر است — این
# اسکریپت همه را در یک اجرا بررسی و گزارش می‌کند، هیچ‌چیزی را تغییر نمی‌دهد و
# هیچ Secret/رمز/توکنی چاپ نمی‌کند.
#
# استفاده:
#   sudo bash deploy/upload-diagnostics.sh
#   sudo bash deploy/upload-diagnostics.sh --json
#
# سپس کل خروجی را برای تحلیل به Session بعدی بدهید — این خودِ گزارش است که
# «رفع شد» را واقعی می‌کند، نه حدس.
# =============================================================================
set -Eeuo pipefail

# 26.34 бند۸ — never print a secret. Shared filter (also unit-tested on its
# own — deploy/lib/__tests__/redact.bats): DB connection-string credentials,
# JWTs, Cookie/Authorization headers, and *_TOKEN/*_KEY/*_SECRET/PASSWORD/
# DATABASE_URL values are all masked before anything reaches stdout.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/redact.sh
source "$SCRIPT_DIR/lib/redact.sh"
# Global safety net (in addition to the two call sites that pipe through
# `redact` explicitly): every byte this script writes to stdout from here
# on is filtered, so a FUTURE line added anywhere in this file that prints
# raw command output can't reintroduce a leak just because someone forgot
# to pipe it through `redact` by hand.
if [[ -z "${HBZ_DIAG_REDACTED:-}" ]]; then
  export HBZ_DIAG_REDACTED=1
  exec > >(redact)
fi

APP_DIR="/var/www/habibazar"
UPLOAD_DIR="$APP_DIR/public/uploads"
ENV_FILE="$APP_DIR/.env.local"
JSON=false
[[ "${1:-}" == "--json" ]] && JSON=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
declare -a ROWS
say()  { $JSON || echo -e "$1"; }
sect() { say "\n${CYAN}── $* ─────────────────────────────${NC}"; }
kv()   { say "  ${1}: ${2}"; ROWS+=("$1|$2"); }

say "${CYAN}HBZ — عیب‌یابی Upload  ($(date '+%Y-%m-%d %H:%M'))${NC}"

# همان محاسبهٔ render-nginx.sh / src/lib/media/limits.ts — یک منبع واحد،
# سه زبان اجرا (TS، bash در render-nginx.sh، bash این‌جا)، همیشه هم‌فرمول.
diag_readenv() {
  local name="$1" fallback="$2"
  if [[ -f "$ENV_FILE" ]]; then
    local v; v="$(grep -E "^${name}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)"
    [[ -n "$v" && "$v" =~ ^[0-9]+$ ]] && { echo "$v"; return; }
  fi
  echo "$fallback"
}
expected_max_upload_mb() {
  local m; m="$(diag_readenv MEDIA_MAX_GENERAL_MB 100)"
  local v
  for v in "$(diag_readenv MEDIA_MAX_BACKGROUND_VIDEO_MB 25)" "$(diag_readenv MEDIA_MAX_ANIMATION_VIDEO_MB 8)" \
           "$(diag_readenv MEDIA_MAX_IMAGE_MB 5)" "$(diag_readenv MEDIA_MAX_VECTOR_MB 1)"; do
    (( v > m )) && m=$v
  done
  echo $((m + 10))
}

# ── ۱) کاربر اجرای PM2 و مالکیت پوشهٔ Upload ────────────────────────────────
# اگر PM2 با کاربری غیر از مالک public/uploads اجرا شود، هر نوشتن با
# EACCES شکست می‌خورد — این دقیقاً همان «مالکیت متفاوت PM2 و پوشه Upload»ی
# است که در پرامپت پرسیده شده.
sect "کاربر PM2 و مالکیت Upload"
PM2_USER="$(pm2 jlist 2>/dev/null | grep -o '"username":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "نامشخص")"
kv "کاربر PM2" "${PM2_USER:-نامشخص}"
if [[ -d "$UPLOAD_DIR" ]]; then
  OWNER="$(stat -c '%U:%G' "$UPLOAD_DIR" 2>/dev/null || echo "نامشخص")"
  PERMS="$(stat -c '%A' "$UPLOAD_DIR" 2>/dev/null || echo "نامشخص")"
  kv "مالک public/uploads" "$OWNER"
  kv "مجوز public/uploads" "$PERMS"
else
  kv "public/uploads" "❌ وجود ندارد — mkdir لازم است"
fi
say ""
say "  زیرپوشه‌ها (حداکثر ۲ سطح):"
find "$UPLOAD_DIR" -maxdepth 2 -type d -printf '  %M %u:%g %p\n' 2>/dev/null || say "  (قابل خواندن نیست)"

# ── ۲) نوشتن آزمایشی واقعی (نه فقط خواندن مجوز) ─────────────────────────────
sect "تست نوشتن واقعی در public/uploads"
TESTFILE="$UPLOAD_DIR/.diagnostics-write-test-$$"
if touch "$TESTFILE" 2>/dev/null; then
  kv "نوشتن آزمایشی" "✔ موفق"
  rm -f "$TESTFILE"
else
  kv "نوشتن آزمایشی" "❌ ناموفق — دسترسی نوشتن کاربر فعلی به public/uploads را بررسی کنید"
fi

# ── ۳) فضای دیسک و Inode ─────────────────────────────────────────────────────
sect "فضای دیسک و Inode"
say "$(df -h "$APP_DIR" 2>/dev/null | sed 's/^/  /')"
say ""
say "$(df -i "$APP_DIR" 2>/dev/null | sed 's/^/  /')"

# ── ۴) Nginx — client_max_body_size و Timeout ───────────────────────────────
# 26.34 бнд۱-۲: client_max_body_size دیگر هاردکد نیست — از همان منبع واحد
# (src/lib/media/limits.ts ⇄ render-nginx.sh) محاسبه می‌شود و update.sh آن را
# در هر آپدیت بازتولید می‌کند. اما اگر یک نصب قدیمی هرگز update.sh (نسخهٔ جدید)
# را اجرا نکرده باشد، nginx می‌تواند هنوز روی سقف قدیمی/پیش‌فرض گیر کرده
# باشد — این دقیقاً همان علتِ واقعیِ «۱۰۰٪ می‌شود و بعد خطا می‌دهد» بود که این
# بخش پیدا کرد. این‌جا آن را با همان فرمول اپ مقایسه می‌کنیم تا mismatch
# به‌جای حدس، عدد صریح باشد.
sect "Nginx"
if command -v nginx &>/dev/null; then
  if nginx -t &>/dev/null; then kv "nginx -t" "✔ سالم"; else kv "nginx -t" "❌ خطای پیکربندی — nginx -t را دستی اجرا کنید"; fi
  CONF="$(nginx -T 2>/dev/null | redact || true)"
  MAXBODY="$(echo "$CONF" | grep -oP 'client_max_body_size\s+\K\S+' | head -1)"
  READ_TO="$(echo "$CONF" | grep -oP 'proxy_read_timeout\s+\K\S+' | head -1)"
  SEND_TO="$(echo "$CONF" | grep -oP 'proxy_send_timeout\s+\K\S+' | head -1)"
  kv "client_max_body_size (nginx واقعی)" "${MAXBODY:-(پیش‌فرض nginx، معمولاً 1m — یعنی render-nginx.sh هرگز روی این سرور اجرا نشده)}"
  kv "proxy_read_timeout" "${READ_TO:-(پیش‌فرض nginx)}"
  kv "proxy_send_timeout" "${SEND_TO:-(پیش‌فرض nginx)}"
  # همان محاسبه‌ای که render-nginx.sh انجام می‌دهد، برای مقایسه:
  EXPECTED_MB="$(expected_max_upload_mb)"
  kv "client_max_body_size (مقدار مورد انتظار طبق limits.ts)" "${EXPECTED_MB}m"
  if [[ -n "$MAXBODY" && "$MAXBODY" != "${EXPECTED_MB}m" ]]; then
    kv "⚠️ عدم تطابق nginx/اپ" "❌ nginx=$MAXBODY ولی اپ انتظار ${EXPECTED_MB}m دارد — sudo bash deploy/update.sh یا sudo bash deploy/nginx/render-nginx.sh --install را اجرا کنید"
  fi
else
  kv "nginx" "نصب یافت نشد — اگر Reverse Proxy دیگری دارید همان را بررسی کنید"
fi

# ── ۵) PM2 — Timeout، Memory، وضعیت زنده ────────────────────────────────────
sect "PM2"
pm2 status 2>/dev/null | sed 's/^/  /' || kv "pm2 status" "در دسترس نیست"
say ""
say "  آخرین ۲۰۰ خط لاگ (برای یافتن requestId خطای اخیر، این را در لاگ جست‌وجو کنید — Cookie/JWT/DSN/رمز به‌صورت خودکار حذف می‌شود):"
pm2 logs habibazar --lines 200 --nostream 2>/dev/null | tail -50 | redact | sed 's/^/  /' || kv "pm2 logs" "در دسترس نیست"

# ── ۶) دیتابیس و Migration ───────────────────────────────────────────────────
sect "دیتابیس"
DSN=""
[[ -f "$ENV_FILE" ]] && DSN="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
if [[ -z "$DSN" ]]; then
  kv "DATABASE_URL" "❌ در .env.local یافت نشد"
else
  if psql "$DSN" -tAc 'SELECT 1' &>/dev/null; then
    kv "اتصال دیتابیس" "✔ برقرار"
    COUNT="$(psql "$DSN" -tAc "SELECT count(*) FROM media_files" 2>/dev/null | tr -d ' ')"
    kv "تعداد رکورد media_files" "${COUNT:-نامشخص}"
    # media_files باید ستون‌های name_en/name_fa/category داشته باشد (Migration
    # این Session) — نبودشان یعنی migrate.ts هنوز روی این نصب اجرا نشده.
    HASCOL="$(psql "$DSN" -tAc "SELECT count(*) FROM information_schema.columns WHERE table_name='media_files' AND column_name='name_en'" 2>/dev/null | tr -d ' ')"
    if [[ "$HASCOL" == "1" ]]; then kv "ستون‌های bilingual media_files" "✔ موجود"; else kv "ستون‌های bilingual media_files" "❌ موجود نیست — deploy/update.sh را اجرا کنید تا migrate.ts اجرا شود"; fi
  else
    kv "اتصال دیتابیس" "❌ برقرار نشد"
  fi
fi

# ── ۷) متغیرهای محیطی مؤثر بر آپلود (بدون افشای مقدار حساس) ─────────────────
sect "Environment (فقط بررسی وجود، نه مقدار)"
for VAR in MEDIA_MAX_BACKGROUND_VIDEO_MB MEDIA_MAX_ANIMATION_VIDEO_MB MEDIA_MAX_IMAGE_MB MEDIA_MAX_GENERAL_MB NODE_ENV; do
  if grep -q "^${VAR}=" "$ENV_FILE" 2>/dev/null; then
    VAL="$(grep "^${VAR}=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
    kv "$VAR" "$VAL"
  else
    kv "$VAR" "(تنظیم نشده — پیش‌فرض کد استفاده می‌شود)"
  fi
done

# ── ۸) نسخهٔ کد فعلی ──────────────────────────────────────────────────────────
sect "نسخهٔ کد"
cd "$APP_DIR" 2>/dev/null && kv "Commit" "$(git rev-parse --short HEAD 2>/dev/null || echo نامشخص) ($(git log -1 --format=%s 2>/dev/null | head -c 80 || echo ''))"

say "\n${GREEN}پایان — کل این خروجی را برای تحلیل ارسال کنید.${NC}"
