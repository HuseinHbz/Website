/**
 * Phase 28.3-ب — annual entitlements, settlement and legal exports (server).
 *
 * Reuses rather than rebuilds: the Eid base comes from the `in_eid_base` flags
 * of 28.3-الف, the severance base from `in_severance_base`, service time from
 * the 28.1 append-only employment history, the leave balance from the 28.2
 * ledger, and every journal entry goes through the same GL machinery.
 *
 * 🔴 The distinction defended here (see `annual.ts`): `seniority_base` is a
 * MONTHLY earning; severance is a TERMINATION benefit. Nothing in this file
 * reads one where it means the other.
 */
import { pgQuery } from '@/lib/db'
import { toGregorian } from '@/lib/erp/jalali'
import { employmentOn } from './employees'
import { progressiveTax } from './payroll'
import type { PayrollParameter } from './payroll'
import {
  serviceDaysBetween, serviceDaysWithin, calculateEid, calculateSeverance,
  severanceDailyBase, severanceBasePolicyOf, monthlySeveranceAccrual,
  leaveEncashment, calculateSettlement, renderExport,
  eidPostingLines, severancePostingLines, severanceAccrualPostingLines,
  settlementPostingLines, annualPostingBalanced,
  type ExportColumn, type AnnualPostingLine,
} from './annual'
import { parametersOf, bracketsOf, rulesetFor, periodById } from './payrollData'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Gregorian bounds of a Jalali year. */
export function jalaliYearBounds(jYear: number): { from: string; to: string; days: number } {
  const [gy1, gm1, gd1] = toGregorian(jYear, 1, 1)
  const [gy2, gm2, gd2] = toGregorian(jYear + 1, 1, 1)
  const from = iso(gy1, gm1, gd1)
  const startNext = iso(gy2, gm2, gd2)
  const to = new Date(new Date(`${startNext}T00:00:00Z`).getTime() - 86_400_000)
    .toISOString().slice(0, 10)
  return { from, to, days: serviceDaysBetween(from, to) }
}

async function glAccountId(code: string): Promise<number> {
  const r = (await pgQuery<{ id: number }>(`SELECT id FROM gl_accounts WHERE code=$1 LIMIT 1`, [code]))[0]
  if (!r) throw new Error(`GL account ${code} is missing from the chart`)
  return r.id
}

async function annualGlMap(): Promise<Record<string, string>> {
  const rows = await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key LIKE 'gl_map_payroll_%'`)
  const m = new Map(rows.map(r => [r.key, r.value]))
  return {
    '6100': m.get('gl_map_payroll_expense') ?? '6100',
    '2300': m.get('gl_map_payroll_payable') ?? '2300',
    '2320': m.get('gl_map_payroll_tax_payable') ?? '2320',
    '1160': m.get('gl_map_payroll_loan') ?? '1160',
    '6120': m.get('gl_map_payroll_eid_expense') ?? '6120',
    '2330': m.get('gl_map_payroll_eid_payable') ?? '2330',
    '6130': m.get('gl_map_payroll_severance_expense') ?? '6130',
    '2340': m.get('gl_map_payroll_severance_payable') ?? '2340',
  }
}

/** Post a balanced set of annual lines, or refuse loudly. */
async function postAnnualEntry(
  date: string, memo: string, reference: string,
  lines: AnnualPostingLine[], userId: string,
): Promise<{ ok: boolean; entryId?: number; error?: string }> {
  if (!lines.length) return { ok: false, error: 'سندی برای ثبت وجود ندارد' }
  const map = await annualGlMap()
  const mapped = lines.map(l => ({ ...l, accountCode: map[l.accountCode] ?? l.accountCode }))
  if (!annualPostingBalanced(mapped)) return { ok: false, error: 'سند تراز نیست — ثبت انجام نشد' }

  const { assertPostable } = await import('@/lib/erp/accountingData')
  const gate = await assertPostable(date)
  if (!gate.ok) return { ok: false, error: gate.error ?? 'دورهٔ مالی بسته است' }

  const { nextNumber } = await import('@/lib/numbering/integrate')
  const entryNo = await nextNumber('journal', { legacyPrefix: 'JE' })
  const total = mapped.reduce((s, l) => s + l.debit, 0)
  const entry = (await pgQuery<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, currency, exchange_rate, created_by, period_id, created_at, posted_at)
     VALUES ($1,$2,$3,$4,'posted',$5,'IRR',1,$6,$7,${NOW},${NOW}) RETURNING id`,
    [entryNo, date, memo, reference, total, userId, gate.periodId ?? null]))[0]

  for (let i = 0; i < mapped.length; i++) {
    await pgQuery(
      `INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [entry.id, await glAccountId(mapped[i].accountCode),
        mapped[i].debit, mapped[i].credit, mapped[i].memo, i])
  }
  return { ok: true, entryId: entry.id }
}

// ── bases read from the 28.3-الف flags ──────────────────────────────────────

/**
 * The monthly Eid base: recurring earnings flagged `in_eid_base` on the
 * employee's most recent slip in the year.
 *
 * Read from the slip rather than recomputed, so the base is exactly what was
 * actually paid — including any correction — and cannot drift from it.
 */
export async function eidBaseOf(employeeId: number, from: string, to: string): Promise<number> {
  const row = (await pgQuery<{ n: string }>(
    `SELECT COALESCE(SUM(l.amount),0)::text AS n
     FROM payroll_slip_lines l
     JOIN payroll_slips s ON s.id = l.slip_id
     JOIN payroll_periods p ON p.id = s.period_id
     JOIN payroll_earning_types t ON t.ruleset_id = s.ruleset_id AND t.key = l.key
     WHERE s.employee_id=$1 AND s.status <> 'reversed'
       AND p.end_date BETWEEN $2 AND $3
       AND l.line_type='earning' AND t.in_eid_base=1
       AND s.id = (SELECT s2.id FROM payroll_slips s2
                   JOIN payroll_periods p2 ON p2.id = s2.period_id
                   WHERE s2.employee_id=$1 AND s2.status <> 'reversed'
                     AND p2.end_date BETWEEN $2 AND $3
                   ORDER BY p2.end_date DESC, s2.id DESC LIMIT 1)`,
    [employeeId, from, to]))[0]
  return Number(row?.n ?? 0)
}

/** Monthly bases flagged `in_severance_base`, most recent first. */
export async function severanceBasesOf(employeeId: number, limit = 3): Promise<number[]> {
  // The flag test MUST be inside the SUM, not only in the join condition: a
  // LEFT JOIN that fails to match still yields the line, so filtering there
  // filters nothing and every earning silently counts. The live suite caught
  // exactly that — it returned the Eid base instead of the severance base.
  const rows = await pgQuery<{ slip_id: number; n: string }>(
    `SELECT s.id AS slip_id,
            COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN l.amount ELSE 0 END),0)::text AS n
     FROM payroll_slips s
     JOIN payroll_periods p ON p.id = s.period_id
     LEFT JOIN payroll_slip_lines l ON l.slip_id = s.id AND l.line_type='earning'
     LEFT JOIN payroll_earning_types t
       ON t.ruleset_id = s.ruleset_id AND t.key = l.key AND t.in_severance_base=1
     WHERE s.employee_id=$1 AND s.status <> 'reversed'
     GROUP BY s.id, p.end_date
     ORDER BY p.end_date DESC, s.id DESC
     LIMIT $2`, [employeeId, limit])
  return rows.map(r => Number(r.n ?? 0)).filter(n => n > 0)
}

// ── Eid bonus ───────────────────────────────────────────────────────────────

export interface EidRow {
  id: number; employeeId: number; employeeName: string; employeeCode: string
  jalaliYear: number; serviceDays: number; monthlyBase: number
  amount: number; tax: number; net: number; status: string; glEntryId: number | null
}

export async function listEid(jalaliYear?: number, opts: { scopeClause?: string; scopeParams?: unknown[] } = {}): Promise<EidRow[]> {
  const params: unknown[] = []
  let where = '1=1'
  if (jalaliYear) { params.push(jalaliYear); where += ` AND c.jalali_year=$${params.length}` }
  return await pgQuery<EidRow>(
    `SELECT c.id, c.employee_id AS "employeeId", (e.first_name||' '||e.last_name) AS "employeeName",
            e.employee_code AS "employeeCode", c.jalali_year AS "jalaliYear",
            c.service_days AS "serviceDays", c.monthly_base::float AS "monthlyBase",
            c.amount::float AS amount, c.tax::float AS tax, c.net::float AS net,
            c.status, c.gl_entry_id AS "glEntryId"
     FROM payroll_eid_calculations c JOIN hr_employees e ON e.id = c.employee_id
     WHERE ${where}${opts.scopeClause ?? ''}
     ORDER BY c.jalali_year DESC, e.employee_code`,
    [...params, ...(opts.scopeParams ?? [])])
}

/**
 * Calculate the Eid bonus for every employee who served any part of the year.
 *
 * Pro-rata by service days inside the year is what makes a mid-year hire, a
 * mid-year leaver and a full-year employee all come out right from one path.
 */
export async function calculateEidForYear(
  jalaliYear: number, userId: string,
): Promise<{ ok: boolean; error?: string; count?: number; total?: number }> {
  const { from, to, days } = jalaliYearBounds(jalaliYear)
  const ruleset = await rulesetFor(to)
  if (!ruleset) return { ok: false, error: 'برای این سال هیچ مجموعه‌قوانینی تعریف نشده است' }

  const params = await parametersOf(ruleset.id) as PayrollParameter[]
  const brackets = await bracketsOf(ruleset.id)
  const minWageDaily = params.find(p => p.key === 'min_wage_daily')?.value ?? 0

  const employees = await pgQuery<{ id: number; hire: string | null; end: string | null }>(
    `SELECT id, hire_date AS hire, end_date AS "end" FROM hr_employees
     WHERE hire_date IS NOT NULL AND hire_date <= $1
       AND (end_date IS NULL OR end_date >= $2)`, [to, from])

  // Recalculating replaces DRAFTS only; an approved bonus is corrected, never
  // recomputed in place.
  await pgQuery(
    `DELETE FROM payroll_eid_calculations WHERE jalali_year=$1 AND status='draft'`, [jalaliYear])

  let count = 0, total = 0
  for (const e of employees) {
    const serviceDays = serviceDaysWithin(e.hire!, e.end, from, to)
    if (serviceDays <= 0) continue
    const monthlyBase = await eidBaseOf(e.id, from, to)
    if (monthlyBase <= 0) continue

    const existing = (await pgQuery<{ id: number }>(
      `SELECT id FROM payroll_eid_calculations
       WHERE employee_id=$1 AND jalali_year=$2 AND status <> 'reversed'`, [e.id, jalaliYear]))[0]
    if (existing) continue

    const r = calculateEid(
      { serviceDays, daysInYear: days, monthlyBase, minWageDaily, params },
      taxable => progressiveTax(taxable, brackets))

    await pgQuery(
      `INSERT INTO payroll_eid_calculations
         (employee_id, ruleset_id, jalali_year, service_days, days_in_year, monthly_base,
          gross, floor_applied, ceiling_applied, amount, tax, net, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13)`,
      [e.id, ruleset.id, jalaliYear, serviceDays, days, monthlyBase,
        r.prorated, r.limitApplied === 'floor' ? r.floor : null,
        r.limitApplied === 'ceiling' ? r.ceiling : null,
        r.amount, r.tax, r.net, userId])
    count++; total += r.amount
  }
  return { ok: true, count, total: Math.round(total) }
}

export async function approveEid(id: number, userId: string): Promise<{ ok: boolean; error?: string }> {
  const row = (await pgQuery<{ status: string; created_by: string | null }>(
    `SELECT status, created_by FROM payroll_eid_calculations WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Not found' }
  if (row.status !== 'draft') return { ok: false, error: `وضعیت ${row.status} قابل تأیید نیست` }
  const { isSeparationViolation } = await import('@/lib/approval/engine')
  if (row.created_by && isSeparationViolation('payroll_period', row.created_by, userId)) {
    return { ok: false, error: 'محاسبه‌کننده نمی‌تواند همان محاسبه را تأیید کند (تفکیک وظایف)' }
  }
  await pgQuery(`UPDATE payroll_eid_calculations SET status='approved' WHERE id=$1`, [id])
  return { ok: true }
}

export async function postEidToGl(id: number, userId: string): Promise<{ ok: boolean; entryId?: number; alreadyPosted?: boolean; error?: string }> {
  const row = (await pgQuery<{ amount: number; tax: number; net: number; status: string; gl_entry_id: number | null; jalali_year: number }>(
    `SELECT amount::float AS amount, tax::float AS tax, net::float AS net, status,
            gl_entry_id, jalali_year FROM payroll_eid_calculations WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Not found' }
  if (row.gl_entry_id) return { ok: true, entryId: row.gl_entry_id, alreadyPosted: true }
  if (row.status !== 'approved') return { ok: false, error: 'فقط عیدی تأییدشده ثبت می‌شود' }

  const { to } = jalaliYearBounds(row.jalali_year)
  const posted = await postAnnualEntry(to, `عیدی سال ${row.jalali_year}`, `eid:${id}`,
    eidPostingLines(row), userId)
  if (!posted.ok) return posted
  await pgQuery(`UPDATE payroll_eid_calculations SET gl_entry_id=$2, status='paid' WHERE id=$1`,
    [id, posted.entryId])
  return posted
}

/** Reverse an Eid calculation — the original stays, exactly like a GL reversal. */
export async function reverseEid(id: number, userId: string): Promise<{ ok: boolean; error?: string; reversalId?: number }> {
  const row = (await pgQuery<{ employee_id: number; ruleset_id: number; jalali_year: number; service_days: number; days_in_year: number; monthly_base: number; amount: number; tax: number; net: number; status: string; reversed_by: number | null; gl_entry_id: number | null }>(
    `SELECT employee_id, ruleset_id, jalali_year, service_days, days_in_year,
            monthly_base::float AS monthly_base, amount::float AS amount,
            tax::float AS tax, net::float AS net, status, reversed_by, gl_entry_id
     FROM payroll_eid_calculations WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Not found' }
  if (row.reversed_by) return { ok: false, error: 'این محاسبه قبلاً برگشت خورده است' }

  const rev = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_eid_calculations
       (employee_id, ruleset_id, jalali_year, service_days, days_in_year, monthly_base,
        gross, amount, tax, net, status, reversal_of, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'correction',$11,'برگشت عیدی',$12) RETURNING id`,
    [row.employee_id, row.ruleset_id, row.jalali_year, -row.service_days, row.days_in_year,
      row.monthly_base, -row.amount, -row.amount, -row.tax, -row.net, id, userId]))[0]
  await pgQuery(`UPDATE payroll_eid_calculations SET reversed_by=$2, status='reversed' WHERE id=$1`,
    [id, rev.id])

  if (row.gl_entry_id) {
    const { reverseEntry } = await import('@/lib/erp/glPosting')
    const { to } = jalaliYearBounds(row.jalali_year)
    await reverseEntry(row.gl_entry_id, userId, to)
  }
  return { ok: true, reversalId: rev.id }
}

// ── severance ───────────────────────────────────────────────────────────────

export interface SeveranceRow {
  id: number; employeeId: number; employeeName: string; employeeCode: string
  fromDate: string; toDate: string; serviceDays: number; dailyBase: number
  basePolicy: string; amount: number; accruedBefore: number
  status: string; glEntryId: number | null
}

export async function listSeverance(opts: { employeeId?: number; scopeClause?: string; scopeParams?: unknown[] } = {}): Promise<SeveranceRow[]> {
  const params: unknown[] = []
  let where = '1=1'
  if (opts.employeeId) { params.push(opts.employeeId); where += ` AND c.employee_id=$${params.length}` }
  return await pgQuery<SeveranceRow>(
    `SELECT c.id, c.employee_id AS "employeeId", (e.first_name||' '||e.last_name) AS "employeeName",
            e.employee_code AS "employeeCode", c.from_date AS "fromDate", c.to_date AS "toDate",
            c.service_days AS "serviceDays", c.daily_base::float AS "dailyBase",
            c.base_policy AS "basePolicy", c.amount::float AS amount,
            c.accrued_before::float AS "accruedBefore", c.status, c.gl_entry_id AS "glEntryId"
     FROM payroll_severance_calculations c JOIN hr_employees e ON e.id = c.employee_id
     WHERE ${where}${opts.scopeClause ?? ''} ORDER BY c.id DESC`,
    [...params, ...(opts.scopeParams ?? [])])
}

/** Provision already accrued for this employee — what the final entry releases. */
export async function accruedSeverance(employeeId: number): Promise<number> {
  const r = (await pgQuery<{ n: string }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='accrual' THEN amount ELSE -amount END),0)::text AS n
     FROM payroll_severance_accruals WHERE employee_id=$1`, [employeeId]))[0]
  return Number(r?.n ?? 0)
}

/**
 * 🔴 Severance at termination — NOT the monthly `seniority_base` allowance.
 *
 * Service days come from the append-only employment history (28.1), so a raise
 * cannot rewrite how long someone worked, and the daily base comes from the
 * earnings flagged `in_severance_base`.
 */
export async function calculateSeveranceFor(
  employeeId: number, endDate: string, userId: string,
): Promise<{ ok: boolean; error?: string; id?: number; amount?: number }> {
  const emp = (await pgQuery<{ hire_date: string | null }>(
    `SELECT hire_date FROM hr_employees WHERE id=$1`, [employeeId]))[0]
  if (!emp?.hire_date) return { ok: false, error: 'تاریخ استخدام ثبت نشده است' }

  const ruleset = await rulesetFor(endDate)
  if (!ruleset) return { ok: false, error: 'برای این تاریخ هیچ مجموعه‌قوانینی تعریف نشده است' }
  const params = await parametersOf(ruleset.id) as PayrollParameter[]
  const daysPerYear = params.find(p => p.key === 'severance_days_per_year')?.value ?? 30
  const policy = severanceBasePolicyOf(params)

  const bases = await severanceBasesOf(employeeId, 3)
  if (!bases.length) return { ok: false, error: 'برای این کارمند هیچ فیشی صادر نشده که مبنای سنوات از آن خوانده شود' }
  const dailyBase = severanceDailyBase(policy, bases[0], bases)

  const serviceDays = serviceDaysBetween(emp.hire_date, endDate)
  const r = calculateSeverance({ serviceDays, dailyBase, daysPerYear })
  const accruedBefore = await accruedSeverance(employeeId)

  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_severance_calculations
       (employee_id, ruleset_id, from_date, to_date, service_days, daily_base, base_policy,
        days_per_year, amount, accrued_before, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11) RETURNING id`,
    [employeeId, ruleset.id, emp.hire_date, endDate, serviceDays, dailyBase, policy,
      daysPerYear, r.amount, accruedBefore, userId]))[0]
  return { ok: true, id: row.id, amount: r.amount }
}

export async function approveSeverance(id: number, userId: string): Promise<{ ok: boolean; error?: string }> {
  const row = (await pgQuery<{ status: string; created_by: string | null }>(
    `SELECT status, created_by FROM payroll_severance_calculations WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Not found' }
  if (row.status !== 'draft') return { ok: false, error: `وضعیت ${row.status} قابل تأیید نیست` }
  const { isSeparationViolation } = await import('@/lib/approval/engine')
  if (row.created_by && isSeparationViolation('payroll_period', row.created_by, userId)) {
    return { ok: false, error: 'محاسبه‌کننده نمی‌تواند همان محاسبه را تأیید کند (تفکیک وظایف)' }
  }
  await pgQuery(`UPDATE payroll_severance_calculations SET status='approved' WHERE id=$1`, [id])
  return { ok: true }
}

export async function postSeveranceToGl(id: number, userId: string): Promise<{ ok: boolean; entryId?: number; alreadyPosted?: boolean; error?: string }> {
  const row = (await pgQuery<{ employee_id: number; amount: number; accrued_before: number; status: string; gl_entry_id: number | null; to_date: string }>(
    `SELECT employee_id, amount::float AS amount, accrued_before::float AS accrued_before,
            status, gl_entry_id, to_date FROM payroll_severance_calculations WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Not found' }
  if (row.gl_entry_id) return { ok: true, entryId: row.gl_entry_id, alreadyPosted: true }
  if (row.status !== 'approved') return { ok: false, error: 'فقط سنوات تأییدشده ثبت می‌شود' }

  const posted = await postAnnualEntry(row.to_date, 'سنوات پایان خدمت', `severance:${id}`,
    severancePostingLines({ amount: row.amount, accruedBefore: row.accrued_before }), userId)
  if (!posted.ok) return posted

  // The provision released is recorded so the accrual ledger nets to zero.
  if (row.accrued_before > 0) {
    await pgQuery(
      `INSERT INTO payroll_severance_accruals (employee_id, amount, kind, gl_entry_id, note)
       VALUES ($1,$2,'settlement',$3,'آزادسازی ذخیره هنگام تسویه')`,
      [row.employee_id, Math.min(row.accrued_before, row.amount), posted.entryId])
  }
  await pgQuery(`UPDATE payroll_severance_calculations SET gl_entry_id=$2, status='paid' WHERE id=$1`,
    [id, posted.entryId])
  return posted
}

/**
 * Monthly severance provision for a period. OFF unless the operator enabled it.
 *
 * Idempotent per (employee, period): re-running a month cannot inflate the
 * liability, the same discipline as the leave accrual.
 */
export async function accrueSeveranceForPeriod(
  periodId: number, userId: string,
): Promise<{ ok: boolean; error?: string; employees?: number; total?: number; entryId?: number }> {
  const period = await periodById(periodId)
  if (!period) return { ok: false, error: 'Period not found' }
  const params = await parametersOf(period.rulesetId) as PayrollParameter[]
  if ((params.find(p => p.key === 'severance_accrual_enabled')?.value ?? 0) !== 1) {
    return { ok: false, error: 'ذخیرهٔ ماهانهٔ سنوات در تنظیمات فعال نیست' }
  }
  const daysPerYear = params.find(p => p.key === 'severance_days_per_year')?.value ?? 30

  const slips = await pgQuery<{ employee_id: number }>(
    `SELECT employee_id FROM payroll_slips WHERE period_id=$1 AND status <> 'reversed'`, [periodId])

  let total = 0, count = 0
  for (const s of slips) {
    const already = (await pgQuery<{ id: number }>(
      `SELECT id FROM payroll_severance_accruals WHERE employee_id=$1 AND period_id=$2 AND kind='accrual'`,
      [s.employee_id, periodId]))[0]
    if (already) continue
    const bases = await severanceBasesOf(s.employee_id, 1)
    if (!bases.length) continue
    const amount = monthlySeveranceAccrual(bases[0] / 30, daysPerYear, period.daysInMonth)
    if (amount <= 0) continue
    await pgQuery(
      `INSERT INTO payroll_severance_accruals (employee_id, period_id, amount, kind, note)
       VALUES ($1,$2,$3,'accrual','ذخیرهٔ ماهانهٔ سنوات')`, [s.employee_id, periodId, amount])
    total += amount; count++
  }
  if (total <= 0) return { ok: true, employees: 0, total: 0 }

  const posted = await postAnnualEntry(period.endDate,
    `ذخیرهٔ سنوات ${period.jalaliYear}/${String(period.jalaliMonth).padStart(2, '0')}`,
    `severance-accrual:${periodId}`, severanceAccrualPostingLines(total), userId)
  if (!posted.ok) return posted
  await pgQuery(
    `UPDATE payroll_severance_accruals SET gl_entry_id=$2 WHERE period_id=$1 AND kind='accrual' AND gl_entry_id IS NULL`,
    [periodId, posted.entryId])
  return { ok: true, employees: count, total: Math.round(total), entryId: posted.entryId }
}

// ── final settlement ────────────────────────────────────────────────────────

export interface SettlementRow {
  id: number; employeeId: number; employeeName: string; employeeCode: string
  endDate: string; reason: string | null
  finalPay: number; severance: number; eid: number; leaveEncashment: number
  leaveDays: number; loanOutstanding: number; otherDeductions: number
  total: number; status: string; glEntryId: number | null
}

export async function listSettlements(opts: { scopeClause?: string; scopeParams?: unknown[] } = {}): Promise<SettlementRow[]> {
  return await pgQuery<SettlementRow>(
    `SELECT s.id, s.employee_id AS "employeeId", (e.first_name||' '||e.last_name) AS "employeeName",
            e.employee_code AS "employeeCode", s.end_date AS "endDate", s.reason,
            s.final_pay::float AS "finalPay", s.severance::float AS severance,
            s.eid::float AS eid, s.leave_encashment::float AS "leaveEncashment",
            s.leave_days::float AS "leaveDays", s.loan_outstanding::float AS "loanOutstanding",
            s.other_deductions::float AS "otherDeductions", s.total::float AS total,
            s.status, s.gl_entry_id AS "glEntryId"
     FROM payroll_settlements s JOIN hr_employees e ON e.id = s.employee_id
     WHERE 1=1${opts.scopeClause ?? ''} ORDER BY s.id DESC`, opts.scopeParams ?? [])
}

/**
 * Build the termination settlement.
 *
 * Everything is pulled from the module that owns it: the last payslip from
 * payroll, severance and Eid from their own calculations, unused leave from the
 * 28.2 balance ledger, the outstanding loan from the instalment ledger. Nothing
 * is re-derived here, so the settlement cannot disagree with the records it
 * summarises.
 */
export async function buildSettlement(
  employeeId: number, endDate: string, reason: string | null, otherDeductions: number, userId: string,
): Promise<{ ok: boolean; error?: string; id?: number; total?: number; employeeOwes?: boolean }> {
  const existing = (await pgQuery<{ id: number }>(
    `SELECT id FROM payroll_settlements WHERE employee_id=$1 AND status <> 'reversed'`, [employeeId]))[0]
  if (existing) return { ok: false, error: 'برای این کارمند تسویه‌حساب ثبت شده است' }

  const ruleset = await rulesetFor(endDate)
  if (!ruleset) return { ok: false, error: 'برای این تاریخ هیچ مجموعه‌قوانینی تعریف نشده است' }
  const params = await parametersOf(ruleset.id) as PayrollParameter[]

  const lastSlip = (await pgQuery<{ id: number; net: number }>(
    `SELECT s.id, s.net::float AS net FROM payroll_slips s
     JOIN payroll_periods p ON p.id = s.period_id
     WHERE s.employee_id=$1 AND s.status <> 'reversed'
     ORDER BY p.end_date DESC, s.id DESC LIMIT 1`, [employeeId]))[0]

  const sev = (await pgQuery<{ id: number; amount: number }>(
    `SELECT id, amount::float AS amount FROM payroll_severance_calculations
     WHERE employee_id=$1 AND status <> 'reversed' ORDER BY id DESC LIMIT 1`, [employeeId]))[0]

  const eid = (await pgQuery<{ id: number; net: number }>(
    `SELECT id, net::float AS net FROM payroll_eid_calculations
     WHERE employee_id=$1 AND status <> 'reversed' ORDER BY id DESC LIMIT 1`, [employeeId]))[0]

  // Unused leave from the 28.2 ledger — annual leave only.
  const { leaveBalances } = await import('./leaveData')
  const balances = await leaveBalances(employeeId)
  const annual = balances.find(b => b.type.code === 'annual')
  const bases = await severanceBasesOf(employeeId, 1)
  const dailyBase = bases.length ? bases[0] / 30 : 0
  const enc = leaveEncashment(
    annual?.balance ?? 0, dailyBase,
    params.find(p => p.key === 'leave_encashment_max_days')?.value ?? 0,
    (params.find(p => p.key === 'leave_encashment_enabled')?.value ?? 0) === 1)

  const { listLoans } = await import('./payrollData')
  const loans = await listLoans(employeeId)
  const loanOutstanding = loans
    .filter(l => l.status === 'active')
    .reduce((s, l) => s + Math.max(0, l.outstanding), 0)

  const r = calculateSettlement({
    finalPay: lastSlip?.net ?? 0,
    severance: sev?.amount ?? 0,
    eid: eid?.net ?? 0,
    leaveEncashment: enc.amount,
    loanOutstanding,
    otherDeductions,
  })

  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO payroll_settlements
       (employee_id, end_date, reason, last_slip_id, severance_id, eid_id,
        final_pay, severance, eid, leave_encashment, leave_days,
        loan_outstanding, other_deductions, total, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft',$15) RETURNING id`,
    [employeeId, endDate, reason, lastSlip?.id ?? null, sev?.id ?? null, eid?.id ?? null,
      r.finalPay, r.severance, r.eid, r.leaveEncashment, enc.days,
      r.loanOutstanding, r.otherDeductions, r.total, userId]))[0]

  return { ok: true, id: row.id, total: r.total, employeeOwes: r.employeeOwes }
}

export async function approveSettlement(id: number, userId: string): Promise<{ ok: boolean; error?: string }> {
  const row = (await pgQuery<{ status: string; created_by: string | null }>(
    `SELECT status, created_by FROM payroll_settlements WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Not found' }
  if (row.status !== 'draft') return { ok: false, error: `وضعیت ${row.status} قابل تأیید نیست` }
  const { isSeparationViolation } = await import('@/lib/approval/engine')
  if (row.created_by && isSeparationViolation('payroll_period', row.created_by, userId)) {
    return { ok: false, error: 'تنظیم‌کننده نمی‌تواند همان تسویه‌حساب را تأیید کند (تفکیک وظایف)' }
  }
  await pgQuery(`UPDATE payroll_settlements SET status='approved', approved_by=$2 WHERE id=$1`, [id, userId])
  return { ok: true }
}

export async function postSettlementToGl(id: number, userId: string): Promise<{ ok: boolean; entryId?: number; alreadyPosted?: boolean; error?: string }> {
  const row = (await pgQuery<{ employee_id: number; end_date: string; status: string; gl_entry_id: number | null; leave_encashment: number; loan_outstanding: number; other_deductions: number; total: number }>(
    `SELECT employee_id, end_date, status, gl_entry_id,
            leave_encashment::float AS leave_encashment, loan_outstanding::float AS loan_outstanding,
            other_deductions::float AS other_deductions, total::float AS total
     FROM payroll_settlements WHERE id=$1`, [id]))[0]
  if (!row) return { ok: false, error: 'Not found' }
  if (row.gl_entry_id) return { ok: true, entryId: row.gl_entry_id, alreadyPosted: true }
  if (row.status !== 'approved') return { ok: false, error: 'فقط تسویه‌حساب تأییدشده ثبت می‌شود' }

  const lines = settlementPostingLines({
    leaveEncashment: row.leave_encashment,
    loanOutstanding: row.loan_outstanding,
    otherDeductions: row.other_deductions,
    total: row.total,
  })
  if (!lines.length) {
    await pgQuery(`UPDATE payroll_settlements SET status='paid' WHERE id=$1`, [id])
    return { ok: true }
  }

  const posted = await postAnnualEntry(row.end_date, 'تسویه‌حساب پایان خدمت',
    `settlement:${id}`, lines, userId)
  if (!posted.ok) return posted

  // Close the loans this settlement cleared.
  if (row.loan_outstanding > 0) {
    await pgQuery(
      `UPDATE payroll_loans SET status='settled' WHERE employee_id=$1 AND status='active'`,
      [row.employee_id])
  }
  await pgQuery(`UPDATE payroll_settlements SET gl_entry_id=$2, status='paid' WHERE id=$1`,
    [id, posted.entryId])
  await pgQuery(`UPDATE hr_employees SET status='terminated', end_date=$2 WHERE id=$1`,
    [row.employee_id, row.end_date])
  return posted
}

// ── legal exports ───────────────────────────────────────────────────────────

export interface ExportLayout {
  id: number; key: string; titleFa: string; titleEn: string; kind: string
  delimiter: string; includeHeader: boolean; columns: ExportColumn[]
  verified: boolean; note: string | null
}

export async function listExportLayouts(): Promise<ExportLayout[]> {
  const rows = await pgQuery<{ id: number; key: string; titleFa: string; titleEn: string; kind: string; delimiter: string; includeHeader: number; columns: string; verified: number; note: string | null }>(
    `SELECT id, key, title_fa AS "titleFa", title_en AS "titleEn", kind, delimiter,
            include_header AS "includeHeader", columns, verified, note
     FROM payroll_export_layouts ORDER BY kind, key`)
  return rows.map(r => ({
    ...r,
    includeHeader: r.includeHeader === 1,
    verified: r.verified === 1,
    columns: JSON.parse(r.columns) as ExportColumn[],
  }))
}

export async function saveExportLayout(
  key: string, d: { columns: ExportColumn[]; delimiter?: string; includeHeader?: boolean; verified?: boolean; note?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!d.columns.length) return { ok: false, error: 'حداقل یک ستون لازم است' }
  await pgQuery(
    `UPDATE payroll_export_layouts
     SET columns=$2, delimiter=COALESCE($3, delimiter), include_header=COALESCE($4, include_header),
         verified=COALESCE($5, verified), note=$6
     WHERE key=$1`,
    [key, JSON.stringify(d.columns), d.delimiter ?? null,
      d.includeHeader == null ? null : (d.includeHeader ? 1 : 0),
      d.verified == null ? null : (d.verified ? 1 : 0), d.note ?? null])
  return { ok: true }
}

/** The rows a payroll period contributes to a legal export. */
export async function exportRows(periodId: number): Promise<Record<string, unknown>[]> {
  const rows = await pgQuery<Record<string, unknown>>(
    `SELECT e.employee_code AS "employeeCode", e.first_name AS "firstName", e.last_name AS "lastName",
            (e.first_name||' '||e.last_name) AS "fullName",
            e.national_id AS "nationalId", e.insurance_no AS "insuranceNo",
            e.birth_date AS "birthDate", e.hire_date AS "hireDate",
            s.worked_days::float AS "workedDays", s.gross::float AS gross,
            s.insurance_base::float AS "insuranceBase",
            s.employee_insurance::float AS "employeeInsurance",
            s.employer_insurance::float AS "employerInsurance",
            s.unemployment_insurance::float AS "unemploymentInsurance",
            s.taxable_income::float AS "taxableIncome", s.tax::float AS tax,
            s.deductions::float AS deductions, s.net::float AS net,
            (s.gross - s.taxable_income)::float AS "exemptTotal"
     FROM payroll_slips s JOIN hr_employees e ON e.id = s.employee_id
     WHERE s.period_id=$1 AND s.status <> 'reversed'
     ORDER BY e.employee_code`, [periodId])
  return rows.map((r, i) => ({ ...r, row: i + 1 }))
}

export async function renderLegalExport(
  periodId: number, layoutKey: string,
): Promise<{ ok: boolean; error?: string; csv?: string; verified?: boolean; note?: string | null; filename?: string }> {
  const layout = (await listExportLayouts()).find(l => l.key === layoutKey)
  if (!layout) return { ok: false, error: 'قالب خروجی یافت نشد' }
  const period = await periodById(periodId)
  if (!period) return { ok: false, error: 'Period not found' }
  const rows = await exportRows(periodId)
  const csv = renderExport(rows, layout.columns, {
    delimiter: layout.delimiter, includeHeader: layout.includeHeader,
  })
  return {
    ok: true, csv, verified: layout.verified, note: layout.note,
    filename: `${layout.key}-${period.jalaliYear}-${String(period.jalaliMonth).padStart(2, '0')}.csv`,
  }
}

export async function annualOverview() {
  const eid = await pgQuery<{ n: string; total: string }>(
    `SELECT count(*)::text AS n, COALESCE(SUM(amount),0)::text AS total
     FROM payroll_eid_calculations WHERE status <> 'reversed'`)
  const sev = await pgQuery<{ n: string; total: string }>(
    `SELECT count(*)::text AS n, COALESCE(SUM(amount),0)::text AS total
     FROM payroll_severance_calculations WHERE status <> 'reversed'`)
  const provision = (await pgQuery<{ n: string }>(
    `SELECT COALESCE(SUM(CASE WHEN kind='accrual' THEN amount ELSE -amount END),0)::text AS n
     FROM payroll_severance_accruals`))[0]?.n
  const settlements = (await pgQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM payroll_settlements WHERE status <> 'reversed'`))[0]?.n
  return {
    eidCount: Number(eid[0]?.n ?? 0),
    eidTotal: Math.round(Number(eid[0]?.total ?? 0)),
    severanceCount: Number(sev[0]?.n ?? 0),
    severanceTotal: Math.round(Number(sev[0]?.total ?? 0)),
    severanceProvision: Math.round(Number(provision ?? 0)),
    settlements: Number(settlements ?? 0),
  }
}
