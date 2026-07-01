#!/usr/bin/env bash
# HBZ Platform Health Monitor
# Usage: ./health-check.sh [--url https://habibazar.ir] [--alert-email admin@example.com]
set -euo pipefail

BASE_URL="${1:-${APP_URL:-http://localhost:3000}}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
MAX_RESPONSE_MS="${MAX_RESPONSE_MS:-3000}"
HEALTH_ENDPOINT="$BASE_URL/api/health"

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
ok()   { log "✓ $*"; }
warn() { log "⚠ $*"; }
fail() { log "✕ $*"; FAILED=true; }

FAILED=false

# ── HTTP Health check ─────────────────────────────────────────────────────────
log "Checking health endpoint: $HEALTH_ENDPOINT"
RESPONSE=$(curl -s -o /tmp/hbz_health.json -w "%{http_code} %{time_total}" \
  --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "000 0")

HTTP_CODE=$(echo "$RESPONSE" | awk '{print $1}')
TIME_S=$(echo "$RESPONSE" | awk '{print $2}')
TIME_MS=$(echo "$TIME_S * 1000" | bc | cut -d. -f1)

if [[ "$HTTP_CODE" == "200" ]]; then
  ok "Health endpoint: HTTP $HTTP_CODE in ${TIME_MS}ms"
  STATUS=$(cat /tmp/hbz_health.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
  ok "App status: $STATUS"
else
  fail "Health endpoint returned HTTP $HTTP_CODE (expected 200)"
fi

# Warn on slow response
if [[ "$TIME_MS" -gt "$MAX_RESPONSE_MS" ]]; then
  warn "Slow response: ${TIME_MS}ms (threshold: ${MAX_RESPONSE_MS}ms)"
fi

# ── PM2 process check ─────────────────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
procs = json.load(sys.stdin)
hbz = [p for p in procs if 'habibazar' in p.get('name','')]
if not hbz:
    print('NOT_FOUND')
else:
    statuses = [p['pm2_env']['status'] for p in hbz]
    print(','.join(statuses))
" 2>/dev/null || echo "ERROR")

  if echo "$PM2_STATUS" | grep -q "online"; then
    ok "PM2 process: $PM2_STATUS"
  else
    fail "PM2 process status: $PM2_STATUS"
  fi
fi

# ── Disk space check ──────────────────────────────────────────────────────────
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [[ "$DISK_USAGE" -gt 90 ]]; then
  fail "Disk usage critical: ${DISK_USAGE}%"
elif [[ "$DISK_USAGE" -gt 80 ]]; then
  warn "Disk usage high: ${DISK_USAGE}%"
else
  ok "Disk usage: ${DISK_USAGE}%"
fi

# ── Result ────────────────────────────────────────────────────────────────────
echo ""
if [[ "$FAILED" == "true" ]]; then
  log "HEALTH CHECK FAILED"
  if [[ -n "$ALERT_EMAIL" ]] && command -v mail &>/dev/null; then
    echo "HBZ health check failed at $(date). Check the server." | mail -s "HBZ Alert: Health Check Failed" "$ALERT_EMAIL"
  fi
  exit 1
else
  log "All checks passed"
  exit 0
fi
