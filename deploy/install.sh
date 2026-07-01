#!/usr/bin/env bash
# =============================================================================
# HBZ Website — نصب اولیه روی سرور تازه (Ubuntu 22.04)
# =============================================================================
# استفاده:
#   sudo bash deploy/install.sh                  # branch پیش‌فرض
#   sudo bash deploy/install.sh main             # branch خاص
# =============================================================================
set -euo pipefail

# ─── تنظیمات ─────────────────────────────────────────────────────────────────
APP_USER="hbz"
APP_DIR="/var/www/habibazar"
REPO_URL="https://github.com/HuseinHbz/Website.git"
BRANCH="${1:-feature/v2-enterprise-upgrade}"
APP_PORT="3000"
NODE_VERSION="20"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✔]${NC} $*"; }
step()  { echo -e "${CYAN}[→]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✘]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "با sudo اجرا کنید: sudo bash deploy/install.sh"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  HBZ Website — نصب اولیه  (branch: $BRANCH)"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── ۱. وابستگی‌های سیستم ────────────────────────────────────────────────────
step "نصب وابستگی‌های سیستم..."
apt-get update -qq
apt-get install -y -qq curl git nginx ufw sqlite3
info "وابستگی‌های سیستم نصب شد"

# ─── ۲. Node.js ──────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
  step "نصب Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - 2>/dev/null
  apt-get install -y nodejs 2>/dev/null
fi
info "Node.js $(node -v) | npm $(npm -v)"

# ─── ۳. PM2 ──────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  step "نصب PM2..."
  npm install -g pm2 --silent
fi
info "PM2 $(pm2 -v)"

# ─── ۴. کاربر سیستم ─────────────────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  step "ایجاد کاربر $APP_USER..."
  useradd -r -m -s /bin/bash "$APP_USER"
fi
info "کاربر $APP_USER آماده است"

# ─── ۵. clone مخزن ──────────────────────────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  warn "مخزن از قبل وجود دارد — برای آپدیت از update.sh استفاده کنید"
else
  step "clone مخزن از branch $BRANCH..."
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
  git config --global --add safe.directory "$APP_DIR"
  info "مخزن clone شد"
fi

# ─── ۶. فایل .env.local ──────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/outputs/habibazar-web/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  step "ساخت .env.local..."
  JWT_SECRET=$(openssl rand -hex 32)
  cat > "$ENV_FILE" <<EOF
ADMIN_JWT_SECRET=${JWT_SECRET}
NEXT_PUBLIC_SITE_URL=https://habibazar.ir
NEXT_PUBLIC_API_URL=https://habibazar.ir
LOG_LEVEL=info
NODE_ENV=production
EOF
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  warn "فایل .env.local ساخته شد — آدرس سایت را بررسی کنید: $ENV_FILE"
else
  info ".env.local از قبل وجود دارد"
fi

# ─── ۷. npm install + build ──────────────────────────────────────────────────
WEB_DIR="$APP_DIR/outputs/habibazar-web"
cd "$WEB_DIR"

step "نصب پکیج‌ها (همه — شامل devDependencies برای build)..."
sudo -u "$APP_USER" npm ci
info "پکیج‌ها نصب شدند"

step "build پروژه (ممکن است چند دقیقه طول بکشد)..."
sudo -u "$APP_USER" bash -c "set -a; source $ENV_FILE; set +a; npm run build"
info "build کامل شد"

step "حذف devDependencies بعد از build..."
sudo -u "$APP_USER" npm prune --omit=dev 2>/dev/null || true
info "devDependencies حذف شد"

# ─── ۸. پوشه داده ────────────────────────────────────────────────────────────
mkdir -p "$WEB_DIR/data"
mkdir -p "/var/backups/habibazar"
chown -R "$APP_USER":"$APP_USER" "$WEB_DIR/data"
chown -R "$APP_USER":"$APP_USER" "/var/backups/habibazar"

# ─── ۹. PM2 راه‌اندازی ───────────────────────────────────────────────────────
step "راه‌اندازی PM2..."
NODE_PATH=$(dirname "$(which node)")

# wrapper script — source کردن .env.local و راه‌اندازی next
START_SCRIPT="$APP_DIR/deploy/start.sh"
cat > "$START_SCRIPT" <<STARTSCRIPT
#!/usr/bin/env bash
set -a
source "${ENV_FILE}"
set +a
exec "${NODE_PATH}/node" "${WEB_DIR}/node_modules/.bin/next" start -p ${APP_PORT}
STARTSCRIPT
chmod +x "$START_SCRIPT"
chown "$APP_USER":"$APP_USER" "$START_SCRIPT"

PM2_CONF="$APP_DIR/deploy/pm2.config.js"
cat > "$PM2_CONF" <<EOF
module.exports = {
  apps: [{
    name: 'habibazar',
    cwd: '${WEB_DIR}',
    script: '${START_SCRIPT}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    error_file: '/var/log/habibazar-error.log',
    out_file:   '/var/log/habibazar-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      PATH: '${NODE_PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    },
  }]
}
EOF
chown "$APP_USER":"$APP_USER" "$PM2_CONF"

sudo -u "$APP_USER" pm2 delete habibazar 2>/dev/null || true
sudo -u "$APP_USER" pm2 start "$PM2_CONF"
sudo -u "$APP_USER" pm2 save

# pm2 startup — استخراج دقیق دستور sudo و اجرا
STARTUP_OUT=$(pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>&1)
STARTUP_CMD=$(echo "$STARTUP_OUT" | grep "^sudo " | head -1)
if [[ -n "$STARTUP_CMD" ]]; then
  bash -c "$STARTUP_CMD"
else
  systemctl enable "pm2-$APP_USER" 2>/dev/null || true
fi
info "PM2 راه‌اندازی شد"

# ─── ۱۰. Nginx ───────────────────────────────────────────────────────────────
step "پیکربندی Nginx..."
cat > /etc/nginx/sites-available/habibazar <<EOF
server {
    listen 80;
    server_name habibazar.ir www.habibazar.ir;

    client_max_body_size 50M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location /_next/static/ {
        alias ${WEB_DIR}/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        alias ${WEB_DIR}/public/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/habibazar /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
info "Nginx پیکربندی شد"

# ─── ۱۱. Firewall ────────────────────────────────────────────────────────────
ufw allow OpenSSH    2>/dev/null || true
ufw allow 'Nginx Full' 2>/dev/null || true
ufw --force enable   2>/dev/null || true

# ─── ۱۲. health check ────────────────────────────────────────────────────────
step "بررسی سلامت سرویس..."
sleep 6
for i in 1 2 3; do
  if curl -sf "http://localhost:${APP_PORT}/api/health" &>/dev/null; then
    info "سرویس پاسخ می‌دهد ✓"; break
  fi
  [[ $i -eq 3 ]] && warn "health check پاسخ نداد — لاگ: sudo -u $APP_USER pm2 logs habibazar"
  sleep 4
done

# ─── پایان ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  نصب با موفقیت انجام شد!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  سایت:      http://habibazar.ir"
echo "  پنل ادمین: http://habibazar.ir/admin"
echo "  لاگ زنده:  sudo -u $APP_USER pm2 logs habibazar"
echo "  وضعیت:     sudo -u $APP_USER pm2 status"
echo ""
echo -e "${YELLOW}  مرحله بعد — فعال‌سازی HTTPS:${NC}"
echo "  apt install certbot python3-certbot-nginx"
echo "  certbot --nginx -d habibazar.ir -d www.habibazar.ir"
echo ""
