/**
 * Phase 28.3-الف — the payroll calculation engine.
 *
 * ⚠️ There is not a single statutory number in this file, and that is the whole
 * point. Tax brackets, insurance rates, allowance amounts and — the part people
 * forget — WHICH earnings are insurable or taxable all arrive as arguments. Next
 * year the operator edits data; this file does not change.
 *
 * The consequence for anyone editing it: if you are about to write a number that
 * came from a law or a circular, stop. It belongs in `payroll_parameters`,
 * `payroll_tax_brackets` or `payroll_earning_types`. The only constants here are
 * arithmetic ones (100 for a percentage).
 *
 * Everything is pure — no I/O — so every claim below is testable with numbers.
 */

// ── inputs ──────────────────────────────────────────────────────────────────

export type ValueType = 'amount' | 'percent' | 'factor' | 'boolean' | 'integer'
export type Inclusion = 'yes' | 'no' | 'capped'
export type CalcMethod = 'fixed' | 'percent_of_base' | 'daily_prorated' | 'per_child' | 'manual'

export interface PayrollParameter {
  key: string
  group: 'tax' | 'insurance' | 'labor' | 'company'
  valueType: ValueType
  value: number
}

export interface TaxBracket {
  seq: number
  fromAmount: number
  /** null = open-ended; the last bracket must be open. */
  toAmount: number | null
  ratePercent: number
}

export interface EarningType {
  key: string
  labelFa: string
  labelEn: string
  /** مستمر — decides the Eid-bonus and severance bases (28.3-ب reads these). */
  recurring: boolean
  insurable: Inclusion
  insurableCap: number | null
  taxable: Inclusion
  taxableCap: number | null
  inEidBase: boolean
  inSeveranceBase: boolean
  inOvertimeBase: boolean
  calcMethod: CalcMethod
  calcValue: number
  /** Which parameter supplies the amount, when the method is parameter-driven. */
  paramKey: string | null
  sortOrder: number
}

export interface WorkedTime {
  /** Calendar days the payroll month has (29/30/31 in the Jalali calendar). */
  daysInMonth: number
  /** Days actually worked — drives proration for a partial month. */
  workedDays: number
  absenceDays: number
  unpaidLeaveDays: number
  lateMinutes: number
  overtimeHours: number
  holidayWorkHours: number
  fridayWorkHours: number
  nightShiftHours: number
  shiftWorkHours: number
}

export interface SlipEmployee {
  id: number
  fullName: string
  childrenCount: number
  married: boolean
}

export interface SlipEmployment {
  /** From the append-only employment history (28.1), as of the period date. */
  baseSalary: number
  contractType: string
}

/** Manual amounts the operator entered for this employee this month. */
export type ManualEarnings = Record<string, number>

export interface LoanInstallment {
  loanId: number
  amount: number
}

export interface SlipLine {
  lineType: 'earning' | 'deduction' | 'employer_cost'
  key: string
  labelFa: string
  labelEn: string
  amount: number
  insurable: boolean
  taxable: boolean
  sortOrder: number
}

export interface SlipResult {
  lines: SlipLine[]
  gross: number
  insuranceBase: number
  employeeInsurance: number
  employerInsurance: number
  unemploymentInsurance: number
  taxableIncome: number
  tax: number
  deductions: number
  net: number
  /** Bases 28.3-ب will need; computed here because the flags live here. */
  eidBase: number
  severanceBase: number
}

// ── parameter access ────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Read a parameter by key.
 *
 * A MISSING parameter is not silently zero: zero is a legitimate value (a
 * company may genuinely set the late deduction to 0), so a caller that needs to
 * distinguish "set to zero" from "never configured" uses `hasParam`. The default
 * here exists so a ruleset missing an optional knob still calculates.
 */
export function param(params: PayrollParameter[], key: string, fallback = 0): number {
  const p = params.find(x => x.key === key)
  return p ? Number(p.value) : fallback
}

export function hasParam(params: PayrollParameter[], key: string): boolean {
  return params.some(x => x.key === key)
}

/** Hourly wage — a FORMULA, never a stored number. */
export function hourlyWage(dailyWage: number, dailyWorkHours: number): number {
  if (dailyWorkHours <= 0) return 0
  return round2(dailyWage / dailyWorkHours)
}

/** Daily wage from a monthly salary and the month's length. */
export function dailyWage(monthlySalary: number, daysInMonth: number): number {
  if (daysInMonth <= 0) return 0
  return round2(monthlySalary / daysInMonth)
}

// ── bracket validation ──────────────────────────────────────────────────────

export interface BracketIssue {
  seq: number
  code: 'gap' | 'overlap' | 'unordered' | 'last_not_open' | 'negative_rate' | 'empty'
  fa: string
  en: string
}

/**
 * Validate a bracket table before it is saved.
 *
 * A gap or an overlap does not throw at calculation time — it silently taxes
 * someone at the wrong rate, which is exactly the class of error nobody notices
 * until an audit. So it is refused at write time instead.
 */
export function validateBrackets(brackets: TaxBracket[]): BracketIssue[] {
  const issues: BracketIssue[] = []
  if (brackets.length === 0) {
    return [{ seq: 0, code: 'empty', fa: 'حداقل یک پله لازم است', en: 'At least one bracket is required' }]
  }
  const sorted = [...brackets].sort((a, b) => a.seq - b.seq)

  for (const b of sorted) {
    if (b.ratePercent < 0 || b.ratePercent > 100) {
      issues.push({ seq: b.seq, code: 'negative_rate', fa: 'نرخ باید بین ۰ تا ۱۰۰ باشد', en: 'Rate must be between 0 and 100' })
    }
    if (b.toAmount != null && b.toAmount <= b.fromAmount) {
      issues.push({ seq: b.seq, code: 'unordered', fa: 'مبلغ پایان باید از مبلغ شروع بیشتر باشد', en: 'The end amount must exceed the start amount' })
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i]
    if (prev.toAmount == null) {
      issues.push({ seq: prev.seq, code: 'last_not_open', fa: 'فقط آخرین پله می‌تواند باز باشد', en: 'Only the last bracket may be open-ended' })
      continue
    }
    if (cur.fromAmount > prev.toAmount) {
      issues.push({ seq: cur.seq, code: 'gap', fa: 'بین این پله و پلهٔ قبلی شکاف وجود دارد', en: 'There is a gap between this bracket and the previous one' })
    } else if (cur.fromAmount < prev.toAmount) {
      issues.push({ seq: cur.seq, code: 'overlap', fa: 'این پله با پلهٔ قبلی همپوشانی دارد', en: 'This bracket overlaps the previous one' })
    }
  }

  if (sorted[sorted.length - 1].toAmount != null) {
    issues.push({
      seq: sorted[sorted.length - 1].seq, code: 'last_not_open',
      fa: 'آخرین پله باید باز باشد (بدون سقف)', en: 'The last bracket must be open-ended',
    })
  }
  return issues
}

// ── progressive tax ─────────────────────────────────────────────────────────

export interface TaxBreakdownRow {
  seq: number
  from: number
  to: number | null
  ratePercent: number
  amountInBracket: number
  tax: number
}

/**
 * Progressive tax over an ARBITRARY bracket table.
 *
 * The loop knows nothing about how many bands there are or what the rates say —
 * a year that moves from six brackets to seven is a data edit. Each band is
 * taxed on the slice of income that falls inside it, never the whole income at
 * the top rate.
 */
export function taxBreakdown(taxableIncome: number, brackets: TaxBracket[]): TaxBreakdownRow[] {
  const sorted = [...brackets].sort((a, b) => a.fromAmount - b.fromAmount)
  const out: TaxBreakdownRow[] = []
  for (const b of sorted) {
    const upper = b.toAmount ?? Infinity
    const slice = Math.min(taxableIncome, upper) - b.fromAmount
    const amountInBracket = slice > 0 ? round2(slice) : 0
    out.push({
      seq: b.seq, from: b.fromAmount, to: b.toAmount, ratePercent: b.ratePercent,
      amountInBracket,
      tax: round2(amountInBracket * b.ratePercent / 100),
    })
    if (taxableIncome <= upper) break
  }
  return out
}

/**
 * The exemption implied by the bracket table: the top of the leading 0% band.
 *
 * This is the single source of truth for the exemption, because it is what the
 * tax calculation actually uses. The `monthly_exemption` parameter is the
 * operator's stated intent; when the two disagree, the parameter is wrong and
 * the settings UI says so rather than letting a silent double-exemption or a
 * silently ignored edit survive.
 */
export function exemptionFromBrackets(brackets: TaxBracket[]): number {
  const sorted = [...brackets].sort((a, b) => a.fromAmount - b.fromAmount)
  let exempt = 0
  for (const b of sorted) {
    if (b.ratePercent !== 0) break
    exempt = b.toAmount ?? exempt
  }
  return exempt
}

/** Does the stated exemption parameter agree with the bracket table? */
export function exemptionMismatch(
  brackets: TaxBracket[], params: PayrollParameter[],
): { stated: number; effective: number } | null {
  if (!hasParam(params, 'monthly_exemption')) return null
  const stated = param(params, 'monthly_exemption', 0)
  const effective = exemptionFromBrackets(brackets)
  return Math.abs(stated - effective) < 0.01 ? null : { stated, effective }
}

export function progressiveTax(taxableIncome: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0
  return round2(taxBreakdown(taxableIncome, brackets).reduce((s, r) => s + r.tax, 0))
}

// ── inclusion caps ──────────────────────────────────────────────────────────

/**
 * How much of an amount counts towards a base.
 *
 * `capped` is the case that matters: an allowance may be exempt only up to a
 * ceiling, with the excess counting. Expressing that as data is why the flag has
 * three states rather than a boolean.
 */
export function includedAmount(amount: number, mode: Inclusion, cap: number | null): number {
  if (mode === 'no') return 0
  if (mode === 'capped' && cap != null) return round2(Math.min(amount, cap))
  return round2(amount)
}

// ── insurance base ──────────────────────────────────────────────────────────

/**
 * The insurance base, with the statutory floor and ceiling applied.
 *
 * The ceiling is stored as a FACTOR of the daily minimum wage rather than a
 * fixed number, so raising the minimum wage moves the ceiling automatically —
 * one edit instead of two, and no chance of updating one and forgetting the
 * other.
 */
export function insuranceBaseOf(
  insurableEarnings: number,
  opts: { minWageDaily: number; maxBaseFactor: number; daysInMonth: number; workedDays: number },
): number {
  const { minWageDaily, maxBaseFactor, daysInMonth, workedDays } = opts
  const ceiling = minWageDaily * maxBaseFactor * daysInMonth
  // The floor is prorated: someone who worked half a month is not insured on a
  // full month's minimum wage.
  const proration = daysInMonth > 0 ? Math.min(1, workedDays / daysInMonth) : 1
  const floor = minWageDaily * daysInMonth * proration

  if (ceiling > 0 && insurableEarnings > ceiling) return round2(ceiling)
  if (floor > 0 && insurableEarnings < floor) return round2(floor)
  return round2(insurableEarnings)
}

/** Round the net according to company policy; 0 means no rounding. */
export function applyRounding(amount: number, step: number): number {
  if (step <= 0) return round2(amount)
  return Math.round(amount / step) * step
}

// ── earning construction ────────────────────────────────────────────────────

/**
 * Resolve one earning type into an amount for this employee and month.
 *
 * The methods are deliberately few and declarative. Anything that cannot be
 * expressed as one of them is `manual` — an amount the operator enters — which
 * is honest: an engine that guessed would be worse than one that asks.
 */
export function earningAmount(
  type: EarningType,
  ctx: {
    baseSalary: number
    params: PayrollParameter[]
    worked: WorkedTime
    employee: SlipEmployee
    manual: ManualEarnings
  },
): number {
  const { baseSalary, params, worked, employee, manual } = ctx
  const proration = worked.daysInMonth > 0 ? Math.min(1, worked.workedDays / worked.daysInMonth) : 1
  const configured = type.paramKey ? param(params, type.paramKey, 0) : type.calcValue

  switch (type.calcMethod) {
    case 'fixed':
      // The marriage allowance is only payable to a married employee; that is a
      // property of the employee, not a rate, so it stays in code.
      if (type.key === 'marriage' && !employee.married) return 0
      return round2(configured)

    case 'percent_of_base':
      return round2(baseSalary * configured / 100)

    case 'daily_prorated': {
      const full = type.key === 'base_salary' ? baseSalary : configured
      return round2(full * proration)
    }

    case 'per_child':
      return round2(configured * Math.max(0, employee.childrenCount))

    case 'manual':
      return round2(manual[type.key] ?? 0)
  }
}

/**
 * Overtime-family earnings, each with its own configurable factor.
 *
 * The mapping from an earning key to the hours worked and the factor parameter
 * is structural (which bucket of hours feeds which line), not statutory — the
 * factors themselves are all parameters.
 */
const OVERTIME_SOURCES: Record<string, { hours: keyof WorkedTime; factorKey: string }> = {
  overtime:     { hours: 'overtimeHours',     factorKey: 'overtime_factor' },
  holiday_work: { hours: 'holidayWorkHours',  factorKey: 'holiday_overtime_factor' },
  friday_work:  { hours: 'fridayWorkHours',   factorKey: 'friday_factor' },
  night_shift:  { hours: 'nightShiftHours',   factorKey: 'night_shift_factor' },
  shift_work:   { hours: 'shiftWorkHours',    factorKey: 'shift_factor' },
}

export function overtimeEarning(
  key: string, hourly: number, worked: WorkedTime, params: PayrollParameter[],
): number | null {
  const src = OVERTIME_SOURCES[key]
  if (!src) return null
  const hours = Number(worked[src.hours] ?? 0)
  if (hours <= 0) return 0
  return round2(hours * hourly * param(params, src.factorKey, 1))
}

// ── the calculation ─────────────────────────────────────────────────────────

export interface CalculateInput {
  employee: SlipEmployee
  employment: SlipEmployment
  worked: WorkedTime
  loans: LoanInstallment[]
  params: PayrollParameter[]
  brackets: TaxBracket[]
  earningTypes: EarningType[]
  manual?: ManualEarnings
  otherDeductions?: { key: string; labelFa: string; labelEn: string; amount: number }[]
}

/**
 * Build a payslip.
 *
 * The order matters and follows the law: earnings → insurance base (floored and
 * capped) → employee insurance → taxable income (earnings less employee
 * insurance less exemption) → progressive tax → deductions → net.
 *
 * Every figure lands in `lines` with its own insurable/taxable flags, so an
 * operator can trace any number back to the rule that produced it rather than
 * having to trust the total.
 */
export function calculateSlip(input: CalculateInput): SlipResult {
  const { employee, employment, worked, loans, params, brackets, earningTypes } = input
  const manual = input.manual ?? {}

  const daysInMonth = worked.daysInMonth > 0 ? worked.daysInMonth : 30
  const perDay = dailyWage(employment.baseSalary, daysInMonth)
  const hourly = hourlyWage(perDay, param(params, 'daily_work_hours', 0))

  const lines: SlipLine[] = []
  const active = [...earningTypes].sort((a, b) => a.sortOrder - b.sortOrder)

  for (const t of active) {
    const overtime = overtimeEarning(t.key, hourly, worked, params)
    const amount = overtime !== null
      ? overtime
      : earningAmount(t, { baseSalary: employment.baseSalary, params, worked, employee, manual })
    if (amount <= 0) continue
    lines.push({
      lineType: 'earning', key: t.key, labelFa: t.labelFa, labelEn: t.labelEn,
      amount, insurable: t.insurable !== 'no', taxable: t.taxable !== 'no', sortOrder: t.sortOrder,
    })
  }

  const byKey = new Map(active.map(t => [t.key, t]))
  const earnings = lines.filter(l => l.lineType === 'earning')
  const gross = round2(earnings.reduce((s, l) => s + l.amount, 0))

  // Bases: each earning contributes only what its own flags allow.
  const insurableEarnings = round2(earnings.reduce((s, l) => {
    const t = byKey.get(l.key)!
    return s + includedAmount(l.amount, t.insurable, t.insurableCap)
  }, 0))
  const taxableEarnings = round2(earnings.reduce((s, l) => {
    const t = byKey.get(l.key)!
    return s + includedAmount(l.amount, t.taxable, t.taxableCap)
  }, 0))

  // 28.3-ب will need these; the flags that define them live here, so they are
  // computed here rather than re-derived later from a different source.
  const eidBase = round2(earnings.reduce((s, l) =>
    s + (byKey.get(l.key)!.inEidBase ? l.amount : 0), 0))
  const severanceBase = round2(earnings.reduce((s, l) =>
    s + (byKey.get(l.key)!.inSeveranceBase ? l.amount : 0), 0))

  const insuranceBase = insuranceBaseOf(insurableEarnings, {
    minWageDaily: param(params, 'min_wage_daily', 0),
    maxBaseFactor: param(params, 'max_base_factor', 0),
    daysInMonth,
    workedDays: worked.workedDays,
  })

  const employeeInsurance = round2(insuranceBase * param(params, 'employee_rate', 0) / 100)
  const employerInsurance = round2(insuranceBase * param(params, 'employer_rate', 0) / 100)
  const unemploymentInsurance = round2(insuranceBase * param(params, 'unemployment_rate', 0) / 100)

  // The employer's share is a COMPANY COST, not a deduction from the employee.
  // Recording it on the slip as a separate line type is what keeps it out of the
  // net while still reaching the GL.
  if (employerInsurance > 0) {
    lines.push({
      lineType: 'employer_cost', key: 'employer_insurance',
      labelFa: 'بیمهٔ سهم کارفرما', labelEn: 'Employer insurance',
      amount: employerInsurance, insurable: false, taxable: false, sortOrder: 90,
    })
  }
  if (unemploymentInsurance > 0) {
    lines.push({
      lineType: 'employer_cost', key: 'unemployment_insurance',
      labelFa: 'بیمهٔ بیکاری (سهم کارفرما)', labelEn: 'Unemployment insurance',
      amount: unemploymentInsurance, insurable: false, taxable: false, sortOrder: 91,
    })
  }

  // 🔴 The exemption is NOT subtracted here. It is already the first,
  // zero-rate band of the bracket table, so subtracting it as well would exempt
  // it twice — an error worth tens of millions per slip and completely silent.
  // `monthly_exemption` therefore exists to be DISPLAYED and cross-checked
  // (see `exemptionFromBrackets`), never applied a second time.
  const taxableIncome = Math.max(0, round2(taxableEarnings - employeeInsurance))
  const tax = progressiveTax(taxableIncome, brackets)

  if (employeeInsurance > 0) {
    lines.push({
      lineType: 'deduction', key: 'employee_insurance',
      labelFa: 'بیمهٔ سهم کارمند', labelEn: 'Employee insurance',
      amount: employeeInsurance, insurable: false, taxable: false, sortOrder: 100,
    })
  }
  if (tax > 0) {
    lines.push({
      lineType: 'deduction', key: 'tax',
      labelFa: 'مالیات حقوق', labelEn: 'Payroll tax',
      amount: tax, insurable: false, taxable: false, sortOrder: 101,
    })
  }

  // Absence is deducted only when company policy says so — it is a policy, not
  // a statutory requirement, so it is a parameter like everything else.
  if (param(params, 'absence_deduction_enabled', 0) === 1 && worked.absenceDays > 0) {
    const amount = round2(perDay * worked.absenceDays)
    if (amount > 0) {
      lines.push({
        lineType: 'deduction', key: 'absence',
        labelFa: 'کسر غیبت', labelEn: 'Absence deduction',
        amount, insurable: false, taxable: false, sortOrder: 102,
      })
    }
  }
  if (param(params, 'late_deduction_enabled', 0) === 1 && worked.lateMinutes > 0) {
    const amount = round2(hourly * worked.lateMinutes / 60)
    if (amount > 0) {
      lines.push({
        lineType: 'deduction', key: 'lateness',
        labelFa: 'کسر تأخیر', labelEn: 'Lateness deduction',
        amount, insurable: false, taxable: false, sortOrder: 103,
      })
    }
  }
  if (worked.unpaidLeaveDays > 0) {
    const amount = round2(perDay * worked.unpaidLeaveDays)
    if (amount > 0) {
      lines.push({
        lineType: 'deduction', key: 'unpaid_leave',
        labelFa: 'مرخصی بدون حقوق', labelEn: 'Unpaid leave',
        amount, insurable: false, taxable: false, sortOrder: 104,
      })
    }
  }

  const loanTotal = round2(loans.reduce((s, l) => s + l.amount, 0))
  if (loanTotal > 0) {
    lines.push({
      lineType: 'deduction', key: 'loan',
      labelFa: 'قسط وام', labelEn: 'Loan installment',
      amount: loanTotal, insurable: false, taxable: false, sortOrder: 105,
    })
  }
  for (const d of input.otherDeductions ?? []) {
    if (d.amount > 0) {
      lines.push({
        lineType: 'deduction', key: d.key, labelFa: d.labelFa, labelEn: d.labelEn,
        amount: round2(d.amount), insurable: false, taxable: false, sortOrder: 110,
      })
    }
  }

  // 🔴 Rounding creates a REAL difference and it has to go somewhere.
  //
  // Rounding the net silently makes the payslip stop adding up (gross − deductions
  // ≠ net) and, worse, unbalances the journal entry by the rounded-away amount:
  // the gross is expensed in full while the credits fall short. So the difference
  // becomes its own visible line. It is still owed to the employee — it is not
  // income to the company — so it stays inside what is payable.
  const beforeRounding = round2(lines.filter(l => l.lineType === 'deduction').reduce((s, l) => s + l.amount, 0))
  const rawNet = round2(gross - beforeRounding)
  const net = applyRounding(rawNet, param(params, 'rounding', 0))
  const roundingDiff = round2(rawNet - net)
  if (roundingDiff !== 0) {
    // Negative when the policy rounds UP — then the employee receives slightly
    // more and the line is a negative deduction, which is honest rather than tidy.
    lines.push({
      lineType: 'deduction', key: 'rounding',
      labelFa: 'تعدیل گرد کردن', labelEn: 'Rounding adjustment',
      amount: roundingDiff, insurable: false, taxable: false, sortOrder: 120,
    })
  }
  const deductions = round2(lines.filter(l => l.lineType === 'deduction').reduce((s, l) => s + l.amount, 0))

  return {
    lines: lines.sort((a, b) => a.sortOrder - b.sortOrder),
    gross, insuranceBase, employeeInsurance, employerInsurance, unemploymentInsurance,
    taxableIncome, tax, deductions, net: round2(net), eidBase, severanceBase,
  }
}

// ── period lifecycle ────────────────────────────────────────────────────────

export const PERIOD_STATUSES = ['open', 'calculated', 'approved', 'paid', 'locked'] as const
export type PeriodStatus = typeof PERIOD_STATUSES[number]

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, { en: string; fa: string }> = {
  open:       { en: 'Open',       fa: 'باز' },
  calculated: { en: 'Calculated', fa: 'محاسبه‌شده' },
  approved:   { en: 'Approved',   fa: 'تأییدشده' },
  paid:       { en: 'Paid',       fa: 'پرداخت‌شده' },
  locked:     { en: 'Locked',     fa: 'قفل‌شده' },
}

const PERIOD_TRANSITIONS: Record<PeriodStatus, PeriodStatus[]> = {
  open: ['calculated'],
  calculated: ['open', 'calculated', 'approved'],   // recalculating stays here
  approved: ['paid'],
  paid: ['locked'],
  locked: [],
}

export function canTransitionPeriod(from: PeriodStatus, to: PeriodStatus): boolean {
  return PERIOD_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Can this period still be calculated?
 *
 * Once approved, no. A correction to an approved period is a CORRECTION SLIP —
 * a reversal plus a new slip — never a recalculation in place. Recalculating
 * would silently change a figure that has already been reported to the tax
 * authority and posted to the ledger.
 */
export function isRecalculable(status: PeriodStatus): boolean {
  return status === 'open' || status === 'calculated'
}

export const JALALI_MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const

export const JALALI_MONTHS_EN = [
  'Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand',
] as const

/** Days in a Jalali month: 31 for months 1–6, 30 for 7–11, 29/30 for Esfand. */
export function jalaliMonthLength(jYear: number, jMonth: number): number {
  if (jMonth <= 6) return 31
  if (jMonth <= 11) return 30
  // Esfand: 30 in a leap year. The 33-year cycle remainders that are leap.
  const r = jYear % 33
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(r) ? 30 : 29
}

// ── GL posting lines ────────────────────────────────────────────────────────

export interface PayrollPostingLine {
  accountCode: string
  debit: number
  credit: number
  memo: string
}

/**
 * The period's journal entry.
 *
 * Dr payroll expense (gross) + Dr employer-insurance expense
 * Cr salaries payable (net) + Cr insurance payable (employee + employer share)
 *   + Cr tax payable + Cr loan receivable
 *
 * The loan instalment credits the RECEIVABLE rather than income: the company is
 * being repaid, it is not earning. Getting that leg wrong overstates revenue by
 * the whole loan book.
 */
export function payrollPostingLines(totals: {
  gross: number
  employeeInsurance: number
  employerInsurance: number
  unemploymentInsurance: number
  tax: number
  loanRepayment: number
  otherDeductions: number
  net: number
}): PayrollPostingLine[] {
  const employerCost = round2(totals.employerInsurance + totals.unemploymentInsurance)
  const lines: PayrollPostingLine[] = [
    { accountCode: '6100', debit: round2(totals.gross), credit: 0, memo: 'هزینهٔ حقوق و دستمزد' },
  ]
  if (employerCost > 0) {
    lines.push({ accountCode: '6110', debit: employerCost, credit: 0, memo: 'هزینهٔ بیمهٔ سهم کارفرما' })
  }
  const insurancePayable = round2(totals.employeeInsurance + employerCost)
  if (insurancePayable > 0) {
    lines.push({ accountCode: '2310', debit: 0, credit: insurancePayable, memo: 'بیمه پرداختنی' })
  }
  if (totals.tax > 0) {
    lines.push({ accountCode: '2320', debit: 0, credit: round2(totals.tax), memo: 'مالیات حقوق پرداختنی' })
  }
  if (totals.loanRepayment > 0) {
    lines.push({ accountCode: '1160', debit: 0, credit: round2(totals.loanRepayment), memo: 'بازپرداخت وام کارکنان' })
  }
  // Anything else withheld stays payable to the company; folding it into the net
  // would understate what is owed to employees.
  const payable = round2(totals.net + totals.otherDeductions)
  if (payable > 0) {
    lines.push({ accountCode: '2300', debit: 0, credit: payable, memo: 'حقوق پرداختنی' })
  }
  return lines
}

export function postingBalanced(lines: PayrollPostingLine[]): boolean {
  const dr = round2(lines.reduce((s, l) => s + l.debit, 0))
  const cr = round2(lines.reduce((s, l) => s + l.credit, 0))
  return Math.abs(dr - cr) < 0.01
}
