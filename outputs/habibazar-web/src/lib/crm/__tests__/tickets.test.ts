import { describe, it, expect } from 'vitest'
import {
  targetHoursFor, canTransitionTicket, activeBusinessHours, ticketSlaState,
  ticketEscalations, firstResponseBreached, isOpenStatus, TICKET_SLA_HOURS,
} from '../tickets'

describe('tickets SLA engine (26.25b بند ۱)', () => {
  it('maps priority → target business hours', () => {
    expect(targetHoursFor('urgent')).toBe(4)
    expect(targetHoursFor('high')).toBe(8)
    expect(targetHoursFor('normal')).toBe(24)
    expect(targetHoursFor('low')).toBe(72)
    expect(targetHoursFor('nonsense')).toBe(TICKET_SLA_HOURS.normal)
  })

  it('enforces the status state machine', () => {
    expect(canTransitionTicket('new', 'open')).toBe(true)
    expect(canTransitionTicket('open', 'pending')).toBe(true)
    expect(canTransitionTicket('pending', 'open')).toBe(true)
    expect(canTransitionTicket('resolved', 'closed')).toBe(true)
    expect(canTransitionTicket('closed', 'open')).toBe(true)     // re-open allowed
    expect(canTransitionTicket('new', 'new')).toBe(true)         // no-op allowed
    expect(canTransitionTicket('closed', 'pending')).toBe(false) // not allowed
  })

  it('pauses the SLA clock during pending intervals', () => {
    // Wed 2026-07-15 08:00 → 16:00 = 8 business hours (working day Sat–Wed).
    const created = '2026-07-15T08:00:00Z'
    const now = '2026-07-15T16:00:00Z'
    const noPause = activeBusinessHours(created, now, [])
    expect(noPause).toBeGreaterThan(7); expect(noPause).toBeLessThanOrEqual(8)
    // Pause 10:00→14:00 (4 business hours) → active ≈ 4.
    const paused = activeBusinessHours(created, now, [{ from: '2026-07-15T10:00:00Z', to: '2026-07-15T14:00:00Z' }])
    expect(paused).toBeCloseTo(noPause - 4, 1)
    expect(paused).toBeGreaterThanOrEqual(0)
  })

  it('computes SLA state vs target', () => {
    expect(ticketSlaState(2, 'urgent')).toBe('within')     // 2h < 4h*0.75=3
    expect(ticketSlaState(3.5, 'urgent')).toBe('due_soon')  // between 75% and 100%
    expect(ticketSlaState(5, 'urgent')).toBe('breached')    // over 4h
  })

  it('fires escalation stages once (idempotent via fired)', () => {
    const overdue = ticketEscalations(10, 'urgent', [])     // 10h vs 4h → all stages due
    expect(overdue.length).toBeGreaterThan(0)
    const topLevel = Math.max(...overdue.map(s => s.level))
    const already = ticketEscalations(10, 'urgent', Array.from({ length: topLevel }, (_, i) => i + 1))
    expect(already.length).toBe(0)                          // nothing new to fire
  })

  it('flags a missed first response', () => {
    expect(firstResponseBreached(5, 'urgent', false)).toBe(true)  // 5h > 4h, no reply
    expect(firstResponseBreached(5, 'urgent', true)).toBe(false)  // already responded
    expect(firstResponseBreached(2, 'urgent', false)).toBe(false) // still within
  })

  it('identifies open vs terminal statuses', () => {
    expect(isOpenStatus('new')).toBe(true)
    expect(isOpenStatus('pending')).toBe(true)
    expect(isOpenStatus('resolved')).toBe(false)
    expect(isOpenStatus('closed')).toBe(false)
  })
})
