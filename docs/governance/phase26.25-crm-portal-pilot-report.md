# Phase 26.25 (R2) — Go-Live pilot + CRM core — progress report

> Status: **بند ۰ + بند ۱ foundation + بند ۴ (multi-channel, via supplement
> 26.25s) shipped & verified.** بند ۲ (customer portal), بند ۳ (tickets/SLA),
> بند ۵ (CRM dashboard / onboarding wizard / docs) remain open and are tracked
> as continuing work. This report documents what is built + verified today.

## بند ۰ — valid load numbers (fixed a real measurement bug)
The 26.24b login numbers were **invalid**: the login limiter is 10/15 min and the
API limiter 120/min, so a 20-conn benchmark was mostly measuring **429 storms**
(login p50 27 ms < health 55 ms was the tell — impossible with bcrypt). Fix:
`load-test.mjs` now reports the full status distribution and **fails on any
non-2xx**; a test-only `RATE_LIMIT_DISABLED=1` server flag measures true
throughput. Valid re-run (all routes **0** 429/4xx/5xx):

| route | p50 | p95(p97.5) | p99 | 2xx | 5xx |
|---|---|---|---|---|---|
| health-live | 41ms | 69ms | 76ms | 4480 | 0 |
| login (bcrypt) | 8387ms | 9786ms | 9786ms | 9 | 0 |
| journal-list | 85ms | 157ms | 5969ms | 912 | 0 |
| sales-docs | 79ms | 128ms | 138ms | 2407 | 0 |
| overview | 113ms | 170ms | 249ms | 1676 | 0 |

RSS **under sustained load** 350→356 MB (2 % slope → no leak). DELETE-journal
guard (void→400, draft→200) extracted to a tested predicate.

## بند ۱ — Customer 360 (foundation)
`customer360Data` aggregates profile + orders + payments + gateway tx + activities
+ tickets + source lead + matched public requests + **balance/aging** from
existing tables (no parallel store). AR **aging** (0-30/31-60/61-90/90+) and the
**credit guard** are pure engines (`crm/aging.ts`); the guard is wired into the
sales-invoice confirm (off/warn/block via `erp_settings.credit_guard_mode`, 0
limit = no limit, business_alert on breach). Admin route
`/api/admin/crm/customers/[id]`. Live-PG 14/14.

---

## متمم چندکاناله (Supplement 26.25s) — SMS · Email · WhatsApp · Telegram

Audit-first: the single-channel SMS adapter from the first بند ۴ pass was
**extended, not rebuilt** into a unified `MessageProvider` (same shape as the
26.24 payment `GatewayProvider`). Email **reuses** nodemailer (no new dep).

### Four-channel status
| Channel | Built | Tested | External dependency |
|---|---|---|---|
| **SMS — Kavenegar** | ✅ full REST | ✅ sandbox live-PG | needs customer API key; no key ⇒ sandbox |
| **SMS — SMS.ir** | ✅ **full REST v1** (`/send/bulk`) | ✅ | needs API key + line number |
| **SMS — Melipayamak** | ✅ wired skeleton | — | **blocked-external** (awaiting credential) |
| **Email — SMTP** | ✅ reuses nodemailer + List-Unsubscribe | ✅ sandbox when no SMTP | uses site SMTP; none ⇒ sandbox |
| **WhatsApp — Cloud API** | ✅ **full** (Graph send: text + approved template; GET verify challenge; POST X-Hub-Signature-256 webhook; delivery/read receipts; 24h window) | ✅ sandbox + signature unit tests | **blocked-external**: needs a Meta Business account/token — *code is complete and real*, only activation is gated |
| **Telegram — Bot API** | ✅ **full** (sendMessage; secret-token webhook; `/start <code>` links chat_id; `/stop` opt-out; inbound auto-lead) | ✅ sandbox + secret unit tests | needs a bot token (freely obtainable) — fully runnable |

Honest boundary (per prompt): **WhatsApp code is written and real**; it is
`blocked-external` for *activation* only (Meta account), which is distinct from
"not built". Telegram/SMS.ir/Email are fully runnable now.

### Server-side send rules (pure, un-bypassable — `sendDecision.ts`)
- WhatsApp **inside** the 24h window → free-form; **outside** → approved template
  only, else **rejected** (never blindly attempted).
- Telegram without `chat_id` → skipped with a recorded reason.
- Opt-out blocks in **all four** channels at the server (not a UI filter).
- Exponential backoff on provider 429; optional per-campaign **fallback chain**
  (e.g. WhatsApp → SMS) — the decision is a tested pure function.

### Data model (بند ۴.۲/۴.۴, all idempotent, all tenancy-clean)
`crm_customer_channels` (chat_id set **only** via `/start`; `last_inbound_at`
from the WhatsApp webhook → server-computed 24h window; opt-in/consent/opt-out;
`company_id`). Campaign migration → `channels[]` + `fallback_chain` + per-channel
`templates` (old single `channel` kept for back-compat); recipients gained
`channel`/`reason`/`provider_message_id`/delivery lifecycle
(queued→sent→delivered→read/failed/skipped) + `retry_count`; **unique
(campaign,customer,channel)** = queue idempotency.

### Attribution + CAC per-channel (بند ۴.۵)
Anonymous inbound (WA/Telegram) → **auto-lead** sourced to the channel
(`inbound_*`), idempotent per sender. UTM → `crm_leads.campaign_id`. Report:
sent/delivered/read **per channel**, conversions, won sales value, overall
**CAC** and **ROI**, plus per-channel cost share (which channel produced cheaper
leads).

### Consent & privacy (بند ۴.۶ + security)
Consent basis stored per channel. Opt-out paths: email List-Unsubscribe +
**HMAC-signed, expiring** `/api/unsubscribe` link; SMS/Telegram `/stop`; WhatsApp
keyword — all write `opt_out_at` and take effect server-side immediately.

### Webhook security matrix (gate 6.1)
| Check | Result |
|---|---|
| WhatsApp POST — invalid/absent `X-Hub-Signature-256` | **401** (verified over raw body BEFORE parsing) |
| WhatsApp GET — verify challenge token mismatch | **403** |
| Telegram POST — wrong `X-Telegram-Bot-Api-Secret-Token` | **401** |
| Webhooks — never trust body until signature verified | ✅ (raw-body HMAC first) |
| Unsubscribe link — tamper / expiry | rejected (HMAC + exp, timing-safe) |
| Webhooks — public + rate-limited, no admin JWT / portal session bypass | ✅ |

Signature/secret/challenge/unsubscribe verifiers are pure + unit-tested (13
messaging tests).

## Gates
- TypeScript **0** · ESLint **0** · **712 unit tests** (13 new messaging) · **9
  governance audits 0** (tenancy incl. `crm_customer_channels`; theme 0) ·
  production build **clean** (4 new routes compiled).
- **Live-PG 15/15** (`scripts/verify-2625s.ts`): schema+tenancy, 4-channel
  enqueue, idempotent re-enqueue, 4-channel sandbox dispatch + provider ids,
  opt-out skip, delivery receipt, anonymous inbound auto-lead (+dedup),
  attribution 1 conversion / won 8 M / **CAC 2 M**, per-channel breakdown.
- Foundation live-PG 14/14 (بند ۱: aging 90+, credit guard warn, SMS sandbox,
  opt-out).

## Changelog (26.25s)
- lib/messaging: `provider.ts`, `channels.ts` (6 providers), `manager.ts`,
  `sendDecision.ts`, `webhookVerify.ts`.
- lib/crm: `channelData.ts`, `campaignData.ts`, `inboundData.ts`.
- routes: `/api/webhooks/{whatsapp,telegram}`, `/api/unsubscribe`,
  `/api/admin/crm/campaigns`.
- DB: `crm_customer_channels` + campaign multi-channel migration + whatsapp/
  telegram settings seeds + inbound source-check relax (all idempotent).
- deploy: `install.sh` optional messaging env vars + public webhook paths noted.

## Deliberately NOT done yet (continuing 26.25)
Customer portal (بند ۲), tickets/SLA (بند ۳), CRM dashboard + onboarding wizard +
demo seed + Persian user guide + pilot go-live plan (بند ۵). These are the
remaining base-phase items and are not claimed complete.
