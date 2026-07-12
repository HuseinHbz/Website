/**
 * Treasury FX-risk engine (Phase 26.14, M9) — pure, unit-tested. Currency
 * exposure (assets vs liabilities per currency) + realized / unrealized FX
 * gain-loss + a risk level. Complements the 26.8 revaluation engine (which books
 * the unrealized delta to the GL) — this computes the exposure/risk view.
 */

function round2(n: number): number { return Math.round(n * 100) / 100 }

export interface CurrencyPosition { currency: string; assets: number; liabilities: number }
export interface ExposureRow {
  currency: string
  assets: number
  liabilities: number
  netExposure: number       // assets − liabilities (in the foreign currency)
}
export function exposureByCurrency(positions: CurrencyPosition[]): ExposureRow[] {
  const m = new Map<string, { a: number; l: number }>()
  for (const p of positions) {
    const cur = m.get(p.currency) ?? { a: 0, l: 0 }
    cur.a += Number(p.assets) || 0; cur.l += Number(p.liabilities) || 0
    m.set(p.currency, cur)
  }
  return [...m.entries()].map(([currency, v]) => ({ currency, assets: round2(v.a), liabilities: round2(v.l), netExposure: round2(v.a - v.l) }))
    .filter(r => r.assets !== 0 || r.liabilities !== 0)
    .sort((a, b) => Math.abs(b.netExposure) - Math.abs(a.netExposure))
}

/** Unrealized FX gain/loss on an open position: exposure × (currentRate − bookedRate). */
export function unrealizedFx(netExposureForeign: number, bookedRate: number, currentRate: number): number {
  return round2(netExposureForeign * (currentRate - bookedRate))
}

/** Realized FX gain/loss on a settled amount: settledForeign × (settleRate − bookedRate). */
export function realizedFx(settledForeign: number, bookedRate: number, settleRate: number): number {
  return round2(settledForeign * (settleRate - bookedRate))
}

export type RiskLevel = 'low' | 'medium' | 'high'
/**
 * Currency risk level from the exposure's Rial value relative to total equity
 * (or any base). >20% of base = high, >10% = medium.
 */
export function currencyRiskLevel(exposureBase: number, baseTotal: number): RiskLevel {
  if (baseTotal <= 0) return exposureBase > 0 ? 'high' : 'low'
  const pct = Math.abs(exposureBase) / baseTotal * 100
  return pct > 20 ? 'high' : pct > 10 ? 'medium' : 'low'
}

export interface RiskSummary { exposures: ExposureRow[]; totalUnrealized: number; level: RiskLevel }
/** Roll exposures + booked/current rates into a risk summary. */
export function riskSummary(
  exposures: ExposureRow[],
  rates: Record<string, { booked: number; current: number }>,
  baseTotal: number,
): RiskSummary {
  let totalUnrealized = 0, exposureBase = 0
  for (const e of exposures) {
    const r = rates[e.currency]
    if (r) { totalUnrealized += unrealizedFx(e.netExposure, r.booked, r.current); exposureBase += e.netExposure * r.current }
  }
  return { exposures, totalUnrealized: round2(totalUnrealized), level: currencyRiskLevel(exposureBase, baseTotal) }
}
