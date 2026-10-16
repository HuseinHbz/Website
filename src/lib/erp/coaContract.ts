/**
 * ERPFIX-1 BUG-ERP-10 — the chart-of-accounts contract: which code means
 * what, and what type it must be. '6100' was seeded twice (once as Rent
 * Expense, once — a no-op — as Salaries) and every payroll-posting site
 * hardcoded the literal '6100', so payroll silently posted into Rent.
 *
 * This is NOT an exhaustive registry of every account code ever referenced
 * in the codebase — that would duplicate the whole chart for no safety
 * gain. It covers the standard seeded chart (migrate.ts's main INSERT) plus
 * every code a system-critical posting path (payroll/annual/treasury/
 * revaluation/intercompany) hardcodes, so a future collision on any of
 * THESE is caught the same way BUG-ERP-10 should have been. A code outside
 * this list is not asserted either way — `audit:coa`'s collision check
 * (every code seeded with only ONE name/type across all seeds) still
 * covers it structurally, just without a named expectation here.
 */
export type CoaAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'memo'

export interface CoaContractEntry { code: string; nameEn: string; type: CoaAccountType }

export const COA_CONTRACT: CoaContractEntry[] = [
  { code: '1000', nameEn: 'Cash', type: 'asset' },
  { code: '1010', nameEn: 'Bank', type: 'asset' },
  { code: '1100', nameEn: 'Accounts Receivable', type: 'asset' },
  { code: '1150', nameEn: 'Due From (Intercompany)', type: 'asset' },
  { code: '1160', nameEn: 'Employee Loans Receivable', type: 'asset' },
  { code: '1190', nameEn: 'FX Revaluation Adjustment', type: 'asset' },
  { code: '1200', nameEn: 'Inventory', type: 'asset' },
  { code: '1500', nameEn: 'Fixed Assets', type: 'asset' },
  { code: '2000', nameEn: 'Accounts Payable', type: 'liability' },
  { code: '2100', nameEn: 'Taxes Payable', type: 'liability' },
  { code: '2150', nameEn: 'Due To (Intercompany)', type: 'liability' },
  { code: '2300', nameEn: 'Salaries Payable', type: 'liability' },
  { code: '2310', nameEn: 'Social Insurance Payable', type: 'liability' },
  { code: '2320', nameEn: 'Payroll Tax Payable', type: 'liability' },
  { code: '2330', nameEn: 'Eid Bonus Payable', type: 'liability' },
  { code: '2340', nameEn: 'Severance Payable', type: 'liability' },
  { code: '2500', nameEn: 'Loans Payable', type: 'liability' },
  { code: '3000', nameEn: 'Owner Equity', type: 'equity' },
  { code: '3900', nameEn: 'Retained Earnings', type: 'equity' },
  { code: '4000', nameEn: 'Sales Revenue', type: 'revenue' },
  { code: '4100', nameEn: 'Service Revenue', type: 'revenue' },
  { code: '4900', nameEn: 'FX Revaluation Gain', type: 'revenue' },
  { code: '5000', nameEn: 'Cost of Goods Sold', type: 'expense' },
  // ERPFIX-1: payroll posts to 6000 — NEVER 6100 (Rent Expense).
  { code: '6000', nameEn: 'Salaries Expense', type: 'expense' },
  { code: '6100', nameEn: 'Rent Expense', type: 'expense' },
  { code: '6110', nameEn: 'Employer Insurance Expense', type: 'expense' },
  { code: '6120', nameEn: 'Eid Bonus Expense', type: 'expense' },
  { code: '6130', nameEn: 'Severance Expense', type: 'expense' },
  { code: '6200', nameEn: 'Utilities Expense', type: 'expense' },
  { code: '6900', nameEn: 'Depreciation Expense', type: 'expense' },
  { code: '6980', nameEn: 'FX Revaluation Loss', type: 'expense' },
]

const byCode = new Map(COA_CONTRACT.map(e => [e.code, e]))

/** Look up the contract's expectation for a code, if any. */
export function coaExpectationFor(code: string): CoaContractEntry | undefined {
  return byCode.get(code)
}

/** Every code seeded somewhere must carry exactly ONE name/type — detects
 * a BUG-ERP-10-class collision from a flat list of (code,nameEn,type)
 * seed tuples (as parsed from migrate.ts by scripts/coa-audit.mjs). */
export function findCoaCollisions(seeds: { code: string; nameEn: string; type: string }[]): { code: string; variants: { nameEn: string; type: string }[] }[] {
  const groups = new Map<string, Set<string>>()
  for (const s of seeds) {
    const key = `${s.nameEn}\u0000${s.type}`
    if (!groups.has(s.code)) groups.set(s.code, new Set())
    groups.get(s.code)!.add(key)
  }
  const collisions: { code: string; variants: { nameEn: string; type: string }[] }[] = []
  for (const [code, variants] of groups) {
    if (variants.size > 1) {
      collisions.push({ code, variants: [...variants].map(v => { const [nameEn, type] = v.split('\u0000'); return { nameEn, type } }) })
    }
  }
  return collisions
}
