import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { visibleViews, isShareScope, shareKeyFor, type SavedViewRow, type ShareScope } from '@/lib/admin/tableViews'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const isTableId = (s: string) => /^[a-z0-9:_-]+$/i.test(s) && s.length <= 60

// GET ?tableId=… → saved views visible to the caller (own + shared).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const tableId = req.nextUrl.searchParams.get('tableId') ?? ''
  if (!isTableId(tableId)) return NextResponse.json({ views: [] })
  try {
    const rows = await pgQuery<SavedViewRow>(
      `SELECT id, owner_id, table_id, name, state, shared_scope, shared_key, is_default FROM table_views WHERE table_id=$1 ORDER BY name ASC`, [tableId])
    const views = visibleViews(rows, { id: auth.user.id, role: auth.user.role, department: auth.user.department })
      .map(v => ({ id: v.id, name: v.name, state: safeParse(v.state), scope: v.shared_scope, isDefault: v.is_default, owned: v.owner_id === auth.user.id }))
    return NextResponse.json({ views })
  } catch (e) { return apiError(e, 'Failed to load views') }
}

function safeParse(s: string): unknown { try { return JSON.parse(s) } catch { return {} } }

const stateSchema = z.record(z.string(), z.unknown())
const createSchema = z.object({
  action: z.literal('create'),
  tableId: z.string().max(60),
  name: z.string().min(1).max(80),
  state: stateSchema,
  scope: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
})
const updateSchema = z.object({ action: z.literal('update'), id: z.number().int(), name: z.string().min(1).max(80).optional(), state: stateSchema.optional(), scope: z.string().max(20).optional(), isDefault: z.boolean().optional() })
const deleteSchema = z.object({ action: z.literal('delete'), id: z.number().int() })
const bodySchema = z.discriminatedUnion('action', [createSchema, updateSchema, deleteSchema])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, bodySchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const viewer = { id: auth.user.id, role: auth.user.role, department: auth.user.department }
  // Sharing beyond private requires user-management rights (mirrors dashboards).
  const resolveScope = (raw?: string): { scope: ShareScope; key: string | null } | { error: NextResponse } => {
    const scope = raw && isShareScope(raw) ? raw : 'private'
    if (scope !== 'private' && !['super_admin', 'administrator'].includes(auth.user.role))
      return { error: NextResponse.json({ error: 'Sharing a view requires user-management rights' }, { status: 403 }) }
    return { scope, key: shareKeyFor(scope, viewer) }
  }
  try {
    if (d.action === 'create') {
      if (!isTableId(d.tableId)) return NextResponse.json({ error: 'Invalid tableId' }, { status: 400 })
      const sc = resolveScope(d.scope); if ('error' in sc) return sc.error
      if (d.isDefault) await pgQuery(`UPDATE table_views SET is_default=false WHERE owner_id=$1 AND table_id=$2`, [auth.user.id, d.tableId])
      const row = (await pgQuery<{ id: number }>(
        `INSERT INTO table_views (owner_id, table_id, name, state, shared_scope, shared_key, is_default, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,${NOW},${NOW}) RETURNING id`,
        [auth.user.id, d.tableId, d.name, JSON.stringify(d.state), sc.scope, sc.key, !!d.isDefault]))[0]
      await logAction(auth.user, 'table.view.create', 'table_views', String(row.id), { tableId: d.tableId, scope: sc.scope })
      return NextResponse.json({ id: row.id })
    }
    // update / delete: only the owner may mutate.
    const owned = (await pgQuery<{ owner_id: string; table_id: string }>(`SELECT owner_id, table_id FROM table_views WHERE id=$1`, [d.id]))[0]
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (owned.owner_id !== auth.user.id) return NextResponse.json({ error: 'Only the owner may modify this view' }, { status: 403 })
    if (d.action === 'delete') {
      await pgQuery(`DELETE FROM table_views WHERE id=$1`, [d.id])
      await logAction(auth.user, 'table.view.delete', 'table_views', String(d.id), {})
      return NextResponse.json({ ok: true })
    }
    // update
    const sc = d.scope !== undefined ? resolveScope(d.scope) : null
    if (sc && 'error' in sc) return sc.error
    if (d.isDefault) await pgQuery(`UPDATE table_views SET is_default=false WHERE owner_id=$1 AND table_id=$2`, [auth.user.id, owned.table_id])
    await pgQuery(
      `UPDATE table_views SET
         name=COALESCE($2,name),
         state=COALESCE($3,state),
         shared_scope=COALESCE($4,shared_scope),
         shared_key=CASE WHEN $4 IS NULL THEN shared_key ELSE $5 END,
         is_default=COALESCE($6,is_default),
         updated_at=${NOW}
       WHERE id=$1`,
      [d.id, d.name ?? null, d.state ? JSON.stringify(d.state) : null, sc ? sc.scope : null, sc ? sc.key : null, d.isDefault ?? null])
    await logAction(auth.user, 'table.view.update', 'table_views', String(d.id), {})
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to save view') }
}
