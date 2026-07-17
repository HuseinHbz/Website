import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { dispatchConnector, type ConnectorRow } from '@/lib/integration/dispatch'
import type { ConnectorConfig, ConnectorType } from '@/lib/integration/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — recent dispatches (?connectorId=) or the dead-letter queue (?dlq=1).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const dlq = req.nextUrl.searchParams.get('dlq')
    const cid = Number(req.nextUrl.searchParams.get('connectorId')) || 0
    const where = dlq ? `WHERE d.status='dead' AND d.resolved=0` : cid ? `WHERE d.connector_id=${cid}` : ''
    const rows = await pgQuery(
      `SELECT d.id, d.connector_id AS "connectorId", i.key AS "connectorKey", i.type,
              d.status, d.latency_ms AS "latencyMs", d.attempts, d.error, d.created_at AS "createdAt"
       FROM integration_dispatches d JOIN integrations i ON i.id=d.connector_id
       ${where} ORDER BY d.created_at DESC LIMIT 100`, [])
    // Lightweight metrics.
    const m = (await pgQuery(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status='success')::int AS success,
              COUNT(*) FILTER (WHERE status='dead' AND resolved=0)::int AS dead,
              COUNT(*) FILTER (WHERE status='queued')::int AS queued,
              COALESCE(AVG(latency_ms) FILTER (WHERE status='success'),0)::int AS "avgLatency"
       FROM integration_dispatches`, []))[0]
    return NextResponse.json({ dispatches: rows, metrics: m })
  } catch (e) { return apiError(e, 'Failed to load dispatches') }
}

const schema = z.object({
  connectorId: z.number().int().positive().optional(),
  redispatchId: z.number().int().positive().optional(),   // retry a DLQ item
  payload: z.record(z.string(), z.unknown()).default({}),
})

// POST — dispatch a payload through a connector, or re-dispatch a dead-letter item.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    let connectorId = d.connectorId
    let payload: unknown = d.payload
    if (d.redispatchId) {
      const dead = (await pgQuery(`SELECT connector_id AS "cid", request FROM integration_dispatches WHERE id=$1`, [d.redispatchId]))[0] as { cid: number; request: string } | undefined
      if (!dead) return badRequest('DLQ item not found')
      connectorId = dead.cid
      try { payload = JSON.parse(dead.request) } catch { payload = {} }
      await pgQuery(`UPDATE integration_dispatches SET resolved=1 WHERE id=$1`, [d.redispatchId])
    }
    if (!connectorId) return badRequest('connectorId required')

    const conn = (await pgQuery(`SELECT id, type, config, retries FROM integrations WHERE id=$1 AND active=1`, [connectorId]))[0] as
      { id: number; type: ConnectorType; config: string; retries: number } | undefined
    if (!conn) return badRequest('Connector not found or inactive')
    let config: ConnectorConfig = {}; try { config = JSON.parse(conn.config) } catch { /* empty */ }
    const row: ConnectorRow = { id: conn.id, type: conn.type, config, retries: conn.retries }

    const result = await dispatchConnector(row, payload)
    await logAction(auth.user, 'integration.dispatch', 'integration', connectorId, null, { status: result.status })
    return NextResponse.json({ result })
  } catch (e) { return apiError(e, 'Dispatch failed') }
}
