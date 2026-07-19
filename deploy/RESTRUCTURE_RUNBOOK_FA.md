# مهاجرت flatten (فاز 26.26d) — راهنمای اجرای امن روی سرور

ساختار ریپو عوض شد: اپ دیگر داخل `outputs/habibazar-web/` نیست و **ریشهٔ ریپو = ریشهٔ اپ** است.
این راهنما سرور زنده را بدون از‌دست‌دادن داده به ساختار جدید می‌برد. **گام‌ها را به ترتیب و کامل اجرا کنید.**

> ⚠️ nginx را دست نزنید. کانفیگ nginx فقط `proxy_pass` به پورت 3000 است و فایل‌های
> `/uploads/` را خود Next سرو می‌کند (`src/app/uploads/[...path]/route.ts`) — هیچ مسیر
> فایل‌سیستمی در nginx به ساختار قدیمی وابسته نیست (مگر خودتان alias دستی اضافه کرده
> باشید — اول `grep -r habibazar /etc/nginx/sites-enabled/` بگیرید).

## گام ۰ — حل ابهام دو کلون (قبل از هر چیز)

روی این سرور **دو** کلون وجود دارد:

```bash
ls -la /var/www/
sudo -u hbz pm2 describe habibazar | grep -E 'cwd|script'
```

- `/var/www/habibazar` → کلونی که **PM2 واقعاً سرو می‌کند** (cwd پروسه اینجاست). مهاجرت روی **همین** انجام می‌شود.
- `/var/www/Website` → کلون دوم/کهنه که فقط برای اجرای دستی اسکریپت‌های deploy استفاده می‌شد.
  بعد از این مهاجرت دیگر لازم نیست — یا حذفش کنید یا دست‌نخورده رها کنید، ولی **دیگر از آن deploy نکنید**
  (دو منبع حقیقت = همان آشوبی که این فاز حذف کرد).

اگر خروجی `pm2 describe` cwd دیگری نشان داد، مهاجرت را روی همان مسیر انجام دهید و مسیرها را در گام‌های بعد جایگزین کنید.

## گام ۱ — بکاپ کامل

```bash
cd /var/www/habibazar
# بکاپ DB (اگر backup.sh به خاطر کلید خطا داد، pg_dump مستقیم):
export $(grep -E '^DATABASE_URL=' outputs/habibazar-web/.env.local | xargs)
pg_dump "$DATABASE_URL" -Fc -f /root/pre-flatten-$(date +%F).dump
# بکاپ کل درخت اپ (شامل uploads و .env.local):
tar -czf /root/pre-flatten-tree-$(date +%F).tar.gz -C /var/www habibazar
```

هر دو فایل باید حجم غیرصفر داشته باشند — با `ls -lh /root/pre-flatten-*` تأیید کنید.

## گام ۲ — 🔴 نگه‌داشتن `.env.local`

این فایل در گیت نیست و با pull/reset برنمی‌گردد:

```bash
cp /var/www/habibazar/outputs/habibazar-web/.env.local /root/env.local.keep
```

## گام ۳ — 🔴 نگه‌داشتن `public/uploads/`

فایل‌های واقعی کاربران؛ در گیت نیستند:

```bash
cp -a /var/www/habibazar/outputs/habibazar-web/public/uploads /root/uploads.keep
```

## گام ۴ — آوردن ساختار جدید

```bash
cd /var/www/habibazar
git fetch origin feature/v2-enterprise-upgrade
git reset --hard origin/feature/v2-enterprise-upgrade
```

بعد از این، `package.json` باید در ریشه باشد: `ls package.json src deploy docs`.

## گام ۵ — برگرداندن `.env.local` و uploads به مسیر جدید (ریشه)

```bash
cp /root/env.local.keep /var/www/habibazar/.env.local
mkdir -p /var/www/habibazar/public/uploads
cp -a /root/uploads.keep/. /var/www/habibazar/public/uploads/
chown -R hbz:hbz /var/www/habibazar
```

## گام ۶ — پاک‌سازی بازمانده‌های ساختار قدیمی

```bash
cd /var/www/habibazar
rm -rf outputs node_modules .next
```

(`outputs/` هنوز node_modules و .next قدیمی را دارد — دیگر به هیچ دردی نمی‌خورند.)

## گام ۷ — نصب و build از ریشه

```bash
cd /var/www/habibazar
sudo -u hbz npm ci
sudo -u hbz npm run build
```

## گام ۸ — 🔴 ری‌استارت با delete+start (نه reload)

cwd پروسهٔ PM2 عوض شده؛ `reload` کانفیگ قدیمی را نگه می‌دارد. اول کانفیگ PM2 را با مسیر
جدید بازسازی کنید، بعد ری‌استارت:

```bash
sudo bash /var/www/habibazar/deploy/fix-pm2.sh
```

(fix-pm2 خودش delete + start + health-check می‌کند و `start.sh`/`pm2.config.js` را با cwd
جدید می‌نویسد. برای ری‌استارت‌های بعدی `deploy/restart.sh` کافی است.)

## گام ۹ — تأیید

```bash
sudo bash /var/www/habibazar/deploy/health-check.sh   # یا: curl -s localhost:3000/api/health
```

و در مرورگر: `/admin` (لاگین)، یک فایل از `/uploads/…` (عکس آپلودشدهٔ قدیمی)، و یک صفحهٔ ERP
(مثلاً `/admin/finance`) را باز کنید.

## گام ۱۰ — طرح بازگشت (اگر چیزی خراب شد)

```bash
sudo -u hbz pm2 delete habibazar || true
cd /var/www && rm -rf habibazar
tar -xzf /root/pre-flatten-tree-*.tar.gz -C /var/www
sudo bash /var/www/habibazar/deploy/fix-pm2.sh   # با درخت قدیمی، fix-pm2 نسخهٔ قدیمی داخل tar را اجرا کنید:
# sudo bash /var/www/habibazar/deploy/fix-pm2.sh  ← نسخهٔ داخل tar هنوز WEB_DIR قدیمی را دارد و همان را می‌سازد
```

DB دست نخورده است (مهاجرت فقط فایل‌سیستم بود)؛ اگر لازم شد: `pg_restore -d "$DATABASE_URL" --clean --if-exists /root/pre-flatten-*.dump`.
