import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { CONNECTOR_TYPES, validateConnector, redactConfig, isExecutable, type ConnectorConfig, type ConnectorType } from '@/lib/integration/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// GET — list connectors (config redacted) with per-connector dispatch counts.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const rows = (await pgQuery(
      `SELECT i.id, i.key, i.name, i.type, i.config, i.active, i.retries,
              (SELECT COUNT(*)::int FROM integration_dispatches d WHERE d.connector_id=i.id) AS dispatches,
              (SELECT COUNT(*)::int FROM integration_dispatches d WHERE d.connector_id=i.id AND d.status='dead' AND d.resolved=0) AS dlq
       FROM integrations i ORDER BY i.type, i.key`, [])) as {
      id: number; key: string; name: string; type: ConnectorType; config: string; active: number; retries: number; dispatches: number; dlq: number
    }[]
    const connectors = rows.map(r => {
      let cfg: ConnectorConfig = {}; try { cfg = JSON.parse(r.config) } catch { /* empty */ }
      return { id: r.id, key: r.key, name: r.name, type: r.type, active: r.active, retries: r.retries, dispatches: r.dispatches, dlq: r.dlq, executable: isExecutable(r.type), config: redactConfig(cfg) }
    })
    return NextResponse.json({ connectors })
  } catch (e) { return apiError(e, 'Failed to load connectors') }
}

const schema = z.object({
  id: z.number().int().positive().optional(),
  key: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/, 'lowercase letters, digits, - and _'),
  name: z.string().min(1).max(160),
  type: z.enum(CONNECTOR_TYPES),
  config: z.record(z.string(), z.unknown()).default({}),
  retries: z.number().int().min(0).max(10).default(2),
  active: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const v = validateConnector({ type: d.type, config: d.config as ConnectorConfig })
  if (!v.valid) return badRequest(v.error ?? 'invalid connector')
  try {
    if (!d.id) {
      if ((await pgQuery(`SELECT id FROM integrations WHERE key=$1`, [d.key]))[0]) return badRequest('A connector with this key already exists')
      const row = (await pgQuery(
        `INSERT INTO integrations (key, name, type, config, retries, active, owner_id, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,${NOW}) RETURNING id`,
        [d.key, d.name, d.type, JSON.stringify(d.config), d.retries, d.active ? 1 : 0, auth.user.id]))[0] as { id: number }
      await logAction(auth.user, 'integration.create', 'integration', row.id, null, { key: d.key, type: d.type })
      return NextResponse.json({ id: row.id })
    }
    await pgQuery(`UPDATE integrations SET key=$2, name=$3, type=$4, config=$5, retries=$6, active=$7, updated_at=${NOW} WHERE id=$1`,
      [d.id, d.key, d.name, d.type, JSON.stringify(d.config), d.retries, d.active ? 1 : 0])
    await logAction(auth.user, 'integration.update', 'integration', d.id)
    return NextResponse.json({ id: d.id })
  } catch (e) { return apiError(e, 'Failed to save connector') }
}
export const PUT = POST

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    await pgQuery(`DELETE FROM integrations WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'integration.delete', 'integration', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete connector') }
}
