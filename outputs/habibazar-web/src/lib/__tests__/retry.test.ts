import { retry, isTransient } from '../retry'

describe('retry', () => {
  it('returns the result on first success', async () => {
    const result = await retry(() => Promise.resolve(42))
    expect(result).toBe(42)
  })

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0
    const result = await retry(
      async () => {
        calls++
        if (calls < 3) throw new Error('transient')
        return 'ok'
      },
      { attempts: 3, baseDelayMs: 0 }
    )
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('throws after exhausting all attempts', async () => {
    await expect(
      retry(() => Promise.reject(new Error('always fails')), { attempts: 2, baseDelayMs: 0 })
    ).rejects.toThrow('always fails')
  })

  it('respects shouldRetry to stop early', async () => {
    let calls = 0
    await expect(
      retry(
        async () => { calls++; throw Object.assign(new Error('client error'), { status: 400 }) },
        { attempts: 3, baseDelayMs: 0, shouldRetry: (e) => isTransient(e) }
      )
    ).rejects.toThrow()
    expect(calls).toBe(1)
  })
})

describe('isTransient', () => {
  it('returns true for network errors', () => {
    expect(isTransient(new Error('fetch failed'))).toBe(true)
    expect(isTransient(new Error('network error'))).toBe(true)
  })

  it('returns false for 4xx errors', () => {
    expect(isTransient({ status: 400 })).toBe(false)
    expect(isTransient({ status: 404 })).toBe(false)
  })

  it('returns true for 5xx-like errors', () => {
    expect(isTransient({ status: 503 })).toBe(true)
  })
})
