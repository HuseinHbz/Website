# Phase 26 — Enterprise ERP: Multi-Currency & Tax Engine

Phase 26 is a large ERP mandate. This pass delivers the two **genuinely missing,
correctness-critical foundations** the existing ERP lacked — multi-currency
(Iranian Rial / Toman) and a real tax engine — as pure, unit-tested cores wired
into PostgreSQL. It is not a rewrite; every existing ERP module is preserved.

## Audit (what already exists — reused, not duplicated)

The ERP already has: double-entry **Finance/GL** (chart of accounts, journal,
trial balance, income statement, balance sheet, fiscal periods), **Sales**
(customers/quotes/orders/invoices/payments/credit), **Inventory** (FIFO/LIFO/
WAVG, warehouses, moves), **Assets** (depreciation/maintenance), **Project
Center + Costing**, **Document Engine** (10 doc types + QR verify), **Reporting**
(7 reports), **Numbering Engine**, **Global Search**. These were **not**
recreated.

Genuine gaps found: **no multi-currency at all**, **no real tax engine** (only a
flat per-line `taxPct` in sales), and **no purchasing module**. This pass closes
the first two (the correctness-critical accounting foundations); purchasing is a
large separate module documented as remaining.

## What shipped (real, verified)

### Multi-Currency Engine (`src/lib/erp/currency.ts`, pure + tested)
- Base unit **Iranian Rial (IRR)**; **Toman (IRT)** a first-class display unit
  (exact 10:1). Built-in IRR/IRT/USD/EUR/AED.
- `convert(amount, from, to, rates)` through the Rial base (exact cross-rates,
  rounded to target decimals), `toBase`, `rialToToman`/`tomanToRial`,
  `exchangeDifference` (FX gain/loss), `formatMoney` (localized, Persian digits +
  Rial/Toman words), `dualRialToman` (show both simultaneously).

### Tax Engine (`src/lib/erp/tax.ts`, pure + tested)
- `computeTaxes(base, rules, {exempt})` — VAT/custom **add**, withholding
  **subtracts**; tax groups, exemptions, per-rule enable. Iran standard **VAT 9%**
  + withholding 5/10% built in. `extractInclusive` (back out VAT from a
  tax-inclusive gross), `vatOf`. Distinct from the simple per-line `taxPct` in
  `sales.ts` — this is the reusable rules engine.

### PostgreSQL schema (idempotent, `migrate.ts`)
- `erp_currencies` (seeded IRR/IRT/USD/EUR/AED) + `erp_exchange_rates`
  (per-currency daily Rial rate, unique per code×date) + index. Data layer
  `currencyData.ts` (`listCurrencies` with latest rate, `latestRates` RateMap,
  `rateHistory`, `setRate` upsert).

### API + UI
- `GET/POST /api/admin/erp/finance/currency` — currencies + latest rates,
  `?history=`, `?convert=&from=&to=`, and `setRate` (RBAC `edit` + zod + audit).
- Financial Center gains a **Currency** tab: set/override exchange rates, a live
  converter, and a rates DataTable. Bilingual (fa/en).

## Verification (all green)

- TypeScript 0 · ESLint 0 · **280 unit tests** (+ 9 currency, 4 tax + ...) · all
  7 governance audits (incl. i18n key added) · production build OK (96 pages).
- **Live PostgreSQL round-trip**: migrate seeds IRR (base) + IRT; set USD rate
  700 000 Rial → `latestRates` → `convert(2 USD → IRR)=1 400 000`, `→ IRT=140 000`. ✓

## Completion passes — every remaining item closed

All previously-remaining Phase-26 items were subsequently built and verified:
**Purchasing** (Phase 26.1 procure-to-pay incl. GL auto-posting + analytics),
**Company Profile branding** on documents (`/admin/company` + `loadCompanyProfile`
→ automatic logo/identity/bank/seal/signature on every generated document),
the visual **Invoice Designer** (`doc_templates` + seeded official/unofficial/
tax/service variants, designer tab with live preview, `safeAccent` CSS-injection
guard, per-document `template_key`), **Banking** (statement auto-reconciliation
engine + cheque lifecycle state machine + petty cash with low-balance flag, all
in a Finance Banking tab), **multi-company consolidation** (`erp_companies` +
`gl_journal_entries.company_id`, `loadTallies(companyId?)`, pure
`consolidateTallies`, per-company/consolidated reports UI), and the **AI
Financial Assistant** (`financeAi.ts` deterministic anomaly scan + grounded
prompts through the shared `runCompletion`, dashboard card). Each item shipped
with unit tests + a live PostgreSQL round-trip. **No Phase-26 item remains open.**

## Preserved (zero regression)

✓ All existing ERP modules (Finance/Sales/Inventory/Assets/Projects/Documents/
Reporting/Numbering) · ✓ PostgreSQL-native · ✓ RBAC + audit on every write · ✓
bilingual.
