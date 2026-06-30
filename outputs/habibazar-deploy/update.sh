#!/usr/bin/env bash
# ============================================================
# Habibazar Platform — Update Script
# Pulls latest code and rebuilds without touching config/DB
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
info() { echo -e "${BLUE}▸${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }
hr()   { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

BRANCH="${DEPLOY_BRANCH:-hbz}"
REPO="/var/www/habibazar/repo"
WEB="/var/www/habibazar/web"

hr
echo -e "${BOLD}  Habibazar — Update${NC}"
echo -e "  Branch: ${YELLOW}$BRANCH${NC}"
hr

[[ -d "$REPO/.git" ]] || err "Repo not found at $REPO — run deploy.sh first"

# ── Pull ─────────────────────────────────────────────────────
info "Pulling latest code..."
git -C "$REPO" fetch origin "$BRANCH"
git -C "$REPO" reset --hard "origin/$BRANCH"
ok "Code updated"

# ── Build ────────────────────────────────────────────────────
hr; info "Building..."
cd "$WEB"
rm -rf .next
npm ci --omit=dev
npm run build
ok "Build complete"

# ── Seed DB ─────────────────────────────────────────────────
hr; info "Seeding database content..."
SEED_SCRIPT="$REPO/outputs/habibazar-deploy/seed-cisco-blog.js"
DB_PATH="$WEB/data/habibazar.db"
if [[ -f "$SEED_SCRIPT" && -f "$DB_PATH" ]]; then
    node "$SEED_SCRIPT" "$DB_PATH" && ok "Database seeded" || warn "Seed script failed — check manually"
else
    warn "Seed script or DB not found — skipping"
fi

# ── Reload ──────────────────────────────────────────────────
hr; info "Reloading PM2..."
pm2 reload habibazar-web --update-env
pm2 save
ok "Reloaded"

# ── Health ──────────────────────────────────────────────────
sleep 5
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3000/" 2>/dev/null || echo "000")
if [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]]; then
    ok "Web → HTTP $code ✓"
else
    warn "Web → HTTP $code — check: pm2 logs habibazar-web"
fi
hr
