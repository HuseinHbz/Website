/**
 * Financial Alerts data layer (Phase 26.11, M9). Gathers live inputs (budget
 * consumption, cash runway, overdue AR, FX exposure, tax liability), runs the
 * pure `deriveAlerts` engine, and upserts by fingerprint (idempotent — re-scans
 * update existing open alerts instead of duplicating). Resolved alerts that no
 * longer fire are auto-closed.
 */
import { pgQuery } from '@/lib/db'
import { deriveAlerts, type AlertInputs } from './financialAlerts'
import { budgetPortfolio } from './budgetData'
import { assembleKpis, currencyExposure, taxLiability } from './financialIntelligenceData'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

/** Open receivables overdue (days since invoice date > 0), per customer. */
async function overdueAR(): Promise<AlertInputs['overdueAR']> {
  try {
    const rows = await pgQuery<{ customerId: number; customer: string; amount: number; days: number }>(
      `SELECT d.customer_id AS "customerId", COALESCE(c.name,'?') AS customer,
              SUM(d.total-d.paid_total)::float AS amount,
              MAX((substr(${NOW},1,10)::date - d.date::date))::int AS days
       FROM sales_documents d LEFT JOIN sales_customers c ON c.id=d.customer_id
       WHERE d.doc_type='invoice' AND d.status IN ('sent','confirmed','partial')
         AND (substr(${NOW},1,10)::date - d.date::date) > 30
       GROUP BY d.customer_id, c.name`)
    return rows.map(r => ({ customerId: r.customerId, customer: r.customer, amount: Number(r.amount), daysOverdue: Number(r.days) }))
  } catch { return [] }
}

export async function gatherAlertInputs(): Promise<AlertInputs> {
  const { kpis } = await assembleKpis()
  const portfolio = await budgetPortfolio().catch(() => [])
  const exposure = await currencyExposure()
  return {
    budgets: portfolio.map(p => ({ id: p.id, name: p.name, consumptionPct: p.consumptionPct })),
    cash: { balance: kpis.cash.position, monthlyBurn: kpis.cash.burnRate },
    overdueAR: await overdueAR(),
    // Treat an exposure share >20% of the FX book as an increase signal.
    fx: exposure.map(e => ({ code: e.code, exposurePct: e.sharePct, changePct: e.sharePct })),
    taxLiability: await taxLiability(),
  }
}

/** Scan + upsert alerts by fingerprint; auto-resolve stale open alerts. */
export async function scanAndUpsertAlerts(): Promise<{ upserted: number; resolved: number }> {
  const alerts = deriveAlerts(await gatherAlertInputs())
  const seen = new Set(alerts.map(a => a.fingerprint))
  for (const a of alerts) {
    await pgQuery(
      `INSERT INTO erp_financial_alerts (kind, severity, title_en, title_fa, detail, metric_value, ref_type, ref_id, fingerprint, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${NOW})
       ON CONFLICT (fingerprint) DO UPDATE SET
         severity=EXCLUDED.severity, title_en=EXCLUDED.title_en, title_fa=EXCLUDED.title_fa,
         detail=EXCLUDED.detail, metric_value=EXCLUDED.metric_value, updated_at=${NOW},
         status=CASE WHEN erp_financial_alerts.status='resolved' THEN 'open' ELSE erp_financial_alerts.status END`,
      [a.kind, a.severity, a.titleEn, a.titleFa, a.detail, a.metricValue ?? null, a.refType ?? null, a.refId ?? null, a.fingerprint])
  }
  // Auto-resolve open alerts that no longer fire.
  const open = await pgQuery<{ id: number; fingerprint: string }>(`SELECT id, fingerprint FROM erp_financial_alerts WHERE status<>'resolved'`)
  let resolved = 0
  for (const o of open) if (!seen.has(o.fingerprint)) { await pgQuery(`UPDATE erp_financial_alerts SET status='resolved', updated_at=${NOW} WHERE id=$1`, [o.id]); resolved++ }
  return { upserted: alerts.length, resolved }
}

export async function listAlerts(status?: string) {
  const gate = status ? `WHERE status=$1` : ''
  return pgQuery(
    `SELECT id, kind, severity, title_en AS "titleEn", title_fa AS "titleFa", detail, metric_value AS "metricValue",
            ref_type AS "refType", ref_id AS "refId", status, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM erp_financial_alerts ${gate} ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, updated_at DESC`,
    status ? [status] : [])
}

export async function setAlertStatus(id: number, status: 'open' | 'acknowledged' | 'resolved'): Promise<void> {
  await pgQuery(`UPDATE erp_financial_alerts SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
}
