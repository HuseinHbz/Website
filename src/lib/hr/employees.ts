/**
 * Phase 28.1 — the employee/employment engine.
 *
 * Two rules shape this module:
 *
 * 1. **Employment history is append-only.** A raise or a promotion writes a NEW
 *    row and closes the previous one; nothing is overwritten. This is not
 *    tidiness — severance (سنوات) and any payroll back-calculation are computed
 *    FROM this history, so an overwritten salary silently changes what the
 *    company owes for months already worked.
 *
 * 2. **Sensitive fields are removed from the payload, never hidden in the UI**
 *    (26.28). National id and bank details are listed here so both the API and
 *    the tests agree on exactly which columns that means.
 *
 * Pure — no I/O — so the rules are testable without a database.
 */
import { isValidIranNationalId } from '@/lib/masterdata/quality'

export const CONTRACT_TYPES = ['permanent', 'fixed_term', 'contract', 'hourly', 'intern'] as const
export type ContractType = typeof CONTRACT_TYPES[number]

export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'terminated'] as const
export type EmployeeStatus = typeof EMPLOYEE_STATUSES[number]

export const CONTRACT_LABELS: Record<ContractType, { en: string; fa: string }> = {
  permanent:  { en: 'Permanent',   fa: 'رسمی' },
  fixed_term: { en: 'Fixed term',  fa: 'پیمانی' },
  contract:   { en: 'Contract',    fa: 'قراردادی' },
  hourly:     { en: 'Hourly',      fa: 'ساعتی' },
  intern:     { en: 'Intern',      fa: 'کارآموز' },
}

export const STATUS_LABELS: Record<EmployeeStatus, { en: string; fa: string }> = {
  active:     { en: 'Active',      fa: 'شاغل' },
  on_leave:   { en: 'On leave',    fa: 'در مرخصی' },
  terminated: { en: 'Terminated',  fa: 'ترک خدمت' },
}

/**
 * Columns that must be ABSENT from an API response without
 * `hr.employees:sensitive_view`. Named once so route, test and audit agree.
 */
export const SENSITIVE_EMPLOYEE_FIELDS = ['nationalId', 'iban', 'bankAccount', 'insuranceNo'] as const

export interface EmploymentRecord {
  id?: number
  startDate: string
  endDate?: string | null
  baseSalary: number
  contractType: ContractType
  positionId?: number | null
}

/** The record in force on a given date — the one payroll must read. */
export function employmentOn(history: EmploymentRecord[], onDate: string): EmploymentRecord | null {
  const applicable = history
    .filter(h => h.startDate <= onDate && (!h.endDate || h.endDate >= onDate))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
  return applicable[0] ?? null
}

/** The current record — the latest one with no end date, else the newest. */
export function currentEmployment(history: EmploymentRecord[]): EmploymentRecord | null {
  const open = history.filter(h => !h.endDate).sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
  if (open.length) return open[0]
  return [...history].sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0] ?? null
}

/**
 * Close the record in force and open a new one.
 *
 * Returns BOTH sides so the caller writes them in one transaction: the closing
 * date on the old row and the new row. An overlap here would mean two salaries
 * in force on the same day, which payroll cannot resolve.
 */
export function supersede(
  history: EmploymentRecord[],
  next: Omit<EmploymentRecord, 'id'>,
): { closeId?: number; closeDate?: string; open: Omit<EmploymentRecord, 'id'> } {
  const current = currentEmployment(history)
  if (!current || !current.id) return { open: next }
  // The previous record ends the day before the new one starts.
  const close = previousDay(next.startDate)
  return { closeId: current.id, closeDate: close, open: next }
}

/** ISO date minus one day. Pure and calendar-correct across month boundaries. */
export function previousDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Days of service — the basis for severance. `asOf` defaults to today. */
export function serviceDays(hireDate: string, endDate?: string | null, asOf?: string): number {
  const to = endDate || asOf || new Date().toISOString().slice(0, 10)
  const from = new Date(`${hireDate}T00:00:00Z`).getTime()
  const until = new Date(`${to}T00:00:00Z`).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(until) || until < from) return 0
  return Math.floor((until - from) / 86_400_000)
}

/** Whole years of service, used for entitlements that step per year. */
export function serviceYears(hireDate: string, endDate?: string | null, asOf?: string): number {
  return Math.floor(serviceDays(hireDate, endDate, asOf) / 365)
}

export interface EmployeeInput {
  employeeCode?: string
  firstName?: string
  lastName?: string
  nationalId?: string | null
  mobile?: string | null
  email?: string | null
  hireDate?: string | null
  iban?: string | null
}

export type ValidationIssue = { field: string; en: string; fa: string }

/**
 * Validate an employee payload.
 *
 * Returns the FIELD NAME with each message so the API can answer a 400 that
 * names what is wrong (26.29), rather than a generic failure the operator has
 * to guess at.
 */
export function validateEmployee(d: EmployeeInput, opts: { requireIdentity?: boolean } = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (opts.requireIdentity !== false) {
    if (!d.firstName?.trim()) issues.push({ field: 'firstName', en: 'First name is required', fa: 'نام الزامی است' })
    if (!d.lastName?.trim()) issues.push({ field: 'lastName', en: 'Last name is required', fa: 'نام خانوادگی الزامی است' })
  }
  // A national id that is present must be REAL — a typo here propagates into
  // the tax and insurance filings, where it becomes someone else's problem.
  if (d.nationalId && !isValidIranNationalId(d.nationalId)) {
    issues.push({ field: 'nationalId', en: 'National ID check digit is invalid', fa: 'کد ملی معتبر نیست' })
  }
  if (d.iban && !isValidIban(d.iban)) {
    issues.push({ field: 'iban', en: 'IBAN must be IR followed by 24 digits', fa: 'شبا باید IR و ۲۴ رقم باشد' })
  }
  if (d.mobile && !/^09\d{9}$/.test(normalizeMobile(d.mobile))) {
    issues.push({ field: 'mobile', en: 'Mobile must be an 11-digit 09… number', fa: 'موبایل باید ۱۱ رقمی و با ۰۹ شروع شود' })
  }
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    issues.push({ field: 'email', en: 'Email is not valid', fa: 'ایمیل معتبر نیست' })
  }
  return issues
}

/** Iranian IBAN: IR + 24 digits. */
export function isValidIban(v: string | null | undefined): boolean {
  if (!v) return false
  return /^IR\d{24}$/i.test(v.replace(/[\s-]/g, ''))
}

/** Accept +98/0098/98 forms and Persian digits; return the 09xxxxxxxxx form. */
export function normalizeMobile(v: string): string {
  const latin = v.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const digits = latin.replace(/[^\d+]/g, '')
  if (digits.startsWith('+98')) return '0' + digits.slice(3)
  if (digits.startsWith('0098')) return '0' + digits.slice(4)
  if (digits.startsWith('98') && digits.length === 12) return '0' + digits.slice(2)
  return digits
}

/** Display masking for a national id — `123******9`. Never the storage form. */
export function maskNationalId(v: string | null | undefined): string {
  if (!v || v.length < 4) return '—'
  return `${v.slice(0, 3)}${'*'.repeat(Math.max(0, v.length - 4))}${v.slice(-1)}`
}

/** Full name in the reader's order. */
export function fullName(e: { firstName?: string | null; lastName?: string | null }): string {
  return [e.firstName, e.lastName].filter(Boolean).join(' ').trim()
}
