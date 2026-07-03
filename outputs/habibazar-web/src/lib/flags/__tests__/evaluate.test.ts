import { describe, it, expect } from 'vitest'
import { isEnabled, bucket, evaluateAll, type Flag } from '../evaluate'

const flag = (p: Partial<Flag>): Flag => ({ key: 'f', enabled: true, rolloutPercent: 100, ...p })

describe('feature flag evaluation', () => {
  it('disabled flag is always off', () => {
    expect(isEnabled(flag({ enabled: false, rolloutPercent: 100 }))).toBe(false)
    expect(isEnabled(null)).toBe(false)
  })

  it('100% on, 0% off', () => {
    expect(isEnabled(flag({ rolloutPercent: 100 }), 'user-1')).toBe(true)
    expect(isEnabled(flag({ rolloutPercent: 0 }), 'user-1')).toBe(false)
  })

  it('is deterministic per (flag, subject)', () => {
    const f = flag({ key: 'beta', rolloutPercent: 50 })
    const a = isEnabled(f, 'user-42')
    expect(isEnabled(f, 'user-42')).toBe(a)
    expect(isEnabled(f, 'user-42')).toBe(a)
  })

  it('rollout is monotonic — raising % never flips a subject off', () => {
    const subject = 'user-777'
    let prev = false
    for (let p = 0; p <= 100; p += 10) {
      const on = isEnabled(flag({ key: 'grow', rolloutPercent: p }), subject)
      if (prev) expect(on).toBe(true) // once on, stays on as % grows
      prev = on
    }
  })

  it('roughly honors the percentage across many subjects', () => {
    const f = flag({ key: 'dist', rolloutPercent: 30 })
    let on = 0
    const N = 2000
    for (let i = 0; i < N; i++) if (isEnabled(f, `s-${i}`)) on++
    const ratio = on / N
    expect(ratio).toBeGreaterThan(0.24)
    expect(ratio).toBeLessThan(0.36)
  })

  it('bucket is 0–99; evaluateAll maps every flag', () => {
    expect(bucket('k', 's')).toBeGreaterThanOrEqual(0)
    expect(bucket('k', 's')).toBeLessThan(100)
    const map = evaluateAll([flag({ key: 'a' }), flag({ key: 'b', enabled: false })], 'x')
    expect(map).toEqual({ a: true, b: false })
  })
})
