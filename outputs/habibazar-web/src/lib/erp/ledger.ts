/**
 * General Ledger — double-entry accounting core (Phase 21 ERP, Module 1).
 *
 * Pure, deterministic accounting logic: account normal sides, journal-entry
 * balancing, trial balance, and the three financial statements (income
 * statement, balance sheet, cash-flow summary). No DB access → fully unit-tested.
 * The API posts validated entries and hands account tallies to these functions;
 * every report is derived here so the books always tie out.
 */

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

/** Debit-normal accounts increase with debits; credit-normal with credits. */
export type NormalSide = 'debit' | 'credit'
export function normalSide(type: AccountType): NormalSide {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit'
}

export interface JournalLine { accountId: number; debit: number; credit: number }

const EPS = 0.005

/** A valid journal entry has ≥2 lines and total debits === total credits (>0). */
export function entryBalanced(lines: JournalLine[]): { ok: boolean; totalDebit: number; totalCredit: number; reason?: string } {
  const totalDebit = round2(lines.reduce((s, l) => s + (l.debit || 0), 0))
  const totalCredit = round2(lines.reduce((s, l) => s + (l.credit || 0), 0))
  if (lines.length < 2) return { ok: false, totalDebit, totalCredit, reason: 'at least two lines required' }
  if (lines.some(l => (l.debit || 0) < 0 || (l.credit || 0) < 0)) return { ok: false, totalDebit, totalCredit, reason: 'negative amounts not allowed' }
  if (lines.some(l => (l.debit || 0) > 0 && (l.credit || 0) > 0)) return { ok: false, totalDebit, totalCredit, reason: 'a line cannot be both debit and credit' }
  if (totalDebit <= 0) return { ok: false, totalDebit, totalCredit, reason: 'entry total must be positive' }
  if (Math.abs(totalDebit - totalCredit) > EPS) return { ok: false, totalDebit, totalCredit, reason: 'debits must equal credits' }
  return { ok: true, totalDebit, totalCredit }
}

export interface AccountTally { id: number; code: string; nameEn: string; nameFa?: string | null; type: AccountType; debit: number; credit: number }

/** Signed balance of an account in its normal direction (never below by sign). */
export function accountBalance(t: AccountTally): number {
  const net = (t.debit || 0) - (t.credit || 0)
  return round2(normalSide(t.type) === 'debit' ? net : -net)
}

export interface TrialBalanceRow { id: number; code: string; nameEn: string; nameFa?: string | null; type: AccountType; debit: number; credit: number }
export interface TrialBalance { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; balanced: boolean }

/** Trial balance: each account's net expressed as a debit- or credit-side figure. */
export function trialBalance(tallies: AccountTally[]): TrialBalance {
  const rows: TrialBalanceRow[] = tallies.map(t => {
    const net = round2((t.debit || 0) - (t.credit || 0))
    return {
      id: t.id, code: t.code, nameEn: t.nameEn, nameFa: t.nameFa, type: t.type,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? -net : 0,
    }
  }).filter(r => r.debit !== 0 || r.credit !== 0)
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0))
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0))
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) <= EPS }
}

export interface StatementLine { id: number; code: string; nameEn: string; nameFa?: string | null; amount: number }
export interface IncomeStatement { revenue: StatementLine[]; expenses: StatementLine[]; totalRevenue: number; totalExpenses: number; netIncome: number }

/** Income statement: revenue − expenses = net income. */
export function incomeStatement(tallies: AccountTally[]): IncomeStatement {
  const revenue = tallies.filter(t => t.type === 'revenue').map(toLine)
  const expenses = tallies.filter(t => t.type === 'expense').map(toLine)
  const totalRevenue = sumLines(revenue)
  const totalExpenses = sumLines(expenses)
  return { revenue, expenses, totalRevenue, totalExpenses, netIncome: round2(totalRevenue - totalExpenses) }
}

export interface BalanceSheet {
  assets: StatementLine[]; liabilities: StatementLine[]; equity: StatementLine[]
  totalAssets: number; totalLiabilities: number; totalEquity: number
  /** Retained/current earnings folded into equity so the sheet balances. */
  netIncome: number
  balanced: boolean
}

/** Balance sheet: assets = liabilities + equity (incl. current net income). */
export function balanceSheet(tallies: AccountTally[]): BalanceSheet {
  const assets = tallies.filter(t => t.type === 'asset').map(toLine)
  const liabilities = tallies.filter(t => t.type === 'liability').map(toLine)
  const equity = tallies.filter(t => t.type === 'equity').map(toLine)
  const netIncome = incomeStatement(tallies).netIncome
  const totalAssets = sumLines(assets)
  const totalLiabilities = sumLines(liabilities)
  const totalEquity = round2(sumLines(equity) + netIncome)
  return {
    assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= EPS,
  }
}

export interface FinancialKpis {
  totalAssets: number; totalLiabilities: number; totalEquity: number
  revenue: number; expenses: number; netIncome: number
  cash: number
}

/** Dashboard KPIs. `cash` sums accounts whose code marks them as cash/bank. */
export function financialKpis(tallies: AccountTally[], isCashCode: (code: string) => boolean): FinancialKpis {
  const bs = balanceSheet(tallies)
  const is = incomeStatement(tallies)
  const cash = round2(tallies.filter(t => t.type === 'asset' && isCashCode(t.code)).reduce((s, t) => s + accountBalance(t), 0))
  return {
    totalAssets: bs.totalAssets, totalLiabilities: bs.totalLiabilities, totalEquity: bs.totalEquity,
    revenue: is.totalRevenue, expenses: is.totalExpenses, netIncome: is.netIncome, cash,
  }
}

function toLine(t: AccountTally): StatementLine {
  return { id: t.id, code: t.code, nameEn: t.nameEn, nameFa: t.nameFa, amount: accountBalance(t) }
}
function sumLines(lines: StatementLine[]): number { return round2(lines.reduce((s, l) => s + l.amount, 0)) }
function round2(n: number): number { return Math.round(n * 100) / 100 }

/**
 * Consolidate per-company account tallies into group totals (Phase 26
 * multi-company). Accounts are merged by id, debits/credits summed — feeding
 * the same trialBalance/incomeStatement/balanceSheet engines afterwards yields
 * the consolidated statements.
 */
export function consolidateTallies(perCompany: AccountTally[][]): AccountTally[] {
  const merged = new Map<number, AccountTally>()
  for (const tallies of perCompany) {
    for (const t of tallies) {
      const cur = merged.get(t.id)
      if (!cur) merged.set(t.id, { ...t })
      else {
        cur.debit = Math.round((cur.debit + t.debit) * 100) / 100
        cur.credit = Math.round((cur.credit + t.credit) * 100) / 100
      }
    }
  }
  return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code))
}
