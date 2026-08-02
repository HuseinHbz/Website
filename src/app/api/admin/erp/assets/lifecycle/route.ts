import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { loadAsset } from '@/lib/erp/assetData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET ?id= — the full lifecycle of one asset: details + assignment history +
// maintenance/calibration schedule & history + activity timeline.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.assets', 'read')
  if ('error' in auth) return auth.error
  try {
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (!id) return badRequest('id required')
    const asset = await loadAsset(id)
    if (!asset) return badRequest('Not found')
    const [assignments, maintenance, activity] = await Promise.all([
      pgQuery(`SELECT id, assignee, department, location, from_date AS "fromDate", to_date AS "toDate", note, created_at AS "createdAt"
               FROM asset_assignments WHERE asset_id=$1 ORDER BY COALESCE(from_date, created_at) DESC`, [id]),
      pgQuery(`SELECT id, type, status, scheduled_date AS "scheduledDate", done_date AS "doneDate", cost::float AS cost, vendor, note, created_at AS "createdAt"
               FROM asset_maintenance WHERE asset_id=$1 ORDER BY COALESCE(scheduled_date, created_at) DESC`, [id]),
      pgQuery(`SELECT id, action, detail, created_at AS "createdAt" FROM asset_activity WHERE asset_id=$1 ORDER BY created_at DESC LIMIT 50`, [id]),
    ])
    return NextResponse.json({ asset, assignments, maintenance, activity })
  } catch (e) { return apiError(e) }
}

const assignSchema = z.object({
  kind: z.literal('assignment'),
  assetId: z.number().int().positive(),
  assignee: z.string().min(1).max(200),
  department: z.string().max(120).optional(),
  location: z.string().max(200).optional(),
  fromDate: z.string().max(30).optional(),
  toDate: z.string().max(30).optional(),
  note: z.string().max(500).optional(),
})
const maintSchema = z.object({
  kind: z.literal('maintenance'),
  assetId: z.number().int().positive(),
  type: z.enum(['maintenance', 'calibration', 'repair', 'inspection']),
  status: z.enum(['scheduled', 'done', 'overdue', 'cancelled']).default('scheduled'),
  scheduledDate: z.string().max(30).optional(),
  doneDate: z.string().max(30).optional(),
  cost: z.number().min(0).default(0),
  vendor: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
})
const maintDoneSchema = z.object({ kind: z.literal('maintenance-done'), id: z.number().int().positive(), assetId: z.number().int().positive(), doneDate: z.string().max(30).optional() })
const body = z.discriminatedUnion('kind', [assignSchema, maintSchema, maintDoneSchema])

// POST — add an assignment, add a maintenance/calibration record, or mark one done.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.assets', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.kind === 'assignment') {
      await pgQuery(
        `INSERT INTO asset_assignments (asset_id, assignee, department, location, from_date, to_date, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [d.assetId, d.assignee, d.department ?? null, d.location ?? null, d.fromDate ?? null, d.toDate ?? null, d.note ?? null, auth.user.id])
      // Reflect the current assignee on the asset + activity trail.
      await pgQuery(`UPDATE assets SET assigned_to=$2, employee=$2, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`, [d.assetId, d.assignee])
      await pgQuery(`INSERT INTO asset_activity (asset_id, action, detail, user_id) VALUES ($1,'assigned',$2,$3)`, [d.assetId, `Assigned to ${d.assignee}`, auth.user.id])
      await logAction(auth.user, 'inv.asset.assign', 'assets', d.assetId)
      return NextResponse.json({ ok: true })
    }
    if (d.kind === 'maintenance') {
      await pgQuery(
        `INSERT INTO asset_maintenance (asset_id, type, status, scheduled_date, done_date, cost, vendor, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [d.assetId, d.type, d.status, d.scheduledDate ?? null, d.doneDate ?? null, d.cost, d.vendor ?? null, d.note ?? null, auth.user.id])
      await pgQuery(`INSERT INTO asset_activity (asset_id, action, detail, user_id) VALUES ($1,$2,$3,$4)`, [d.assetId, d.type, `${d.type} ${d.status}`, auth.user.id])
      await logAction(auth.user, 'inv.asset.maintenance', 'assets', d.assetId)
      return NextResponse.json({ ok: true })
    }
    // maintenance-done
    await pgQuery(`UPDATE asset_maintenance SET status='done', done_date=$2 WHERE id=$1`, [d.id, d.doneDate ?? new Date().toISOString().slice(0, 10)])
    await pgQuery(`INSERT INTO asset_activity (asset_id, action, detail, user_id) VALUES ($1,'maintenance-done',$2,$3)`, [d.assetId, `Maintenance #${d.id} completed`, auth.user.id])
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
