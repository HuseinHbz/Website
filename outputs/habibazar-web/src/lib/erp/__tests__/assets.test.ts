import { describe, it, expect } from 'vitest'
import { warrantyState, daysUntil, assetStats } from '../assets'

const NOW = new Date('2026-07-03T00:00:00Z')
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()

describe('ERP asset warranty/lifecycle', () => {
  it('classifies warranty state relative to now', () => {
    expect(warrantyState(inDays(200), NOW).state).toBe('ok')
    expect(warrantyState(inDays(15), NOW).state).toBe('expiring')
    expect(warrantyState(inDays(-5), NOW).state).toBe('expired')
    expect(warrantyState(null, NOW).state).toBe('none')
  })

  it('daysUntil is signed and handles invalid input', () => {
    expect(daysUntil(inDays(10), NOW)).toBe(10)
    expect(daysUntil(inDays(-3), NOW)).toBeLessThan(0)
    expect(daysUntil('not-a-date', NOW)).toBeNull()
    expect(daysUntil(null, NOW)).toBeNull()
  })

  it('assetStats rolls up type/status and warranty risk', () => {
    const stats = assetStats([
      { type: 'server', status: 'active', warrantyExpiry: inDays(400) },
      { type: 'server', status: 'active', warrantyExpiry: inDays(10) },   // expiring
      { type: 'firewall', status: 'maintenance', warrantyExpiry: inDays(-1) }, // expired
      { type: 'laptop', status: 'spare' },
    ], NOW)
    expect(stats.total).toBe(4)
    expect(stats.byType.server).toBe(2)
    expect(stats.byStatus.active).toBe(2)
    expect(stats.active).toBe(2)
    expect(stats.warrantyExpiring).toBe(1)
    expect(stats.warrantyExpired).toBe(1)
  })
})
