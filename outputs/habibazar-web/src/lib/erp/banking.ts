/**
 * Enterprise Banking Engine (Phase 26) — pure, deterministic, unit-tested.
 *
 * Three subsystems: bank-statement reconciliation (auto-match statement lines to
 * recorded payments by amount + date window, with confidence), the cheque
 * lifecycle state machine (issued/received chains), and petty cash (float /
 * expense / replenish balance). No I/O — the data layer supplies rows.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

// ── Statement reconciliation ─────────────────────────────────────────────────
export interface StatementLine { id: number; date: string; amount: number; description?: string }
export interface MatchCandidate { id: string; date: string; amount: number; label?: string }
export interface MatchSuggestion { lineId: number; candidateId: string; confidence: number }
export interface MatchResult { suggestions: MatchSuggestion[]; unmatchedLineIds: number[] }

const dayDiff = (a: string, b: string): number => {
  const ta = Date.parse(a), tb = Date.parse(b)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 9999
  return Math.abs(ta - tb) / 86400000
}

/**
 * Suggest matches between statement lines and payment candidates. A candidate
 * matches when the amount is equal within `amountTolerance` and the date is
 * within `dateWindowDays`. Confidence: 100 exact amount + same day, decays with
 * date distance. Each candidate is consumed at most once (greedy best-first).
 */
export function matchStatement(
  lines: StatementLine[], candidates: MatchCandidate[],
  opts: { dateWindowDays?: number; amountTolerance?: number } = {},
): MatchResult {
  const windowDays = opts.dateWindowDays ?? 5
  const tol = opts.amountTolerance ?? 0.01
  const pairs: { lineId: number; candidateId: string; confidence: number }[] = []
  for (const l of lines) {
    for (const c of candidates) {
      if (Math.abs(Math.abs(l.amount) - Math.abs(c.amount)) > tol) continue
      const dd = dayDiff(l.date, c.date)
      if (dd > windowDays) continue
      const confidence = Math.max(1, Math.round(100 - dd * (80 / windowDays)))
      pairs.push({ lineId: l.id, candidateId: c.id, confidence })
    }
  }
  pairs.sort((a, b) => b.confidence - a.confidence)
  const usedLines = new Set<number>(), usedCands = new Set<string>()
  const suggestions: MatchSuggestion[] = []
  for (const p of pairs) {
    if (usedLines.has(p.lineId) || usedCands.has(p.candidateId)) continue
    usedLines.add(p.lineId); usedCands.add(p.candidateId)
    suggestions.push(p)
  }
  return { suggestions, unmatchedLineIds: lines.filter(l => !usedLines.has(l.id)).map(l => l.id) }
}

export interface ReconSummary { total: number; matched: number; unmatched: number; matchedPct: number; inflow: number; outflow: number }
export function reconciliationSummary(lines: { amount: number; status: string }[]): ReconSummary {
  const matched = lines.filter(l => l.status === 'matched').length
  const inflow = round2(lines.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0))
  const outflow = round2(lines.filter(l => l.amount < 0).reduce((s, l) => s - l.amount, 0))
  return {
    total: lines.length, matched, unmatched: lines.length - matched,
    matchedPct: lines.length ? Math.round((matched / lines.length) * 100) : 0,
    inflow, outflow,
  }
}

// ── Cheque lifecycle ─────────────────────────────────────────────────────────
export type ChequeDirection = 'issued' | 'received'
export type ChequeStatus = 'draft' | 'issued' | 'received' | 'deposited' | 'presented' | 'cleared' | 'bounced' | 'cancelled'

/** Allowed transitions per direction (a small, auditable state machine). */
export const CHEQUE_FLOW: Record<ChequeDirection, Partial<Record<ChequeStatus, ChequeStatus[]>>> = {
  issued: {
    draft: ['issued', 'cancelled'],
    issued: ['presented', 'cancelled'],
    presented: ['cleared', 'bounced'],
    bounced: ['presented', 'cancelled'],
  },
  received: {
    draft: ['received', 'cancelled'],
    received: ['deposited', 'cancelled'],
    deposited: ['cleared', 'bounced'],
    bounced: ['deposited', 'cancelled'],
  },
}
export function canTransition(direction: ChequeDirection, from: ChequeStatus, to: ChequeStatus): boolean {
  return (CHEQUE_FLOW[direction][from] ?? []).includes(to)
}
/** Initial post-draft status for a direction. */
export function chequeStart(direction: ChequeDirection): ChequeStatus {
  return direction === 'issued' ? 'issued' : 'received'
}

export interface ChequeKpis { open: number; openAmount: number; dueSoon: number; bounced: number; cleared: number }
export function chequeKpis(cheques: { status: ChequeStatus; amount: number; dueDate?: string | null }[], today = new Date().toISOString().slice(0, 10)): ChequeKpis {
  const OPEN: ChequeStatus[] = ['issued', 'received', 'deposited', 'presented']
  const open = cheques.filter(c => OPEN.includes(c.status))
  const soon = open.filter(c => c.dueDate && dayDiff(c.dueDate, today) <= 7 && c.dueDate >= today).length
  return {
    open: open.length,
    openAmount: round2(open.reduce((s, c) => s + c.amount, 0)),
    dueSoon: soon,
    bounced: cheques.filter(c => c.status === 'bounced').length,
    cleared: cheques.filter(c => c.status === 'cleared').length,
  }
}

// ── Petty cash ───────────────────────────────────────────────────────────────
export type PettyKind = 'float' | 'expense' | 'replenish'
export interface PettyEntry { kind: PettyKind; amount: number }
export interface PettySummary { balance: number; floatTotal: number; spent: number; replenished: number; lowBalance: boolean }
/**
 * Petty-cash position: float + replenishments increase, expenses decrease.
 * `lowBalance` flags when the balance drops under 20% of the float.
 */
export function pettyCashSummary(entries: PettyEntry[]): PettySummary {
  const floatTotal = round2(entries.filter(e => e.kind === 'float').reduce((s, e) => s + e.amount, 0))
  const spent = round2(entries.filter(e => e.kind === 'expense').reduce((s, e) => s + e.amount, 0))
  const replenished = round2(entries.filter(e => e.kind === 'replenish').reduce((s, e) => s + e.amount, 0))
  const balance = round2(floatTotal + replenished - spent)
  return { balance, floatTotal, spent, replenished, lowBalance: floatTotal > 0 && balance < floatTotal * 0.2 }
}
