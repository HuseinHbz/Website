# deploy/ — اسکریپت‌های عملیاتی سرور

قاعدهٔ تفکیک (فاز 26.26d):
- **`deploy/`** = اسکریپت‌های shell که **روت روی سرور** اجرا می‌کند (نصب/آپدیت/بکاپ/ری‌استارت).
- **`scripts/`** = ابزارهای توسعه/تست/CI (ممیزی‌ها، رگرسیون‌های `verify-*`/`sim-*`، seed، load-test).
- ابزارهای **عملیاتی** tsx هم این‌جا در `deploy/` هستند: `reset-erp-data.ts` (پاک‌کردن دادهٔ ERP)
  و `fix-bug020-data.ts` (ترمیم دادهٔ BUG-020). این دو به `node_modules` و alias `@/` نیاز دارند،
  پس همیشه از **ریشهٔ پروژه** اجرا شوند: `npx tsx deploy/reset-erp-data.ts`.

مسیر اپ روی سرور: `/var/www/habibazar` (بعد از flatten، ریشهٔ ریپو = ریشهٔ اپ).

## 🔴 هرگز `git pull`/`git fetch`/`git checkout` دستی روی کلون سرور نزنید

کلون `/var/www/habibazar` باید همیشه صاحبِ `hbz` بماند، و `update.sh` این
مالکیت را پیش از هر عملیات git خودش تضمین می‌کند. یک `git pull` دستی (به‌ویژه
بدون `sudo -u hbz`) فایل/پوشهٔ تازه را با مالکیت `root` می‌سازد؛ اجرای بعدیِ
`update.sh` روی همان مسیرها با «Permission denied» متوقف می‌شود (حادثهٔ
26.30-fix-ownership — گزارش کامل در
`docs/governance/deploy-ownership-fix-report.md`). همیشه فقط:

```
sudo bash deploy/update.sh
```

اگر به‌هردلیل مالکیت به‌هم خورد، همان دستور خودش ترمیم می‌کند — نیازی به
`chown` دستی یا `chmod 777` نیست (و چنین کاری راه‌حل نیست، فقط علامت را
می‌پوشاند).

### `.next` هم همین قاعده را دارد (حادثهٔ EACCES روی `.next/trace`)

`heal_ownership` عمداً `.next` را رد می‌کند (فقط برای بهینه‌بودن عملیات git —
`.next` بخشی از تاریخچهٔ گیت نیست)، و مرحلهٔ **build** همیشه با `sudo -u hbz`
اجرا می‌شود. یک‌بار در عمل دیده شد که `.next` مالکیتش drift کرده بود و حتی
`chown -R hbz:hbz .next` هم build را رفع نکرد (علت دقیق بدون SSH به سرور قابل
تشخیص نبود — احتمالاً یک فایل باقی‌ماندهٔ نیمه‌کاره یا مالکیت تودرتوی
غیرمعمول). به همین دلیل `update.sh` دیگر سعی نمی‌کند `.next` قدیمی را تعمیر
کند: پیش از هر build، از `.next` موجود snapshot می‌گیرد (`.next.bak`، صریحاً
`chown` به `hbz`) و بعد خودِ `.next` زنده را کامل حذف می‌کند — build روی یک
`.next` کاملاً تازه اجرا می‌شود که از همان لحظهٔ ساخته‌شدن مالکیتش `hbz` است
(چون خودِ فرایند build آن را می‌سازد)، پس دیگر هیچ ابهامی دربارهٔ مالکیت باقی
نمی‌ماند. باز هم: دستی `chown`/`rm -rf .next` نزنید — همان
`sudo bash deploy/update.sh` کافی است.

## کدام اسکریپت را کِی بزنم؟

| اسکریپت | چه می‌کند | کِی | پیش‌نیاز |
|---|---|---|---|
| `install.sh` | نصب اولیهٔ کامل (Node، PM2، کلون، `.env.local`، build، nginx، فایروال) | فقط سرور تازه | روت، اوبونتو/دبیان |
| `update.sh` | `git pull` + build + reload بدون داون‌تایم (با rollback خودکار `.next` اگر build شکست) | هر آپدیت روتین | نصب قبلی سالم |
| `restart.sh` | ری‌استارت امن: `pm2 delete` + `start` از کانفیگ + health-gate — **بعد از تغییر cwd یا env، reload کافی نیست** | بعد از تغییر `.env.local`، مهاجرت مسیر، یا وقتی reload جواب نمی‌دهد | `pm2.config.js` موجود (از fix-pm2) |
| `fix-pm2.sh` | بازسازی `start.sh` + `pm2.config.js` از صفر و restart تمیز | وقتی کانفیگ PM2 خراب/کهنه است (مثلاً cwd قدیمی) | build موجود |
| `health-check.sh` | بررسی سلامت سرویس/DB/دیسک | هر وقت، بی‌ضرر | — |
| `backup.sh [bucket]` | بکاپ رمزنگاری‌شدهٔ **pg_dump** + uploads + کانفیگ (AES-256 + sha256 + verify) | دستی؛ بکاپ خودکار با BackupEngine داخل اپ است | کلید `/home/hbz/.backup-key` (نبود → خودش می‌سازد و هشدار می‌دهد) |
| `restore.sh <file.enc>` | بازگردانی بکاپ (`--test` = تمرین ایزوله بدون دست‌زدن به سیستم زنده) | بازیابی فاجعه | فایل بکاپ + کلید |
| `restore-drill.sh` | تمرین بازیابی: dump → DB موقت → validate → trial balance (چاپ RTO) | دوره‌ای | PostgreSQL |
| `deploy-blue-green.sh` | استقرار بدون داون‌تایم روی جفت‌پورت + health-gate + rollback یک‌خطی | ریلیزهای پرریسک | نصب سالم |
| `uninstall.sh` | حذف کامل (PM2، nginx، اپ، لاگ، کاربر) با بکاپ ایمنی و تأیید تایپی | فقط برچیدن سرور | روت |
| `migrate-data.sh` | مهاجرت کامل دادهٔ PG مبدأ→مقصد + اثبات برابری رکورد‌به‌رکورد (dry-run پیش‌فرض، `--confirm` واقعی) | جابه‌جایی دیتابیس/سرور | `SOURCE_URL` و `TARGET_URL` |
| `nginx/render-nginx.sh` | تولید conf از قالب با دامنهٔ اصلی + ریدایرکت‌ها؛ با `--install`: نصب + `nginx -t` + reload **(اجرا روی سرور)** | نصب اولیه/تغییر دامنه | روت برای `--install` |
| `reset-erp-data.ts` | پاک‌کردن دادهٔ ERP (dry-run پیش‌فرض) — `npx tsx deploy/reset-erp-data.ts` از ریشه | شروع دوبارهٔ ثبت داده | بکاپ |
| `fix-bug020-data.ts` | ترمیم دادهٔ BUG-020 — `npx tsx deploy/fix-bug020-data.ts` از ریشه | فقط دادهٔ قبل از فیکس 26.26b | بکاپ |
| `start.sh` / `pm2.config.js` | فایل‌های generated توسط fix-pm2 — دستی ویرایش نکنید | — | — |

## postgres/

| اسکریپت | چه می‌کند |
|---|---|
| `install-postgresql.sh` | نصب PG17 + extensions + ساخت DB و نوشتن `DATABASE_URL` |
| `bootstrap-postgresql.sh` | migrate (Drizzle) + seed اولیه |
| `reset-and-rebuild.sh` | ریست کامل DB و بازسازی از صفر (مخرب — فقط با بکاپ) |
| `sqlite-to-postgresql.sh` | مهاجرت یک‌بارهٔ دادهٔ SQLite قدیمی |
| `verify-postgresql.sh` | راستی‌آزمایی نصب/مهاجرت |
| `restore-postgresql.sh` | بازگردانی `pg_dump`/`pg_restore` |
| `rollback-to-sqlite.sh` | برگشت اضطراری به snapshot SQLite (فقط legacy) |
| `rollback-phase26.1[1-4].sql` | رول‌بک schema فازهای 26.11–26.14 |

## مهاجرت flatten (26.26d)

اگر سرور هنوز ساختار تودرتوی قدیمی (`outputs/…`) را دارد، **قبل از هر آپدیتی**
راهنمای ۱۰گامی `deploy/RESTRUCTURE_RUNBOOK_FA.md` را اجرا کنید.

## nginx (بند ۵ — INFRA-1)

- قالب: `deploy/nginx/habibazar.conf.template` · تولید/نصب: `deploy/nginx/render-nginx.sh`
- install.sh دامنهٔ اصلی و دامنه‌های ریدایرکت را می‌گیرد (env `PRIMARY_DOMAIN`/`REDIRECT_DOMAINS`
  یا تعاملی) و در `deploy/.install.conf` ذخیره می‌کند — دفعات بعد نمی‌پرسد.
- تصمیم هدرها: CSP/HSTS/XFO/XCTO را **اپ** می‌زند (next.config، فاز 26.24) — nginx هدر امنیتی
  اضافه نمی‌کند (بدون تکرار). rate-limit هم فقط در اپ.
- وب‌هوک‌های عمومی (`/api/webhooks/*`، `/api/pay/callback`، `/api/unsubscribe`) از proxy اصلی
  عبور می‌کنند — allowlist/basic-auth رویشان ممنوع.
- **اجرا روی سرور:** `nginx -t` و certbot فقط روی سرور واقعی معنا دارند:
  `sudo bash deploy/nginx/render-nginx.sh --install` سپس
  `certbot --nginx -d <primary> -d <redirects>` (تمدید خودکار با systemd timer).
