/**
 * Support-ticket SLA engine (Phase 26.25b بند ۱). PURE + unit-tested. Reuses the
 * shared business-hours + escalation engine (`lib/bi/sla.ts`, jalali holidays) —
 * NO second SLA implementation. The one ticket-specific rule is that the SLA clock
 * PAUSES while the ticket is waiting on the customer (status 'pending'): elapsed
 * business hours exclude every pending interval.
 */
import { businessHoursBetween, slaState, dueSlaEscalations, type BusinessHours, type SlaState, DEFAULT_HOURS } from '@/lib/bi/sla'

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed'

/** SLA response/resolution target in BUSINESS hours, by priority. */
export const TICKET_SLA_HOURS: Record<TicketPriority, number> = { urgent: 4, high: 8, normal: 24, low: 72 }

export function targetHoursFor(priority: string): number {
  return TICKET_SLA_HOURS[(priority as TicketPriority)] ?? TICKET_SLA_HOURS.normal
}

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ['open', 'pending', 'resolved', 'closed'],
  open: ['pending', 'resolved', 'closed'],
  pending: ['open', 'resolved', 'closed'],
  resolved: ['open', 'closed'],   // re-open on a new customer reply
  closed: ['open'],               // re-open a closed ticket
}

export function canTransitionTicket(from: string, to: string): boolean {
  if (from === to) return true
  return (TRANSITIONS[(from as TicketStatus)] ?? []).includes(to as TicketStatus)
}

/** A closed interval [from, to] (ISO strings) during which the clock was paused. */
export interface PausedInterval { from: string; to: string }

/**
 * Active (SLA-counting) business hours = business hours from creation to `now`
 * MINUS the business hours inside every paused ('pending') interval. Clamped ≥ 0.
 */
export function activeBusinessHours(
  createdAt: string,
  now: string,
  paused: PausedInterval[] = [],
  hours: BusinessHours = DEFAULT_HOURS,
  holidays: string[] = [],
): number {
  const gross = businessHoursBetween(createdAt, now, hours, holidays)
  const pausedHours = paused.reduce((s, p) => s + businessHoursBetween(p.from, p.to, hours, holidays), 0)
  return Math.max(0, Math.round((gross - pausedHours) * 100) / 100)
}

export function ticketSlaState(activeHours: number, priority: string): SlaState {
  return slaState(activeHours, targetHoursFor(priority))
}

/** Escalation stages that are now due for a ticket (idempotent via `fired`). */
export function ticketEscalations(activeHours: number, priority: string, fired: number[] = []) {
  return dueSlaEscalations(activeHours, targetHoursFor(priority), fired)
}

/** True when the first agent response already missed its SLA window. */
export function firstResponseBreached(activeHours: number, priority: string, hasFirstResponse: boolean): boolean {
  return !hasFirstResponse && activeHours > targetHoursFor(priority)
}

export function isOpenStatus(status: string): boolean {
  return status === 'new' || status === 'open' || status === 'pending'
}
