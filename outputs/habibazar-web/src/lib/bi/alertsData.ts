/**
 * Centralized Alert Center data layer (Phase 26.13, M6). Gathers live signals
 * across financial (reuses 26.11 `gatherAlertInputs`/`deriveAlerts`), operational
 * (low stock, approval delays, project delays) and security (failed logins from
 * system_logs) domains, runs the pure `businessAlerts` engine, and upserts into
 * business_alerts by fingerprint (idempotent + auto-resolve).
 */
import { pgQuery } from '@/lib/db'
import { buildAlerts, alertSummary, type AlertSignal, type BusinessAlert } from './businessAlerts'
import { gatherAlertInputs } from '@/lib/erp/financialAlertsData'
import { deriveAlerts } from '@/lib/erp/financialAlerts'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function num(sql: string): Promise<number> { try { return Number((await pgQuery<{ v: number }>(sql))[0]?.v ?? 0) } catch { return 0 } }

/** Collect signals from all three domains. */
export async function collectSignals(): Promise<AlertSignal[]> {
  const signals: AlertSignal[] = []
  // Financial (reuse the verified 26.11 derivation).
  try {
    for (const a of deriveAlerts(await gatherAlertInputs()))
      signals.push({ kind: a.kind, domain: 'financial', severity: a.severity, titleEn: a.titleEn, titleFa: a.titleFa, detail: a.detail, metricValue: a.metricValue, refType: a.refType, refId: a.refId })
  } catch { /* financial optional */ }
  // Operational.
  const lowStock = await num(`SELECT COUNT(*)::int AS v FROM inv_products WHERE reorder_point > 0 AND (SELECT COALESCE(SUM(qty),0) FROM inv_moves WHERE product_id=inv_products.id) <= reorder_point`)
  if (lowStock > 0) signals.push({ kind: 'low_stock', domain: 'operational', severity: lowStock >= 5 ? 'critical' : 'warning', titleEn: `${lowStock} products at/below reorder point`, titleFa: `${lowStock} کالا در/زیر نقطه سفارش`, metricValue: lowStock })
  const staleApprovals = await num(`SELECT COUNT(*)::int AS v FROM approval_requests WHERE status IN ('pending','changes_requested') AND sla_breached=1`)
  if (staleApprovals > 0) signals.push({ kind: 'approval_delayed', domain: 'operational', severity: 'warning', titleEn: `${staleApprovals} approvals past SLA`, titleFa: `${staleApprovals} تأیید فراتر از SLA`, metricValue: staleApprovals })
  const lateProjects = await num(`SELECT COUNT(*)::int AS v FROM pm_projects WHERE status IN ('active','on_hold') AND end_date IS NOT NULL AND end_date < substr(${NOW},1,10)`)
  if (lateProjects > 0) signals.push({ kind: 'project_delay', domain: 'operational', severity: 'warning', titleEn: `${lateProjects} projects past due date`, titleFa: `${lateProjects} پروژه از موعد گذشته`, metricValue: lateProjects })
  // Security (failed logins in last 24h from the log bus).
  const failedLogins = await num(`SELECT COUNT(*)::int AS v FROM system_logs WHERE source='security' AND message ILIKE '%login%fail%' AND ts > (now() - interval '24 hours')`)
  if (failedLogins >= 5) signals.push({ kind: 'failed_login', domain: 'security', severity: failedLogins >= 20 ? 'critical' : 'warning', titleEn: `${failedLogins} failed logins in 24h`, titleFa: `${failedLogins} ورود ناموفق در ۲۴ ساعت`, metricValue: failedLogins })
  return signals
}

/** Scan + upsert business alerts by fingerprint; auto-resolve stale ones. */
export async function scanBusinessAlerts(): Promise<{ upserted: number; resolved: number; summary: ReturnType<typeof alertSummary> }> {
  const alerts = buildAlerts(await collectSignals())
  const seen = new Set(alerts.map(a => a.fingerprint))
  for (const a of alerts) {
    await pgQuery(
      `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, metric_value, ref_type, ref_id, channels, fingerprint, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,${NOW})
       ON CONFLICT (fingerprint) DO UPDATE SET severity=EXCLUDED.severity, title_en=EXCLUDED.title_en, title_fa=EXCLUDED.title_fa,
         detail=EXCLUDED.detail, metric_value=EXCLUDED.metric_value, channels=EXCLUDED.channels, updated_at=${NOW},
         status=CASE WHEN business_alerts.status='resolved' THEN 'open' ELSE business_alerts.status END`,
      [a.kind, a.domain, a.severity, a.titleEn, a.titleFa, a.detail ?? null, a.metricValue ?? null, a.refType ?? null, a.refId ?? null, JSON.stringify(a.channels), a.fingerprint])
  }
  const open = await pgQuery<{ id: number; fingerprint: string }>(`SELECT id, fingerprint FROM business_alerts WHERE status<>'resolved'`)
  let resolved = 0
  for (const o of open) if (!seen.has(o.fingerprint)) { await pgQuery(`UPDATE business_alerts SET status='resolved', updated_at=${NOW} WHERE id=$1`, [o.id]); resolved++ }
  return { upserted: alerts.length, resolved, summary: alertSummary(alerts) }
}

export async function listBusinessAlerts(domain?: string, status = 'open') {
  const parts = ['status=$1']; const params: unknown[] = [status]
  if (domain) { parts.push(`domain=$2`); params.push(domain) }
  return pgQuery(`SELECT id, kind, domain, severity, title_en AS "titleEn", title_fa AS "titleFa", detail, channels, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM business_alerts WHERE ${parts.join(' AND ')} ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, updated_at DESC`, params)
}
export async function setBusinessAlertStatus(id: number, status: 'open' | 'acknowledged' | 'resolved'): Promise<void> {
  await pgQuery(`UPDATE business_alerts SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
}
export type { BusinessAlert }
