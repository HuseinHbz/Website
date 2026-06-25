#!/usr/bin/env bash
# ============================================================
# Habibazar Platform — First-Time Deployment Script
# Ubuntu 24.04 LTS | Node 22 | PostgreSQL 16 | PM2
#
# Usage (run as deploy user or root):
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================================
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
info() { echo -e "${BLUE}▸${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }
hr()   { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

# ── Config ───────────────────────────────────────────────────
REPO_URL="https://github.com/HuseinHbz/Website.git"
BRANCH="${DEPLOY_BRANCH:-claude/habibazar-production-master-p3dm3l}"
BASE="/var/www/habibazar"
REPO="$BASE/repo"
API="$BASE/api"
WEB="$BASE/web"
ADMIN="$BASE/admin"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

hr
echo -e "${BOLD}  Habibazar Platform — Deployment${NC}"
echo -e "  Branch: ${YELLOW}$BRANCH${NC}"
hr

# ── Preflight ─────────────────────────────────────────────────
info "Checking prerequisites..."
command -v node  >/dev/null || err "node not found. Run: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs"
command -v npm   >/dev/null || err "npm not found"
command -v pm2   >/dev/null || err "pm2 not found. Run: sudo npm install -g pm2"
command -v psql  >/dev/null || err "psql not found. Run: sudo apt install -y postgresql-client"
command -v nginx >/dev/null || err "nginx not found. Run: sudo apt install -y nginx"

NODE_VER=$(node -e "process.exit(parseInt(process.version.slice(1)) < 20 ? 1 : 0)" 2>/dev/null) || err "Node 20+ required. Current: $(node --version)"
ok "Node $(node --version)"

# ── .env check ───────────────────────────────────────────────
[[ -f "$API/.env" ]] || err "API .env not found at $API/.env — create it first (see DEPLOYMENT.md §6.1)"
[[ -f "$WEB/.env.local" ]] || warn "Web .env.local not found — using defaults"
[[ -f "$ADMIN/.env.local" ]] || warn "Admin .env.local not found — using defaults"

# ── Step 1: Base directories only (not app dirs — those become symlinks) ────
hr; info "Creating directory structure..."
sudo mkdir -p "$BASE"/repo /var/log/pm2 /var/www/certbot/.well-known/acme-challenge
sudo chown -R "$(whoami):$(whoami)" "$BASE" /var/log/pm2
ok "Directories ready"

# ── Step 2: Clone / pull repo ────────────────────────────────
hr; info "Fetching code from $REPO_URL ($BRANCH)..."
if [[ -d "$REPO/.git" ]]; then
    git -C "$REPO" fetch origin "$BRANCH"
    git -C "$REPO" checkout "$BRANCH"
    git -C "$REPO" reset --hard "origin/$BRANCH"
    ok "Pulled latest code"
else
    git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO"
    ok "Cloned repository"
fi

# Link app directories — remove stale real dirs first, then symlink
for pair in "web:$REPO/outputs/habibazar-web" "admin:$REPO/outputs/habibazar-admin" "api:$REPO/outputs/habibazar-api"; do
    name="${pair%%:*}"; target="${pair##*:}"
    dest="$BASE/$name"
    if [[ -L "$dest" ]]; then
        [[ "$(readlink "$dest")" == "$target" ]] && continue
        rm "$dest"
    elif [[ -d "$dest" ]]; then
        rm -rf "$dest"
    fi
    ln -sf "$target" "$dest"
    ok "Linked $name -> $target"
done

# Copy .env files if they were created alongside the script
for f in api.env web.env.local admin.env.local; do
    src="$DEPLOY_DIR/$f"
    case "$f" in
        api.env)         dst="$API/.env" ;;
        web.env.local)   dst="$WEB/.env.local" ;;
        admin.env.local) dst="$ADMIN/.env.local" ;;
    esac
    [[ -f "$src" && ! -f "$dst" ]] && { cp "$src" "$dst"; chmod 600 "$dst"; ok "Copied $f → $dst"; }
done

# ── Step 3: PostgreSQL setup ─────────────────────────────────
hr; info "Setting up PostgreSQL..."
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='habibazar'" | grep -q 1 2>/dev/null; then
    warn "PostgreSQL role 'habibazar' not found — run these manually as root:"
    echo ""
    echo "  sudo -u postgres psql <<'SQL'"
    echo "  CREATE ROLE habibazar WITH LOGIN PASSWORD 'YOUR_STRONG_PASSWORD';"
    echo "  CREATE DATABASE habibazar OWNER habibazar;"
    echo "  GRANT ALL PRIVILEGES ON DATABASE habibazar TO habibazar;"
    echo "  SQL"
    echo ""
    echo "  sudo -u postgres psql -d habibazar -c \"CREATE EXTENSION IF NOT EXISTS vector;\""
    echo ""
    read -rp "Press ENTER after creating the DB role, or Ctrl+C to abort: "
else
    ok "PostgreSQL role exists"
    # Ensure pgvector extension exists
    sudo -u postgres psql -d habibazar -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
    ok "pgvector extension ready"
fi

# ── Step 4: API — install → generate → push → build ─────────
hr; info "Building API..."
cd "$API"
npm ci                       # includes devDeps (prisma CLI, typescript)
npx prisma generate
npx prisma db push --accept-data-loss
npm run db:hardening         # loads .env via --env-file automatically
npm run build
ok "API built (dist/server.js)"

# ── Step 5: Create superadmin role (if not present) ──────────
info "Ensuring superadmin role exists..."
source <(grep -v '^#' "$API/.env" | grep '^DATABASE_URL=' | head -1)
ROLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM roles WHERE name='superadmin'" 2>/dev/null || echo "0")
if [[ "$ROLE_EXISTS" == "0" ]]; then
    psql "$DATABASE_URL" <<'SQL'
INSERT INTO roles (id, name, permissions, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(), 'superadmin',
    ARRAY['lead:read','lead:write','lead:delete',
          'consultation:read','consultation:write',
          'engagement:read','engagement:write',
          'content:read','content:write','content:delete',
          'testimonial:approve','cert:verify','consent:write',
          'user:read','user:write','role:read','role:write',
          'settings:read','settings:write','audit:read',
          'ai:read','ai:write'],
    NOW(), NOW()
) ON CONFLICT (name) DO NOTHING;
SQL
    ok "superadmin role created"
else
    ok "superadmin role already exists"
fi

# ── Step 6: Web — install + build ────────────────────────────
hr; info "Building Web..."
cd "$WEB"
npm ci --omit=dev
npm run build
ok "Web built (.next/)"

# ── Step 7: Admin — install + build ──────────────────────────
hr; info "Building Admin..."
cd "$ADMIN"
npm ci --omit=dev
npm run build
ok "Admin built (.next/)"

# ── Step 8: Nginx ─────────────────────────────────────────────
hr; info "Configuring Nginx..."
NGINX_CONF="$REPO/outputs/habibazar-deploy/nginx.conf"
if [[ -f "$NGINX_CONF" ]]; then
    sudo cp "$NGINX_CONF" /etc/nginx/conf.d/habibazar.conf
    sudo rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
    ok "Nginx config installed"
else
    warn "nginx.conf not found at $NGINX_CONF — skipping"
fi

# Placeholder certs if Let's Encrypt hasn't run yet
for domain in habibazar.ir admin.habibazar.ir api.habibazar.ir; do
    certdir="/etc/letsencrypt/live/$domain"
    if [[ ! -f "$certdir/fullchain.pem" ]]; then
        sudo mkdir -p "$certdir"
        sudo openssl req -x509 -nodes -newkey rsa:2048 \
            -keyout "$certdir/privkey.pem" \
            -out    "$certdir/fullchain.pem" \
            -days 1 -subj "/CN=$domain" 2>/dev/null
        warn "Self-signed placeholder cert created for $domain — replace with Certbot"
    fi
done

sudo nginx -t && sudo systemctl reload nginx || warn "Nginx reload failed — check config"
ok "Nginx ready"

# ── Step 9: PM2 ──────────────────────────────────────────────
hr; info "Starting PM2 apps..."
ECOSYSTEM="$REPO/outputs/habibazar-deploy/ecosystem.config.js"
sudo cp "$ECOSYSTEM" "$BASE/ecosystem.config.js"

cd "$BASE"
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# Autostart on boot
PM2_STARTUP=$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>&1 | grep 'sudo')
if [[ -n "$PM2_STARTUP" ]]; then
    eval "sudo $PM2_STARTUP" 2>/dev/null || warn "Could not set PM2 autostart automatically. Run: $PM2_STARTUP"
fi
ok "PM2 started"

# ── Step 10: Health checks ───────────────────────────────────
hr; info "Waiting for services to start (10s)..."
sleep 10

FAILED=0
check_health() {
    local url=$1 label=$2
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" ]]; then
        ok "$label → HTTP $code"
    else
        warn "$label → HTTP $code (may still be starting)"
        FAILED=1
    fi
}

check_health "http://127.0.0.1:4000/health"  "API /health"
check_health "http://127.0.0.1:4000/ready"   "API /ready"
check_health "http://127.0.0.1:3000/"        "Web"
check_health "http://127.0.0.1:3001/"        "Admin"

# ── Done ─────────────────────────────────────────────────────
hr
echo ""
echo -e "${BOLD}${GREEN}  Deployment complete!${NC}"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo -e "  1. Issue SSL certificates:"
echo -e "     ${YELLOW}sudo certbot --nginx -d habibazar.ir -d www.habibazar.ir --email hosseinhabibazar@gmail.com${NC}"
echo -e "     ${YELLOW}sudo certbot --nginx -d admin.habibazar.ir --email hosseinhabibazar@gmail.com${NC}"
echo -e "     ${YELLOW}sudo certbot --nginx -d api.habibazar.ir --email hosseinhabibazar@gmail.com${NC}"
echo ""
echo -e "  2. Create first admin user (API must be running):"
echo -e "     ${YELLOW}curl -X POST http://127.0.0.1:4000/api/v1/auth/register \\${NC}"
echo -e "       ${YELLOW}-H 'Content-Type: application/json' \\${NC}"
echo -e "       ${YELLOW}-d '{\"email\":\"hosseinhabibazar@live.com\",\"password\":\"CHANGE_ME\",\"name\":\"Admin\",\"roleId\":\"\$(psql \$DATABASE_URL -tAc \"SELECT id FROM roles WHERE name='"'"'superadmin'"'"'\")\"}'${NC}"
echo ""
echo -e "  3. Switch Cloudflare SSL to Full (strict)"
echo ""
if [[ "$FAILED" == "1" ]]; then
    warn "Some health checks failed — run: ${YELLOW}pm2 logs --lines 50${NC}"
fi
hr
