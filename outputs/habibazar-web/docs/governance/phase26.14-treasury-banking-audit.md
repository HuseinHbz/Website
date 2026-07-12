# Phase 26.14 — Enterprise Treasury & Banking: Audit (AUDIT FIRST)

> Note: the prompt labels this "26.13"; that number was already used for the
> Business Operations Intelligence phase, so this Treasury phase is filed as
> **26.14** to avoid clobbering those docs/tables.

Code-verified audit. **NO FAKE / NO DUPLICATE / NO REBUILD.** ✅ reused, ❌ built.

## Existing (reuse)
| Capability | Where | Verdict |
|---|---|---|
| Bank accounts | `bank_accounts` table + Finance Banking tab | ✅ extend (add SWIFT/branch/account_type/company/status) — NOT a new table |
| Statement lines + auto-match | `banking.ts` `matchStatement` (amount+date-window+confidence), `reconciliationSummary`, `bank_statement_lines`, `bankingData.ts` | ✅ reuse/extend (smart matching + persisted matches) |
| Cheque lifecycle | `banking.ts` `CHEQUE_FLOW`/`canTransition`/`chequeStart`/`chequeKpis` + `cheques` table | ✅ reuse (add calendar/aging/risk) |
| Petty cash | `banking.ts` `pettyCashSummary` + `petty_cash_entries` | ✅ reuse |
| Cash flow forecast | `banking.ts` `cashFlowSeries` (MA-3) + `forecast.ts` (26.13) | ✅ reuse (liquidity 2.0 sources) |
| Currency exposure / FX | `financialIntelligenceData.currencyExposure` (26.11), `revaluation.ts` (26.8) | ✅ reuse (assets-vs-liabilities + realized/unrealized) |
| Payments/receipts data | `sales_payments`/`purchase_payments` + GL | ✅ reuse (payment_orders orchestrate, not replace) |
| Approval | 26.12 `createApprovalRequest` (payment_order doc type) | ✅ reuse |
| GL posting | `gl_journal_entries`/`_lines` + posting helpers | ✅ reuse (no second accounting engine) |
| AI | `runCompletion` + RAG + finance snapshot | ✅ reuse (treasury assistant) |
| RBAC / audit / reporting | `canDo`+`finance_role`, `logAction`, `reportData` | ✅ reuse |

## Gaps to build (❌)
Statement **import parsers** CSV/MT940/CAMT.053 + column mapping + duplicate
detection (M2, `bank_statements` header); **smart reconciliation** (name/
description similarity + suggested/matched/rejected + `bank_matches` audit, M3);
**payment orders** lifecycle draft→approval→approved→processing→completed→GL
wired to the approval engine (M4, `payment_orders`); **receipt** lifecycle + AR
settlement (M5, `receipt_transactions`); **cheque calendar/aging/risk** (M6,
reuse table); **cash position engine** + future buckets (M7, `cash_positions`);
**liquidity forecast 2.0** from AR/AP sources (M8, `treasury_forecasts`);
**treasury risk** exposure + realized/unrealized FX (M9, `currency_exposures`);
**AI treasury assistant** (M10, reuse runCompletion); **Treasury workspace** +
pages + nav (M11); **treasury reports** (M12); **treasury roles** additive over
finance_role (M13); tables + rollback (M14); 40+ tests + live-PG (M15).

## Design (no duplicate)
New pure engines under `lib/treasury/*`. `bank_accounts` is **extended** (the
treasury bank master), not duplicated as `treasury_bank_accounts`.
`bank_statement_lines` are the bank transactions; a `bank_statements` header
batches an import. GL posting reuses the existing journal — no second accounting
engine. Payment approval reuses the 26.12 platform.
