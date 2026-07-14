#!/usr/bin/env bash
# =============================================================================
# HBZ — Blue-Green Deploy (Phase 26.24 بند ۵.۵)
# =============================================================================
# Two PM2 apps on paired ports (blue=3000, green=3001). Build the idle colour,
# health-gate it, flip nginx upstream, then stop the old colour. One-line
# rollback flips back. Zero-downtime with a real readiness gate (not just reload).
#
#   sudo bash deploy/deploy-blue-green.sh          # deploy to the idle colour
#   sudo bash deploy/deploy-blue-green.sh --rollback
# =============================================================================
set -euo pipefail
APP_USER="hbz"; APP_DIR="/var/www/habibazar"
BLUE_PORT=3000; GREEN_PORT=3001
UPSTREAM_CONF="/etc/nginx/conf.d/hbz-upstream.conf"
STATE_FILE="/var/www/habibazar/.active-colour"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
info(){ echo -e "${GREEN}[✔]${NC} $*"; }; step(){ echo -e "${CYAN}[→]${NC} $*"; }
warn(){ echo -e "${YELLOW}[!]${NC} $*"; }; fail(){ echo -e "${RED}[✘]${NC} $*"; exit 1; }
[[ $EUID -ne 0 ]] && fail "run with sudo"

ACTIVE=$(cat "$STATE_FILE" 2>/dev/null || echo blue)

set_upstream(){ # $1 = colour
  local port=$([[ "$1" == blue ]] && echo $BLUE_PORT || echo $GREEN_PORT)
  echo "upstream hbz_app { server 127.0.0.1:${port}; }" > "$UPSTREAM_CONF"
  nginx -t >/dev/null 2>&1 && systemctl reload nginx
}

if [[ "${1:-}" == "--rollback" ]]; then
  OTHER=$([[ "$ACTIVE" == blue ]] && echo green || echo blue)
  step "rolling back $ACTIVE → $OTHER"
  set_upstream "$OTHER"; echo "$OTHER" > "$STATE_FILE"; info "rolled back to $OTHER"; exit 0
fi

TARGET=$([[ "$ACTIVE" == blue ]] && echo green || echo blue)
TARGET_PORT=$([[ "$TARGET" == blue ]] && echo $BLUE_PORT || echo $GREEN_PORT)
step "active=$ACTIVE → deploying to idle colour: $TARGET (port $TARGET_PORT)"

# 1) Build (shared code dir; the two colours run the same build on diff ports).
step "building"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm run build" || fail "build failed — active colour untouched"

# 2) Start/restart the target colour on its port.
step "starting $TARGET on :$TARGET_PORT"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && PORT=$TARGET_PORT pm2 startOrReload pm2.config.js --only hbz-$TARGET --update-env" \
  || sudo -u "$APP_USER" bash -c "cd $APP_DIR && PORT=$TARGET_PORT pm2 start npm --name hbz-$TARGET -- start"

# 3) Health gate — do NOT flip until the target is ready.
step "health-gating :$TARGET_PORT/api/health?probe=ready"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$TARGET_PORT/api/health?probe=ready" || echo 000)
  [[ "$code" == "200" ]] && { info "target healthy after ${i}s"; break; }
  [[ "$i" == 30 ]] && fail "target never became healthy — NOT flipping (active colour still serving)"
  sleep 1
done

# 4) Flip nginx upstream + record state, then stop the old colour.
step "flipping nginx upstream → $TARGET"
set_upstream "$TARGET"; echo "$TARGET" > "$STATE_FILE"
sudo -u "$APP_USER" pm2 stop "hbz-$ACTIVE" 2>/dev/null || true
info "════════════════════════════════════════"
info "DEPLOYED · active colour = $TARGET (:$TARGET_PORT)"
info "rollback: sudo bash deploy/deploy-blue-green.sh --rollback"
info "════════════════════════════════════════"
