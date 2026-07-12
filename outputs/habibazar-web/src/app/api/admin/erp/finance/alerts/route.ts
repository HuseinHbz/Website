import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { listAlerts, scanAndUpsertAlerts, setAlertStatus } from '@/lib/erp/financialAlertsData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET ?status=open|acknowledged|resolved — current financial alerts.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const status = req.nextUrl.searchParams.get('status') ?? undefined
    return NextResponse.json({ alerts: await listAlerts(status) })
  } catch (e) { return apiError(e, 'Failed to load alerts') }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('scan') }),
  z.object({ action: z.literal('status'), id: z.number().int().positive(), status: z.enum(['open', 'acknowledged', 'resolved']) }),
])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'scan') { const r = await scanAndUpsertAlerts(); await logAction(auth.user, 'finance.alerts.scan', 'erp_financial_alerts', '', null, r); return NextResponse.json(r) }
    await setAlertStatus(d.id, d.status); await logAction(auth.user, 'finance.alert.status', 'erp_financial_alerts', d.id, null, { status: d.status })
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Alert operation failed') }
}
