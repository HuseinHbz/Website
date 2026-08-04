/**
 * Phase 28.1 — employee/employment engine.
 *
 * The append-only history tests are the important ones: severance and payroll
 * back-calculation read this history, so "which salary was in force on that
 * date?" must be answerable long after the raise.
 */
import { describe, it, expect } from 'vitest'
import {
  employmentOn, currentEmployment, supersede, previousDay, serviceDays, serviceYears,
  validateEmployee, isValidIban, normalizeMobile, maskNationalId, fullName,
  SENSITIVE_EMPLOYEE_FIELDS, type EmploymentRecord,
} from '../employees'

const rec = (o: Partial<EmploymentRecord>): EmploymentRecord => ({
  startDate: '2025-01-01', baseSalary: 0, contractType: 'contract', ...o,
})

describe('employment history is append-only', () => {
  const history = [
    rec({ id: 1, startDate: '2024-01-01', endDate: '2024-12-31', baseSalary: 100_000_000 }),
    rec({ id: 2, startDate: '2025-01-01', endDate: null, baseSalary: 150_000_000 }),
  ]

  it('finds the salary in force on a past date — not the current one', () => {
    expect(employmentOn(history, '2024-06-15')?.baseSalary).toBe(100_000_000)
  })
  it('finds the salary in force today', () => {
    expect(employmentOn(history, '2025-06-15')?.baseSalary).toBe(150_000_000)
  })
  it('answers null before the first record — no salary is not zero salary', () => {
    expect(employmentOn(history, '2023-01-01')).toBeNull()
  })
  it('is exact on the boundary day', () => {
    expect(employmentOn(history, '2024-12-31')?.baseSalary).toBe(100_000_000)
    expect(employmentOn(history, '2025-01-01')?.baseSalary).toBe(150_000_000)
  })
  it('current record is the open one', () => {
    expect(currentEmployment(history)?.id).toBe(2)
  })
  it('with every record closed, the newest is current', () => {
    const closed = [rec({ id: 1, startDate: '2024-01-01', endDate: '2024-06-30' }),
                    rec({ id: 2, startDate: '2024-07-01', endDate: '2024-12-31' })]
    expect(currentEmployment(closed)?.id).toBe(2)
  })
})

describe('supersede', () => {
  it('closes the previous record the day BEFORE the new one starts (no overlap)', () => {
    const history = [rec({ id: 7, startDate: '2024-01-01', endDate: null, baseSalary: 100 })]
    const r = supersede(history, rec({ startDate: '2025-03-01', baseSalary: 200 }))
    expect(r.closeId).toBe(7)
    expect(r.closeDate).toBe('2025-02-28')
  })
  it('the first record closes nothing', () => {
    const r = supersede([], rec({ startDate: '2025-01-01', baseSalary: 100 }))
    expect(r.closeId).toBeUndefined()
  })
  it('handles a leap-year boundary', () => {
    expect(previousDay('2024-03-01')).toBe('2024-02-29')
  })
  it('handles a year boundary', () => {
    expect(previousDay('2025-01-01')).toBe('2024-12-31')
  })
})

describe('service length', () => {
  it('counts days to a given date', () => {
    expect(serviceDays('2024-01-01', null, '2024-01-31')).toBe(30)
  })
  it('counts whole years', () => {
    expect(serviceYears('2020-01-01', null, '2024-01-01')).toBe(4)
  })
  it('uses the termination date when there is one', () => {
    expect(serviceDays('2024-01-01', '2024-01-11', '2030-01-01')).toBe(10)
  })
  it('a future hire date is zero, never negative', () => {
    expect(serviceDays('2030-01-01', null, '2024-01-01')).toBe(0)
  })
})

describe('validation names the field', () => {
  it('requires a name', () => {
    const i = validateEmployee({})
    expect(i.map(x => x.field)).toEqual(expect.arrayContaining(['firstName', 'lastName']))
  })
  it('rejects a national id with a bad check digit', () => {
    const i = validateEmployee({ firstName: 'A', lastName: 'B', nationalId: '1234567890' })
    expect(i.some(x => x.field === 'nationalId')).toBe(true)
  })
  it('accepts a valid national id', () => {
    // 0499370899 satisfies the official check-digit algorithm
    const i = validateEmployee({ firstName: 'A', lastName: 'B', nationalId: '0499370899' })
    expect(i.some(x => x.field === 'nationalId')).toBe(false)
  })
  it('rejects a malformed IBAN', () => {
    expect(validateEmployee({ firstName: 'A', lastName: 'B', iban: 'IR123' }).some(x => x.field === 'iban')).toBe(true)
  })
  it('accepts a valid IBAN', () => {
    expect(isValidIban('IR062960000000100324200001')).toBe(true)
  })
  it('rejects a malformed mobile', () => {
    expect(validateEmployee({ firstName: 'A', lastName: 'B', mobile: '12345' }).some(x => x.field === 'mobile')).toBe(true)
  })
  it('carries a message in BOTH languages', () => {
    const i = validateEmployee({})
    expect(i[0].en.length).toBeGreaterThan(0)
    expect(i[0].fa.length).toBeGreaterThan(0)
  })
})

describe('mobile normalisation', () => {
  it('accepts +98', () => expect(normalizeMobile('+989121234567')).toBe('09121234567'))
  it('accepts 0098', () => expect(normalizeMobile('00989121234567')).toBe('09121234567'))
  it('accepts bare 98', () => expect(normalizeMobile('989121234567')).toBe('09121234567'))
  it('accepts Persian digits', () => expect(normalizeMobile('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567'))
  it('strips separators', () => expect(normalizeMobile('0912-123-4567')).toBe('09121234567'))
})

describe('privacy helpers', () => {
  it('masks a national id for display', () => {
    expect(maskNationalId('0499370899')).toBe('049******9')
  })
  it('never crashes on missing data', () => {
    expect(maskNationalId(null)).toBe('—')
  })
  it('names exactly the columns that must be stripped without the grant', () => {
    expect([...SENSITIVE_EMPLOYEE_FIELDS]).toEqual(['nationalId', 'iban', 'bankAccount', 'insuranceNo'])
  })
  it('builds a full name', () => {
    expect(fullName({ firstName: 'حسین', lastName: 'حبیب‌آذر' })).toBe('حسین حبیب‌آذر')
  })
})
