# Phase 26.13 — Business Operations Intelligence: Audit (AUDIT FIRST)

Code-verified audit. **NO FAKE / NO DUPLICATE / NO REBUILD.** ✅ reused, ❌ built.

## Existing (reuse)
| Capability | Where | Verdict |
|---|---|---|
| Executive aggregation | `admin/executiveOverview.ts`, `erp/financialIntelligenceData.cfoDashboard` (26.11) | ✅ reuse (cockpit assembles these) |
| KPI helpers | `kpiEngine.ts` (26.11) + `salesKpis`/`inventoryKpis`/`purchaseKpis`/`projectKpis`/`financialKpis` | ✅ reuse (feed the KPI system) |
| Dashboard framework | `admin/widgets.ts`/`widgetData.ts`, Dashboard Platform | ✅ reuse |
| Reporting Platform | `reports/reportData.ts` (17 reports) + `pivot.ts` + Excel/CSV export | ✅ reuse/extend (M7) |
| Alerts foundation | `erp/financialAlerts.ts` + `erp_financial_alerts` (26.11) | ✅ generalize (M6) |
| Approval analytics / SLA | `approval/analytics.ts` + `approval/escalation.ts` (26.12) | ✅ reuse (M4/M5) |
| Global Search | `search/globalSearch.ts` (13 sources), `/admin/search` | ✅ extend (M10) |
| AI Platform | `runCompletion` + RAG + `financeAi` diagnose (26.11) | ✅ reuse (M8) |
| Notifications / RBAC / Audit | `notifications.ts`, `canDo`+`finance_role`, `logAction` | ✅ reuse |

## Gaps to build (❌)
KPI **definition/formula-builder/target/score/history** system (M2 — a real safe
formula evaluator + `kpi_definitions`/`kpi_values`); OKR management (M3 —
`okr_objectives`/`okr_results`); process mining (M4 — `process_metrics` +
bottleneck/delay engine over event timestamps); generalized SLA w/ business
hours + holidays (M5 — `sla_definitions`/`sla_events`); centralized Alert Center
(M6 — `business_alerts`, all domains + channels); executive report catalog +
saved configs (M7 — `executive_reports`); Data Governance quality engine (M9 —
`data_quality_checks`); Executive Cockpit page (M1 — assembles reuse); AI
Business Advisor cross-module (M8 — extend AI); search enhancement (M10). New
**Business Intelligence** workspace nav.

## Design (no duplicate)
New pure engines under `lib/bi/*` (KPI formula, OKR, process mining, SLA business
hours, alert routing, data quality). Data layers reuse the verified module data.
The cockpit + reports reuse existing aggregation; AI reuses `runCompletion`.
