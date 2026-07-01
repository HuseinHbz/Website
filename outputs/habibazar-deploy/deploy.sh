#!/usr/bin/env bash
# ============================================================
# Habibazar Platform — First Deploy Script
# Ubuntu 24.04 LTS | Node 22 | PM2 | Nginx
#
# For updates after first deploy use: update.sh
#
# Usage:
#   chmod +x deploy.sh && ./deploy.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
info() { echo -e "${BLUE}▸${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }
hr()   { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

# ── Config ───────────────────────────────────────────────────
REPO_URL="https://github.com/HuseinHbz/Website.git"
BRANCH="${1:-${DEPLOY_BRANCH:-feature/v2-enterprise-upgrade}}"
BASE="/var/www/habibazar"
REPO="$BASE/repo"
WEB="$BASE/web"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

hr
echo -e "${BOLD}  Habibazar Platform — First Deployment${NC}"
echo -e "  Branch: ${YELLOW}$BRANCH${NC}"
hr

# ── Preflight ────────────────────────────────────────────────
info "Checking prerequisites..."
command -v node  >/dev/null || err "node not found. Install: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs"
command -v npm   >/dev/null || err "npm not found"
command -v pm2   >/dev/null || err "pm2 not found. Install: sudo npm install -g pm2"
command -v nginx >/dev/null || err "nginx not found. Install: sudo apt install -y nginx"
command -v git   >/dev/null || err "git not found. Install: sudo apt install -y git"

node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" || err "Node 18+ required. Current: $(node --version)"
ok "Node $(node --version) / npm $(npm --version)"

# ── Directories ──────────────────────────────────────────────
hr; info "Creating directories..."
sudo mkdir -p "$REPO" "$BASE" /var/log/pm2 /var/www/certbot/.well-known/acme-challenge
sudo chown -R "$(whoami):$(whoami)" "$BASE" /var/log/pm2
ok "Directories ready"

# ── Clone / Pull ─────────────────────────────────────────────
hr; info "Fetching code ($BRANCH)..."
if [[ -d "$REPO/.git" ]]; then
    git -C "$REPO" fetch origin "$BRANCH"
    git -C "$REPO" checkout "$BRANCH"
    git -C "$REPO" reset --hard "origin/$BRANCH"
    ok "Pulled latest ($(git -C "$REPO" log -1 --format='%h %s'))"
else
    git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO"
    ok "Cloned repository"
fi

# Symlink web
[[ -L "$WEB" ]] && rm "$WEB"
[[ -d "$WEB" ]] && rm -rf "$WEB"
ln -sf "$REPO/outputs/habibazar-web" "$WEB"
ok "Linked: web → $REPO/outputs/habibazar-web"

# Copy update.sh to base for easy access
cp "$REPO/outputs/habibazar-deploy/update.sh" "$BASE/update.sh"
chmod +x "$BASE/update.sh"
ok "update.sh → $BASE/update.sh"

# ── Copy .env if provided ────────────────────────────────────
if [[ -f "$DEPLOY_DIR/web.env.local" && ! -f "$WEB/.env.local" ]]; then
    cp "$DEPLOY_DIR/web.env.local" "$WEB/.env.local"
    chmod 600 "$WEB/.env.local"
    ok "Copied web.env.local"
fi

[[ -f "$WEB/.env.local" ]] || warn ".env.local not found at $WEB/.env.local — create it with ADMIN_JWT_SECRET"

# ── Data directory ───────────────────────────────────────────
mkdir -p "$WEB/data"
ok "Data directory ready"

# ── Build Web ────────────────────────────────────────────────
hr; info "Installing dependencies & building..."
cd "$WEB"
rm -rf .next
npm ci --omit=dev
npm run build
ok "Build complete"

# ── Nginx ────────────────────────────────────────────────────
hr; info "Configuring Nginx..."
NGINX_CONF="$REPO/outputs/habibazar-deploy/nginx.conf"
if [[ -f "$NGINX_CONF" ]]; then
    sudo cp "$NGINX_CONF" /etc/nginx/conf.d/habibazar.conf
    sudo rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
    ok "Nginx config installed"
else
    warn "nginx.conf not found — skipping"
fi

# Self-signed placeholder certs (replaced by Certbot later)
for domain in habibazar.ir www.habibazar.ir; do
    certdir="/etc/letsencrypt/live/$domain"
    if [[ ! -f "$certdir/fullchain.pem" ]]; then
        sudo mkdir -p "$certdir"
        sudo openssl req -x509 -nodes -newkey rsa:2048 \
            -keyout "$certdir/privkey.pem" \
            -out    "$certdir/fullchain.pem" \
            -days 1 -subj "/CN=$domain" 2>/dev/null
        warn "Self-signed cert created for $domain — replace with Certbot"
    fi
done

sudo nginx -t && sudo systemctl reload nginx || warn "Nginx reload failed — check config"
ok "Nginx ready"

# ── PM2 ──────────────────────────────────────────────────────
hr; info "Starting PM2..."
ECOSYSTEM="$REPO/outputs/habibazar-deploy/ecosystem.config.js"
cp "$ECOSYSTEM" "$BASE/ecosystem.config.js"

cd "$BASE"
pm2 delete habibazar-web 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

PM2_STARTUP=$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>&1 | grep 'sudo' || true)
if [[ -n "$PM2_STARTUP" ]]; then
    eval "sudo $PM2_STARTUP" 2>/dev/null || warn "PM2 autostart: run manually: $PM2_STARTUP"
fi
ok "PM2 started"

# ── Health Check ─────────────────────────────────────────────
hr; info "Waiting 10s for app to start..."
sleep 10

code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "http://127.0.0.1:3000/" 2>/dev/null || echo "000")
if [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]]; then
    ok "Web → HTTP $code"
else
    warn "Web → HTTP $code (may still be starting — check: pm2 logs habibazar-web)"
fi

# ── Seed Cisco Blog (first deploy only) ──────────────────────
hr; info "Seeding Cisco blog content (first deploy)..."
SEED_SCRIPT="$REPO/outputs/habibazar-deploy/seed-cisco-blog.js"
DB_PATH="$WEB/data/habibazar.db"
# Wait a bit more for the app to create the DB on first request
sleep 5
if [[ -f "$SEED_SCRIPT" && -f "$DB_PATH" ]]; then
    node "$SEED_SCRIPT" "$DB_PATH" && ok "Cisco blog seeded" || warn "Seed failed — run manually after app starts: node $SEED_SCRIPT"
else
    warn "DB not ready yet — run manually once app is up: node $SEED_SCRIPT"
    warn "  (App creates DB on first request — visit the site once, then run the seed)"
fi

# ── Done ─────────────────────────────────────────────────────
hr
echo ""
echo -e "${BOLD}${GREEN}  Deployment complete!${NC}"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. Set a strong JWT secret (if not done):"
echo -e "     ${YELLOW}echo \"ADMIN_JWT_SECRET=\$(openssl rand -hex 64)\" >> $WEB/.env.local${NC}"
echo -e "     ${YELLOW}echo 'NEXT_PUBLIC_SITE_URL=https://habibazar.ir' >> $WEB/.env.local${NC}"
echo -e "     ${YELLOW}pm2 restart habibazar-web${NC}"
echo ""
echo -e "  2. Issue SSL certificate:"
echo -e "     ${YELLOW}sudo certbot --nginx -d habibazar.ir -d www.habibazar.ir --email hosseinhabibazar@gmail.com${NC}"
echo ""
echo -e "  3. For future updates use:"
echo -e "     ${YELLOW}$BASE/update.sh${NC}"
echo ""
echo -e "  4. Check logs:"
echo -e "     ${YELLOW}pm2 logs habibazar-web --lines 50${NC}"
hr
