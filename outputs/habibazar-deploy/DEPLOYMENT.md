# Habibazar Platform — Deployment Runbook

Production deployment guide for **Ubuntu 24.04 LTS**. The platform consists of:

| App | Port | Description |
|-----|------|-------------|
| **habibazar-web** | 3000 | Next.js 15 marketing site (FA/EN) |
| **habibazar-admin** | 3001 | Next.js 15 admin panel |
| **habibazar-api** | 4000 | Express + Prisma + PostgreSQL API |
| **Nginx** | 80/443 | Reverse proxy, TLS termination, Cloudflare real-IP |
| **PostgreSQL 16** | 5432 | Primary database with pgvector extension |
| **PM2** | — | Process manager (cluster for API, fork for web/admin) |
| **Cloudflare** | — | DNS, CDN, WAF, SSL Full-strict |

Estimated time on a fresh server: **~45 minutes**

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Server Provisioning](#2-server-provisioning)
3. [PostgreSQL Setup](#3-postgresql-setup)
4. [Node.js and PM2](#4-nodejs-and-pm2)
5. [Clone Repository](#5-clone-repository)
6. [API Deployment](#6-api-deployment)
7. [Web Deployment](#7-web-deployment)
8. [Admin Deployment](#8-admin-deployment)
9. [PM2 Start](#9-pm2-start)
10. [Nginx Setup](#10-nginx-setup)
11. [SSL with Let's Encrypt](#11-ssl-with-lets-encrypt)
12. [Cloudflare Configuration](#12-cloudflare-configuration)
13. [Smoke Tests](#13-smoke-tests)
14. [Monitoring](#14-monitoring)
15. [Backups](#15-backups)
16. [Updates (Zero-Downtime)](#16-updates-zero-downtime)
17. [Rollback](#17-rollback)

---

## 1. Prerequisites

### Server requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

### DNS (configure in Cloudflare before step 11)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | habibazar.ir | `<server-ip>` | Proxied |
| A | www | `<server-ip>` | Proxied |
| A | admin | `<server-ip>` | Proxied |
| A | api | `<server-ip>` | Proxied |

Set Cloudflare SSL/TLS mode to **Full** (not strict) until certificates are issued, then switch to **Full (strict)**.

---

## 2. Server Provisioning

### 2.1 System update

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip build-essential software-properties-common \
               ca-certificates gnupg lsb-release ufw
```

### 2.2 Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

> **Warning:** Always allow OpenSSH before enabling UFW or you'll lock yourself out.

### 2.3 Deploy user

```bash
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy

mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

Switch to deploy user for all subsequent steps:

```bash
su - deploy
```

### 2.4 Directory structure

```bash
sudo mkdir -p /var/www/habibazar/{web,admin,api}
sudo mkdir -p /var/log/pm2
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge

sudo chown -R deploy:deploy /var/www/habibazar /var/log/pm2
```

---

## 3. PostgreSQL Setup

### 3.1 Install PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
psql --version    # postgresql 16.x
```

### 3.2 Install pgvector

```bash
sudo apt install -y postgresql-16-pgvector
# If unavailable, build from source:
# sudo apt install -y postgresql-server-dev-16
# git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector
# cd /tmp/pgvector && make && sudo make install
```

### 3.3 Create database

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE habibazar WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE habibazar OWNER habibazar;
GRANT ALL PRIVILEGES ON DATABASE habibazar TO habibazar;
SQL

sudo -u postgres psql -d habibazar -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

> Replace `CHANGE_ME_STRONG_PASSWORD` with a strong random password. Use it in `DATABASE_URL`.

### 3.4 PostgreSQL tuning (4 GB RAM server)

Edit `/etc/postgresql/16/main/postgresql.conf`:

```conf
max_connections = 100
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
work_mem = 10485kB
min_wal_size = 1GB
max_wal_size = 4GB
```

```bash
sudo systemctl restart postgresql
```

---

## 4. Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version    # v22.x.x

sudo npm install -g pm2
pm2 --version
```

---

## 5. Clone Repository

The entire platform lives in a single git repository. Clone it once:

```bash
cd /var/www/habibazar

git clone https://github.com/HuseinHbz/Website.git repo
# Each app lives under repo/outputs/:
#   repo/outputs/habibazar-web   → /var/www/habibazar/web
#   repo/outputs/habibazar-admin → /var/www/habibazar/admin
#   repo/outputs/habibazar-api   → /var/www/habibazar/api
#   repo/outputs/habibazar-deploy → nginx.conf, ecosystem.config.js

# Symlink or copy the app directories to the expected locations
ln -s /var/www/habibazar/repo/outputs/habibazar-web   /var/www/habibazar/web
ln -s /var/www/habibazar/repo/outputs/habibazar-admin /var/www/habibazar/admin
ln -s /var/www/habibazar/repo/outputs/habibazar-api   /var/www/habibazar/api
```

If you prefer copies instead of symlinks (safer for `npm ci`):

```bash
cp -r repo/outputs/habibazar-web   web
cp -r repo/outputs/habibazar-admin admin
cp -r repo/outputs/habibazar-api   api
```

---

## 6. API Deployment

### 6.1 Environment file

```bash
cat > /var/www/habibazar/api/.env <<'ENV'
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://habibazar:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/habibazar

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
ACCESS_TOKEN_SECRET=<64-char-hex>
REFRESH_TOKEN_SECRET=<64-char-hex>

# AES key — must be exactly 64 hex chars (= 32 bytes)
ENCRYPTION_KEY=<64-char-hex>

ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=2592000

CORS_ORIGINS=https://habibazar.ir,https://admin.habibazar.ir
OWNER_EMAIL=hosseinhabibazar@live.com

# Lead scoring
SCORE_HOT=70
SCORE_QUALIFIED=45
SCORE_NURTURE_BELOW=20

# AI provider: openai | anthropic | deepseek | ollama
AI_PROVIDER=openai
AI_MAX_TOKENS=800
AI_TEMPERATURE=0.4
AI_RATE_PER_MIN=10
AI_HISTORY_LIMIT=12
AI_MAX_TURNS=25
AI_TIMEOUT_MS=60000
AI_RETENTION_DAYS=180

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6

# SMTP (required — used for consultation confirmations and notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
MAIL_FROM=noreply@habibazar.ir
MAIL_NOTIFY_TO=hosseinhabibazar@live.com

# Optional: Cloudflare R2 for database backups
# R2_BUCKET=habibazar-backups
# R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
ENV

chmod 600 /var/www/habibazar/api/.env
```

Generate secrets:

```bash
# ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (exactly 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6.2 Install dependencies

```bash
cd /var/www/habibazar/api
npm ci --omit=dev
```

### 6.3 Generate Prisma client and apply schema

```bash
cd /var/www/habibazar/api

# Generate the Prisma client (creates typed query builder)
npx prisma generate

# Apply the schema to the database
# First deploy: use db push (no migrations directory exists yet)
npx prisma db push

# Subsequent deploys with schema changes: use migrate deploy after creating migrations locally
# npx prisma migrate deploy
```

> **Note:** `db push` is used on first deploy because this project ships without a `prisma/migrations/`
> directory. Once you add migrations (`prisma migrate dev` locally), switch to `prisma migrate deploy`
> for all subsequent server deploys.

### 6.4 Apply database hardening

Run **after** `db push` has created all tables:

```bash
cd /var/www/habibazar/api
npm run db:hardening
# Runs: psql $DATABASE_URL -f prisma/sql/hardening.sql
```

This applies:
- Partial unique indexes (slug reuse after soft-delete)
- Lead score range constraint (0–100)
- pgvector HNSW index on `content_embeddings`

### 6.5 Create initial superadmin role and user

```bash
sudo -u postgres psql -d habibazar <<'SQL'
-- Superadmin role with wildcard permission
INSERT INTO roles (id, name, permissions, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'superadmin',
    ARRAY['lead:read','lead:write','lead:delete',
          'consultation:read','consultation:write',
          'engagement:read','engagement:write',
          'content:read','content:write','content:delete',
          'testimonial:approve','cert:verify','consent:write',
          'user:read','user:write',
          'role:read','role:write',
          'settings:read','settings:write',
          'audit:read',
          'ai:read','ai:write'],
    NOW(), NOW()
) ON CONFLICT (name) DO NOTHING;
SQL
```

Then create the first admin user via the API:

```bash
# Start the API temporarily
cd /var/www/habibazar/api && node dist/server.js &
API_PID=$!

sleep 2

# Get the superadmin role ID
ROLE_ID=$(psql $DATABASE_URL -t -c "SELECT id FROM roles WHERE name='superadmin';" | tr -d ' ')

# Register first admin (adjust payload)
curl -s -X POST http://127.0.0.1:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"hosseinhabibazar@live.com\",\"password\":\"CHANGE_ME\",\"name\":\"Admin\",\"roleId\":\"$ROLE_ID\"}"

kill $API_PID
```

### 6.6 Build

```bash
cd /var/www/habibazar/api
npm run build

ls dist/
# server.js and compiled modules
```

---

## 7. Web Deployment

### 7.1 Environment file

```bash
cat > /var/www/habibazar/web/.env.local <<'ENV'
NEXT_PUBLIC_SITE_URL=https://habibazar.ir
NEXT_PUBLIC_API_URL=https://api.habibazar.ir
ENV

chmod 600 /var/www/habibazar/web/.env.local
```

### 7.2 Install and build

```bash
cd /var/www/habibazar/web
npm ci --omit=dev
npm run build

ls .next/
# server/, static/, BUILD_ID, ...
```

---

## 8. Admin Deployment

### 8.1 Environment file

```bash
cat > /var/www/habibazar/admin/.env.local <<'ENV'
NEXT_PUBLIC_API_URL=https://api.habibazar.ir
NEXT_PUBLIC_SITE_URL=https://admin.habibazar.ir
ENV

chmod 600 /var/www/habibazar/admin/.env.local
```

### 8.2 Install and build

```bash
cd /var/www/habibazar/admin
npm ci --omit=dev
npm run build

ls .next/
# server/, static/, BUILD_ID, ...
```

---

## 9. PM2 Start

### 9.1 Copy ecosystem config

```bash
cp /var/www/habibazar/repo/outputs/habibazar-deploy/ecosystem.config.js \
   /var/www/habibazar/ecosystem.config.js
```

### 9.2 Start all apps

```bash
cd /var/www/habibazar
pm2 start ecosystem.config.js --env production
pm2 list
# habibazar-web   online
# habibazar-admin online
# habibazar-api   online (2 instances)
```

Check logs for startup errors:

```bash
pm2 logs --lines 50
```

Quick local health checks:

```bash
curl -s http://127.0.0.1:3000/          # web HTML
curl -s http://127.0.0.1:3001/          # admin HTML
curl -s http://127.0.0.1:4000/health    # {"status":"ok",...}
curl -s http://127.0.0.1:4000/ready     # {"status":"ready","db":"connected"}
```

### 9.3 Save and configure autostart

```bash
pm2 save

pm2 startup systemd -u deploy --hp /home/deploy
# Copy and run the sudo command it prints
```

Verify:

```bash
sudo systemctl status pm2-deploy
# active (running)
```

---

## 10. Nginx Setup

### 10.1 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 10.2 Copy configuration

```bash
sudo cp /var/www/habibazar/repo/outputs/habibazar-deploy/nginx.conf \
        /etc/nginx/conf.d/habibazar.conf

# Remove default site — this config uses conf.d only
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/habibazar   # remove if it exists
sudo rm -f /etc/nginx/conf.d/default.conf
```

Verify the main nginx.conf includes conf.d:

```bash
grep "conf.d" /etc/nginx/nginx.conf
# include /etc/nginx/conf.d/*.conf;
```

### 10.3 Placeholder SSL certs (for nginx -t before Certbot)

```bash
sudo mkdir -p /etc/letsencrypt/live/{habibazar.ir,admin.habibazar.ir,api.habibazar.ir}

for domain in habibazar.ir admin.habibazar.ir api.habibazar.ir; do
    sudo openssl req -x509 -nodes -newkey rsa:2048 \
        -keyout /etc/letsencrypt/live/$domain/privkey.pem \
        -out    /etc/letsencrypt/live/$domain/fullchain.pem \
        -days 1 -subj "/CN=$domain"
done
```

### 10.4 Test and load

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 11. SSL with Let's Encrypt

### 11.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 11.2 Temporarily set Cloudflare SSL to "Full" (not strict)

This allows the HTTP-01 ACME challenge to reach the origin through the Cloudflare proxy.

### 11.3 Issue certificates

```bash
sudo certbot --nginx \
    -d habibazar.ir -d www.habibazar.ir \
    --non-interactive --agree-tos \
    --email hosseinhabibazar@gmail.com --redirect

sudo certbot --nginx \
    -d admin.habibazar.ir \
    --non-interactive --agree-tos \
    --email hosseinhabibazar@gmail.com --redirect

sudo certbot --nginx \
    -d api.habibazar.ir \
    --non-interactive --agree-tos \
    --email hosseinhabibazar@gmail.com --redirect
```

> Certbot may modify nginx config blocks. Review and revert any unwanted changes
> (our habibazar.conf already has correct SSL blocks).

### 11.4 Verify auto-renewal

```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer   # active (waiting)
```

### 11.5 Switch Cloudflare to Full (strict)

In Cloudflare dashboard: **SSL/TLS → Overview → Full (strict)**

### 11.6 Final nginx reload

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 12. Cloudflare Configuration

### DNS

All four A records should be **Proxied** (orange cloud).

### SSL/TLS → Overview
- Mode: **Full (strict)**

### SSL/TLS → Edge Certificates
- Always Use HTTPS: **On**
- HSTS: **On**, Max Age 6 months, Include subdomains, Preload
- Minimum TLS: **TLS 1.2**
- TLS 1.3: **On**

### Speed → Optimization
- Brotli: **On**
- Rocket Loader: **Off** (breaks Next.js hydration)
- Minify: **Off** (Next.js already minifies)
- Early Hints: **On**

### Caching → Cache Rules

| Rule | Match | Action |
|------|-------|--------|
| Next.js static | `http.request.uri.path contains "/_next/static/"` | Cache Everything, 1 year TTL |
| API bypass | `http.host eq "api.habibazar.ir"` | Bypass cache |
| Admin bypass | `http.host eq "admin.habibazar.ir"` | Bypass cache |

### Security → WAF → Rate Limiting

| Rule | Match | Rate | Action |
|------|-------|------|--------|
| Admin login | `host = admin.habibazar.ir AND path contains /login` | 5 req/60s | Block 10 min |
| API general | `host = api.habibazar.ir` | 100 req/60s | Block 1 min |

### Security → Bots
- Bot Fight Mode: **On**

### (Optional) Restrict origin to Cloudflare IPs only

```bash
curl -s https://www.cloudflare.com/ips-v4 | while read cidr; do
    sudo ufw allow from "$cidr" to any port 80
    sudo ufw allow from "$cidr" to any port 443
done
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp
sudo ufw reload
```

---

## 13. Smoke Tests

Run after full deployment against the public hostnames:

```bash
# API health
curl -s https://api.habibazar.ir/health
# {"status":"ok","timestamp":"..."}

curl -s https://api.habibazar.ir/ready
# {"status":"ready","db":"connected"}

# Web homepage (HTTP/2 200)
curl -sI https://habibazar.ir/ | head -3

# Admin panel (HTTP/2 200)
curl -sI https://admin.habibazar.ir/ | head -3

# HTTPS redirect
curl -sI http://habibazar.ir/ | grep -i location
# Location: https://habibazar.ir/

# www → canonical redirect
curl -sI https://www.habibazar.ir/ | grep -i location
# Location: https://habibazar.ir/

# Security headers on admin
curl -sI https://admin.habibazar.ir/ | grep -i "x-frame\|x-robots"
# X-Frame-Options: DENY
# X-Robots-Tag: noindex, nofollow

# Next.js static asset cache
curl -sI https://habibazar.ir/_next/static/chunks/main-*.js 2>/dev/null | grep -i cache-control
# Cache-Control: public, max-age=31536000, immutable

# Lead submission
curl -s -X POST https://api.habibazar.ir/api/v1/leads \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@example.com","source":"WEBSITE"}' | jq .

# AI SSE stream test
CONV=$(curl -s -X POST https://api.habibazar.ir/api/v1/ai/start \
    -H "Content-Type: application/json" \
    -d '{"sessionRef":"test-smoke","locale":"FA"}' | jq -r '.data.id')

curl -N -s -X POST "https://api.habibazar.ir/api/v1/ai/$CONV/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"سلام","locale":"FA"}' &
sleep 5 && kill %1
# Should print SSE data: lines
```

---

## 14. Monitoring

### PM2 log rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

### External uptime monitoring

Set up [UptimeRobot](https://uptimerobot.com) or [BetterStack](https://betterstack.com) for:

| URL | Interval |
|-----|----------|
| `https://habibazar.ir/` | 1 min |
| `https://api.habibazar.ir/health` | 1 min |
| `https://admin.habibazar.ir/` | 5 min |

### Disk alert cron

```bash
crontab -e
# Add:
*/15 * * * * df -h / | awk 'NR==2 {if (int($5) > 80) system("echo Disk " $5 " | mail -s DISK_ALERT hosseinhabibazar@gmail.com")}' 2>/dev/null || true
```

---

## 15. Backups

### Create backup script

```bash
sudo tee /usr/local/bin/backup-habibazar.sh > /dev/null <<'SCRIPT'
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/habibazar"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
DB_URL="${DATABASE_URL:-postgresql://habibazar:PASSWORD@127.0.0.1:5432/habibazar}"

mkdir -p "$BACKUP_DIR"

DUMP="$BACKUP_DIR/habibazar_${DATE}.dump"
pg_dump "$DB_URL" -Fc -f "$DUMP"
gzip "$DUMP"

# Upload to Cloudflare R2 (optional)
if [[ -n "${R2_ENDPOINT:-}" ]]; then
    aws s3 cp "${DUMP}.gz" \
        "s3://${R2_BUCKET}/db/habibazar_${DATE}.dump.gz" \
        --endpoint-url "$R2_ENDPOINT" --profile r2
fi

find "$BACKUP_DIR" -name "*.dump.gz" -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
echo "Backup done: ${DUMP}.gz"
SCRIPT
sudo chmod +x /usr/local/bin/backup-habibazar.sh
```

### Schedule daily backup at 03:00 UTC

```bash
crontab -e
# Add:
0 3 * * * /usr/local/bin/backup-habibazar.sh >> /var/log/habibazar-backup.log 2>&1
```

> **Best practice:** Always run the backup script manually before any deployment that includes schema changes.

---

## 16. Updates (Zero-Downtime)

### Pull latest code

```bash
cd /var/www/habibazar/repo
git pull origin main    # or your production branch
```

### Update API

```bash
cd /var/www/habibazar/api
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy    # only if new migrations exist
npm run build
pm2 reload habibazar-api --update-env
curl -s http://127.0.0.1:4000/health
```

### Update Web

```bash
cd /var/www/habibazar/web
npm ci --omit=dev
npm run build
pm2 restart habibazar-web --update-env
```

### Update Admin

```bash
cd /var/www/habibazar/admin
npm ci --omit=dev
npm run build
pm2 restart habibazar-admin --update-env
```

### Save PM2 state

```bash
pm2 save
```

---

## 17. Rollback

### Code rollback

```bash
cd /var/www/habibazar/repo
git log --oneline -10
git checkout <LAST_GOOD_COMMIT>

# Rebuild affected app
cd /var/www/habibazar/api && npm run build && pm2 reload habibazar-api --update-env
# or
cd /var/www/habibazar/web && npm run build && pm2 restart habibazar-web --update-env
# or
cd /var/www/habibazar/admin && npm run build && pm2 restart habibazar-admin --update-env
```

### Database rollback (destructive — last resort)

```bash
# Restore from backup (all data after backup timestamp is lost)
sudo -u postgres psql -c "DROP DATABASE habibazar;"
sudo -u postgres psql -c "CREATE DATABASE habibazar OWNER habibazar;"
sudo -u postgres psql -d habibazar -c "CREATE EXTENSION IF NOT EXISTS vector;"
pg_restore -U habibazar -d habibazar /var/backups/habibazar/habibazar_BACKUP.dump.gz
```

---

## Quick Reference

### PM2

```bash
pm2 list                                        # All processes + status
pm2 logs habibazar-api --lines 100             # API logs
pm2 logs habibazar-web --lines 50              # Web logs
pm2 logs habibazar-admin --lines 50            # Admin logs
pm2 monit                                       # Real-time dashboard
pm2 reload habibazar-api --update-env          # Zero-downtime reload (cluster)
pm2 restart habibazar-web --update-env         # Restart web (brief)
pm2 restart habibazar-admin --update-env       # Restart admin (brief)
pm2 start ecosystem.config.js --env production  # Start all from config
pm2 save                                        # Persist process list
```

### Nginx

```bash
sudo nginx -t                                   # Test config
sudo systemctl reload nginx                     # Reload (no downtime)
sudo tail -f /var/log/nginx/error.log          # Error log
```

### PostgreSQL

```bash
psql $DATABASE_URL                              # Connect
sudo systemctl restart postgresql               # Restart DB
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### Certbot

```bash
sudo certbot renew --dry-run                   # Test renewal
sudo certbot certificates                       # Show cert expiry dates
```

### Service status

```bash
sudo systemctl status nginx postgresql pm2-deploy
```
