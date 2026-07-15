# Phase 26.25b — R2 Final (تکمیل نهایی R2)

Closes Release 2: settles all inherited debt, ships support tickets + SLA, the CRM
dashboard, onboarding wizard, demo seed/reset and the pilot go-live docs. Branch
`feature/v2-enterprise-upgrade` (pushed to the session branch). Audit-first — every
existing capability was reused; only genuine gaps were built.

## بند ۰ — inherited-debt settlement (blocking, first pass) — 10/10 CLOSED

| # | Item | Status | Evidence |
|---|---|---|---|
| ۰.۱ | Run 26.25s regression + CI `regressions` job (all 7) | ✅ | 26.25s **16/16** (updated to the hardened quarantine flow); new `scripts/ci-regressions.ts` runs **9** suites each on its own DB (**206** assertions); CI job `regressions` added |
| ۰.۲ | Login numeric decision + scrypt migration | ✅ | Decision **by number**: async `crypto.scrypt` (libuv pool) — per-hash **110ms** vs bcrypt 460ms; **20 concurrent 643ms vs 8313ms** (13×, no event-loop block). Legacy bcrypt hashes verify + **rehash-on-login** (no forced reset). 7 unit tests |
| ۰.۳ | i18n gate bypass fixed (add the key) | ✅ | `nav_crm`/`nav_customers`/`crm_customer360` added to both langs; Customer360 uses `t('nav_crm')`; `audit:i18n` gains a hardcoded-Persian-JSX detector (39 legacy sites reported informationally) |
| ۰.۴ | Gateway payment method (not POS 'card') | ✅ | `'gateway'` added to `sales_payments.method`; portal/callback path records `gateway`; historical gateway-path `card` rows migrated via `payment_transactions` evidence; **real POS `card` untouched** (live-PG) |
| ۰.۵ | RATE_LIMIT_DISABLED prod hard-gate | ✅ | `rateLimitBypassActive()` returns false in production even if set; `assertEnv` warns; unit test proves inert in production |
| ۰.۶ | Inbound-lead flood cap + quarantine | ✅ | `crm_inbound_messages` quarantine (pending_review; unknown senders never enter funnel/CAC until confirmed) + per-window global/channel cap + one de-duplicated `business_alert`; pure `inboundPolicy` (7 tests); 1000-inbound flood → funnel clean (live-PG) |
| ۰.۷ | crm_leads source CHECK restored | ✅ | The 26.25s DROP left the column accepting any string → constraint re-added with `inbound_*` values; invalid source **rejected at the DB** (live-PG) |
| ۰.۸ | Kanban touch/mobile | ✅ | Per-card **“move to stage”** selector (works on touch); HTML5 drag kept for desktop. DnD sibling audit below |
| ۰.۹ | DELETE-journal route test | ✅ | Live-PG: void→**400**, posted→**400**, draft→**200** (+ actually gone) |
| ۰.۱۰ | Playwright customer-role E2E | ✅ | `e2e/portal.spec.ts` drives real routes: OTP verify → own invoice → **IDOR 404** on another's invoice → no-cookie 401 → logout revokes; + admin-role workspace smoke |

### DnD sibling audit (بند ۰.۸)
| Component | Mechanism | Status |
|---|---|---|
| CRM Kanban (LeadsManager) | HTML5 drag | **FIXED** — touch-safe stage selector added |
| Hero TimelineStudio | pointer events | already touch-OK |
| Dashboard widget reorder | HTML5 drag | desktop-only convenience; add/remove/resize are the touch path (documented, acceptable) |
| DataTable column reorder | HTML5 drag | desktop-only; the column-picker menu is the touch alternative |
| Media dropzone | file `onDrop` | not reordering — no touch issue |

### Login row — Production-Ready Checklist
| Row | Now | Numeric decision |
|---|---|---|
| Login | 🟢 | **Migrated to async scrypt (option ب).** Measured: scrypt hash 110ms, verify 110ms, 20-concurrent 643ms; bcrypt 20-concurrent 8313ms. The event-loop starvation that produced the old p99 is removed because scrypt runs on the libuv threadpool (parallel, non-blocking). Legacy bcrypt hashes still verify and are rehashed to scrypt on first successful login. |

## بند ۱ — Support tickets + SLA + escalation (one shot)
Reused the 26.25 `crm_tickets`/`crm_ticket_messages` schema (internal flag,
attachments, company_id) and the shared **`bi/sla`** business-hours + jalali engine
(no second SLA system). Pure `crm/tickets.ts` (SLA target by priority, state
machine, escalation, **SLA clock pauses while pending**) + 7 unit tests. Data layer
`ticketData.ts` (numbering-engine TK-, IDOR-scoped list/detail/reply, agent
public/internal + customer replies, assign, status with pause accounting, priority,
`scanTicketSla` → idempotent `business_alerts` + escalation). Admin queue
(`/admin/crm/tickets`: SLA-breach counters, assign, status/priority, reply, internal
notes). Portal Support + Help tabs (create/chat/status/SLA + **KB reusing
ai_knowledge_base** `portal_public` flag + search). Routes: admin
`/api/admin/crm/tickets`, portal `/api/portal/tickets(/[id])` + `/api/portal/kb`.

**IDOR proof (live-PG):** A cannot read/reply to B's ticket (→404), internal notes
NEVER appear in the portal view, a customer reply is never stored internal, cross-
customer reply rejected. SLA breach → alert → escalation stage; pending pause folds
into resolved.

## بند ۲ — CRM dashboard + onboarding + demo + docs
- **CRM Dashboard** (`/admin/crm/dashboard`): funnel (reuses `pipelineStats`),
  no-activity leads, SLA-breached tickets, AR aging (reuses `agingBuckets`),
  per-channel campaign performance, **month-over-month** on every KPI (pure
  `momChange`, 4 tests). Bilingual RTL.
- **Onboarding wizard** (`/admin/settings/onboarding`): read-only Go-Live checklist
  (company/products/customers/SMTP/SMS/gateway + optional rates/KB/مودیان), each
  incomplete item deep-links to the real settings page. **Never rebuilds settings.**
- **`npm run seed:demo` / `reset:demo`**: `DEMO-`-prefixed dataset; reset deletes
  ONLY demo rows. Live-PG proves a REAL customer survives a reset (separation).
- Docs: `docs/USER_GUIDE_FA.md`, `docs/PILOT_GO_LIVE.md` (prereqs incl. the
  customer-credential list, ordered steps, backup-before-each-step, success
  criteria, blue-green + restore-drill rollback).

## Gates
- TypeScript **0** · ESLint **0** · **738 unit tests** · **9 governance audits 0**
  (incl. strengthened i18n) · production build **clean**.
- Live-PG **verify-2625b 41/41** (بند ۰ + ۱ + ۲).
- **Regressions 9/9** (206 assertions): 26.20 28 · 26.21 45 · 26.23 26 · 26.24 24 ·
  26.24b 13 · 26.25 14 · 26.25s 16 · 26.25a 19 · 26.25b 41.

## Honest boundaries (blocked-external, not "not built")
Real SMS/WhatsApp/Telegram/Email/Zarinpal/مودیان delivery each needs the
customer's own credentials; until then they run in deterministic sandbox mode.
The onboarding checklist lists exactly which credentials are required.
