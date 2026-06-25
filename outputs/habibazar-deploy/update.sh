#!/usr/bin/env bash
# ============================================================
# Habibazar Platform — Zero-Downtime Update Script
#
# Usage:
#   ./update.sh          # update all 3 apps
#   ./update.sh api      # update only API
#   ./update.sh web      # update only Web
#   ./update.sh admin    # update only Admin
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
info() { echo -e "${BLUE}▸${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }
hr()   { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

BASE="/var/www/habibazar"
REPO="$BASE/repo"
BRANCH="${DEPLOY_BRANCH:-main}"
TARGET="${1:-all}"

hr
echo -e "${BOLD}  Habibazar — Update${NC}  [target: ${YELLOW}$TARGET${NC}]"
hr

# ── Pull latest code ─────────────────────────────────────────
info "Pulling latest from origin/$BRANCH..."
git -C "$REPO" fetch origin "$BRANCH"
git -C "$REPO" checkout "$BRANCH"
git -C "$REPO" reset --hard "origin/$BRANCH"
ok "Code updated ($(git -C "$REPO" rev-parse --short HEAD))"

# ── Update API ────────────────────────────────────────────────
update_api() {
    hr; info "Updating API..."
    cd "$BASE/api"
    npm ci
    npx prisma generate
    # Only run migrate deploy if there are pending migrations
    if [[ -d prisma/migrations ]] && npx prisma migrate status 2>&1 | grep -q "Following migrations have not yet been applied"; then
        info "Applying pending migrations..."
        npx prisma migrate deploy
        ok "Migrations applied"
    fi
    npm run build
    pm2 reload habibazar-api --update-env
    sleep 3
    curl -sf http://127.0.0.1:4000/health >/dev/null && ok "API healthy" || warn "API health check failed"
}

# ── Update Web ────────────────────────────────────────────────
update_web() {
    hr; info "Updating Web..."
    cd "$BASE/web"
    npm ci --omit=dev
    npm run build
    pm2 restart habibazar-web --update-env
    sleep 3
    curl -sf http://127.0.0.1:3000/ >/dev/null && ok "Web healthy" || warn "Web health check failed"
}

# ── Update Admin ──────────────────────────────────────────────
update_admin() {
    hr; info "Updating Admin..."
    cd "$BASE/admin"
    npm ci --omit=dev
    npm run build
    pm2 restart habibazar-admin --update-env
    sleep 3
    curl -sf http://127.0.0.1:3001/ >/dev/null && ok "Admin healthy" || warn "Admin health check failed"
}

# ── Dispatch ──────────────────────────────────────────────────
case "$TARGET" in
    api)   update_api ;;
    web)   update_web ;;
    admin) update_admin ;;
    all)   update_api; update_web; update_admin ;;
    *)     err "Unknown target: $TARGET (use api|web|admin|all)" ;;
esac

# ── Nginx config update ───────────────────────────────────────
NGINX_SRC="$REPO/outputs/habibazar-deploy/nginx.conf"
NGINX_DST="/etc/nginx/conf.d/habibazar.conf"
if [[ -f "$NGINX_SRC" ]] && ! diff -q "$NGINX_SRC" "$NGINX_DST" &>/dev/null; then
    info "nginx.conf changed — reloading Nginx..."
    sudo cp "$NGINX_SRC" "$NGINX_DST"
    sudo nginx -t && sudo systemctl reload nginx && ok "Nginx reloaded"
fi

# ── ecosystem.config.js update ───────────────────────────────
ECO_SRC="$REPO/outputs/habibazar-deploy/ecosystem.config.js"
ECO_DST="$BASE/ecosystem.config.js"
if [[ -f "$ECO_SRC" ]] && ! diff -q "$ECO_SRC" "$ECO_DST" &>/dev/null; then
    info "ecosystem.config.js changed — copying..."
    cp "$ECO_SRC" "$ECO_DST"
    ok "ecosystem.config.js updated (run 'pm2 start $ECO_DST --env production' if new apps added)"
fi

pm2 save

hr
echo -e "${BOLD}${GREEN}  Update complete!${NC}"
pm2 list
hr
