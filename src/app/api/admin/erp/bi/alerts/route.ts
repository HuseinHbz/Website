import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { listBusinessAlerts, scanBusinessAlerts, setBusinessAlertStatus } from '@/lib/bi/alertsData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.business-intelligence', 'read')
  if ('error' in auth) return auth.error
  try { return NextResponse.json({ alerts: await listBusinessAlerts(req.nextUrl.searchParams.get('domain') ?? undefined, req.nextUrl.searchParams.get('status') ?? 'open') }) }
  catch (e) { return apiError(e, 'Failed to load alerts') }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('scan') }),
  z.object({ action: z.literal('status'), id: z.number().int().positive(), status: z.enum(['open','acknowledged','resolved']) }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.business-intelligence', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'scan') { const r = await scanBusinessAlerts(); await logAction(auth.user, 'biz_alert.scan', 'business_alerts', '', null, { upserted: r.upserted, resolved: r.resolved }); return NextResponse.json(r) }
    await setBusinessAlertStatus(d.id, d.status); await logAction(auth.user, 'biz_alert.status', 'business_alerts', d.id, null, { status: d.status }); return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Alert operation failed') }
}
