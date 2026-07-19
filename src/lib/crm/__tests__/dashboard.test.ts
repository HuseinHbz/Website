import { describe, it, expect } from 'vitest'
import { momChange, monthBounds } from '../dashboard'

describe('crm dashboard MoM (26.25b بند ۲)', () => {
  it('computes percentage delta + direction', () => {
    expect(momChange(120, 100)).toEqual({ current: 120, previous: 100, deltaPct: 20, direction: 'up' })
    expect(momChange(80, 100)).toEqual({ current: 80, previous: 100, deltaPct: -20, direction: 'down' })
    expect(momChange(100, 100)).toEqual({ current: 100, previous: 100, deltaPct: 0, direction: 'flat' })
  })

  it('returns null deltaPct when there is no baseline (no fake %)', () => {
    const r = momChange(50, 0)
    expect(r.deltaPct).toBeNull()
    expect(r.direction).toBe('up')
  })

  it('derives current/previous month bounds', () => {
    const b = monthBounds(new Date('2026-07-15T00:00:00Z'))
    expect(b.curStart).toBe('2026-07-01')
    expect(b.prevStart).toBe('2026-06-01')
    expect(b.prevEnd).toBe('2026-07-01')
  })

  it('handles the January → previous-December year rollover', () => {
    const b = monthBounds(new Date('2026-01-10T00:00:00Z'))
    expect(b.curStart).toBe('2026-01-01')
    expect(b.prevStart).toBe('2025-12-01')
  })
})
