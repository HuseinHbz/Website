import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { sanitizeLayout } from '@/lib/admin/widgets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

interface ShareRow { id: number; ownerId: string; ownerName: string | null; workspace: string; targetType: string; targetKey: string; permission: string; layout: string; createdAt: string }

// GET — ?workspace=&mine=1 lists shares I created; otherwise shares targeted AT
// me (by user id / role / department) — the "shared with me" inbox.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const workspace = req.nextUrl.searchParams.get('workspace')
  const mine = req.nextUrl.searchParams.get('mine') === '1'
  try {
    let rows: ShareRow[]
    const cols = `s.id, s.owner_id AS "ownerId", u.name AS "ownerName", s.workspace, s.target_type AS "targetType", s.target_key AS "targetKey", s.permission, s.layout, s.created_at AS "createdAt"`
    if (mine) {
      rows = await pgQuery<ShareRow>(
        `SELECT ${cols} FROM dashboard_shares s LEFT JOIN users u ON u.id=s.owner_id WHERE s.owner_id=$1 ${workspace ? 'AND s.workspace=$2' : ''} ORDER BY s.created_at DESC`,
        workspace ? [auth.user.id, workspace] : [auth.user.id])
    } else {
      rows = await pgQuery<ShareRow>(
        `SELECT ${cols} FROM dashboard_shares s LEFT JOIN users u ON u.id=s.owner_id
         WHERE ((s.target_type='user' AND s.target_key=$1) OR (s.target_type='role' AND s.target_key=$2) OR (s.target_type='department' AND s.target_key=$3))
           AND s.owner_id<>$1 ${workspace ? 'AND s.workspace=$4' : ''} ORDER BY s.created_at DESC`,
        workspace ? [auth.user.id, auth.user.role, auth.user.department ?? '', workspace] : [auth.user.id, auth.user.role, auth.user.department ?? ''])
    }
    return NextResponse.json({ shares: rows.map(r => ({ ...r, layout: JSON.parse(r.layout || '[]') })) })
  } catch (e) { return apiError(e, 'Failed to load shares') }
}

const entry = z.object({ id: z.string().max(60), size: z.enum(['sm', 'md', 'lg']), config: z.object({ refreshInterval: z.number().int().min(0).max(3600).optional(), warn: z.number().optional(), critical: z.number().optional() }).optional() })
const shareSchema = z.object({
  workspace: z.string().min(1).max(40),
  targetType: z.enum(['user', 'role', 'department']),
  targetKey: z.string().min(1).max(80),
  permission: z.enum(['view', 'edit', 'manage']).default('view'),
  layout: z.array(entry).max(60),
})

// POST — share a layout snapshot with a target (upsert). Requires edit.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, shareSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const layout = sanitizeLayout(d.workspace, d.layout)
  try {
    await pgQuery(
      `INSERT INTO dashboard_shares (owner_id, workspace, target_type, target_key, permission, layout, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,${NOW})
       ON CONFLICT (owner_id, workspace, target_type, target_key)
       DO UPDATE SET permission=EXCLUDED.permission, layout=EXCLUDED.layout, created_at=${NOW}`,
      [auth.user.id, d.workspace, d.targetType, d.targetKey, d.permission, JSON.stringify(layout)])
    await logAction(auth.user, 'dashboard.share', 'dashboard', `${d.workspace}:${d.targetType}:${d.targetKey}`, null, { permission: d.permission })
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to share dashboard') }
}

// DELETE — revoke a share I own (?id=). Requires edit.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) return badRequest('id required')
  try {
    await pgQuery(`DELETE FROM dashboard_shares WHERE id=$1 AND owner_id=$2`, [id, auth.user.id])
    await logAction(auth.user, 'dashboard.share.revoke', 'dashboard', id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to revoke share') }
}
