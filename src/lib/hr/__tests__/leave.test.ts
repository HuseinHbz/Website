/**
 * Phase 28.2 — leave/attendance engine.
 *
 * The working-day tests matter most: every leave figure and, later, every
 * payroll deduction is built on them, and getting the Iranian week wrong
 * shifts all of it by one day without ever throwing.
 */
import { describe, it, expect } from 'vitest'
import {
  iranianWeekday, parseWorkingDays, isWorkingDay, datesBetween, workingDaysBetween,
  leaveDays, leaveBalance, leaveAccrued, leaveUsed, accrualForMonths, reversalForLeave,
  checkLeave, leaveRefusalMessage, minutesOf, computeAttendance, overtimeValue, hourlyRate,
  OVERTIME_MULTIPLIERS, type LeaveTx,
} from '../leave'

// Iran: Sat–Wed working, Thu–Fri off (a common configuration)
const ctx = (holidays: string[] = []) => ({
  workingDays: parseWorkingDays('0,1,2,3,4'),
  holidays: new Set(holidays),
})

describe('Iranian weekday indexing', () => {
  // 2026-08-01 is a Saturday
  it('Saturday is 0', () => expect(iranianWeekday('2026-08-01')).toBe(0))
  it('Sunday is 1', () => expect(iranianWeekday('2026-08-02')).toBe(1))
  it('Thursday is 5', () => expect(iranianWeekday('2026-08-06')).toBe(5))
  it('Friday is 6 — the weekly rest day', () => expect(iranianWeekday('2026-08-07')).toBe(6))
})

describe('working days', () => {
  it('Friday is not a working day', () => {
    expect(isWorkingDay('2026-08-07', ctx())).toBe(false)
  })
  it('Saturday is', () => {
    expect(isWorkingDay('2026-08-01', ctx())).toBe(true)
  })
  it('a holiday is NOT a working day even midweek', () => {
    expect(isWorkingDay('2026-08-03', ctx(['2026-08-03']))).toBe(false)
  })
  it('counts a full Sat–Wed week as 5 days', () => {
    expect(workingDaysBetween('2026-08-01', '2026-08-05', ctx())).toBe(5)
  })
  it('excludes Thursday and Friday from a full calendar week', () => {
    // Sat 01 → Fri 07 is 7 calendar days but 5 working days
    expect(datesBetween('2026-08-01', '2026-08-07')).toHaveLength(7)
    expect(workingDaysBetween('2026-08-01', '2026-08-07', ctx())).toBe(5)
  })
  it('subtracts a public holiday from the count', () => {
    expect(workingDaysBetween('2026-08-01', '2026-08-05', ctx(['2026-08-03']))).toBe(4)
  })
  it('a reversed range is zero, never negative', () => {
    expect(workingDaysBetween('2026-08-05', '2026-08-01', ctx())).toBe(0)
  })
  it('a single working day is 1', () => {
    expect(workingDaysBetween('2026-08-01', '2026-08-01', ctx())).toBe(1)
  })
  it('a half day counts as 0.5', () => {
    expect(leaveDays('2026-08-01', '2026-08-01', ctx(), true)).toBe(0.5)
  })
  it('a half-day flag on a multi-day range is ignored', () => {
    expect(leaveDays('2026-08-01', '2026-08-05', ctx(), true)).toBe(5)
  })
})

describe('balance is the ledger', () => {
  const tx = (days: number, kind: LeaveTx['kind'] = 'accrual'): LeaveTx => ({ kind, days })

  it('sums signed movements', () => {
    expect(leaveBalance([tx(30), tx(-5, 'use'), tx(2.5)])).toBe(27.5)
  })
  it('an empty ledger is zero, not NaN', () => {
    expect(leaveBalance([])).toBe(0)
  })
  it('separates accrued from used', () => {
    const l = [tx(30), tx(-8, 'use'), tx(2.5)]
    expect(leaveAccrued(l)).toBe(32.5)
    expect(leaveUsed(l)).toBe(8)
  })
  it('accrues per month at the configured rate', () => {
    expect(accrualForMonths(12, 2.5)).toBe(30)
  })
  it('accrues nothing for zero months or a zero rate', () => {
    expect(accrualForMonths(0, 2.5)).toBe(0)
    expect(accrualForMonths(12, 0)).toBe(0)
  })

  it('CANCELLING an approved leave gives the days back and keeps the history', () => {
    const ledger = [tx(30), tx(-5, 'use'), tx(reversalForLeave(5), 'reversal')]
    expect(leaveBalance(ledger)).toBe(30)
    // the original `use` row survives — the ledger still explains itself
    expect(ledger.filter(t => t.kind === 'use')).toHaveLength(1)
    expect(leaveUsed(ledger)).toBe(5)
  })
})

describe('checkLeave refuses rather than truncating', () => {
  const base = { balance: 10, deductsBalance: true }

  it('accepts a request within balance', () => {
    expect(checkLeave('2026-08-01', '2026-08-05', ctx(), base)).toMatchObject({ ok: true, days: 5 })
  })
  it('refuses a reversed range', () => {
    expect(checkLeave('2026-08-05', '2026-08-01', ctx(), base).reason).toBe('invalid_range')
  })
  it('refuses a range with no working days — probably a mistake worth saying', () => {
    expect(checkLeave('2026-08-06', '2026-08-07', ctx(), base).reason).toBe('no_working_days')
  })
  it('refuses when the balance is short — does NOT approve fewer days', () => {
    const r = checkLeave('2026-08-01', '2026-08-12', ctx(), { balance: 3, deductsBalance: true })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('insufficient_balance')
    expect(r.days).toBeGreaterThan(3)      // it reports what was asked for
  })
  it('sick leave does not need a balance', () => {
    expect(checkLeave('2026-08-01', '2026-08-05', ctx(), { balance: 0, deductsBalance: false }).ok).toBe(true)
  })
  it('enforces an annual cap', () => {
    const r = checkLeave('2026-08-01', '2026-08-05', ctx(),
      { balance: 100, deductsBalance: true, maxDaysPerYear: 6, usedThisYear: 3 })
    expect(r.reason).toBe('exceeds_annual_cap')
  })
  it('explains a refusal in the reader’s language', () => {
    expect(leaveRefusalMessage('insufficient_balance', true)).toBe('مانده مرخصی کافی نیست')
    expect(leaveRefusalMessage('insufficient_balance', false)).toBe('Not enough leave balance')
  })
})

describe('attendance', () => {
  const shift = { start: '08:00', end: '17:00', graceMinutes: 15 }

  it('computes worked minutes', () => {
    expect(computeAttendance('08:00', '17:00', shift).workedMinutes).toBe(540)
  })
  it('does not flag lateness inside the grace period', () => {
    expect(computeAttendance('08:10', '17:00', shift).lateMinutes).toBe(0)
  })
  it('flags lateness beyond the grace period', () => {
    expect(computeAttendance('08:45', '17:00', shift).lateMinutes).toBe(30)
  })
  it('flags an early departure', () => {
    expect(computeAttendance('08:00', '16:30', shift).earlyLeaveMinutes).toBe(30)
  })
  it('treats an overnight shift as crossing midnight, not as a negative day', () => {
    const r = computeAttendance('22:00', '06:00', { start: '22:00', end: '06:00' })
    expect(r.workedMinutes).toBe(480)
  })
  it('a missing punch yields zeros rather than a wrong number', () => {
    expect(computeAttendance('08:00', null, shift)).toEqual({ workedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0 })
  })
  it('rejects an unparseable time', () => {
    expect(minutesOf('25:00')).toBeNull()
    expect(minutesOf('abc')).toBeNull()
  })
})

describe('overtime', () => {
  it('ordinary overtime is 1.4× (قانون کار مادهٔ ۵۹)', () => {
    expect(OVERTIME_MULTIPLIERS.normal).toBe(1.4)
    expect(overtimeValue(10, 100_000, 'normal')).toBe(1_400_000)
  })
  it('holiday work is paid at a higher factor than ordinary', () => {
    expect(OVERTIME_MULTIPLIERS.holiday).toBeGreaterThan(OVERTIME_MULTIPLIERS.normal)
  })
  it('night work is paid at a higher factor than ordinary', () => {
    expect(OVERTIME_MULTIPLIERS.night).toBeGreaterThan(OVERTIME_MULTIPLIERS.normal)
  })
  it('zero hours is zero value', () => {
    expect(overtimeValue(0, 100_000, 'normal')).toBe(0)
  })
  it('derives an hourly rate from a monthly salary', () => {
    expect(hourlyRate(220_000_000, 220)).toBe(1_000_000)
  })
  it('a zero contracted-hours month cannot divide by zero', () => {
    expect(hourlyRate(220_000_000, 0)).toBe(0)
  })
})
