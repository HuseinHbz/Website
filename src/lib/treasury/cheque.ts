/**
 * Cheque calendar / aging / risk (Phase 26.14, M6) — pure, unit-tested. Extends
 * the 26-era cheque lifecycle (`banking.CHEQUE_FLOW`) with a due-date calendar,
 * aging buckets and a risk signal. Reuses the existing `cheques` table.
 */

export interface ChequeRow { id: number; direction: 'issued' | 'received'; amount: number; dueDate?: string | null; status: string; party?: string }

function days(from: string, to: string): number {
  const a = Date.parse(from), b = Date.parse(to)
  return isNaN(a) || isNaN(b) ? 0 : Math.round((b - a) / 86_400_000)
}
const OPEN = new Set(['issued', 'received', 'deposited', 'pending'])

export interface AgingBucket { bucket: string; count: number; amount: number }
/** Aging of OPEN cheques by days-to-due (negative = overdue). */
export function chequeAging(cheques: ChequeRow[], today = new Date().toISOString().slice(0, 10)): AgingBucket[] {
  const buckets: Record<string, { count: number; amount: number }> = {
    overdue: { count: 0, amount: 0 }, due_7: { count: 0, amount: 0 }, due_30: { count: 0, amount: 0 }, due_90: { count: 0, amount: 0 }, later: { count: 0, amount: 0 },
  }
  for (const c of cheques) {
    if (!OPEN.has(c.status) || !c.dueDate) continue
    const d = days(today, c.dueDate)
    const key = d < 0 ? 'overdue' : d <= 7 ? 'due_7' : d <= 30 ? 'due_30' : d <= 90 ? 'due_90' : 'later'
    buckets[key].count++; buckets[key].amount += Number(c.amount) || 0
  }
  return Object.entries(buckets).map(([bucket, v]) => ({ bucket, count: v.count, amount: Math.round(v.amount * 100) / 100 }))
}

export interface CalendarEntry { date: string; count: number; amount: number; direction: 'issued' | 'received' | 'mixed' }
/** Group open cheques by due date for a payment calendar. */
export function chequeCalendar(cheques: ChequeRow[]): CalendarEntry[] {
  const m = new Map<string, { count: number; amount: number; dirs: Set<string> }>()
  for (const c of cheques) {
    if (!OPEN.has(c.status) || !c.dueDate) continue
    const cur = m.get(c.dueDate) ?? { count: 0, amount: 0, dirs: new Set<string>() }
    cur.count++; cur.amount += Number(c.amount) || 0; cur.dirs.add(c.direction)
    m.set(c.dueDate, cur)
  }
  return [...m.entries()].map(([date, v]): CalendarEntry => ({ date, count: v.count, amount: Math.round(v.amount * 100) / 100, direction: v.dirs.size > 1 ? 'mixed' : (([...v.dirs][0] as 'issued' | 'received') ?? 'issued') })).sort((a, b) => a.date.localeCompare(b.date))
}

export type ChequeRisk = 'none' | 'due_soon' | 'overdue' | 'large'
/** Per-cheque risk signal for the treasury dashboard. */
export function chequeRisk(c: ChequeRow, largeThreshold = 1_000_000_000, today = new Date().toISOString().slice(0, 10)): ChequeRisk {
  if (!OPEN.has(c.status)) return 'none'
  if (c.dueDate) { const d = days(today, c.dueDate); if (d < 0) return 'overdue'; if (d <= 7) return 'due_soon' }
  if (Math.abs(c.amount) >= largeThreshold) return 'large'
  return 'none'
}
