/**
 * ERPFIX-1 (BUG-ERP-10) — the chart-of-accounts CONTRACT.
 *
 * Every account code that application code posts to by literal (an
 * `accountCode: '…'`, an `accountIdByCode('…')`, a `WHERE code='…'`, a
 * gl_map default …) MUST be listed here with the type and English name the
 * seed in `src/lib/db/migrate.ts` gives it. `npm run audit:coa` enforces both
 * halves: (a) no code is seeded twice with a different name/type, and (b)
 * every literal in an account context is in this contract AND agrees with
 * the seed. This is what would have caught 6100 being seeded as «Rent
 * Expense» while payroll posted salaries to it.
 *
 * Changing an entry here means changing what the books mean — confirm with
 * the accountant first.
 */
import type { AccountType } from './ledger'

export interface CoaContractEntry { type: AccountType; nameEn: string }

export const COA_CONTRACT: Record<string, CoaContractEntry> = {
  '1010': { type: 'asset', nameEn: 'Bank' },
  '1100': { type: 'asset', nameEn: 'Accounts Receivable' },
  '1150': { type: 'asset', nameEn: 'Due From Affiliates' },
  '1160': { type: 'asset', nameEn: 'Employee Loans Receivable' },
  '1170': { type: 'asset', nameEn: 'Employee Advances Receivable' },
  '1190': { type: 'asset', nameEn: 'FX Revaluation Adjustment' },
  '1200': { type: 'asset', nameEn: 'Inventory' },
  '2000': { type: 'liability', nameEn: 'Accounts Payable' },
  '2100': { type: 'liability', nameEn: 'Taxes Payable' },
  '2150': { type: 'liability', nameEn: 'Due To Affiliates' },
  '2300': { type: 'liability', nameEn: 'Salaries Payable' },
  '2310': { type: 'liability', nameEn: 'Social Insurance Payable' },
  '2320': { type: 'liability', nameEn: 'Payroll Tax Payable' },
  '2330': { type: 'liability', nameEn: 'Eid Bonus Payable' },
  '2340': { type: 'liability', nameEn: 'Severance Provision' },
  '3900': { type: 'equity', nameEn: 'Retained Earnings' },
  '4000': { type: 'revenue', nameEn: 'Sales Revenue' },
  '4900': { type: 'revenue', nameEn: 'Currency Gain' },
  '5000': { type: 'expense', nameEn: 'Cost of Goods Sold' },
  '6000': { type: 'expense', nameEn: 'Salaries Expense' },
  '6110': { type: 'expense', nameEn: 'Employer Insurance Expense' },
  '6120': { type: 'expense', nameEn: 'Eid Bonus Expense' },
  '6130': { type: 'expense', nameEn: 'Severance Expense' },
  '6980': { type: 'expense', nameEn: 'Currency Loss' },
}

/**
 * Named roles for codes whose MEANING matters to more than one module.
 * Decided with the maintainer (ERPFIX-1 decision gate): salaries post to the
 * existing 6000 «Salaries Expense»; 6100 stays «Rent Expense» only. The live
 * value is still read from erp_settings.gl_map_payroll_expense — this is
 * only the default.
 */
export const COA = {
  payrollExpense: '6000',
  /** ERPFIX-2: realized exchange gain/loss on foreign-currency settlement (the same accounts the 26.8 revaluation uses). */
  fxGain: '4900',
  fxLoss: '6980',
} as const
