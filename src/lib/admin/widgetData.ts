/**
 * Dashboard widget data resolver (Phase 22.2).
 *
 * Produces REAL data for a set of widget ids by reusing existing, already-verified
 * module services (executive overview, ops snapshot, backups table). Nothing is
 * mocked. The underlying snapshots are computed at most once per request (only if
 * a requested widget needs them), so a dashboard of N widgets is a handful of
 * queries, not N. The client renders generically by the returned `kind`.
 */
import { pgQuery } from '@/lib/db'
import { executiveOverview } from '@/lib/admin/executiveOverview'
import { opsSnapshot } from '@/lib/ops/snapshot'
import { widgetById, widgetTtl } from '@/lib/admin/widgets'

export type WidgetPayload =
  | { kind: 'kpi'; value: number; unit?: string; sub?: string }
  | { kind: 'chart'; points: { x: string; y: number }[] }
  | { kind: 'table'; columns: string[]; rows: (string | number)[][] }
  | { kind: 'list'; items: { level: string; text: string }[] }
  | { kind: 'ops'; metrics: { label: string; value: string; pct?: number }[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }

type Exec = Awaited<ReturnType<typeof executiveOverview>>
type Ops = Awaited<ReturnType<typeof opsSnapshot>>

const EXEC_WIDGETS = new Set(['kpi_net_income', 'kpi_cash', 'kpi_revenue', 'kpi_inventory_value', 'kpi_active_assets', 'kpi_crm_pipeline', 'kpi_crm_leads', 'kpi_ai_calls', 'chart_ai_daily', 'table_activity', 'list_alerts'])
const OPS_WIDGETS = new Set(['ops_system_health', 'ops_subsystems'])

// Per-widget in-memory cache (TTL from widgetTtl). Manual refresh passes fresh=true.
const cache = new Map<string, { at: number; payload: WidgetPayload }>()

/**
 * Resolve a batch of widget ids → { id: payload }. Shared snapshots are computed
 * once per request, and only for widgets whose cache is stale (widget-level TTL,
 * e.g. system-health 30s vs KPIs 5min). `fresh` bypasses the cache.
 */
export async function resolveWidgets(ids: string[], fresh = false): Promise<Record<string, WidgetPayload>> {
  const now = Date.now()
  const out: Record<string, WidgetPayload> = {}
  const stale: string[] = []
  for (const id of ids) {
    const hit = cache.get(id)
    if (!fresh && hit && now - hit.at < widgetTtl(id)) out[id] = hit.payload
    else stale.push(id)
  }
  if (stale.length === 0) return out

  const needExec = stale.some(id => EXEC_WIDGETS.has(id))
  const needOps = stale.some(id => OPS_WIDGETS.has(id))
  const [exec, ops] = await Promise.all([
    needExec ? executiveOverview().catch(() => null) : Promise.resolve(null),
    needOps ? opsSnapshot().catch(() => null) : Promise.resolve(null),
  ])
  for (const id of stale) {
    try {
      const payload = await onePayload(id, exec, ops)
      out[id] = payload
      if (payload.kind !== 'error') cache.set(id, { at: now, payload })
    } catch (e) { out[id] = { kind: 'error', message: e instanceof Error ? e.message : 'failed' } }
  }
  return out
}

async function onePayload(id: string, exec: Exec | null, ops: Ops | null): Promise<WidgetPayload> {
  if (!widgetById(id)) return { kind: 'error', message: 'unknown widget' }
  switch (id) {
    case 'kpi_net_income': return exec?.finance ? { kind: 'kpi', value: exec.finance.netIncome, unit: '$' } : { kind: 'empty' }
    case 'kpi_cash': return exec?.finance ? { kind: 'kpi', value: exec.finance.cash, unit: '$' } : { kind: 'empty' }
    case 'kpi_revenue': return exec?.finance ? { kind: 'kpi', value: exec.finance.revenue, unit: '$' } : { kind: 'empty' }
    case 'kpi_inventory_value': return exec?.inventory ? { kind: 'kpi', value: exec.inventory.totalValue, unit: '$', sub: `${exec.inventory.outOfStock} out of stock` } : { kind: 'empty' }
    case 'kpi_active_assets': return exec?.assets ? { kind: 'kpi', value: exec.assets.active, sub: `${exec.assets.total} total` } : { kind: 'empty' }
    case 'kpi_crm_pipeline': return exec?.crm ? { kind: 'kpi', value: exec.crm.openValue, unit: '$', sub: `${exec.crm.winRate}% win rate` } : { kind: 'empty' }
    case 'kpi_crm_leads': return exec?.crm ? { kind: 'kpi', value: exec.crm.count } : { kind: 'empty' }
    case 'kpi_ai_calls': return exec?.ai ? { kind: 'kpi', value: exec.ai.totalCalls, sub: `${exec.ai.successRate}% success` } : { kind: 'empty' }
    case 'chart_ai_daily': {
      const daily = exec?.ai?.daily ?? []
      if (daily.length === 0) return { kind: 'empty' }
      return { kind: 'chart', points: daily.map(d => ({ x: d.date, y: d.calls })) }
    }
    case 'table_activity': {
      const rows = (exec?.activity ?? []) as Record<string, unknown>[]
      if (rows.length === 0) return { kind: 'empty' }
      return {
        kind: 'table', columns: ['When', 'User', 'Action', 'Resource'],
        rows: rows.slice(0, 8).map(r => [String(r.createdAt ?? ''), String(r.userEmail ?? '—'), String(r.action ?? ''), `${r.resource ?? ''}${r.resourceId ? `:${r.resourceId}` : ''}`]),
      }
    }
    case 'list_alerts': {
      const alerts = exec?.alerts ?? []
      if (alerts.length === 0) return { kind: 'empty' }
      return { kind: 'list', items: alerts.map(a => ({ level: a.level, text: a.message })) }
    }
    case 'ops_system_health': {
      if (!ops) return { kind: 'empty' }
      const m = ops.metrics
      return {
        kind: 'ops', metrics: [
          { label: 'CPU', value: `${m.cpuLoadPct}%`, pct: m.cpuLoadPct },
          { label: 'Memory', value: `${m.memPct}%`, pct: m.memPct },
          { label: 'Availability', value: `${ops.sre.availabilityPct}%`, pct: ops.sre.availabilityPct },
          { label: 'Error rate', value: `${m.errorRatePct}%`, pct: m.errorRatePct },
        ],
      }
    }
    case 'ops_subsystems': {
      if (!ops) return { kind: 'empty' }
      return { kind: 'list', items: ops.subsystems.map(s => ({ level: s.status === 'healthy' ? 'ok' : s.status === 'warning' ? 'warning' : 'critical', text: `${s.name}` })) }
    }
    case 'ops_backup': {
      const rows = (await pgQuery(
        `SELECT status, COUNT(*)::int n FROM backups GROUP BY status`)) as { status: string; n: number }[]
      if (rows.length === 0) return { kind: 'empty' }
      const by = Object.fromEntries(rows.map(r => [r.status, r.n]))
      const total = rows.reduce((s, r) => s + r.n, 0)
      return { kind: 'ops', metrics: [
        { label: 'Total backups', value: String(total) },
        { label: 'Success', value: String(by.success ?? 0) },
        { label: 'Failed', value: String(by.failed ?? 0) },
      ] }
    }
    default: return { kind: 'error', message: 'unknown widget' }
  }
}
