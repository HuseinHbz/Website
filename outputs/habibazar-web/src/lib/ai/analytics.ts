/**
 * AI Analytics (Phase 22 — AI Platform, subsystem 5).
 *
 * Pure aggregation over `ai_usage` rows → dashboard summary. Kept side-effect
 * free so it is unit-tested; the API route does the DB read and hands rows here.
 */

export interface UsageRow {
  id: number
  ts: string
  provider: string
  model: string | null
  source: string
  latencyMs: number
  success: number        // 0/1
  error: string | null
  inputTokens: number | null
  outputTokens: number | null
  ragSources: number
  feedback: number       // -1 / 0 / 1
}

export interface Breakdown { key: string; calls: number; tokens: number }
export interface DailyPoint { date: string; calls: number; failures: number; tokens: number }

export interface AnalyticsSummary {
  totalCalls: number
  successCalls: number
  failedCalls: number
  successRate: number       // 0..100, one decimal
  avgLatencyMs: number
  p95LatencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estCostUsd: number        // tokens/1000 * costPer1k (0 if not configured)
  ragHitRate: number        // % of calls that used ≥1 KB source
  thumbsUp: number
  thumbsDown: number
  byProvider: Breakdown[]
  byModel: Breakdown[]
  bySource: Breakdown[]
  daily: DailyPoint[]       // last `days`
  recentFailures: { ts: string; provider: string; source: string; error: string }[]
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10
}

function tokensOf(r: UsageRow): number {
  return (r.inputTokens ?? 0) + (r.outputTokens ?? 0)
}

function topBreakdown(rows: UsageRow[], keyOf: (r: UsageRow) => string, limit = 8): Breakdown[] {
  const map = new Map<string, { calls: number; tokens: number }>()
  for (const r of rows) {
    const k = keyOf(r) || '—'
    const cur = map.get(k) ?? { calls: 0, tokens: 0 }
    cur.calls++; cur.tokens += tokensOf(r)
    map.set(k, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, limit)
}

/** Build the analytics summary from raw usage rows. `days` bounds the daily series. */
export function summarize(rows: UsageRow[], opts: { days?: number; costPer1k?: number } = {}): AnalyticsSummary {
  const days = opts.days ?? 14
  const costPer1k = opts.costPer1k ?? 0

  const total = rows.length
  const success = rows.filter(r => r.success === 1).length
  const failed = total - success
  const latencies = rows.map(r => r.latencyMs).sort((a, b) => a - b)
  const avgLatency = total === 0 ? 0 : Math.round(latencies.reduce((s, x) => s + x, 0) / total)
  const p95 = latencies.length === 0 ? 0 : latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
  const inputTokens = rows.reduce((s, r) => s + (r.inputTokens ?? 0), 0)
  const outputTokens = rows.reduce((s, r) => s + (r.outputTokens ?? 0), 0)
  const totalTokens = inputTokens + outputTokens
  const ragHits = rows.filter(r => r.ragSources > 0).length

  // Daily series over the last `days` calendar days.
  const dayMap = new Map<string, { calls: number; failures: number; tokens: number }>()
  const cutoff = Date.now() - days * 86400000
  for (const r of rows) {
    const t = new Date(r.ts.replace(' ', 'T')).getTime()
    if (!Number.isNaN(t) && t < cutoff) continue
    const d = r.ts.slice(0, 10)
    const cur = dayMap.get(d) ?? { calls: 0, failures: 0, tokens: 0 }
    cur.calls++; if (r.success !== 1) cur.failures++; cur.tokens += tokensOf(r)
    dayMap.set(d, cur)
  }
  const daily = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))

  const recentFailures = rows
    .filter(r => r.success !== 1)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 10)
    .map(r => ({ ts: r.ts, provider: r.provider, source: r.source, error: r.error ?? 'unknown' }))

  return {
    totalCalls: total,
    successCalls: success,
    failedCalls: failed,
    successRate: pct(success, total),
    avgLatencyMs: avgLatency,
    p95LatencyMs: p95,
    inputTokens, outputTokens, totalTokens,
    estCostUsd: Math.round((totalTokens / 1000) * costPer1k * 100) / 100,
    ragHitRate: pct(ragHits, total),
    thumbsUp: rows.filter(r => r.feedback === 1).length,
    thumbsDown: rows.filter(r => r.feedback === -1).length,
    byProvider: topBreakdown(rows, r => r.provider),
    byModel: topBreakdown(rows, r => r.model ?? '—'),
    bySource: topBreakdown(rows, r => r.source),
    daily,
    recentFailures,
  }
}
