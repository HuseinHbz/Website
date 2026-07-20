import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { PROJECT_STATUSES } from '@/lib/erp/projects'
import { loadProjects, loadProjectDetail, projectOverview } from '@/lib/erp/projectData'
import { nextNumber } from '@/lib/numbering/integrate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// GET — list projects, one detail hub (?id=), or the dashboard (?overview=1).
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.project-management', 'read')
  if ('error' in auth) return auth.error
  try {
    if (req.nextUrl.searchParams.get('overview')) return NextResponse.json(await projectOverview())
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (id) {
      const detail = await loadProjectDetail(id)
      if (!detail) return badRequest('Not found')
      return NextResponse.json(detail)
    }
    return NextResponse.json({ projects: await loadProjects() })
  } catch (e) { return apiError(e, 'Failed to load projects') }
}

const schema = z.object({
  id: z.number().int().positive().optional(),
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  customer: z.string().max(200).optional().nullable(),
  manager: z.string().max(120).optional().nullable(),
  status: z.enum(PROJECT_STATUSES).default('planning'),
  startDate: z.string().max(30).optional().nullable(),
  endDate: z.string().max(30).optional().nullable(),
  budget: z.number().min(0).default(0),
  hourlyRate: z.number().min(0).default(0),
  notes: z.string().max(2000).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.project-management', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (!d.id) {
      // Auto-number via the Enterprise Numbering Engine when no code is supplied.
      const code = d.code?.trim() || await nextNumber('project', { module: 'projects', userId: auth.user.id, legacyPrefix: 'PRJ' })
      const dup = (await pgQuery(`SELECT id FROM pm_projects WHERE code=$1`, [code]))[0]
      if (dup) return badRequest('A project with this code already exists')
      const row = (await pgQuery(
        `INSERT INTO pm_projects (code, name, customer, manager, status, start_date, end_date, budget, hourly_rate, notes, created_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,${NOW}) RETURNING id`,
        [code, d.name, d.customer ?? null, d.manager ?? null, d.status, d.startDate ?? null, d.endDate ?? null, d.budget, d.hourlyRate, d.notes ?? null, auth.user.id]))[0] as { id: number }
      await logAction(auth.user, 'pm.project.create', 'pm_project', row.id)
      return NextResponse.json({ id: row.id, code })
    }
    if (!d.code) return badRequest('code is required when updating a project')
    await pgQuery(
      `UPDATE pm_projects SET code=$2, name=$3, customer=$4, manager=$5, status=$6, start_date=$7, end_date=$8, budget=$9, hourly_rate=$10, notes=$11, updated_at=${NOW} WHERE id=$1`,
      [d.id, d.code, d.name, d.customer ?? null, d.manager ?? null, d.status, d.startDate ?? null, d.endDate ?? null, d.budget, d.hourlyRate, d.notes ?? null])
    await logAction(auth.user, 'pm.project.update', 'pm_project', d.id)
    return NextResponse.json({ id: d.id })
  } catch (e) { return apiError(e, 'Failed to save project') }
}
export const PUT = POST

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('erp.project-management', 'write', 'delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    await pgQuery(`DELETE FROM pm_projects WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'pm.project.delete', 'pm_project', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete project') }
}
