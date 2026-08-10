/**
 * Phase 28.3-ب — annual entitlements: Eid bonus, severance and final settlement.
 *
 * 🔴 The distinction this module exists to keep straight:
 *
 *   **پایهٔ سنوات** (`seniority_base`) is a MONTHLY earning — a recurring
 *   allowance added to pay every month. It lives in `payroll_earning_types`
 *   and is handled entirely by 28.3-الف. It is NOT calculated here.
 *
 *   **سنوات پایان خدمت** (severance) is a TERMINATION benefit — one month's
 *   pay for each year of service, paid when someone leaves. That is what
 *   `calculateSeverance` below computes.
 *
 * They share a Persian word and nothing else. Conflating them is the one error
 * in this area that stays invisible for years: the monthly figure looks right,
 * nobody checks the termination figure until someone actually leaves, and by
 * then the company has either underpaid years of staff or over-accrued a
 * liability. The type system is used to keep them apart — `SeveranceInput`
 * takes a DAILY base and a service span, and cannot be fed a monthly allowance
 * by accident.
 *
 * As in 28.3-الف, there is no statutory number in this file. Days per year, the
 * Eid floor and ceiling, the base policy and the encashment cap all arrive as
 * arguments.
 */
import { param, type PayrollParameter } from './payroll'

const round2 = (n: number) => Math.round(n * 100) / 100

// ── service time ────────────────────────────────────────────────────────────

/** Whole days between two ISO dates, inclusive of both ends. */
export function serviceDaysBetween(from: string, to: string): number {
  if (!from || !to) return 0
  const a = Date.UTC(...(from.slice(0, 10).split('-').map(Number) as [number, number, number]))
  const b = Date.UTC(...(to.slice(0, 10).split('-').map(Number) as [number, number, number]))
  const start = new Date(a), end = new Date(b)
  start.setUTCMonth(start.getUTCMonth() - 0)
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  return diff > 0 ? diff : 0
}

/** Overlap in days between a service span and a bounded window. */
export function serviceDaysWithin(
  hireDate: string, endDate: string | null,
  windowFrom: string, windowTo: string,
): number {
  const from = hireDate > windowFrom ? hireDate : windowFrom
  const to = endDate && endDate < windowTo ? endDate : windowTo
  return serviceDaysBetween(from, to)
}

/** Years of service as a decimal — 3 years 7 months reads as ~3.6. */
export function serviceYearsOf(days: number, daysInYear = 365): number {
  if (days <= 0 || daysInYear <= 0) return 0
  return round2(days / daysInYear)
}

// ── Eid bonus (عیدی) ────────────────────────────────────────────────────────

export interface EidInput {
  /** Days actually served inside the year — drives the pro-rata. */
  serviceDays: number
  daysInYear: number
  /**
   * Monthly base: the sum of RECURRING earnings flagged `in_eid_base` on the
   * employee's slips. Supplied by the caller from the 28.3-الف flags, never
   * guessed here.
   */
  monthlyBase: number
  minWageDaily: number
  params: PayrollParameter[]
}

export interface EidResult {
  serviceDays: number
  /** Full-year entitlement before pro-rata and before the floor/ceiling. */
  fullYear: number
  prorated: number
  floor: number
  ceiling: number
  /** Which limit bit, if any — so the operator can see WHY the figure moved. */
  limitApplied: 'floor' | 'ceiling' | null
  amount: number
  taxableAmount: number
  tax: number
  net: number
}

/**
 * Eid bonus.
 *
 * Shape: N days of the employee's own monthly pay, pro-rated by service inside
 * the year, then clamped between a floor and a ceiling both expressed in days
 * of the MINIMUM WAGE (not of the employee's own pay). Every one of those
 * numbers is a parameter.
 *
 * The pro-rata is what makes a mid-year hire or a mid-year leaver correct;
 * without it a January starter and a December starter would receive the same
 * bonus.
 */
export function calculateEid(input: EidInput, taxOf: (taxable: number) => number): EidResult {
  const { serviceDays, daysInYear, monthlyBase, minWageDaily, params } = input
  const eidDays = param(params, 'eid_days', 0)
  const minDays = param(params, 'eid_min_days_of_min_wage', 0)
  const maxDays = param(params, 'eid_max_days_of_min_wage', 0)

  const dailyOwnPay = daysInYear > 0 && monthlyBase > 0 ? monthlyBase / 30 : 0
  const fullYear = round2(dailyOwnPay * eidDays)

  const ratio = daysInYear > 0 ? Math.min(1, Math.max(0, serviceDays / daysInYear)) : 0
  const prorated = round2(fullYear * ratio)

  // The floor and ceiling are pro-rated too: someone who worked three months is
  // entitled to a quarter of the minimum, not to the whole of it.
  const floor = round2(minWageDaily * minDays * ratio)
  const ceiling = round2(minWageDaily * maxDays * ratio)

  let amount = prorated
  let limitApplied: EidResult['limitApplied'] = null
  if (ceiling > 0 && amount > ceiling) { amount = ceiling; limitApplied = 'ceiling' }
  else if (floor > 0 && amount < floor) { amount = floor; limitApplied = 'floor' }

  const exempt = param(params, 'eid_tax_exempt_amount', 0)
  const taxableAmount = Math.max(0, round2(amount - exempt))
  const tax = round2(taxOf(taxableAmount))

  return {
    serviceDays, fullYear, prorated, floor, ceiling, limitApplied,
    amount: round2(amount), taxableAmount, tax, net: round2(amount - tax),
  }
}

// ── severance (سنوات پایان خدمت) ────────────────────────────────────────────

export type SeveranceBasePolicy = 'last' | 'average'

export function severanceBasePolicyOf(params: PayrollParameter[]): SeveranceBasePolicy {
  return param(params, 'severance_base_policy', 0) === 1 ? 'average' : 'last'
}

/**
 * The DAILY base for severance.
 *
 * Deliberately takes daily figures, not a monthly salary: the whole point of
 * the split from `seniority_base` is that this quantity is a *rate of pay at
 * termination*, derived from the earnings flagged `in_severance_base`.
 */
export function severanceDailyBase(
  policy: SeveranceBasePolicy,
  lastMonthBase: number,
  recentMonthBases: number[],
): number {
  if (policy === 'average' && recentMonthBases.length > 0) {
    const avg = recentMonthBases.reduce((s, n) => s + n, 0) / recentMonthBases.length
    return round2(avg / 30)
  }
  return round2(lastMonthBase / 30)
}

export interface SeveranceInput {
  /** Total days served — read from the append-only employment history (28.1). */
  serviceDays: number
  /** Pay per DAY at termination (see `severanceDailyBase`). */
  dailyBase: number
  daysPerYear: number
  daysInYear?: number
}

export interface SeveranceResult {
  serviceDays: number
  serviceYears: number
  dailyBase: number
  daysPerYear: number
  /** Entitlement in days — the pro-rata for a partial year is included. */
  entitlementDays: number
  amount: number
}

/**
 * Severance at termination.
 *
 * Pro-rated continuously rather than by whole years: three years and seven
 * months earns three years and seven months of entitlement, not three. Rounding
 * down to whole years is a common shortcut and it silently underpays every
 * leaver who did not depart on their anniversary.
 */
export function calculateSeverance(input: SeveranceInput): SeveranceResult {
  const { serviceDays, dailyBase, daysPerYear } = input
  const daysInYear = input.daysInYear ?? 365
  const years = serviceYearsOf(serviceDays, daysInYear)
  const entitlementDays = round2(years * daysPerYear)
  return {
    serviceDays, serviceYears: years, dailyBase, daysPerYear,
    entitlementDays, amount: round2(entitlementDays * dailyBase),
  }
}

/**
 * The monthly provision for one employee.
 *
 * Recognising the liability as it accrues is the accounting-correct treatment,
 * but whether to do it is a policy decision (and affects the tax position), so
 * it is OFF by default and the operator turns it on with their accountant.
 */
export function monthlySeveranceAccrual(
  dailyBase: number, daysPerYear: number, monthDays: number, daysInYear = 365,
): number {
  if (daysInYear <= 0) return 0
  return round2(dailyBase * daysPerYear * (monthDays / daysInYear))
}

// ── leave encashment ────────────────────────────────────────────────────────

export interface EncashmentResult { days: number; capped: boolean; amount: number }

/**
 * Unused leave paid out at termination, read from the 28.2 balance ledger.
 *
 * A NEGATIVE balance (someone took more than they had accrued) is honoured as a
 * negative amount rather than floored at zero — it is a real debt to the
 * company, and hiding it would quietly gift it away. The cap applies only to
 * what is paid out, never to what is owed back.
 */
export function leaveEncashment(
  balanceDays: number, dailyBase: number, maxDays: number, enabled: boolean,
): EncashmentResult {
  if (!enabled) return { days: 0, capped: false, amount: 0 }
  if (balanceDays < 0) {
    return { days: round2(balanceDays), capped: false, amount: round2(balanceDays * dailyBase) }
  }
  const capped = maxDays > 0 && balanceDays > maxDays
  const days = capped ? maxDays : round2(balanceDays)
  return { days, capped, amount: round2(days * dailyBase) }
}

// ── final settlement ────────────────────────────────────────────────────────

export interface SettlementInput {
  finalPay: number
  severance: number
  eid: number
  leaveEncashment: number
  loanOutstanding: number
  otherDeductions: number
}

export interface SettlementResult extends SettlementInput {
  additions: number
  deductions: number
  total: number
  /** True when the employee owes the company — the operator must see this. */
  employeeOwes: boolean
}

/**
 * The termination settlement.
 *
 * A total that comes out NEGATIVE is shown as negative, not clamped: it means
 * the outstanding loan exceeds what is owed, which is a real balance somebody
 * has to collect. Clamping it to zero would write off the difference silently
 * — the 26.26 BUG-013 lesson applied to payroll.
 */
export function calculateSettlement(input: SettlementInput): SettlementResult {
  const additions = round2(input.finalPay + input.severance + input.eid + input.leaveEncashment)
  const deductions = round2(input.loanOutstanding + input.otherDeductions)
  const total = round2(additions - deductions)
  return { ...input, additions, deductions, total, employeeOwes: total < 0 }
}

// ── GL posting ──────────────────────────────────────────────────────────────

export interface AnnualPostingLine {
  accountCode: string
  debit: number
  credit: number
  memo: string
}

const balanced = (lines: AnnualPostingLine[]) => {
  const dr = round2(lines.reduce((s, l) => s + l.debit, 0))
  const cr = round2(lines.reduce((s, l) => s + l.credit, 0))
  return Math.abs(dr - cr) < 0.01
}
export const annualPostingBalanced = balanced

/** Eid: Dr expense / Cr payable + Cr tax payable. */
export function eidPostingLines(t: { amount: number; tax: number; net: number }): AnnualPostingLine[] {
  const lines: AnnualPostingLine[] = [
    { accountCode: '6120', debit: round2(t.amount), credit: 0, memo: 'هزینهٔ عیدی' },
  ]
  if (t.tax > 0) lines.push({ accountCode: '2320', debit: 0, credit: round2(t.tax), memo: 'مالیات عیدی' })
  if (t.net > 0) lines.push({ accountCode: '2330', debit: 0, credit: round2(t.net), memo: 'عیدی پرداختنی' })
  return lines
}

/**
 * Severance: Dr expense (only the part not already provisioned) / Cr payable.
 *
 * When a provision has been accruing, the expense was already recognised month
 * by month; charging the whole amount again at termination would double-count
 * it. So the provision already carried is released and only the shortfall hits
 * the expense.
 */
export function severancePostingLines(t: { amount: number; accruedBefore: number }): AnnualPostingLine[] {
  const release = Math.min(t.accruedBefore, t.amount)
  const expense = round2(t.amount - release)
  const lines: AnnualPostingLine[] = []
  if (expense > 0) lines.push({ accountCode: '6130', debit: expense, credit: 0, memo: 'هزینهٔ سنوات' })
  if (release > 0) lines.push({ accountCode: '2340', debit: round2(release), credit: 0, memo: 'آزادسازی ذخیرهٔ سنوات' })
  if (t.amount > 0) lines.push({ accountCode: '2300', debit: 0, credit: round2(t.amount), memo: 'سنوات پرداختنی' })
  return lines
}

/** Monthly provision: Dr expense / Cr provision. */
export function severanceAccrualPostingLines(amount: number): AnnualPostingLine[] {
  if (amount <= 0) return []
  return [
    { accountCode: '6130', debit: round2(amount), credit: 0, memo: 'هزینهٔ سنوات (ذخیرهٔ ماهانه)' },
    { accountCode: '2340', debit: 0, credit: round2(amount), memo: 'ذخیرهٔ سنوات' },
  ]
}

/**
 * Settlement: recognise leave encashment as expense, clear the loan receivable,
 * and credit what remains payable to the leaver.
 *
 * Severance and Eid are NOT re-expensed here — they were posted by their own
 * entries. This entry only moves what is left.
 */
export function settlementPostingLines(t: {
  leaveEncashment: number
  loanOutstanding: number
  otherDeductions: number
  total: number
}): AnnualPostingLine[] {
  const lines: AnnualPostingLine[] = []
  if (t.leaveEncashment !== 0) {
    lines.push({
      accountCode: '6100',
      debit: t.leaveEncashment > 0 ? round2(t.leaveEncashment) : 0,
      credit: t.leaveEncashment < 0 ? round2(-t.leaveEncashment) : 0,
      memo: 'بازخرید مرخصی استفاده‌نشده',
    })
  }
  if (t.loanOutstanding > 0) {
    lines.push({ accountCode: '1160', debit: 0, credit: round2(t.loanOutstanding), memo: 'تسویهٔ وام کارکنان' })
  }
  if (t.otherDeductions > 0) {
    lines.push({ accountCode: '2300', debit: 0, credit: round2(t.otherDeductions), memo: 'سایر کسورات تسویه' })
  }
  // The balancing leg against salaries payable: positive when the company owes
  // the leaver, negative (a debit) when the leaver owes the company.
  const dr = lines.reduce((s, l) => s + l.debit, 0)
  const cr = lines.reduce((s, l) => s + l.credit, 0)
  const diff = round2(dr - cr)
  if (Math.abs(diff) >= 0.01) {
    lines.push({
      accountCode: '2300',
      debit: diff < 0 ? round2(-diff) : 0,
      credit: diff > 0 ? diff : 0,
      memo: 'تسویه‌حساب پایان خدمت',
    })
  }
  return lines
}

// ── 🔴 sick leave pay split (28.3-ج بند۴.۱) ─────────────────────────────────

export interface SickLeaveSplit {
  days: number
  employerDays: number
  employerAmount: number
  insuranceDays: number
  insuranceAmount: number
}

/**
 * Split a sick-leave span between the employer and social security.
 *
 * The first `employerThresholdDays` are the employer's own cost (paid as
 * ordinary salary — they never leave the payslip); the remainder is a claim
 * against social security, tracked here as a receivable/notional figure rather
 * than deducted from the employee, because the organisation still advances it
 * and later claims it back. 🔴 The threshold and the daily rate are parameters
 * — never a number compiled into this function.
 */
export function splitSickLeave(
  days: number, dailyBase: number,
  opts: { employerThresholdDays: number; insuranceRatePercent: number },
): SickLeaveSplit {
  const employerDays = Math.min(days, Math.max(0, opts.employerThresholdDays))
  const insuranceDays = Math.max(0, days - employerDays)
  return {
    days,
    employerDays, employerAmount: round2(employerDays * dailyBase),
    insuranceDays, insuranceAmount: round2(insuranceDays * dailyBase * opts.insuranceRatePercent / 100),
  }
}

// ── 🔴 bank payment (28.3-ج بند۱) ───────────────────────────────────────────

/**
 * Iranian IBAN check digit (mod-97), on top of the IR+24-digit shape already
 * validated by `isValidIban` in `employees.ts`.
 *
 * The format check alone accepts a transposed digit; the check digit is what
 * actually catches it BEFORE a wrong account is paid. IBAN → move the four
 * check characters to the end, convert letters to numbers (A=10…Z=35), and
 * the whole number mod 97 must equal 1.
 */
export function ibanCheckDigitValid(iban: string): boolean {
  const clean = iban.replace(/[\s-]/g, '').toUpperCase()
  if (!/^IR\d{24}$/.test(clean)) return false
  const rearranged = clean.slice(4) + clean.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55))
  // mod 97 over a very long digit string, done in chunks to stay within safe
  // integer range — the standard iterative-mod algorithm for IBAN validation.
  let remainder = 0
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97
  return remainder === 1
}

export interface BankLineInput {
  employeeId: number
  employeeName: string
  iban: string | null
  amount: number
}

export interface BankLineCheck {
  employeeId: number
  employeeName: string
  ok: boolean
  reason?: 'missing_iban' | 'invalid_iban' | 'non_positive_amount' | 'duplicate_employee'
}

/**
 * Validate a batch's lines before a file is generated.
 *
 * 🔴 An employee with no IBAN, or an invalid one, is a REFUSAL naming them —
 * never a silent drop from the file. Someone who is silently missing from a
 * payment file does not get paid and nobody notices until they ask.
 */
export function validateBankLines(lines: BankLineInput[]): BankLineCheck[] {
  const seen = new Set<number>()
  return lines.map(l => {
    if (seen.has(l.employeeId)) {
      return { employeeId: l.employeeId, employeeName: l.employeeName, ok: false, reason: 'duplicate_employee' }
    }
    seen.add(l.employeeId)
    if (l.amount <= 0) {
      return { employeeId: l.employeeId, employeeName: l.employeeName, ok: false, reason: 'non_positive_amount' }
    }
    if (!l.iban) {
      return { employeeId: l.employeeId, employeeName: l.employeeName, ok: false, reason: 'missing_iban' }
    }
    if (!ibanCheckDigitValid(l.iban)) {
      return { employeeId: l.employeeId, employeeName: l.employeeName, ok: false, reason: 'invalid_iban' }
    }
    return { employeeId: l.employeeId, employeeName: l.employeeName, ok: true }
  })
}

export const BANK_LINE_REFUSAL_LABELS: Record<NonNullable<BankLineCheck['reason']>, { en: string; fa: string }> = {
  missing_iban: { en: 'No IBAN on file', fa: 'شبا ثبت نشده است' },
  invalid_iban: { en: 'Invalid IBAN (check digit fails)', fa: 'شبا نامعتبر است (رقم کنترلی نادرست)' },
  non_positive_amount: { en: 'Non-positive amount', fa: 'مبلغ نامعتبر است' },
  duplicate_employee: { en: 'Employee appears twice in the batch', fa: 'کارمند دوبار در دسته آمده است' },
}

/** Settling the bank batch: Dr salaries payable / Cr bank. */
export function bankBatchPostingLines(totalAmount: number, bankAccountCode: string): AnnualPostingLine[] {
  if (totalAmount <= 0) return []
  return [
    { accountCode: '2300', debit: round2(totalAmount), credit: 0, memo: 'تسویهٔ حقوق پرداختنی از طریق بانک' },
    { accountCode: bankAccountCode, debit: 0, credit: round2(totalAmount), memo: 'پرداخت حقوق' },
  ]
}

// ── 🔴 advances — NOT loans (28.3-ج بند۲) ───────────────────────────────────

/**
 * An advance's cap: a percentage of monthly salary, company policy.
 *
 * Unlike a loan, an advance is a single lump sum against ONE upcoming
 * deduction — no instalment schedule — which is why it is a separate model
 * rather than a loan with `installments: 1`.
 */
export function advanceCap(monthlySalary: number, maxPercent: number): number {
  if (monthlySalary <= 0 || maxPercent <= 0) return 0
  return round2(monthlySalary * maxPercent / 100)
}

export interface AdvanceCheck { ok: boolean; cap: number; reason?: 'exceeds_cap' }

export function checkAdvance(amount: number, monthlySalary: number, maxPercent: number): AdvanceCheck {
  const cap = advanceCap(monthlySalary, maxPercent)
  if (cap > 0 && amount > cap) return { ok: false, cap, reason: 'exceeds_cap' }
  return { ok: true, cap }
}

/**
 * 🔴 An advance larger than the net pay it will be deducted from is a WARNING,
 * never a negative net. The slip engine (28.3-الف) already refuses to let
 * total deductions exceed what is being paid out for any single item; this is
 * the advance-specific check surfaced BEFORE the deduction is scheduled, so
 * the operator sees it while there is still a chance to phase it differently.
 */
export function advanceExceedsNet(advanceAmount: number, projectedNet: number): boolean {
  return advanceAmount > projectedNet && projectedNet >= 0
}

// ── legal exports ───────────────────────────────────────────────────────────

export interface ExportColumn { key: string; labelFa: string; labelEn?: string }

/** RFC-4180 escaping for one field. */
export function csvField(value: unknown, delimiter: string): string {
  const s = value == null ? '' : String(value)
  if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Render an export from a configurable column layout.
 *
 * The layout is data because the exact column order of the social-security and
 * tax files can change; a wrong order must be fixable without a release. A key
 * the row does not carry becomes an EMPTY field rather than the literal
 * "undefined" — a file the portal rejects is better than one it accepts with
 * rubbish in a column.
 */
export function renderExport(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  opts: { delimiter?: string; includeHeader?: boolean } = {},
): string {
  const delimiter = opts.delimiter ?? ','
  const out: string[] = []
  if (opts.includeHeader !== false) {
    out.push(columns.map(c => csvField(c.labelFa, delimiter)).join(delimiter))
  }
  for (const r of rows) {
    out.push(columns.map(c => csvField(r[c.key] ?? '', delimiter)).join(delimiter))
  }
  return out.join('\n')
}
