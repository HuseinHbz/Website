/**
 * Stock intelligence — pure engine (Phase 26.19, PARTS 3/8). Deterministic
 * analytics over the existing move ledger: ABC (value concentration), XYZ
 * (demand variability), movement classes (fast/slow/dead), stock aging,
 * turnover, near-expiry and reorder suggestions. No DB — fully unit-tested.
 */

export interface ProductFact {
  id: number
  sku: string
  name: string
  onHand: number
  value: number            // on-hand valuation (from the costing engine)
  annualIssueQty: number   // total issued qty in the window
  monthlyIssues: number[]  // issue qty per month (chronological)
  lastMoveDaysAgo: number | null // null = never moved
  reorderPoint: number
  safetyStock: number
  maxStock: number
}

// ── ABC: cumulative value share (A ≤ 80 %, B ≤ 95 %, C rest) ────────────────
export type AbcClass = 'A' | 'B' | 'C'
export function abcAnalysis(items: { id: number; value: number }[]): Map<number, AbcClass> {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0)
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const out = new Map<number, AbcClass>()
  let cum = 0
  for (const i of sorted) {
    // Classify by the cumulative share BEFORE this item, so the item that
    // crosses a boundary still belongs to the higher class (a single dominant
    // product is A, not B — verified against live data in Phase 26.19).
    const prevShare = total > 0 ? cum / total : 1
    cum += Math.max(0, i.value)
    out.set(i.id, prevShare < 0.8 ? 'A' : prevShare < 0.95 ? 'B' : 'C')
  }
  return out
}

// ── XYZ: coefficient of variation of monthly demand (X<0.5, Y<1, Z≥1) ───────
export type XyzClass = 'X' | 'Y' | 'Z'
export function coefficientOfVariation(series: number[]): number {
  if (series.length === 0) return Infinity
  const mean = series.reduce((s, v) => s + v, 0) / series.length
  if (mean === 0) return Infinity
  const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length
  return Math.sqrt(variance) / mean
}
export function xyzClass(series: number[]): XyzClass {
  const cv = coefficientOfVariation(series)
  return cv < 0.5 ? 'X' : cv < 1 ? 'Y' : 'Z'
}

// ── Movement class: fast / slow / dead ───────────────────────────────────────
export type MovementClass = 'fast' | 'slow' | 'dead'
/** Dead = no movement in `deadDays` (or never); fast = issued ≥ 12×/yr equivalent. */
export function movementClass(f: Pick<ProductFact, 'annualIssueQty' | 'lastMoveDaysAgo' | 'onHand'>, deadDays = 180): MovementClass {
  if (f.lastMoveDaysAgo == null || f.lastMoveDaysAgo >= deadDays) return f.onHand > 0 ? 'dead' : 'slow'
  return f.annualIssueQty >= 12 ? 'fast' : 'slow'
}

// ── Stock aging buckets by last receipt age ──────────────────────────────────
export interface AgingBucket { label: string; maxDays: number }
export const AGING_BUCKETS: AgingBucket[] = [
  { label: '0-30', maxDays: 30 }, { label: '31-90', maxDays: 90 },
  { label: '91-180', maxDays: 180 }, { label: '181-365', maxDays: 365 },
  { label: '365+', maxDays: Infinity },
]
export function agingBucket(daysSinceReceipt: number): string {
  for (const b of AGING_BUCKETS) if (daysSinceReceipt <= b.maxDays) return b.label
  return '365+'
}

// ── Turnover: COGS-qty proxy = issues / average inventory ────────────────────
export function turnoverRatio(annualIssueQty: number, avgOnHand: number): number {
  if (avgOnHand <= 0) return 0
  return Math.round((annualIssueQty / avgOnHand) * 100) / 100
}

// ── Expiry ───────────────────────────────────────────────────────────────────
export interface BatchFact { id: number; expiryDate: string | null; qtyRemaining: number }
export type ExpiryStatus = 'expired' | 'near' | 'ok' | 'none'
export function expiryStatus(expiryDate: string | null, today: string, nearDays = 30): ExpiryStatus {
  if (!expiryDate) return 'none'
  const d = (new Date(expiryDate).getTime() - new Date(today).getTime()) / 86400000
  if (d < 0) return 'expired'
  if (d <= nearDays) return 'near'
  return 'ok'
}
export function nearExpiry(batches: BatchFact[], today: string, nearDays = 30): BatchFact[] {
  return batches.filter(b => b.qtyRemaining > 0 && ['expired', 'near'].includes(expiryStatus(b.expiryDate, today, nearDays)))
}

// ── Reorder suggestions (reuses reorder point + EOQ inputs) ──────────────────
export interface ReorderSuggestion { id: number; sku: string; name: string; onHand: number; reorderPoint: number; suggestedQty: number }
export function reorderSuggestions(facts: ProductFact[], eoqOf: (f: ProductFact) => number): ReorderSuggestion[] {
  return facts
    .filter(f => f.reorderPoint > 0 && f.onHand <= f.reorderPoint)
    .map(f => {
      const eoq = eoqOf(f)
      const toMax = f.maxStock > 0 ? Math.max(0, f.maxStock - f.onHand) : 0
      const suggested = eoq > 0 ? eoq : toMax > 0 ? toMax : Math.max(f.safetyStock, f.reorderPoint) - f.onHand + f.reorderPoint
      return { id: f.id, sku: f.sku, name: f.name, onHand: f.onHand, reorderPoint: f.reorderPoint, suggestedQty: Math.max(1, Math.round(suggested)) }
    })
    .sort((a, b) => (a.onHand / Math.max(1, a.reorderPoint)) - (b.onHand / Math.max(1, b.reorderPoint)))
}

// ── KPI rollup for the intelligence dashboard ────────────────────────────────
export interface IntelligenceKpis {
  products: number; totalValue: number
  aCount: number; deadCount: number; fastCount: number
  belowReorder: number; nearExpiryCount: number
  avgTurnover: number
}
export function intelligenceKpis(rows: { value: number; abc: AbcClass; movement: MovementClass; belowReorder: boolean; turnover: number }[], nearExpiryCount: number): IntelligenceKpis {
  const n = rows.length
  return {
    products: n,
    totalValue: Math.round(rows.reduce((s, r) => s + r.value, 0) * 100) / 100,
    aCount: rows.filter(r => r.abc === 'A').length,
    deadCount: rows.filter(r => r.movement === 'dead').length,
    fastCount: rows.filter(r => r.movement === 'fast').length,
    belowReorder: rows.filter(r => r.belowReorder).length,
    nearExpiryCount,
    avgTurnover: n ? Math.round((rows.reduce((s, r) => s + r.turnover, 0) / n) * 100) / 100 : 0,
  }
}
