#!/usr/bin/env bash
# =============================================================================
# HBZ Website — تولید و نصب پیکربندی nginx از قالب (INFRA-1 بند ۵)
# =============================================================================
# Usage:
#   bash deploy/nginx/render-nginx.sh                        # تعاملی/از .install.conf → فقط تولید و چاپ
#   PRIMARY_DOMAIN=habibazar.ir REDIRECT_DOMAINS="www.habibazar.ir" \
#     bash deploy/nginx/render-nginx.sh --install            # تولید + نصب + nginx -t + reload (روی سرور)
#
# دامنه‌ها در deploy/.install.conf ذخیره می‌شوند تا install/update دوباره نپرسند.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${GREEN}[✔]${NC} $*"; }
step() { echo -e "${CYAN}[→]${NC} $*"; }
die()  { echo -e "${RED}[✘]${NC} $*"; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$HERE/../.." && pwd)}"
CONF_STORE="${CONF_STORE:-$HERE/../.install.conf}"
TEMPLATE="$HERE/habibazar.conf.template"
APP_PORT="${APP_PORT:-3000}"
INSTALL=false
[[ "${1:-}" == "--install" ]] && INSTALL=true

[[ -f "$TEMPLATE" ]] || die "قالب یافت نشد: $TEMPLATE"

# ── دامنه‌ها: env → .install.conf → پرسش تعاملی ─────────────────────────────
if [[ -z "${PRIMARY_DOMAIN:-}" && -f "$CONF_STORE" ]]; then
  # shellcheck disable=SC1090
  source "$CONF_STORE"
fi
if [[ -z "${PRIMARY_DOMAIN:-}" ]]; then
  read -rp "دامنهٔ اصلی سایت (مثل habibazar.ir): " PRIMARY_DOMAIN
  read -rp "دامنه‌های ریدایرکت (با فاصله، مثل: www.habibazar.ir؛ خالی = هیچ): " REDIRECT_DOMAINS || true
fi
REDIRECT_DOMAINS="${REDIRECT_DOMAINS:-}"

valid_domain() { [[ "$1" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]]; }
# اعتبارسنجی: بدون http/https و اسلش
PRIMARY_DOMAIN="${PRIMARY_DOMAIN#http://}"; PRIMARY_DOMAIN="${PRIMARY_DOMAIN#https://}"; PRIMARY_DOMAIN="${PRIMARY_DOMAIN%%/*}"
valid_domain "$PRIMARY_DOMAIN" || die "دامنهٔ اصلی نامعتبر است: $PRIMARY_DOMAIN"
CLEAN_REDIRECTS=""
for d in ${REDIRECT_DOMAINS//,/ }; do
  d="${d#http://}"; d="${d#https://}"; d="${d%%/*}"
  [[ -z "$d" ]] && continue
  valid_domain "$d" || die "دامنهٔ ریدایرکت نامعتبر است: $d"
  [[ "$d" == "$PRIMARY_DOMAIN" ]] && die "دامنهٔ ریدایرکت با اصلی یکی است: $d"
  CLEAN_REDIRECTS="$CLEAN_REDIRECTS $d"
done
CLEAN_REDIRECTS="${CLEAN_REDIRECTS# }"

# ذخیره برای دفعات بعد (install/update دوباره نپرسند)
{ echo "PRIMARY_DOMAIN=\"$PRIMARY_DOMAIN\""; echo "REDIRECT_DOMAINS=\"$CLEAN_REDIRECTS\""; } > "$CONF_STORE"
info "دامنه‌ها ذخیره شد: $CONF_STORE (اصلی: $PRIMARY_DOMAIN | ریدایرکت: ${CLEAN_REDIRECTS:-—})"

# ── تولید conf ───────────────────────────────────────────────────────────────
OUT="${OUT:-$HERE/habibazar.conf}"
RENDERED="$(sed -e "s|{{PRIMARY_DOMAIN}}|$PRIMARY_DOMAIN|g" -e "s|{{APP_PORT}}|$APP_PORT|g" -e "s|{{APP_DIR}}|$APP_DIR|g" "$TEMPLATE")"
if [[ -n "$CLEAN_REDIRECTS" ]]; then
  RENDERED="${RENDERED//\{\{REDIRECT_DOMAINS\}\}/$CLEAN_REDIRECTS}"
else
  # بدون دامنهٔ ریدایرکت: بلوک اول را حذف کن (از اولین "server {" تا قبل از کامنت دامنهٔ اصلی)
  RENDERED="$(echo "$RENDERED" | awk '/^# ── دامنه\(های\) ریدایرکت/{skip=1} /^# ── دامنهٔ اصلی/{skip=0} !skip')"
fi
echo "$RENDERED" > "$OUT"
info "پیکربندی تولید شد: $OUT"

if [[ "$INSTALL" != true ]]; then
  echo ""
  echo "─ فقط تولید شد (چاپ ۲۰ خط اول). برای نصب روی سرور: --install"
  head -20 "$OUT"
  exit 0
fi

# ── نصب روی سرور (فقط با --install) ─────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "نصب nginx نیاز به روت دارد"
mkdir -p /var/www/letsencrypt
cp "$OUT" /etc/nginx/sites-available/habibazar
ln -sf /etc/nginx/sites-available/habibazar /etc/nginx/sites-enabled/habibazar
rm -f /etc/nginx/sites-enabled/default
step "nginx -t (تست پیکربندی قبل از reload)..."
nginx -t || die "پیکربندی nginx خطا دارد — reload انجام نشد (فایل قبلی دست‌نخورده فعال است)"
systemctl reload nginx
info "nginx بدون داون‌تایم reload شد"

if command -v certbot >/dev/null; then
  echo "برای HTTPS (اگر هنوز گواهی ندارید):"
  echo "  certbot --nginx -d $PRIMARY_DOMAIN$(for d in $CLEAN_REDIRECTS; do printf ' -d %s' "$d"; done)"
else
  echo "certbot نصب نیست. برای HTTPS:"
  echo "  apt install certbot python3-certbot-nginx"
  echo "  certbot --nginx -d $PRIMARY_DOMAIN$(for d in $CLEAN_REDIRECTS; do printf ' -d %s' "$d"; done)"
fi
echo "(تمدید خودکار: systemd timer certbot — بررسی: systemctl list-timers | grep certbot)"
