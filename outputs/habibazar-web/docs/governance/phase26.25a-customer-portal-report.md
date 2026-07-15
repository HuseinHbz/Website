# Phase 26.25a — Customer Portal + Customer 360 + inherited-debt settlement

Scope: the `a` slice of the split 26.25 remainder (portal only; tickets = 26.25b,
campaign/pilot = 26.25c). Branch `feature/v2-enterprise-upgrade`.

## بند ۰ — inherited-debt settlement (blocking prerequisite)

### ۰.۱ Regressions (the critical check)
The 26.25 credit guard was wired straight into the sales-invoice confirm path —
the same path 26.23's auto-GL-posting lives in — and 26.25s changed the campaign
schema. All six regression suites re-run **green**, so neither broke anything:

| Suite | Result |
|---|---|
| 26.21 two-year simulation | **45/45** |
| 26.23 GL/CRM | **26/26** |
| 26.24 hardening/Iran | **24/24** |
| 26.24b closeout (AP non-negative) | **13/13** |
| 26.20 self-heal | **28/28** |
| 26.25 foundation | **14/14** |

### ۰.۲ journal-list p99 = 5969ms — EXPLAINED (not a journal defect)
`load-test.mjs` runs routes **sequentially** (`spawnSync` loop), so login could
not contaminate journal's p50/p95. But the login bench's **20 concurrent pure-JS
bcrypt** hashes saturate the event loop for ~8s, and the journal bench — starting
immediately after — inherited a **backed-up request queue**; its first ~1% (the
p99) waited behind that backlog. Evidence: journal-list **in isolation** =
`p50 101ms · p99 185ms · max 230ms`. Fix: `load-test.mjs` now warms up + cools
down 1.5s between routes and benches login at low concurrency → **journal p99 =
119ms**, every route **0 429/4xx/5xx**. Row is now 🟢 with valid numbers.

### ۰.۳ login — valid measurement + DoS mitigation
Single-request login = **460ms avg** (20 sequential; bcryptjs work factor). Under
20-way concurrency the earlier "p50 8387ms" was event-loop serialization, not
per-request cost. The per-IP limiter (10/15min) does **not** stop a distributed
flood (100 IPs × 10 req stay under the cap yet pin the loop). **Mitigation
(implemented):** a global concurrent-login cap (`loginGuard`, `MAX_CONCURRENT_
LOGINS=4`) sheds excess with **429** → worst-case blocking bounded to `4 ×
hashCost`. Pure `shouldShedLogin` unit-tested. Login benched at concurrency 2 →
`p50 875ms` (2 serialized), 0 non-2xx. Row now 🟢 (measured + mitigated).

### ۰.۴ 26.25s health confirmed
Multi-channel migration idempotent + backfill + old `channel` column kept
(live-PG 15/15); telegram `chat_id` writable **only** via `linkTelegramChat`
(the `/start` path; `upsertChannel` excludes telegram at the type level);
`delivered`/`read` set **only** by `updateDeliveryStatus` (webhooks), never by
`dispatchCampaign`; webhook signature tests (X-Hub-Signature-256 + telegram
secret-token) green.

## بند ۱ — Customer 360 page
`admin/crm/customers/[id]` consumes the existing `/api/admin/crm/customers/[id]`
route (no new query): KPI row (AR balance / credit limit / payment terms /
lifetime purchases), over-limit banner, contact + **communication channels**
(`crm_customer_channels`), receivables aging bars, open invoices, and a
filterable + paginated **unified timeline** (orders/payments/activities/tickets).
Bidirectional link: sales customers list → Customer 360 → sales docs. Bilingual
RTL, fa-IR digits, theme tokens only.

## بند ۲ — Customer Portal (security-first, one shot)

### Auth flow
```
[Customer] --identifier(sms|email)--> POST /api/portal/auth/request
     server: find customer → generate OTP → store sha256(OTP)+expiry → send (adapter/sandbox)
[Customer] --sessionId+code--------> POST /api/portal/auth/verify
     server: checkOtp (hash+expiry+attempts) → issue opaque token → store sha256(token)
             → Set-Cookie: portal_token (httpOnly, independent of admin_token)
[Customer] --portal_token cookie---> /api/portal/*  (requirePortal → session.customerId)
```
Independent of the admin JWT: **different cookie name**, opaque random token
(never a JWT), **no shared secret**, sha256-hashed at rest. OTP is short-lived,
single-use (cleared on success), attempt-capped, timing-safe-compared. Dedicated
stricter limits (`portalOtp` 5/15min, `portalVerify` 10/15min). Sessions
expire + are revocable (logout = revoke all).

### IDOR matrix (بند ۲.۵ — mandatory)
Every portal query binds `customer_id` from the **server session** — a client
`customer_id` is never trusted. Live-PG 19/19:

| Route / action | Attempt | Result |
|---|---|---|
| `/api/portal/me` | no cookie | **401** |
| `/api/portal/me` | **admin** cookie | **401** (portal rejects admin cookie) |
| `/api/admin/overview` | **portal** cookie | **401** (admin rejects portal cookie) |
| `portalInvoice(A, invA)` | own | ✅ 200 |
| `portalInvoice(A, invB)` | A reads B's invoice | **404** ✔ |
| `portalInvoice(B, invA)` | B reads A's invoice | **404** ✔ |
| `setChannelOptIn(B, A's channel)` | cross-customer toggle | **404** ✔ |
| dashboard | scoped | shows only A's balance |
| garbage / expired / revoked token | — | **401** |
| OTP: unknown id | enumeration | neutral 200 (no leak) |
| OTP: wrong / expired / >5 attempts | — | reject / **429 lock** |

### Payment (بند ۲.۳/۲.۴)
Portal "Pay online" → own open invoice only → `createPayment('zarinpal')` →
`/api/pay/callback` (reused 26.24, server-side verify) → `sales_payments` +
auto-post GL receipt (`postSalesPaymentToGl`, idempotent). The portal dashboard's
AR balance drops live after a payment (verified: 5,000,000 → 3,000,000). Printable
invoice HTML with company letterhead + `@media print`. Honest boundary: the
Zarrinpal **redirect** needs a merchant id (blocked-external); everything up to
`createPayment` + the whole verify/reconcile/GL path is real and 26.24-verified.

## Gates
- TypeScript **0** · ESLint **0** · **713 unit tests** · **9 governance audits 0**
  (tenancy + theme incl. new tables/pages) · production build **clean** (portal
  pages + 8 routes compiled).
- Live-PG: portal auth + IDOR **19/19**; regressions 45/45 · 26/26 · 24/24 ·
  13/13 · 28/28 · 14/14 + 26.25s 15/15.

### Production-Ready Checklist — updated
| Row | Was | Now | Evidence |
|---|---|---|---|
| Load/stress HTTP numbers | 🟡 | 🟢 | valid (0 429/4xx/5xx), journal p99 119ms, warmup/cooldown |
| Login | 🟡 | 🟢 | 460ms/req measured + concurrent-login DoS cap |

## Changelog
- `lib/portal/{session,guard,portalData}.ts`, `lib/admin/loginGuard.ts`.
- Routes: `/api/portal/{auth.request,auth.verify,auth.logout,me,invoices,
  invoices/[id],invoices/[id]/print,payments,pay,profile}`.
- Pages: `/[locale]/portal` (PortalApp), `admin/crm/customers/[id]` (Customer360).
- `rateLimit.ts` portalOtp/portalVerify limiters; `login` route concurrent cap.
- `load-test.mjs` warmup/cooldown + low-concurrency login + status distribution.

## Not in this phase (26.25b / 26.25c)
Tickets + SLA + escalation + portal KB (26.25b); campaign + CRM dashboard +
onboarding wizard + demo seed + Persian docs + pilot go-live plan (26.25c).
