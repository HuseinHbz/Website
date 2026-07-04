# HBZ Website — راهنمای استقرار

## ساختار فایل‌ها

```
Website/
├── outputs/habibazar-web/   ← کد Next.js (سایت + پنل ادمین)
│   ├── data/habibazar.db    ← دیتابیس SQLite (auto-created)
│   ├── public/uploads/      ← فایل‌های آپلود شده
│   └── .env.local           ← متغیرهای محیطی (باید ساخته شود)
└── deploy/
    ├── install.sh           ← نصب اولیه
    ├── update.sh            ← آپدیت zero-downtime
    ├── backup.sh            ← بکاپ دیتابیس و فایل‌ها
    ├── health-check.sh      ← بررسی سلامت سرویس
    └── .env.example         ← نمونه متغیرهای محیطی
```

---

## پیش‌نیازها

- Ubuntu 22.04 LTS
- دسترسی root / sudo
- دامنه با DNS به سرور اشاره‌کرده

---

## نصب اولیه

### مرحله ۱ — clone مخزن

```bash
git clone https://github.com/HuseinHbz/Website.git /var/www/habibazar
cd /var/www/habibazar
```

### مرحله ۲ — اجرای اسکریپت نصب

```bash
sudo bash deploy/install.sh
```

اسکریپت به‌صورت خودکار:
1. Node.js 20 و PM2 نصب می‌کند
2. کاربر سیستمی `hbz` می‌سازد
3. فایل `.env.local` با کلید تصادفی می‌سازد
4. `npm ci` و `npm run build` اجرا می‌کند
5. PM2 را راه‌اندازی کرده و به startup اضافه می‌کند
6. Nginx را پیکربندی می‌کند

### مرحله ۳ — تنظیم `.env.local`

```bash
nano /var/www/habibazar/outputs/habibazar-web/.env.local
```

```env
ADMIN_JWT_SECRET=<openssl rand -hex 32>
NEXT_PUBLIC_SITE_URL=https://habibazar.ir
NEXT_PUBLIC_API_URL=https://habibazar.ir
LOG_LEVEL=info
NODE_ENV=production
```

بعد از تغییر env، rebuild:
```bash
cd /var/www/habibazar/outputs/habibazar-web
sudo -u hbz npm run build
pm2 reload habibazar
```

### مرحله ۴ — فعال‌سازی HTTPS

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d habibazar.ir -d www.habibazar.ir
```

---

## متغیرهای محیطی

| متغیر | اجباری | پیش‌فرض | توضیح |
|---|---|---|---|
| `ADMIN_JWT_SECRET` | **بله** | — | حداقل ۳۲ کاراکتر: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | **بله** | — | آدرس سایت: `https://habibazar.ir` |
| `NEXT_PUBLIC_API_URL` | **بله** | — | آدرس API (معمولاً همان سایت) |
| `DB_PATH` | خیر | `data/habibazar.db` | مسیر دیتابیس SQLite |
| `LOG_LEVEL` | خیر | `info` | `error | warn | info | debug` |
| `NODE_ENV` | خیر | `production` | محیط اجرا |

---

## آپدیت

```bash
cd /var/www/habibazar
sudo bash deploy/update.sh
```

**آپدیت از branch خاص:**
```bash
sudo bash deploy/update.sh --branch hbz
```

**فقط restart بدون build:**
```bash
sudo bash deploy/update.sh --skip-build
```

اسکریپت update:
1. `git pull` از branch مشخص
2. snapshot از `.next` برای rollback می‌گیرد
3. فقط اگر `package.json` تغییر کرده، `npm ci` اجرا می‌کند
4. `npm run build`
5. `pm2 reload` (zero-downtime)
6. health check — در صورت شکست، rollback اتوماتیک

---

## Rollback دستی

```bash
cd /var/www/habibazar/outputs/habibazar-web

# برگشت به snapshot build
mv .next .next.failed
mv .next.bak .next
pm2 reload habibazar

# برگشت به commit خاص
git -C /var/www/habibazar reset --hard <commit-hash>
npm run build
pm2 reload habibazar
```

---

## بکاپ

**بکاپ دستی:**
```bash
sudo bash /var/www/habibazar/deploy/backup.sh
```

**بکاپ خودکار (cron):**
```bash
crontab -e
# هر روز ساعت ۳ صبح:
0 3 * * * root bash /var/www/habibazar/deploy/backup.sh >> /var/log/hbz-backup.log 2>&1
```

بکاپ‌ها در `/var/backups/habibazar/YYYYMMDD_HHMMSS/` ذخیره می‌شوند:
- `habibazar.db` — دیتابیس
- `uploads.tar.gz` — فایل‌های آپلود
- `.env.local.bak` — تنظیمات

بکاپ‌های قدیمی‌تر از ۱۴ روز به‌صورت خودکار پاک می‌شوند.

---

## مهاجرت به PostgreSQL (اختیاری)

پلتفرم به‌صورت پیش‌فرض روی **SQLite** اجرا می‌شود. برای مهاجرت لایهٔ داده به
**PostgreSQL 17**، مجموعه اسکریپت‌های `deploy/postgres/` آماده است (Debian 12 /
Ubuntu 24.04):

```bash
# ۱) نصب PostgreSQL 17 + اکستنشن‌ها (DATABASE_URL در /root/.habibazar-pg-dsn نوشته می‌شود)
sudo deploy/postgres/install-postgresql.sh

# ۲) بکاپ SQLite + مهاجرت داده + اعتبارسنجی تطابق (row-count + checksum)
sudo deploy/postgres/sqlite-to-postgresql.sh

# ۳) بررسی روی PostgreSQL زنده
DATABASE_URL="$(cat /root/.habibazar-pg-dsn)" deploy/postgres/verify-postgresql.sh

# rollback به SQLite در صورت نیاز
sudo deploy/postgres/rollback-to-sqlite.sh
```

> **وضعیت:** مهاجرت **کامل** شد — runtime برنامه اکنون **کاملاً روی PostgreSQL**
> اجرا می‌شود (درایور async `pg` با Drizzle `pg-core`)؛ `npm run audit:pgcompat`
> برابر صفر و به‌صورت end-to-end تأیید شد. `better-sqlite3` فقط به‌عنوان
> devDependency برای ابزار یک‌بارهٔ مهاجرت باقی مانده است. جزئیات:
> `deploy/postgres/README.md` و
> `outputs/habibazar-web/docs/governance/phase20-postgres-migration.md`.

---

## Health Check

```bash
# بررسی local
bash /var/www/habibazar/deploy/health-check.sh

# بررسی سرور تولید
bash /var/www/habibazar/deploy/health-check.sh https://habibazar.ir

# مستقیم با curl
curl https://habibazar.ir/api/health
```

پاسخ موفق:
```json
{"status":"ok","ts":"2026-07-01T12:00:00.000Z","env":"production"}
```

**بررسی خودکار هر ۵ دقیقه:**
```bash
*/5 * * * * root bash /var/www/habibazar/deploy/health-check.sh >> /var/log/hbz-health.log 2>&1
```

---

## دستورات PM2

```bash
pm2 status                      # وضعیت همه سرویس‌ها
pm2 logs habibazar              # لاگ زنده
pm2 logs habibazar --lines 100  # ۱۰۰ خط آخر لاگ
pm2 reload habibazar            # reload بدون downtime
pm2 restart habibazar           # restart کامل
pm2 monit                       # مانیتور real-time
pm2 flush                       # پاکسازی لاگ‌ها
```

---

## پیکربندی Nginx (HTTPS)

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

    client_max_body_size 50M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location /_next/static/ {
        alias /var/www/habibazar/outputs/habibazar-web/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        alias /var/www/habibazar/outputs/habibazar-web/public/uploads/;
        expires 7d;
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
        proxy_read_timeout 60s;
    }
}
```

---

## عیب‌یابی

| مشکل | راه‌حل |
|---|---|
| سایت باز نمی‌شود | `pm2 status` سپس `pm2 logs habibazar` |
| خطای ۵۰۲ | سرویس down است: `pm2 restart habibazar` |
| build ناموفق | `cat /var/log/habibazar-error.log` |
| دیتابیس مشکل دارد | `sqlite3 data/habibazar.db ".tables"` |
| فضا پر شده | `df -h` → `pm2 flush` برای پاکسازی لاگ |
