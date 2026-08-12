import { describe, it, expect, vi } from 'vitest'
import { shouldRetryDbError, withDbRetry } from '../retry'

describe('shouldRetryDbError', () => {
  it('retries on Postgres too_many_connections (53300)', () => {
    expect(shouldRetryDbError({ code: '53300' }, 0, 2)).toBe(true)
  })
  it('retries on connection-failure codes', () => {
    for (const code of ['08006', '08001', '08004', 'ECONNREFUSED', 'ETIMEDOUT']) {
      expect(shouldRetryDbError({ code }, 0, 2)).toBe(true)
    }
  })
  it('never retries a real query error (e.g. undefined table)', () => {
    expect(shouldRetryDbError({ code: '42P01' }, 0, 2)).toBe(false)
  })
  it('never retries once attempts are exhausted', () => {
    expect(shouldRetryDbError({ code: '53300' }, 2, 2)).toBe(false)
  })
  it('handles a non-object/malformed error safely', () => {
    expect(shouldRetryDbError('plain string error', 0, 2)).toBe(false)
    expect(shouldRetryDbError(null, 0, 2)).toBe(false)
    expect(shouldRetryDbError(undefined, 0, 2)).toBe(false)
  })
})

describe('withDbRetry', () => {
  it('returns the real result on first success — no retry, no fallback', async () => {
    const fn = vi.fn().mockResolvedValue(['real-data'])
    const result = await withDbRetry(fn, [], 'test')
    expect(result).toEqual(['real-data'])
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries a transient connection error and succeeds on the 2nd attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: '53300' })
      .mockResolvedValueOnce(['recovered'])
    const result = await withDbRetry(fn, [], 'test')
    expect(result).toEqual(['recovered'])
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('falls back to the safe default after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue({ code: '53300' })
    const result = await withDbRetry(fn, ['fallback'], 'test')
    expect(result).toEqual(['fallback'])
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries (BACKOFF_MS has 2 entries)
  })

  it('does not retry a non-transient error — falls back immediately', async () => {
    const fn = vi.fn().mockRejectedValue({ code: '42P01' })
    const result = await withDbRetry(fn, ['fallback'], 'test')
    expect(result).toEqual(['fallback'])
    expect(fn).toHaveBeenCalledTimes(1)
  })
}, 10000)
