import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { canDo } from '@/lib/admin/auth'
import { logAction } from '@/lib/admin/audit'
import { widgetsForWorkspace, defaultLayout, sanitizeLayout, pickLayout, type LayoutEntry } from '@/lib/admin/widgets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

const parseLayout = (s: string | undefined): LayoutEntry[] => {
  try { const v = JSON.parse(s ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}

// GET — a workspace dashboard resolved by priority (user → role → default) plus
// the RBAC-filtered widget catalogue. `?export=1` returns just the layout JSON.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const workspace = req.nextUrl.searchParams.get('workspace') || 'executive'
  try {
    const [userRow, roleRow] = await Promise.all([
      pgQuery<{ layout: string }>(`SELECT layout FROM dashboard_layouts WHERE user_id=$1 AND workspace=$2`, [auth.user.id, workspace]),
      pgQuery<{ layout: string }>(`SELECT layout FROM dashboard_role_layouts WHERE role=$1 AND workspace=$2`, [auth.user.role, workspace]),
    ])
    const resolved = pickLayout(workspace, userRow[0] ? parseLayout(userRow[0].layout) : null, roleRow[0] ? parseLayout(roleRow[0].layout) : null)

    const available = widgetsForWorkspace(workspace)
      .filter(w => !w.requires || canDo(auth.user.role, w.requires))
      .map(w => ({ id: w.id, titleEn: w.titleEn, titleFa: w.titleFa, category: w.category, size: w.size, icon: w.icon }))
    const allowed = new Set(available.map(w => w.id))
    const layout = resolved.layout.filter(e => allowed.has(e.id))

    if (req.nextUrl.searchParams.get('export') === '1') {
      return new NextResponse(JSON.stringify({ workspace, layout }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="dashboard-${workspace}.json"` },
      })
    }
    return NextResponse.json({ workspace, layout, available, source: resolved.source, canSetRole: canDo(auth.user.role, 'manage_users') })
  } catch (e) { return apiError(e, 'Failed to load dashboard') }
}

const entry = z.object({
  id: z.string().max(60), size: z.enum(['sm', 'md', 'lg']),
  config: z.object({ refreshInterval: z.number().int().min(0).max(3600).optional(), warn: z.number().optional(), critical: z.number().optional() }).optional(),
})
const saveSchema = z.object({
  workspace: z.string().min(1).max(40),
  layout: z.array(entry).max(60),
  scope: z.enum(['user', 'role']).default('user'),
})

// PUT — save the layout. scope=user (default) → the caller's personal layout;
// scope=role → the role's default layout (administrator/manage_users only).
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, saveSchema)
  if ('error' in parsed) return parsed.error
  const { workspace, scope } = parsed.data
  const layout = sanitizeLayout(workspace, parsed.data.layout)
  try {
    if (scope === 'role') {
      if (!canDo(auth.user.role, 'manage_users')) return badRequest('Not allowed to set role layouts')
      await pgQuery(
        `INSERT INTO dashboard_role_layouts (role, workspace, layout, updated_at) VALUES ($1,$2,$3,${NOW})
         ON CONFLICT (role, workspace) DO UPDATE SET layout=EXCLUDED.layout, updated_at=${NOW}`,
        [auth.user.role, workspace, JSON.stringify(layout)])
      await logAction(auth.user, 'dashboard.role_layout.save', 'dashboard', `${auth.user.role}:${workspace}`, null, { widgets: layout.length })
    } else {
      await pgQuery(
        `INSERT INTO dashboard_layouts (user_id, workspace, layout, updated_at) VALUES ($1,$2,$3,${NOW})
         ON CONFLICT (user_id, workspace) DO UPDATE SET layout=EXCLUDED.layout, updated_at=${NOW}`,
        [auth.user.id, workspace, JSON.stringify(layout)])
      await logAction(auth.user, 'dashboard.layout.save', 'dashboard', workspace, null, { widgets: layout.length })
    }
    return NextResponse.json({ ok: true, layout })
  } catch (e) { return apiError(e, 'Failed to save layout') }
}

// DELETE — reset the user's layout (falls back to role → default). ?workspace=
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const workspace = req.nextUrl.searchParams.get('workspace')
  if (!workspace) return badRequest('workspace required')
  try {
    await pgQuery(`DELETE FROM dashboard_layouts WHERE user_id=$1 AND workspace=$2`, [auth.user.id, workspace])
    await logAction(auth.user, 'dashboard.layout.reset', 'dashboard', workspace)
    const roleRow = await pgQuery<{ layout: string }>(`SELECT layout FROM dashboard_role_layouts WHERE role=$1 AND workspace=$2`, [auth.user.role, workspace])
    const resolved = pickLayout(workspace, null, roleRow[0] ? parseLayout(roleRow[0].layout) : null)
    return NextResponse.json({ ok: true, layout: resolved.layout, source: resolved.source })
  } catch (e) { return apiError(e, 'Failed to reset layout') }
}
