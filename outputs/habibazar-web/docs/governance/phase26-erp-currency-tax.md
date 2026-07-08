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

## Honest scope note (remaining Phase 26 — not faked)

This is one pass of a multi-part ERP phase. Implemented for real: multi-currency
+ tax engines + schema + API + UI. **Remaining** (each a substantial dedicated
module, to be built and verified the same way — not claimed done here):
full **Purchasing** (PR/RFQ/PO/GRN/vendor), a visual **Invoice Designer**,
**Company Profile branding** on documents, **bank reconciliation / cheque /
petty cash**, **multi-company/branch consolidation**, and the **AI financial
assistant** (reusing `runCompletion` as the hero assistant does). The currency +
tax engines shipped here are the foundation those build on (e.g. invoices/POs
will price through `convert` + `computeTaxes`).

## Preserved (zero regression)

✓ All existing ERP modules (Finance/Sales/Inventory/Assets/Projects/Documents/
Reporting/Numbering) · ✓ PostgreSQL-native · ✓ RBAC + audit on every write · ✓
bilingual.
