import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest, guardJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { validateWorkflow, type WorkflowDefinition } from '@/lib/workflow/engine'

// Enterprise Workflow Designer API (Phase 21). Reuses the validated subsystems:
// zod validation, requireAdmin RBAC, audit logging. The definition graph is
// structurally validated by the pure engine before persist.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  id: z.number().int().positive().optional(),
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_.-]+$/i, 'letters, digits, . _ - only'),
  nameEn: z.string().trim().min(1).max(200),
  nameFa: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  definition: z.string().trim().max(200_000),
  status: z.enum(['draft', 'active', 'archived']).optional(),
})

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const rows = await pgQuery(
      `SELECT w.id, w.key, w.name_en AS "nameEn", w.name_fa AS "nameFa", w.description,
              w.definition, w.version, w.status, w.updated_at AS "updatedAt",
              (SELECT count(*)::int FROM workflow_runs r WHERE r.workflow_id = w.id) AS runs
       FROM workflows w ORDER BY w.updated_at DESC`,
    )
    return NextResponse.json({ workflows: rows })
  } catch (e: unknown) {
    return apiError(e)
  }
}

function parseDef(definition: string): { def?: WorkflowDefinition; error?: string } {
  let def: WorkflowDefinition
  try { def = JSON.parse(definition) } catch { return { error: 'definition is not valid JSON' } }
  const v = validateWorkflow(def)
  if (!v.valid) return { error: `invalid workflow: ${v.errors.join('; ')}` }
  return { def }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin('edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, schema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const { def, error } = parseDef(d.definition)
    if (error || !def) return badRequest(error ?? 'invalid definition')
    try {
      const result = (await pgQuery(
        `INSERT INTO workflows (key, name_en, name_fa, description, definition, version, status, owner_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [d.key, d.nameEn, d.nameFa || null, d.description || null, JSON.stringify(def), def.version ?? 1, d.status ?? 'draft', auth.user.id],
      ))[0] as { id: number }
      await logAction(auth.user, 'CREATE', 'workflows', result.id, null, { key: d.key, nameEn: d.nameEn })
      return NextResponse.json({ id: result.id })
    } catch (e) {
      if (/unique|duplicate key/i.test(String(e))) return badRequest('a workflow with that key already exists')
      throw e
    }
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin('edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, schema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    if (!d.id) return badRequest('id required')
    const existing = (await pgQuery(`SELECT * FROM workflows WHERE id=$1`, [d.id]))[0] as Record<string, unknown> | undefined
    if (!existing) return badRequest('workflow not found')
    const { def, error } = parseDef(d.definition)
    if (error || !def) return badRequest(error ?? 'invalid definition')
    // Bump version when the graph changed (workflow versioning).
    const changed = String(existing.definition) !== JSON.stringify(def)
    const version = changed ? Number(existing.version) + 1 : Number(existing.version)
    await pgQuery(
      `UPDATE workflows SET key=$2, name_en=$3, name_fa=$4, description=$5, definition=$6,
        version=$7, status=$8, updated_at=to_char(now(), 'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`,
      [d.id, d.key, d.nameEn, d.nameFa || null, d.description || null, JSON.stringify(def), version, d.status ?? (existing.status as string)],
    )
    await logAction(auth.user, 'UPDATE', 'workflows', d.id, existing, { key: d.key, version })
    return NextResponse.json({ ok: true, version })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin('delete')
    if ('error' in auth) return auth.error
    const { id } = await guardJson(req).catch(() => ({}))
    if (!id || typeof id !== 'number') return badRequest('id required')
    await pgQuery(`DELETE FROM workflows WHERE id=$1`, [id])
    await logAction(auth.user, 'DELETE', 'workflows', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
