/**
 * Process mining data layer (Phase 26.13, M4). Builds process-event timelines
 * from real ERP records (approval flow from approval_requests/_actions; sales &
 * purchase document lifecycle) and feeds the pure `processMining.ts` engine to
 * detect bottlenecks, delay-vs-previous-month and a performance score. Snapshots
 * into process_metrics.
 */
import { pgQuery } from '@/lib/db'
import { aggregateStages, bottleneck, performanceScore, delayChangePct, cycleTime, type ProcessEvent } from './processMining'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

/** Approval process cases: each request → [submitted, level actions…, decided]. */
async function approvalCases(): Promise<ProcessEvent[][]> {
  const reqs = await pgQuery<{ id: number; created_at: string; decided_at: string | null; status: string }>(
    `SELECT id, created_at, decided_at, status FROM approval_requests ORDER BY id DESC LIMIT 500`)
  const cases: ProcessEvent[][] = []
  for (const r of reqs) {
    const acts = await pgQuery<{ level: number; created_at: string }>(`SELECT level, created_at FROM approval_actions WHERE request_id=$1 ORDER BY id`, [r.id])
    const events: ProcessEvent[] = [{ stage: 'submitted', at: iso(r.created_at) }]
    for (const a of acts) events.push({ stage: `level_${a.level}`, at: iso(a.created_at) })
    if (r.decided_at) events.push({ stage: r.status === 'rejected' ? 'rejected' : 'approved', at: iso(r.decided_at) })
    if (events.length >= 2) cases.push(events)
  }
  return cases
}
function iso(pg: string): string { return new Date(pg.replace(' ', 'T') + 'Z').toISOString() }

export interface ProcessAnalysis {
  process: string
  caseCount: number
  avgCycleHours: number
  bottleneck: { transition: string; avgHours: number } | null
  transitions: { transition: string; avgHours: number; count: number; maxHours: number }[]
  failureRatePct: number
  performanceScore: number
  delayVsBaselinePct: number | null
}

/** Analyze the approval process (the one with real per-step timestamps). */
export async function analyzeApprovalProcess(): Promise<ProcessAnalysis> {
  const cases = await approvalCases()
  const stats = aggregateStages(cases)
  const avgCycle = cases.length ? Math.round(cases.reduce((s, c) => s + cycleTime(c), 0) / cases.length * 10) / 10 : 0
  const rejected = cases.filter(c => c[c.length - 1]?.stage === 'rejected').length
  const failureRate = cases.length ? Math.round(rejected / cases.length * 1000) / 10 : 0
  const bn = bottleneck(stats)
  // Delay signal: this-month vs last-month average cycle (by request created month).
  const monthly = await pgQuery<{ m: string; avg: number }>(
    `SELECT substr(created_at,1,7) AS m, AVG(EXTRACT(EPOCH FROM (decided_at::timestamp - created_at::timestamp))/3600.0)::float AS avg
     FROM approval_requests WHERE decided_at IS NOT NULL GROUP BY 1 ORDER BY 1 DESC LIMIT 2`)
  const delay = monthly.length === 2 ? delayChangePct(Number(monthly[0].avg), Number(monthly[1].avg)) : null
  return {
    process: 'approval', caseCount: cases.length, avgCycleHours: avgCycle,
    bottleneck: bn ? { transition: bn.transition, avgHours: bn.avgHours } : null,
    transitions: stats.slice(0, 12), failureRatePct: failureRate,
    performanceScore: performanceScore(avgCycle, 48, failureRate), delayVsBaselinePct: delay,
  }
}

/** Document-lifecycle process (sales or purchase) from date→updated span. */
export async function analyzeDocProcess(kind: 'sales' | 'purchase'): Promise<ProcessAnalysis> {
  const table = kind === 'sales' ? 'sales_documents' : 'purchase_documents'
  const rows = await pgQuery<{ cnt: number; avgh: number }>(
    `SELECT COUNT(*)::int AS cnt, COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at::timestamp - created_at::timestamp))/3600.0),0)::float AS avgh
     FROM ${table} WHERE doc_type='invoice'`)
  const avg = Math.round(Number(rows[0]?.avgh ?? 0) * 10) / 10
  return { process: kind, caseCount: Number(rows[0]?.cnt ?? 0), avgCycleHours: avg, bottleneck: null, transitions: [], failureRatePct: 0, performanceScore: performanceScore(avg, 72, 0), delayVsBaselinePct: null }
}

/** Snapshot the approval process metrics into process_metrics. */
export async function snapshotProcess(period: string): Promise<{ saved: number }> {
  const a = await analyzeApprovalProcess()
  await pgQuery(`INSERT INTO process_metrics (process, period, transition, avg_hours, max_hours, case_count, failure_rate_pct, performance_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    ['approval', period, a.bottleneck?.transition ?? null, a.avgCycleHours, a.transitions[0]?.maxHours ?? null, a.caseCount, a.failureRatePct, a.performanceScore])
  void NOW
  return { saved: 1 }
}
