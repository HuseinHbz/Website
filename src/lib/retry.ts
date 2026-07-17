/**
 * Exponential backoff retry utility with jitter.
 * Use for external API calls, AI providers, SMTP, etc.
 */

export interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function backoff(attempt: number, base: number, max: number): number {
  const exp = Math.min(base * 2 ** (attempt - 1), max)
  return exp * (0.75 + Math.random() * 0.5) // ±25% jitter
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 300,
    maxDelayMs = 10_000,
    shouldRetry = () => true,
    onRetry,
  } = opts

  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i === attempts || !shouldRetry(err, i)) throw err
      const ms = backoff(i, baseDelayMs, maxDelayMs)
      onRetry?.(err, i, ms)
      await delay(ms)
    }
  }
  throw lastError
}

/** Retry only on network/transient errors, not on 4xx client errors */
export function isTransient(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused')
      || msg.includes('fetch failed') || msg.includes('enotfound')) return true
  }
  // Don't retry 4xx
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: number }).status
    if (status >= 400 && status < 500) return false
  }
  return true
}
