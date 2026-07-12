/**
 * Executive Cockpit data layer (Phase 26.13, M1). Assembles the CEO cockpit from
 * ALREADY-verified module data — no new aggregation: financial from
 * `cfoDashboard` (26.11), operational from sales/purchase/inventory/project
 * overviews, risk from approval analytics + business alerts + inventory. Every
 * section guarded so one failure never blanks the cockpit.
 */
import { pgQuery } from '@/lib/db'
import { cfoDashboard } from '@/lib/erp/financialIntelligenceData'
import { approvalAnalytics } from '@/lib/erp/approvalData'
import { computeKpis } from './kpiData'

async function guard<T>(fn: () => Promise<T>, fallback: T): Promise<T> { try { return await fn() } catch { return fallback } }
async function num(sql: string): Promise<number> { try { return Number((await pgQuery<{ v: number }>(sql))[0]?.v ?? 0) } catch { return 0 } }

export async function executiveCockpit() {
  const [cfo, approvals, kpis] = await Promise.all([
    guard(() => cfoDashboard(), null),
    guard(() => approvalAnalytics(), null),
    guard(() => computeKpis(), { kpis: [], scorecard: { score: 0, totalWeight: 0 } }),
  ])

  // Operational overview.
  const operational = {
    salesInvoiced: await num(`SELECT COALESCE(SUM(total),0)::float AS v FROM sales_documents WHERE doc_type='invoice' AND status<>'void'`),
    purchaseSpend: await num(`SELECT COALESCE(SUM(total),0)::float AS v FROM purchase_documents WHERE doc_type='invoice' AND status NOT IN ('draft','void','rejected')`),
    inventoryValue: cfo?.workingCapital.inventory ?? 0,
    openProjects: await num(`SELECT COUNT(*)::int AS v FROM pm_projects WHERE status IN ('active','on_hold')`),
    activeTasks: await num(`SELECT COUNT(*)::int AS v FROM pm_tasks WHERE status<>'done'`),
  }

  // Risk overview (drill-through counts).
  const risk = {
    approvalDelays: await num(`SELECT COUNT(*)::int AS v FROM approval_requests WHERE status IN ('pending','changes_requested') AND sla_breached=1`),
    budgetOverruns: (cfo?.risk.overBudget.length ?? 0),
    lowStock: await num(`SELECT COUNT(*)::int AS v FROM inv_products WHERE reorder_point > 0 AND (SELECT COALESCE(SUM(qty),0) FROM inv_moves WHERE product_id=inv_products.id) <= reorder_point`),
    openAlerts: await num(`SELECT COUNT(*)::int AS v FROM business_alerts WHERE status<>'resolved'`),
    criticalAlerts: await num(`SELECT COUNT(*)::int AS v FROM business_alerts WHERE status<>'resolved' AND severity='critical'`),
    paymentAnomalies: 0,   // surfaced via the finance AI anomaly scan (26.6) on demand
  }

  return {
    financial: cfo ? { overview: cfo.overview, kpis: cfo.kpis, workingCapital: cfo.workingCapital, budgetRisk: cfo.risk.overBudget } : null,
    operational,
    risk,
    scorecard: kpis.scorecard,
    topKpis: kpis.kpis.slice(0, 8),
    approvals: approvals ? { total: approvals.total, pending: approvals.pending, avgHours: approvals.avgApprovalHours, slaViolations: approvals.slaViolations } : null,
    charts: cfo?.charts ?? null,
    generatedAt: new Date().toISOString(),
  }
}
