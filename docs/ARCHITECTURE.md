# HBZ Platform — Architecture Summary

> This is a high-level orientation doc; it does not track every phase. The
> canonical, actively-maintained reference for stack/schema/module details is
> `CLAUDE.md` at the repo root — read that first for anything current.

## Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Runtime | Node.js | 20 LTS |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS + CSS Custom Properties | 3.x |
| Database | **PostgreSQL** (via `pg`, async pool) | 16/17 |
| ORM | Drizzle ORM (`pg-core`) | 0.45 |
| Authentication | JWT (jose) + bcryptjs + TOTP | - |
| Internationalisation | next-intl | 3.x |
| UI Animations | Framer Motion | 11.x |
| Charts | Recharts | 3.x |
| Process Manager | PM2 | - |
| Reverse Proxy | Nginx | - |

---

## Directory Structure

The app lives at the **repo root** (the older nested `outputs/habibazar-web/`
layout was flattened away in Phase 26.26d — `npm` commands run from the root).

```
Website/
├── src/
│   ├── app/
│   │   ├── [locale]/          # FA/EN localised routes
│   │   │   ├── (marketing)/   # Public pages
│   │   │   └── ai/            # AI platform
│   │   ├── admin/             # Admin panel (no locale)
│   │   └── api/                # API routes (public + /api/admin/*)
│   ├── components/
│   │   ├── ds/                # ThemeProvider + Toast (app-wide)
│   │   ├── admin/              # Admin UI components
│   │   └── seo/                # SEO/JSON-LD components
│   └── lib/
│       ├── db/                 # Drizzle schema (schema.ts), raw migrate.ts, seed
│       ├── admin/              # Admin auth, RBAC
│       ├── erp/, hr/, crm/     # Domain server layers (ERP/HR/CRM modules)
│       ├── logger.ts           # Structured logging
│       ├── rateLimit.ts
│       ├── retry.ts
│       ├── circuitBreaker.ts
│       └── env.ts              # Environment validation
├── deploy/                     # Deployment scripts
│   ├── install.sh
│   ├── update.sh
│   ├── fix-pm2.sh
│   ├── uninstall.sh
│   ├── backup.sh
│   └── postgres/                # PostgreSQL provision/migrate/verify scripts
├── docs/                        # Documentation
└── .github/workflows/ci.yml     # CI/CD pipeline
```

---

## Request Flow

```
Browser / Client
    │
    ▼
Nginx (SSL termination, static files, compression)
    │
    ▼
Next.js Middleware (rate limiting, JWT auth, intl redirect)
    │
    ├── Public routes → next-intl → [locale]/(marketing)/ pages
    ├── Admin UI     → /admin/ pages (JWT required)
    ├── Admin API    → /api/admin/ routes (JWT required)
    ├── AI API       → /api/ai/ routes (rate limited, circuit breaker)
    └── Public API   → /api/ routes (rate limited)
                          │
                          ▼
                    PostgreSQL (async pool) via Drizzle ORM + raw pgQuery
```

---

## Authentication & Authorization

```
Login → bcrypt verify → JWT issue (jose) → HttpOnly cookie
         │
         ▼
    Middleware verifies JWT on every /admin/* and /api/admin/* request
         │
         ├── Valid → pass to route handler
         └── Invalid → 401 (API) or redirect to /admin/login (UI)

Admin roles: super_admin → administrator → editor (plus read-only auditor/viewer roles, Phase 26.22)
TOTP: optional 2FA via otplib (TOTP)
```

---

## AI Platform

```
User message
    │
    ▼
Circuit Breaker (breakers.ai)
    │
    ▼
Knowledge Base RAG (retrieve context from aiKnowledgeBase table)
    │
    ▼
Provider Router (OpenAI / Claude / Gemini / Grok / DeepSeek / Conduit)
    │
    ├── Success → return reply + sources
    └── Failure (2 retries) → fallback message
```

---

## Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `users` | Admin users with hashed passwords |
| `admin_sessions` | Audit log of admin logins |
| `site_settings` | Key-value store for all platform settings |
| `seo_settings` | Per-page SEO configuration |
| `hero_content` | Hero section content (FA/EN) |
| `about_content` | About section |
| `blog_posts` | Blog articles with categories |
| `solutions` | Enterprise solution pages |
| `industries` | Industry vertical pages |
| `technologies` | Technology catalog |
| `projects` | Portfolio projects |
| `services` | Service offerings |
| `clients` | Client logos/testimonials |
| `navigation_items` | Dynamic navigation menus |
| `media_files` | Uploaded media metadata |
| `ai_modules` | AI personality configuration |
| `ai_knowledge_base` | RAG knowledge entries |
| `consultation_requests` | Inbound leads |
| `forms` | Dynamic form definitions |

---

## Design System

Token hierarchy:
```
CSS Custom Properties (:root, [data-theme])
    ↓
Tailwind config (references CSS vars via var(--token))
    ↓
Component library (src/components/ds/)
    ↓
Page components
```

Theme switching: JavaScript sets `data-theme` attribute on `<html>`. No class toggling on individual elements. Theme persisted in localStorage under key `hbz-theme`.

---

## Resilience Architecture

```
External Service Call
    │
    ├── Circuit Breaker (CLOSED/OPEN/HALF_OPEN)
    │       │
    │       └── OPEN → immediate fallback (no network call)
    │
    └── Retry (2 attempts, exponential backoff + jitter)
            │
            └── All failed → fallback or error response
```

Rate limiting:
- Login: 10 req / 15 min per IP (in-process sliding window)
- AI: 20 req / min per IP
- Contact form: 5 req / hour per IP
- General API: 120 req / min per IP
