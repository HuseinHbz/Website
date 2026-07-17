/**
 * Alternative-supplier ranking — pure engine (Phase 26.17 M2). Deterministic, no
 * DB. Scores each product↔supplier relationship on price / lead-time / quality /
 * delivery and recommends the best source. Reuses the A/B/C/D grading idea from
 * purchasing's vendor evaluation but at the product-supplier grain.
 */

export interface ProductSupplier {
  id: number
  supplierId: number
  supplierName?: string
  purchasePrice: number
  currency?: string
  leadTimeDays: number
  minimumOrderQty?: number
  qualityScore: number   // 0..100
  deliveryScore: number  // 0..100
  isPrimary?: number
}

export interface RankedSupplier extends ProductSupplier {
  score: number   // 0..100 composite
  grade: 'A' | 'B' | 'C' | 'D'
  rank: number
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

export function gradeOf(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

/**
 * Composite 0..100. Price is scored *relative* to the cheapest offer in the set
 * (cheapest = 100), lead time relative to the fastest. Quality/delivery are the
 * stored 0..100 scores. Weights: price 30 / lead 20 / quality 30 / delivery 20.
 */
export function rankSuppliers(list: ProductSupplier[]): RankedSupplier[] {
  const active = list.filter(s => s.purchasePrice >= 0)
  if (active.length === 0) return []
  const minPrice = Math.min(...active.map(s => s.purchasePrice || Infinity))
  const minLead = Math.min(...active.map(s => (s.leadTimeDays ?? 0)))
  const maxLead = Math.max(...active.map(s => (s.leadTimeDays ?? 0)))
  const scored = active.map(s => {
    const priceScore = s.purchasePrice > 0 ? clamp((minPrice / s.purchasePrice) * 100) : 100
    const leadScore = maxLead === minLead ? 100 : clamp((1 - ((s.leadTimeDays - minLead) / (maxLead - minLead))) * 100)
    const composite = round1(priceScore * 0.3 + leadScore * 0.2 + clamp(s.qualityScore) * 0.3 + clamp(s.deliveryScore) * 0.2)
    return { ...s, score: composite, grade: gradeOf(composite), rank: 0 }
  })
  scored.sort((a, b) => b.score - a.score || a.purchasePrice - b.purchasePrice)
  scored.forEach((s, i) => { s.rank = i + 1 })
  return scored
}

/** The recommended source: highest composite score (ties broken by price). */
export function bestSupplier(list: ProductSupplier[]): RankedSupplier | null {
  const ranked = rankSuppliers(list)
  return ranked.length ? ranked[0] : null
}

/** A short comparison summary (cheapest / fastest / best-rated / recommended). */
export function compareSuppliers(list: ProductSupplier[]): {
  cheapest: number | null; fastest: number | null; recommended: number | null; count: number
} {
  const active = list.filter(s => s.purchasePrice >= 0)
  if (active.length === 0) return { cheapest: null, fastest: null, recommended: null, count: 0 }
  const cheapest = [...active].sort((a, b) => a.purchasePrice - b.purchasePrice)[0].supplierId
  const fastest = [...active].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0].supplierId
  const rec = bestSupplier(active)
  return { cheapest, fastest, recommended: rec?.supplierId ?? null, count: active.length }
}
