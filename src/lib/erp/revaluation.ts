/**
 * Currency Revaluation Engine (Phase 26.8, Task 9) — pure core.
 *
 * Recognises the Rial-value change of foreign-currency positions (assets,
 * open receivables/payables) between their immutable booked rate and today's
 * rate — WITHOUT touching the original documents. The recognition happens as
 * a normal double-entry journal entry on dedicated accounts:
 *
 *   net gain:  Dr 1190 FX Revaluation Adjustment / Cr 4900 Currency Gain
 *   net loss:  Dr 6980 Currency Loss / Cr 1190 FX Revaluation Adjustment
 *
 * Re-running is safe: the data layer books only the delta vs what previous
 * revaluation entries already recognised (cumulative accounting).
 */
import type { RateMap } from './currency'

export const REVAL_ACCOUNTS = { adjustment: '1190', gain: '4900', loss: '6980' } as const

export type FxPositionKind = 'asset' | 'receivable' | 'payable'

export interface FxPosition {
  key: string
  label: string
  kind: FxPositionKind
  currency: string
  /** Amount in the original (foreign) currency — immutable. */
  amountForeign: number
  /** Rial per unit at registration — immutable. */
  bookedRate: number
}

export interface RevaluedPosition extends FxPosition {
  currentRate: number
  bookedValue: number   // Rial at registration
  currentValue: number  // Rial today
  /** Rial gain(+)/loss(−) from the company's perspective. Payables invert:
   * a rising rate on a foreign debt is a LOSS. */
  gainLoss: number
}

export interface RevaluationResult {
  positions: RevaluedPosition[]
  totalGain: number
  totalLoss: number
  /** Net Rial gain(+)/loss(−) across all positions. */
  net: number
}

const round0 = (n: number) => Math.round(n)

/** Revalue FX positions against today's rates (positions without a current
 * rate are skipped — never silently valued 1:1). */
export function revaluate(positions: FxPosition[], currentRates: RateMap): RevaluationResult {
  const out: RevaluedPosition[] = []
  for (const p of positions) {
    const currentRate = currentRates[p.currency]
    if (currentRate == null || !(p.amountForeign > 0) || !(p.bookedRate > 0)) continue
    const bookedValue = round0(p.amountForeign * p.bookedRate)
    const currentValue = round0(p.amountForeign * currentRate)
    const raw = currentValue - bookedValue
    const gainLoss = p.kind === 'payable' ? -raw : raw
    out.push({ ...p, currentRate, bookedValue, currentValue, gainLoss })
  }
  const totalGain = round0(out.filter(p => p.gainLoss > 0).reduce((s, p) => s + p.gainLoss, 0))
  const totalLoss = round0(out.filter(p => p.gainLoss < 0).reduce((s, p) => s - p.gainLoss, 0))
  return { positions: out, totalGain, totalLoss, net: round0(totalGain - totalLoss) }
}

export interface RevalEntryLine { accountCode: string; debit: number; credit: number; memo: string }

/**
 * Balanced journal lines recognising a net Rial gain/loss delta.
 * Returns null when there is nothing to book (delta 0).
 */
export function revaluationEntryLines(netDelta: number): RevalEntryLine[] | null {
  const amt = Math.abs(round0(netDelta))
  if (amt === 0) return null
  if (netDelta > 0) {
    return [
      { accountCode: REVAL_ACCOUNTS.adjustment, debit: amt, credit: 0, memo: 'FX revaluation — value increase' },
      { accountCode: REVAL_ACCOUNTS.gain, debit: 0, credit: amt, memo: 'Unrealized currency gain' },
    ]
  }
  return [
    { accountCode: REVAL_ACCOUNTS.loss, debit: amt, credit: 0, memo: 'Unrealized currency loss' },
    { accountCode: REVAL_ACCOUNTS.adjustment, debit: 0, credit: amt, memo: 'FX revaluation — value decrease' },
  ]
}

/** Currency exposure rollup for the report: per-currency totals. */
export function exposureByCurrency(positions: RevaluedPosition[]) {
  const map = new Map<string, { currency: string; amountForeign: number; bookedValue: number; currentValue: number; gainLoss: number; positions: number }>()
  for (const p of positions) {
    const e = map.get(p.currency) ?? { currency: p.currency, amountForeign: 0, bookedValue: 0, currentValue: 0, gainLoss: 0, positions: 0 }
    e.amountForeign += p.amountForeign
    e.bookedValue += p.bookedValue
    e.currentValue += p.currentValue
    e.gainLoss += p.gainLoss
    e.positions++
    map.set(p.currency, e)
  }
  return [...map.values()].sort((a, b) => b.currentValue - a.currentValue)
}
