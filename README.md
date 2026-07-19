# Habibazar Platform

پلتفرم سازمانی حسین حبیب‌آذر — متخصص زیرساخت شبکه، امنیت و راهکارهای Enterprise.  
سایت دوزبانه (FA/EN)، ادمین پنل کامل، دستیار هوش مصنوعی، معماری Enterprise Domain Model.

---

## معماری

```
src/                   ← Next.js 15 App Router (سایت عمومی + ادمین پنل)
deploy/                ← اسکریپت‌های نصب، آپدیت و تعمیر (install/update/fix-pm2)
docs/                  ← مستندات عملیاتی و راهنماها
```

**یک اپ Next.js** روی port `3000`، SQLite به عنوان database.  
ادمین پنل در همان اپ در مسیر `/admin`.

---

## صفحات عمومی

| مسیر | توضیح |
|------|-------|
| `/` | صفحه اصلی |
| `/about` | پروفایل اجرایی |
| `/services` | خدمات و راهکارها |
| `/projects` | مطالعات موردی |
| `/case-studies` | Case Studies |
| `/solutions` | راهکارهای سازمانی |
| `/products` | محصولات و پلتفرم |
| `/academy` | دوره‌ها و آموزش |
| `/docs` | مستندات فنی |
| `/blog` | وبلاگ دانش |
| `/events` | رویدادها و وبینارها |
| `/industries` | صنایع هدف |
| `/technologies` | اکوسیستم فناوری |
| `/consultation` | فرم درخواست مشاوره |
| `/search` | جستجو |

---

## ادمین پنل `/admin`

### Personal Brand
| صفحه | کاربرد |
|------|--------|
| `/admin/dashboard` | داشبورد اجرایی |
| `/admin/hero` | Hero section با ۲۰ variant |
| `/admin/about` | پروفایل اجرایی |
| `/admin/timeline` | مسیر رهبری |
| `/admin/skills` | تخصص‌های اصلی |
| `/admin/credentials` | گواهینامه‌ها، جوایز، بدج‌ها |

### Content Hub
| صفحه | کاربرد |
|------|--------|
| `/admin/content` | هاب محتوا (blog/docs/news/tutorials/guides/...) |
| `/admin/sections` | سکشن‌های صفحه اصلی |
| `/admin/pages` | مدیریت صفحات |
| `/admin/menus` | منوها |
| `/admin/media` | مدیریت رسانه |

### Technology
| صفحه | کاربرد |
|------|--------|
| `/admin/technologies` | کاتالوگ فناوری |
| `/admin/services` | خدمات |
| `/admin/solutions` | راهکارها |
| `/admin/industries` | صنایع |

### Portfolio
| صفحه | کاربرد |
|------|--------|
| `/admin/projects` | مطالعات موردی و پروژه‌ها |

### Organizations
| صفحه | کاربرد |
|------|--------|
| `/admin/organizations` | هاب سازمان‌ها (clients/partners/employers/vendors/...) |

### Products
| صفحه | کاربرد |
|------|--------|
| `/admin/products` | محصولات و پلتفرم |

### Academy
| صفحه | کاربرد |
|------|--------|
| `/admin/academy` | دوره‌ها و مسیرهای یادگیری |

### Community
| صفحه | کاربرد |
|------|--------|
| `/admin/events-mgr` | رویدادها و وبینارها |
| `/admin/testimonials` | نظرات و توصیه‌نامه‌ها |

### Enterprise
| صفحه | کاربرد |
|------|--------|
| `/admin/organization` | تنظیمات سازمان |
| `/admin/sites` | مدیریت سایت‌ها |
| `/admin/workspaces` | فضاهای کاری |
| `/admin/integrations` | یکپارچه‌سازی‌ها |

### Operations
| صفحه | کاربرد |
|------|--------|
| `/admin/operations` | مرکز عملیات |
| `/admin/security` | امنیت |
| `/admin/backup` | پشتیبان‌گیری |

### AI Platform
| صفحه | کاربرد |
|------|--------|
| `/admin/ai-control` | کنترل پنل هوش مصنوعی |
| `/admin/ai-kb` | پایگاه دانش AI |

### System
| صفحه | کاربرد |
|------|--------|
| `/admin/settings` | تنظیمات (AI provider، SMTP، ...) |
| `/admin/users` | مدیریت کاربران ادمین |
| `/admin/audit` | لاگ فعالیت‌ها |
| `/admin/seo` | SEO |

---

## Domain Model (Enterprise)

در Phase 7.5 مدل داده یکپارچه شد:

```
organizations     ← clients + partners + employers + vendors + resellers + ...
content           ← blog + docs + news + tutorials + guides + api-docs + ...
credentials       ← certifications + awards + badges + licenses + memberships
success_stories   ← testimonials + recommendations + reviews + awards
content_categories ← درخت دسته‌بندی یکپارچه
```

هر entity از طریق فیلد `type` نوع خود را مشخص می‌کند.  
جداول قدیمی (`clients`, `blog`, `certifications`, `testimonials`) برای backward compatibility حفظ شده‌اند.

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
| **Conduit** | Gateway چند-مدلی (پشتیبانی از همه providerها) |

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

فایل `.env.local` در ریشهٔ پروژه بسازید:

```bash
# Required
ADMIN_JWT_SECRET=$(openssl rand -hex 64)
NEXT_PUBLIC_SITE_URL=https://habibazar.ir

# Optional — AI providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
CONDUIT_API_URL=https://conduit.your-domain.com
CONDUIT_API_KEY=...

# Optional — Email
SMTP_HOST=mail.habibazar.ir
SMTP_PORT=587
SMTP_USER=no-reply@habibazar.ir
SMTP_PASS=...
CONTACT_EMAIL=hosseinhabibazar@gmail.com
```

### Deploy اول‌بار

```bash
git clone --branch feature/v2-enterprise-upgrade \
  https://github.com/HuseinHbz/Website.git
cd Website
sudo bash deploy/install.sh
```

اسکریپت این کارها را انجام می‌دهد:
1. نصب وابستگی‌های سیستم (Node.js، PM2، Nginx، sqlite3)
2. Clone ریپو در `/var/www/habibazar`
3. Build Next.js
4. نصب Nginx config
5. راه‌اندازی PM2
6. Health check

### SSL (بعد از deploy)

```bash
sudo certbot --nginx \
  -d habibazar.ir -d www.habibazar.ir \
  --email hosseinhabibazar@gmail.com
```

### آپدیت بعد از تغییرات

```bash
cd /var/www/Website
sudo bash deploy/update.sh
```

---

## توسعه محلی

```bash
# (از ریشهٔ پروژه)
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

├── src/
│   ├── app/
│   │   ├── [locale]/               ← صفحات عمومی (FA/EN)
│   │   │   └── (marketing)/        ← با Header + Footer + AI Assistant
│   │   ├── admin/                  ← ادمین پنل
│   │   └── api/
│   │       ├── admin/              ← Admin CRUD APIs
│   │       ├── ai/                 ← AI chat API
│   │       └── search/             ← جستجو
│   ├── components/
│   │   ├── admin/                  ← AdminShell، AdminSidebar، CommandPalette
│   │   ├── sections/               ← سکشن‌های صفحه اصلی
│   │   ├── ai/                     ← دستیار هوش مصنوعی
│   │   ├── forms/                  ← فرم‌ها
│   │   └── ui/                     ← کامپوننت‌های مشترک
│   └── lib/
│       ├── db/
│       │   ├── schema.ts           ← تعریف جداول (drizzle-orm)
│       │   └── migrate.ts          ← migrations ایمن (try/catch)
│       ├── admin/
│       │   ├── auth.ts             ← getAdminUser()
│       │   └── audit.ts            ← logAction()
│       └── publicData.ts           ← توابع خواندن داده عمومی
deploy/
├── install.sh                      ← نصب اول‌بار روی سرور تازه
├── update.sh                       ← آپدیت (zero-downtime)
├── fix-pm2.sh                      ← تعمیر سریع PM2
├── uninstall.sh                    ← حذف کامل پروژه از سرور
├── backup.sh                       ← بکاپ دیتابیس
└── health-check.sh                 ← بررسی سلامت سرویس
```

### حذف کامل از سرور

```bash
cd /var/www/Website
sudo bash deploy/uninstall.sh          # با تأیید تعاملی + بکاپ نهایی دیتابیس
# گزینه‌ها: --yes  --no-backup  --keep-user  --keep-nginx  --remove-repo <path>
```

---

## Branch‌ها

| Branch | توضیح |
|--------|-------|
| `hbz` | **production** — monolith (Next.js + SQLite) |
| `feature/v2-enterprise-upgrade` | توسعه — Enterprise Architecture |

---

## لایسنس

کد اختصاصی — تمام حقوق محفوظ است.  
© Husein Habibazar
