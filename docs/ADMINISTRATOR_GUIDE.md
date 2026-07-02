# HBZ Platform — Administrator Guide

## Accessing the Admin Panel

URL: `https://habibazar.ir/admin`

Default credentials are set during first deployment via `seedDatabase()`. Change them immediately after first login.

---

## Admin Navigation

| Section | Path | Purpose |
|---|---|---|
| Dashboard | `/admin` | Stats overview |
| Hero | `/admin/hero` | Homepage hero content (FA/EN) |
| About | `/admin/about` | Profile, key stats, contact & social links |
| Blog | `/admin/blog` | Blog posts and categories |
| Solutions | `/admin/solutions` | Enterprise solution pages |
| Technologies | `/admin/technologies` | Technology catalog |
| Industries | `/admin/industries` | Industry vertical pages |
| Projects | `/admin/projects` | Portfolio / Case Studies |
| Services | `/admin/services` | Service offerings |
| Clients | `/admin/clients` | Client logos and testimonials |
| Navigation | `/admin/navigation` | Menu configuration |
| Media | `/admin/media` | File uploads |
| AI Modules | `/admin/ai-modules` | AI chatbot configuration |
| AI Knowledge Base | `/admin/ai-kb` | RAG knowledge entries |
| Consultation Requests | `/admin/consultations` | Inbound leads |
| Forms | `/admin/forms` | Dynamic form builder |
| SEO | `/admin/seo` | Per-page SEO settings |
| Settings | `/admin/settings` | Platform-wide settings |
| Users | `/admin/users` | Admin user management |
| Audit Logs | `/admin/audit-logs` | Action history |

---

## Content Management

### About Editor (`/admin/about`)

The About editor has three sections:

**1. Executive Profile**
- Headline and sub-headline (FA + EN separately — toggle at top right)
- Bio text
- Profile photo (9:16 portrait, auto-saved to both locales)
- Resume PDF URL

**2. Key Stats**
- Years of experience, project count, endpoint count, deployment count

**3. Contact & Social Links**
- Email (`contact_email`), Phone (`contact_phone`)
- LinkedIn, Instagram, WhatsApp, Telegram, Twitter/X
- These values are stored in `site_settings` and displayed on the public `/about` page

> WhatsApp accepts either a full URL (`https://wa.me/98...`) or just the phone number — the site converts it automatically.

### Blog Posts

1. Go to **Blog** → **New Post**
2. Fill in: Title (FA + EN), Slug, Category, Content (Markdown)
3. Set SEO fields: meta title, description, keywords
4. Set status: `draft` → `published`
5. Save → post appears on `/fa/blog` and `/en/blog`

### Case Studies / Projects (`/admin/projects`)

The projects table shows bilingual data matching the current admin panel language (FA/EN toggle in top navigation). Each project has 7 tabs:

| Tab | Contents |
|---|---|
| Basic Info | Slug, name, industry, client, status, year, color |
| Case Study | Executive summary, challenge, existing infra, proposed arch, solution |
| Technical | Tech stack, implementation timeline, before/after comparison |
| Strategy & Process | Security, HA, backup, DR, monitoring, deployment process |
| Results & Impact | Business impact metrics, key results, lessons learned |
| Media & Downloads | Cover image, gallery, diagrams, PDF downloads |
| SEO | Meta title, description, keywords, OG image |

### Solutions

1. Go to **Solutions** → **New Solution**
2. Fill in: Name (FA + EN), Slug, Icon, Color
3. Add: Challenges, Approach, Benefits, Tech Stack, Roadmap, FAQ, Metrics
4. Toggle **Active** to publish
5. Appears on `/fa/solutions/{slug}`

### AI Knowledge Base

Entries are used for RAG (Retrieval-Augmented Generation) to give the AI chatbot accurate answers:

1. Go to **AI Knowledge Base** → **New Entry**
2. Fill in: Title, Content, Tags, Priority
3. Toggle **Active**
4. The AI will cite this as a source in responses

---

## User Management

### Adding an Admin User

1. Go to **Users** → **New User**
2. Fill in: Email, Password (min 12 chars), Role
3. Roles: `super_admin` (full access), `admin` (all content), `viewer` (read-only)

### Setting Up 2FA (TOTP)

1. Log in as the user
2. Go to profile settings
3. Scan QR code with Google Authenticator or Authy
4. Enter the 6-digit code to confirm
5. 2FA is now required on every login

### Rotating Admin Password

1. **Admin Panel** → **Users** → Edit user → Change Password
2. Or via API: `PATCH /api/admin/users/{id}` with `{ "password": "new-password" }`

---

## Settings Reference

| Setting Key | Purpose | Example |
|---|---|---|
| `site_name` | Platform name | `HBZ` |
| `site_url` | Public URL | `https://habibazar.ir` |
| `contact_email` | Contact email (About page) | `husein@habibazar.com` |
| `contact_phone` | Contact phone (About page) | `+98...` |
| `social_linkedin` | LinkedIn URL | `https://linkedin.com/in/...` |
| `social_instagram` | Instagram URL | `https://instagram.com/...` |
| `social_whatsapp` | WhatsApp (URL or number) | `+989...` |
| `social_telegram` | Telegram URL | `https://t.me/...` |
| `social_twitter` | Twitter/X URL | `https://x.com/...` |
| `ai_provider` | Default AI provider | `chatgpt` / `claude` / `gemini` |
| `ai_model` | AI model name | `gpt-4o` |
| `ai_api_key` | Provider API key | (encrypted at rest) |
| `smtp_host` | Email server | `smtp.gmail.com` |

---

## Audit Logs

All admin actions are logged:

- Go to **Audit Logs** to see: who did what, when, from which IP
- Logs are also written to the application log: `pm2 logs habibazar | grep AUDIT`
- Log entries include: action, resource, resource ID, user, timestamp

---

## Media Management

- **Supported formats:** Images (JPEG, PNG, WebP, GIF, SVG), Documents (PDF), Video (MP4)
- **Max file size:** 10 MB (configurable in settings)
- **Storage:** Local filesystem at `public/uploads/` inside the web directory
- **CDN:** Configure `NEXT_PUBLIC_CDN_URL` in `.env.local` to serve from CDN

---

## SEO Management

For each page:
1. Go to **SEO** → select page
2. Set: meta title, description, keywords, OG image
3. Changes take effect on next page request (ISR revalidation)

Dynamic routes (blog posts, solutions, projects) have their own SEO fields in their respective editors.
