/**
 * Account classification engine (ERPFIX-7, BUG-ERP-19) — pure, deterministic.
 *
 * Standard financial statements need more than the 5 broad `AccountType`s:
 * a balance sheet separates current from non-current, an income statement
 * separates operating from non-operating, and a cash-flow statement needs a
 * category per account (operating/investing/financing/cash). None of that is
 * an accounting judgment this code is allowed to invent per-account — it is a
 * DEFAULT, code-range-based guess, always returned alongside `verified:
 * false` until an accountant confirms it (same `verified` pattern as
 * Phase 28.3-ب's export-layout rule). Accounts the default cannot place
 * confidently fall into an explicit "needs classification" bucket rather than
 * a silent guess.
 */
import type { AccountType } from './ledger'

export type BsClassification =
  | 'current_asset' | 'non_current_asset'
  | 'current_liability' | 'non_current_liability'
  | 'equity'
  | 'operating_revenue' | 'non_operating_revenue'
  | 'operating_expense' | 'non_operating_expense' | 'tax_expense'
  | 'unclassified'

export type CashFlowCategory = 'operating' | 'investing' | 'financing' | 'cash' | 'unclassified'

/** Code-range default. Iranian-standard chart conventions already used across
 * this codebase: 10xx cash/bank, 11-14xx current assets/receivables/inventory,
 * 15xx+ fixed assets, 19xx contra-assets; 20-24xx current liabilities,
 * 25xx+ long-term liabilities; 3xxx equity; 4xxx revenue; 69xx is this
 * codebase's own non-operating/other-expense convention (depreciation, FX). */
export function defaultClassification(code: string, type: AccountType): BsClassification {
  const n = Number(code)
  if (Number.isNaN(n)) return 'unclassified'
  switch (type) {
    case 'asset':
      return n < 1500 ? 'current_asset' : 'non_current_asset'
    case 'liability':
      return n < 2500 ? 'current_liability' : 'non_current_liability'
    case 'equity':
      return 'equity'
    case 'revenue':
      return n >= 4900 ? 'non_operating_revenue' : 'operating_revenue'
    case 'expense':
      if (code === '2100' || n >= 6980) return 'tax_expense'
      return n >= 6900 ? 'non_operating_expense' : 'operating_expense'
    default:
      return 'unclassified'
  }
}

export function defaultCashFlowCategory(code: string, type: AccountType): CashFlowCategory {
  if (code.startsWith('10')) return 'cash'
  const n = Number(code)
  if (Number.isNaN(n)) return 'unclassified'
  switch (type) {
    case 'asset':
      return n >= 1500 ? 'investing' : 'operating'
    case 'liability':
      return n >= 2500 ? 'financing' : 'operating'
    case 'equity':
      return 'financing'
    case 'revenue':
    case 'expense':
      return 'operating'
    default:
      return 'unclassified'
  }
}

export interface ClassifiableAccount { id: number; code: string; type: AccountType; classification?: BsClassification | null; cashFlowCategory?: CashFlowCategory | null; classificationVerified?: boolean }

/** Resolve an account's EFFECTIVE classification: the stored value if present,
 * else the code-range default (never silently blank). */
export function resolvedClassification(a: ClassifiableAccount): BsClassification {
  return a.classification || defaultClassification(a.code, a.type)
}
export function resolvedCashFlowCategory(a: ClassifiableAccount): CashFlowCategory {
  return a.cashFlowCategory || defaultCashFlowCategory(a.code, a.type)
}

/** Accounts whose classification was never explicitly confirmed by an
 * accountant — the "needs classification" queue (BUG-ERP-19). */
export function needsClassificationQueue(accounts: ClassifiableAccount[]): ClassifiableAccount[] {
  return accounts.filter(a => !a.classificationVerified)
}
