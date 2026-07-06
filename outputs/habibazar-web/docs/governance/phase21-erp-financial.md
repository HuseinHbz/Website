# Phase 21 ERP — Module 1: Enterprise Financial System (General Ledger)

Third complete ERP module (order: Inventory → Assets → **Financial** →
Dashboard). The accounting core — real double-entry, not a mock.

## Shipped & verified

- **Double-entry engine** (`src/lib/erp/ledger.ts`, pure, 8 unit tests): account
  normal sides (asset/expense = debit; liability/equity/revenue = credit),
  `entryBalanced` (≥2 lines, no negatives, no both-sided line, debits === credits),
  signed `accountBalance`, `trialBalance` (ties out), `incomeStatement`
  (revenue − expenses = net income), `balanceSheet` (assets = liabilities +
  equity with current net income folded in), and `financialKpis`.
- **Data model** (PostgreSQL): `gl_fiscal_periods`, `gl_accounts` (with a seeded
  standard chart of accounts — cash/bank/AR/inventory/fixed-assets/AP/taxes/
  loans/equity/retained-earnings/sales/service/COGS/salary/rent/utilities/
  depreciation), `gl_journal_entries` (draft/posted/void, entry no, total),
  `gl_journal_lines` (debit/credit/memo).
- **Server layer** (`src/lib/erp/ledgerData.ts`): tallies debits/credits per
  account across **only posted** entries — the posted-status gate is on the
  summed amount (`CASE WHEN e.status='posted'`), not the join, so draft/void
  entries never touch the books. Derives trial balance + statements + KPIs once.
- **APIs** `/api/admin/erp/finance/{accounts,journal,reports,overview}`:
  chart-of-accounts CRUD; journal create (server-side **balanced-validated** —
  debits must equal credits before the entry is accepted) with draft/post, plus
  a post/void lifecycle; trial balance + income statement + balance sheet;
  dashboard KPIs. zod-validated, RBAC-gated, audit-logged.
- **UI** (`/admin/finance`, `FinanceCenter`, fully bilingual FA/EN): tabbed
  Dashboard (8 KPI cards — assets/liabilities/equity/cash/revenue/expenses/net
  income/entry counts — income + balance summaries, recent entries) · Chart of
  Accounts (typed, with live balances) · Journal Entries (multi-line editor with
  a **live debit/credit balance check** that blocks posting an unbalanced entry;
  post/void) · Reports (Trial Balance, Income Statement, Balance Sheet).

**Verified:** tsc 0 · ESLint 0 · vitest 110/110 (8 ledger) · 6 governance audits
pass · build OK · **real PostgreSQL round-trip** — three posted entries (invest
$10k, cash sale $3k, pay rent $500) plus one **draft** ($9,999): trial balance
Dr $13,000 = Cr $13,000, income rev $3,000 − exp $500 = net income $2,500,
balance sheet assets $12,500 = equity $12,500 — **the draft was correctly
excluded** (the round-trip caught and fixed a status-gating bug before commit).

## Remaining ERP roadmap

Next per the maintainer's order: **Dashboard redesign**, then Sales, Purchasing,
Projects, Costing, Document Engine, visual Workflow Designer, Rules Engine,
Integration Hub, Reporting, Global Search — each built the same way (pure tested
core → PostgreSQL → RBAC/zod API → bilingual UI → verified), one complete module
at a time.
