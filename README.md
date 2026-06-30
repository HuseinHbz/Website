# Habibazar Platform

پلتفرم شخصی حسین حبیب‌آذر — متخصص زیرساخت شبکه و امنیت.  
سایت دوزبانه (FA/EN)، ادمین پنل کامل، دستیار هوش مصنوعی.

---

## معماری

```
outputs/
├── habibazar-web/     ← Next.js 15 (سایت عمومی + ادمین پنل)
└── habibazar-deploy/  ← اسکریپت‌های deploy و nginx
```

**یک اپ Next.js** روی port `3000`، SQLite به عنوان database.  
ادمین پنل در همان اپ در مسیر `/admin`.

---

## صفحات سایت

| مسیر | توضیح |
|------|-------|
| `/` | صفحه اصلی |
| `/blog` | وبلاگ با فیلتر دسته‌بندی |
| `/blog/[slug]` | مقاله با prev/next navigation |
| `/consultation` | فرم درخواست مشاوره |
| `/about` | درباره |
| `/services` | خدمات |
| `/projects` | پروژه‌ها |

### ادمین پنل `/admin`

| صفحه | کاربرد |
|------|--------|
| `/admin/dashboard` | داشبورد + resync |
| `/admin/hero` | ویرایش Hero با ۲۰ variant |
| `/admin/blog` | مدیریت مقالات |
| `/admin/services` | خدمات |
| `/admin/projects` | پروژه‌ها |
| `/admin/consultations` | درخواست‌های مشاوره |
| `/admin/contacts` | پیام‌های تماس |
| `/admin/clients` | لوگو مشتریان |
| `/admin/skills` | مهارت‌ها |
| `/admin/timeline` | تایم‌لاین تجربه |
| `/admin/media` | مدیریت تصاویر |
| `/admin/ai-kb` | پایگاه دانش AI |
| `/admin/settings` | تنظیمات (AI provider، SMTP، ...) |
| `/admin/users` | مدیریت کاربران |
| `/admin/audit` | لاگ فعالیت‌ها |

---

## دستیار هوش مصنوعی

پشتیبانی از چند provider — از ادمین پنل تنظیم می‌شود:

| Provider | توضیح |
|----------|-------|
| ChatGPT | OpenAI GPT-4o و سایر مدل‌ها |
| Claude | Anthropic Claude |
| Gemini | Google Gemini |
| Grok | xAI Grok |
| DeepSeek | DeepSeek Chat |
| **Conduit** | Gateway چند-مدلی (anthropic/claude-sonnet-4-6، openai/gpt-5، ...) |

---

## محتوا

- **۵۰ مقاله MikroTik** (دوزبانه FA/EN):
  - ۳۰ مقاله آموزشی zero-to-hero
  - ۱۰ مقاله وظایف روتین ادمین
  - ۱۰ مقاله امنیت و حملات
- همه بخش‌ها دوزبانه FA/EN

---

## راه‌اندازی اولیه

### پیش‌نیازها

```bash
sudo apt install -y nodejs npm nginx git
sudo npm install -g pm2
node --version   # باید 18+ باشد
```

### متغیرهای محیطی

فایل `.env.local` در کنار `deploy.sh` بسازید:

```bash
ADMIN_JWT_SECRET=$(openssl rand -hex 64)
NEXT_PUBLIC_SITE_URL=https://habibazar.ir
```

### Deploy اول‌بار

```bash
# دانلود اسکریپت
wget -O deploy.sh \
  https://raw.githubusercontent.com/HuseinHbz/Website/hbz/outputs/habibazar-deploy/deploy.sh

chmod +x deploy.sh
./deploy.sh
```

اسکریپت این کارها را انجام می‌دهد:
1. Clone ریپو از branch `hbz`
2. Build Next.js
3. نصب Nginx config
4. راه‌اندازی PM2
5. Health check

### SSL (بعد از deploy)

```bash
sudo certbot --nginx \
  -d habibazar.ir -d www.habibazar.ir \
  --email hosseinhabibazar@gmail.com
```

### آپدیت بعد از تغییرات

```bash
cd /var/www/habibazar/repo/outputs/habibazar-deploy
./update.sh
```

---

## توسعه محلی

```bash
cd outputs/habibazar-web
cp .env.example .env.local
# ویرایش .env.local و تنظیم ADMIN_JWT_SECRET

npm install
npm run dev
```

سایت روی `http://localhost:3000` بالا می‌آید.  
ادمین: `http://localhost:3000/admin`

---

## ساختار فایل‌ها

```
outputs/habibazar-web/
├── src/
│   ├── app/
│   │   ├── [locale]/          ← صفحات عمومی (FA/EN)
│   │   ├── admin/             ← ادمین پنل
│   │   └── api/               ← API routes
│   ├── components/
│   │   ├── sections/          ← سکشن‌های صفحه اصلی
│   │   ├── ai/                ← دستیار هوش مصنوعی
│   │   ├── forms/             ← فرم‌ها
│   │   └── ui/                ← کامپوننت‌های مشترک
│   └── lib/
│       ├── db/                ← SQLite (schema، seed، resync)
│       └── publicData.ts      ← توابع خواندن داده عمومی
outputs/habibazar-deploy/
├── deploy.sh                  ← deploy اول‌بار
├── update.sh                  ← آپدیت سریع
├── ecosystem.config.js        ← PM2 config
└── nginx.conf                 ← Nginx config
```

---

## Branch‌ها

| Branch | توضیح |
|--------|-------|
| `hbz` | **production** — معماری monolith (Next.js + SQLite) |
| `habibazar-web` | معماری سه‌اپ (web + admin + api جداگانه) |

---

## لایسنس

کد اختصاصی — تمام حقوق محفوظ است.  
© Husein Habibazar
