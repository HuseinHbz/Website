import { describe, it, expect } from 'vitest'
import { scoreLead, isOpen, pipelineStats } from '../leads'

describe('CRM lead scoring', () => {
  it('is deterministic and bounded 0–100', () => {
    const lead = { name: 'A', email: 'a@b.com', phone: '123', company: 'ACME', source: 'referral' as const, status: 'qualified' as const, value: 50000 }
    const s = scoreLead(lead)
    expect(s).toBe(scoreLead(lead)) // deterministic
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThanOrEqual(100)
  })

  it('rewards completeness and warmer sources', () => {
    const bare = scoreLead({ name: 'X', source: 'other', status: 'new' })
    const rich = scoreLead({ name: 'X', email: 'e@e.com', phone: '1', company: 'C', source: 'referral', status: 'new' })
    expect(rich).toBeGreaterThan(bare)
  })

  it('rewards pipeline progress', () => {
    const base = { name: 'X', email: 'e@e.com', source: 'website' as const }
    expect(scoreLead({ ...base, status: 'proposal' })).toBeGreaterThan(scoreLead({ ...base, status: 'new' }))
  })

  it('isOpen excludes won/lost', () => {
    expect(isOpen('qualified')).toBe(true)
    expect(isOpen('won')).toBe(false)
    expect(isOpen('lost')).toBe(false)
  })

  it('pipelineStats aggregates value, win rate and averages', () => {
    const stats = pipelineStats([
      { status: 'won', value: 1000, score: 80 },
      { status: 'lost', value: 500, score: 20 },
      { status: 'qualified', value: 2000, score: 60 },
    ])
    expect(stats.total).toBe(3)
    expect(stats.wonValue).toBe(1000)
    expect(stats.openValue).toBe(2000) // qualified only
    expect(stats.winRate).toBe(50) // 1 won of 2 decided
    expect(stats.avgScore).toBe(Math.round((80 + 20 + 60) / 3))
    expect(stats.byStatus.qualified).toBe(1)
  })
})
