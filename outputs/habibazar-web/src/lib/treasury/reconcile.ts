/**
 * Smart bank reconciliation engine (Phase 26.14, M3) — pure, unit-tested.
 * Extends the amount/date auto-match (`banking.matchStatement`) with reference
 * and name/description similarity, producing scored suggestions + a match status
 * (matched / suggested / unmatched). The data layer persists confirmed matches
 * to `bank_matches` with an audit record.
 */

export interface StmtLine { id: number; date: string; amount: number; description?: string; reference?: string }
export interface ErpCandidate { id: string; date: string; amount: number; party?: string; reference?: string }

function daysBetween(a: string, b: string): number {
  const x = Date.parse(a), y = Date.parse(b)
  return isNaN(x) || isNaN(y) ? 999 : Math.abs(x - y) / 86_400_000
}

/** Token-overlap (Jaccard) similarity of two strings, 0..1. */
export function similarity(a?: string, b?: string): number {
  const ta = new Set((a ?? '').toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter(w => w.length > 1))
  const tb = new Set((b ?? '').toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter(w => w.length > 1))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const w of ta) if (tb.has(w)) inter++
  return Math.round(inter / (ta.size + tb.size - inter) * 100) / 100
}

export type MatchStatus = 'matched' | 'suggested' | 'unmatched'
export interface Suggestion { lineId: number; candidateId: string; confidence: number; status: MatchStatus; reasons: string[] }

/** Score a single line against a candidate (0..1). */
export function scoreMatch(line: StmtLine, cand: ErpCandidate, dateWindowDays = 5): { confidence: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  if (Math.abs(line.amount) === Math.abs(cand.amount) && line.amount !== 0) { score += 0.5; reasons.push('exact amount') }
  else return { confidence: 0, reasons: ['amount mismatch'] }   // amount must match
  const dd = daysBetween(line.date, cand.date)
  if (dd === 0) { score += 0.2; reasons.push('same date') }
  else if (dd <= dateWindowDays) { score += 0.1; reasons.push(`within ${dateWindowDays}d`) }
  if (line.reference && cand.reference && line.reference.trim().toLowerCase() === cand.reference.trim().toLowerCase()) { score += 0.2; reasons.push('reference match') }
  const sim = similarity(line.description, cand.party)
  if (sim >= 0.5) { score += 0.1; reasons.push(`name similarity ${sim}`) }
  else if (sim > 0) { score += sim * 0.1 }
  return { confidence: Math.min(1, Math.round(score * 100) / 100), reasons }
}

/** Best suggestion per statement line + a match status. */
export function reconcile(lines: StmtLine[], candidates: ErpCandidate[], dateWindowDays = 5): Suggestion[] {
  return lines.map(line => {
    let best: Suggestion = { lineId: line.id, candidateId: '', confidence: 0, status: 'unmatched', reasons: [] }
    for (const c of candidates) {
      const s = scoreMatch(line, c, dateWindowDays)
      if (s.confidence > best.confidence) best = { lineId: line.id, candidateId: c.id, confidence: s.confidence, status: statusOf(s.confidence), reasons: s.reasons }
    }
    return best
  })
}
function statusOf(conf: number): MatchStatus { return conf >= 0.9 ? 'matched' : conf >= 0.6 ? 'suggested' : 'unmatched' }

export interface ReconStats { total: number; matched: number; suggested: number; unmatched: number; autoMatchRatePct: number }
export function reconStats(suggestions: Suggestion[]): ReconStats {
  const matched = suggestions.filter(s => s.status === 'matched').length
  const suggested = suggestions.filter(s => s.status === 'suggested').length
  const total = suggestions.length
  return { total, matched, suggested, unmatched: total - matched - suggested, autoMatchRatePct: total ? Math.round(matched / total * 1000) / 10 : 0 }
}
