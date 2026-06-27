# Habibazar Platform — راهنمای Deploy

پلتفرم شامل ۳ اپلیکیشن است که روی یک سرور اجرا می‌شوند:

| اپ | پورت | توضیح |
|----|------|--------|
| **habibazar-web** | 3000 | Next.js 15 — سایت اصلی (فارسی/انگلیسی) |
| **habibazar-admin** | 3001 | Next.js 15 — پنل مدیریت |
| **habibazar-api** | 4000 | Express + Prisma + PostgreSQL |

**زیرساخت:** Ubuntu 24.04 · Node 22 · PostgreSQL 16 + pgvector · PM2 · Nginx · Cloudflare

---

## روش سریع (خودکار)

برای اولین نصب:
```bash
# ۱. محیط را آماده کن (§ مرحله ۱–۴ زیر)
# ۲. فایل‌های .env را بساز (§ مرحله ۵)
# ۳. اسکریپت را اجرا کن:
chmod +x deploy.sh
./deploy.sh
```

برای به‌روزرسانی بعدی:
```bash
./update.sh          # همه اپ‌ها
./update.sh api      # فقط API
./update.sh web      # فقط Web
./update.sh admin    # فقط Admin
```

---

## مرحله ۱ — پیش‌نیازهای سرور

### سیستم‌عامل و پکیج‌ها
```bash
apt update && apt upgrade -y
apt install -y curl wget git build-essential ca-certificates gnupg ufw \
               nginx postgresql postgresql-contrib
```

### فایروال
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### یوزر deploy
```bash
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# از این به بعد با یوزر deploy کار کن
su - deploy
```

### ساختار دایرکتوری
```bash
sudo mkdir -p /var/www/habibazar/{web,admin,api} /var/log/pm2 /var/www/certbot/.well-known/acme-challenge
sudo chown -R deploy:deploy /var/www/habibazar /var/log/pm2
```

---

## مرحله ۲ — Node.js و PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version    # v22.x.x

sudo npm install -g pm2
```

---

## مرحله ۳ — PostgreSQL

### نصب pgvector
```bash
sudo apt install -y postgresql-16-pgvector
# اگر موجود نبود از سورس بساز:
# sudo apt install -y postgresql-server-dev-16
# git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector
# cd /tmp/pgvector && make && sudo make install
```

### ساخت دیتابیس
```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE habibazar WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE habibazar OWNER habibazar;
GRANT ALL PRIVILEGES ON DATABASE habibazar TO habibazar;
SQL

# مهم: extension رو قبل از prisma db push بساز
sudo -u postgres psql -d habibazar -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

> ⚠️ `pgvector` باید **قبل** از `prisma db push` به عنوان superuser ساخته شود، چون یوزر `habibazar` دسترسی ندارد.

### تنظیم PostgreSQL (سرور ۴ گیگ RAM)
فایل `/etc/postgresql/16/main/postgresql.conf`:
```conf
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 10485kB
max_connections = 100
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```
```bash
sudo systemctl restart postgresql
```

---

## مرحله ۴ — Clone ریپو

```bash
cd /var/www/habibazar
git clone https://github.com/HuseinHbz/Website.git repo

# لینک دایرکتوری‌ها
ln -s /var/www/habibazar/repo/outputs/habibazar-web   /var/www/habibazar/web
ln -s /var/www/habibazar/repo/outputs/habibazar-admin /var/www/habibazar/admin
ln -s /var/www/habibazar/repo/outputs/habibazar-api   /var/www/habibazar/api

# کپی فایل‌های deploy
cp /var/www/habibazar/repo/outputs/habibazar-deploy/ecosystem.config.js /var/www/habibazar/
```

---

## مرحله ۵ — فایل‌های محیط (.env)

### API (`/var/www/habibazar/api/.env`)

```bash
cat > /var/www/habibazar/api/.env <<'ENV'
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://habibazar:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/habibazar

# JWT — تولید: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
ACCESS_TOKEN_SECRET=<64-char-hex>
REFRESH_TOKEN_SECRET=<64-char-hex>

# کلید AES — باید دقیقاً ۶۴ کاراکتر hex باشد (= 32 بایت)
ENCRYPTION_KEY=<64-char-hex>

ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=2592000

CORS_ORIGINS=https://habibazar.ir,https://admin.habibazar.ir
OWNER_EMAIL=hosseinhabibazar@live.com

# آستانه‌های امتیازدهی لید
SCORE_HOT=70
SCORE_QUALIFIED=45
SCORE_NURTURE_BELOW=20

# هوش مصنوعی: openai | anthropic | deepseek | ollama
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

# SMTP (اختیاری — اگر نباشد ایمیل skip می‌شود)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
MAIL_FROM=noreply@habibazar.ir
MAIL_NOTIFY_TO=hosseinhabibazar@live.com

# R2 / بکاپ (اختیاری)
# R2_BUCKET=habibazar-backups
# R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
ENV

chmod 600 /var/www/habibazar/api/.env
```

**تولید کلیدها:**
```bash
# ACCESS_TOKEN_SECRET و REFRESH_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (دقیقاً ۶۴ کاراکتر hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Web (`/var/www/habibazar/web/.env.local`)

```bash
cat > /var/www/habibazar/web/.env.local <<'ENV'
NEXT_PUBLIC_SITE_URL=https://habibazar.ir
NEXT_PUBLIC_API_URL=https://api.habibazar.ir
ENV
chmod 600 /var/www/habibazar/web/.env.local
```

### Admin (`/var/www/habibazar/admin/.env.local`)

```bash
cat > /var/www/habibazar/admin/.env.local <<'ENV'
NEXT_PUBLIC_API_URL=https://api.habibazar.ir
NEXT_PUBLIC_SITE_URL=https://admin.habibazar.ir
ENV
chmod 600 /var/www/habibazar/admin/.env.local
```

---

## مرحله ۶ — Build و Deploy

### API

```bash
cd /var/www/habibazar/api

# نصب همه dependency‌ها (شامل dev — برای تولید prisma client و build)
npm ci

# تولید Prisma client
npx prisma generate

# اعمال schema روی دیتابیس (اولین بار)
npx prisma db push

# اعمال ایندکس‌های بهینه‌سازی
npm run db:hardening
# db:hardening از --env-file برای لود .env استفاده می‌کند (Node 20.6+)

# Compile TypeScript → dist/
npm run build

ls dist/    # باید server.js وجود داشته باشد
```

> **توجه:** `npx prisma db push` بدون migration directory استفاده می‌شود.  
> در به‌روزرسانی‌های بعدی که migration داری: `npx prisma migrate deploy`

### ساخت role superadmin و اولین کاربر admin

```bash
# ساخت role
psql $DATABASE_URL <<'SQL'
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

# گرفتن ID role
ROLE_ID=$(psql $DATABASE_URL -tAc "SELECT id FROM roles WHERE name='superadmin'" | tr -d ' ')

# ثبت اولین کاربر (API باید در حال اجرا باشد)
curl -X POST http://127.0.0.1:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"hosseinhabibazar@live.com\",\"password\":\"CHANGE_ME\",\"name\":\"Admin\",\"roleId\":\"$ROLE_ID\"}"
```

### Web

```bash
cd /var/www/habibazar/web
npm ci --omit=dev
npm run build
```

### Admin

```bash
cd /var/www/habibazar/admin
npm ci --omit=dev
npm run build
```

---

## مرحله ۷ — PM2

```bash
cd /var/www/habibazar
pm2 start ecosystem.config.js --env production
pm2 list
# habibazar-web   online
# habibazar-admin online
# habibazar-api   online (2 instances)

# بررسی log
pm2 logs --lines 50

# تست سریع
curl -s http://127.0.0.1:4000/health   # {"status":"ok"}
curl -s http://127.0.0.1:4000/ready    # {"status":"ready","db":"connected"}
curl -sI http://127.0.0.1:3000/        # 200 OK
curl -sI http://127.0.0.1:3001/        # 200 OK

# ذخیره و autostart
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
# دستور sudo را که چاپ می‌کند اجرا کن
```

---

## مرحله ۸ — Nginx

```bash
sudo cp /var/www/habibazar/repo/outputs/habibazar-deploy/nginx.conf \
        /etc/nginx/conf.d/habibazar.conf

sudo rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
```

### گواهی موقت (تا قبل از Certbot)

```bash
for domain in habibazar.ir admin.habibazar.ir api.habibazar.ir; do
    sudo mkdir -p /etc/letsencrypt/live/$domain
    sudo openssl req -x509 -nodes -newkey rsa:2048 \
        -keyout /etc/letsencrypt/live/$domain/privkey.pem \
        -out    /etc/letsencrypt/live/$domain/fullchain.pem \
        -days 1 -subj "/CN=$domain"
done

sudo nginx -t && sudo systemctl reload nginx
```

---

## مرحله ۹ — SSL با Let's Encrypt

ابتدا در Cloudflare SSL را روی **Full** (نه strict) تنظیم کن، سپس:

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d habibazar.ir -d www.habibazar.ir \
    --non-interactive --agree-tos --email hosseinhabibazar@gmail.com --redirect

sudo certbot --nginx -d admin.habibazar.ir \
    --non-interactive --agree-tos --email hosseinhabibazar@gmail.com --redirect

sudo certbot --nginx -d api.habibazar.ir \
    --non-interactive --agree-tos --email hosseinhabibazar@gmail.com --redirect

# تأیید تجدید خودکار
sudo certbot renew --dry-run
```

بعد از صدور گواهی، Cloudflare را به **Full (strict)** تغییر بده.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## مرحله ۱۰ — Cloudflare

### DNS (همه Proxied باشند)
| Type | Name | Content |
|------|------|---------|
| A | habibazar.ir | `<IP سرور>` |
| A | www | `<IP سرور>` |
| A | admin | `<IP سرور>` |
| A | api | `<IP سرور>` |

### تنظیمات SSL/TLS
- Mode: **Full (strict)**
- Always HTTPS: **On**
- HSTS: **On** — 6 ماه — Include subdomains — Preload
- Min TLS: **1.2**

### Cache Rules
| Rule | Match | Action |
|------|-------|--------|
| Next.js static | `URI path contains /_next/static/` | Cache Everything — 1 year |
| API bypass | `host = api.habibazar.ir` | Bypass cache |
| Admin bypass | `host = admin.habibazar.ir` | Bypass cache |

### Rate Limiting
| Rule | Match | نرخ | اقدام |
|------|-------|-----|-------|
| Admin login | `host = admin.habibazar.ir AND path contains /login` | 5/60s | Block 10min |
| API general | `host = api.habibazar.ir` | 100/60s | Block 1min |

---

## تست نهایی (Smoke Tests)

```bash
# API
curl -s https://api.habibazar.ir/health
# → {"status":"ok","timestamp":"..."}

curl -s https://api.habibazar.ir/ready
# → {"status":"ready","db":"connected"}

# سایت اصلی
curl -sI https://habibazar.ir/ | head -3
# → HTTP/2 200

# پنل ادمین
curl -sI https://admin.habibazar.ir/ | head -3
# → HTTP/2 200

# ریدایرکت www
curl -sI https://www.habibazar.ir/ | grep -i location
# → Location: https://habibazar.ir/

# هدرهای امنیتی ادمین
curl -sI https://admin.habibazar.ir/ | grep -i "x-frame\|x-robots"
# → X-Frame-Options: DENY
# → X-Robots-Tag: noindex, nofollow

# ارسال لید
curl -s -X POST https://api.habibazar.ir/api/v1/leads \
    -H "Content-Type: application/json" \
    -d '{"name":"تست","email":"test@example.com","source":"WEBSITE"}' | jq .

# تست SSE / دستیار هوش مصنوعی
CONV=$(curl -s -X POST https://api.habibazar.ir/api/v1/ai/start \
    -H "Content-Type: application/json" \
    -d '{"sessionRef":"smoke","locale":"FA"}' | jq -r '.data.id')

curl -N -s -X POST "https://api.habibazar.ir/api/v1/ai/$CONV/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"سلام","locale":"FA"}' &
sleep 5 && kill %1
# باید خطوط data: ... چاپ شود
```

---

## به‌روزرسانی (Zero-Downtime)

```bash
cd /var/www/habibazar/repo/outputs/habibazar-deploy

# همه اپ‌ها
./update.sh

# فقط یک اپ
./update.sh api
./update.sh web
./update.sh admin
```

اسکریپت `update.sh` به صورت خودکار:
- آخرین کد را pull می‌کند
- dependency ها را نصب و build می‌کند
- API را با `pm2 reload` (zero-downtime) ری‌استارت می‌کند
- nginx.conf یا ecosystem.config.js را در صورت تغییر به‌روز می‌کند

---

## بکاپ

```bash
sudo tee /usr/local/bin/backup-habibazar.sh > /dev/null <<'SCRIPT'
#!/bin/bash
set -euo pipefail
BACKUP_DIR="/var/backups/habibazar"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
source /var/www/habibazar/api/.env
mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_DIR/habibazar_${DATE}.dump"
gzip "$BACKUP_DIR/habibazar_${DATE}.dump"
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +30 -delete
echo "Backup done: habibazar_${DATE}.dump.gz"
SCRIPT
sudo chmod +x /usr/local/bin/backup-habibazar.sh

# بکاپ روزانه ساعت ۳ صبح UTC
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/backup-habibazar.sh >> /var/log/habibazar-backup.log 2>&1") | crontab -
```

---

## دستورات سریع

```bash
# PM2
pm2 list
pm2 logs habibazar-api --lines 100
pm2 monit
pm2 reload habibazar-api --update-env      # zero-downtime (API)
pm2 restart habibazar-web --update-env
pm2 restart habibazar-admin --update-env

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log

# PostgreSQL
psql $DATABASE_URL    # در دایرکتوری api، بعد از export کردن متغیر
sudo systemctl restart postgresql

# SSL
sudo certbot renew --dry-run
sudo certbot certificates

# وضعیت سرویس‌ها
sudo systemctl status nginx postgresql pm2-deploy
```

---

## Rollback

### کد
```bash
cd /var/www/habibazar/repo
git log --oneline -10
git reset --hard <COMMIT_HASH>
./deploy.sh    # یا update.sh برای اپ خاص
```

### دیتابیس (آخرین راه)
```bash
sudo -u postgres psql -c "DROP DATABASE habibazar;"
sudo -u postgres psql -c "CREATE DATABASE habibazar OWNER habibazar;"
sudo -u postgres psql -d habibazar -c "CREATE EXTENSION IF NOT EXISTS vector;"
pg_restore -U habibazar -d habibazar /var/backups/habibazar/habibazar_BACKUP.dump.gz
```

---

## عیب‌یابی رایج

| خطا | راه‌حل |
|-----|--------|
| `could not load library "vector"` | `sudo apt install -y postgresql-16-pgvector` |
| `permission denied to create extension` | `sudo -u postgres psql -d habibazar -c "CREATE EXTENSION IF NOT EXISTS vector;"` |
| `role "root" does not exist` | محیط .env لود نشده — از `npm run db:hardening` استفاده کن نه psql مستقیم |
| `deleted_at column does not exist` | hardening.sql باید `"deletedAt"` (camelCase با گیومه) داشته باشد ✓ |
| PM2 شروع نمی‌کند | `pm2 logs --lines 50` — معمولاً مشکل .env یا dist/ است |
| `tsc` خطای enum | `src/lib/enums.ts` از `@prisma/client` re-export می‌کند — `npx prisma generate` را اجرا کن |
