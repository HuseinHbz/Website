import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { sanitizeLayout } from '@/lib/admin/widgets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

interface TplRow { id: number; nameEn: string; nameFa: string | null; workspace: string; layout: string; createdAt: string }

// GET — templates for a workspace (?workspace=).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const workspace = req.nextUrl.searchParams.get('workspace')
  try {
    const rows = await pgQuery<TplRow>(
      `SELECT id, name_en AS "nameEn", name_fa AS "nameFa", workspace, layout, created_at AS "createdAt"
       FROM dashboard_templates ${workspace ? 'WHERE workspace=$1' : ''} ORDER BY created_at DESC`,
      workspace ? [workspace] : [])
    return NextResponse.json({ templates: rows.map(r => ({ ...r, layout: JSON.parse(r.layout || '[]') })) })
  } catch (e) { return apiError(e, 'Failed to load templates') }
}

const entry = z.object({ id: z.string().max(60), size: z.enum(['sm', 'md', 'lg']), config: z.object({ refreshInterval: z.number().int().min(0).max(3600).optional(), warn: z.number().optional(), critical: z.number().optional() }).optional() })
const createSchema = z.object({ nameEn: z.string().min(1).max(80), nameFa: z.string().max(80).optional(), workspace: z.string().min(1).max(40), layout: z.array(entry).max(60) })

// POST — create a template from a layout (create or clone; edit require).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, createSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const layout = sanitizeLayout(d.workspace, d.layout)
  try {
    const row = (await pgQuery<{ id: number }>(
      `INSERT INTO dashboard_templates (name_en, name_fa, workspace, layout, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [d.nameEn, d.nameFa ?? null, d.workspace, JSON.stringify(layout), auth.user.id]))[0]
    await logAction(auth.user, 'dashboard.template.create', 'dashboard_template', row.id, null, { workspace: d.workspace, widgets: layout.length })
    return NextResponse.json({ id: row.id })
  } catch (e) { return apiError(e, 'Failed to create template') }
}

// DELETE — remove a template (?id=). Requires edit.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) return badRequest('id required')
  try {
    await pgQuery(`DELETE FROM dashboard_templates WHERE id=$1`, [id])
    await logAction(auth.user, 'dashboard.template.delete', 'dashboard_template', id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete template') }
}
