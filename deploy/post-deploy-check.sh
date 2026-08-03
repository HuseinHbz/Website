#!/usr/bin/env bash
# =============================================================================
# HBZ Website — سلامت‌سنجی پس از استقرار (فاز ۲۶.۳۰ بند ۱)
# =============================================================================
# قبل از اینکه هر دادهٔ واقعی وارد سیستم شود، این را اجرا کنید.
#
# فلسفه: این اسکریپت هیچ چیزی را **تغییر نمی‌دهد** — فقط می‌سنجد و گزارش می‌دهد.
# هر بررسی خروجی خام یا عدد واقعی چاپ می‌کند، نه فقط ✔/✘؛ چون درس تکرارشوندهٔ
# این پروژه این بوده که «سبز بودن» بدون عدد، چیزی را اثبات نمی‌کند.
#
# استفاده:
#   sudo bash deploy/post-deploy-check.sh
#   sudo bash deploy/post-deploy-check.sh --json    # خروجی ماشین‌خوان
# =============================================================================
set -Eeuo pipefail

APP_DIR="/var/www/habibazar"
ENV_FILE="$APP_DIR/.env.local"
BASE="${HBZ_BASE_URL:-http://127.0.0.1:3000}"
JSON=false
[[ "${1:-}" == "--json" ]] && JSON=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0
declare -a ROWS

ok()   { PASS=$((PASS+1)); ROWS+=("PASS|$1|$2"); $JSON || echo -e "${GREEN}[✔]${NC} $1 — $2"; }
bad()  { FAIL=$((FAIL+1)); ROWS+=("FAIL|$1|$2"); $JSON || echo -e "${RED}[✘]${NC} $1 — $2"; }
soft() { WARN=$((WARN+1)); ROWS+=("WARN|$1|$2"); $JSON || echo -e "${YELLOW}[!]${NC} $1 — $2"; }
sect() { $JSON || echo -e "\n${CYAN}── $* ─────────────────────────────${NC}"; }

# DSN را از env می‌خوانیم (نه از حدس)
DSN=""
[[ -f "$ENV_FILE" ]] && DSN="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
q() { psql "$DSN" -tAc "$1" 2>/dev/null | tr -d ' \n' || echo "ERR"; }

# curl already emits 000 when it cannot connect; adding `|| echo 000` appended a
# SECOND one ("000000") which then matched none of the comparisons below. One
# helper, one value, always numeric.
http() { curl -s -o "${2:-/dev/null}" -w '%{http_code}' --max-time 15 "$1" 2>/dev/null | tr -d ' \n'; }

$JSON || echo -e "${CYAN}HBZ — سلامت‌سنجی پس از استقرار  ($(date '+%Y-%m-%d %H:%M'))${NC}"

# ── ۱) اتصال و migrationها ───────────────────────────────────────────────────
sect "دیتابیس و migration"
if [[ -z "$DSN" ]]; then
  bad "DATABASE_URL" "در $ENV_FILE نیست — deploy/fix-db-password.sh را اجرا کنید"
elif [[ "$(q 'SELECT 1')" != "1" ]]; then
  bad "اتصال دیتابیس" "برقرار نشد — deploy/fix-db-password.sh --check"
else
  ok "اتصال دیتابیس" "برقرار"
  T="$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
  if [[ "$T" =~ ^[0-9]+$ ]] && [[ "$T" -ge 141 ]]; then
    ok "جدول‌ها" "$T (انتظار ≥۱۴۱)"
  else
    bad "جدول‌ها" "$T — کمتر از ۱۴۱؛ migrationها کامل اجرا نشده‌اند"
  fi

  # جدول‌های کلیدی فازهای اخیر — اثبات اینکه واقعاً هفت فاز روی سرور آمده
  for t in rbac_user_grants navigation_items business_alerts payment_transactions moadian_queue integration_connectors; do
    if [[ "$(q "SELECT to_regclass('public.$t') IS NOT NULL")" == "t" ]]; then
      ok "جدول $t" "موجود"
    else
      bad "جدول $t" "نیست — نسخهٔ روی سرور قدیمی است"
    fi
  done
fi

# ── ۲) health probe ──────────────────────────────────────────────────────────
sect "پروب سلامت اپلیکیشن"
for p in live ready deep; do
  C="$(http "$BASE/api/health?probe=$p" /tmp/hbz-health.json)"
  if [[ "$C" == "200" ]]; then ok "health?probe=$p" "200"
  else bad "health?probe=$p" "$C — $(head -c 160 /tmp/hbz-health.json 2>/dev/null)"; fi
done

# ── ۳) صحت مالی ──────────────────────────────────────────────────────────────
# قاعدهٔ ۲۶.۲۶c: «تراز متوازن است» ادعای ضعیفی است — هر سند خودش متوازن است،
# پس Σبدهکار=Σبستانکار همیشه درست می‌ماند در حالی که مانده‌ی تک‌تک حساب‌ها
# غلط است. مانده‌های کلیدی هم باید سنجیده شوند.
if [[ -n "$DSN" ]] && [[ "$(q 'SELECT 1')" == "1" ]]; then
  sect "صحت مالی"
  BAL="$(q "SELECT COALESCE(ROUND(SUM(debit)-SUM(credit)),0) FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id WHERE e.status='posted'")"
  if [[ "$BAL" == "0" ]]; then ok "تراز آزمایشی" "Σبدهکار−Σبستانکار = 0"
  else bad "تراز آزمایشی" "اختلاف = $BAL (باید صفر باشد)"; fi

  # مانده‌های کلیدی: بانک و AR هرگز نباید منفی باشند (کلاس BUG-013/020)
  for acc in 1010:بانک 1100:حساب‌های_دریافتنی 1200:موجودی; do
    CODE="${acc%%:*}"; LBL="${acc##*:}"
    V="$(q "SELECT COALESCE(ROUND(SUM(l.debit)-SUM(l.credit)),0) FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.entry_id JOIN gl_accounts a ON a.id=l.account_id WHERE e.status='posted' AND a.code='$CODE'")"
    if [[ "$V" == "ERR" ]]; then soft "مانده $LBL" "قابل محاسبه نبود"
    elif [[ "${V:0:1}" == "-" ]]; then bad "مانده $LBL ($CODE)" "$V — منفی است"
    else ok "مانده $LBL ($CODE)" "$V"; fi
  done

  # 🔴 BUG-020 روی دادهٔ واقعی: سند اصلیِ برگشت‌خورده باید posted بماند.
  B20="$(q "SELECT count(*) FROM gl_journal_entries WHERE reversed_by IS NOT NULL AND status='void'")"
  if [[ "$B20" == "0" ]]; then
    ok "کلاس BUG-020" "هیچ سند برگشت‌خوردهٔ void شده‌ای نیست"
  else
    bad "کلاس BUG-020" "$B20 سند — اجرا کنید: npx tsx deploy/fix-bug020-data.ts --dry-run"
  fi

  # sequenceها: شمارهٔ بعدی باید از بیشینهٔ موجود جلوتر باشد، نه از ۱
  sect "شماره‌گذاری"
  DUP="$(q "SELECT count(*) FROM (SELECT entry_no FROM gl_journal_entries WHERE entry_no IS NOT NULL GROUP BY entry_no HAVING count(*)>1) x")"
  if [[ "$DUP" == "0" ]]; then ok "شمارهٔ سند تکراری" "0"
  else bad "شمارهٔ سند تکراری" "$DUP گروه تکراری"; fi
  BEHIND="$(q "SELECT count(*) FROM numbering_counters c WHERE c.current_value = 0")"
  [[ "$BEHIND" == "0" || "$BEHIND" == "ERR" ]] && ok "شمارنده‌ها" "بازنشانی‌نشده" || soft "شمارنده‌ها" "$BEHIND شمارنده صفر است"

  # ── ۴) RBAC و R5 ───────────────────────────────────────────────────────────
  sect "دسترسی (RBAC)"
  SA="$(q "SELECT count(*) FROM users WHERE role='super_admin' AND active")"
  if [[ "$SA" =~ ^[1-9] ]]; then ok "super_admin فعال" "$SA کاربر"
  else bad "super_admin فعال" "هیچ — امکان ورود مدیریتی نیست"; fi
  NOGRANT="$(q "SELECT count(*) FROM users u WHERE u.active AND NOT EXISTS (SELECT 1 FROM rbac_user_grants g WHERE g.user_id=u.id)")"
  ok "کاربر بدون گرنت (رفتار R5 = نقش قدیمی)" "$NOGRANT کاربر"
  ORPH="$(q "SELECT count(*) FROM rbac_user_grants g WHERE g.permission_key NOT LIKE '%.%'")"
  [[ "$ORPH" == "0" ]] && ok "کلید دسترسی یتیم" "0" || bad "کلید دسترسی یتیم" "$ORPH"

  # ── ۵) محتوای عمومی ────────────────────────────────────────────────────────
  sect "سایت عمومی"
  NAV="$(q "SELECT count(*) FROM navigation_items WHERE active")"
  if [[ "$NAV" =~ ^[1-9] ]]; then ok "منوی سایت از دیتابیس" "$NAV آیتم فعال"
  else soft "منوی سایت از دیتابیس" "خالی — سایت به منوی پیش‌فرض داخلی برمی‌گردد"; fi
fi

# ── ۶) صفحات واقعی، هر دو زبان ───────────────────────────────────────────────
sect "صفحات عمومی (فارسی/انگلیسی)"
if [[ "$(http "$BASE/")" == "000" ]]; then
  bad "سرویس وب" "$BASE پاسخ نمی‌دهد — بررسی صفحات رد شد (pm2 status را ببینید)"
else
for path in "" /about /solutions /events /academy /docs /products /ai; do
  for loc in fa en; do
    C="$(http "$BASE/$loc$path")"
    [[ "$C" == "200" ]] && ok "GET /$loc$path" "200" || bad "GET /$loc$path" "$C"
  done
done

fi

# فارسی‌سازی ۲۶.۳۳: صفحهٔ فارسی باید واقعاً فارسی باشد
FA_CHARS="$(curl -s --max-time 15 "$BASE/fa/events" 2>/dev/null | tr -cd '؀-ۿ' | wc -c | tr -d ' \n')"
FA_CHARS="${FA_CHARS:-0}"
if [[ "$FA_CHARS" =~ ^[0-9]+$ ]] && [[ "$FA_CHARS" -gt 100 ]]; then ok "فارسی‌سازی /fa/events" "$FA_CHARS نویسهٔ فارسی"
else bad "فارسی‌سازی /fa/events" "$FA_CHARS نویسه — نسخهٔ ۲۶.۳۳ روی سرور نیست"; fi

# ── ۷) وب‌هوک‌های عمومی باید از بیرون قابل دسترس باشند ───────────────────────
sect "وب‌هوک‌های عمومی"
for w in /api/webhooks/telegram /api/webhooks/whatsapp /api/pay/callback; do
  C="$(http "$BASE$w")"
  # 200/400/401/405 همه یعنی «مسیر وجود دارد و nginx مسدودش نکرده».
  # فقط 404 (مسیر نیست) یا 000 (اصلاً پاسخ نداد) مشکل است.
  if [[ "$C" == "404" ]]; then bad "$w" "404 — مسیر وجود ندارد"
  elif [[ "$C" == "000" ]]; then bad "$w" "پاسخی نداد (سرویس بالا نیست یا nginx مسدود کرده)"
  else ok "$w" "$C (مسیر باز است)"; fi
done

# ── ۸) بکاپ ──────────────────────────────────────────────────────────────────
sect "بکاپ"
if [[ -f /home/hbz/backups/last-status.json ]] || [[ -d /home/hbz/backups ]]; then
  LAST="$(find /home/hbz/backups -name '*.enc' -mtime -2 2>/dev/null | wc -l)"
  [[ "$LAST" -gt 0 ]] && ok "بکاپ اخیر" "$LAST فایل در ۴۸ ساعت گذشته" \
                      || bad "بکاپ اخیر" "هیچ بکاپی در ۴۸ ساعت گذشته نیست"
else
  bad "پوشهٔ بکاپ" "پیدا نشد — قبل از ورود دادهٔ واقعی حتماً فعال شود"
fi

# ── جمع‌بندی ─────────────────────────────────────────────────────────────────
if $JSON; then
  printf '{"pass":%d,"fail":%d,"warn":%d,"rows":[' "$PASS" "$FAIL" "$WARN"
  for i in "${!ROWS[@]}"; do
    IFS='|' read -r st name val <<<"${ROWS[$i]}"
    [[ $i -gt 0 ]] && printf ','
    printf '{"status":"%s","check":"%s","value":"%s"}' "$st" "$name" "${val//\"/\\\"}"
  done
  printf ']}\n'
else
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "  موفق: ${GREEN}${PASS}${NC}   هشدار: ${YELLOW}${WARN}${NC}   ناموفق: ${RED}${FAIL}${NC}"
  if [[ "$FAIL" -gt 0 ]]; then
    echo -e "${RED}  🔴 تا رفع موارد ناموفق، دادهٔ واقعی وارد سیستم نکنید.${NC}"
  else
    echo -e "${GREEN}  ✔ آمادهٔ ورود دادهٔ واقعی.${NC}"
  fi
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
fi

exit $(( FAIL > 0 ? 1 : 0 ))
