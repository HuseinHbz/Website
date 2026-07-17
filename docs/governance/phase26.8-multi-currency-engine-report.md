# Phase 26.8 — Enterprise Multi-Currency Conversion Engine + Revaluation Engine

Audit-first implementation of display-time currency conversion and FX
revaluation. **NO DATA MUTATION**: every stored financial document (sales/
purchase invoices, payments, journals, assets, inventory moves) keeps its
original currency, amount and registration rate forever — conversion happens
only at display time and revaluation only by *adding* journal entries.

## Task 1 — Currency architecture audit ✅
Currency-aware and REUSED (no duplicates built): `erp_currencies` +
`erp_exchange_rates` (daily/historical/manual rates), pure `currency.ts`
(convert via the IRR base with IRR/IRT/USD/EUR/AED built in, `toBase`,
`exchangeDifference`), `rialRateFor()`, 26.7's per-document
`currency`/`exchange_rate`/`base_total` columns, and the
`formatCurrency`/`fmtMoney` standard.
Gaps found and closed: assets stored a currency but no registration rate;
KPI aggregates summed raw mixed-currency totals; no per-user display
currency; no revaluation accounting; no FX reports.

## Task 2 — Conversion engine (IRR base) ✅
All conversion flows through the existing pure engine — IRR is the base,
IRT is exact 10:1, USD/EUR/AED convert via the daily Rial rate. The mandate
example holds end-to-end: asset **2000 USD** at registration rate
**200,000 Toman (2,000,000 Rial)** stores `original_currency=USD`,
`original_amount=2000`, `original_rate=2,000,000` and aggregates at
**4,000,000,000 Rial (400,000,000 Toman)**.

## Task 3 — Universal money formatter ✅
`formatMoney(amount, sourceCurrency, targetCurrency, rates)` in
`src/lib/format.ts`: converts via the Rial base then formats with the
target's symbol/fa suffix (`2000 USD → "400,000,000 تومان"`), plus
`convertFromBase(rial, target, rates)` for Rial aggregates. Unit-tested with
the mandate's exact numbers.

## Tasks 4–8 — Dashboard currency preference + dynamic conversion ✅
- **`CurrencyDisplayProvider` / `useDisplayCurrency` / `CurrencyPicker`**
  (`src/lib/admin/currencyDisplay.tsx`): a per-user preference (persisted per
  user id in localStorage), latest rates fetched once, and `money(rial)` that
  converts Rial aggregates into the chosen currency. Mounted globally in
  AdminShell; unknown-rate targets fall back to IRR with a "no rate set"
  badge — never a silent 1:1.
- **Rial-base aggregation** (query-level only; documents untouched): sales
  KPIs (invoiced/collected/credit notes/orders value/tax), top customers,
  monthly performance revenue, customer credit positions (Task 7 —
  receivables), vendor payables/spend analytics/overview (Task 7 — payables),
  all as `SUM(total × exchange_rate)` (legacy rows carry rate 1 → unchanged).
- **Assets (Task 5)**: registration `exchange_rate` column captured at
  create (immutable; recaptured only if the currency itself is changed);
  depreciation/book value now computed on the Rial base while
  `purchase_price`/`currency` stay original.
- **Inventory (Task 6)**: GRN receipts now write `inv_moves.unit_cost` in the
  Rial base (line price × the document's registration rate) so FIFO/LIFO/WAVG
  valuation is uniform in Rial and converts cleanly (forward-only — existing
  moves untouched).
- **Banks (Task 8)**: consolidated Total Cash converts each FX account's
  balance to Rial via its currency's latest rate; per-account balances stay
  in their own currency.
- **Six dashboards** now render money KPIs through the display-currency hook
  with a picker: Finance, Sales, Purchasing, Inventory, Assets, Executive.

## Task 9 — Currency Revaluation Engine ✅
Pure `src/lib/erp/revaluation.ts` (6 unit tests): `revaluate(positions,
rates)` over immutable booked rates (payables invert — a rising rate on
foreign debt is a loss; positions without a current rate are skipped),
`revaluationEntryLines` (net gain → **Dr 1190 FX Revaluation Adjustment /
Cr 4900 Currency Gain**; net loss → **Dr 6980 Currency Loss / Cr 1190**),
`exposureByCurrency`. Data layer `revaluationData.ts` collects live FX
positions (assets + open AR + open AP), and books **only the delta vs
previously booked revaluations** (`reference = fx-reval:*`) as ONE posted,
balanced journal entry — re-running books nothing until rates move again.
API `GET/POST /api/admin/erp/finance/revaluation` (booking is
administrator-only, audited) + a Revaluation section in Finance → Currency
(exposure table, gain/loss/delta cards, Book button, booked history).

## Task 10 — Exchange rate management ✅ (existing + completed)
Daily/historical rates per code×date (`erp_exchange_rates`), manual entry
via Finance → Currency; every transaction keeps its registration-time rate
(26.7 columns + the new asset rate). "Market rate" remains manual entry —
no external rate API is wired (honest boundary).

## Task 11 — Reports ✅
Two new catalog reports (Reporting Center, module Financial):
**Currency Exposure** (per position: foreign amount, booked vs current rate,
booked vs current Rial value, unrealized G/L; summary gain/loss/net/booked)
and **Currency Gain/Loss (Exchange Differences)** (history of booked
revaluation entries with per-entry gain/loss/net). 11 catalog reports total.

## Task 12 — Permission & audit ✅
Rate changes remain `manage_settings`-gated (super_admin + administrator);
the audit entry now records **user, date, old rate and new rate**.
Revaluation booking is administrator-only and audited with entry no + delta.

## Task 13 + final verification ✅
Fresh live-PostgreSQL scenario (8 round-trip tests):
- Asset 2000 USD @ 2,000,000 Rial → stored original currency/amount/rate;
  book value 4,000,000,000 IRR; dashboard shows **2000 USD /
  400,000,000 تومان / 4,000,000,000 ریال / €1,818.18** from the same base.
- Invoice 5000 USD: stays USD/5000/rate-2M after the USD rate moves to
  2.5M — display converts (4000 USD equivalent of the Rial KPI), the stored
  document never changes.
- Revaluation: 7000 USD exposure × (2.5M − 2M) → **3,500,000,000 Rial gain**
  booked as one balanced posted entry (credit on 4900); immediate re-run
  books nothing; a further move to 2.6M books only the **700,000,000**
  incremental delta.

Gates: TypeScript 0 · ESLint 0 · **377 unit tests** (incl. 6 revaluation +
2 formatMoney suites) · 7 governance audits · production build clean.

## Honest boundaries
- Bank accounts appear in consolidated cash via current rates but are not
  revalued through the journal (they carry no booked rate); extendable by
  snapshotting a booked rate per account.
- Existing inventory moves keep their historical costs; only new GRNs write
  Rial-base costs.
- Market-rate feeds are manual; no external FX API dependency was added.
