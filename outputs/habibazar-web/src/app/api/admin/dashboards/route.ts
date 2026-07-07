import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { canDo } from '@/lib/admin/auth'
import { widgetsForWorkspace, defaultLayout, sanitizeLayout, type LayoutEntry } from '@/lib/admin/widgets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// GET — a workspace dashboard: the user's saved layout (or the system default)
// plus the catalogue of widgets they may add (RBAC-filtered).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const workspace = req.nextUrl.searchParams.get('workspace') || 'executive'
  try {
    const saved = (await pgQuery(
      `SELECT layout FROM dashboard_layouts WHERE user_id=$1 AND workspace=$2`, [auth.user.id, workspace]))[0] as { layout: string } | undefined
    let layout: LayoutEntry[]
    if (saved) { try { layout = sanitizeLayout(workspace, JSON.parse(saved.layout)) } catch { layout = defaultLayout(workspace) } }
    else layout = defaultLayout(workspace)
    const available = widgetsForWorkspace(workspace)
      .filter(w => !w.requires || canDo(auth.user.role, w.requires))
      .map(w => ({ id: w.id, titleEn: w.titleEn, titleFa: w.titleFa, category: w.category, size: w.size, icon: w.icon }))
    const allowed = new Set(available.map(w => w.id))
    layout = layout.filter(e => allowed.has(e.id))
    return NextResponse.json({ workspace, layout, available })
  } catch (e) { return apiError(e, 'Failed to load dashboard') }
}

const saveSchema = z.object({
  workspace: z.string().min(1).max(40),
  layout: z.array(z.object({ id: z.string().max(60), size: z.enum(['sm', 'md', 'lg']) })).max(60),
})

// PUT — persist the user's layout for a workspace.
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, saveSchema)
  if ('error' in parsed) return parsed.error
  const { workspace } = parsed.data
  const layout = sanitizeLayout(workspace, parsed.data.layout)
  try {
    await pgQuery(
      `INSERT INTO dashboard_layouts (user_id, workspace, layout, updated_at)
       VALUES ($1,$2,$3,${NOW})
       ON CONFLICT (user_id, workspace) DO UPDATE SET layout=EXCLUDED.layout, updated_at=${NOW}`,
      [auth.user.id, workspace, JSON.stringify(layout)])
    return NextResponse.json({ ok: true, layout })
  } catch (e) { return apiError(e, 'Failed to save layout') }
}

// DELETE — reset to the system default (?workspace=).
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const workspace = req.nextUrl.searchParams.get('workspace')
  if (!workspace) return badRequest('workspace required')
  try {
    await pgQuery(`DELETE FROM dashboard_layouts WHERE user_id=$1 AND workspace=$2`, [auth.user.id, workspace])
    return NextResponse.json({ ok: true, layout: defaultLayout(workspace) })
  } catch (e) { return apiError(e, 'Failed to reset layout') }
}
