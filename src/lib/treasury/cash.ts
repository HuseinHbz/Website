/**
 * Cash position + liquidity forecast engine (Phase 26.14, M7/M8) — pure,
 * unit-tested. Cash position aggregates bank + cash balances and pending flows;
 * the liquidity forecast buckets expected inflows (AR/sales) and outflows
 * (AP/salaries/payments) over 7/30/90/365-day horizons.
 */

function round2(n: number): number { return Math.round(n * 100) / 100 }

export interface CashPositionInput {
  bankBalances: number      // sum of bank account balances
  cashAccounts: number      // petty cash + on-hand
  pendingReceipts: number   // confirmed but not-yet-cleared inflows
  pendingPayments: number   // approved but not-yet-processed outflows
}
export interface CashPosition {
  bank: number; cash: number; available: number
  pendingReceipts: number; pendingPayments: number
  projected: number         // available + pendingReceipts − pendingPayments
}
export function cashPosition(i: CashPositionInput): CashPosition {
  const available = round2(i.bankBalances + i.cashAccounts)
  return {
    bank: round2(i.bankBalances), cash: round2(i.cashAccounts), available,
    pendingReceipts: round2(i.pendingReceipts), pendingPayments: round2(i.pendingPayments),
    projected: round2(available + i.pendingReceipts - i.pendingPayments),
  }
}

export interface DatedFlow { date: string; amount: number }   // amount ≥ 0
export const HORIZONS = [7, 30, 90, 365] as const

export interface LiquidityBucket { days: number; inflow: number; outflow: number; net: number; expectedBalance: number }
/**
 * Liquidity forecast: for each horizon, sum inflows/outflows due within it and
 * project the expected balance from the opening cash.
 */
export function liquidityForecast(openingCash: number, inflows: DatedFlow[], outflows: DatedFlow[], asOf: string, horizons: readonly number[] = HORIZONS): LiquidityBucket[] {
  const base = Date.parse(asOf)
  const within = (flows: DatedFlow[], days: number) => flows.reduce((s, f) => {
    const dd = (Date.parse(f.date) - base) / 86_400_000
    return dd >= 0 && dd <= days ? s + (Number(f.amount) || 0) : s
  }, 0)
  return horizons.map(days => {
    const inflow = round2(within(inflows, days))
    const outflow = round2(within(outflows, days))
    return { days, inflow, outflow, net: round2(inflow - outflow), expectedBalance: round2(openingCash + inflow - outflow) }
  })
}

export type LiquidityRisk = 'healthy' | 'watch' | 'critical'
/** Liquidity risk from the nearest-horizon projected balance vs a safety buffer. */
export function liquidityRisk(buckets: LiquidityBucket[], safetyBuffer = 0): LiquidityRisk {
  const near = buckets.find(b => b.days === 30) ?? buckets[0]
  if (!near) return 'healthy'
  if (near.expectedBalance < 0) return 'critical'
  if (near.expectedBalance < safetyBuffer) return 'watch'
  return 'healthy'
}
