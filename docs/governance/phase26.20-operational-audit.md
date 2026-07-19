# Phase 26.20 — Enterprise Operational Audit (PART 0)

Full-ERP review in eighteen hats before any code. Legend: ✅ implemented ·
⚠️ partial · ❌ missing. ("Broken / dead code / not used" findings are called out
explicitly where discovered.)

## Module matrix
| Area | Status | Evidence / gap |
|---|---|---|
| Sales (lead→quote→order→invoice→payment→statement→GL) | ✅ | 26.1–26.15.1; GL auto-posting exists but is a **manual button** → ⚠️ *confirmed invoices can sit unposted* (self-heal target) |
| Purchasing (PR→RFQ→PO→GRN→invoice→payment→GL) | ✅ | 26.1/26.9; same manual-posting gap ⚠️ |
| Warehouse / Inventory / Supply chain | ✅ | 26.19 (states, serial/batch/IMEI, counts w/ GL, shipments, intelligence) |
| Accounting core (periods, opening, closing, statements) | ✅ | 26.9; **Accounting Validation Engine** 26.15.1 |
| Treasury / Banking | ✅ | 26.14 |
| CRM | ✅ leads (Phase 15) — full opportunity pipeline is roadmap (per 26.19 mission: CRM is the next major phase) |
| HR | ⚠️ users/departments/finance-roles exist; payroll/leave/loans **not modeled** — recorded as roadmap (next phases), not stubbed |
| Manufacturing | ❌ roadmap (no BOM/production orders) — never faked |
| Projects (kanban/gantt/costing/EVM) | ✅ 21/21.4 |
| Approvals / Workflow / Rules / Automation / Integration | ✅ 21.6–21.8, 26.12 |
| AI platform (engine, agents, analytics, finance diagnose, BI advisor, treasury AI) | ✅ 22, 26.11–26.14 |
| Reports (25+ catalog) / Dashboards / BI cockpit / KPI / OKR / SLA | ✅ 21.9, 22.2, 26.13 |
| Master data (governance, duplicates, versioning, categories) | ✅ 26.16/26.17 |
| Import & migration (XLSX/CSV/JSON, dry-run, rollback) | ✅ 26.18/26.19 |
| Tax / Currency / Revaluation | ✅ 26 / 26.8 / 26.9 |
| Contracts (documents + vendor contracts + rich RTL) | ✅ 26.1/26.10-F |
| Notifications / alerts | ✅ financial (26.11) + business (26.13) + SLA + nav badges |
| Security (RBAC, audit+IP, injection guards, rate limit, JWT, SOC) | ✅ Phase 16/17/26 hardening; gates in CI |
| UX governance (tokens, type scale, RTL, i18n) | ✅ enforced by 7 audits (all 0) |
| Performance | ✅ server-limited pickers, indexed queries, code-split charts; 26.19 perf report |

## Cross-module / operational risks found (→ this phase's build targets)
1. ⚠️ **Documents without GL**: sales/purchase invoice GL posting is manual — a
   confirmed invoice can remain unposted and silently understate the books.
   → self-heal **auto-fix** (idempotent posting already exists on both sides).
2. ⚠️ **Stuck states**: import jobs can die mid-`processing` (process restart);
   approved cycle counts can sit unposted; shipment reservations can leak if a
   shipment reaches a terminal state abnormally. → detect + fix/alert.
3. ⚠️ **Negative on-hand** is representable in the signed ledger (manual issue
   moves bypass the availability guard). → detect + alert.
4. ⚠️ **Expired-but-active vendor contracts** (status not auto-transitioned). →
   detect + auto-fix (status='expired').
5. ⚠️ **Duplicate payments / duplicate identity customers / negative-margin
   products** — engines exist (26.6/26.16) but nothing runs them operationally
   on a schedule/on-demand with a persisted trail. → self-heal findings.
6. ❌ **No consolidated operational health view** — app health (Operations
   Center), books (validation engine), data quality (26.16), alerts (26.11/13)
   and SOC each live in their own module; no single ERP Health / Risk score.
   → **Operational Health Center**.
7. ❌ **No self-healing loop** — nothing detects → fixes → records. → the
   **Self-Healing Engine** (detect · auto-fix where provably safe · otherwise
   alert with recommendation; every action audited).

## Reuse map for the new build (no duplicate engines)
`postSalesInvoiceToGl` / `postPurchaseInvoiceToGl` (auto-fix executors) ·
`scanLedgerIntegrity` (books) · `masterDataOverview`/`detectDuplicates` (data
quality) · `canTransitionJob`/import tables (stuck jobs) · inv holds/shipments
(26.19) · `erp_financial_alerts`/`business_alerts` (open counts) ·
`system_logs` security meta (SOC signal) · `logAction` audit · RBAC ·
DataTable/UI · workspace registry. AI: **no new AI** — the Health Center links
the existing finance `diagnose` + BI advisor.

## Honest boundaries for the mega-simulation (PART 1 scale)
The live-PG verification simulates the full company **flows** end-to-end
(customers, suppliers, products, warehouses, sales+purchase invoices→GL,
payments, shipment, count, contract, healing) at CI scale — every flow real,
every reconciliation asserted. Seeding literally 5 000 documents/250 personnel
is a load-test exercise (HR/payroll and manufacturing are unbuilt roadmap
modules and cannot be "simulated" without faking them).
