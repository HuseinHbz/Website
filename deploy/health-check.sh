#!/usr/bin/env bash
# =============================================================================
# HBZ Website — بررسی سلامت سرویس
# =============================================================================
# استفاده:
#   bash deploy/health-check.sh                        # localhost
#   bash deploy/health-check.sh https://habibazar.ir   # سرور تولید
#
# cron — هر ۵ دقیقه:
#   */5 * * * * root bash /var/www/habibazar/deploy/health-check.sh >> /var/log/hbz-health.log 2>&1
# =============================================================================

BASE_URL="${1:-http://localhost:3000}"
TIMEOUT=10

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

# HEALTH_CHECK_TOKEN (if set in the environment) unlocks the verbose fields
# (version/env/per-check detail/memory) — the endpoint now fails CLOSED to
# anonymous callers by default so an internet-facing deploy doesn't leak
# internal telemetry; this operator-run script still gets full detail when
# the token is configured, matching /api/health's own X-Health-Token gate.
TOKEN_HEADER=()
[[ -n "${HEALTH_CHECK_TOKEN:-}" ]] && TOKEN_HEADER=(-H "X-Health-Token: $HEALTH_CHECK_TOKEN")

response=$(curl -sf --max-time "$TIMEOUT" "${TOKEN_HEADER[@]}" "$BASE_URL/api/health" 2>/dev/null) || {
  echo -e "${RED}[FAIL]${NC} $(date '+%Y-%m-%d %H:%M:%S') — سرویس پاسخ نمی‌دهد: $BASE_URL"
  # اگر PM2 نصب است restart اتوماتیک
  if command -v pm2 &>/dev/null && pm2 list | grep -q habibazar; then
    echo "  → تلاش برای restart سرویس..."
    pm2 restart habibazar 2>/dev/null || true
  fi
  exit 1
}

status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [[ "$status" == "ok" ]]; then
  echo -e "${GREEN}[OK]${NC} $(date '+%Y-%m-%d %H:%M:%S') — $BASE_URL | $response"
else
  echo -e "${RED}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') — وضعیت غیرعادی: $response"
  exit 1
fi
