/**
 * Integration Hub dispatcher — performs the actual connector call (or records an
 * intent), with retry + dead-letter, and logs every dispatch to
 * integration_dispatches. HTTP connectors (REST/GraphQL/Webhook) use native
 * fetch; SMTP uses nodemailer via the site SMTP settings; Kafka/RabbitMQ/SFTP are
 * recorded as QUEUED intents (no broker wired). Used by the API and by the
 * Workflow engine's `integration` task handler.
 */
import { pgQuery, getDb } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { buildRequest, isExecutable, backoffDelays, type Connector, type ConnectorType, type ConnectorConfig } from './engine'

export interface ConnectorRow { id: number; type: ConnectorType; config: ConnectorConfig; retries: number }
export interface DispatchResult { status: 'success' | 'failed' | 'queued' | 'dead'; response?: string; latencyMs: number; attempts: number; error?: string }

async function getSetting(key: string): Promise<string> {
  try { const db = getDb(); const row = (await db.select().from(siteSettings).where(eq(siteSettings.key, key)))[0]; return row?.value ?? '' } catch { return '' }
}

async function httpCall(c: Connector, payload: unknown): Promise<{ ok: boolean; body: string; status: number }> {
  const req = buildRequest(c, payload)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal: ctrl.signal })
    const body = (await res.text().catch(() => '')).slice(0, 2000)
    return { ok: res.ok, body, status: res.status }
  } finally { clearTimeout(timer) }
}

async function smtpCall(cfg: ConnectorConfig, payload: unknown): Promise<{ ok: boolean; body: string }> {
  const host = await getSetting('smtp_host')
  if (!host) throw new Error('SMTP not configured')
  const nm = (await import('nodemailer')) as unknown as { createTransport: (c: unknown) => { sendMail: (o: unknown) => Promise<unknown> } }
  const port = await getSetting('smtp_port')
  const transporter = nm.createTransport({ host, port: parseInt(port || '587'), secure: port === '465', auth: (await getSetting('smtp_user')) ? { user: await getSetting('smtp_user'), pass: await getSetting('smtp_pass') } : undefined })
  await transporter.sendMail({ from: (await getSetting('smtp_from')) || (await getSetting('smtp_user')), to: cfg.to, subject: cfg.subject || 'Integration Hub', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) })
  return { ok: true, body: `sent to ${cfg.to}` }
}

/** Dispatch a payload through a connector, with retry + dead-letter + logging. */
export async function dispatchConnector(conn: ConnectorRow, payload: unknown): Promise<DispatchResult> {
  const started = Date.now()

  // Non-executable types: record a queued intent, never a fake success.
  if (!isExecutable(conn.type)) {
    const intent = { intent: conn.type, broker: conn.config.broker, topic: conn.config.topic, queue: conn.config.queue, host: conn.config.host, path: conn.config.path, payload }
    const res: DispatchResult = { status: 'queued', response: JSON.stringify(intent).slice(0, 2000), latencyMs: 0, attempts: 0 }
    await record(conn.id, res, payload)
    return res
  }

  const delays = backoffDelays(Math.max(0, conn.retries))
  let attempts = 0
  let lastErr = ''
  const connector: Connector = { type: conn.type, config: conn.config }

  // Attempt = 1 initial + `retries` more.
  for (let i = 0; i <= delays.length; i++) {
    attempts++
    try {
      const out = conn.type === 'smtp' ? await smtpCall(conn.config, payload) : await httpCall(connector, payload)
      if (!('ok' in out) || !out.ok) throw new Error(('status' in out ? `HTTP ${out.status}: ` : '') + out.body.slice(0, 200))
      const res: DispatchResult = { status: 'success', response: out.body, latencyMs: Date.now() - started, attempts }
      await record(conn.id, res, payload)
      return res
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
      if (i < delays.length) await new Promise(r => setTimeout(r, delays[i]))
    }
  }

  // Retries exhausted → dead letter.
  const res: DispatchResult = { status: 'dead', latencyMs: Date.now() - started, attempts, error: lastErr }
  await record(conn.id, res, payload)
  return res
}

async function record(connectorId: number, r: DispatchResult, payload: unknown): Promise<void> {
  try {
    await pgQuery(
      `INSERT INTO integration_dispatches (connector_id, status, request, response, latency_ms, attempts, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [connectorId, r.status, JSON.stringify(payload).slice(0, 4000), r.response ?? null, r.latencyMs, r.attempts, r.error ?? null])
  } catch { /* logging must never break dispatch */ }
}

/** Dispatch by connector key (used by the Workflow `integration` task handler). */
export async function dispatchByKey(key: string, payload: unknown): Promise<DispatchResult | null> {
  const row = (await pgQuery(`SELECT id, type, config, retries FROM integrations WHERE key=$1 AND active=1`, [key]))[0] as
    { id: number; type: ConnectorType; config: string; retries: number } | undefined
  if (!row) return null
  let config: ConnectorConfig = {}
  try { config = JSON.parse(row.config) } catch { /* empty */ }
  return dispatchConnector({ id: row.id, type: row.type, config, retries: row.retries }, payload)
}
