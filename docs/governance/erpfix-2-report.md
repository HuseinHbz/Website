# ERPFIX-2 — Currency in the GL: base-Rial lines, realized FX gain/loss, base-amount thresholds

Covers BUG-ERP-03 (`erp-audit-report.md`).

## بند۰ — Audit-first (completed before any code)

Confirmed the audit's claim exactly by direct read: `postSalesInvoiceToGl`
(`salesData.ts:150-193` at the time of reading) and `postPurchaseInvoiceToGl`
(`purchasingData.ts:598-632`) passed `subtotal`/`tax_total`/`total` — the
document's raw TRANSACTION-currency figures — straight into
`salesInvoicePostingLines`/`purchaseInvoicePostingLines`, which write them
directly as `debit`/`credit` on `gl_journal_lines`. The entry header already
stored `currency`/`exchange_rate` for DISPLAY, but the actual ledger amount
was never multiplied by the rate. `postSalesPaymentToGl`/
`postCustomerRefundToGl`/`postPurchasePaymentToGl` (`glPosting.ts`) were
worse — they ignored `currency`/`exchange_rate` on the payment row entirely,
even though those columns already existed (26.7/26.8). `sales_documents`/
`purchase_documents` already have a `base_total` column (26.7) that nothing
upstream of the GL actually used for its own threshold checks
(`requiredApprovalLevels`, `validateBudget`, `evaluateCredit`) — all three
read the raw `total`. `revaluation.ts`/`revaluationData.ts` were confirmed
to read `sales_documents`/`purchase_documents`/`assets` fields directly
(not `gl_journal_lines`), so this phase's change to how GL lines are
written does not affect or double-count revaluation's own FX delta — audited,
untouched.

`deploy/erp-fx-survey.ts` (read-only) run against the current dev DB: 0
non-IRR documents/payments exist yet (no pilot/production FX data to
migrate) — so the fix is purely structural for this install; the survey
script itself stays available for a real deployment with FX history.

## بند۱ — BUG-ERP-03: GL lines in transaction currency instead of Rial base

**Status: built-new.**

**decision_gate:** the master prompt's own gate ("if the DB already has
real FX postings, how should they be corrected?") does not apply to this
install — `erp-fx-survey.ts` found zero. The mechanism this bullet asked
for either way (remediation script, dry-run by default) was built
regardless, per the gate's own `notes`.

- `src/lib/erp/money.ts` (new): the ONE place a transaction-currency amount
  is converted to Rial base — `toBase(amount, rate, precision)` +
  `roundTo`/`balanceResidual`. Unit-tested.
- `postSalesInvoiceToGl`/`postPurchaseInvoiceToGl`: `net`/`tax` are
  converted via `toBase` BEFORE being handed to the existing pure engines
  (`salesInvoicePostingLines`/`purchaseInvoicePostingLines` — untouched,
  per the instruction not to touch the pure engines unless the item says
  so); `baseTotal = baseNet + baseTax` is derived rather than independently
  converted, so the AR/AP control line balances exactly with no separate
  rounding residual to chase. The header's own `total`/`exchange_rate`
  columns now store the base total + the document's real rate (previously
  stored the raw total next to the rate, which was internally
  inconsistent).
- `gl_journal_lines.fx_amount`/`fx_currency` (new, nullable, additive
  migration): the ORIGINAL transaction-currency amount is preserved on the
  AR/revenue/VAT (or inventory/VAT/AP) lines of a non-IRR document — never
  discarded.
- `postSalesPaymentToGl`/`postPurchasePaymentToGl` (`glPosting.ts`): now
  read the payment's own `currency`/`exchange_rate` AND the source
  document's registered rate. Bank posts at the SETTLEMENT rate; AR/AP is
  relieved at the INVOICE's own registered rate; the difference is a
  REALIZED FX gain/loss booked on the already-seeded 4900 (gain, credit) /
  6980 (loss, debit) accounts — never silently absorbed into AR/AP or Bank.
  `postCustomerRefundToGl` converts through its own rate (a refund is
  always created at the original credit note's rate, so no separate
  settlement-vs-invoice split applies there).
- Thresholds now compare `base_total`, not raw `total`:
  `submitDocument` (purchasing approval levels + budget — the department's
  committed-spend sum also switched to `COALESCE(base_total,total)`),
  `evaluateCredit`'s call site in the sales confirm route, and
  `customer360Data.ts`'s `openInvoices`/`customerArBalance` (AR
  aging/credit-guard balance — a real related finding, see بند۲).

## بند۲ — Related finding, fixed in-phase (not deferred)

`customer360Data.ts`'s `openInvoices` (feeds `customerArBalance` →
`evaluateCredit`, the credit-guard check wired into sales confirm) summed
`d.total` and `SUM(amount)` on payments — both raw transaction-currency,
same defect class as the audit's own evidence list. Fixed to
`COALESCE(d.base_total, d.total)` and `SUM(amount*exchange_rate)` — the
credit limit is Rial-denominated, so a 10,000 USD invoice must not be
compared against it as "10,000".

## بند۳ — Finding-for-later (out of this phase's scope)

The master prompt's `audit_first` list also named the **Treasury payment
matrix** (`src/lib/erp/treasury/payments.ts`/`approval` tiers) as a
threshold that reads a document/payment amount. Audited: it reads
`payment_orders.amount`, a Treasury-native amount that is NOT yet
multi-currency-columned the way `sales_documents`/`purchase_documents` are
— giving it the same base-amount treatment would mean adding
`base_amount`/schema to `payment_orders` itself, a genuinely separate
schema change outside BUG-ERP-03's own evidence list (which only cited
sales/purchase/GL paths). Logged here rather than silently fixed, so a
future ERPFIX phase can scope it on its own.

## بند۴ — Already-existing, verified, NOT rebuilt

- `sales_documents`/`purchase_documents.base_total`, `.currency`,
  `.exchange_rate` columns (Phase 26.7/26.8) — reused as the SOURCE of the
  conversion, not rebuilt.
- `4900`/`6980` (Currency Gain/Loss) accounts — already seeded since
  26.8's revaluation engine; reused for realized (not just unrealized) FX,
  not duplicated.
- `revaluation.ts`/`revaluationData.ts` (unrealized FX on open
  positions) — audited for compatibility (بند۰), confirmed independent of
  this phase's change, left untouched.
- `insertPostedEntry`'s `currency`/`exchangeRate` options (ERPFIX-1) —
  reused by every payment poster in this phase instead of a new mechanism.

## بند۵ — Live PostgreSQL proof

`scripts/verify-erpfix-2.ts` — **13/13 assertions pass**, registered as a
regression suite in `scripts/ci-regressions.ts`. Through the PRODUCTION
functions only (`postSalesInvoiceToGl`, `postPurchaseInvoiceToGl`,
`postSalesPaymentToGl`, `postPurchasePaymentToGl`, `trialBalance`/
`loadTallies`), asserting real account balances (CLAUDE.md rule 15):

- red (pre-fix behavior, confirmed by direct code read in بند۰, not
  re-run against old code — the fix was applied in the same pass per the
  no-fake rule's own per-item protocol, since reproducing the bug would
  have required reverting working code only to revert the revert):
  a 100 USD invoice would have posted AR/revenue as "100", not 60,000,000.
- green: AR = 60,000,000, revenue = 60,000,000 credit, `fx_amount` = 100
  USD preserved on the AR line.
- green: a 40 USD receipt at a different rate (650,000 vs the invoice's
  600,000) — bank 26,000,000, AR relieved at 24,000,000 (its own rate),
  REALIZED FX GAIN 2,000,000 on 4900.
- green: an odd rate (600,001.7, EUR) entry still balances exactly
  (Dr = Cr to the cent).
- green: the purchase side mirrors it — AP 600,000,000 on a 1,000 USD
  invoice at 600,000; settling at a worse rate (620,000) books a REALIZED
  FX LOSS of 20,000,000 on 6980; AP correctly returns to exactly 0.
  `requiredApprovalLevels` on the real 600,000,000 base exposure resolves a
  higher approval tier than the same document's raw total would.
- green: the production `trialBalance()`/`loadTallies()` engine stays
  balanced (Σdebit=Σcredit) across every FX posting in the run.

Gates: TypeScript 0 errors · ESLint 0 · `npm run build` clean · full
`npm run audit` (14 governance audits incl. the 2 ERPFIX-1 gates) clean ·
1345/1345 unit tests (4 new, `money.ts`) · full regression suite **39/39
green**, run live against a fresh PostgreSQL database.

A first pass defaulted `fx_precision` to 0 (whole Rials) and broke 5
regression suites (26.21 simulation, 26.25 foundation, Phase 9, Phase 13,
Phase 14) whose sub-unit-precision scenarios rounded to 0 — a real,
caught-live defect, not a hypothetical one. Root cause: `toBase` forced
precision 0 on every conversion, including domestic (rate=1) IRR documents
that previously preserved 2-decimal amounts via `round2`. Fixed by matching
the existing 2-decimal convention (`money.ts`'s default + the
`fx_precision` seed). A second, separate bug surfaced the same way in
`customer360Data.ts`/the sales credit-check route: `base_total` is `NOT
NULL DEFAULT 0`, so `COALESCE(base_total, total)`/`base_total ?? total`
never fall back on a row whose `base_total` was never explicitly computed
— fixed to `CASE WHEN base_total>0 THEN base_total ELSE total END` /
`Number(base_total) || Number(total)`. Both fixes are captured in the file
list below; no contract-changes.md entry was needed since no regression's
own ASSERTION changed — their fixtures were exercising real, pre-existing
document rows that this phase's bugs (not the suites) mishandled.

`audit:gl-writes`'s written-reason allowlist line numbers for
`purchasingData.ts`/`salesData.ts` were re-synced after this phase's edits
shifted both lines (147→661, 187→202) — no behavior change, line-number
upkeep only, not a contract change.

## بند۶ — Required confirmations from the maintainer/accountant

- **No decision_gate was actually triggered** — `deploy/erp-fx-survey.ts`
  found zero existing non-IRR documents/payments in this database, so
  there is nothing to remediate yet. If a pilot or production database
  later shows non-zero counts, run `erp-fx-survey.ts` (read-only) then
  `erp-fx-remediate.ts` (dry-run by default) with the accountant's sign-off
  before `--apply`.
- **Finding-for-later needing a decision:** should Treasury's
  `payment_orders` gain its own `base_amount`/currency columns in a future
  phase, or is Treasury intentionally IRR-only for now? Not decided here —
  flagged for the maintainer.
- Rounding policy: `fx_precision` (`erp_settings`, default `2`) controls
  `toBase`'s rounding — kept at 2 decimals to MATCH the `round2` convention
  already used everywhere else in this codebase (`ledger.ts`, `sales.ts`, …);
  a first pass defaulted it to 0 (whole Rials) and broke 5 regression suites
  whose sub-unit precision-matrix scenarios silently rounded to 0 — caught
  live, not assumed, and fixed before this report closed. An accountant
  should still confirm 2-decimal Rial rounding is the long-term intended
  policy; this phase only made the existing convention consistent.

## New CLAUDE.md rule

> «هر خط دفتر کل به ریال پایه است؛ مبلغ ارز اصلی در `fx_amount`؛ تبدیل
> فقط با `money.ts`.»

(Added as rule 57, with the realized-FX-gain/loss and base_total-threshold
behavior spelled out in full.)
