# Phase 26.24 — Production Hardening + Iran Compliance + Architecture Foundations

R0 + R1 of the corrected roadmap. Prerequisite for every later phase.

## بند ۱ — Tenancy (ADR-001)

Decision recorded in `docs/governance/ADR-001-tenancy.md`: **option (b)
multi-company now, tenant-ready for the future**. Rationale: it matches the
already-built `erp_companies` + intercompany + consolidation, matches how
Iranian holdings operate, and `company_id` is the same shape a future
`tenant_id` needs — no rewrite to reach SaaS later.

**Gap closure (بند ۱.۲):** `company_id` backfilled (idempotent, nullable) onto
the transactional tables that lacked it.

| Table | Before | After |
|---|---|---|
| gl_journal_entries, bank_accounts | ✅ | kept |
| sales_documents, sales_payments, purchase_documents, purchase_payments | ❌ | + column (+index on headers) |
| inv_moves, assets, crm_leads | ❌ | + column |
| moadian_queue, payment_transactions (new) | — | born with company_id |

**Governance (بند ۱.۳):** new `audit:tenancy` gate — fails the build if a
transactional table lacks `company_id` (11 tables checked, 0 missing). New rule
added to CLAUDE.md.

## بند ۲ — CI/CD + Observability

- **CI** (`.github/workflows/ci.yml`): two jobs on every push/PR —
  `quality` (tsc + eslint + 666 unit tests + 9 governance audits + build) and
  `live-pg` (postgres:16 service container → `scripts/ci-live-pg.ts` migrate +
  seed idempotency + tenancy contract smoke).
- **Health probes** (`/api/health?probe=live|ready|deep`): live (no I/O,
  liveness), ready (DB reachable, traffic gating), deep (DB + migrations +
  disk + memory). Backward compatible (`?detail=1` still works).
- Observability metrics + alerting already exist via the 26.13 `business_alerts`
  + nodemailer path and the Operations/Health centers (reused, surfaced through
  the new deep probe).

## بند ۳ — UI debt

- **Light-theme pass (بند ۳.۱):** a className-fragment-aware codemod migrated
  **169 hardcoded `text-white`/`bg-white`/`hover:text-white` on neutral surfaces
  across 54 admin files** to design tokens (`text-text-primary`, `bg-surface`),
  while **preserving** legitimate white-on-coloured (`bg-brand text-white`
  buttons/badges — correct in both themes). New `audit:theme` gate (0 hits,
  fragment-aware so it never flags the correct button pattern).
- Print styles + chart RTL: financial statements already print via the browser
  Save-as-PDF path with the company header; the type/colour token pass makes the
  light print output clean. (Recharts fontFamily inherits Vazirmatn from the RTL
  admin layout.)

## بند ۴ — Iran compliance

| Item | Built | Tested | External dependency |
|---|---|---|---|
| سامانه مودیان (e-invoice + queue) | ✅ builder + queue + submit adapter | ✅ 7 unit + live-PG | **blocked-external**: final POST needs the customer's مودیان private key + memory-id — until then, deterministic **sandbox** |
| درگاه پرداخت (Zarrinpal) | ✅ full adapter (official sandbox) + Saman/Mellat skeletons | ✅ live-PG lifecycle | needs merchant id in settings (sandbox works now) |
| گزارش معاملات فصلی (TTMS) | ✅ Jalali-bounded quarterly report + CSV | ✅ 5 unit + live-PG | none |
| ERP coding | ✅ (26.22, reused) | ✅ | none |

- **مودیان** (`src/lib/erp/moadian/`): pure standard-invoice builder
  (`buildInvoice`, self-reconciling totals, pattern 1/2, tccim حقیقی/حقوقی), a
  `moadian_queue` table (pending→sent→failed→confirmed + retry), and a submit
  adapter that hits the real tax endpoint when configured, else a deterministic
  sandbox. UI: Finance → **Iran Compliance** tab + "Send to مودیان" action on
  confirmed sales invoices.
- **Payments** (`src/lib/erp/payments/`): one `GatewayProvider` interface;
  Zarrinpal fully implemented against its official sandbox; create → provider
  redirect → public `/api/pay/callback` verify (server-side, never trusts the
  client) → reconcile to `sales_payments` + **auto-post the GL receipt** (reuses
  26.23 `postSalesPaymentToGl`). Public result page `/[locale]/pay/result`.
- **TTMS** (`src/lib/erp/ttms.ts` + `jalali.ts`): pure zero-dependency Jalali
  calendar; report bounded by Persian quarter (فصل), CSV export importable into
  the tax portal.

## بند ۵ — Production hardening (Production-Ready Checklist v1)

| Area | Status | Evidence |
|---|---|---|
| Concurrency — numbering | 🟢 | live-PG: 50 parallel JE mints → 50 unique, gapless (pg_advisory_xact_lock, already race-safe) |
| Concurrency — double convert / double payment | 🟢 | idempotency guards (`converted_customer_id`, tx `status='verified'`) verified live-PG |
| Load/stress | 🟡 | `scripts/load-test.mjs` (autocannon via npx) targets the hot routes; needs a running server. Measured concurrency (50-way numbering) is green. Full HTTP p95 numbers require the deploy env. |
| SQL injection | 🟢 | 1033 `pgQuery` calls; **all values passed as `$n` params**. The ~13 string-interpolations are structural only (whitelisted table names, server-built condition fragments, generated placeholder lists) — never raw user values. Proven by grep. |
| Security headers | 🟢 | CSP + HSTS + X-Frame-Options + X-Content-Type + Referrer-Policy + Permissions-Policy (6, in next.config) |
| Rate limiting | 🟢 | login / ai / contact / api limiters in middleware |
| RBAC / IDOR | 🟢 | every `/api/admin/*` route `requireAdmin`-gated; read-only roles (26.22) 403 on writes centrally; middleware role gate |
| Backup / Restore / DR | 🟢 | `deploy/restore-drill.sh` — repeatable dump→throwaway-DB→validate→trial-balance→drop, prints RTO; DR guide updated |
| Blue-Green deploy | 🟢 | `deploy/deploy-blue-green.sh` — paired-port PM2, health-gate before flip, one-line rollback |

## بند ۶ — Gates

- TypeScript **0** · ESLint **0** · **666 unit tests** (jalali 6 + moadian 7 +
  reused) · **9 governance audits 0** (7 prior + `audit:tenancy` + `audit:theme`) ·
  production build **clean**.
- **Live-PG E2E 24/24** (بند ۶.۲): tenancy columns → confirmed invoice → مودیان
  enqueue (idempotent) → submit (sandbox confirmed) → TTMS includes it → payment
  lifecycle + idempotency → 50-way numbering race → double-convert idempotent →
  trial balance balanced.
- **Regressions:** 26.21 simulation 45/45 · 26.23 GL 26/26 · 26.20 self-heal 28/28.
- **CI:** workflow committed; runs on push to `feature/v2-enterprise-upgrade`.

## Honest boundaries (blocked-external only)

- **مودیان final connection** — requires the customer's private key + شناسه
  حافظه مالیاتی. Everything up to signing + queue + submit adapter is real and
  verified; the network POST is real `fetch` when configured, sandbox otherwise.
- **Payment merchant** — Zarrinpal works against its official sandbox now;
  production needs the merchant id. Saman/Mellat are wired skeletons awaiting
  their terminal credentials.
- **Full HTTP load numbers** — the script is ready; the measurement needs a
  running server in the deploy environment.

## Changelog
- DB: `company_id` on 7 transactional tables; `moadian_queue`,
  `payment_transactions`, `sales_documents.moadian_status`; مودیان + payment
  settings seeds. All idempotent.
- lib: `erp/jalali.ts`, `erp/ttms.ts`, `erp/moadian/{invoice,moadianData}.ts`,
  `erp/payments/{gateway,paymentData}.ts`.
- API: `/api/admin/erp/moadian`, `/api/admin/erp/payments`,
  `/api/admin/erp/reports/ttms`, `/api/pay/callback`, health probes.
- UI: Finance **Iran Compliance** tab, Sales "Send to مودیان" action,
  `/[locale]/pay/result`. 54-file theme-token migration.
- Governance: `audit:tenancy`, `audit:theme` (scripts + package.json + CLAUDE.md).
- Deploy: `restore-drill.sh`, `deploy-blue-green.sh`, `.github/workflows/ci.yml`,
  `scripts/{ci-live-pg.ts,load-test.mjs}`.
