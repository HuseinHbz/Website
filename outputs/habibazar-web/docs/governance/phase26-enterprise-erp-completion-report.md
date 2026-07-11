# Phase 26 — Enterprise ERP Completion (Final Report)

Closure report for the "Enterprise ERP Completion" master prompt. The phase was
executed audit-first (26.0), then each sub-phase closed only its code-verified
gaps — nothing existing was rebuilt or duplicated (already-exists exception),
nothing was faked. Every item below is unit-tested, RBAC/zod/audited on the API
side, bilingual (fa/en, RTL/LTR) in the UI, and verified against a fresh, real
PostgreSQL database with an ephemeral round-trip test before commit.

Baseline audit: `docs/governance/phase26-erp-completion-audit.md`
(16 existing modules verified ✅ and reused; only the ❌ gaps were built).

## 26.0 — Audit & Architecture Review
- Full module inventory (engine / data layer / API / UI per module) with
  code-verified gaps per sub-phase, plus the DB/API/UI gap summary that became
  the execution plan for 26.1–26.6.

## 26.1 — Purchasing (commit `44aa6ca`)
- `purchase_documents.priority` (low/normal/high/urgent) + priority badge and
  form select; lines gained `product_id` (indexed) + `received_qty`.
- **Budget gate**: `submitDocument` now runs the existing pure `validateBudget`
  against the department's committed spend for the document's year — over-budget
  submits return 400 with the budget position and stay `draft`.
- **GRN → inventory**: `receiveDocument` writes real `inv_moves` receipt rows
  per product line (at line cost), tracks `received_qty`, supports partial
  receive (`partial` → `received`); service lines are ignored;
  `convertDocument` carries `productId` so PR→PO→GRN keeps product linkage.
  Receive dialog with warehouse select + per-line quantities.
- **RFQ comparison**: `compareQuotes` (+ `?compare=` endpoint + modal) lists
  every vendor quotation linked to an RFQ cheapest-first with vendor
  score/grade. Quotation form gained a linked-RFQ selector.
- Live-PG: budget block (available computed), partial→full GRN round-trip,
  compare ordering — 5 tests.

## 26.2 — Invoice & Document Designer (commit `f75fc07`)
- **Party identity (حقیقی/حقوقی)**: `sales_customers.kind/national_id/reg_no/
  economic_code` end-to-end (API schema, data layer, Sales Center form with
  kind-dependent inputs + badge). Sales-sourced documents print the buyer's
  Reg. no / National ID / Economic code / Tax no in the party block
  (individuals: national ID only).
- **Email export**: shared `sendMail()` (site_settings SMTP, fails closed when
  unconfigured, not gated by notify toggles) + `POST /api/admin/erp/documents/
  email` (renders + attaches print-ready HTML, audited `doc.email`) + Email row
  action/modal.
- **Barcode element**: dependency-free pure Code 39 SVG engine
  (`src/lib/erp/barcode.ts`, 5 unit tests) + `DocTemplateConfig.showBarcode`
  (opt-in, designer toggle) rendering the document number's barcode.
- Live-PG: company + individual party identity on created/rendered invoices,
  barcode on/off via template, SMTP fail-closed — 4 tests.

## 26.3 — Treasury (commit `c5ae46b`)
- **Live bank balances**: `listAccounts` computes opening balance + every
  imported statement movement per account.
- **Cash-flow dashboard**: pure `cashFlowSeries` (trailing N-month bucketing of
  receipts vs payments, sign-safe, totals, deterministic 3-month moving-average
  forecast across year ends; 3 unit tests) → `cashFlow()` over the real
  `sales_payments`/`purchase_payments` ledgers → `?view=cashflow` → Finance
  Banking "Cash flow" section (balance/in/out/net KPIs, per-account chips,
  monthly bars + dashed forecast rows; CSS bars, no new chart dependency).
- Live-PG: balance = opening + movements; monthly bucketing + forecast + bank
  position — 2 tests.

## 26.4 — Sales completion (commit `6298926`)
- Pure `salesPerformance.ts`: attainment status, monthly invoiced vs
  `sales_targets` with straight revenue commission (invoiced × rate),
  least-squares trend forecast (clamped ≥0, MA fallback), `runStatement`
  running-balance ledger — 6 unit tests.
- `GET/POST /api/admin/erp/sales/performance` (set target per YYYY-MM, upsert,
  audited) + `?statement=<customerId>` on the customers route.
- Sales Center: Performance dashboard section (target-vs-invoiced bars,
  attainment badges, commission, forecast, inline set-target form) + customer
  Statement modal (invoices/credit notes vs payments, running balance).
- Live-PG: target upsert + attainment/commission from real invoices; 4-line
  statement (3,000 − 1,800 = 1,200 due) — 3 tests.

## 26.5 — Multi-company & intercompany (this commit)
- `erp_companies` legal identity (reg_no / national_id / economic_code /
  tax_no / address / phone) across migration, `listCompanies`, the
  `company.create` API and a proper creation modal (replacing window.prompt).
- **Intercompany engine** (`src/lib/erp/intercompany.ts`, pure + tested):
  mirrored balanced entry pairs over the seeded clearing accounts
  **1150 Due From Affiliates / 2150 Due To Affiliates** with 1010 Bank as the
  cash leg — `transfer` (fund) and `settle` (repay). `bookIntercompany` posts
  the two company-scoped entries atomically-per-entry with audit; the clearing
  accounts offset in consolidation. Administrator-gated API action
  `intercompany.transfer` + Reports-tab modal.
- Branches remain by reuse (numbering scopes / warehouses / departments) — no
  duplicate branches table.

## 26.6 — AI Financial Assistant completion (this commit)
- **Payment fraud scan**: pure `scanPaymentAnomalies` (duplicate same-party/
  amount/date double-pays + >5×-median outliers over both payment ledgers;
  unit-tested) merged into the assistant's deterministic anomaly list.
- **Deterministic forecast series**: the grounded snapshot now carries 6-month
  monthly sales + purchase-spend series with 3-month least-squares trend
  forecasts (reusing `forecastSales` — no second forecasting engine), so
  `forecast`-type answers are grounded in real trends.
- Everything still flows through the ONE shared AI engine (`runCompletion`)
  with audit + telemetry; the LLM never touches the database.

## Live-PG verification (26.5/26.6)
- Company legal fields persist and list; intercompany transfer books two
  posted, balanced, company-scoped entries; HQ shows 1150 net debit 1,000 and
  the branch 2150 net credit 1,000; consolidation offsets exactly; settlement
  returns both positions to zero; same-company/missing-company inputs rejected
  — 3 round-trip tests.

## Gates (every sub-phase, before its commit)
TypeScript 0 errors · ESLint 0 warnings · vitest all green (346 tests after
this phase) · 7 governance audits pass (tokens/content/reuse/deps/links/i18n/
ui) · production build clean · ephemeral live-PostgreSQL round-trip per
sub-phase (17 round-trip tests total), test DB dropped afterwards.

## Honest boundaries (unchanged)
- Document "PDF" export remains print-ready HTML → browser Save-as-PDF (the
  platform's deliberate no-heavy-dependency stance); email ships that HTML.
- Email requires the maintainer's SMTP credentials in Settings — the API fails
  closed with a clear message until configured.
- The AI assistant requires a configured provider key; the deterministic scans
  (anomalies, forecasts) work without it.
