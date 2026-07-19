/**
 * Project Costing server data layer — assembles each project's cost/revenue
 * picture from PostgreSQL (manual cost & revenue entries + labor derived from
 * timesheet hours × the project rate + % progress from tasks) and computes the
 * summary via the pure engine (lib/erp/costing.ts). Also a portfolio rollup.
 */
import { pgQuery } from '@/lib/db'
import { costingSummary, costingKpis, type CostEntry, type CostCategory } from './costing'
import { projectProgress, type TaskStatus } from './projects'

interface EntryRow { kind: 'cost' | 'revenue'; category: string; amount: number }

async function projectContext(id: number) {
  const project = (await pgQuery(`SELECT budget::float AS budget, hourly_rate::float AS "hourlyRate" FROM pm_projects WHERE id=$1`, [id]))[0] as { budget: number; hourlyRate: number } | undefined
  if (!project) return null
  const tasks = (await pgQuery(`SELECT status, estimate_hours::float AS "estimateHours" FROM pm_tasks WHERE project_id=$1`, [id])) as { status: TaskStatus; estimateHours: number }[]
  const hours = (await pgQuery(`SELECT COALESCE(SUM(hours),0)::float AS h FROM pm_timesheets WHERE project_id=$1`, [id]))[0] as { h: number }
  return { budget: project.budget, laborFromTimesheets: Math.round(hours.h * project.hourlyRate * 100) / 100, progressPct: projectProgress(tasks) }
}

/** Full costing detail for one project (summary + entries). */
export async function loadProjectCosting(id: number) {
  const ctx = await projectContext(id)
  if (!ctx) return null
  const entries = (await pgQuery(
    `SELECT id, kind, category, description, amount::float AS amount, date
     FROM pm_cost_entries WHERE project_id=$1 ORDER BY date DESC, id DESC`, [id])) as (EntryRow & { id: number; description: string | null; date: string })[]
  const costEntries: CostEntry[] = entries.filter(e => e.kind === 'cost').map(e => ({ category: (e.category as CostCategory), amount: e.amount }))
  const revenueEntries = entries.filter(e => e.kind === 'revenue').map(e => ({ amount: e.amount }))
  const summary = costingSummary({ budget: ctx.budget, costEntries, revenueEntries, laborFromTimesheets: ctx.laborFromTimesheets, progressPct: ctx.progressPct })
  return { summary, entries, laborFromTimesheets: ctx.laborFromTimesheets, progressPct: ctx.progressPct }
}

/** Portfolio costing rollup across all projects. */
export async function costingPortfolio() {
  const projects = (await pgQuery(`SELECT id, code, name, budget::float AS budget, hourly_rate::float AS "hourlyRate" FROM pm_projects ORDER BY updated_at DESC`, [])) as { id: number; code: string; name: string; budget: number; hourlyRate: number }[]
  const costs = (await pgQuery(
    `SELECT project_id AS "pid",
            COALESCE(SUM(CASE WHEN kind='cost' THEN amount ELSE 0 END),0)::float AS cost,
            COALESCE(SUM(CASE WHEN kind='revenue' THEN amount ELSE 0 END),0)::float AS revenue
     FROM pm_cost_entries GROUP BY project_id`, [])) as { pid: number; cost: number; revenue: number }[]
  const hours = (await pgQuery(`SELECT project_id AS "pid", COALESCE(SUM(hours),0)::float AS h FROM pm_timesheets GROUP BY project_id`, [])) as { pid: number; h: number }[]
  const cMap = new Map(costs.map(c => [c.pid, c]))
  const hMap = new Map(hours.map(h => [h.pid, h.h]))

  const rows = projects.map(p => {
    const c = cMap.get(p.id) ?? { cost: 0, revenue: 0 }
    const labor = (hMap.get(p.id) ?? 0) * p.hourlyRate
    const cost = Math.round((c.cost + labor) * 100) / 100
    return { id: p.id, code: p.code, name: p.name, budget: p.budget, cost, revenue: c.revenue, profit: Math.round((c.revenue - cost) * 100) / 100 }
  })
  return { kpis: costingKpis(rows), rows }
}
