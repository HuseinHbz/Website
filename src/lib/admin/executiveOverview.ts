/**
 * Executive overview — aggregates KPIs from every enterprise module into one
 * payload for the admin dashboard. Each module is gathered independently and
 * guarded (a failing/empty module returns nulls, never breaks the dashboard).
 * Reuses the existing per-module data layers so there is no duplicated logic.
 */
import { pgQuery } from '@/lib/db'
import { financeOverview } from '@/lib/erp/ledgerData'
import { inventoryOverview } from '@/lib/erp/inventoryData'
import { assetOverview } from '@/lib/erp/assetData'
import { pipelineStats, type LeadStatus } from '@/lib/crm/leads'
import { summarize, type UsageRow } from '@/lib/ai/analytics'

async function guard<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

// Bilingual pair (message/messageFa) — the same en/fa-column convention the
// CMS content tables already use — so every consumer (ExecutiveDashboard,
// the Dashboard Engine's `list_alerts` widget) can pick the right language
// client-side instead of rendering a hardcoded English string inside a
// Persian UI.
export interface Alert { level: 'critical' | 'warning'; module: string; message: string; messageFa: string }

export async function executiveOverview() {
  const [finance, inventory, assets, crm, ai, activity] = await Promise.all([
    guard(async () => (await financeOverview()).kpis, null),
    guard(async () => (await inventoryOverview()).kpis, null),
    guard(async () => (await assetOverview()).kpis, null),
    guard(async () => {
      const leads = (await pgQuery(`SELECT status, value::float AS value, score FROM crm_leads`, [])) as { status: LeadStatus; value: number; score: number }[]
      return { ...pipelineStats(leads), count: leads.length }
    }, null),
    guard(async () => {
      const rows = (await pgQuery(
        `SELECT id, ts, provider, model, source, latency_ms AS "latencyMs", success, error,
                input_tokens AS "inputTokens", output_tokens AS "outputTokens", rag_sources AS "ragSources", feedback
         FROM ai_usage WHERE ts >= to_char(now() - interval '30 days','YYYY-MM-DD HH24:MI:SS') ORDER BY ts DESC LIMIT 5000`, [],
      )) as unknown as UsageRow[]
      return summarize(rows, { days: 30 })
    }, null),
    guard(async () => (await pgQuery(
      `SELECT id, user_email AS "userEmail", action, resource, resource_id AS "resourceId", created_at AS "createdAt"
       FROM audit_logs ORDER BY created_at DESC LIMIT 15`, [],
    )), [] as Record<string, unknown>[]),
  ])

  // Derive cross-module alerts.
  const alerts: Alert[] = []
  if (inventory) {
    if (inventory.outOfStock > 0) alerts.push({ level: 'critical', module: 'inventory', message: `${inventory.outOfStock} product(s) out of stock`, messageFa: `${inventory.outOfStock} کالا ناموجود است` })
    if (inventory.needReorder > 0) alerts.push({ level: 'warning', module: 'inventory', message: `${inventory.needReorder} product(s) below reorder point`, messageFa: `${inventory.needReorder} کالا زیر نقطهٔ سفارش مجدد است` })
  }
  if (assets) {
    if (assets.warrantyExpired > 0) alerts.push({ level: 'critical', module: 'assets', message: `${assets.warrantyExpired} asset warranty(ies) expired`, messageFa: `گارانتی ${assets.warrantyExpired} دارایی منقضی شده است` })
    if (assets.warrantyExpiring > 0) alerts.push({ level: 'warning', module: 'assets', message: `${assets.warrantyExpiring} asset warranty(ies) expiring soon`, messageFa: `گارانتی ${assets.warrantyExpiring} دارایی به‌زودی منقضی می‌شود` })
    if (assets.openMaintenance > 0) alerts.push({ level: 'warning', module: 'assets', message: `${assets.openMaintenance} open maintenance task(s)`, messageFa: `${assets.openMaintenance} کار نگهداری باز وجود دارد` })
  }
  if (ai && ai.failedCalls > 0) alerts.push({ level: 'warning', module: 'ai', message: `${ai.failedCalls} AI call(s) failed in 30 days`, messageFa: `${ai.failedCalls} فراخوان هوش مصنوعی در ۳۰ روز اخیر ناموفق بوده است` })

  return { finance, inventory, assets, crm, ai, activity, alerts, generatedAt: new Date().toISOString() }
}
