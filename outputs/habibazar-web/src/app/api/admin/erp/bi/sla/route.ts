import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { listSlaDefs, upsertSlaDef, startSlaEvent, resolveSlaEvent, scanSla, listSlaEvents } from '@/lib/bi/slaData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  try {
    if (sp.get('view') === 'events') return NextResponse.json({ events: await listSlaEvents(sp.get('state') ?? undefined) })
    return NextResponse.json({ defs: await listSlaDefs() })
  } catch (e) { return apiError(e, 'Failed to load SLA') }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: z.number().int().positive().optional(), code: z.string().min(1).max(60), nameEn: z.string().min(1).max(120), nameFa: z.string().max(120).optional(), slaType: z.enum(['customer','internal','approval','support']), targetHours: z.number().positive(), priority: z.string().max(20).optional(), businessHours: z.object({ startHour: z.number(), endHour: z.number(), workingDays: z.array(z.number()) }).optional(), holidays: z.array(z.string()).optional() }),
  z.object({ action: z.literal('start'), slaId: z.number().int().positive(), refType: z.string().max(60).optional(), refId: z.number().int().positive().optional() }),
  z.object({ action: z.literal('resolve'), id: z.number().int().positive() }),
  z.object({ action: z.literal('scan') }),
])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'save') { if (!['super_admin','administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 }); const r = await upsertSlaDef(d); await logAction(auth.user, 'sla.save', 'sla_definitions', r.id); return NextResponse.json(r) }
    if (d.action === 'start') { const r = await startSlaEvent(d.slaId, d.refType, d.refId); await logAction(auth.user, 'sla.start', 'sla_events', r.id); return NextResponse.json(r) }
    if (d.action === 'resolve') { await resolveSlaEvent(d.id); await logAction(auth.user, 'sla.resolve', 'sla_events', d.id); return NextResponse.json({ ok: true }) }
    const r = await scanSla(); await logAction(auth.user, 'sla.scan', 'sla_events', '', null, r); return NextResponse.json(r)
  } catch (e) { return apiError(e, 'SLA operation failed') }
}
