# HBZ Platform — Deployment Guide

## Prerequisites

- Ubuntu 22.04 LTS
- Node.js 20 LTS (`nvm install 20`)
- PM2 (`npm install -g pm2`)
- Nginx
- SQLite3 (`apt install sqlite3`)
- Git

---

## Fresh Installation

```bash
# 1. Clone repo
git clone https://github.com/HuseinHbz/Website.git /var/www/habibazar-repo
cd /var/www/habibazar-repo

# 2. Checkout production branch
git checkout hbz

# 3. Configure environment
cp outputs/habibazar-web/.env.example outputs/habibazar-web/.env.local
nano outputs/habibazar-web/.env.local
# Required: ADMIN_JWT_SECRET (generate: openssl rand -base64 48)

# 4. Deploy
cd outputs/habibazar-deploy
chmod +x deploy.sh update.sh backup.sh health-check.sh
./deploy.sh
```

The `deploy.sh` script:
1. Installs npm dependencies
2. Runs `next build`
3. Starts the app via PM2
4. Runs health checks (3 attempts)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_JWT_SECRET` | **Yes** | Min 32 chars; generate with `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | Yes | e.g. `https://habibazar.ir` |
| `NEXT_PUBLIC_API_URL` | Yes | e.g. `https://api.habibazar.ir` |
| `SMTP_HOST` | For email | SMTP server hostname |
| `SMTP_PORT` | For email | Default: 587 |
| `SMTP_USER` | For email | |
| `SMTP_PASS` | For email | |
| `CONTACT_EMAIL` | For email | Recipient for contact forms |
| `DB_PATH` | No | Default: `./habibazar.db` |
| `LOG_LEVEL` | No | `debug/info/warn/error` (default: `info`) |
| `APP_VERSION` | No | Displayed in health check |

---

## Updating (Zero-Downtime)

```bash
cd /var/www/habibazar-repo/outputs/habibazar-deploy
./update.sh
# Or specify a branch:
./update.sh feature/v2-enterprise-upgrade
```

The `update.sh` script:
1. Pulls latest code from the target branch
2. Creates a `.next.bak` snapshot for rollback
3. Installs dependencies
4. Builds the app
5. Performs PM2 graceful reload (zero downtime)
6. Runs 3 health checks
7. Removes snapshot on success (or restores it on failure)

---

## Manual Rollback

```bash
cd /var/www/habibazar-repo/outputs/habibazar-web

# Option 1: Restore build snapshot (if update.sh created one)
mv .next .next.failed && mv .next.bak .next
pm2 reload habibazar

# Option 2: Restore from backup
cd /var/www/habibazar-repo/outputs/habibazar-deploy
# Replace DB:
sqlite3 habibazar.db ".restore '/var/backups/habibazar/YYYYMMDD_HHMMSS/habibazar_*.db'"
pm2 restart habibazar
```

---

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name habibazar.ir www.habibazar.ir;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name habibazar.ir www.habibazar.ir;

    ssl_certificate     /etc/letsencrypt/live/habibazar.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/habibazar.ir/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location /_next/static/ {
        alias /var/www/habibazar-repo/outputs/habibazar-web/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Backup Schedule (cron)

```bash
# Daily backup at 3:00 AM
0 3 * * * /var/www/habibazar-repo/outputs/habibazar-deploy/backup.sh >> /var/log/hbz-backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * /var/www/habibazar-repo/outputs/habibazar-deploy/health-check.sh >> /var/log/hbz-health.log 2>&1
```

---

## Health Check

```bash
# Quick check
curl https://habibazar.ir/api/health

# Detailed check
curl "https://habibazar.ir/api/health?detail=1"

# Using the script
./health-check.sh https://habibazar.ir
```

Expected response:
```json
{
  "status": "ok",
  "ts": "2026-07-01T12:00:00.000Z",
  "version": "2.0.0",
  "uptime": 86400,
  "env": "production"
}
```

---

## PM2 Commands

```bash
pm2 status              # View all processes
pm2 logs habibazar      # Live logs
pm2 monit               # Real-time monitoring
pm2 reload habibazar    # Zero-downtime reload
pm2 restart habibazar   # Hard restart
pm2 save                # Save process list (survives reboot)
pm2 startup             # Generate startup script
```
