/**
 * Structured logger — outputs JSON in production, pretty-prints in development.
 * Every log entry carries a correlation ID, timestamp, level, and context.
 * Also fans out into the real-time log bus (Logs & Monitoring module).
 */
import { logBus } from '@/lib/logs/bus'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: string
  level: LogLevel
  msg: string
  correlationId?: string
  userId?: string
  action?: string
  resource?: string
  duration?: number
  statusCode?: number
  ip?: string
  path?: string
  error?: string
  stack?: string
  [key: string]: unknown
}

const isDev = process.env.NODE_ENV !== 'production'
const MIN_LEVEL: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const minLevel = MIN_LEVEL[(process.env.LOG_LEVEL as LogLevel) ?? (isDev ? 'debug' : 'info')]

function write(level: LogLevel, msg: string, ctx: Record<string, unknown> = {}) {
  if (MIN_LEVEL[level] < minLevel) return

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  }

  if (ctx.error instanceof Error) {
    entry.error = ctx.error.message
    entry.stack = ctx.error.stack
    delete (entry as Record<string, unknown>).error
  }

  if (isDev) {
    const color = { debug: '\x1b[37m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' }[level]
    const reset = '\x1b[0m'
    const prefix = `${color}[${level.toUpperCase()}]${reset} ${entry.ts}`
    const extras = Object.entries(ctx).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
    console.log(`${prefix} ${msg}${extras ? ' | ' + extras : ''}`)
  } else {
    process.stdout.write(JSON.stringify(entry) + '\n')
  }

  // Fan out to the real-time log bus (Logs & Monitoring). Never let this throw.
  try {
    logBus.publish({
      ts: entry.ts,
      level,
      source: typeof ctx.source === 'string' ? ctx.source : deriveSource(msg),
      service: typeof ctx.service === 'string' ? ctx.service : 'app',
      message: msg,
      stacktrace: typeof entry.stack === 'string' ? entry.stack : null,
      requestId: typeof ctx.correlationId === 'string' ? ctx.correlationId : null,
      userId: typeof ctx.userId === 'string' ? ctx.userId : null,
      meta: ctx,
    })
  } catch { /* logging must never break the request */ }
}

function deriveSource(msg: string): string {
  if (msg.startsWith('[SECURITY]')) return 'security'
  if (msg.startsWith('[AUDIT]')) return 'audit'
  if (/^[A-Z]+ \/\S/.test(msg)) return 'http'
  return 'app'
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => write('debug', msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => write('info',  msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => write('warn',  msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write('error', msg, ctx),

  /** Log an HTTP request/response pair */
  http: (method: string, path: string, status: number, duration: number, ctx?: Record<string, unknown>) =>
    write(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', `${method} ${path} ${status} ${duration}ms`, {
      method, path, statusCode: status, duration, ...ctx,
    }),

  /** Log a security event (auth failures, permission violations) */
  security: (event: string, ctx?: Record<string, unknown>) =>
    write('warn', `[SECURITY] ${event}`, ctx),

  /** Log an admin audit event */
  audit: (action: string, resource: string, resourceId?: string | number, ctx?: Record<string, unknown>) =>
    write('info', `[AUDIT] ${action} ${resource}${resourceId ? `:${resourceId}` : ''}`, ctx),
}
