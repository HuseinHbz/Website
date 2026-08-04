/**
 * Phase 28.3-الف — payroll server layer.
 *
 * Reuses rather than rebuilds: worked time comes from the 28.2 attendance and
 * leave tables, the base salary comes from the 28.1 append-only employment
 * history (read AS OF the period, never "current"), and the journal entry goes
 * through the same 26.23 GL machinery every other module uses.
 *
 * The invariants defended here:
 *  · a slip records the ruleset VERSION it was computed with, so later rate
 *    changes cannot reach back and alter an issued slip
 *  · an approved period is never recalculated — a correction is a reversal plus
 *    a new slip, exactly like a reversing journal entry
 */
import { pgQuery } from '@/lib/db'
import { toGregorian } from '@/lib/erp/jalali'
import { employmentOn } from './employees'
import {
  calculateSlip, jalaliMonthLength, isRecalculable, payrollPostingLines, postingBalanced,
  type PayrollParameter, type TaxBracket, type EarningType, type WorkedTime,
  type SlipResult, type PeriodStatus,
} from './payroll'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// ── rulesets ────────────────────────────────────────────────────────────────

export interface Ruleset {
  id: number; year: number; version: number; title: string | null
  effectiveFrom: string; effectiveTo: string | null; source: string | null
  status: 'draft' | 'approved' | 'archived'
  slipCount: number
}

export async function listRulesets(): Promise<Ruleset[]> {
  return await pgQuery<Ruleset>(
    `SELECT r.id, r.year, r.version, r.title,
            r.effective_from AS "effectiveFrom", r.effective_to AS "effectiveTo",
            r.source, r.status,
            (SELECT count(*)::int FROM payroll_slips s WHERE s.ruleset_id = r.id) AS "slipCount"
     FROM payroll_rulesets r ORDER BY r.year DESC, r.version DESC`)
}

export async function rulesetById(id: number): Promise<Ruleset | null> {
  return (await listRulesets()).find(r => r.id === id) ?? null
}

/** The ruleset in force on a date — what a period must be calculated with. */
export async function rulesetFor(date: string): Promise<Ruleset | null> {
  const r = (await pgQuery<{ id: number }>(
    `SELECT id FROM payroll_rulesets
     WHERE status <> 'archived' AND effective_from <= $1
       AND (effective_to IS NULL OR effective_to >= $1)
     ORDER BY effective_from DESC, version DESC LIMIT 1`, [date]))[0]
  return r ? await rulesetById(r.id) : null
}

/**
 * Copy a ruleset into a new version.
 *
 * This is the feature the whole phase exists for: next year (or mid-year, when a
 * circular changes the minimum wage) the operator clones, edits the handful of
 * values that moved, and payroll is correct — with no developer involved.
 */
export async function copyRuleset(
  sourceId: number,
  d: { year: number; version: number; title?: string | null; effectiveFrom: string; effectiveTo?: string | null; source?: string | null },
  userId: string,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const src = await rulesetById(sourceId)
  if (!src) return { ok: false, error: 'Source ruleset not found' }

  const clash = (await pgQuery<{ id: number }>(
    `SELECT id FROM payroll_rulesets WHERE year=$1 AND version=$2`, [d.year, d.version]))[0]
  if (clash) return { ok: false, error: `نسخهٔ ${d.version} برای سال ${d.year} از قبل وجود دارد` }

  const created = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_rulesets (year, version, title, effective_from, effective_to, source, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'draft',$7) RETURNING id`,
    [d.year, d.version, d.title ?? `مجموعه‌قوانین ${d.year} نسخهٔ ${d.version}`,
      d.effectiveFrom, d.effectiveTo ?? null, d.source ?? null, userId]))[0]

  await pgQuery(
    `INSERT INTO payroll_parameters (ruleset_id, param_group, key, label_fa, label_en, value_type, value, unit, description, sort_order)
     SELECT $1, param_group, key, label_fa, label_en, value_type, value, unit, description, sort_order
     FROM payroll_parameters WHERE ruleset_id=$2`, [created.id, sourceId])
  await pgQuery(
    `INSERT INTO payroll_tax_brackets (ruleset_id, seq, from_amount, to_amount, rate_percent)
     SELECT $1, seq, from_amount, to_amount, rate_percent
     FROM payroll_tax_brackets WHERE ruleset_id=$2`, [created.id, sourceId])
  await pgQuery(
    `INSERT INTO payroll_earning_types
       (ruleset_id, key, label_fa, label_en, earning_group, recurring, insurable, insurable_cap,
        taxable, taxable_cap, in_eid_base, in_severance_base, in_overtime_base,
        calc_method, calc_value, param_key, active, sort_order)
     SELECT $1, key, label_fa, label_en, earning_group, recurring, insurable, insurable_cap,
            taxable, taxable_cap, in_eid_base, in_severance_base, in_overtime_base,
            calc_method, calc_value, param_key, active, sort_order
     FROM payroll_earning_types WHERE ruleset_id=$2`, [created.id, sourceId])

  return { ok: true, id: created.id }
}

/**
 * A ruleset that has already produced slips is FROZEN.
 *
 * Editing it would silently restate slips already reported to the tax authority
 * and posted to the ledger. The answer is a new version, not an edit.
 */
export async function rulesetEditable(id: number): Promise<{ ok: boolean; error?: string }> {
  const r = await rulesetById(id)
  if (!r) return { ok: false, error: 'Not found' }
  if (r.slipCount > 0) {
    return { ok: false, error: 'این مجموعه‌قوانین فیش صادرشده دارد — برای تغییر، نسخهٔ جدید بسازید' }
  }
  return { ok: true }
}

export async function approveRuleset(id: number, userId: string) {
  await pgQuery(
    `UPDATE payroll_rulesets SET status='approved', approved_by=$2, approved_at=${NOW} WHERE id=$1`,
    [id, userId])
}

// ── parameters, brackets, earning types ─────────────────────────────────────

export async function parametersOf(rulesetId: number): Promise<(PayrollParameter & { id: number; labelFa: string; labelEn: string; unit: string | null; description: string | null; sortOrder: number })[]> {
  return await pgQuery(
    `SELECT id, param_group AS "group", key, label_fa AS "labelFa", label_en AS "labelEn",
            value_type AS "valueType", value::float AS value, unit, description, sort_order AS "sortOrder"
     FROM payroll_parameters WHERE ruleset_id=$1 ORDER BY param_group, sort_order`, [rulesetId]) as never
}

export async function bracketsOf(rulesetId: number): Promise<(TaxBracket & { id: number })[]> {
  return await pgQuery(
    `SELECT id, seq, from_amount::float AS "fromAmount", to_amount::float AS "toAmount",
            rate_percent::float AS "ratePercent"
     FROM payroll_tax_brackets WHERE ruleset_id=$1 ORDER BY seq`, [rulesetId]) as never
}

export async function earningTypesOf(rulesetId: number): Promise<(EarningType & { id: number; active: boolean; earningGroup: string })[]> {
  return await pgQuery(
    `SELECT id, key, label_fa AS "labelFa", label_en AS "labelEn", earning_group AS "earningGroup",
            recurring::boolean AS recurring, insurable, insurable_cap::float AS "insurableCap",
            taxable, taxable_cap::float AS "taxableCap",
            in_eid_base::boolean AS "inEidBase", in_severance_base::boolean AS "inSeveranceBase",
            in_overtime_base::boolean AS "inOvertimeBase",
            calc_method AS "calcMethod", calc_value::float AS "calcValue",
            param_key AS "paramKey", active::boolean AS active, sort_order AS "sortOrder"
     FROM payroll_earning_types WHERE ruleset_id=$1 ORDER BY sort_order`, [rulesetId]) as never
}

/** Every parameter change is recorded — append-only, like the GL. */
async function recordPolicyChange(
  rulesetId: number, entity: string, key: string,
  oldValue: unknown, newValue: unknown, userId: string,
) {
  await pgQuery(
    `INSERT INTO payroll_policy_history (ruleset_id, entity, entity_key, old_value, new_value, changed_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [rulesetId, entity, key, String(oldValue ?? ''), String(newValue ?? ''), userId])
}

export async function setParameter(
  rulesetId: number, key: string, value: number, userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const editable = await rulesetEditable(rulesetId)
  if (!editable.ok) return editable
  const before = (await pgQuery<{ value: number }>(
    `SELECT value::float AS value FROM payroll_parameters WHERE ruleset_id=$1 AND key=$2`,
    [rulesetId, key]))[0]
  if (!before) return { ok: false, error: `پارامتر ${key} یافت نشد` }
  await pgQuery(`UPDATE payroll_parameters SET value=$3 WHERE ruleset_id=$1 AND key=$2`,
    [rulesetId, key, value])
  await recordPolicyChange(rulesetId, 'parameter', key, before.value, value, userId)
  return { ok: true }
}

/** Add a parameter that did not exist — no migration required, by design. */
export async function addParameter(
  rulesetId: number,
  d: { group: string; key: string; labelFa: string; labelEn: string; valueType: string; value: number; unit?: string | null; description?: string | null },
  userId: string,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const editable = await rulesetEditable(rulesetId)
  if (!editable.ok) return editable
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_parameters (ruleset_id, param_group, key, label_fa, label_en, value_type, value, unit, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (ruleset_id, key) DO NOTHING RETURNING id`,
    [rulesetId, d.group, d.key, d.labelFa, d.labelEn, d.valueType, d.value, d.unit ?? null, d.description ?? null]))[0]
  if (!row) return { ok: false, error: `پارامتر ${d.key} از قبل وجود دارد` }
  await recordPolicyChange(rulesetId, 'parameter', d.key, null, d.value, userId)
  return { ok: true, id: row.id }
}

/**
 * Replace the whole bracket table in one transaction.
 *
 * Whole-table replacement rather than per-row edits, because the invariants
 * (no gap, no overlap, last band open) are properties of the SET — validating
 * one row at a time cannot see them.
 */
export async function saveBrackets(
  rulesetId: number, rows: { seq: number; fromAmount: number; toAmount: number | null; ratePercent: number }[],
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const editable = await rulesetEditable(rulesetId)
  if (!editable.ok) return editable
  const { validateBrackets } = await import('./payroll')
  const issues = validateBrackets(rows)
  if (issues.length) return { ok: false, error: issues[0].fa }

  const before = await bracketsOf(rulesetId)
  await pgQuery('BEGIN')
  try {
    await pgQuery(`DELETE FROM payroll_tax_brackets WHERE ruleset_id=$1`, [rulesetId])
    for (const r of rows) {
      await pgQuery(
        `INSERT INTO payroll_tax_brackets (ruleset_id, seq, from_amount, to_amount, rate_percent)
         VALUES ($1,$2,$3,$4,$5)`, [rulesetId, r.seq, r.fromAmount, r.toAmount, r.ratePercent])
    }
    await pgQuery('COMMIT')
  } catch (e) {
    await pgQuery('ROLLBACK')
    throw e
  }
  await recordPolicyChange(rulesetId, 'brackets', 'table',
    `${before.length} rows`, `${rows.length} rows`, userId)
  return { ok: true }
}

export async function saveEarningType(
  rulesetId: number,
  d: Partial<EarningType> & { id?: number; key: string; labelFa: string; labelEn: string; earningGroup?: string; active?: boolean },
  userId: string,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const editable = await rulesetEditable(rulesetId)
  if (!editable.ok) return editable

  if (d.id) {
    const before = (await earningTypesOf(rulesetId)).find(e => e.id === d.id)
    await pgQuery(
      `UPDATE payroll_earning_types SET
         label_fa=$3, label_en=$4, earning_group=$5, recurring=$6, insurable=$7, insurable_cap=$8,
         taxable=$9, taxable_cap=$10, in_eid_base=$11, in_severance_base=$12, in_overtime_base=$13,
         calc_method=$14, calc_value=$15, param_key=$16, active=$17, sort_order=$18
       WHERE id=$1 AND ruleset_id=$2`,
      [d.id, rulesetId, d.labelFa, d.labelEn, d.earningGroup ?? 'allowance',
        d.recurring ? 1 : 0, d.insurable ?? 'yes', d.insurableCap ?? null,
        d.taxable ?? 'yes', d.taxableCap ?? null,
        d.inEidBase ? 1 : 0, d.inSeveranceBase ? 1 : 0, d.inOvertimeBase ? 1 : 0,
        d.calcMethod ?? 'manual', d.calcValue ?? 0, d.paramKey ?? null,
        d.active === false ? 0 : 1, d.sortOrder ?? 50])
    await recordPolicyChange(rulesetId, 'earning_type', d.key,
      `insurable=${before?.insurable} taxable=${before?.taxable}`,
      `insurable=${d.insurable} taxable=${d.taxable}`, userId)
    return { ok: true, id: d.id }
  }

  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_earning_types
       (ruleset_id, key, label_fa, label_en, earning_group, recurring, insurable, insurable_cap,
        taxable, taxable_cap, in_eid_base, in_severance_base, in_overtime_base,
        calc_method, calc_value, param_key, active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (ruleset_id, key) DO NOTHING RETURNING id`,
    [rulesetId, d.key, d.labelFa, d.labelEn, d.earningGroup ?? 'allowance',
      d.recurring ? 1 : 0, d.insurable ?? 'yes', d.insurableCap ?? null,
      d.taxable ?? 'yes', d.taxableCap ?? null,
      d.inEidBase ? 1 : 0, d.inSeveranceBase ? 1 : 0, d.inOvertimeBase ? 1 : 0,
      d.calcMethod ?? 'manual', d.calcValue ?? 0, d.paramKey ?? null,
      d.active === false ? 0 : 1, d.sortOrder ?? 50]))[0]
  if (!row) return { ok: false, error: `قلم ${d.key} از قبل وجود دارد` }
  await recordPolicyChange(rulesetId, 'earning_type', d.key, null, 'created', userId)
  return { ok: true, id: row.id }
}

export async function deleteEarningType(rulesetId: number, id: number): Promise<{ ok: boolean; error?: string }> {
  const editable = await rulesetEditable(rulesetId)
  if (!editable.ok) return editable
  await pgQuery(`DELETE FROM payroll_earning_types WHERE id=$1 AND ruleset_id=$2`, [id, rulesetId])
  return { ok: true }
}

export async function policyHistory(rulesetId: number) {
  return await pgQuery<{ id: number; entity: string; entityKey: string; oldValue: string | null; newValue: string | null; changedBy: string | null; createdAt: string }>(
    `SELECT id, entity, entity_key AS "entityKey", old_value AS "oldValue",
            new_value AS "newValue", changed_by AS "changedBy", created_at AS "createdAt"
     FROM payroll_policy_history WHERE ruleset_id=$1 ORDER BY id DESC LIMIT 200`, [rulesetId])
}

// ── periods ─────────────────────────────────────────────────────────────────

export interface PeriodRow {
  id: number; rulesetId: number; jalaliYear: number; jalaliMonth: number
  startDate: string; endDate: string; daysInMonth: number
  status: PeriodStatus; glEntryId: number | null
  calculatedBy: string | null; approvedBy: string | null
  slipCount: number; totalNet: number; totalGross: number; totalTax: number
}

export async function listPeriods(): Promise<PeriodRow[]> {
  return await pgQuery<PeriodRow>(
    `SELECT p.id, p.ruleset_id AS "rulesetId", p.jalali_year AS "jalaliYear",
            p.jalali_month AS "jalaliMonth", p.start_date AS "startDate", p.end_date AS "endDate",
            p.days_in_month AS "daysInMonth", p.status, p.gl_entry_id AS "glEntryId",
            p.calculated_by AS "calculatedBy", p.approved_by AS "approvedBy",
            (SELECT count(*)::int FROM payroll_slips s WHERE s.period_id=p.id AND s.status<>'reversed') AS "slipCount",
            COALESCE((SELECT SUM(s.net) FROM payroll_slips s WHERE s.period_id=p.id),0)::float AS "totalNet",
            COALESCE((SELECT SUM(s.gross) FROM payroll_slips s WHERE s.period_id=p.id),0)::float AS "totalGross",
            COALESCE((SELECT SUM(s.tax) FROM payroll_slips s WHERE s.period_id=p.id),0)::float AS "totalTax"
     FROM payroll_periods p ORDER BY p.jalali_year DESC, p.jalali_month DESC`)
}

export async function periodById(id: number): Promise<PeriodRow | null> {
  return (await listPeriods()).find(p => p.id === id) ?? null
}

/** Open a payroll month, bound to the ruleset in force on its first day. */
export async function openPeriod(
  jalaliYear: number, jalaliMonth: number, userId: string,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const days = jalaliMonthLength(jalaliYear, jalaliMonth)
  const [gy1, gm1, gd1] = toGregorian(jalaliYear, jalaliMonth, 1)
  const [gy2, gm2, gd2] = toGregorian(jalaliYear, jalaliMonth, days)
  const startDate = iso(gy1, gm1, gd1)
  const endDate = iso(gy2, gm2, gd2)

  const rs = await rulesetFor(startDate)
  if (!rs) return { ok: false, error: 'برای این تاریخ هیچ مجموعه‌قوانینی تعریف نشده است' }

  const existing = (await pgQuery<{ id: number }>(
    `SELECT id FROM payroll_periods WHERE jalali_year=$1 AND jalali_month=$2`,
    [jalaliYear, jalaliMonth]))[0]
  if (existing) return { ok: false, error: 'این دوره از قبل باز شده است' }

  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_periods (ruleset_id, jalali_year, jalali_month, start_date, end_date, days_in_month, status)
     VALUES ($1,$2,$3,$4,$5,$6,'open') RETURNING id`,
    [rs.id, jalaliYear, jalaliMonth, startDate, endDate, days]))[0]
  void userId
  return { ok: true, id: row.id }
}

// ── worked time (reuses 28.2) ───────────────────────────────────────────────

/**
 * Assemble a month's worked time from the 28.2 tables.
 *
 * No parallel attendance store: whatever the attendance module recorded is what
 * payroll pays. Overtime counts only APPROVED rows — an unapproved claim is not
 * yet an entitlement.
 */
export async function workedTimeOf(
  employeeId: number, period: PeriodRow,
): Promise<WorkedTime> {
  const att = await pgQuery<{ present: string; late: string }>(
    `SELECT count(*) FILTER (WHERE worked_minutes > 0)::text AS present,
            COALESCE(SUM(late_minutes),0)::text AS late
     FROM hr_attendance WHERE employee_id=$1 AND date BETWEEN $2 AND $3`,
    [employeeId, period.startDate, period.endDate])

  const ot = await pgQuery<{ kind: string; hours: string }>(
    `SELECT kind, COALESCE(SUM(hours),0)::text AS hours
     FROM hr_overtime WHERE employee_id=$1 AND date BETWEEN $2 AND $3 AND approved=1
     GROUP BY kind`, [employeeId, period.startDate, period.endDate])
  const hoursOf = (k: string) => Number(ot.find(o => o.kind === k)?.hours ?? 0)

  // Unpaid leave is the only leave that reduces pay; paid leave is worked time
  // as far as payroll is concerned.
  const unpaid = Number((await pgQuery<{ n: string }>(
    `SELECT COALESCE(SUM(r.days),0)::text AS n
     FROM hr_leave_requests r JOIN hr_leave_types t ON t.id = r.leave_type_id
     WHERE r.employee_id=$1 AND r.status='approved' AND t.paid=0
       AND r.start_date <= $3 AND r.end_date >= $2`,
    [employeeId, period.startDate, period.endDate]))[0]?.n ?? 0)

  const presentDays = Number(att[0]?.present ?? 0)
  // With no attendance recorded at all, a salaried employee is assumed to have
  // worked the month. Treating "no record" as "absent" would zero everybody's
  // pay the first month the module is used — a loud wrong answer beats a silent
  // one, but a sane default beats both here, and absence is recorded explicitly.
  const workedDays = presentDays > 0 ? presentDays : period.daysInMonth

  return {
    daysInMonth: period.daysInMonth,
    workedDays: Math.max(0, workedDays - unpaid),
    absenceDays: 0,
    unpaidLeaveDays: unpaid,
    lateMinutes: Number(att[0]?.late ?? 0),
    overtimeHours: hoursOf('normal'),
    holidayWorkHours: hoursOf('holiday'),
    fridayWorkHours: 0,
    nightShiftHours: hoursOf('night'),
    shiftWorkHours: 0,
  }
}

// ── loans ───────────────────────────────────────────────────────────────────

export async function listLoans(employeeId?: number) {
  const params: unknown[] = []
  let where = '1=1'
  if (employeeId) { params.push(employeeId); where += ` AND l.employee_id=$1` }
  return await pgQuery<{ id: number; employeeId: number; employeeName: string; totalAmount: number; installments: number; monthlyAmount: number; paid: number; outstanding: number; status: string }>(
    `SELECT l.id, l.employee_id AS "employeeId", (e.first_name||' '||e.last_name) AS "employeeName",
            l.total_amount::float AS "totalAmount", l.installments, l.monthly_amount::float AS "monthlyAmount",
            COALESCE((SELECT SUM(i.amount) FROM payroll_loan_installments i WHERE i.loan_id=l.id),0)::float AS paid,
            (l.total_amount - COALESCE((SELECT SUM(i.amount) FROM payroll_loan_installments i WHERE i.loan_id=l.id),0))::float AS outstanding,
            l.status
     FROM payroll_loans l JOIN hr_employees e ON e.id=l.employee_id
     WHERE ${where} ORDER BY l.id DESC`, params)
}

export async function createLoan(
  d: { employeeId: number; totalAmount: number; installments: number; startDate?: string | null; note?: string | null },
  userId: string,
): Promise<number> {
  const monthly = d.installments > 0 ? Math.round(d.totalAmount / d.installments) : d.totalAmount
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_loans (employee_id, total_amount, installments, monthly_amount, start_date, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [d.employeeId, d.totalAmount, d.installments, monthly, d.startDate ?? null, d.note ?? null, userId]))[0]
  return row.id
}

/** The instalment due this month — capped at what is still outstanding. */
async function dueInstallments(employeeId: number): Promise<{ loanId: number; amount: number }[]> {
  const loans = await listLoans(employeeId)
  return loans
    .filter(l => l.status === 'active' && l.outstanding > 0)
    .map(l => ({ loanId: l.id, amount: Math.min(l.monthlyAmount, l.outstanding) }))
}

// ── calculation ─────────────────────────────────────────────────────────────

export interface SlipRow {
  id: number; employeeId: number; employeeName: string; employeeCode: string
  gross: number; insuranceBase: number; employeeInsurance: number; employerInsurance: number
  taxableIncome: number; tax: number; deductions: number; net: number
  status: string; workedDays: number; reversalOf: number | null; reversedBy: number | null
}

export async function listSlips(periodId: number, opts: { scopeClause?: string; scopeParams?: unknown[] } = {}): Promise<SlipRow[]> {
  return await pgQuery<SlipRow>(
    `SELECT s.id, s.employee_id AS "employeeId", (e.first_name||' '||e.last_name) AS "employeeName",
            e.employee_code AS "employeeCode",
            s.gross::float AS gross, s.insurance_base::float AS "insuranceBase",
            s.employee_insurance::float AS "employeeInsurance",
            s.employer_insurance::float AS "employerInsurance",
            s.taxable_income::float AS "taxableIncome", s.tax::float AS tax,
            s.deductions::float AS deductions, s.net::float AS net, s.status,
            s.worked_days::float AS "workedDays",
            s.reversal_of AS "reversalOf", s.reversed_by AS "reversedBy"
     FROM payroll_slips s JOIN hr_employees e ON e.id = s.employee_id
     WHERE s.period_id=$1${opts.scopeClause ?? ''}
     ORDER BY e.employee_code`, [periodId, ...(opts.scopeParams ?? [])])
}

export async function slipDetail(slipId: number) {
  const slip = (await pgQuery<{ id: number; periodId: number; employeeId: number; employeeName: string; rulesetId: number; rulesetYear: number; rulesetVersion: number; gross: number; insuranceBase: number; employeeInsurance: number; employerInsurance: number; unemploymentInsurance: number; taxableIncome: number; tax: number; deductions: number; net: number; status: string; workedDays: number; jalaliYear: number; jalaliMonth: number }>(
    `SELECT s.id, s.period_id AS "periodId", s.employee_id AS "employeeId",
            (e.first_name||' '||e.last_name) AS "employeeName",
            s.ruleset_id AS "rulesetId", r.year AS "rulesetYear", r.version AS "rulesetVersion",
            s.gross::float AS gross, s.insurance_base::float AS "insuranceBase",
            s.employee_insurance::float AS "employeeInsurance",
            s.employer_insurance::float AS "employerInsurance",
            s.unemployment_insurance::float AS "unemploymentInsurance",
            s.taxable_income::float AS "taxableIncome", s.tax::float AS tax,
            s.deductions::float AS deductions, s.net::float AS net, s.status,
            s.worked_days::float AS "workedDays",
            p.jalali_year AS "jalaliYear", p.jalali_month AS "jalaliMonth"
     FROM payroll_slips s
     JOIN hr_employees e ON e.id = s.employee_id
     JOIN payroll_rulesets r ON r.id = s.ruleset_id
     JOIN payroll_periods p ON p.id = s.period_id
     WHERE s.id=$1`, [slipId]))[0]
  if (!slip) return null
  const lines = await pgQuery<{ lineType: string; key: string; labelFa: string; labelEn: string; amount: number; insurable: boolean; taxable: boolean }>(
    `SELECT line_type AS "lineType", key, label_fa AS "labelFa", label_en AS "labelEn",
            amount::float AS amount, insurable::boolean AS insurable, taxable::boolean AS taxable
     FROM payroll_slip_lines WHERE slip_id=$1 ORDER BY sort_order, id`, [slipId])
  return { ...slip, lines }
}

/** Persist one calculated slip and its lines. */
async function insertSlip(
  periodId: number, employeeId: number, rulesetId: number,
  worked: WorkedTime, r: SlipResult,
  opts: { status?: string; reversalOf?: number; note?: string } = {},
): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_slips
       (period_id, employee_id, ruleset_id, worked_days, gross, insurance_base,
        employee_insurance, employer_insurance, unemployment_insurance,
        taxable_income, tax, deductions, net, status, reversal_of, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [periodId, employeeId, rulesetId, worked.workedDays, r.gross, r.insuranceBase,
      r.employeeInsurance, r.employerInsurance, r.unemploymentInsurance,
      r.taxableIncome, r.tax, r.deductions, r.net,
      opts.status ?? 'draft', opts.reversalOf ?? null, opts.note ?? null]))[0]

  for (let i = 0; i < r.lines.length; i++) {
    const l = r.lines[i]
    await pgQuery(
      `INSERT INTO payroll_slip_lines (slip_id, line_type, key, label_fa, label_en, amount, insurable, taxable, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [row.id, l.lineType, l.key, l.labelFa, l.labelEn, l.amount,
        l.insurable ? 1 : 0, l.taxable ? 1 : 0, l.sortOrder])
  }
  return row.id
}

/**
 * Calculate the whole period.
 *
 * Refuses on an approved period: the correction path is a corrective slip, not
 * a silent recalculation of figures already reported and posted.
 */
export async function calculatePeriod(
  periodId: number, userId: string,
): Promise<{ ok: boolean; error?: string; slips?: number; employees?: number }> {
  const period = await periodById(periodId)
  if (!period) return { ok: false, error: 'Period not found' }
  if (!isRecalculable(period.status)) {
    return { ok: false, error: 'دورهٔ تأییدشده دوباره محاسبه نمی‌شود — اصلاح فقط با فیش اصلاحی' }
  }

  const params = await parametersOf(period.rulesetId)
  const brackets = await bracketsOf(period.rulesetId)
  const earningTypes = (await earningTypesOf(period.rulesetId)).filter(t => t.active)
  if (!brackets.length) return { ok: false, error: 'برای این مجموعه‌قوانین هیچ پلکان مالیاتی تعریف نشده است' }

  const employees = await pgQuery<{ id: number; children: number; marital: string | null }>(
    `SELECT id, COALESCE(children_count,0) AS children, marital_status AS marital
     FROM hr_employees WHERE status IN ('active','on_leave')`)

  await pgQuery(`DELETE FROM payroll_slips WHERE period_id=$1 AND status='draft'`, [periodId])

  let count = 0
  for (const e of employees) {
    const history = await pgQuery<import('./employees').EmploymentRecord>(
      `SELECT id, start_date AS "startDate", end_date AS "endDate",
              base_salary::float AS "baseSalary", contract_type AS "contractType"
       FROM hr_employment WHERE employee_id=$1 ORDER BY start_date`, [e.id])
    // 🔴 AS OF the period, not "current": a raise in Mordad must not restate
    // the Tir payslip. This is exactly what the 28.1 append-only history is for.
    const employment = employmentOn(history, period.endDate)
    if (!employment) continue

    const worked = await workedTimeOf(e.id, period)
    const loans = await dueInstallments(e.id)
    const nameRow = (await pgQuery<{ full: string }>(
      `SELECT (first_name||' '||last_name) AS full FROM hr_employees WHERE id=$1`, [e.id]))[0]

    const result = calculateSlip({
      employee: {
        id: e.id, fullName: nameRow?.full ?? '', childrenCount: Number(e.children ?? 0),
        married: e.marital === 'married',
      },
      employment: { baseSalary: employment.baseSalary, contractType: employment.contractType },
      worked, loans,
      params: params as PayrollParameter[],
      brackets, earningTypes: earningTypes as EarningType[],
    })

    await insertSlip(periodId, e.id, period.rulesetId, worked, result)
    count++
  }

  await pgQuery(
    `UPDATE payroll_periods SET status='calculated', calculated_by=$2, calculated_at=${NOW} WHERE id=$1`,
    [periodId, userId])
  return { ok: true, slips: count, employees: employees.length }
}

// ── approval, GL, payment ───────────────────────────────────────────────────

/**
 * Approve a calculated period.
 *
 * 🔴 Maker ≠ checker: the person who ran the calculation may not approve it.
 * Reuses `isSeparationViolation` rather than re-implementing the rule.
 */
export async function approvePeriod(
  periodId: number, userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const period = await periodById(periodId)
  if (!period) return { ok: false, error: 'Period not found' }
  if (period.status !== 'calculated') return { ok: false, error: `دوره در وضعیت ${period.status} قابل تأیید نیست` }

  const { isSeparationViolation } = await import('@/lib/approval/engine')
  if (period.calculatedBy && isSeparationViolation('payroll_period', period.calculatedBy, userId)) {
    return { ok: false, error: 'محاسبه‌کننده نمی‌تواند همان دوره را تأیید کند (تفکیک وظایف)' }
  }

  await pgQuery(
    `UPDATE payroll_periods SET status='approved', approved_by=$2, approved_at=${NOW} WHERE id=$1`,
    [periodId, userId])
  await pgQuery(`UPDATE payroll_slips SET status='approved' WHERE period_id=$1 AND status='draft'`, [periodId])
  return { ok: true }
}

async function payrollGlMap(): Promise<Record<string, string>> {
  const rows = await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key LIKE 'gl_map_payroll_%'`)
  const m: Record<string, string> = {}
  for (const r of rows) m[r.key] = r.value
  return {
    '6100': m['gl_map_payroll_expense'] ?? '6100',
    '6110': m['gl_map_payroll_employer_insurance_expense'] ?? '6110',
    '2300': m['gl_map_payroll_payable'] ?? '2300',
    '2310': m['gl_map_payroll_insurance_payable'] ?? '2310',
    '2320': m['gl_map_payroll_tax_payable'] ?? '2320',
    '1160': m['gl_map_payroll_loan'] ?? '1160',
  }
}

/** Period totals — the figures the journal entry is built from. */
export async function periodTotals(periodId: number) {
  const t = (await pgQuery<{ gross: string; ei: string; er: string; un: string; tax: string; ded: string; net: string }>(
    `SELECT COALESCE(SUM(gross),0)::text AS gross,
            COALESCE(SUM(employee_insurance),0)::text AS ei,
            COALESCE(SUM(employer_insurance),0)::text AS er,
            COALESCE(SUM(unemployment_insurance),0)::text AS un,
            COALESCE(SUM(tax),0)::text AS tax,
            COALESCE(SUM(deductions),0)::text AS ded,
            COALESCE(SUM(net),0)::text AS net
     FROM payroll_slips WHERE period_id=$1 AND status IN ('approved','paid','correction')`,
    [periodId]))[0]
  const loan = Number((await pgQuery<{ n: string }>(
    `SELECT COALESCE(SUM(l.amount),0)::text AS n FROM payroll_slip_lines l
     JOIN payroll_slips s ON s.id = l.slip_id
     WHERE s.period_id=$1 AND s.status IN ('approved','paid','correction') AND l.key='loan'`,
    [periodId]))[0]?.n ?? 0)

  const gross = Number(t?.gross ?? 0)
  const employeeInsurance = Number(t?.ei ?? 0)
  const tax = Number(t?.tax ?? 0)
  const deductions = Number(t?.ded ?? 0)
  return {
    gross,
    employeeInsurance,
    employerInsurance: Number(t?.er ?? 0),
    unemploymentInsurance: Number(t?.un ?? 0),
    tax,
    loanRepayment: loan,
    // Everything withheld that is not insurance, tax or a loan.
    otherDeductions: Math.max(0, Math.round((deductions - employeeInsurance - tax - loan) * 100) / 100),
    net: Number(t?.net ?? 0),
  }
}

/**
 * Post the period to the general ledger.
 *
 * Idempotent on `gl_entry_id` — a second call returns the existing entry rather
 * than doubling the payroll expense.
 */
export async function postPeriodToGl(
  periodId: number, userId: string,
): Promise<{ ok: boolean; entryId?: number; alreadyPosted?: boolean; error?: string }> {
  const period = await periodById(periodId)
  if (!period) return { ok: false, error: 'Period not found' }
  if (period.glEntryId) return { ok: true, entryId: period.glEntryId, alreadyPosted: true }
  if (period.status !== 'approved') return { ok: false, error: 'فقط دورهٔ تأییدشده به دفتر کل ثبت می‌شود' }

  const totals = await periodTotals(periodId)
  if (totals.gross <= 0) return { ok: false, error: 'این دوره فیشی برای ثبت ندارد' }

  const map = await payrollGlMap()
  const lines = payrollPostingLines(totals).map(l => ({ ...l, accountCode: map[l.accountCode] ?? l.accountCode }))
  if (!postingBalanced(lines)) {
    // Loud, not silent: an unbalanced payroll entry is a calculation defect and
    // must never reach the ledger.
    return { ok: false, error: 'سند حقوق تراز نیست — ثبت انجام نشد' }
  }

  const { assertPostable } = await import('@/lib/erp/accountingData')
  const gate = await assertPostable(period.endDate)
  if (!gate.ok) return { ok: false, error: gate.error ?? 'دورهٔ مالی بسته است' }

  const { nextNumber } = await import('@/lib/numbering/integrate')
  const entryNo = await nextNumber('journal', { legacyPrefix: 'JE' })
  const total = lines.reduce((s, l) => s + l.debit, 0)

  const entry = (await pgQuery<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, currency, exchange_rate, created_by, period_id, created_at, posted_at)
     VALUES ($1,$2,$3,$4,'posted',$5,'IRR',1,$6,$7,${NOW},${NOW}) RETURNING id`,
    [entryNo, period.endDate,
      `حقوق و دستمزد ${period.jalaliYear}/${String(period.jalaliMonth).padStart(2, '0')}`,
      `payroll:${periodId}`, total, userId, gate.periodId ?? null]))[0]

  for (let i = 0; i < lines.length; i++) {
    const acc = (await pgQuery<{ id: number }>(
      `SELECT id FROM gl_accounts WHERE code=$1 LIMIT 1`, [lines[i].accountCode]))[0]
    if (!acc) return { ok: false, error: `حساب ${lines[i].accountCode} در کدینگ وجود ندارد` }
    await pgQuery(
      `INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [entry.id, acc.id, lines[i].debit, lines[i].credit, lines[i].memo, i])
  }

  await pgQuery(`UPDATE payroll_periods SET gl_entry_id=$2 WHERE id=$1`, [periodId, entry.id])
  return { ok: true, entryId: entry.id }
}

/**
 * Mark the period paid — and only now consume the loan instalments.
 *
 * The instalment ledger is written at PAYMENT, not calculation, so a period that
 * is calculated twice cannot repay a loan twice.
 */
export async function payPeriod(periodId: number, userId: string): Promise<{ ok: boolean; error?: string }> {
  const period = await periodById(periodId)
  if (!period) return { ok: false, error: 'Period not found' }
  if (period.status !== 'approved') return { ok: false, error: 'فقط دورهٔ تأییدشده پرداخت می‌شود' }

  const already = (await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM payroll_loan_installments WHERE period_id=$1`, [periodId]))[0]?.n
  if (already === '0') {
    const rows = await pgQuery<{ slipId: number; employeeId: number; amount: number }>(
      `SELECT s.id AS "slipId", s.employee_id AS "employeeId", l.amount::float AS amount
       FROM payroll_slip_lines l JOIN payroll_slips s ON s.id = l.slip_id
       WHERE s.period_id=$1 AND l.key='loan' AND s.status IN ('approved','correction')`, [periodId])
    for (const r of rows) {
      const loans = await listLoans(r.employeeId)
      let remaining = r.amount
      for (const loan of loans.filter(l => l.status === 'active' && l.outstanding > 0)) {
        if (remaining <= 0) break
        const take = Math.min(remaining, loan.outstanding)
        await pgQuery(
          `INSERT INTO payroll_loan_installments (loan_id, slip_id, period_id, amount, kind)
           VALUES ($1,$2,$3,$4,'payment')`, [loan.id, r.slipId, periodId, take])
        remaining -= take
        if (take >= loan.outstanding) {
          await pgQuery(`UPDATE payroll_loans SET status='settled' WHERE id=$1`, [loan.id])
        }
      }
    }
  }

  await pgQuery(`UPDATE payroll_periods SET status='paid', paid_at=${NOW} WHERE id=$1`, [periodId])
  await pgQuery(`UPDATE payroll_slips SET status='paid' WHERE period_id=$1 AND status='approved'`, [periodId])
  void userId
  return { ok: true }
}

export async function lockPeriod(periodId: number): Promise<{ ok: boolean; error?: string }> {
  const period = await periodById(periodId)
  if (!period) return { ok: false, error: 'Period not found' }
  if (period.status !== 'paid') return { ok: false, error: 'فقط دورهٔ پرداخت‌شده قفل می‌شود' }
  await pgQuery(`UPDATE payroll_periods SET status='locked' WHERE id=$1`, [periodId])
  return { ok: true }
}

/**
 * 🔴 Correct a slip in a locked or approved period.
 *
 * NEVER an edit and never a delete. The original slip stays exactly as issued,
 * a REVERSING slip cancels it, and a new slip carries the corrected figures —
 * so the ledger and the tax return still explain themselves, and the three
 * documents net to the corrected amount. This is the 26.26b BUG-020 discipline
 * applied to payroll.
 */
export async function correctSlip(
  slipId: number, manual: Record<string, number>, userId: string,
): Promise<{ ok: boolean; error?: string; reversalId?: number; correctionId?: number }> {
  const original = await slipDetail(slipId)
  if (!original) return { ok: false, error: 'Slip not found' }
  if (original.status === 'reversed') return { ok: false, error: 'این فیش قبلاً ابطال شده است' }

  const period = await periodById(original.periodId)
  if (!period) return { ok: false, error: 'Period not found' }

  const existingReversal = (await pgQuery<{ id: number }>(
    `SELECT id FROM payroll_slips WHERE reversal_of=$1`, [slipId]))[0]
  if (existingReversal) return { ok: false, error: 'برای این فیش قبلاً فیش اصلاحی صادر شده است' }

  const params = await parametersOf(period.rulesetId)
  const brackets = await bracketsOf(period.rulesetId)
  const earningTypes = (await earningTypesOf(period.rulesetId)).filter(t => t.active)

  const emp = (await pgQuery<{ id: number; full: string; children: number; marital: string | null }>(
    `SELECT id, (first_name||' '||last_name) AS full, COALESCE(children_count,0) AS children,
            marital_status AS marital FROM hr_employees WHERE id=$1`, [original.employeeId]))[0]
  const history = await pgQuery<import('./employees').EmploymentRecord>(
    `SELECT id, start_date AS "startDate", end_date AS "endDate",
            base_salary::float AS "baseSalary", contract_type AS "contractType"
     FROM hr_employment WHERE employee_id=$1 ORDER BY start_date`, [original.employeeId])
  const employment = employmentOn(history, period.endDate)
  if (!employment) return { ok: false, error: 'سابقهٔ استخدامی برای این تاریخ یافت نشد' }

  const worked = await workedTimeOf(original.employeeId, period)

  // The reversal is the original with every sign flipped — recorded as a slip so
  // it appears in the same reports and totals.
  const reversalId = await insertSlip(
    period.id, original.employeeId, original.rulesetId, { ...worked, workedDays: -worked.workedDays },
    {
      lines: original.lines.map((l, i) => ({
        lineType: l.lineType as 'earning' | 'deduction' | 'employer_cost',
        key: l.key, labelFa: `برگشت — ${l.labelFa}`, labelEn: `Reversal — ${l.labelEn}`,
        amount: -l.amount, insurable: l.insurable, taxable: l.taxable, sortOrder: i,
      })),
      gross: -original.gross, insuranceBase: -original.insuranceBase,
      employeeInsurance: -original.employeeInsurance, employerInsurance: -original.employerInsurance,
      unemploymentInsurance: -original.unemploymentInsurance,
      taxableIncome: -original.taxableIncome, tax: -original.tax,
      deductions: -original.deductions, net: -original.net, eidBase: 0, severanceBase: 0,
    },
    { status: 'correction', reversalOf: slipId, note: 'فیش برگشتی' },
  )
  await pgQuery(`UPDATE payroll_slips SET reversed_by=$2, status='reversed' WHERE id=$1`, [slipId, reversalId])

  const recalculated = calculateSlip({
    employee: {
      id: emp.id, fullName: emp.full, childrenCount: Number(emp.children ?? 0),
      married: emp.marital === 'married',
    },
    employment: { baseSalary: employment.baseSalary, contractType: employment.contractType },
    worked, loans: [],
    params: params as PayrollParameter[], brackets, earningTypes: earningTypes as EarningType[],
    manual,
  })
  const correctionId = await insertSlip(
    period.id, original.employeeId, original.rulesetId, worked, recalculated,
    { status: 'correction', note: 'فیش اصلاحی' })

  return { ok: true, reversalId, correctionId }
}

/** Reverse the period's GL entry — the original entry stays posted. */
export async function reversePeriodGl(periodId: number, userId: string): Promise<{ ok: boolean; error?: string; reversalId?: number }> {
  const period = await periodById(periodId)
  if (!period?.glEntryId) return { ok: false, error: 'این دوره سند حسابداری ندارد' }
  const { reverseEntry } = await import('@/lib/erp/glPosting')
  const r = await reverseEntry(period.glEntryId, userId, period.endDate)
  return { ok: true, reversalId: r.reversalId }
}

export async function payrollOverview() {
  const periods = await listPeriods()
  const open = periods.filter(p => p.status === 'open' || p.status === 'calculated').length
  const awaiting = periods.filter(p => p.status === 'calculated').length
  const rulesets = await listRulesets()
  const loans = await listLoans()
  return {
    periods: periods.length,
    openPeriods: open,
    awaitingApproval: awaiting,
    rulesets: rulesets.length,
    activeLoans: loans.filter(l => l.status === 'active').length,
    outstandingLoans: Math.round(loans.reduce((s, l) => s + Math.max(0, l.outstanding), 0)),
  }
}
