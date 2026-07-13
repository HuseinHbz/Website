/**
 * Self-Healing data layer (Phase 26.20). Runs the fixed check registry against
 * live PostgreSQL, executes the provably-safe auto-fixes by REUSING each
 * module's own idempotent operations (never a second engine), and persists an
 * auditable trail into selfheal_runs / selfheal_findings.
 */
import { pgQuery } from '@/lib/db'
import { postSalesInvoiceToGl } from '@/lib/erp/salesData'
import { postPurchaseInvoiceToGl } from '@/lib/erp/purchasingData'
import { scanLedgerIntegrity } from '@/lib/erp/accountingValidationData'
import { detectDuplicates } from '@/lib/masterdata/masterDataData'
import {
  HEAL_CHECKS, checkDef, actionFor, riskScore, duplicatePaymentGroups,
  type HealFinding, type HealAction,
} from './selfheal'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const FIX_CAP = 50 // safety valve: max auto-fixes per check per run

export interface SelfHealResult {
  runId: number
  findings: (HealFinding & { detail: string })[]
  totalIssues: number
  totalFixed: number
  risk: number
}

async function record(runId: number, code: string, count: number, fixed: number, action: HealAction, detail: string) {
  await pgQuery(
    `INSERT INTO selfheal_findings (run_id, code, severity, action, count, fixed, detail, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,${NOW})`,
    [runId, code, checkDef(code)!.severity, action, count, fixed, detail])
}

/** Run every check; auto-fix what is safe; persist the trail; return the summary. */
export async function runSelfHeal(userId?: string): Promise<SelfHealResult> {
  const run = (await pgQuery<{ id: number }>(
    `INSERT INTO selfheal_runs (started_by, created_at) VALUES ($1,${NOW}) RETURNING id`, [userId ?? null]))[0]
  const findings: (HealFinding & { detail: string })[] = []
  const add = async (code: string, count: number, fixed: number, detail: string) => {
    const def = checkDef(code)!
    const action = actionFor(def, fixed > 0 && fixed >= count)
    findings.push({ code, count, fixed, action, severity: def.severity, detail })
    if (count > 0) await record(run.id, code, count, fixed, action, detail)
  }

  // 1) Confirmed sales invoices without a GL entry → post them (idempotent reuse).
  const salesUnposted = await pgQuery<{ id: number }>(
    `SELECT id FROM sales_documents WHERE doc_type='invoice' AND status IN ('confirmed','partial','paid')
       AND gl_entry_id IS NULL AND deleted_at IS NULL ORDER BY id LIMIT ${FIX_CAP + 1}`)
  let salesFixed = 0
  for (const d of salesUnposted.slice(0, FIX_CAP)) {
    try { await postSalesInvoiceToGl(d.id, userId); salesFixed++ } catch { /* stays an alert */ }
  }
  await add('sales_invoice_unposted', salesUnposted.length, salesFixed, `posted ${salesFixed}/${salesUnposted.length} to the GL`)

  // 2) Same on the purchase side.
  const purUnposted = await pgQuery<{ id: number }>(
    `SELECT id FROM purchase_documents WHERE doc_type='invoice' AND status NOT IN ('draft','void')
       AND gl_entry_id IS NULL ORDER BY id LIMIT ${FIX_CAP + 1}`)
  let purFixed = 0
  for (const d of purUnposted.slice(0, FIX_CAP)) {
    try { await postPurchaseInvoiceToGl(d.id, userId); purFixed++ } catch { /* stays an alert */ }
  }
  await add('purchase_invoice_unposted', purUnposted.length, purFixed, `posted ${purFixed}/${purUnposted.length} to the GL`)

  // 3) Unbalanced posted entries (read-only auditor — a human must resolve).
  const ledger = await scanLedgerIntegrity({ status: 'posted' })
  await add('gl_unbalanced', ledger.withIssues, 0, `integrity score ${ledger.score}`)

  // 4) Import jobs stuck in processing (>2h, e.g. process died mid-run) → fail them.
  const stuck = await pgQuery<{ id: number }>(
    `UPDATE import_jobs SET status='failed', error='Self-heal: stalled in processing', updated_at=${NOW}
     WHERE status='processing' AND updated_at::timestamp < now() - interval '2 hours' RETURNING id`)
  await add('import_job_stuck', stuck.length, stuck.length, stuck.length ? `failed jobs ${stuck.map(s => s.id).join(',')}` : 'none')

  // 5) Active shipment reservations whose shipment already terminated → release.
  const orphans = await pgQuery<{ id: number }>(
    `UPDATE inv_reservations r SET status='released', released_at=${NOW}
     WHERE r.status='active' AND r.ref LIKE 'SHP-%'
       AND EXISTS (SELECT 1 FROM inv_shipments s WHERE 'SHP-' || s.id = r.ref AND s.status IN ('delivered','returned','cancelled'))
     RETURNING id`)
  await add('orphan_holds', orphans.length, orphans.length, orphans.length ? `released ${orphans.length} hold(s)` : 'none')

  // 6) Negative on-hand (product × warehouse) — needs human stock correction.
  const neg = await pgQuery<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM (SELECT product_id, warehouse_id FROM inv_moves GROUP BY product_id, warehouse_id HAVING SUM(qty) < 0) x`)
  await add('negative_stock', neg[0].n, 0, neg[0].n ? `${neg[0].n} product×warehouse below zero` : 'none')

  // 7) Approved counts never posted (>48h).
  const stuckCounts = await pgQuery<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM inv_counts WHERE status='approved' AND updated_at::timestamp < now() - interval '48 hours'`)
  await add('count_stuck_approved', stuckCounts[0].n, 0, 'approve→post pending')

  // 8) Failed workflow runs in the last 24h.
  const wfFailed = await pgQuery<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM workflow_runs WHERE status='failed' AND started_at::timestamp > now() - interval '24 hours'`)
  await add('workflow_failed', wfFailed[0].n, 0, 'see Workflow Designer run history')

  // 9) Vendor contracts past their end date but still 'active' → expire them.
  const expired = await pgQuery<{ id: number }>(
    `UPDATE vendor_contracts SET status='expired' WHERE status='active' AND end_date IS NOT NULL AND end_date::date < now()::date RETURNING id`)
  await add('contract_expired_active', expired.length, expired.length, expired.length ? `expired ${expired.length} contract(s)` : 'none')

  // 10) Suspected duplicate payments across both ledgers (same target/amount/date).
  const sp = await pgQuery<{ id: number; refId: number; amount: number; date: string }>(
    `SELECT id, COALESCE(document_id, customer_id) AS "refId", amount::float AS amount, date FROM sales_payments`)
  const pp = await pgQuery<{ id: number; refId: number; amount: number; date: string }>(
    `SELECT id, COALESCE(document_id, vendor_id) AS "refId", amount::float AS amount, date FROM purchase_payments`)
  const dupPay = duplicatePaymentGroups(sp).length + duplicatePaymentGroups(pp).length
  await add('duplicate_payments', dupPay, 0, dupPay ? `${dupPay} suspicious group(s)` : 'none')

  // 11) Duplicate customer identities (26.16 engine) — steward decision, not auto-merge.
  const dupes = await detectDuplicates()
  const custDupes = dupes.groups.filter(g => g.keyType.startsWith('customer.')).length
  await add('duplicate_customers', custDupes, 0, custDupes ? 'resolve in Master Data → Duplicates' : 'none')

  // 12) Active products priced below cost.
  const negMargin = await pgQuery<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM inv_products WHERE active=1 AND cost > 0 AND price > 0 AND price < cost`)
  await add('negative_margin', negMargin[0].n, 0, 'review pricing / price lists')

  const totalIssues = findings.reduce((s, f) => s + f.count, 0)
  const totalFixed = findings.reduce((s, f) => s + f.fixed, 0)
  const risk = riskScore(findings)
  await pgQuery(`UPDATE selfheal_runs SET finished_at=${NOW}, issues=$2, fixed=$3, risk=$4 WHERE id=$1`, [run.id, totalIssues, totalFixed, risk])
  return { runId: run.id, findings, totalIssues, totalFixed, risk }
}

export async function lastRun(): Promise<{ run: { id: number; createdAt: string; issues: number; fixed: number; risk: number } | null; findings: { code: string; severity: string; action: string; count: number; fixed: number; detail: string }[] }> {
  const run = (await pgQuery<{ id: number; created_at: string; issues: number; fixed: number; risk: number }>(
    `SELECT id, created_at, issues, fixed, risk FROM selfheal_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1`))[0]
  if (!run) return { run: null, findings: [] }
  const findings = (await pgQuery(
    `SELECT code, severity, action, count, fixed, detail FROM selfheal_findings WHERE run_id=$1 ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, count DESC`, [run.id])) as { code: string; severity: string; action: string; count: number; fixed: number; detail: string }[]
  return { run: { id: run.id, createdAt: run.created_at, issues: Number(run.issues), fixed: Number(run.fixed), risk: Number(run.risk) }, findings }
}

export { HEAL_CHECKS }
