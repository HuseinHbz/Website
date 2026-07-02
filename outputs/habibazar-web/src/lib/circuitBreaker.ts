/**
 * Circuit breaker pattern — prevents cascading failures to external services.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  /** Number of failures to trip the circuit */
  failureThreshold?: number
  /** Seconds before trying recovery from OPEN state */
  recoveryTimeoutSec?: number
  /** Failures allowed in HALF_OPEN before re-opening */
  halfOpenFailureThreshold?: number
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failures = 0
  private lastFailureAt = 0
  private readonly failureThreshold: number
  private readonly recoveryTimeoutMs: number
  private readonly halfOpenFailureThreshold: number

  constructor(public readonly name: string, opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 5
    this.recoveryTimeoutMs = (opts.recoveryTimeoutSec ?? 30) * 1000
    this.halfOpenFailureThreshold = opts.halfOpenFailureThreshold ?? 1
  }

  get currentState(): CircuitState {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureAt >= this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN'
      }
    }
    return this.state
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    const state = this.currentState

    if (state === 'OPEN') {
      if (fallback) return fallback()
      throw new Error(`Circuit breaker OPEN for ${this.name}`)
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      if (fallback) return fallback()
      throw err
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailureAt = Date.now()

    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  reset() {
    this.state = 'CLOSED'
    this.failures = 0
    this.lastFailureAt = 0
  }

  get stats() {
    return { name: this.name, state: this.currentState, failures: this.failures }
  }
}

/** Shared circuit breakers for external services */
export const breakers = {
  ai:    new CircuitBreaker('ai-service',    { failureThreshold: 3, recoveryTimeoutSec: 30 }),
  smtp:  new CircuitBreaker('smtp',          { failureThreshold: 3, recoveryTimeoutSec: 60 }),
  search: new CircuitBreaker('search',       { failureThreshold: 5, recoveryTimeoutSec: 20 }),
}
