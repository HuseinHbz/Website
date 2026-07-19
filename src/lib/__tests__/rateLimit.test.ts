import { rateLimit } from '../rateLimit'

describe('rateLimit', () => {
  it('allows requests within the limit', () => {
    const result = rateLimit('test-key-1', { limit: 5, windowSec: 60 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks requests that exceed the limit', () => {
    const key = 'test-exceed-1'
    for (let i = 0; i < 3; i++) rateLimit(key, { limit: 3, windowSec: 60 })
    const result = rateLimit(key, { limit: 3, windowSec: 60 })
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('uses separate windows per key', () => {
    rateLimit('isolated-a', { limit: 1, windowSec: 60 })
    rateLimit('isolated-a', { limit: 1, windowSec: 60 })
    const b = rateLimit('isolated-b', { limit: 1, windowSec: 60 })
    expect(b.allowed).toBe(true)
  })
})
