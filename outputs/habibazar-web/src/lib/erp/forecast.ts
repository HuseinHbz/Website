/**
 * Financial Forecasting engine (Phase 26.11, M5) — pure, unit-tested.
 *
 * A single general engine over a monthly numeric series, supporting four methods
 * (historical trend / moving average / growth % / seasonal). Used for revenue,
 * expense, cash-flow and profit forecasts. Generalises the specialised
 * `forecastSales` (least-squares) without touching it.
 */

export const FORECAST_METHODS = ['trend', 'moving_average', 'growth', 'seasonal'] as const
export type ForecastMethod = (typeof FORECAST_METHODS)[number]
export const FORECAST_METRICS = ['revenue', 'expense', 'cash_flow', 'profit'] as const
export type ForecastMetric = (typeof FORECAST_METRICS)[number]

export interface Point { period: string; value: number }

function round2(n: number): number { return Math.round(n * 100) / 100 }

/** Next 'YYYY-MM' key (wraps year at December). */
export function nextPeriod(key: string): string {
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7))
  if (!y || !m) return key
  return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Least-squares linear trend projected `horizon` months (never below zero). */
function trendForecast(ys: number[], horizon: number): number[] {
  const n = ys.length
  if (n < 3) { const avg = ys.reduce((s, v) => s + v, 0) / (n || 1); return Array.from({ length: horizon }, () => Math.max(0, avg)) }
  const xs = ys.map((_, i) => i)
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  const denom = xs.reduce((s, x) => s + (x - mx) * (x - mx), 0)
  const slope = denom === 0 ? 0 : xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / denom
  const out: number[] = []
  for (let i = 1; i <= horizon; i++) out.push(Math.max(0, my + slope * (n - 1 + i - mx)))
  return out
}

/** Flat projection at the trailing moving average of the last `window` points. */
function movingAverageForecast(ys: number[], horizon: number, window: number): number[] {
  const w = Math.max(1, Math.min(window, ys.length))
  const avg = ys.slice(-w).reduce((s, v) => s + v, 0) / w
  return Array.from({ length: horizon }, () => Math.max(0, avg))
}

/** Compound growth from the last value. `growthPct` given, else average PoP growth. */
function growthForecast(ys: number[], horizon: number, growthPct?: number): number[] {
  let g = growthPct
  if (g == null) {
    const rates: number[] = []
    for (let i = 1; i < ys.length; i++) if (ys[i - 1] > 0) rates.push((ys[i] - ys[i - 1]) / ys[i - 1])
    g = rates.length ? (rates.reduce((s, r) => s + r, 0) / rates.length) * 100 : 0
  }
  const factor = 1 + g / 100
  const out: number[] = []
  let last = ys[ys.length - 1] ?? 0
  for (let i = 1; i <= horizon; i++) { last = Math.max(0, last * factor); out.push(last) }
  return out
}

/**
 * Seasonal: seasonal index per position over `seasonLength`, applied to the
 * trend level. Falls back to trend when there isn't a full cycle of history.
 */
function seasonalForecast(ys: number[], horizon: number, seasonLength: number): number[] {
  const L = Math.max(2, seasonLength)
  if (ys.length < L) return trendForecast(ys, horizon)
  const overallAvg = ys.reduce((s, v) => s + v, 0) / ys.length
  const idx: number[] = []
  for (let pos = 0; pos < L; pos++) {
    const vals: number[] = []
    for (let i = pos; i < ys.length; i += L) vals.push(ys[i])
    const avg = vals.reduce((s, v) => s + v, 0) / (vals.length || 1)
    idx[pos] = overallAvg > 0 ? avg / overallAvg : 1
  }
  const trend = trendForecast(ys, horizon)
  const out: number[] = []
  for (let i = 0; i < horizon; i++) {
    const pos = (ys.length + i) % L
    out.push(Math.max(0, trend[i] * idx[pos]))
  }
  return out
}

export interface ForecastOptions { method?: ForecastMethod; horizon?: number; window?: number; growthPct?: number; seasonLength?: number }
export interface ForecastResult { method: ForecastMethod; history: Point[]; forecast: Point[]; nextValue: number }

/** Forecast the next `horizon` periods with the chosen method. */
export function forecast(history: Point[], opts: ForecastOptions = {}): ForecastResult {
  const method = opts.method ?? 'trend'
  const horizon = Math.max(1, opts.horizon ?? 3)
  const ys = history.map(p => Number(p.value) || 0)
  let preds: number[]
  if (!ys.length) preds = Array.from({ length: horizon }, () => 0)
  else if (method === 'moving_average') preds = movingAverageForecast(ys, horizon, opts.window ?? 3)
  else if (method === 'growth') preds = growthForecast(ys, horizon, opts.growthPct)
  else if (method === 'seasonal') preds = seasonalForecast(ys, horizon, opts.seasonLength ?? 12)
  else preds = trendForecast(ys, horizon)

  let cursor = history.length ? history[history.length - 1].period : new Date().toISOString().slice(0, 7)
  const fc: Point[] = preds.map(v => { cursor = nextPeriod(cursor); return { period: cursor, value: round2(v) } })
  return { method, history: history.map(p => ({ period: p.period, value: round2(Number(p.value) || 0) })), forecast: fc, nextValue: fc[0]?.value ?? 0 }
}

/** Simple single-number growth projection (Previous × (1+growth%)). */
export function projectGrowth(previous: number, growthPct: number): number {
  return round2(previous * (1 + growthPct / 100))
}
