import { CircuitBreaker } from '../circuitBreaker'

describe('CircuitBreaker', () => {
  it('starts CLOSED', () => {
    const cb = new CircuitBreaker('test')
    expect(cb.currentState).toBe('CLOSED')
  })

  it('opens after failure threshold', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 2 })
    const fail = () => Promise.reject(new Error('fail'))

    await cb.execute(fail, () => null).catch(() => {})
    await cb.execute(fail, () => null).catch(() => {})

    expect(cb.currentState).toBe('OPEN')
  })

  it('uses fallback when OPEN', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1 })
    await cb.execute(() => Promise.reject(new Error('fail')), () => 'fallback').catch(() => {})

    const result = await cb.execute(() => Promise.resolve('real'), () => 'fallback')
    expect(result).toBe('fallback')
  })

  it('resets to CLOSED on success', async () => {
    const cb = new CircuitBreaker('test')
    await cb.execute(() => Promise.resolve('ok'))
    expect(cb.currentState).toBe('CLOSED')
    expect(cb.stats.failures).toBe(0)
  })

  it('transitions to HALF_OPEN after recovery timeout', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, recoveryTimeoutSec: 0 })
    await cb.execute(() => Promise.reject(new Error('fail')), () => null).catch(() => {})
    // With 0s timeout, it should immediately be HALF_OPEN on next check
    expect(cb.currentState).toBe('HALF_OPEN')
  })
})
