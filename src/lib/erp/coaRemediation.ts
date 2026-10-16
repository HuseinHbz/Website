/**
 * ERPFIX-1 (BUG-ERP-10) — survey + remediation for salaries that were posted
 * to 6100 «Rent Expense» before the fix. Shared by the two operational
 * scripts in deploy/ (erp-coa-audit.ts, erp-remediate-salary-account.ts) and
 * the regression suite, so what is proven is what operators run.
 *
 * Rules (CLAUDE.md 11 / BUG-020): a posted entry is NEVER edited or voided.
 * The remediation books a NEW corrective entry (Dr payroll expense / Cr 6100)
 * through the single GL entry point, one per OPEN fiscal period. Entries in a
 * closed/locked period are only reported — reopening a period is an
 * accountant's decision. Each corrected source entry is linked in
 * gl_remediation_links, so a re-run never corrects the same entry twice.
 */
import { pgQuery, withTransaction } from '@/lib/db'
import { insertPostedEntry, loadPayrollExpenseCode, accountIdByCode } from './glPosting'
import { listPeriods } from './accountingData'
import { periodForDate } from './accountingCore'

export const RENT_CODE = '6100'
export const REMEDIATION_KIND = 'salary-on-rent'

export type SalarySource = 'payroll' | 'settlement' | 'treasury_salary'
export interface SalaryOnRentRow {
  entryId: number; entryNo: string; date: string; reference: string | null
  source: SalarySource; amount: number; periodId: number | null; periodName: string | null; periodStatus: string | null
  companyId: number | null
}

/**
 * Posted, un-reversed entries whose 6100 leg is a SALARY (payroll run, final
 * settlement leave-encashment, treasury salary payment) and not yet remediated.
 * `amount` is the signed debit-minus-credit on 6100 for that entry.
 */
export async function salaryOnRentEntries(): Promise<SalaryOnRentRow[]> {
  // The audit may run on a copy of production that has not booted the ERPFIX-1
  // migration yet: no links table means nothing has been remediated.
  const hasLinks = !!(await pgQuery<{ t: string | null }>(`SELECT to_regclass('public.gl_remediation_links')::text AS t`))[0]?.t
  const notRemediated = hasLinks
    ? `AND NOT EXISTS (SELECT 1 FROM gl_remediation_links r WHERE r.source_entry_id = e.id AND r.kind = $2)`
    : `AND $2::text IS NOT NULL`
  const rows = await pgQuery<{ id: number; entry_no: string; date: string; reference: string | null; amount: number; company_id: number | null; payment_type: string | null }>(
    `SELECT e.id, e.entry_no, e.date, e.reference, e.company_id,
            SUM(l.debit - l.credit)::float AS amount,
            MAX(po.payment_type) AS payment_type
     FROM gl_journal_entries e
     JOIN gl_journal_lines l ON l.entry_id = e.id
     JOIN gl_accounts a ON a.id = l.account_id AND a.code = $1
     LEFT JOIN payment_orders po ON po.gl_entry_id = e.id
     WHERE e.status = 'posted' AND e.reversed_by IS NULL AND e.reversal_of IS NULL
       AND (e.reference LIKE 'payroll:%' OR e.reference LIKE 'settlement:%'
            OR (e.reference LIKE 'TRZPAY-%' AND po.payment_type = 'salary_payment'))
       ${notRemediated}
     GROUP BY e.id, e.entry_no, e.date, e.reference, e.company_id
     HAVING ABS(SUM(l.debit - l.credit)) > 0.005
     ORDER BY e.date, e.id`, [RENT_CODE, REMEDIATION_KIND])
  const periods = await listPeriods()
  return rows.map(r => {
    const p = periodForDate(r.date, periods)
    const source: SalarySource = r.reference?.startsWith('payroll:') ? 'payroll' : r.reference?.startsWith('settlement:') ? 'settlement' : 'treasury_salary'
    return {
      entryId: r.id, entryNo: r.entry_no, date: r.date, reference: r.reference, source,
      amount: Math.round(Number(r.amount) * 100) / 100, periodId: p?.id ?? null, periodName: p?.name ?? null,
      periodStatus: p?.status ?? null, companyId: r.company_id,
    }
  })
}

/** Read-only census of everything posted on 6100, by origin. */
export async function rentAccountSurvey(): Promise<{ account: { code: string; nameEn: string; type: string } | null; byOrigin: { origin: string; entries: number; net: number }[] }> {
  const account = (await pgQuery<{ code: string; nameEn: string; type: string }>(
    `SELECT code, name_en AS "nameEn", type FROM gl_accounts WHERE code=$1`, [RENT_CODE]))[0] ?? null
  const byOrigin = await pgQuery<{ origin: string; entries: number; net: number }>(
    `SELECT CASE
              WHEN e.reference LIKE 'payroll:%' THEN 'payroll'
              WHEN e.reference LIKE 'settlement:%' THEN 'settlement (leave encashment)'
              WHEN e.reference LIKE 'TRZPAY-%' AND po.payment_type = 'salary_payment' THEN 'treasury salary payment'
              WHEN e.reference LIKE 'coa-remediate%' THEN 'ERPFIX-1 remediation'
              WHEN e.reference LIKE 'REV-%' THEN 'reversal'
              WHEN e.reference LIKE 'year-end-close%' THEN 'year-end closing'
              ELSE 'other (rent / manual)'
            END AS origin,
            COUNT(DISTINCT e.id)::int AS entries,
            COALESCE(SUM(l.debit - l.credit), 0)::float AS net
     FROM gl_journal_lines l
     JOIN gl_accounts a ON a.id = l.account_id AND a.code = $1
     JOIN gl_journal_entries e ON e.id = l.entry_id AND e.status = 'posted'
     LEFT JOIN payment_orders po ON po.gl_entry_id = e.id
     GROUP BY 1 ORDER BY 1`, [RENT_CODE])
  return { account, byOrigin }
}

export interface RemediationPlanGroup {
  periodId: number | null; periodName: string | null; periodStatus: string | null
  companyId: number | null; entries: SalaryOnRentRow[]; amount: number; action: 'correct' | 'report_only'
}

/** Group the candidates by fiscal period + company; closed/locked → report only. */
export function planRemediation(rows: SalaryOnRentRow[]): RemediationPlanGroup[] {
  const groups = new Map<string, RemediationPlanGroup>()
  for (const r of rows) {
    const key = `${r.periodId ?? 'none'}|${r.companyId ?? 'default'}`
    const g = groups.get(key) ?? { periodId: r.periodId, periodName: r.periodName, periodStatus: r.periodStatus, companyId: r.companyId, entries: [], amount: 0, action: (r.periodStatus == null || r.periodStatus === 'open') ? 'correct' as const : 'report_only' as const }
    g.entries.push(r)
    g.amount = Math.round((g.amount + r.amount) * 100) / 100
    groups.set(key, g)
  }
  return [...groups.values()]
}

/**
 * Apply the plan: one corrective entry per open period group, dated the last
 * source date in the group. Dry run unless `apply` is true.
 */
export async function remediateSalaryOnRent(opts: { apply: boolean; userId?: string | null }): Promise<{ payrollCode: string; groups: RemediationPlanGroup[]; posted: { entryId: number; entryNo: string; amount: number; sources: number[] }[] }> {
  const payrollCode = await loadPayrollExpenseCode()
  if (payrollCode === RENT_CODE) throw new Error('gl_map_payroll_expense still points at 6100 — set it to the salaries account first (ERPFIX-1 migration does this automatically while 6100 is «Rent Expense»)')
  const groups = planRemediation(await salaryOnRentEntries())
  const posted: { entryId: number; entryNo: string; amount: number; sources: number[] }[] = []
  if (!opts.apply) return { payrollCode, groups, posted }
  const [payrollId, rentId] = await Promise.all([accountIdByCode(payrollCode), accountIdByCode(RENT_CODE)])
  for (const g of groups) {
    if (g.action !== 'correct' || Math.abs(g.amount) < 0.005) continue
    const date = g.entries.map(e => e.date).sort().at(-1)!
    const amt = Math.abs(g.amount)
    // Positive net on 6100 = salary expense parked on rent → move it Dr payroll / Cr 6100.
    const lines = g.amount > 0
      ? [{ accountId: payrollId, debit: amt, credit: 0, memo: 'Salaries reclassified from 6100 (ERPFIX-1)' }, { accountId: rentId, debit: 0, credit: amt, memo: 'Salaries were posted to Rent Expense' }]
      : [{ accountId: rentId, debit: amt, credit: 0, memo: 'Salaries were posted to Rent Expense' }, { accountId: payrollId, debit: 0, credit: amt, memo: 'Salaries reclassified from 6100 (ERPFIX-1)' }]
    const sources = g.entries.map(e => e.entryId)
    const r = await withTransaction(async query => {
      await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`coa-remediate-salary:${g.periodId ?? 0}:${g.companyId ?? 0}`])
      const done = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM gl_remediation_links WHERE kind=$1 AND source_entry_id = ANY($2)`, [REMEDIATION_KIND, sources])
      if (done[0]?.n) return null
      const e = await insertPostedEntry(query, date,
        `Reclassify salaries posted to 6100 «Rent Expense» (${g.entries.map(x => x.entryNo).join(', ')})`.slice(0, 480),
        `coa-remediate-salary:${g.periodId ?? 'none'}`, opts.userId ?? null, lines, { companyId: g.companyId })
      for (const s of sources) {
        await query(`INSERT INTO gl_remediation_links (source_entry_id, remediation_entry_id, kind, company_id) VALUES ($1,$2,$3,$4)`, [s, e.id, REMEDIATION_KIND, g.companyId])
      }
      return e
    })
    if (r) posted.push({ entryId: r.id, entryNo: r.entryNo, amount: g.amount, sources })
  }
  return { payrollCode, groups, posted }
}
