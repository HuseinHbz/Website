#!/usr/bin/env bash
# ============================================================
# Habibazar Platform — Update Script
# Pulls latest code, rebuilds, reloads. DB migrations run
# automatically on next app boot (idempotent).
# Seed scripts are NOT run here — only on first deploy.
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
info() { echo -e "${BLUE}▸${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }
hr()   { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

BRANCH="${1:-${DEPLOY_BRANCH:-feature/v2-enterprise-upgrade}}"
REPO="/var/www/habibazar/repo"
WEB="/var/www/habibazar/web"
BASE="/var/www/habibazar"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

hr
echo -e "${BOLD}  Habibazar — Update  [${TIMESTAMP}]${NC}"
echo -e "  Branch: ${YELLOW}$BRANCH${NC}"
hr

[[ -d "$REPO/.git" ]] || err "Repo not found at $REPO — run deploy.sh first"

# ── Backup current .next (quick rollback) ────────────────────
PREV_BUILD="$BASE/.next_prev"
if [[ -d "$WEB/.next" ]]; then
    info "Snapshotting current build for rollback..."
    rm -rf "$PREV_BUILD"
    cp -r "$WEB/.next" "$PREV_BUILD"
    ok "Snapshot saved → $PREV_BUILD"
fi

# ── Pull ─────────────────────────────────────────────────────
info "Pulling latest code from origin/$BRANCH..."
git -C "$REPO" fetch origin "$BRANCH"
PREV_COMMIT=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" reset --hard "origin/$BRANCH"
NEW_COMMIT=$(git -C "$REPO" rev-parse HEAD)
ok "Code updated: ${PREV_COMMIT:0:7} → ${NEW_COMMIT:0:7}"
git -C "$REPO" log -1 --format="  %s" --color=always

# ── Dependencies ─────────────────────────────────────────────
hr; info "Syncing dependencies..."
cd "$WEB"
npm ci --omit=dev
ok "Dependencies ready"

# ── Build ────────────────────────────────────────────────────
info "Building Next.js..."
rm -rf .next
if npm run build; then
    ok "Build complete"
else
    err_msg="Build FAILED"
    # Attempt rollback
    if [[ -d "$PREV_BUILD" ]]; then
        warn "$err_msg — rolling back to previous build..."
        rm -rf .next
        cp -r "$PREV_BUILD" .next
        pm2 reload habibazar-web --update-env 2>/dev/null || true
        warn "Rolled back. Fix the build error and try again."
    else
        warn "$err_msg — no previous build to roll back to."
    fi
    err "$err_msg"
fi

# ── Reload PM2 ──────────────────────────────────────────────
hr; info "Reloading PM2 (zero-downtime)..."
pm2 reload habibazar-web --update-env
pm2 save
ok "PM2 reloaded"

# ── Health Check ─────────────────────────────────────────────
info "Waiting 8s for app to warm up..."
sleep 8
for i in 1 2 3; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://127.0.0.1:3000/" 2>/dev/null || echo "000")
    if [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]]; then
        ok "Health check → HTTP $code ✓"
        break
    else
        warn "Attempt $i/3 → HTTP $code"
        [[ $i -lt 3 ]] && sleep 5
    fi
done
if [[ "$code" != "200" && "$code" != "307" && "$code" != "308" ]]; then
    warn "App may not be healthy — check: pm2 logs habibazar-web --lines 50"
fi

# ── Cleanup ──────────────────────────────────────────────────
rm -rf "$PREV_BUILD"

# ── Done ─────────────────────────────────────────────────────
hr
echo -e "${BOLD}${GREEN}  Update complete!${NC}"
echo ""
echo -e "  Commit: ${YELLOW}$(git -C "$REPO" log -1 --format='%h — %s')${NC}"
echo -e "  Logs:   ${YELLOW}pm2 logs habibazar-web --lines 50${NC}"
echo -e "  Status: ${YELLOW}pm2 status${NC}"
hr
