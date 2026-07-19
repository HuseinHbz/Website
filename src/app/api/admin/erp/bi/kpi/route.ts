import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { listKpis, upsertKpi, deleteKpi, computeKpis, snapshotKpis, kpiHistory } from '@/lib/bi/kpiData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  try {
    const hist = Number(sp.get('history'))
    if (hist) return NextResponse.json({ history: await kpiHistory(hist) })
    if (sp.get('view') === 'defs') return NextResponse.json({ kpis: await listKpis(sp.get('category') ?? undefined) })
    return NextResponse.json(await computeKpis(sp.get('category') ?? undefined))
  } catch (e) { return apiError(e, 'Failed to load KPIs') }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: z.number().int().positive().optional(), code: z.string().min(1).max(60), nameEn: z.string().min(1).max(120), nameFa: z.string().max(120).optional(), category: z.enum(['company','department','employee','project','financial','sales','inventory']), formula: z.string().max(500).optional(), unit: z.string().max(20).optional(), direction: z.enum(['higher_better','lower_better']), target: z.number().nullable().optional(), weight: z.number().optional() }),
  z.object({ action: z.literal('delete'), id: z.number().int().positive() }),
  z.object({ action: z.literal('snapshot'), period: z.string().min(4).max(7) }),
])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'delete') { if (!['super_admin','administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 }); await deleteKpi(d.id); await logAction(auth.user, 'kpi.delete', 'kpi_definitions', d.id); return NextResponse.json({ ok: true }) }
    if (d.action === 'snapshot') { const r = await snapshotKpis(d.period); await logAction(auth.user, 'kpi.snapshot', 'kpi_values', '', null, r); return NextResponse.json(r) }
    const r = await upsertKpi(d); await logAction(auth.user, 'kpi.save', 'kpi_definitions', r.id, null, { code: d.code }); return NextResponse.json(r)
  } catch (e) { return apiError(e, 'KPI operation failed') }
}
