# Phase 26.24b — Closeout: settling core debt before the horizontal phases

Five open items from 26.23 / 26.24 that would have multiplied through every later
CRM/HRM phase. No new scope. Audit-first: each بند is answered explicitly —
**done**, **already existed & verified**, or **impossible for a stated reason**.

Execution order 1 → 6.

---

## بند ۱ — BUG-008: purchase invoice auto-post to GL

### ۱.۱ Finding (proof of the prior state)
**Did NOT exist — built.** Audit of `src/app/api/admin/erp/purchasing/route.ts`
and `purchasingData.ts` showed the purchase invoice → GL poster
(`postPurchaseInvoiceToGl`) was only reachable through the **manual, admin-only
`doc.post`** action. There was **no auto-post on confirm/approve**, unlike sales
(which auto-posts on confirm since 26.23). Because supplier payments *do* post to
the GL (`recordPayment → postPurchasePaymentToGl`, Dr AP / Cr Bank), an invoice
that was paid but never posted **debited AP that had never been credited → AP
drifted negative.**

### ۱.۲ Fix (built)
- **`confirmPurchaseInvoice(docId)`** (new) — sets `status='confirmed'` then
  auto-posts through the existing `postPurchaseInvoiceToGl` (Dr Inventory `1200`
  + Dr VAT `2100` / Cr Accounts Payable `2000`), via the configurable
  `gl_map_*` map in `erp_settings` (no parallel map). Closed fiscal period fails
  **loudly** and rolls the status back (never "confirmed but uncredited").
  Idempotent via the `gl_entry_id` guard.
- The poster now also stamps the document's **`company_id`** (entry) and
  **`cost_center_id`** (lines) + currency/exchange-rate — tenancy + 26.11
  analytics carry-through.
- **`voidPurchaseInvoice(docId)`** (new) — books a balanced **reversal** entry
  via the 26.23 `reverseEntry` (two-way `reversal_of ⇄ reversed_by`), idempotent.
- Route actions **`doc.confirm`** / **`doc.void`** (zod + RBAC + IP audit).

### ۱.۳ Numeric AP proof (live-PG, `scripts/verify-2624b.ts`)
| Step | AP balance (account 2000, posted) |
|---|---|
| **Old bug** — pay an *unposted* invoice (10,900,000) | `0 → −10,900,000` ❌ negative |
| **Fix** — confirm auto-posts (Cr AP) | `−10,900,000 → 0` (+10,900,000) |
| Re-confirm (idempotent) | unchanged |
| Full payment (Dr AP) → this invoice's delta | **exactly 0** |
| Self-heal: post the stranded invoice | **GLOBAL AP = 0, non-negative** ✔ |
| Trial balance | **balanced** |

**13/13 assertions passed.** The before/after numbers show AP going negative
without the fix and settling to exactly zero (non-negative) with it.

### ۱.۴ UI
GL-entry link column already existed in the purchase documents list (added in
26.23). Added row actions **"Confirm & post"** (draft invoices) and **"Void"**.

---

## بند ۲ — BUG-009: missing unit tests (two-phase debt)

Added `src/lib/erp/__tests__/closeout-2624b.test.ts` (15) — behaviours that were
only covered by live-PG scripts are now fast regressions. Total **666 → 684**
(+18 incl. chartRtl).

| بند | Behaviour | Test |
|---|---|---|
| ۲.۱ | Reversal is a balanced debit↔credit mirror; memo preserved / null-defaulted | `reversal entry` ×2 |
| ۲.۱ | (DELETE void→400 / draft→allowed is a thin route status-guard — verified by the 26.23 journal route + live-PG; the accounting invariant is unit-tested here) | — |
| ۲.۲ + ۳ | maker=checker→violation; **delegate acting on behalf of the creator→violation**; genuine third party→ok; non-JE→ok | `maker/checker` ×4 |
| ۳ | self-delegation & cyclic (A→B while B→A) rejected; valid third-party allowed | `delegation cycle` ×3 |
| ۲.۳ | lead convert: already-converted (idempotent), non-qualified reject, email/phone dedup link, create | `lead conversion` ×4 |
| ۲.۴ | purchase invoice posting balances Σdr=Σcr=total, AP credited by gross, net→inventory, VAT→2100; zero-VAT still balances | `purchase invoice → GL` ×2 |

The maker/checker, cycle and conversion predicates were extracted into pure,
reusable functions (`isSeparationViolation`, `wouldCreateDelegationCycle` in
`approval/engine.ts`; `decideLeadConversion` in `crm/leads.ts`) and the routes
now call them — so the test exercises the exact code path production runs.

---

## بند ۳ — self-approval hole via delegation

**Hole existed — fixed.** The 26.23 maker≠checker guard checked only
`row.createdBy === user.id`. But `resolveActor` lets a user act **on behalf of** a
principal via `approval_delegations`. So if creator **A** delegated to **B**, then
**B approving A's own journal entry** carried `onBehalfOf = A` (the effective
decision owner) yet passed the guard (nominal actor B ≠ A).

**Fix (`actOnRequest`)** — the SoD check moved *after* `resolveActor` and now
rejects when either the acting user **or the on-behalf-of principal** is the
creator (`isSeparationViolation`). **`createDelegation`** now rejects
self-delegation and cyclic delegation (an active reverse B→A) at creation
(`wouldCreateDelegationCycle`). Unit-tested (بند ۲ table) + live-PG (assertions
11–12).

---

## بند ۴ — real Load/Stress numbers (🟡 → 🟢)

New CI job **`load-test`** (`.github/workflows/ci.yml`): postgres:16 service →
`npm run build` → `next start` on a temp port → `scripts/load-test.mjs` on the hot
routes (health, login, journal, sales docs, overview) + a **5-minute RSS watch**.
Soft gate (`continue-on-error`): fails only on 5xx; latency prints as a warning so
a perf regression stays visible without breaking the build.

**Real measured numbers** (local `next start`, live PostgreSQL, 20 conns × 10s):

| Route | p50 | p95¹ | p99 | req/s | 5xx |
|---|---|---|---|---|---|
| health-live | 55ms | — | 91ms | 349 | **0** |
| login (POST, bcrypt) | 27ms | — | 828ms | 422 | **0** |
| journal-list | 76ms | — | 108ms | 256 | **0** |
| sales-docs | 69ms | — | 95ms | 284 | **0** |
| overview | 100ms | — | 131ms | 195 | **0** |

¹ autocannon's histogram exposes `p97_5`, not `p95`; the script falls back to it.
p50/p99 are exact. **Zero 5xx across every route.** login's p99 tail is bcrypt
work factor (expected, not a defect).

**Memory (5-min RSS watch, sampling /health deep):** `743MB → 273MB`, stabilising
flat at **273MB** for the last ~4 minutes (post-build GC settling). Growth −63%,
i.e. **no leak** (`✅ no sustained RSS growth`).

---

## بند ۵ — print & RTL (real audit, not assumption)

### ۵.۱ Print stylesheet (built)
`@media print` block in `globals.css`: hides the app shell (`aside`, `header`,
breadcrumb, buttons, `.no-print`), forces **A4** + light print-safe ink (dark
theme neutralised), **repeats table headers** across pages
(`thead { display: table-header-group }`, `tr { page-break-inside: avoid }`),
shows a **company letterhead** (`.print-company-header`, populated from
`erp_settings` — name + reg/economic/national IDs) and a page-number counter.
Wired into the **Reporting Center** (trial balance, income statement, sales/
inventory/asset registers…) and the **Finance Center** statement views (trial
balance / income statement / balance sheet) with a **Print** button + print-only
header. TTMS exports CSV (portal format) and prints through the same report path.

### ۵.۲ RTL chart audit (real defects found + fixed, with test evidence)
**"Font inheritance" was NOT the whole story.** Audit of every recharts chart
(`WidgetChart`, `ViewsChart`, `PurchasingCharts` — the finance/executive/
purchasing dashboards) found genuine RTL bugs:
- **X-axis was always LTR** (oldest→newest left→right) even in Persian.
- **Numbers were Latin digits**, never fa-IR, on axes and tooltips.
- Tooltips had no `direction: rtl`.

Fix — pure, unit-tested helper `src/lib/admin/chartRtl.ts`
(`faDigits`, `axisTickFormatter`, `rtlChartProps`; 3 tests) applied to all three
charts: in Persian the **X-axis is `reversed`**, the **Y-axis moves to the right**,
and **axis ticks + tooltips render fa-IR digits** with RTL direction. Locale is
threaded from each dashboard (`useAdminLocale`). Evidence: `chartRtl.test.ts`
proves `faDigits('1403/05') → '۱۴۰۳/۰۵'` and `rtlChartProps(true) → {xReversed:true,
yOrientation:'right'}`; the diff shows the props applied on every `<XAxis>/<YAxis>/
<Tooltip>`.

---

## بند ۶ — gates & outputs

| Gate | Result |
|---|---|
| TypeScript | **0** |
| ESLint | **0** |
| Unit tests | **684** (666 → +18) |
| Governance audits | **9 / 9 = 0** |
| Production build | **clean** |
| Live-PG بند ۱.۳ (AP non-negative) | **13/13** |
| Regression 26.21 simulation | **45/45** |
| Regression 26.23 GL/CRM | **26/26** |
| Regression 26.24 hardening/Iran | **24/24** |
| Regression 26.20 self-heal | **28/28** |

### Production-Ready Checklist v1 — 🟡 → 🟢
| Area | Was | Now | Evidence |
|---|---|---|---|
| Load/stress HTTP numbers | 🟡 (script only) | 🟢 | measured p50/p99 + zero 5xx (بند ۴ table) |
| Memory leak | (implicit) | 🟢 | 5-min RSS flat at 273MB, −63% growth |
| Purchase sub-ledger → GL | 🟡 (manual only) | 🟢 | auto-post on confirm, AP non-negative proof |
| Maker/checker separation of duties | 🟡 (nominal actor only) | 🟢 | effective-owner guard + cycle rejection, tested |

## Changelog
- `purchasingData.ts`: `confirmPurchaseInvoice`, `voidPurchaseInvoice`; poster
  stamps company_id/cost_center_id/currency.
- purchasing route: `doc.confirm` / `doc.void` actions; PurchasingCenter UI
  actions (Confirm & post / Void).
- `approval/engine.ts`: `isSeparationViolation`, `wouldCreateDelegationCycle`
  (pure). `approvalData.ts`: effective-owner SoD guard + delegation cycle
  rejection. `crm/leads.ts`: `decideLeadConversion` (pure) + convert route wired.
- `lib/admin/chartRtl.ts` (pure) + RTL/fa-IR on WidgetChart/ViewsChart/
  PurchasingCharts. `globals.css`: financial-report print stylesheet.
  ReportingCenter + FinanceCenter print buttons + letterhead.
- Tests: `closeout-2624b.test.ts` (15), `chartRtl.test.ts` (3).
- CI: `load-test` job. `scripts/load-test.mjs` rewritten (auto-login, p50/p95/p99,
  5xx gate, RSS leak watch). `scripts/verify-2624b.ts` (live-PG proof).

## Honest boundaries
- The DELETE void→400 / draft→allowed status-guard stays a thin route check
  (unit-tested at the accounting-invariant level; route + live-PG cover the HTTP
  status). No new heavy dependency; print stays browser Save-as-PDF.
