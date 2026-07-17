/**
 * Enterprise Integration Hub — pure core (Phase 21.8).
 *
 * Connector modelling + request building + retry schedule, with no I/O so it is
 * unit-tested. The dispatcher (dispatch.ts) performs the network calls.
 *
 * Executable now (dependency-free): REST, GraphQL, Webhook (native fetch) and
 * SMTP (existing nodemailer). Kafka / RabbitMQ / SFTP require a broker + heavy
 * deps and infra, so their dispatches are recorded as QUEUED INTENTS — never
 * faked — until an operator wires a real broker. This mirrors the Workflow
 * engine's honest "recorded as intents, not executed" policy.
 */

export const CONNECTOR_TYPES = ['rest', 'graphql', 'webhook', 'smtp', 'kafka', 'rabbitmq', 'sftp'] as const
export type ConnectorType = (typeof CONNECTOR_TYPES)[number]

/** Types the hub actually invokes now. The rest are queued as intents. */
export const EXECUTABLE: ReadonlySet<ConnectorType> = new Set<ConnectorType>(['rest', 'graphql', 'webhook', 'smtp'])
export function isExecutable(type: ConnectorType): boolean { return EXECUTABLE.has(type) }

export interface ConnectorConfig {
  url?: string
  method?: string
  headers?: Record<string, string>
  authType?: 'none' | 'bearer' | 'header'
  authToken?: string
  authHeader?: string
  query?: string          // graphql
  // smtp
  to?: string
  subject?: string
  // broker / sftp (intent metadata)
  broker?: string
  topic?: string
  queue?: string
  host?: string
  path?: string
}

export interface Connector { type: ConnectorType; config: ConnectorConfig }

export interface HttpRequest { url: string; method: string; headers: Record<string, string>; body: string }

function authHeaders(cfg: ConnectorConfig): Record<string, string> {
  if (cfg.authType === 'bearer' && cfg.authToken) return { Authorization: `Bearer ${cfg.authToken}` }
  if (cfg.authType === 'header' && cfg.authHeader && cfg.authToken) return { [cfg.authHeader]: cfg.authToken }
  return {}
}

/** Build the HTTP request for an executable HTTP-style connector. Pure. */
export function buildRequest(c: Connector, payload: unknown): HttpRequest {
  const cfg = c.config
  const headers = { 'Content-Type': 'application/json', ...(cfg.headers ?? {}), ...authHeaders(cfg) }
  if (c.type === 'graphql') {
    return { url: cfg.url ?? '', method: 'POST', headers, body: JSON.stringify({ query: cfg.query ?? '', variables: payload }) }
  }
  // rest + webhook
  const method = c.type === 'webhook' ? 'POST' : (cfg.method ?? 'POST').toUpperCase()
  return { url: cfg.url ?? '', method, headers, body: JSON.stringify(payload) }
}

const SECRET_RE = /token|secret|password|passwd|apikey/i
/** Redact secret-looking config values for safe display. Pure. */
export function redactConfig(cfg: ConnectorConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(cfg)) {
    out[k] = typeof v === 'string' && SECRET_RE.test(k) && v ? '••••••' : v
  }
  return out
}

/** Exponential backoff delays (ms) for `attempts` retries. Pure. */
export function backoffDelays(attempts: number, baseMs = 500, factor = 2, capMs = 30_000): number[] {
  const out: number[] = []
  for (let i = 0; i < Math.max(0, attempts); i++) out.push(Math.min(capMs, baseMs * factor ** i))
  return out
}

/** Structural validation of a connector before persist/dispatch. */
export function validateConnector(c: Connector): { valid: boolean; error?: string } {
  if (!(CONNECTOR_TYPES as readonly string[]).includes(c.type)) return { valid: false, error: 'unknown connector type' }
  if (isExecutable(c.type) && c.type !== 'smtp' && !c.config.url) return { valid: false, error: 'url required' }
  if (c.type === 'smtp' && !c.config.to) return { valid: false, error: 'recipient (to) required' }
  if (c.type === 'graphql' && !c.config.query) return { valid: false, error: 'GraphQL query required' }
  return { valid: true }
}
