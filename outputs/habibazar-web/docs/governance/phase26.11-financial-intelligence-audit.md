# Phase 26.11 — Financial Intelligence: Audit & Gap Map (AUDIT FIRST)

Code-verified audit of the existing Finance/ERP stack before building anything.
Per **NO DUPLICATE / NO FAKE / AUDIT FIRST**, everything ✅ is reused/verified;
only ❌ gaps are built. This maps the 15 requested modules against reality.

## Existing capabilities (reuse — do NOT rebuild)

| Capability | Where | Verdict |
|---|---|---|
| General Ledger + double-entry | `ledger.ts` (`trialBalance`/`incomeStatement`/`balanceSheet`/`financialKpis`/`normalSide`/`entryBalanced`), `ledgerData.ts` (`loadTallies`/`financeOverview`), tables `gl_accounts`/`gl_journal_entries`/`gl_journal_lines` | ✅ reuse |
| Accounting core | `accountingCore.ts`/`accountingData.ts` (periods lifecycle, CoA hierarchy, opening balance, year-end close, account statement) | ✅ reuse |
| AP / AR | derived from `purchase_documents`/`sales_documents` (`total-paid_total`), aggregated in finance snapshot | ✅ reuse |
| Sales + forecast + commission | `sales.ts`/`salesData.ts`/`salesPerformance.ts` (`forecastSales` least-squares, targets) | ✅ reuse |
| Purchasing + **budget check** | `purchasing.ts` `validateBudget` (available/over/`utilizationPct`) + per-doc `budget`/`department` | ✅ reuse (foundation) |
| Inventory valuation | `inventory.ts`/`inventoryData.ts` (FIFO/LIFO/WAVG) | ✅ reuse |
| Assets + depreciation | `assets.ts`/`assetData.ts`/`depreciation.ts` (+ free-text `cost_center`/`department`) | ✅ reuse |
| Treasury / Banking + cash forecast | `banking.ts` (`cashFlowSeries` MA-3), `bankingData.ts` | ✅ reuse |
| Multi-currency + display | `currency.ts`/`currencyData.ts`/`revaluation.ts`; `currencyDisplay.tsx` (`useDisplayCurrency`/`CurrencyPicker`), `format.ts` (`formatMoney`/`convertFromBase`) | ✅ reuse |
| Tax engine | `tax.ts`/`taxData.ts` + `tax_profiles` | ✅ reuse |
| Reporting Center | `reportData.ts` (11-report catalog) + `pivot.ts` (`groupBy`/`aggregate`/`toCsv`); Excel/CSV/JSON via `dataTableExport.ts` | ✅ reuse |
| AI Financial Assistant | `financeAi.ts` (`scanAnomalies`/`buildFinancePrompt`) + `/finance/ai` (grounded `runCompletion`, RAG-ready) | ✅ reuse |
| Executive dashboards | `executiveOverview.ts`, Dashboard Platform (`widgets.ts`/`widgetData.ts`) | ✅ reuse |
| RBAC | `canDo(role, action)` — `super_admin`/`administrator`/`editor` × `manage_users`/`manage_settings`/`delete`/`publish`/`edit` | ✅ reuse (extend) |

## Gaps to build (❌ → the real work of 26.11)

| Module | Requirement | Status | Plan |
|---|---|---|---|
| M1 | Enterprise Budget Management (7 types, versioning, approval draft→review→approved→locked, revision, history) | ❌ | `erp_budgets`/`erp_budget_versions`/`erp_budget_lines` + pure `budget.ts` + lifecycle |
| M2 | Budget vs Actual (variance, consumption %, over/under, forecast remaining, alerts, widgets) | ❌ | variance in `budget.ts`; actuals from POSTED GL lines by account×cost-center×period |
| M3 | Cost Center accounting (dept/branch/project/BU; `cost_center_id` on transactions; reports) | ❌ | `erp_cost_centers` + `gl_journal_lines.cost_center_id` + `costCenter.ts` |
| M4 | Profit Center (revenue/cost/profit/margin) | ❌ | `erp_cost_centers.kind='profit'` + `profitCenter()` from tallies-by-center |
| M5 | Forecasting engine (trend/MA/growth %/seasonal) revenue/expense/cash/profit | ❌ | general pure `forecast.ts` (reuses least-squares math) + `erp_forecasts` |
| M6 | Financial KPI engine (revenue/profit/cash/AR/AP/inventory) | ❌ | `kpiEngine.ts` over existing data layers + `erp_kpi_snapshots` |
| M7 | CFO Executive Dashboard | ❌ | new page reusing ledger/banking/sales/purchase/budget data |
| M8 | Department Manager Dashboard (scoped) | ❌ | new page scoped by cost-center assignment |
| M9 | Financial Alerts engine | ❌ | `erp_financial_alerts` + `alerts.ts` (budget>90%, cash shortage, AR overdue, FX) |
| M10 | AI Financial Analyst (root-cause) | ❌→extend | new `diagnose` action on `financeAi.ts` + `/finance/ai` (MoM deltas) |
| M11 | Reporting: Budget/Variance/Cost-Center/Profit-Center/CFO/Forecast + PDF/Excel/CSV | ❌→extend | add to `reportData.ts`; Excel/CSV reused; PDF = print-HTML (honest) |
| M12 | RBAC finance roles (CEO/CFO/Finance Mgr/Dept Mgr/Accountant) | ❌ | additive `finance_role` + cost-center scope (core 3-role auth untouched) |
| M13 | Multi-currency intelligence across all analytics | ❌→reuse | wire `useDisplayCurrency`/`formatMoney` into new dashboards; Rial-base aggregates |
| M14 | DB tables (idempotent, rollback) | ❌ | all above in `migrate.ts` (`CREATE TABLE IF NOT EXISTS` + `ALTER … IF NOT EXISTS`) |
| M15 | Unit + integration + live-PG tests | ❌ | budget/variance/forecast/KPI units; budget→expense→variance integration |

## Data inconsistencies noted
- `assets.cost_center` / `assets.department` / `purchase_documents.department` are
  **free-text**, not linked to any registry. 26.11 introduces `erp_cost_centers`
  as the canonical registry and adds `cost_center_id` FKs **additively** — the
  legacy text columns stay for backward-compat (no destructive migration).
- Forecast math lived in two specialised helpers (`forecastSales`,
  `cashFlowSeries`). 26.11 adds a **general** `forecast.ts` as the single
  forward-going engine; the specialised callers are left untouched (no rebuild).

## Honest boundaries
- **Server-side PDF** stays print-ready HTML → browser "Save as PDF" (standing
  no-heavy-PDF-dependency decision since Phase 21.5). Excel/CSV are real exports.
- **Finance roles** are an **additive** scope layer (`users.finance_role` +
  cost-center assignment), not a rewrite of the 3-role core auth — department
  managers are restricted to their assigned cost centers; CFO/CEO see
  consolidated data.
