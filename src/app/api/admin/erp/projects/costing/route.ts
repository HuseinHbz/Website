import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { COST_CATEGORIES, REVENUE_CATEGORIES } from '@/lib/erp/costing'
import { loadProjectCosting, costingPortfolio } from '@/lib/erp/costingData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — a project's costing detail (?id=) or the portfolio rollup (?overview=1).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    if (req.nextUrl.searchParams.get('overview')) return NextResponse.json(await costingPortfolio())
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (!id) return badRequest('id required')
    const data = await loadProjectCosting(id)
    if (!data) return badRequest('Not found')
    return NextResponse.json(data)
  } catch (e) { return apiError(e, 'Failed to load costing') }
}

const schema = z.object({
  projectId: z.number().int().positive(),
  kind: z.enum(['cost', 'revenue']),
  category: z.string().min(1).max(40),
  description: z.string().max(300).optional(),
  amount: z.number().positive(),
  date: z.string().min(1).max(30),
}).refine(d => d.kind === 'cost' ? (COST_CATEGORIES as readonly string[]).includes(d.category) : (REVENUE_CATEGORIES as readonly string[]).includes(d.category), { message: 'invalid category for kind' })

// POST — add a cost or revenue entry.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const row = (await pgQuery(
      `INSERT INTO pm_cost_entries (project_id, kind, category, description, amount, date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [d.projectId, d.kind, d.category, d.description ?? null, d.amount, d.date, auth.user.id]))[0] as { id: number }
    await logAction(auth.user, `pm.costing.${d.kind}`, 'pm_cost_entry', row.id, null, { amount: d.amount })
    return NextResponse.json({ id: row.id })
  } catch (e) { return apiError(e, 'Failed to add entry') }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    await pgQuery(`DELETE FROM pm_cost_entries WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'pm.costing.delete', 'pm_cost_entry', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete entry') }
}
