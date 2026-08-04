/**
 * Phase 28.3-الف — payroll engine.
 *
 * These tests carry more weight than most: a wrong figure here is a fine from
 * the tax authority or the social-security organisation, not a rendering bug.
 * The bracket tests in particular assert the SPEC's own worked example, and one
 * of them runs a bracket table with a different number of bands — that is the
 * proof that next year's rates need no code change.
 */
import { describe, it, expect } from 'vitest'
import {
  param, hourlyWage, dailyWage, validateBrackets, taxBreakdown, progressiveTax,
  exemptionFromBrackets, exemptionMismatch, includedAmount, insuranceBaseOf,
  applyRounding, earningAmount, overtimeEarning, calculateSlip,
  canTransitionPeriod, isRecalculable, jalaliMonthLength,
  payrollPostingLines, postingBalanced,
  type TaxBracket, type PayrollParameter, type EarningType, type WorkedTime,
} from '../payroll'

// ── the 1405 seed, expressed as test data (never as engine code) ────────────

const BRACKETS_1405: TaxBracket[] = [
  { seq: 0, fromAmount: 0, toAmount: 400_000_000, ratePercent: 0 },
  { seq: 1, fromAmount: 400_000_000, toAmount: 800_000_000, ratePercent: 10 },
  { seq: 2, fromAmount: 800_000_000, toAmount: 1_000_000_000, ratePercent: 15 },
  { seq: 3, fromAmount: 1_000_000_000, toAmount: 1_200_000_000, ratePercent: 20 },
  { seq: 4, fromAmount: 1_200_000_000, toAmount: 1_400_000_000, ratePercent: 25 },
  { seq: 5, fromAmount: 1_400_000_000, toAmount: null, ratePercent: 30 },
]

const P = (key: string, group: PayrollParameter['group'], value: number, valueType: PayrollParameter['valueType'] = 'amount'): PayrollParameter =>
  ({ key, group, value, valueType })

const PARAMS_1405: PayrollParameter[] = [
  P('monthly_exemption', 'tax', 400_000_000),
  P('employee_rate', 'insurance', 7, 'percent'),
  P('employer_rate', 'insurance', 20, 'percent'),
  P('unemployment_rate', 'insurance', 3, 'percent'),
  P('max_base_factor', 'insurance', 7, 'factor'),
  P('min_wage_daily', 'labor', 5_541_850),
  P('housing_allowance', 'labor', 30_000_000),
  P('food_allowance', 'labor', 22_000_000),
  P('marriage_allowance', 'labor', 5_000_000),
  P('child_allowance_each', 'labor', 16_625_560),
  P('daily_work_hours', 'company', 7.33, 'integer'),
  P('overtime_factor', 'company', 1.4, 'factor'),
  P('holiday_overtime_factor', 'company', 1.96, 'factor'),
  P('friday_factor', 'company', 1.4, 'factor'),
  P('night_shift_factor', 'company', 1.75, 'factor'),
  P('shift_factor', 'company', 1.15, 'factor'),
  P('rounding', 'company', 0),
  P('absence_deduction_enabled', 'company', 1, 'boolean'),
  P('late_deduction_enabled', 'company', 0, 'boolean'),
]

const E = (
  key: string, labelFa: string, over: Partial<EarningType> = {},
): EarningType => ({
  key, labelFa, labelEn: key, recurring: true,
  insurable: 'yes', insurableCap: null, taxable: 'yes', taxableCap: null,
  inEidBase: false, inSeveranceBase: false, inOvertimeBase: false,
  calcMethod: 'manual', calcValue: 0, paramKey: null, sortOrder: 1,
  ...over,
})

const EARNINGS_1405: EarningType[] = [
  E('base_salary', 'حقوق پایه', { calcMethod: 'daily_prorated', inEidBase: true, inSeveranceBase: true, sortOrder: 1 }),
  E('housing', 'حق مسکن', { calcMethod: 'daily_prorated', paramKey: 'housing_allowance', inEidBase: true, sortOrder: 3 }),
  E('food', 'بن کارگری', { calcMethod: 'daily_prorated', paramKey: 'food_allowance', inEidBase: true, sortOrder: 4 }),
  E('marriage', 'حق تأهل', { calcMethod: 'fixed', paramKey: 'marriage_allowance', insurable: 'no', taxable: 'no', sortOrder: 5 }),
  E('child', 'حق اولاد', { calcMethod: 'per_child', paramKey: 'child_allowance_each', insurable: 'no', taxable: 'no', sortOrder: 6 }),
  E('overtime', 'اضافه‌کار', { recurring: false, sortOrder: 10 }),
  E('night_shift', 'شب‌کاری', { recurring: false, sortOrder: 13 }),
]

const WORKED = (over: Partial<WorkedTime> = {}): WorkedTime => ({
  daysInMonth: 31, workedDays: 31, absenceDays: 0, unpaidLeaveDays: 0, lateMinutes: 0,
  overtimeHours: 0, holidayWorkHours: 0, fridayWorkHours: 0, nightShiftHours: 0, shiftWorkHours: 0,
  ...over,
})

// ── parameters ──────────────────────────────────────────────────────────────

describe('parameters', () => {
  it('reads a configured value', () => {
    expect(param(PARAMS_1405, 'employee_rate')).toBe(7)
  })
  it('falls back when a parameter was never configured', () => {
    expect(param(PARAMS_1405, 'does_not_exist', 42)).toBe(42)
  })
  it('derives the hourly wage as a formula, not a stored number', () => {
    expect(hourlyWage(1_000_000, 8)).toBe(125_000)
    expect(dailyWage(310_000_000, 31)).toBe(10_000_000)
  })
  it('never divides by zero hours or zero days', () => {
    expect(hourlyWage(1_000_000, 0)).toBe(0)
    expect(dailyWage(1_000_000, 0)).toBe(0)
  })
})

// ── 🔴 progressive tax ──────────────────────────────────────────────────────

describe('🔴 progressive tax', () => {
  it('the spec’s worked example: 1,000,000,000 → 70,000,000 ریال', () => {
    // 400م معاف + 400م×10% + 200م×15% = 40م + 30م = 70م
    expect(progressiveTax(1_000_000_000, BRACKETS_1405)).toBe(70_000_000)
  })

  it('taxes each slice at its OWN rate, never the whole income at the top rate', () => {
    const rows = taxBreakdown(1_000_000_000, BRACKETS_1405)
    expect(rows[0]).toMatchObject({ ratePercent: 0, amountInBracket: 400_000_000, tax: 0 })
    expect(rows[1]).toMatchObject({ ratePercent: 10, amountInBracket: 400_000_000, tax: 40_000_000 })
    expect(rows[2]).toMatchObject({ ratePercent: 15, amountInBracket: 200_000_000, tax: 30_000_000 })
    expect(rows).toHaveLength(3)   // stops once the income is exhausted
  })

  it('income below the exemption is not taxed at all', () => {
    expect(progressiveTax(350_000_000, BRACKETS_1405)).toBe(0)
    expect(progressiveTax(0, BRACKETS_1405)).toBe(0)
    expect(progressiveTax(-5, BRACKETS_1405)).toBe(0)
  })

  it('income exactly on a bracket boundary does not spill into the next band', () => {
    expect(progressiveTax(400_000_000, BRACKETS_1405)).toBe(0)
    expect(progressiveTax(800_000_000, BRACKETS_1405)).toBe(40_000_000)
  })

  it('income above the last bracket is taxed at 30% on the excess only', () => {
    // ...up to 1.4B = 40 + 30 + 40 + 50 = 160م, then 100م × 30% = 30م
    expect(progressiveTax(1_500_000_000, BRACKETS_1405)).toBe(190_000_000)
  })

  it('🔴 a table with a DIFFERENT number of bands works with no code change', () => {
    const fourBands: TaxBracket[] = [
      { seq: 0, fromAmount: 0, toAmount: 500_000_000, ratePercent: 0 },
      { seq: 1, fromAmount: 500_000_000, toAmount: 1_000_000_000, ratePercent: 12 },
      { seq: 2, fromAmount: 1_000_000_000, toAmount: 2_000_000_000, ratePercent: 23 },
      { seq: 3, fromAmount: 2_000_000_000, toAmount: null, ratePercent: 35 },
    ]
    // 500م معاف + 500م×12% = 60م + 1000م×23% = 230م + 500م×35% = 175م
    expect(progressiveTax(2_500_000_000, fourBands)).toBe(465_000_000)
  })

  it('🔴 a seven-band table also works — next year is a data edit', () => {
    const sevenBands: TaxBracket[] = [
      { seq: 0, fromAmount: 0, toAmount: 100, ratePercent: 0 },
      { seq: 1, fromAmount: 100, toAmount: 200, ratePercent: 5 },
      { seq: 2, fromAmount: 200, toAmount: 300, ratePercent: 10 },
      { seq: 3, fromAmount: 300, toAmount: 400, ratePercent: 15 },
      { seq: 4, fromAmount: 400, toAmount: 500, ratePercent: 20 },
      { seq: 5, fromAmount: 500, toAmount: 600, ratePercent: 25 },
      { seq: 6, fromAmount: 600, toAmount: null, ratePercent: 30 },
    ]
    // 0 + 5 + 10 + 15 + 20 + 25 + 30 = 105
    expect(progressiveTax(700, sevenBands)).toBe(105)
  })
})

// ── bracket validation ──────────────────────────────────────────────────────

describe('bracket validation refuses a table that would silently mis-tax', () => {
  it('accepts the 1405 table', () => {
    expect(validateBrackets(BRACKETS_1405)).toEqual([])
  })
  it('rejects an empty table', () => {
    expect(validateBrackets([])[0].code).toBe('empty')
  })
  it('rejects a gap between bands', () => {
    const gapped: TaxBracket[] = [
      { seq: 0, fromAmount: 0, toAmount: 100, ratePercent: 0 },
      { seq: 1, fromAmount: 200, toAmount: null, ratePercent: 10 },
    ]
    expect(validateBrackets(gapped).some(i => i.code === 'gap')).toBe(true)
  })
  it('rejects an overlap', () => {
    const overlapping: TaxBracket[] = [
      { seq: 0, fromAmount: 0, toAmount: 300, ratePercent: 0 },
      { seq: 1, fromAmount: 200, toAmount: null, ratePercent: 10 },
    ]
    expect(validateBrackets(overlapping).some(i => i.code === 'overlap')).toBe(true)
  })
  it('requires the LAST band to be open-ended, or the top earners pay nothing', () => {
    const closed: TaxBracket[] = [
      { seq: 0, fromAmount: 0, toAmount: 100, ratePercent: 0 },
      { seq: 1, fromAmount: 100, toAmount: 200, ratePercent: 10 },
    ]
    expect(validateBrackets(closed).some(i => i.code === 'last_not_open')).toBe(true)
  })
  it('rejects an out-of-range rate', () => {
    expect(validateBrackets([{ seq: 0, fromAmount: 0, toAmount: null, ratePercent: 150 }])
      .some(i => i.code === 'negative_rate')).toBe(true)
  })
  it('rejects a band that ends before it starts', () => {
    expect(validateBrackets([{ seq: 0, fromAmount: 500, toAmount: 100, ratePercent: 10 }])
      .some(i => i.code === 'unordered')).toBe(true)
  })
})

describe('🔴 the exemption is not applied twice', () => {
  it('derives the effective exemption from the leading zero-rate band', () => {
    expect(exemptionFromBrackets(BRACKETS_1405)).toBe(400_000_000)
  })
  it('reports agreement between the stated parameter and the table', () => {
    expect(exemptionMismatch(BRACKETS_1405, PARAMS_1405)).toBeNull()
  })
  it('catches a parameter the operator edited without touching the table', () => {
    const stale = PARAMS_1405.map(p => p.key === 'monthly_exemption' ? { ...p, value: 500_000_000 } : p)
    expect(exemptionMismatch(BRACKETS_1405, stale))
      .toEqual({ stated: 500_000_000, effective: 400_000_000 })
  })
})

// ── inclusion flags ─────────────────────────────────────────────────────────

describe('inclusion is data, not a condition in code', () => {
  it('an exempt item contributes nothing to the base', () => {
    expect(includedAmount(1000, 'no', null)).toBe(0)
  })
  it('a fully included item contributes all of it', () => {
    expect(includedAmount(1000, 'yes', null)).toBe(1000)
  })
  it('a capped item contributes only up to the cap — the excess counts elsewhere', () => {
    expect(includedAmount(1000, 'capped', 600)).toBe(600)
    expect(includedAmount(400, 'capped', 600)).toBe(400)
  })
  it('a capped item with no cap set behaves as fully included, not as exempt', () => {
    expect(includedAmount(1000, 'capped', null)).toBe(1000)
  })
})

// ── insurance base ──────────────────────────────────────────────────────────

describe('insurance base', () => {
  const opts = { minWageDaily: 5_541_850, maxBaseFactor: 7, daysInMonth: 30, workedDays: 30 }

  it('uses the earnings when they sit between the floor and the ceiling', () => {
    expect(insuranceBaseOf(300_000_000, opts)).toBe(300_000_000)
  })
  it('🔴 caps a high salary at the ceiling — insurance is not charged on the excess', () => {
    const ceiling = 5_541_850 * 7 * 30      // 1,163,788,500
    expect(insuranceBaseOf(5_000_000_000, opts)).toBe(ceiling)
  })
  it('🔴 raises a low salary to the statutory floor', () => {
    const floor = 5_541_850 * 30            // 166,255,500
    expect(insuranceBaseOf(50_000_000, opts)).toBe(floor)
  })
  it('prorates the floor for a partial month — half a month is not insured as a full one', () => {
    const half = { ...opts, workedDays: 15 }
    expect(insuranceBaseOf(10_000_000, half)).toBe(5_541_850 * 30 * 0.5)
  })
  it('the ceiling follows the minimum wage automatically, because it is a factor', () => {
    const raised = { ...opts, minWageDaily: 7_000_000 }
    expect(insuranceBaseOf(5_000_000_000, raised)).toBe(7_000_000 * 7 * 30)
  })
})

describe('rounding is company policy', () => {
  it('rounds to the configured step', () => {
    expect(applyRounding(1_234_567, 1000)).toBe(1_235_000)
  })
  it('a zero step means no rounding at all', () => {
    expect(applyRounding(1_234_567.89, 0)).toBe(1_234_567.89)
  })
})

// ── earning construction ────────────────────────────────────────────────────

describe('earnings are built from the type table', () => {
  const ctx = {
    baseSalary: 310_000_000, params: PARAMS_1405, worked: WORKED(),
    employee: { id: 1, fullName: 'ت', childrenCount: 2, married: true }, manual: {},
  }

  it('a prorated earning pays in full for a complete month', () => {
    expect(earningAmount(EARNINGS_1405[0], ctx)).toBe(310_000_000)
  })
  it('🔴 a partial month prorates by days worked', () => {
    const partial = { ...ctx, worked: WORKED({ daysInMonth: 31, workedDays: 15 }) }
    expect(earningAmount(EARNINGS_1405[0], partial)).toBe(150_000_000)
  })
  it('a parameter-driven allowance reads the parameter, not a literal', () => {
    expect(earningAmount(EARNINGS_1405[1], ctx)).toBe(30_000_000)
  })
  it('the child allowance multiplies by the number of children', () => {
    const child = EARNINGS_1405.find(e => e.key === 'child')!
    expect(earningAmount(child, ctx)).toBe(2 * 16_625_560)
    expect(earningAmount(child, { ...ctx, employee: { ...ctx.employee, childrenCount: 0 } })).toBe(0)
    expect(earningAmount(child, { ...ctx, employee: { ...ctx.employee, childrenCount: 3 } })).toBe(3 * 16_625_560)
  })
  it('the marriage allowance is not paid to an unmarried employee', () => {
    const marriage = EARNINGS_1405.find(e => e.key === 'marriage')!
    expect(earningAmount(marriage, { ...ctx, employee: { ...ctx.employee, married: false } })).toBe(0)
    expect(earningAmount(marriage, ctx)).toBe(5_000_000)
  })
  it('a manual earning takes the operator’s figure', () => {
    const bonus = E('bonus', 'پاداش')
    expect(earningAmount(bonus, { ...ctx, manual: { bonus: 12_345 } })).toBe(12_345)
    expect(earningAmount(bonus, ctx)).toBe(0)
  })
  it('a percent-of-base earning is computed from the base', () => {
    const pct = E('job_allowance', 'شغل', { calcMethod: 'percent_of_base', calcValue: 10 })
    expect(earningAmount(pct, ctx)).toBe(31_000_000)
  })
})

describe('overtime uses configurable factors', () => {
  const hourly = 1_000_000

  it('ordinary overtime applies the company factor', () => {
    expect(overtimeEarning('overtime', hourly, WORKED({ overtimeHours: 10 }), PARAMS_1405)).toBe(14_000_000)
  })
  it('a company that pays MORE than the legal minimum is honoured', () => {
    const generous = PARAMS_1405.map(p => p.key === 'overtime_factor' ? { ...p, value: 2 } : p)
    expect(overtimeEarning('overtime', hourly, WORKED({ overtimeHours: 10 }), generous)).toBe(20_000_000)
  })
  it('night and holiday work carry their own factors', () => {
    expect(overtimeEarning('night_shift', hourly, WORKED({ nightShiftHours: 10 }), PARAMS_1405)).toBe(17_500_000)
    expect(overtimeEarning('holiday_work', hourly, WORKED({ holidayWorkHours: 10 }), PARAMS_1405)).toBe(19_600_000)
  })
  it('no hours means no earning', () => {
    expect(overtimeEarning('overtime', hourly, WORKED(), PARAMS_1405)).toBe(0)
  })
  it('an earning that is not an overtime family member is left alone', () => {
    expect(overtimeEarning('base_salary', hourly, WORKED(), PARAMS_1405)).toBeNull()
  })
})

// ── the whole slip ──────────────────────────────────────────────────────────

describe('calculateSlip', () => {
  const employee = { id: 1, fullName: 'آزمون', childrenCount: 2, married: true }
  const employment = { baseSalary: 310_000_000, contractType: 'permanent' }

  const run = (over: Partial<Parameters<typeof calculateSlip>[0]> = {}) => calculateSlip({
    employee, employment, worked: WORKED({ daysInMonth: 30, workedDays: 30 }),
    loans: [], params: PARAMS_1405, brackets: BRACKETS_1405, earningTypes: EARNINGS_1405,
    ...over,
  })

  it('produces a fully itemised slip — every figure traceable', () => {
    const r = run()
    const keys = r.lines.filter(l => l.lineType === 'earning').map(l => l.key)
    expect(keys).toEqual(['base_salary', 'housing', 'food', 'marriage', 'child'])
    expect(r.gross).toBe(310_000_000 + 30_000_000 + 22_000_000 + 5_000_000 + 2 * 16_625_560)
  })

  it('🔴 the employer share is a company cost, never deducted from the employee', () => {
    const r = run()
    const employerLines = r.lines.filter(l => l.lineType === 'employer_cost')
    expect(employerLines.map(l => l.key)).toEqual(['employer_insurance', 'unemployment_insurance'])
    // the net is unaffected by the employer's cost
    expect(r.net).toBe(r.gross - r.deductions)
    expect(r.deductions).not.toContain(r.employerInsurance)
    expect(r.employerInsurance).toBe(Math.round(r.insuranceBase * 0.2 * 100) / 100)
  })

  it('🔴 an item flagged exempt from insurance stays out of the base', () => {
    const r = run()
    // marriage + child are insurable:'no'
    const insurableGross = 310_000_000 + 30_000_000 + 22_000_000
    expect(r.insuranceBase).toBe(insurableGross)
    expect(r.employeeInsurance).toBe(Math.round(insurableGross * 0.07 * 100) / 100)
  })

  it('🔴 flipping ONE inclusion flag changes the result — no code change involved', () => {
    const foodInsurable = run().insuranceBase
    const exemptFood = EARNINGS_1405.map(e => e.key === 'food' ? { ...e, insurable: 'no' as const } : e)
    const after = run({ earningTypes: exemptFood }).insuranceBase
    expect(foodInsurable - after).toBe(22_000_000)
  })

  it('🔴 a brand-new earning type that was never in the seed is applied correctly', () => {
    const withNew = [...EARNINGS_1405, E('hardship', 'فوق‌العادهٔ بدی آب‌وهوا', {
      calcMethod: 'fixed', calcValue: 40_000_000, insurable: 'yes', taxable: 'no', sortOrder: 9,
    })]
    const r = run({ earningTypes: withNew })
    expect(r.lines.some(l => l.key === 'hardship' && l.amount === 40_000_000)).toBe(true)
    expect(r.insuranceBase).toBe(run().insuranceBase + 40_000_000)
    // taxable:'no' — so it adds nothing to taxable EARNINGS. The tax base still
    // moves, because the item IS insurable and insurance is deductible: it
    // falls by exactly the extra employee insurance (40م × 7%), not by 40م.
    expect(run().taxableIncome - r.taxableIncome).toBe(2_800_000)
  })

  it('a capped inclusion contributes only up to its ceiling', () => {
    const capped = EARNINGS_1405.map(e => e.key === 'housing'
      ? { ...e, insurable: 'capped' as const, insurableCap: 10_000_000 } : e)
    expect(run().insuranceBase - run({ earningTypes: capped }).insuranceBase).toBe(20_000_000)
  })

  it('deducts a loan instalment and reaches the right net', () => {
    const r = run({ loans: [{ loanId: 1, amount: 25_000_000 }] })
    expect(r.lines.some(l => l.key === 'loan' && l.amount === 25_000_000)).toBe(true)
    expect(r.net).toBe(r.gross - r.deductions)
  })

  it('deducts absence when policy enables it, and not otherwise', () => {
    const worked = WORKED({ daysInMonth: 30, workedDays: 28, absenceDays: 2 })
    const withDeduction = run({ worked })
    expect(withDeduction.lines.some(l => l.key === 'absence')).toBe(true)

    const off = PARAMS_1405.map(p => p.key === 'absence_deduction_enabled' ? { ...p, value: 0 } : p)
    expect(run({ worked, params: off }).lines.some(l => l.key === 'absence')).toBe(false)
  })

  it('🔴 a partial month prorates the fixed allowances too, not only the salary', () => {
    const half = run({ worked: WORKED({ daysInMonth: 30, workedDays: 15 }) })
    const housing = half.lines.find(l => l.key === 'housing')!
    expect(housing.amount).toBe(15_000_000)
  })

  it('a low salary is insured on the statutory floor, not on what was paid', () => {
    const r = run({ employment: { baseSalary: 20_000_000, contractType: 'temporary' } })
    expect(r.insuranceBase).toBe(5_541_850 * 30)
  })

  it('a very high salary is insured on the ceiling', () => {
    const r = run({ employment: { baseSalary: 9_000_000_000, contractType: 'permanent' } })
    expect(r.insuranceBase).toBe(5_541_850 * 7 * 30)
  })

  it('computes the Eid and severance bases from the flags, for 28.3-ب', () => {
    const r = run()
    // base + housing + food carry inEidBase; only base carries inSeveranceBase
    expect(r.eidBase).toBe(310_000_000 + 30_000_000 + 22_000_000)
    expect(r.severanceBase).toBe(310_000_000)
  })

  it('an employee earning under the exemption pays no tax but still pays insurance', () => {
    const r = run({ employment: { baseSalary: 150_000_000, contractType: 'permanent' } })
    expect(r.tax).toBe(0)
    expect(r.employeeInsurance).toBeGreaterThan(0)
  })

  it('applies the company rounding policy to the net', () => {
    const rounded = PARAMS_1405.map(p => p.key === 'rounding' ? { ...p, value: 10_000 } : p)
    expect(run({ params: rounded }).net % 10_000).toBe(0)
  })

  it('🔴 rounding does not make the payslip stop adding up', () => {
    // The live suite caught this: rounding shaved 120 ریال off the net and the
    // journal entry came out 120 short on the credit side, because the gross was
    // expensed in full. The difference is now its own visible line.
    const rounded = PARAMS_1405.map(p => p.key === 'rounding' ? { ...p, value: 10_000 } : p)
    const r = run({ params: rounded })
    expect(r.net).toBe(r.gross - r.deductions)
    expect(r.lines.some(l => l.key === 'rounding')).toBe(true)
  })

  it('🔴 a rounded slip still produces a BALANCED journal entry', () => {
    const rounded = PARAMS_1405.map(p => p.key === 'rounding' ? { ...p, value: 10_000 } : p)
    const r = run({ params: rounded })
    const roundingLine = r.lines.find(l => l.key === 'rounding')?.amount ?? 0
    expect(postingBalanced(payrollPostingLines({
      gross: r.gross, employeeInsurance: r.employeeInsurance,
      employerInsurance: r.employerInsurance, unemploymentInsurance: r.unemploymentInsurance,
      tax: r.tax, loanRepayment: 0, otherDeductions: roundingLine, net: r.net,
    }))).toBe(true)
  })

  it('rounding UP is a negative adjustment, not a hidden gain', () => {
    // gross − deductions here lands just below a 10,000 step boundary in some
    // configurations; whichever way it rounds, the line must reconcile.
    for (const step of [1000, 10_000, 100_000]) {
      const params = PARAMS_1405.map(p => p.key === 'rounding' ? { ...p, value: step } : p)
      const r = run({ params })
      expect(r.net).toBe(r.gross - r.deductions)
      expect(r.net % step).toBe(0)
    }
  })
})

// ── period lifecycle ────────────────────────────────────────────────────────

describe('period lifecycle', () => {
  it('follows the workflow forward', () => {
    expect(canTransitionPeriod('open', 'calculated')).toBe(true)
    expect(canTransitionPeriod('calculated', 'approved')).toBe(true)
    expect(canTransitionPeriod('approved', 'paid')).toBe(true)
    expect(canTransitionPeriod('paid', 'locked')).toBe(true)
  })
  it('🔴 refuses to skip approval', () => {
    expect(canTransitionPeriod('calculated', 'paid')).toBe(false)
    expect(canTransitionPeriod('open', 'approved')).toBe(false)
  })
  it('🔴 a locked period goes nowhere — corrections are new slips', () => {
    expect(canTransitionPeriod('locked', 'open')).toBe(false)
    expect(canTransitionPeriod('locked', 'approved')).toBe(false)
  })
  it('🔴 an approved period cannot be recalculated in place', () => {
    expect(isRecalculable('open')).toBe(true)
    expect(isRecalculable('calculated')).toBe(true)
    expect(isRecalculable('approved')).toBe(false)
    expect(isRecalculable('paid')).toBe(false)
    expect(isRecalculable('locked')).toBe(false)
  })
})

describe('Jalali month length', () => {
  it('the first six months have 31 days', () => {
    expect(jalaliMonthLength(1405, 1)).toBe(31)
    expect(jalaliMonthLength(1405, 6)).toBe(31)
  })
  it('months seven to eleven have 30', () => {
    expect(jalaliMonthLength(1405, 7)).toBe(30)
    expect(jalaliMonthLength(1405, 11)).toBe(30)
  })
  it('Esfand has 29 in an ordinary year and 30 in a leap year', () => {
    expect(jalaliMonthLength(1405, 12)).toBe(29)
    expect(jalaliMonthLength(1403, 12)).toBe(30)   // 1403 % 33 = 22 → leap
  })
})

// ── GL posting ──────────────────────────────────────────────────────────────

describe('GL posting', () => {
  const totals = {
    gross: 1_000_000_000, employeeInsurance: 70_000_000, employerInsurance: 200_000_000,
    unemploymentInsurance: 30_000_000, tax: 50_000_000, loanRepayment: 25_000_000,
    otherDeductions: 0, net: 855_000_000,
  }

  it('balances', () => {
    expect(postingBalanced(payrollPostingLines(totals))).toBe(true)
  })

  it('debits the gross as expense and the employer share separately', () => {
    const lines = payrollPostingLines(totals)
    expect(lines.find(l => l.accountCode === '6100')?.debit).toBe(1_000_000_000)
    expect(lines.find(l => l.accountCode === '6110')?.debit).toBe(230_000_000)
  })

  it('credits insurance payable with BOTH shares', () => {
    const lines = payrollPostingLines(totals)
    expect(lines.find(l => l.accountCode === '2310')?.credit).toBe(300_000_000)
  })

  it('🔴 a loan repayment credits the RECEIVABLE, never revenue', () => {
    const lines = payrollPostingLines(totals)
    const loan = lines.find(l => l.accountCode === '1160')!
    expect(loan.credit).toBe(25_000_000)
    expect(lines.some(l => l.accountCode.startsWith('4'))).toBe(false)
  })

  it('credits salaries payable with the net owed to employees', () => {
    expect(payrollPostingLines(totals).find(l => l.accountCode === '2300')?.credit).toBe(855_000_000)
  })

  it('stays balanced with no loan and no employer cost', () => {
    // Net has to be recomputed for the bare case, or the test data itself is
    // unbalanced: gross − employee insurance − tax.
    const bare = {
      ...totals, loanRepayment: 0, employerInsurance: 0, unemploymentInsurance: 0,
      net: totals.gross - totals.employeeInsurance - totals.tax,
    }
    expect(postingBalanced(payrollPostingLines(bare))).toBe(true)
  })
})
