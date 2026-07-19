/**
 * Customer receivables — AR aging + credit guard (Phase 26.25 بند ۱.۲/۱.۳).
 * Pure functions over already-computed open-invoice facts (the data layer pulls
 * posted sales invoices + payments from the GL/sub-ledger; these engines only do
 * the bucketing and the credit decision). No DB here → fully unit-testable.
 */

export interface OpenInvoiceFact {
  /** Outstanding (unpaid) amount on this invoice, in the base currency. */
  outstanding: number
  /** Invoice due date (YYYY-MM-DD); falls back to the issue date when absent. */
  dueDate: string
}

export interface AgingBuckets {
  current: number   // not yet due / 0–30 days overdue
  d31_60: number
  d61_90: number
  d90plus: number
  total: number
}

/** Whole days between two ISO dates (a − b), floored, never negative-clamped. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(a) - Date.parse(b)
  return Math.floor(ms / 86_400_000)
}

/**
 * Bucket a customer's open invoices by how overdue they are, as of `asOf`.
 * Bucket by days PAST the due date: ≤30 current, 31–60, 61–90, >90.
 */
export function agingBuckets(invoices: OpenInvoiceFact[], asOf: string): AgingBuckets {
  const b: AgingBuckets = { current: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 }
  for (const inv of invoices) {
    const amt = Math.round(inv.outstanding * 100) / 100
    if (amt <= 0) continue
    const overdue = daysBetween(asOf, inv.dueDate)
    if (overdue <= 30) b.current += amt
    else if (overdue <= 60) b.d31_60 += amt
    else if (overdue <= 90) b.d61_90 += amt
    else b.d90plus += amt
    b.total += amt
  }
  for (const k of Object.keys(b) as (keyof AgingBuckets)[]) b[k] = Math.round(b[k] * 100) / 100
  return b
}

export type CreditGuardMode = 'off' | 'warn' | 'block'

export interface CreditDecision {
  /** True when the transaction may proceed (always true unless mode='block'). */
  allowed: boolean
  /** True when the projected balance exceeds the limit (drives the alert). */
  exceeded: boolean
  limit: number
  currentBalance: number
  projected: number
  available: number
  mode: CreditGuardMode
}

/**
 * Credit guard for confirming a sales invoice (بند ۱.۳). A zero/absent limit
 * means "no limit" → never exceeded (backward compatible). `mode` comes from
 * erp_settings.credit_guard_mode: off (silent) · warn (allow + alert) · block
 * (reject when exceeded).
 */
export function creditDecision(input: {
  creditLimit: number
  currentBalance: number
  newAmount: number
  mode: CreditGuardMode
}): CreditDecision {
  const limit = Math.max(0, input.creditLimit)
  const projected = Math.round((input.currentBalance + input.newAmount) * 100) / 100
  const noLimit = limit <= 0
  const exceeded = !noLimit && projected > limit
  const allowed = !(exceeded && input.mode === 'block')
  return {
    allowed,
    exceeded,
    limit,
    currentBalance: Math.round(input.currentBalance * 100) / 100,
    projected,
    available: noLimit ? Infinity : Math.round((limit - input.currentBalance) * 100) / 100,
    mode: input.mode,
  }
}
