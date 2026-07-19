/**
 * Enterprise Accounting Core (Phase 26.9) — pure, deterministic engine.
 *
 * Extends the existing double-entry GL (`ledger.ts`) with the accounting-system
 * primitives it lacked: a hierarchical chart of accounts, a fiscal-period
 * lifecycle (open → closed → locked) that governs whether a date may be posted,
 * opening-balance validation, and the year-end closing journal that rolls
 * revenue/expense into retained earnings. No I/O here — the data layer supplies
 * accounts, periods and tallies.
 */
import type { AccountType, AccountTally } from './ledger'
import { accountBalance } from './ledger'

// ── Chart of accounts hierarchy ──────────────────────────────────────────────
export interface CoaAccount {
  id: number
  code: string
  nameEn: string
  nameFa?: string | null
  type: AccountType
  parentId?: number | null
  active?: boolean | number
}
export interface CoaNode extends CoaAccount {
  level: number
  children: CoaNode[]
}

/**
 * The account's level (1..4) in the 4-tier chart:
 *   Level 1 Category · Level 2 Main · Level 3 Control · Level 4 Detail.
 * Derived from the dotted code depth, else from the digit-group length
 * (1-digit=1, 2=2, 3-4=3, 5+=4) so the existing flat 4-digit seed still reads
 * as level 3 mains without any data change.
 */
export function accountLevel(code: string): number {
  const segments = code.split('.')
  const firstLen = segments[0].replace(/\D/g, '').length
  const baseLevel = firstLen <= 1 ? 1 : firstLen === 2 ? 2 : firstLen <= 4 ? 3 : 4
  return Math.min(4, baseLevel + (segments.length - 1))
}

/** Build the account tree from explicit parentId links (roots first, code-sorted). */
export function buildAccountTree(accounts: CoaAccount[]): CoaNode[] {
  const byId = new Map<number, CoaNode>()
  for (const a of accounts) byId.set(a.id, { ...a, level: accountLevel(a.code), children: [] })
  const roots: CoaNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId != null ? byId.get(node.parentId) : undefined
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }
  const sortRec = (nodes: CoaNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    nodes.forEach(n => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** Reject a parent assignment that would create a cycle. */
export function isCyclicParent(accounts: CoaAccount[], childId: number, newParentId: number): boolean {
  if (childId === newParentId) return true
  const byId = new Map(accounts.map(a => [a.id, a]))
  let cur: number | null | undefined = newParentId
  const seen = new Set<number>()
  while (cur != null) {
    if (cur === childId) return true
    if (seen.has(cur)) return true
    seen.add(cur)
    cur = byId.get(cur)?.parentId ?? null
  }
  return false
}

// ── Fiscal period lifecycle ──────────────────────────────────────────────────
export type PeriodStatus = 'open' | 'closed' | 'locked'
export type PeriodKind = 'year' | 'period'
export interface FiscalPeriod {
  id: number
  name: string
  startDate: string
  endDate: string
  status: PeriodStatus
  kind?: PeriodKind
  parentId?: number | null
}

/** The narrowest period (a 'period' beats its 'year') whose range contains the date. */
export function periodForDate(date: string, periods: FiscalPeriod[]): FiscalPeriod | null {
  const inRange = periods.filter(p => p.startDate <= date && date <= p.endDate)
  if (!inRange.length) return null
  const detail = inRange.filter(p => (p.kind ?? 'period') === 'period')
  const pool = detail.length ? detail : inRange
  // Prefer the smallest span.
  return pool.reduce((best, p) => {
    const span = (a: FiscalPeriod) => a.endDate.localeCompare(a.startDate)
    return best === null || span(p) < span(best) ? p : best
  }, null as FiscalPeriod | null)
}

/**
 * Whether a journal dated `date` may be posted. A date in NO defined period is
 * allowed (ungoverned/backward-compatible); a date inside a closed or locked
 * period is rejected.
 */
export function canPostDate(date: string, periods: FiscalPeriod[]): { ok: boolean; period: FiscalPeriod | null; reason?: string } {
  const period = periodForDate(date, periods)
  if (!period) return { ok: true, period: null }
  if (period.status === 'open') return { ok: true, period }
  return { ok: false, period, reason: `Fiscal period "${period.name}" is ${period.status}; postings are not allowed.` }
}

/** Allowed status transitions: open→closed, closed→open (reopen), closed→locked. Locked is terminal. */
export function canTransitionPeriod(from: PeriodStatus, to: PeriodStatus): boolean {
  if (from === to) return false
  if (from === 'open') return to === 'closed'
  if (from === 'closed') return to === 'open' || to === 'locked'
  return false // locked is terminal
}

// ── Opening balance ──────────────────────────────────────────────────────────
export interface OpeningLine { accountId: number; type: AccountType; amount: number }
/**
 * Turn opening balances (positive amount on each account's normal side) into
 * balanced journal lines. Assets/expenses are debits; liabilities/equity/
 * revenue are credits. Throws if the result is unbalanced.
 */
export function openingBalanceLines(lines: OpeningLine[]): { accountId: number; debit: number; credit: number }[] {
  const out = lines
    .filter(l => Math.abs(l.amount) > 0)
    .map(l => {
      const debitNormal = l.type === 'asset' || l.type === 'expense'
      const amt = Math.round(l.amount * 100) / 100
      return debitNormal
        ? { accountId: l.accountId, debit: amt, credit: 0 }
        : { accountId: l.accountId, debit: 0, credit: amt }
    })
  const d = out.reduce((s, l) => s + l.debit, 0)
  const c = out.reduce((s, l) => s + l.credit, 0)
  if (Math.round((d - c) * 100) !== 0) {
    throw new Error(`Opening balance is unbalanced: debits ${d} ≠ credits ${c}. Add an equity balancing account.`)
  }
  return out
}

// ── Year-end closing ─────────────────────────────────────────────────────────
export interface ClosingResult {
  lines: { accountId: number; debit: number; credit: number }[]
  netIncome: number
  totalRevenue: number
  totalExpense: number
}
/**
 * Build the closing journal that zeroes every revenue and expense account into
 * retained earnings. Revenue (credit-normal) is debited to clear it; expense
 * (debit-normal) is credited to clear it; the net lands on retained earnings
 * (credited for a profit, debited for a loss). Balanced by construction.
 */
export function yearEndClosingLines(tallies: AccountTally[], retainedEarningsId: number): ClosingResult {
  const lines: { accountId: number; debit: number; credit: number }[] = []
  let totalRevenue = 0, totalExpense = 0
  for (const t of tallies) {
    const bal = accountBalance(t) // signed on the account's normal side
    if (t.type === 'revenue' && Math.abs(bal) > 0.005) {
      totalRevenue += bal
      lines.push({ accountId: t.id, debit: Math.round(bal * 100) / 100, credit: 0 })
    } else if (t.type === 'expense' && Math.abs(bal) > 0.005) {
      totalExpense += bal
      lines.push({ accountId: t.id, debit: 0, credit: Math.round(bal * 100) / 100 })
    }
  }
  const netIncome = Math.round((totalRevenue - totalExpense) * 100) / 100
  if (Math.abs(netIncome) > 0.005) {
    lines.push(netIncome > 0
      ? { accountId: retainedEarningsId, debit: 0, credit: netIncome }   // profit → increase equity
      : { accountId: retainedEarningsId, debit: -netIncome, credit: 0 }) // loss → decrease equity
  }
  return { lines, netIncome, totalRevenue: Math.round(totalRevenue * 100) / 100, totalExpense: Math.round(totalExpense * 100) / 100 }
}
