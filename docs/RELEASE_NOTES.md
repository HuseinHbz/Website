# HBZ Platform — Release Notes v2.0.0-RC1

**Release Date:** 2026-07-01  
**Branch:** feature/v2-enterprise-upgrade → hbz  
**Type:** Release Candidate

---

## What's New in v2.0.0

### Enterprise Design System (Phase 8)
- **Design Token System** — Single source of truth CSS custom properties for all colors, spacing, typography, motion, z-index
- **Theme Engine** — Dark / Light / System / High-Contrast themes via `data-theme` attribute, persisted in localStorage
- **Component Library** — 15+ new components: Button, Input, Badge, Card, Modal, Toast, Skeleton, Tabs, Tooltip, Alert, Drawer, Accordion, Breadcrumb, Pagination, Avatar, AvatarGroup
- **RTL Support** — Full Persian/Farsi RTL layout with Vazirmatn font
- **WCAG AA Compliance** — Focus indicators, skip-to-content, ARIA roles, keyboard navigation

### AI Platform (Phase 7)
- **Multi-provider AI** — OpenAI, Claude, Gemini, Groq, DeepSeek, Grok, GitHub Copilot, Conduit
- **Knowledge Base RAG** — Vector-search context retrieval from CMS content
- **Circuit Breaker** — Automatic failover with graceful fallback message
- **Rate Limiting** — 20 req/min per IP on AI endpoints

### CMS & Admin Panel (Phase 1–7)
- Full content management: Hero, About, Blog, Solutions, Technologies, Industries, Case Studies, Services, Projects, Clients, Navigation, Media
- Section Builder with drag-and-drop
- Template Engine
- Multi-locale (FA/EN) content editing
- 2FA (TOTP) for admin login
- Audit log for all admin actions

### Infrastructure & Security (Phase 9)
- **Structured Logging** — JSON logs in production with audit/security channels
- **Rate Limiting** — Per-IP sliding window for login, AI, contact, general API
- **Health Check** — `/api/health` endpoint with DB ping, memory, uptime
- **Circuit Breaker** — For AI and SMTP services
- **Retry** — Exponential backoff with jitter for external API calls
- **Environment Validation** — Boot-time check with production secret enforcement
- **Error Pages** — Localised 404 and error boundaries
- **CI/CD Pipeline** — GitHub Actions: typecheck → lint → unit tests → build → security scan → E2E tests

---

## Breaking Changes

- Font variable names changed: `--font-inter` → `--font-sans`, `--font-jetbrains-mono` → `--font-mono`
- Admin UI components migrated from hardcoded hex colors to DS tokens
- AI error responses now return 503 (not 500) with a user-friendly message

---

## Database Schema Changes

New tables added (auto-migrated on first boot):
- `solutions` — Enterprise solution pages
- `industries` — Industry verticals
- `technologies` — Technology catalog
- `consultation_requests` — Inbound consultation forms
- `ai_modules` — AI personality/module configuration
- `ai_knowledge_base` — RAG knowledge entries

---

## Upgrade Instructions

```bash
cd /var/www/Website
sudo bash deploy/update.sh
```

The update script handles zero-downtime reload and database migration automatically.

---

## Known Issues

- Rate limiter is in-process (per PM2 worker) — acceptable for single-instance; use Redis for horizontal scaling
- SQLite WAL mode handles concurrent reads well; upgrade to PostgreSQL if write concurrency exceeds 50 req/s

---

## Contributors

- Husein Habibazar (product owner, architecture)
- Claude (implementation)
