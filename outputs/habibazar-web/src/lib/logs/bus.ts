/**
 * Central log bus — the real-time backbone for the Logs & Monitoring module.
 *
 * Every log entry (application, API, database, backup engine, security) is
 * published here. The bus fans out to:
 *   1. Live subscribers (the SSE endpoint) via an EventEmitter.
 *   2. A bounded in-memory ring buffer (instant backfill on connect).
 *   3. The `system_logs` table (fire-and-forget) for history / filter / search /
 *      export.
 *
 * Persistence is deferred with `setImmediate` and wrapped in try/catch so logging
 * is never on the request's critical path and never throws into a caller.
 */
import { EventEmitter } from 'events'
import crypto from 'crypto'
import { pgQuery } from '@/lib/db'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface SystemLog {
  id?: number
  ts: string
  level: LogLevel
  source: string
  service: string
  message: string
  stacktrace?: string | null
  requestId?: string | null
  userId?: string | null
  fingerprint: string
  meta?: Record<string, unknown> | null
}

const RING_SIZE = 500
const PRUNE_EVERY = 200 // rows inserted between prune sweeps
const MAX_ROWS = 100_000

function fingerprint(level: string, source: string, message: string): string {
  // Group identical errors: level + source + first line of the message.
  const firstLine = message.split('\n')[0].slice(0, 200)
  return crypto.createHash('sha1').update(`${level}|${source}|${firstLine}`).digest('hex').slice(0, 16)
}

class LogBus extends EventEmitter {
  private ring: SystemLog[] = []
  private inserts = 0

  constructor() {
    super()
    this.setMaxListeners(0) // many SSE subscribers
  }

  /** Publish a log entry: fan out live, buffer, and persist. */
  publish(input: Omit<SystemLog, 'fingerprint' | 'ts'> & { ts?: string; fingerprint?: string }): SystemLog {
    const entry: SystemLog = {
      ts: input.ts ?? new Date().toISOString(),
      level: input.level,
      source: input.source,
      service: input.service,
      message: input.message,
      stacktrace: input.stacktrace ?? null,
      requestId: input.requestId ?? null,
      userId: input.userId ?? null,
      fingerprint: input.fingerprint ?? fingerprint(input.level, input.source, input.message),
      meta: input.meta ?? null,
    }

    this.ring.push(entry)
    if (this.ring.length > RING_SIZE) this.ring.shift()
    this.emit('log', entry)

    setImmediate(() => this.persist(entry))
    return entry
  }

  private async persist(entry: SystemLog) {
    try {
      await pgQuery(
        `INSERT INTO system_logs (ts, level, source, service, message, stacktrace, request_id, user_id, fingerprint, meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [entry.ts, entry.level, entry.source, entry.service, entry.message,
          entry.stacktrace ?? null, entry.requestId ?? null, entry.userId ?? null,
          entry.fingerprint, entry.meta ? JSON.stringify(entry.meta) : null],
      )
      if (++this.inserts % PRUNE_EVERY === 0) await this.prune()
    } catch { /* logging must never throw */ }
  }

  private async prune() {
    try {
      await pgQuery(
        `DELETE FROM system_logs WHERE id NOT IN (SELECT id FROM system_logs ORDER BY id DESC LIMIT $1)`,
        [MAX_ROWS],
      )
    } catch { /* best-effort */ }
  }

  /** Most recent buffered entries (newest last), for instant SSE backfill. */
  recent(limit = 100): SystemLog[] {
    return this.ring.slice(-limit)
  }

  subscribe(fn: (e: SystemLog) => void): () => void {
    this.on('log', fn)
    return () => this.off('log', fn)
  }
}

// Survive HMR / multiple imports in dev by pinning to the global object.
const g = globalThis as unknown as { __hbzLogBus?: LogBus }
export const logBus: LogBus = g.__hbzLogBus ?? (g.__hbzLogBus = new LogBus())
