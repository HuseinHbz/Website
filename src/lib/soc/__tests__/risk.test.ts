import { describe, it, expect } from 'vitest'
import { riskScore, riskLevel, type SecuritySignals } from '../risk'

const S = (p: Partial<SecuritySignals>): SecuritySignals => ({
  failedLogins: 0, bruteForceIps: 0, injectionBlocks: 0, permissionDenied: 0, rateLimited: 0, securityErrors: 0, ...p,
})

describe('SOC risk scoring', () => {
  it('is low with no signal', () => {
    expect(riskLevel(S({}))).toBe('low')
    expect(riskScore(S({}))).toBe(0)
  })

  it('escalates to critical on brute-force clusters', () => {
    expect(riskLevel(S({ bruteForceIps: 3 }))).toBe('critical')
    expect(riskLevel(S({ securityErrors: 10 }))).toBe('critical')
  })

  it('a single brute-force IP is at least high', () => {
    expect(riskLevel(S({ bruteForceIps: 1 }))).toBe('high')
  })

  it('moderate noise is medium', () => {
    expect(riskLevel(S({ failedLogins: 5, rateLimited: 5 }))).toBe('medium')
  })

  it('score is weighted and monotonic', () => {
    expect(riskScore(S({ injectionBlocks: 2 }))).toBe(16)
    expect(riskScore(S({ failedLogins: 10 }))).toBeGreaterThan(riskScore(S({ failedLogins: 3 })))
  })
})
