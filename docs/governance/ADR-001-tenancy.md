# ADR-001 — Tenancy Architecture

**Status:** Accepted · **Date:** 2026-07-14 · **Phase:** 26.24 (R0)
**Deciders:** ERP Solution Architect, CFO, DevOps Lead

## Context

The HBZ Enterprise Platform is a bilingual (FA/EN) Next.js 15 + PostgreSQL
ERP. As it approaches Iranian go-live, we must decide the tenancy model **before**
building further modules, because it dictates the primary key of every
transactional table and the isolation boundary of every query. Retrofitting
tenancy later is a rewrite; getting the naming contract right now is cheap.

Existing state (audited 26.24): `erp_companies` (seeded HQ default) exists, and
`gl_journal_entries.company_id`, `bank_accounts.company_id`, plus two 26.11/26.13
tables already carry `company_id`. Consolidation (`consolidateTallies`) and the
reports scope selector already read it. So the platform is **partially
company-aware** but not uniformly.

## Options

### (a) Single-tenant per-deployment
One company per installation. No `company_id` anywhere; each customer gets an
isolated container + database.
- **Pros:** simplest queries, hardest isolation (physical), trivial backup/restore.
- **Cons:** cannot model a holding group with subsidiaries in one place; the
  existing multi-company + intercompany work (26.5/26.11) would be dead code;
  no path to SaaS without a rewrite.

### (b) Multi-company inside one deployment ✅ **CHOSEN**
One installation hosts N legal companies (`erp_companies`), every transactional
row stamped with `company_id`, books scoped/consolidated per company. Isolation
is logical (WHERE company_id) enforced in the data layer, not physical.
- **Pros:** matches the already-built `erp_companies` + intercompany + consolidation;
  matches how Iranian holdings actually operate (parent + subsidiaries sharing a
  finance team); no schema churn — extends what exists; a clean forward path to (c)
  because `company_id` is the same shape a future `tenant_id` needs.
- **Cons:** logical isolation depends on discipline (mitigated by the new
  `audit:tenancy` gate); a single DB is a single blast radius (mitigated by
  backup/restore DR, phase 26.24 بند ۵.۴).

### (c) Full multi-tenant SaaS
A global `tenant_id` above `company_id`, row-level security, per-tenant
rate-limits and billing, tenant-scoped migrations.
- **Pros:** true SaaS, one platform for many unrelated customers.
- **Cons:** premature — no SaaS customers exist; RLS + tenant middleware +
  per-tenant billing is months of work with zero current payoff; would slow the
  Iranian go-live that is the actual near-term goal.

## Decision

Adopt **(b) multi-company now**, built as a **tenant-ready** foundation:

1. Every **transactional** table (documents, payments, ledger entries, stock
   moves, business records that belong to a legal entity) MUST carry a nullable
   `company_id INTEGER` referencing the default company when unset.
2. The column name is `company_id` today; a future SaaS layer (option c) adds
   `tenant_id` **above** it without touching `company_id` — companies become
   children of tenants. This naming contract is the "tenant-ready" guarantee.
3. Reference/catalog/config tables (chart of accounts, currencies, settings,
   numbering formats, CMS content) are **shared** and do NOT need `company_id`.
4. A governance gate (`audit:tenancy`) fails the build if a new transactional
   table lacks `company_id`, so the contract cannot silently rot.

## Consequences

- 26.24 بند ۱.۲ backfills `company_id` onto the transactional tables that lack it
  (idempotent, nullable — zero data breakage; existing rows stay NULL = default
  company, which every scoped query already treats as HQ).
- New rule in CLAUDE.md (بند ۱.۳): transactional tables require `company_id`.
- Data-layer queries progressively gain optional `companyId?` scoping; until a
  query is scoped it reads all companies (current behaviour — no regression).
- The path to SaaS stays open but unbuilt; revisit ADR when the first external
  tenant is signed.

## Tenancy gap closure (بند ۱.۲ result)

| Transactional table | Had company_id? | Action |
|---|---|---|
| gl_journal_entries | ✅ (26.5) | kept |
| bank_accounts | ✅ (26.14) | kept |
| sales_documents | ❌ | + nullable column + index |
| purchase_documents | ❌ | + nullable column + index |
| inv_moves | ❌ | + nullable column + index |
| assets | ❌ | + nullable column + index |
| crm_leads | ❌ | + nullable column + index |
| sales_payments / purchase_payments | ❌ | + nullable column |

Line/child tables (`*_document_lines`, `gl_journal_lines`) inherit scope from
their header and are intentionally left unstamped. Verified idempotent + the
tenancy audit passes.
