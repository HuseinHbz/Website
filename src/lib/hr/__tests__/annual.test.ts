/**
 * Phase 28.3-ب — Eid bonus, severance and final settlement.
 *
 * The severance tests carry the most weight. A wrong monthly figure gets
 * noticed next month; a wrong termination figure is discovered years later at
 * someone's final settlement, when it is both expensive and disputed.
 */
import { describe, it, expect } from 'vitest'
import {
  serviceDaysBetween, serviceDaysWithin, serviceYearsOf,
  calculateEid, severanceDailyBase, severanceBasePolicyOf, calculateSeverance,
  monthlySeveranceAccrual, leaveEncashment, calculateSettlement,
  eidPostingLines, severancePostingLines, severanceAccrualPostingLines,
  settlementPostingLines, annualPostingBalanced,
  csvField, renderExport,
  splitSickLeave, ibanCheckDigitValid, validateBankLines, bankBatchPostingLines,
  advanceCap, checkAdvance, advanceExceedsNet,
} from '../annual'
import type { PayrollParameter } from '../payroll'

const P = (key: string, value: number): PayrollParameter =>
  ({ key, group: 'labor', value, valueType: 'amount' })

const PARAMS = [
  P('eid_days', 60),
  P('eid_min_days_of_min_wage', 60),
  P('eid_max_days_of_min_wage', 90),
  P('eid_tax_exempt_amount', 0),
  P('severance_days_per_year', 30),
  P('severance_base_policy', 0),
  P('leave_encashment_enabled', 1),
  P('leave_encashment_max_days', 9),
]

const MIN_WAGE_DAILY = 5_541_850
const noTax = () => 0

// ── service time ────────────────────────────────────────────────────────────

describe('service time', () => {
  it('counts both ends of the span', () => {
    expect(serviceDaysBetween('2026-01-01', '2026-01-01')).toBe(1)
    expect(serviceDaysBetween('2026-01-01', '2026-01-31')).toBe(31)
  })
  it('a reversed or empty span is zero, never negative', () => {
    expect(serviceDaysBetween('2026-01-31', '2026-01-01')).toBe(0)
    expect(serviceDaysBetween('', '2026-01-01')).toBe(0)
  })
  it('clips a service span to a window — a mid-year hire', () => {
    // hired in Azar (roughly late November), year ends 2027-03-20
    expect(serviceDaysWithin('2026-11-22', null, '2026-03-21', '2027-03-20'))
      .toBe(serviceDaysBetween('2026-11-22', '2027-03-20'))
  })
  it('clips a service span to a window — a mid-year leaver', () => {
    expect(serviceDaysWithin('2020-01-01', '2026-08-15', '2026-03-21', '2027-03-20'))
      .toBe(serviceDaysBetween('2026-03-21', '2026-08-15'))
  })
  it('expresses years as a decimal — 3 years 7 months is not 3', () => {
    const days = serviceDaysBetween('2022-01-01', '2025-07-31')
    expect(serviceYearsOf(days)).toBeGreaterThan(3.5)
    expect(serviceYearsOf(days)).toBeLessThan(3.7)
  })
})

// ── Eid bonus ───────────────────────────────────────────────────────────────

describe('Eid bonus', () => {
  // A base deliberately chosen to sit BETWEEN the floor and the ceiling.
  // With the 1405 minimum wage the ceiling is 90 × 5,541,850 = 498,766,500, so
  // anything above roughly 250م a month is capped — see the test below.
  const run = (over: Partial<Parameters<typeof calculateEid>[0]> = {}) => calculateEid({
    serviceDays: 365, daysInYear: 365, monthlyBase: 200_000_000,
    minWageDaily: MIN_WAGE_DAILY, params: PARAMS, ...over,
  }, noTax)

  it('a full year pays the configured number of days of own pay', () => {
    // 200م ÷ 30 ≈ 6.67م per day × 60 days = 400م
    expect(run().fullYear).toBe(400_000_000)
    expect(run().amount).toBe(400_000_000)
  })

  it('🔴 the ceiling is in MINIMUM-WAGE days, so most mid-to-high salaries are capped', () => {
    // This surprises people: the cap is not a multiple of the employee's own
    // pay. At the 1405 minimum wage anything over ~249م a month hits it.
    const capped = run({ monthlyBase: 300_000_000 })
    expect(capped.limitApplied).toBe('ceiling')
    expect(capped.amount).toBe(MIN_WAGE_DAILY * 90)
    expect(capped.amount).toBeLessThan(capped.prorated)
  })

  it('🔴 half a year pays half — the pro-rata is what makes a mid-year hire right', () => {
    const r = run({ serviceDays: 182 })
    expect(r.prorated).toBeCloseTo(400_000_000 * 182 / 365, 0)
    expect(r.amount).toBe(r.prorated)
  })

  it('🔴 one month of service pays about a twelfth, not a full bonus', () => {
    const r = run({ serviceDays: 30 })
    expect(r.amount).toBeCloseTo(400_000_000 * 30 / 365, 0)
    expect(r.amount).toBeLessThan(40_000_000)
  })

  it('🔴 the ceiling caps a high earner at the statutory maximum', () => {
    const r = run({ monthlyBase: 5_000_000_000 })
    expect(r.limitApplied).toBe('ceiling')
    expect(r.amount).toBe(MIN_WAGE_DAILY * 90)
  })

  it('🔴 the floor lifts a low earner to the statutory minimum', () => {
    const r = run({ monthlyBase: 50_000_000 })
    expect(r.limitApplied).toBe('floor')
    expect(r.amount).toBe(MIN_WAGE_DAILY * 60)
  })

  it('🔴 the floor and ceiling are pro-rated too — three months is not a full floor', () => {
    const r = run({ monthlyBase: 50_000_000, serviceDays: 91 })
    expect(r.limitApplied).toBe('floor')
    expect(r.amount).toBeCloseTo(MIN_WAGE_DAILY * 60 * 91 / 365, 0)
    expect(r.amount).toBeLessThan(MIN_WAGE_DAILY * 60)
  })

  it('a limit that is not hit is reported as no limit', () => {
    expect(run().limitApplied).toBeNull()
  })

  it('no service means no bonus', () => {
    expect(run({ serviceDays: 0 }).amount).toBe(0)
  })

  it('service beyond the year is not paid twice', () => {
    expect(run({ serviceDays: 500 }).amount).toBe(run({ serviceDays: 365 }).amount)
  })

  it('the exemption reduces what is taxed, not what is paid', () => {
    const params = [...PARAMS.filter(p => p.key !== 'eid_tax_exempt_amount'),
      P('eid_tax_exempt_amount', 100_000_000)]
    const r = calculateEid({
      serviceDays: 365, daysInYear: 365, monthlyBase: 200_000_000,
      minWageDaily: MIN_WAGE_DAILY, params,
    }, taxable => taxable * 0.1)
    expect(r.amount).toBe(400_000_000)
    expect(r.taxableAmount).toBe(300_000_000)
    expect(r.tax).toBe(30_000_000)
    expect(r.net).toBe(370_000_000)
  })

  it('every rate is a parameter — changing the days changes the answer', () => {
    const params = [...PARAMS.filter(p => p.key !== 'eid_days'), P('eid_days', 45)]
    const r = calculateEid({
      serviceDays: 365, daysInYear: 365, monthlyBase: 200_000_000,
      minWageDaily: MIN_WAGE_DAILY, params,
    }, noTax)
    expect(r.fullYear).toBe(300_000_000)
  })
})

// ── 🔴 severance ────────────────────────────────────────────────────────────

describe('🔴 severance at termination', () => {
  it('is computed from a DAILY base and a service span, not a monthly allowance', () => {
    // The signature itself is the guard: `seniority_base` is a monthly earning
    // handled in 28.3-الف and cannot be passed here by accident.
    const r = calculateSeverance({ serviceDays: 365, dailyBase: 10_000_000, daysPerYear: 30 })
    expect(r.amount).toBe(300_000_000)
    expect(r.entitlementDays).toBe(30)
  })

  it('🔴 three years and seven months earns MORE than three years', () => {
    const days = serviceDaysBetween('2022-01-01', '2025-07-31')
    const partial = calculateSeverance({ serviceDays: days, dailyBase: 10_000_000, daysPerYear: 30 })
    const whole = calculateSeverance({ serviceDays: 365 * 3, dailyBase: 10_000_000, daysPerYear: 30 })
    expect(partial.amount).toBeGreaterThan(whole.amount)
    // ~3.58 years × 30 days × 10م
    expect(partial.entitlementDays).toBeGreaterThan(107)
    expect(partial.entitlementDays).toBeLessThan(109)
  })

  it('🔴 a partial year is pro-rated, not rounded down — rounding down underpays', () => {
    const halfYear = calculateSeverance({ serviceDays: 182, dailyBase: 10_000_000, daysPerYear: 30 })
    expect(halfYear.amount).toBeGreaterThan(140_000_000)
    expect(halfYear.amount).toBeLessThan(155_000_000)
  })

  it('no service earns nothing', () => {
    expect(calculateSeverance({ serviceDays: 0, dailyBase: 10_000_000, daysPerYear: 30 }).amount).toBe(0)
  })

  it('days per year is a parameter — a company may pay more than the minimum', () => {
    const generous = calculateSeverance({ serviceDays: 365, dailyBase: 10_000_000, daysPerYear: 45 })
    expect(generous.amount).toBe(450_000_000)
  })

  describe('the base policy', () => {
    it('defaults to the last month’s pay', () => {
      expect(severanceBasePolicyOf(PARAMS)).toBe('last')
      expect(severanceDailyBase('last', 300_000_000, [100_000_000, 200_000_000])).toBe(10_000_000)
    })
    it('can be the average of recent months instead', () => {
      const params = [...PARAMS.filter(p => p.key !== 'severance_base_policy'), P('severance_base_policy', 1)]
      expect(severanceBasePolicyOf(params)).toBe('average')
      expect(severanceDailyBase('average', 300_000_000, [270_000_000, 300_000_000, 330_000_000]))
        .toBe(10_000_000)
    })
    it('🔴 a raise before leaving changes the figure under "last" but not under "average"', () => {
      const last = severanceDailyBase('last', 600_000_000, [300_000_000, 300_000_000, 600_000_000])
      const avg = severanceDailyBase('average', 600_000_000, [300_000_000, 300_000_000, 600_000_000])
      expect(last).toBe(20_000_000)
      expect(avg).toBeCloseTo(13_333_333.33, 0)
    })
    it('falls back to the last month when there is no history to average', () => {
      expect(severanceDailyBase('average', 300_000_000, [])).toBe(10_000_000)
    })
  })

  it('the monthly provision accrues a month’s share of a year’s entitlement', () => {
    const monthly = monthlySeveranceAccrual(10_000_000, 30, 31, 365)
    const annual = 10_000_000 * 30
    expect(monthly).toBeCloseTo(annual * 31 / 365, 0)
  })
})

// ── leave encashment ────────────────────────────────────────────────────────

describe('leave encashment', () => {
  it('pays out the unused balance at the daily rate', () => {
    expect(leaveEncashment(5, 10_000_000, 9, true)).toEqual({ days: 5, capped: false, amount: 50_000_000 })
  })
  it('applies the configured cap', () => {
    const r = leaveEncashment(20, 10_000_000, 9, true)
    expect(r).toEqual({ days: 9, capped: true, amount: 90_000_000 })
  })
  it('a zero cap means no cap', () => {
    expect(leaveEncashment(20, 10_000_000, 0, true).days).toBe(20)
  })
  it('pays nothing when the policy is off', () => {
    expect(leaveEncashment(20, 10_000_000, 9, false).amount).toBe(0)
  })
  it('🔴 a NEGATIVE balance is a real debt and is shown as one, not floored at zero', () => {
    const r = leaveEncashment(-3, 10_000_000, 9, true)
    expect(r.days).toBe(-3)
    expect(r.amount).toBe(-30_000_000)
  })
  it('the cap never applies to what is owed BACK', () => {
    expect(leaveEncashment(-20, 10_000_000, 9, true).days).toBe(-20)
  })
})

// ── settlement ──────────────────────────────────────────────────────────────

describe('final settlement', () => {
  const base = {
    finalPay: 300_000_000, severance: 1_000_000_000, eid: 500_000_000,
    leaveEncashment: 50_000_000, loanOutstanding: 0, otherDeductions: 0,
  }

  it('adds the entitlements and subtracts the deductions', () => {
    const r = calculateSettlement(base)
    expect(r.additions).toBe(1_850_000_000)
    expect(r.total).toBe(1_850_000_000)
    expect(r.employeeOwes).toBe(false)
  })

  it('clears an outstanding loan from the settlement', () => {
    const r = calculateSettlement({ ...base, loanOutstanding: 200_000_000 })
    expect(r.deductions).toBe(200_000_000)
    expect(r.total).toBe(1_650_000_000)
  })

  it('🔴 a negative total is SHOWN, not clamped — the leaver owes the company', () => {
    const r = calculateSettlement({
      ...base, severance: 0, eid: 0, leaveEncashment: 0, loanOutstanding: 500_000_000,
    })
    expect(r.total).toBe(-200_000_000)
    expect(r.employeeOwes).toBe(true)
  })
})

// ── GL posting ──────────────────────────────────────────────────────────────

describe('GL posting', () => {
  it('the Eid entry balances and credits tax separately', () => {
    const lines = eidPostingLines({ amount: 600_000_000, tax: 60_000_000, net: 540_000_000 })
    expect(annualPostingBalanced(lines)).toBe(true)
    expect(lines.find(l => l.accountCode === '2320')?.credit).toBe(60_000_000)
    expect(lines.find(l => l.accountCode === '2330')?.credit).toBe(540_000_000)
  })

  it('an untaxed Eid still balances', () => {
    expect(annualPostingBalanced(eidPostingLines({ amount: 600_000_000, tax: 0, net: 600_000_000 }))).toBe(true)
  })

  it('severance with no provision charges the whole amount to expense', () => {
    const lines = severancePostingLines({ amount: 1_000_000_000, accruedBefore: 0 })
    expect(annualPostingBalanced(lines)).toBe(true)
    expect(lines.find(l => l.accountCode === '6130')?.debit).toBe(1_000_000_000)
  })

  it('🔴 severance already provisioned releases the provision instead of double-charging', () => {
    const lines = severancePostingLines({ amount: 1_000_000_000, accruedBefore: 800_000_000 })
    expect(annualPostingBalanced(lines)).toBe(true)
    expect(lines.find(l => l.accountCode === '6130')?.debit).toBe(200_000_000)
    expect(lines.find(l => l.accountCode === '2340')?.debit).toBe(800_000_000)
  })

  it('a provision larger than the final figure releases only what is needed', () => {
    const lines = severancePostingLines({ amount: 500_000_000, accruedBefore: 800_000_000 })
    expect(annualPostingBalanced(lines)).toBe(true)
    expect(lines.some(l => l.accountCode === '6130')).toBe(false)
    expect(lines.find(l => l.accountCode === '2340')?.debit).toBe(500_000_000)
  })

  it('the monthly provision entry balances', () => {
    expect(annualPostingBalanced(severanceAccrualPostingLines(25_000_000))).toBe(true)
    expect(severanceAccrualPostingLines(0)).toEqual([])
  })

  it('the settlement entry balances when the company owes the leaver', () => {
    const lines = settlementPostingLines({
      leaveEncashment: 50_000_000, loanOutstanding: 200_000_000, otherDeductions: 0, total: -150_000_000,
    })
    expect(annualPostingBalanced(lines)).toBe(true)
  })

  it('🔴 the settlement entry balances when the LEAVER owes the company', () => {
    const lines = settlementPostingLines({
      leaveEncashment: -30_000_000, loanOutstanding: 100_000_000, otherDeductions: 0, total: -130_000_000,
    })
    expect(annualPostingBalanced(lines)).toBe(true)
  })
})

// ── exports ─────────────────────────────────────────────────────────────────

// ── sick leave split ─────────────────────────────────────────────────────

describe('sick leave pay split', () => {
  const opts = { employerThresholdDays: 3, insuranceRatePercent: 100 }

  it('a short sick leave is entirely at employer cost', () => {
    const r = splitSickLeave(2, 10_000_000, opts)
    expect(r).toMatchObject({ employerDays: 2, insuranceDays: 0, employerAmount: 20_000_000, insuranceAmount: 0 })
  })

  it('🔴 a long sick leave splits at the threshold', () => {
    const r = splitSickLeave(10, 10_000_000, opts)
    expect(r.employerDays).toBe(3)
    expect(r.insuranceDays).toBe(7)
    expect(r.employerAmount).toBe(30_000_000)
    expect(r.insuranceAmount).toBe(70_000_000)
  })

  it('the threshold and rate are parameters — changing them changes the split', () => {
    const r = splitSickLeave(10, 10_000_000, { employerThresholdDays: 5, insuranceRatePercent: 80 })
    expect(r.employerDays).toBe(5)
    expect(r.insuranceAmount).toBe(5 * 10_000_000 * 0.8)
  })

  it('zero days splits to nothing', () => {
    expect(splitSickLeave(0, 10_000_000, opts)).toMatchObject({ employerDays: 0, insuranceDays: 0 })
  })
})

// ── 🔴 bank payment ──────────────────────────────────────────────────────

describe('🔴 IBAN check digit', () => {
  it('accepts a structurally valid IBAN with the correct check digit', () => {
    // A known-valid Iranian IBAN (mod-97 check digit verified).
    expect(ibanCheckDigitValid('IR062960000000100324200001')).toBe(true)
  })
  it('rejects a transposed digit that the format regex alone would accept', () => {
    // Swap two digits in the account body — still IR + 24 digits, wrong check.
    expect(ibanCheckDigitValid('IR062960000000100324200010')).toBe(false)
  })
  it('rejects a malformed IBAN outright', () => {
    expect(ibanCheckDigitValid('IR123')).toBe(false)
    expect(ibanCheckDigitValid('GB062960000000100324200001')).toBe(false)
  })
})

describe('🔴 bank batch line validation refuses rather than silently drops', () => {
  const base = { employeeId: 1, employeeName: 'حسین', iban: 'IR062960000000100324200001', amount: 1_000_000 }

  it('accepts a valid line', () => {
    expect(validateBankLines([base])[0]).toMatchObject({ ok: true })
  })
  it('🔴 an employee with no IBAN is refused BY NAME, not dropped silently', () => {
    const r = validateBankLines([{ ...base, iban: null }])[0]
    expect(r).toMatchObject({ ok: false, reason: 'missing_iban', employeeName: 'حسین' })
  })
  it('an invalid IBAN is refused', () => {
    expect(validateBankLines([{ ...base, iban: 'IR000000000000000000000000' }])[0].reason).toBe('invalid_iban')
  })
  it('a non-positive amount is refused', () => {
    expect(validateBankLines([{ ...base, amount: 0 }])[0].reason).toBe('non_positive_amount')
  })
  it('the same employee twice in one batch is refused', () => {
    const results = validateBankLines([base, { ...base }])
    expect(results[1].reason).toBe('duplicate_employee')
  })
})

describe('bank batch settlement posting', () => {
  it('debits salaries payable and credits the bank account', () => {
    const lines = bankBatchPostingLines(500_000_000, '1010')
    expect(annualPostingBalanced(lines)).toBe(true)
    expect(lines.find(l => l.accountCode === '2300')?.debit).toBe(500_000_000)
    expect(lines.find(l => l.accountCode === '1010')?.credit).toBe(500_000_000)
  })
  it('a zero-amount batch posts nothing', () => {
    expect(bankBatchPostingLines(0, '1010')).toEqual([])
  })
})

// ── 🔴 advances ──────────────────────────────────────────────────────────

describe('🔴 advances are not loans', () => {
  it('the cap is a percentage of monthly salary', () => {
    expect(advanceCap(200_000_000, 50)).toBe(100_000_000)
  })
  it('a request within the cap is accepted', () => {
    expect(checkAdvance(50_000_000, 200_000_000, 50)).toMatchObject({ ok: true, cap: 100_000_000 })
  })
  it('🔴 a request beyond the cap is refused, with the cap reported', () => {
    expect(checkAdvance(150_000_000, 200_000_000, 50)).toMatchObject({ ok: false, reason: 'exceeds_cap', cap: 100_000_000 })
  })
  it('a zero cap parameter means no cap enforced', () => {
    expect(checkAdvance(1_000_000_000, 200_000_000, 0).ok).toBe(true)
  })
  it('🔴 an advance exceeding the projected net is flagged, not silently allowed to go negative', () => {
    expect(advanceExceedsNet(100_000_000, 80_000_000)).toBe(true)
    expect(advanceExceedsNet(50_000_000, 80_000_000)).toBe(false)
  })
})

describe('legal exports', () => {
  const columns = [
    { key: 'row', labelFa: 'ردیف' },
    { key: 'name', labelFa: 'نام' },
    { key: 'base', labelFa: 'مبنای بیمه' },
  ]

  it('renders a header and the rows from the configured layout', () => {
    const csv = renderExport([{ row: 1, name: 'حسین', base: 352_000_000 }], columns)
    expect(csv.split('\n')[0]).toBe('ردیف,نام,مبنای بیمه')
    expect(csv.split('\n')[1]).toBe('1,حسین,352000000')
  })

  it('honours a different delimiter and no header', () => {
    const csv = renderExport([{ row: 1, name: 'x', base: 2 }], columns,
      { delimiter: '\t', includeHeader: false })
    expect(csv).toBe('1\tx\t2')
  })

  it('🔴 a column the row lacks becomes EMPTY, never the text "undefined"', () => {
    const csv = renderExport([{ row: 1 }], columns, { includeHeader: false })
    expect(csv).toBe('1,,')
    expect(csv).not.toContain('undefined')
  })

  it('escapes a field containing the delimiter or a quote', () => {
    expect(csvField('a,b', ',')).toBe('"a,b"')
    expect(csvField('say "hi"', ',')).toBe('"say ""hi"""')
    expect(csvField('plain', ',')).toBe('plain')
    expect(csvField(null, ',')).toBe('')
  })

  it('changing the layout changes the file — the column order is data', () => {
    const reordered = [columns[1], columns[0]]
    expect(renderExport([{ row: 1, name: 'x' }], reordered, { includeHeader: false })).toBe('x,1')
  })
})
