import { describe, it, expect } from 'vitest'
import { generateRandomPassword } from '../seed'

describe('generateRandomPassword — production seed credential', () => {
  it('is at least 16 characters (a real password, not a short guessable one)', () => {
    expect(generateRandomPassword().length).toBeGreaterThanOrEqual(16)
  })

  it('produces a different value on every call (never a fixed/predictable string)', () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateRandomPassword()))
    expect(seen.size).toBe(20)
  })

  it('never equals the old fixed dev/CI password (would defeat the whole point)', () => {
    expect(generateRandomPassword()).not.toBe('HBZ@Admin2025!')
  })

  it('contains only URL/log-safe characters (safe to print verbatim to a log line)', () => {
    expect(generateRandomPassword()).toMatch(/^[A-Za-z0-9_.!-]+$/)
  })
})
