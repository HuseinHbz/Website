# deploy/ — اسکریپت‌های عملیاتی سرور

قاعدهٔ تفکیک (فاز 26.26d):
- **`deploy/`** = اسکریپت‌های shell که **روت روی سرور** اجرا می‌کند (نصب/آپدیت/بکاپ/ری‌استارت).
- **`scripts/`** = ابزارهای tsx/mjs که **npm داخل اپ** اجرا می‌کند (ممیزی‌ها، رگرسیون‌ها، seed،
  `reset-erp-data.ts`، `fix-bug020-data.ts`). این‌ها به `node_modules` و alias `@/` نیاز دارند و
  باید از **ریشهٔ پروژه** اجرا شوند — بیرون از درخت اپ کار نمی‌کنند.

مسیر اپ روی سرور: `/var/www/habibazar` (بعد از flatten، ریشهٔ ریپو = ریشهٔ اپ).

## کدام اسکریپت را کِی بزنم؟

| اسکریپت | چه می‌کند | کِی | پیش‌نیاز |
|---|---|---|---|
| `install.sh` | نصب اولیهٔ کامل (Node، PM2، کلون، `.env.local`، build، nginx، فایروال) | فقط سرور تازه | روت، اوبونتو/دبیان |
| `update.sh` | `git pull` + build + reload بدون داون‌تایم (با rollback خودکار `.next` اگر build شکست) | هر آپدیت روتین | نصب قبلی سالم |
| `restart.sh` | ری‌استارت امن: `pm2 delete` + `start` از کانفیگ + health-gate — **بعد از تغییر cwd یا env، reload کافی نیست** | بعد از تغییر `.env.local`، مهاجرت مسیر، یا وقتی reload جواب نمی‌دهد | `pm2.config.js` موجود (از fix-pm2) |
| `fix-pm2.sh` | بازسازی `start.sh` + `pm2.config.js` از صفر و restart تمیز | وقتی کانفیگ PM2 خراب/کهنه است (مثلاً cwd قدیمی) | build موجود |
| `health-check.sh` | بررسی سلامت سرویس/DB/دیسک | هر وقت، بی‌ضرر | — |
| `backup.sh [bucket]` | بکاپ رمزنگاری‌شدهٔ DB + uploads + کانفیگ (AES-256 + sha256 + verify) | دستی؛ بکاپ خودکار با BackupEngine داخل اپ است | کلید `/home/hbz/.backup-key` (install.sh می‌سازد) |
| `restore.sh <file.enc>` | بازگردانی بکاپ (`--test` = تمرین ایزوله بدون دست‌زدن به سیستم زنده) | بازیابی فاجعه | فایل بکاپ + کلید |
| `restore-drill.sh` | تمرین بازیابی: dump → DB موقت → validate → trial balance (چاپ RTO) | دوره‌ای | PostgreSQL |
| `deploy-blue-green.sh` | استقرار بدون داون‌تایم روی جفت‌پورت + health-gate + rollback یک‌خطی | ریلیزهای پرریسک | نصب سالم |
| `uninstall.sh` | حذف کامل (PM2، nginx، اپ، لاگ، کاربر) با بکاپ ایمنی و تأیید تایپی | فقط برچیدن سرور | روت |
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
راهنمای ۱۰گامی `docs/MIGRATION-FLATTEN.md` را اجرا کنید.
