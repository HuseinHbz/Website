import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, requirePermission } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { listObjectives, getObjective, createObjective, updateKeyResult, deleteObjective, okrAlignment } from '@/lib/bi/okrData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.business-intelligence', 'read')
  if ('error' in auth) return auth.error
  const sp = req.nextUrl.searchParams
  try {
    const id = Number(sp.get('id'))
    if (id) { const o = await getObjective(id); return o ? NextResponse.json(o) : NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    if (sp.get('view') === 'alignment') return NextResponse.json(await okrAlignment(sp.get('period') ?? ''))
    return NextResponse.json({ objectives: await listObjectives(sp.get('period') ?? undefined) })
  } catch (e) { return apiError(e, 'Failed to load OKRs') }
}

const kr = z.object({ title: z.string().min(1).max(200), startValue: z.number(), targetValue: z.number(), currentValue: z.number().optional(), weight: z.number().optional(), unit: z.string().max(20).optional() })
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), title: z.string().min(1).max(200), description: z.string().max(1000).optional(), level: z.enum(['company','department','employee']), parentId: z.number().int().positive().optional(), ownerId: z.string().max(60).optional(), department: z.string().max(120).optional(), period: z.string().min(1).max(20), startDate: z.string().max(10).optional(), endDate: z.string().max(10).optional(), keyResults: z.array(kr).max(20).optional() }),
  z.object({ action: z.literal('updateKr'), krId: z.number().int().positive(), currentValue: z.number() }),
  z.object({ action: z.literal('delete'), id: z.number().int().positive() }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.business-intelligence', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'create') { const r = await createObjective(d, auth.user.id); await logAction(auth.user, 'okr.create', 'okr_objectives', r.id, null, { title: d.title }); return NextResponse.json(r) }
    if (d.action === 'updateKr') { await updateKeyResult(d.krId, d.currentValue); await logAction(auth.user, 'okr.kr.update', 'okr_results', d.krId); return NextResponse.json({ ok: true }) }
    await deleteObjective(d.id); await logAction(auth.user, 'okr.delete', 'okr_objectives', d.id); return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'OKR operation failed') }
}
