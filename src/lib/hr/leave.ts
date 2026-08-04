/**
 * Phase 28.2 — leave, attendance and overtime engine.
 *
 * Three rules shape this module:
 *
 * 1. **A leave balance is a LEDGER, not a counter** (the 27 loyalty lesson).
 *    Accrual, use, carry-over, payout and reversal are signed rows; the balance
 *    is their sum. That is what makes cancelling an approved leave correct —
 *    the days come back as a `reversal` while the original `use` row stays, so
 *    the history still explains itself.
 *
 * 2. **Working days are computed, never assumed.** The Iranian week rests on
 *    Friday and public holidays move every year, so both the working-day set
 *    and the holiday list are INPUTS. A function that hardcodes them is wrong
 *    the following year and nobody notices until payroll.
 *
 * 3. **Overtime multipliers are statutory.** They are named constants with the
 *    law behind them, and they are what payroll (28.3) will read.
 *
 * Everything here is pure.
 */

export const LEAVE_TX_KINDS = ['accrual', 'use', 'carry_over', 'payout', 'adjust', 'reversal'] as const
export type LeaveTxKind = typeof LEAVE_TX_KINDS[number]

export const OVERTIME_KINDS = ['normal', 'holiday', 'night'] as const
export type OvertimeKind = typeof OVERTIME_KINDS[number]

export const OVERTIME_LABELS: Record<OvertimeKind, { en: string; fa: string }> = {
  normal:  { en: 'Ordinary overtime', fa: 'اضافه‌کار عادی' },
  holiday: { en: 'Holiday work',      fa: 'کار در تعطیلات' },
  night:   { en: 'Night shift',       fa: 'شب‌کاری' },
}

/**
 * Statutory overtime multipliers (Iranian labour law).
 *
 * Ordinary overtime is 1.4× the hourly rate (قانون کار مادهٔ ۵۹). Holiday and
 * night work carry higher factors. These are DEFAULTS that payroll may override
 * per contract — but they are named here so the number is never anonymous.
 */
export const OVERTIME_MULTIPLIERS: Record<OvertimeKind, number> = {
  normal: 1.4,
  holiday: 1.96,   // 1.4 × 1.4
  night: 1.75,     // 1.4 × 1.25 (night premium)
}

export const LEAVE_REQUEST_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'cancelled'] as const
export type LeaveRequestStatus = typeof LEAVE_REQUEST_STATUSES[number]

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, { en: string; fa: string }> = {
  draft:     { en: 'Draft',     fa: 'پیش‌نویس' },
  pending:   { en: 'Pending',   fa: 'در انتظار تأیید' },
  approved:  { en: 'Approved',  fa: 'تأییدشده' },
  rejected:  { en: 'Rejected',  fa: 'رد شده' },
  cancelled: { en: 'Cancelled', fa: 'لغو شده' },
}

// ── working days ────────────────────────────────────────────────────────────

/**
 * Day index in the Iranian week: 0 = Saturday … 6 = Friday.
 *
 * JavaScript's `getUTCDay()` is 0 = Sunday, so this is not a cosmetic rename —
 * getting it wrong shifts the whole week and quietly changes every leave count.
 */
export function iranianWeekday(iso: string): number {
  const jsDay = new Date(`${iso}T00:00:00Z`).getUTCDay()  // 0=Sun … 6=Sat
  return (jsDay + 1) % 7                                   // 0=Sat … 6=Fri
}

/** Parse `"0,1,2,3,4"` into a set of working weekday indices. */
export function parseWorkingDays(csv: string): Set<number> {
  return new Set(csv.split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))
}

export interface CalendarContext {
  /** Iranian weekday indices that are working days (0=Sat … 6=Fri). */
  workingDays: Set<number>
  /** ISO dates that are holidays — supplied by the caller, never hardcoded. */
  holidays: Set<string>
}

/** Is this a working day? A holiday is never a working day, even midweek. */
export function isWorkingDay(iso: string, ctx: CalendarContext): boolean {
  if (ctx.holidays.has(iso)) return false
  return ctx.workingDays.has(iranianWeekday(iso))
}

/** Every ISO date in an inclusive range. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  if (!(start <= end)) return out
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/**
 * Working days in an inclusive range.
 *
 * This is the number a leave request actually consumes: a Wednesday-to-Sunday
 * absence is not five days off the balance if Friday is a rest day and Thursday
 * is a holiday.
 */
export function workingDaysBetween(from: string, to: string, ctx: CalendarContext): number {
  return datesBetween(from, to).filter(d => isWorkingDay(d, ctx)).length
}

/** Days a leave request consumes; a half day counts as 0.5. */
export function leaveDays(from: string, to: string, ctx: CalendarContext, halfDay = false): number {
  const days = workingDaysBetween(from, to, ctx)
  if (halfDay && days === 1) return 0.5
  return days
}

// ── balance ledger ──────────────────────────────────────────────────────────

export interface LeaveTx {
  kind: LeaveTxKind
  /** Signed: accrual/carry-over positive, use/payout/reversal negative. */
  days: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Balance is derived from the ledger, never stored as the truth. */
export function leaveBalance(txs: LeaveTx[]): number {
  return round2(txs.reduce((s, t) => s + (t.days || 0), 0))
}

export function leaveAccrued(txs: LeaveTx[]): number {
  return round2(txs.filter(t => t.days > 0).reduce((s, t) => s + t.days, 0))
}

export function leaveUsed(txs: LeaveTx[]): number {
  return round2(Math.abs(txs.filter(t => t.days < 0).reduce((s, t) => s + t.days, 0)))
}

/**
 * Accrual for a number of whole months of service.
 *
 * The labour-law default is 2.5 days per month (30 days a year), but the rate
 * is a parameter because contracts differ.
 */
export function accrualForMonths(months: number, perMonth: number): number {
  if (months <= 0 || perMonth <= 0) return 0
  return round2(months * perMonth)
}

/** The reversal for a cancelled leave: gives back exactly what was taken. */
export function reversalForLeave(usedDays: number): number {
  return Math.abs(round2(usedDays))
}

export interface LeaveCheck {
  ok: boolean
  reason?: 'invalid_range' | 'no_working_days' | 'insufficient_balance' | 'exceeds_annual_cap'
  days: number
}

/**
 * Can this leave be taken?
 *
 * Refuses rather than truncating: silently approving fewer days than the
 * employee asked for is how someone ends up marked absent for a day they
 * believed was approved.
 */
export function checkLeave(
  from: string, to: string, ctx: CalendarContext,
  opts: {
    balance: number
    deductsBalance: boolean
    halfDay?: boolean
    maxDaysPerYear?: number | null
    usedThisYear?: number
  },
): LeaveCheck {
  if (!from || !to || from > to) return { ok: false, reason: 'invalid_range', days: 0 }
  const days = leaveDays(from, to, ctx, opts.halfDay)
  // A request landing entirely on holidays consumes nothing — and is almost
  // certainly a mistake worth telling the employee about.
  if (days <= 0) return { ok: false, reason: 'no_working_days', days: 0 }
  if (opts.deductsBalance && days > opts.balance) {
    return { ok: false, reason: 'insufficient_balance', days }
  }
  if (opts.maxDaysPerYear != null && (opts.usedThisYear ?? 0) + days > opts.maxDaysPerYear) {
    return { ok: false, reason: 'exceeds_annual_cap', days }
  }
  return { ok: true, days }
}

export const LEAVE_REFUSAL_LABELS: Record<NonNullable<LeaveCheck['reason']>, { en: string; fa: string }> = {
  invalid_range:        { en: 'The end date is before the start date', fa: 'تاریخ پایان قبل از تاریخ شروع است' },
  no_working_days:      { en: 'This range contains no working days', fa: 'در این بازه هیچ روز کاری وجود ندارد' },
  insufficient_balance: { en: 'Not enough leave balance', fa: 'مانده مرخصی کافی نیست' },
  exceeds_annual_cap:   { en: 'This exceeds the annual limit for this leave type', fa: 'از سقف سالانهٔ این نوع مرخصی بیشتر است' },
}

export function leaveRefusalMessage(reason: NonNullable<LeaveCheck['reason']>, fa: boolean): string {
  const m = LEAVE_REFUSAL_LABELS[reason]
  return fa ? m.fa : m.en
}

// ── attendance ──────────────────────────────────────────────────────────────

/** Minutes since midnight for `HH:MM`; null when unparseable. */
export function minutesOf(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export interface AttendanceResult {
  workedMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
}

/**
 * Work out a day's attendance against the expected shift.
 *
 * An overnight shift (check-out before check-in) is treated as crossing
 * midnight rather than as a negative day, which is what a real night shift is.
 */
export function computeAttendance(
  checkIn: string | null, checkOut: string | null,
  shift: { start: string; end: string; graceMinutes?: number },
): AttendanceResult {
  const inM = minutesOf(checkIn)
  const outM = minutesOf(checkOut)
  const startM = minutesOf(shift.start) ?? 0
  const endM = minutesOf(shift.end) ?? 0
  const grace = shift.graceMinutes ?? 0

  if (inM == null || outM == null) return { workedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0 }

  const adjustedOut = outM < inM ? outM + 24 * 60 : outM
  const worked = Math.max(0, adjustedOut - inM)
  const late = Math.max(0, inM - (startM + grace))
  const early = Math.max(0, endM - adjustedOut)
  return { workedMinutes: worked, lateMinutes: late, earlyLeaveMinutes: early }
}

/** Overtime value in currency for payroll (28.3 reads this). */
export function overtimeValue(hours: number, hourlyRate: number, kind: OvertimeKind): number {
  if (hours <= 0 || hourlyRate <= 0) return 0
  return round2(hours * hourlyRate * OVERTIME_MULTIPLIERS[kind])
}

/** Hourly rate from a monthly salary and the contracted monthly hours. */
export function hourlyRate(monthlySalary: number, monthlyHours: number): number {
  if (monthlyHours <= 0) return 0
  return round2(monthlySalary / monthlyHours)
}
