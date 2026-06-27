# Habibazar Platform — Deployment Runbook

This runbook covers a full production deployment of the Habibazar platform on a fresh Ubuntu 24.04 LTS VPS. The platform consists of:

- **habibazar-web** — Next.js 15 portfolio site + built-in admin panel (port 3000)
  - i18n: Farsi (default) and English via `next-intl`
  - Admin panel at `/admin` with JWT auth and SQLite database
  - SQLite (better-sqlite3 + drizzle-orm) — no external DB required
- **habibazar-api** — Express + Prisma + pgvector API (port 4000)
- **Nginx** — reverse proxy / TLS termination
- **PostgreSQL 16** — database for the API (pgvector extension)
- **PM2** — process manager (cluster mode for API, fork for web)
- **Cloudflare** — DNS, CDN, WAF, SSL (Full-strict mode)

Estimated completion time for a fresh server: ~45 minutes.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Server Provisioning](#2-server-provisioning)
3. [PostgreSQL Setup](#3-postgresql-setup)
4. [Node.js and PM2](#4-nodejs-and-pm2)
5. [Repository Setup](#5-repository-setup)
6. [API Deployment](#6-api-deployment)
7. [Web Deployment](#7-web-deployment)
8. [PM2 Start](#8-pm2-start)
9. [Nginx Setup](#9-nginx-setup)
10. [SSL with Let's Encrypt](#10-ssl-with-lets-encrypt)
11. [Cloudflare Configuration](#11-cloudflare-configuration)
12. [Smoke Tests](#12-smoke-tests)
13. [Monitoring Setup](#13-monitoring-setup)
14. [Backup Configuration](#14-backup-configuration)
15. [Updates (Zero-Downtime)](#15-updates-zero-downtime)
16. [Rollback](#16-rollback)

---

## 1. Prerequisites

### Server requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

### DNS (must be done before SSL step)

Log into Cloudflare and create the following DNS records, all proxied (orange cloud):

| Type | Name | Content |
|------|------|---------|
| A | habibazar.ir | `<server-ip>` |
| A | www | `<server-ip>` |
| A | api | `<server-ip>` |

> **Note:** The admin panel is served from `habibazar.ir/admin` — no separate `admin` subdomain is needed.

Set Cloudflare SSL/TLS mode to **Full (strict)** before issuing certificates. Until certificates are issued (step 10), temporarily set mode to **Full** to avoid redirect loops.

### Local prerequisites

- SSH access as root (or a sudoer) to the VPS
- Git access to both repositories (`habibazar-web`, `habibazar-api`)
- Filled-in `.env` files for both apps (based on the examples in this runbook)
- Cloudflare account managing `habibazar.ir`

---

## 2. Server Provisioning

### 2.1 Initial system update

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip build-essential software-properties-common \
               ca-certificates gnupg lsb-release ufw
```

### 2.2 Configure firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose
```

> **Warning:** Make absolutely sure `allow OpenSSH` is set before running `ufw enable`, or you will lock yourself out.

### 2.3 Create deploy user

```bash
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy

# Copy your SSH key so you can log in as deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

All subsequent commands in this runbook should be run as the `deploy` user unless otherwise noted.

```bash
su - deploy
```

### 2.4 Create directory structure

```bash
sudo mkdir -p /var/www/habibazar/{web,api}
sudo mkdir -p /var/www/habibazar/web/data   # SQLite database directory
sudo mkdir -p /var/log/pm2
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge

sudo chown -R deploy:deploy /var/www/habibazar
sudo chown -R deploy:deploy /var/log/pm2
```

---

## 3. PostgreSQL Setup

> **Note:** PostgreSQL is only required for **habibazar-api**. The web app uses its own embedded SQLite database stored at `/var/www/habibazar/web/data/habibazar.db`.

### 3.1 Install PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Verify the version:

```bash
psql --version
# postgresql 16.x
```

### 3.2 Install pgvector extension

```bash
sudo apt install -y postgresql-16-pgvector
```

Alternatively, build from source if the package is not available:

```bash
sudo apt install -y postgresql-server-dev-16
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector
cd /tmp/pgvector
make && sudo make install
cd ~ && rm -rf /tmp/pgvector
```

### 3.3 Create database role and database

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE habibazar WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE habibazar OWNER habibazar;
GRANT ALL PRIVILEGES ON DATABASE habibazar TO habibazar;
SQL
```

> **Warning:** Replace `CHANGE_ME_STRONG_PASSWORD` with a strong, randomly generated password. Store it in your password manager. Use the same value in the API's `DATABASE_URL` environment variable.

### 3.4 Enable pgvector extension

```bash
sudo -u postgres psql -d habibazar -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Verify:

```bash
sudo -u postgres psql -d habibazar -c "\dx"
# Should list: vector | ... | pgvector
```

### 3.5 Tune PostgreSQL for production (optional but recommended)

Edit `/etc/postgresql/16/main/postgresql.conf`:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Adjust these settings (tune for your RAM; values below assume 4 GB):

```conf
max_connections = 100
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10485kB
min_wal_size = 1GB
max_wal_size = 4GB
```

```bash
sudo systemctl restart postgresql
```

---

## 4. Node.js and PM2

### 4.1 Install Node.js 22 LTS via NodeSource

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # v22.x.x
npm --version    # 10.x.x
```

### 4.2 Install PM2 globally

```bash
sudo npm install -g pm2
pm2 --version
```

### 4.3 Create PM2 log directory

```bash
sudo mkdir -p /var/log/pm2
sudo chown deploy:deploy /var/log/pm2
```

---

## 5. Repository Setup

### 5.1 Clone repositories

```bash
cd /var/www/habibazar

# Replace with your actual git remote URLs
git clone https://github.com/YOUR_ORG/habibazar-api.git api
git clone https://github.com/YOUR_ORG/habibazar-web.git web
```

If using SSH keys:

```bash
# Ensure deploy user has an SSH key added to your git provider
ssh-keygen -t ed25519 -C "deploy@habibazar.ir" -f /home/deploy/.ssh/id_ed25519 -N ""
cat /home/deploy/.ssh/id_ed25519.pub
# Add this public key to your git provider before cloning
```

### 5.2 Install dependencies

```bash
cd /var/www/habibazar/api && npm install --omit=dev
cd /var/www/habibazar/web && npm install --omit=dev
```

> **Note:** `npm ci` requires a committed `package-lock.json`. Use `npm install` instead — it installs from `package.json` and generates the lock file on first run. On subsequent deploys you can use `npm ci` if the lock file was committed.

---

## 6. API Deployment

### 6.1 Copy environment file

```bash
cp /path/to/your/api.env /var/www/habibazar/api/.env
chmod 600 /var/www/habibazar/api/.env
```

The `.env` must contain all required variables from `.env.example`. Critical values to set:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://habibazar:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/habibazar
ACCESS_TOKEN_SECRET=<random 64-char string>
REFRESH_TOKEN_SECRET=<random 64-char string>
ENCRYPTION_KEY=<random 64 hex chars = 32 bytes>
CORS_ORIGINS=https://habibazar.ir,https://www.habibazar.ir
OWNER_EMAIL=hosseinhabibazar@live.com
```

Generate secure secrets:

```bash
# ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (must be exactly 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6.2 Run Prisma migrations

```bash
cd /var/www/habibazar/api

# Generate the Prisma client
npx prisma generate

# Apply migrations to production database
npx prisma migrate deploy
```

> **Warning:** `prisma migrate deploy` applies pending migrations in order without prompting. Always test migrations on a staging database first if you have one. It is non-destructive on first run (creates all tables from scratch).

### 6.3 Apply database hardening

```bash
cd /var/www/habibazar/api
npm run db:hardening
```

This script (`prisma/sql/hardening.sql`) applies:
- Partial unique indexes to support soft-delete slug reuse
- Lead score range constraint (0–100)
- pgvector HNSW index on `content_embeddings` for cosine similarity search

### 6.4 Seed initial data (first deploy only)

If the project includes a seed script:

```bash
cd /var/www/habibazar/api
npx prisma db seed
```

If there is no Prisma seed, create the initial admin role and user manually:

```bash
sudo -u postgres psql -d habibazar <<'SQL'
-- Create the superadmin role
INSERT INTO roles (id, name, permissions, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'superadmin',
    ARRAY['*'],
    NOW(),
    NOW()
) ON CONFLICT (name) DO NOTHING;
SQL
```

The first admin user should be created through the API's registration endpoint or a dedicated seed command provided by the project.

### 6.5 Build the API

```bash
cd /var/www/habibazar/api
npm run build
```

Verify the build output:

```bash
ls dist/
# Should include: server.js and compiled route/controller files
```

### 6.6 Quick smoke test (before PM2)

```bash
cd /var/www/habibazar/api
node dist/server.js &
sleep 2

curl -s http://127.0.0.1:4000/health
# Expected: {"status":"ok"} or similar

curl -s http://127.0.0.1:4000/ready
# Expected: {"status":"ready"} or similar

kill %1
```

If either check fails, inspect logs before continuing.

---

## 7. Web Deployment

### 7.1 Copy environment file

```bash
cp /path/to/your/web.env /var/www/habibazar/web/.env.local
chmod 600 /var/www/habibazar/web/.env.local
```

Required values:

```env
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://habibazar.ir
NEXT_PUBLIC_API_URL=https://api.habibazar.ir
ADMIN_JWT_SECRET=<random 64-char string — must be kept secret>
```

Generate `ADMIN_JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

> **Warning:** `ADMIN_JWT_SECRET` signs the admin session tokens for the built-in `/admin` panel. If it is leaked, anyone can forge a valid admin token. Change it immediately on any suspected compromise and restart the web process.

### 7.2 Initialize the SQLite database (first deploy only)

The web app creates and migrates its SQLite database automatically on first request via `src/lib/db/migrate.ts`. However, you should initialize it explicitly before starting PM2 so the `data/` directory is created with the correct permissions and the seed data is loaded:

```bash
cd /var/www/habibazar/web

# Run the migration + seed in a one-off Node script
node -e "
const { runMigrations } = require('./src/lib/db/migrate');
const { seedDatabase } = require('./src/lib/db/seed');
runMigrations();
seedDatabase().then(() => { console.log('DB ready'); process.exit(0); });
"
```

> **Note:** If the above fails because TypeScript source is not compiled, run `npm run build` first (step 7.3) and then re-run using the compiled output, or simply start the app — it self-initializes on first request.

Verify the database file was created:

```bash
ls -lh /var/www/habibazar/web/data/habibazar.db
# Should show a non-zero .db file
```

Default super-admin credentials created by the seed:
- Email: `admin@habibazar.com`
- Password: `HBZ@Admin2025!`

**Change the password immediately** after first login at `https://habibazar.ir/admin/settings`.

### 7.3 Build Next.js

```bash
cd /var/www/habibazar/web
npm run build
```

This runs `next build` and produces the `.next/` output directory. Expect this to take 1–3 minutes on first build. The build statically generates 62 pages covering all FA/EN routes and the admin panel.

Verify:

```bash
ls .next/
# Should contain: server/, static/, BUILD_ID, etc.
```

### 7.4 Ensure SQLite data directory is writable

```bash
chmod 750 /var/www/habibazar/web/data
chmod 640 /var/www/habibazar/web/data/habibazar.db
```

PM2 runs as the `deploy` user, so ownership should already be correct. If PM2 runs as a different user, adjust accordingly.

---

## 8. PM2 Start

### 8.1 Copy ecosystem config

```bash
cp /path/to/habibazar-deploy/ecosystem.config.js /var/www/habibazar/ecosystem.config.js
```

### 8.2 Start all apps

```bash
cd /var/www/habibazar
pm2 start ecosystem.config.js --env production
```

### 8.3 Verify processes are running

```bash
pm2 list
# Both habibazar-web and habibazar-api should show status: online

pm2 logs --lines 50
# Check for any startup errors
```

Quick local health checks:

```bash
curl -s http://127.0.0.1:3000/
# Should return HTML (Next.js homepage in Farsi, RTL)

curl -s http://127.0.0.1:4000/health
# Should return JSON health response
```

### 8.4 Save process list and configure startup

```bash
pm2 save

# Generate and enable the systemd startup script
pm2 startup systemd -u deploy --hp /home/deploy
# PM2 will print a command starting with `sudo env PATH=...`
# Copy and run that command exactly as printed
```

Verify:

```bash
sudo systemctl status pm2-deploy
# Should show: active (running)
```

---

## 9. Nginx Setup

### 9.1 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 9.2 Copy the Nginx configuration

```bash
sudo cp /path/to/habibazar-deploy/nginx.conf /etc/nginx/conf.d/habibazar.conf
```

Remove the default site if present:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/conf.d/default.conf
```

### 9.3 Verify the main nginx.conf includes conf.d

Check that `/etc/nginx/nginx.conf` contains:

```bash
grep -n "conf.d" /etc/nginx/nginx.conf
# Should show: include /etc/nginx/conf.d/*.conf;
```

If it does not, add it inside the `http {}` block.

### 9.4 Create placeholder certificates for syntax test

Before real SSL certs exist, the nginx config references certificate paths that do not yet exist. Create self-signed placeholders so `nginx -t` can pass:

```bash
sudo mkdir -p /etc/letsencrypt/live/{habibazar.ir,api.habibazar.ir}

for domain in habibazar.ir api.habibazar.ir; do
    sudo openssl req -x509 -nodes -newkey rsa:2048 \
        -keyout /etc/letsencrypt/live/$domain/privkey.pem \
        -out    /etc/letsencrypt/live/$domain/fullchain.pem \
        -days   1 \
        -subj   "/CN=$domain"
done
```

### 9.5 Test and reload Nginx

```bash
sudo nginx -t
# nginx: configuration file /etc/nginx/nginx.conf test is successful

sudo systemctl reload nginx
```

> **Warning:** If `nginx -t` reports errors, fix them before reloading. Do not run `nginx -s reload` on a broken config; it will take down the current live traffic.

---

## 10. SSL with Let's Encrypt

### 10.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 10.2 Temporarily set Cloudflare SSL mode to "Full"

In the Cloudflare dashboard: **SSL/TLS → Overview → Full** (not Full strict). This allows Certbot's HTTP-01 challenge to reach the server over HTTP via Cloudflare's proxy.

Alternatively, disable Cloudflare proxying (grey cloud) for all A records temporarily, issue the certificates, then re-enable.

### 10.3 Issue certificates

```bash
sudo certbot --nginx \
    -d habibazar.ir \
    -d www.habibazar.ir \
    --non-interactive \
    --agree-tos \
    --email hosseinhabibazar@gmail.com \
    --redirect

sudo certbot --nginx \
    -d api.habibazar.ir \
    --non-interactive \
    --agree-tos \
    --email hosseinhabibazar@gmail.com \
    --redirect
```

> **Note:** If Certbot modifies nginx.conf sections automatically, review the changes. The habibazar.conf already includes correct redirect and SSL blocks, so Certbot's modifications may be redundant and can be reverted after certificates are in place.

### 10.4 Verify auto-renewal

```bash
sudo certbot renew --dry-run
# Should show: Congratulations, all simulated renewals succeeded
```

Certbot installs a systemd timer automatically:

```bash
sudo systemctl status certbot.timer
# Should show: active (waiting)
```

### 10.5 Switch Cloudflare back to Full (strict)

In the Cloudflare dashboard: **SSL/TLS → Overview → Full (strict)**.

### 10.6 Final Nginx reload

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 11. Cloudflare Configuration

### 11.1 DNS records

Confirm all A records are proxied (orange cloud):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | habibazar.ir | `<server-ip>` | Proxied |
| A | www | `<server-ip>` | Proxied |
| A | api | `<server-ip>` | Proxied |

### 11.2 SSL/TLS settings

Navigate to **SSL/TLS → Overview**:
- Mode: **Full (strict)**

Navigate to **SSL/TLS → Edge Certificates**:
- Always Use HTTPS: **On**
- HSTS: **Enabled**, Max Age: 6 months, Include subdomains: **On**, Preload: **On**
- Minimum TLS Version: **TLS 1.2**
- Opportunistic Encryption: **On**
- TLS 1.3: **On**
- Automatic HTTPS Rewrites: **On**

### 11.3 Speed settings

Navigate to **Speed → Optimization**:
- Brotli: **On**
- Rocket Loader: **Off** (can break Next.js hydration — leave off)
- Minify (HTML/CSS/JS): **Off** (Next.js already minifies)
- Early Hints: **On**

### 11.4 Cache rules

Navigate to **Caching → Cache Rules** and create:

**Rule 1: Cache Next.js static assets at edge**
- Match: `(http.host contains "habibazar.ir") and (http.request.uri.path contains "/_next/static/")`
- Cache Level: Cache Everything
- Edge TTL: 1 year
- Browser TTL: 1 year

**Rule 2: Bypass cache for API**
- Match: `http.host eq "api.habibazar.ir"`
- Cache Level: Bypass

**Rule 3: Bypass cache for admin panel**
- Match: `(http.host eq "habibazar.ir") and (http.request.uri.path contains "/admin")`
- Cache Level: Bypass

**Rule 4: Bypass cache for API routes**
- Match: `(http.host eq "habibazar.ir") and (http.request.uri.path contains "/api/")`
- Cache Level: Bypass

### 11.5 WAF rules

Navigate to **Security → WAF → Custom Rules**:

**Rule 1: Block non-Cloudflare direct IP access** (optional, if you want to enforce all traffic goes through CF)
- This is better enforced at the server level with UFW — allow 80/443 only from Cloudflare IPs.

**Rule 2: Rate limit admin login**
- Navigate to **Security → WAF → Rate Limiting Rules**
- Match: `(http.host eq "habibazar.ir") and (http.request.uri.path eq "/api/admin/auth/login")`
- Rate: 5 requests per 60 seconds per IP
- Action: Block for 10 minutes

**Rule 3: Rate limit API**
- Match: `http.host eq "api.habibazar.ir"`
- Rate: 100 requests per 60 seconds per IP
- Action: Block for 1 minute

### 11.6 Bot protection

Navigate to **Security → Bots**:
- Bot Fight Mode: **On**

### 11.7 (Optional) Restrict origin to Cloudflare IPs only

To prevent direct IP access bypassing Cloudflare, allow only Cloudflare IPs on ports 80/443:

```bash
# Fetch current Cloudflare IPv4 list
curl -s https://www.cloudflare.com/ips-v4 | while read cidr; do
    sudo ufw allow from $cidr to any port 80
    sudo ufw allow from $cidr to any port 443
done

# Remove the open 80/443 rules
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp

sudo ufw reload
```

> **Warning:** Do this only after confirming everything works through Cloudflare. You will lose direct HTTPS access to the server.

---

## 12. Smoke Tests

Run these after the full deployment to verify end-to-end functionality. All tests should be run against the public hostnames (via Cloudflare).

### 12.1 Health and readiness endpoints

```bash
# API health
curl -s https://api.habibazar.ir/health
# Expected: {"status":"ok","timestamp":"..."}

# API readiness (includes DB connection check)
curl -s https://api.habibazar.ir/ready
# Expected: {"status":"ready","db":"connected"}

# Web homepage (Farsi, RTL)
curl -sI https://habibazar.ir/ | head -5
# Expected: HTTP/2 200

# Web English version
curl -sI https://habibazar.ir/en | head -5
# Expected: HTTP/2 200

# Admin login page
curl -sI https://habibazar.ir/admin/login | head -5
# Expected: HTTP/2 200

# Admin panel redirect (unauthenticated → login)
curl -sI https://habibazar.ir/admin | head -5
# Expected: HTTP/2 307 → /admin/login
```

### 12.2 Admin panel login

```bash
# Attempt login with seed credentials
curl -s -X POST https://habibazar.ir/api/admin/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@habibazar.com","password":"HBZ@Admin2025!"}' | jq .
# Expected: {"user":{"id":"...","name":"Husein Habibazar","role":"super_admin",...}}
```

### 12.3 Security headers

```bash
curl -sI https://habibazar.ir/ | grep -i "strict-transport\|x-frame\|x-content\|content-security"
# Expected: HSTS, X-Content-Type-Options, Content-Security-Policy

curl -sI https://habibazar.ir/admin/login | grep -i "x-frame\|x-robots"
# Expected: X-Frame-Options: DENY, X-Robots-Tag: noindex (admin pages are noindex)

curl -sI https://habibazar.ir/_next/static/chunks/main.js 2>/dev/null | grep -i "cache-control"
# Expected: cache-control: public, max-age=31536000, immutable
```

### 12.4 HTTPS redirect

```bash
curl -sI http://habibazar.ir/ | grep -i location
# Expected: Location: https://habibazar.ir/

curl -sI http://www.habibazar.ir/ | grep -i location
# Expected: Location: https://www.habibazar.ir/ (then https://habibazar.ir/)
```

### 12.5 i18n routing

```bash
# Default locale (fa) served at /
curl -sI https://habibazar.ir/ | grep -i "content-language\|lang"

# English locale
curl -s https://habibazar.ir/en | grep -o 'lang="en"'
# Expected: lang="en"

# Farsi redirect from /fa → /
curl -sI https://habibazar.ir/fa | grep location
# Expected: location: /
```

### 12.6 Lead submission (API)

```bash
curl -s -X POST https://api.habibazar.ir/api/v1/leads \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Lead","email":"test@example.com","source":"WEBSITE"}' | jq .
# Expected: {"id":"...","status":"NEW",...}
```

### 12.7 AI assistant SSE stream

```bash
# Start a conversation
curl -s -X POST https://api.habibazar.ir/api/v1/ai/conversations \
    -H "Content-Type: application/json" \
    -d '{"locale":"FA"}' | jq .

# Stream a message (replace CONVERSATION_ID)
curl -N -s https://api.habibazar.ir/api/v1/ai/conversations/CONVERSATION_ID/stream \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"message":"سلام"}' &

sleep 5
kill %1
# Expected: one or more `data:` SSE lines printed to stdout
```

If the SSE test hangs or returns 504, check that `proxy_buffering off` and `proxy_read_timeout 300s` are active in the nginx config for the `/api/v1/ai/` location.

---

## 13. Monitoring Setup

### 13.1 PM2 log rotation

```bash
pm2 install pm2-logrotate

pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:workerInterval 3600
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

### 13.2 PM2 monitoring dashboard

```bash
pm2 monit
# Press Ctrl+C to exit
```

### 13.3 External uptime monitoring

Set up an uptime monitor (Uptime Robot, BetterStack, or similar) for:

| URL | Check interval | Alert channel |
|-----|----------------|---------------|
| `https://habibazar.ir/` | 1 minute | Email / Telegram |
| `https://api.habibazar.ir/health` | 1 minute | Email / Telegram |
| `https://habibazar.ir/admin/login` | 5 minutes | Email |

### 13.4 Disk and memory alerts

Install a lightweight system monitor:

```bash
sudo apt install -y sysstat

# Configure daily reporting
sudo systemctl enable --now sysstat
```

Add a cron entry to alert on low disk space:

```bash
crontab -e
```

Add:

```cron
# Alert if disk usage exceeds 80%
*/15 * * * * df -h / | awk 'NR==2 {if (int($5) > 80) print "DISK ALERT: " $5 " used on " HOSTNAME}' | mail -s "Disk Alert" hosseinhabibazar@gmail.com 2>/dev/null || true
```

### 13.5 SQLite database size monitoring

The web app SQLite file grows as content, blog posts, analytics events, and audit logs accumulate. Monitor its size:

```bash
# Add to crontab
0 * * * * du -sh /var/www/habibazar/web/data/habibazar.db >> /var/log/habibazar-db-size.log
```

If it exceeds a few hundred MB, consider periodically purging `analytics_events` and `audit_logs` older than 90 days:

```bash
sqlite3 /var/www/habibazar/web/data/habibazar.db \
    "DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days');
     DELETE FROM audit_logs WHERE created_at < datetime('now', '-90 days');
     VACUUM;"
```

### 13.6 Cloudflare Analytics

In the Cloudflare dashboard:
- **Analytics → Traffic** — monitor requests, bandwidth, threats
- **Analytics → Performance** — monitor cache hit rate (target > 80% for static assets)
- **Analytics → Security** — review bot and threat activity

---

## 14. Backup Configuration

### 14.1 PostgreSQL backup (API database)

#### Verify Cloudflare R2 credentials

Ensure the API `.env` contains correct R2 values:

```env
R2_BUCKET=habibazar-backups
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>
BACKUP_RETENTION_DAYS=30
```

Test R2 connectivity:

```bash
# Install AWS CLI v2
curl -sS "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp/
sudo /tmp/aws/install
rm -rf /tmp/aws /tmp/awscliv2.zip

# Configure with R2 credentials
aws configure --profile r2
# AWS Access Key ID: <r2-access-key-id>
# AWS Secret Access Key: <r2-secret-access-key>
# Default region name: auto
# Default output format: json

# Test listing the bucket
aws s3 ls s3://habibazar-backups/ \
    --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
    --profile r2
```

#### Create database backup script

```bash
sudo tee /usr/local/bin/backup-habibazar.sh > /dev/null <<'SCRIPT'
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/habibazar"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
DB_NAME="habibazar"
DB_USER="habibazar"
SQLITE_PATH="/var/www/habibazar/web/data/habibazar.db"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
R2_BUCKET="${R2_BUCKET:-habibazar-backups}"
R2_ENDPOINT="${R2_ENDPOINT:-}"

mkdir -p "$BACKUP_DIR"

# ── PostgreSQL dump (API database) ─────────────────────────────────────────
PG_DUMP="$BACKUP_DIR/${DB_NAME}_pg_${DATE}.dump"
pg_dump -U "$DB_USER" -Fc "$DB_NAME" -f "$PG_DUMP"
gzip "$PG_DUMP"

# ── SQLite dump (web admin database) ───────────────────────────────────────
SQLITE_DUMP="$BACKUP_DIR/${DB_NAME}_sqlite_${DATE}.db"
sqlite3 "$SQLITE_PATH" ".backup '$SQLITE_DUMP'"
gzip "$SQLITE_DUMP"

# ── Upload both to R2 ───────────────────────────────────────────────────────
if [[ -n "$R2_ENDPOINT" ]]; then
    aws s3 cp "${PG_DUMP}.gz" \
        "s3://${R2_BUCKET}/pg/${DB_NAME}_${DATE}.dump.gz" \
        --endpoint-url "$R2_ENDPOINT" --profile r2
    aws s3 cp "${SQLITE_DUMP}.gz" \
        "s3://${R2_BUCKET}/sqlite/${DB_NAME}_${DATE}.db.gz" \
        --endpoint-url "$R2_ENDPOINT" --profile r2
    echo "Uploaded both backups to R2"
fi

# ── Remove old local backups ────────────────────────────────────────────────
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "*.db.gz"   -mtime +"$RETENTION_DAYS" -delete

echo "Backup completed: $DATE"
SCRIPT

sudo chmod +x /usr/local/bin/backup-habibazar.sh
```

#### Schedule daily backups

```bash
crontab -e
```

Add:

```cron
# Daily backup at 03:00 UTC
0 3 * * * /usr/local/bin/backup-habibazar.sh >> /var/log/habibazar-backup.log 2>&1
```

#### Test the backup

```bash
sudo -u deploy /usr/local/bin/backup-habibazar.sh
ls -lh /var/backups/habibazar/
```

### 14.2 Verify backup integrity

Periodically verify backups are restorable:

```bash
# PostgreSQL restore test
sudo -u postgres createdb habibazar_restore_test
pg_restore -U habibazar -d habibazar_restore_test /var/backups/habibazar/habibazar_pg_LATEST.dump.gz
sudo -u postgres dropdb habibazar_restore_test

# SQLite restore test
gunzip -c /var/backups/habibazar/habibazar_sqlite_LATEST.db.gz > /tmp/test_restore.db
sqlite3 /tmp/test_restore.db "SELECT COUNT(*) FROM users;"
rm /tmp/test_restore.db
```

---

## 15. Updates (Zero-Downtime)

Use this procedure for routine code updates to either the API or the web app. PM2 cluster mode for the API enables rolling restarts; the web app uses fork mode (brief restart).

### 15.1 Pull latest code

```bash
cd /var/www/habibazar/api
git pull origin main

cd /var/www/habibazar/web
git pull origin main
```

### 15.2 Update API

```bash
cd /var/www/habibazar/api

# Install any new dependencies
npm install --omit=dev

# Apply any new database migrations
npx prisma migrate deploy

# Regenerate Prisma client if schema changed
npx prisma generate

# Rebuild TypeScript
npm run build

# Reload API with zero-downtime rolling restart (cluster mode)
pm2 reload habibazar-api --update-env

# Verify
pm2 list
curl -s http://127.0.0.1:4000/health
```

### 15.3 Update Web

```bash
cd /var/www/habibazar/web

# Install any new dependencies
npm install --omit=dev

# Rebuild Next.js (also runs SQLite migrations on first request after restart)
npm run build

# Restart web process (brief downtime ~1-2s; Nginx serves 502 during restart)
pm2 restart habibazar-web --update-env

# Verify
pm2 list
curl -s http://127.0.0.1:3000/
```

> **Note:** If the update includes SQLite schema changes (new columns or tables in `src/lib/db/migrate.ts`), the migration runs automatically on the first request after restart. No manual step is required.

> **Note:** For truly zero-downtime web deployments, consider a blue-green setup with two web instances on different ports and updating the Nginx upstream during deployment. For a personal/small-business site, the ~2 second restart gap is acceptable.

### 15.4 Save updated PM2 state

```bash
pm2 save
```

---

## 16. Rollback

If a deployment introduces a regression, follow these steps to roll back quickly.

### 16.1 Identify the last good commit

```bash
cd /var/www/habibazar/api   # or /web
git log --oneline -10
```

Note the commit hash of the last known-good version.

### 16.2 Revert code

```bash
cd /var/www/habibazar/api
git checkout <LAST_GOOD_COMMIT_HASH>

# Reinstall deps matching the old lockfile state
npm ci --omit=dev

# Rebuild
npm run build

# Reload
pm2 reload habibazar-api --update-env
```

Do the same for the web app if needed.

### 16.3 Rollback database migrations

#### PostgreSQL (API)

Prisma does not support automatic migration rollback. If the new migration made breaking changes:

```bash
# Drop and recreate the database (ALL DATA LOST — use only if backup is recent)
sudo -u postgres psql -c "DROP DATABASE habibazar;"
sudo -u postgres psql -c "CREATE DATABASE habibazar OWNER habibazar;"
sudo -u postgres psql -d habibazar -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Restore from backup
pg_restore -U habibazar -d habibazar /var/backups/habibazar/habibazar_pg_BACKUP_BEFORE_UPDATE.dump.gz
```

> **Warning:** This is destructive. Any data written between the backup and the rollback will be lost. Always take a backup immediately before deploying migrations:
>
> ```bash
> /usr/local/bin/backup-habibazar.sh
> ```

#### SQLite (Web)

To roll back the SQLite database:

```bash
# Stop the web process
pm2 stop habibazar-web

# Restore from backup
gunzip -c /var/backups/habibazar/habibazar_sqlite_BACKUP_BEFORE_UPDATE.db.gz \
    > /var/www/habibazar/web/data/habibazar.db

# Restart
pm2 start habibazar-web
```

### 16.4 Verify rollback

```bash
pm2 list
curl -s https://api.habibazar.ir/health
curl -sI https://habibazar.ir/ | head -3
```

If everything looks good, notify stakeholders and investigate the root cause before re-deploying.

---

## Appendix: Quick Reference

### PM2 commands

```bash
pm2 list                          # Show all processes
pm2 logs habibazar-api            # Tail API logs
pm2 logs habibazar-web            # Tail web logs
pm2 monit                         # Real-time dashboard
pm2 reload habibazar-api          # Zero-downtime reload (cluster)
pm2 restart habibazar-web         # Restart web (brief downtime)
pm2 stop all                      # Stop all processes
pm2 start ecosystem.config.js --env production  # Start from config
```

### Nginx commands

```bash
sudo nginx -t                     # Test configuration
sudo systemctl reload nginx       # Reload config (no downtime)
sudo systemctl restart nginx      # Full restart
sudo tail -f /var/log/nginx/error.log   # Watch error log
sudo tail -f /var/log/nginx/access.log  # Watch access log
```

### PostgreSQL commands

```bash
sudo -u postgres psql -d habibazar        # Enter psql as postgres
psql $DATABASE_URL                        # Connect with env var
sudo systemctl restart postgresql         # Restart DB
sudo tail -f /var/log/postgresql/postgresql-16-main.log  # DB logs
```

### SQLite commands (web admin database)

```bash
# Open interactive shell
sqlite3 /var/www/habibazar/web/data/habibazar.db

# Useful queries
.tables                                   # List all tables
SELECT * FROM users;                      # List admin users
SELECT COUNT(*) FROM analytics_events;    # Event count
SELECT COUNT(*) FROM audit_logs;          # Audit log count

# Manual backup
sqlite3 /var/www/habibazar/web/data/habibazar.db ".backup '/tmp/manual_backup.db'"
```

### Certbot commands

```bash
sudo certbot renew --dry-run              # Test renewal
sudo certbot certificates                 # Show cert status
sudo certbot renew --force-renewal        # Force renew all
```

### Service status summary

```bash
sudo systemctl status nginx postgresql pm2-deploy
```

### Admin panel

| Item | Value |
|------|-------|
| URL | `https://habibazar.ir/admin` |
| Login | `https://habibazar.ir/admin/login` |
| Default email | `admin@habibazar.com` |
| Default password | `HBZ@Admin2025!` ← **change on first login** |
| JWT secret env var | `ADMIN_JWT_SECRET` in `.env.local` |
| SQLite path | `/var/www/habibazar/web/data/habibazar.db` |
