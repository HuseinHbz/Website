#!/usr/bin/env bash
# =============================================================================
# HBZ Website — نصب اولیه روی سرور تازه (Ubuntu 22.04)
# =============================================================================
# استفاده:
#   sudo bash deploy/install.sh                  # شاخهٔ تولید (deploy/branch.env)
#   sudo bash deploy/install.sh main             # branch خاص
# =============================================================================
set -euo pipefail

# ─── تنظیمات ─────────────────────────────────────────────────────────────────
APP_USER="hbz"
APP_DIR="/var/www/habibazar"
REPO_URL="https://github.com/HuseinHbz/Website.git"
# شاخهٔ تولید از deploy/branch.env (تنها منبع حقیقت) — آرگومان اول override می‌کند.
BRANCH_ENV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/branch.env"
# shellcheck source=/dev/null
[[ -f "$BRANCH_ENV" ]] && source "$BRANCH_ENV"
BRANCH="${1:-${HBZ_BRANCH:-${PROD_BRANCH:-feature/v2-enterprise-upgrade}}}"
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
step "بررسی وابستگی‌های سیستم..."
MISSING_PKGS=""
for p in curl git nginx ufw; do
  dpkg -s "$p" &>/dev/null || MISSING_PKGS="$MISSING_PKGS $p"
done
if [[ -n "$MISSING_PKGS" ]]; then
  step "نصب پکیج‌های ناموجود:$MISSING_PKGS"
  apt-get update -qq
  # shellcheck disable=SC2086
  apt-get install -y -qq $MISSING_PKGS
  info "پکیج‌های ناموجود نصب شد"
else
  info "همهٔ وابستگی‌های سیستم از قبل نصب‌اند — رد شد"
fi

# ─── ۲. Node.js ──────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
  step "نصب Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - 2>/dev/null
  apt-get install -y nodejs 2>/dev/null
else
  info "Node.js از قبل نصب است (>= $NODE_VERSION) — رد شد"
fi
info "Node.js $(node -v) | npm $(npm -v)"

# ─── ۳. PM2 ──────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  step "نصب PM2..."
  npm install -g pm2 --silent
else
  info "PM2 از قبل نصب است — رد شد"
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
  # idempotent: مخزن هست → همگام با remote همان branch (نه خطا، نه ردشدن خاموش).
  # .env.local و public/uploads در گیت نیستند و دست‌نخورده می‌مانند.
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
  # کلون تولید محل ویرایش نیست؛ chmod +x روی اسکریپت‌ها نباید diff بسازد.
  git -C "$APP_DIR" config core.fileMode false 2>/dev/null || true
  CUR="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
  git -C "$APP_DIR" fetch origin "$BRANCH" -q || error "fetch از remote شکست خورد"
  REMOTE="$(git -C "$APP_DIR" rev-parse --short "origin/$BRANCH")"
  if [[ "$CUR" == "$REMOTE" ]]; then
    info "مخزن از قبل روی همان نسخه است ($CUR) — رد شد"
  else
    step "همگام‌سازی مخزن: $CUR → $REMOTE (branch: $BRANCH)"
    # تغییرات محلی روی فایل‌های تحت گیت، همگام‌سازی را قفل می‌کرد (checkout abort).
    # اینجا کلون تولید است: تغییرات کنار گذاشته می‌شوند، اما اول در /root بکاپ
    # می‌گیریم تا چیزی خاموش از بین نرود. فایل‌های خارج از گیت (.env.local،
    # public/uploads، data/) اصلاً دست نمی‌خورند.
    if ! git -C "$APP_DIR" diff --quiet || ! git -C "$APP_DIR" diff --cached --quiet; then
      PATCH="/root/habibazar-local-changes-$(date +%Y%m%d-%H%M%S).patch"
      git -C "$APP_DIR" diff HEAD > "$PATCH" 2>/dev/null || true
      warn "تغییرات محلی روی فایل‌های تحت گیت پیدا شد — کنار گذاشته می‌شود"
      warn "بکاپ آن‌ها: $PATCH"
    fi
    git -C "$APP_DIR" checkout -q -f -B "$BRANCH" "origin/$BRANCH"
    git -C "$APP_DIR" reset -q --hard "origin/$BRANCH"
    # بازماندهٔ ساختار تودرتوی قدیمی (قبل از flatten 26.26d) را پاک کن
    [[ -d "$APP_DIR/outputs" ]] && rm -rf "$APP_DIR/outputs" && info "بازماندهٔ outputs/ قدیمی حذف شد"
    chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
    info "مخزن همگام شد ($REMOTE)"
  fi
else
  step "clone مخزن از branch $BRANCH..."
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
  git config --global --add safe.directory "$APP_DIR"
  info "مخزن clone شد"
fi
[[ -f "$APP_DIR/package.json" ]] || error "package.json در ریشهٔ $APP_DIR نیست — branch اشتباه است؟ ($BRANCH)"

# ─── ۶الف. PostgreSQL (runtime database) ─────────────────────────────────────
# The app runs exclusively on PostgreSQL (Phase 20). Provision it if the DSN
# isn't already present, and capture DATABASE_URL for .env.local.
step "راه‌اندازی PostgreSQL..."
if [[ -f /root/.habibazar-pg-dsn ]]; then
  DATABASE_URL="$(cat /root/.habibazar-pg-dsn)"
  info "PostgreSQL از قبل provision شده"
else
  bash "$(dirname "$0")/postgres/install-postgresql.sh" || warn "provisioning PostgreSQL با خطا مواجه شد — دستی بررسی کنید"
  DATABASE_URL="$(cat /root/.habibazar-pg-dsn 2>/dev/null || true)"
fi

# ─── ۶ب. فایل .env.local ──────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  step "ساخت .env.local..."
  JWT_SECRET=$(openssl rand -hex 32)
  cat > "$ENV_FILE" <<EOF
ADMIN_JWT_SECRET=${JWT_SECRET}
DATABASE_URL=${DATABASE_URL}
NEXT_PUBLIC_SITE_URL=https://habibazar.ir
NEXT_PUBLIC_API_URL=https://habibazar.ir
LOG_LEVEL=info
NODE_ENV=production
# ── Phase 26.25s multi-channel messaging (ALL OPTIONAL — no key ⇒ deterministic
# sandbox, never breaks build/runtime). Prefer configuring these in the admin
# panel (erp_settings); env vars are a fallback. Public webhook routes that must
# be reachable through the reverse proxy:
#   POST /api/webhooks/whatsapp   POST /api/webhooks/telegram   GET /api/unsubscribe
# KAVENEGAR_API_KEY=
# SMSIR_API_KEY=
# WHATSAPP_TOKEN=
# WHATSAPP_PHONE_ID=
# WHATSAPP_VERIFY_TOKEN=
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_WEBHOOK_SECRET=
EOF
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  warn "فایل .env.local ساخته شد — آدرس سایت را بررسی کنید: $ENV_FILE"
else
  info ".env.local از قبل وجود دارد"
  # Ensure DATABASE_URL is present for existing installs migrating to PostgreSQL.
  if [[ -n "$DATABASE_URL" ]] && ! grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    echo "DATABASE_URL=${DATABASE_URL}" >> "$ENV_FILE"
    info "DATABASE_URL به .env.local اضافه شد"
  fi
fi

# ─── ۷. npm install + build ──────────────────────────────────────────────────
WEB_DIR="$APP_DIR"
cd "$WEB_DIR"

# idempotent: اگر همان کامیت + همان package-lock قبلاً با موفقیت build شده، رد شو
STATE_FILE="$APP_DIR/.install-state"
CUR_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD)"
LOCK_HASH="$(sha256sum "$APP_DIR/package-lock.json" | awk '{print $1}')"
WANT_STATE="$CUR_COMMIT $LOCK_HASH"
if [[ -f "$STATE_FILE" && "$(cat "$STATE_FILE")" == "$WANT_STATE" && -f "$APP_DIR/.next/BUILD_ID" ]]; then
  info "پکیج‌ها و build برای همین نسخه از قبل آماده‌اند — رد شد"
else
  step "نصب پکیج‌ها (همه — شامل devDependencies برای build)..."
  sudo -u "$APP_USER" npm ci --include=dev
  info "پکیج‌ها نصب شدند"

  step "build پروژه (ممکن است چند دقیقه طول بکشد)..."
  sudo -u "$APP_USER" bash -c "set -a; source $ENV_FILE; set +a; npm run build"
  info "build کامل شد"

  step "حذف devDependencies بعد از build..."
  sudo -u "$APP_USER" npm prune --omit=dev 2>/dev/null || true
  info "devDependencies حذف شد"

  echo "$WANT_STATE" > "$STATE_FILE"
  chown "$APP_USER":"$APP_USER" "$STATE_FILE"
fi

# ─── ۷.۵ همگام‌سازی schema دیتابیس (idempotent) ─────────────────────────────
# migrate.ts سراسر CREATE TABLE IF NOT EXISTS / ALTER ایمن است: جداول و دادهٔ
# موجود دست نمی‌خورد، فقط جدول/ستون/seed ناموجود اضافه می‌شود. tsx به devDeps
# نیاز دارد؛ چون بالا prune شد، از npx (نصب موقت) استفاده می‌کنیم.
step "همگام‌سازی schema دیتابیس (جداول موجود حفظ، ناموجودها اضافه)..."
TB_BEFORE="$(sudo -u postgres psql -tA -d habibazar -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null ||   psql "$DATABASE_URL" -tA -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo '?')"
if sudo -u "$APP_USER" bash -c "set -a; source $ENV_FILE; set +a; cd '$APP_DIR' && npx --yes tsx scripts/ci-live-pg.ts" >/dev/null 2>&1; then
  TB_AFTER="$(psql "$DATABASE_URL" -tA -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo '?')"
  if [[ "$TB_BEFORE" == "$TB_AFTER" ]]; then
    info "schema دیتابیس کامل بود ($TB_AFTER جدول) — چیزی تغییر نکرد"
  else
    info "schema همگام شد: $TB_BEFORE → $TB_AFTER جدول (فقط ناموجودها اضافه شد)"
  fi
else
  warn "همگام‌سازی صریح schema اجرا نشد — اشکالی ندارد: اپ موقع بالا آمدن خودش migrate می‌کند (idempotent)"
fi

# ─── ۸. پوشه داده ────────────────────────────────────────────────────────────
mkdir -p "$WEB_DIR/data"
mkdir -p "/var/backups/habibazar"
chown -R "$APP_USER":"$APP_USER" "$WEB_DIR/data"
chown -R "$APP_USER":"$APP_USER" "/var/backups/habibazar"

# ─── ۸.۵ بکاپ خودکار (بدون cron — موتور داخلی برنامه) ────────────────────────
# Backups are now driven by the in-app, event-driven BackupEngine (starts with
# the Node process via instrumentation.ts) — NO OS cron. Here we only (a) drop
# any legacy cron job from a previous install and (b) ensure an encryption key
# exists in .env.local for the engine.
step "پیکربندی بکاپ داخلی (بدون cron)..."
rm -f /etc/cron.d/habibazar-backup 2>/dev/null || true
if ! grep -q '^BACKUP_ENCRYPTION_KEY=' "$ENV_FILE" 2>/dev/null; then
  echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> "$ENV_FILE"
  chown "$APP_USER":"$APP_USER" "$ENV_FILE" 2>/dev/null || true
fi

# ─── ۹. PM2 راه‌اندازی ───────────────────────────────────────────────────────
step "راه‌اندازی PM2..."
NODE_PATH=$(dirname "$(which node)")

# پوشه لاگ در home کاربر hbz — از خطای permission در /var/log جلوگیری می‌کند
LOG_DIR="/home/$APP_USER/logs"
mkdir -p "$LOG_DIR"
chown -R "$APP_USER":"$APP_USER" "$LOG_DIR"

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
    error_file: '${LOG_DIR}/habibazar-error.log',
    out_file:   '${LOG_DIR}/habibazar-out.log',
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
# ⛔ pm2 startup ممکن است غیرصفر برگردد؛ نباید کل نصب را بکشد (set -e)
STARTUP_OUT=$(pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>&1 || true)
STARTUP_CMD=$(echo "$STARTUP_OUT" | grep "^sudo " | head -1)
if [[ -n "$STARTUP_CMD" ]]; then
  bash -c "$STARTUP_CMD" || warn "pm2 startup اجرا نشد — بعداً دستی: pm2 startup systemd -u $APP_USER --hp /home/$APP_USER"
else
  systemctl enable "pm2-$APP_USER" 2>/dev/null || true
fi
info "PM2 راه‌اندازی شد"

# ─── ۱۰. Nginx (دامنه‌محور — INFRA-1 بند ۵) ─────────────────────────────────
step "پیکربندی Nginx (دامنهٔ اصلی + ریدایرکت‌ها)..."
# دامنه‌ها از env (PRIMARY_DOMAIN / REDIRECT_DOMAINS) یا deploy/.install.conf یا پرسش تعاملی
PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-}" REDIRECT_DOMAINS="${REDIRECT_DOMAINS:-}" APP_PORT="$APP_PORT" APP_DIR="$APP_DIR" \
  bash "$APP_DIR/deploy/nginx/render-nginx.sh" --install || error "پیکربندی nginx شکست خورد"
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
