import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — list scopes (companies/branches/warehouses/departments), optional ?kind=.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('erp.numbering', 'read')
  if ('error' in auth) return auth.error
  const kind = req.nextUrl.searchParams.get('kind')
  try {
    const params: unknown[] = []
    let where = ''
    if (kind) { params.push(kind); where = 'WHERE kind=$1' }
    const scopes = await pgQuery(
      `SELECT id, kind, code, name_en AS "nameEn", name_fa AS "nameFa", active
       FROM numbering_scopes ${where} ORDER BY kind, code`, params)
    return NextResponse.json({ scopes })
  } catch (e) { return apiError(e, 'Failed to load scopes') }
}

const schema = z.object({
  id: z.number().int().positive().optional(),
  kind: z.enum(['company', 'branch', 'warehouse', 'department']),
  code: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, 'letters, digits, - and _ only'),
  nameEn: z.string().min(1).max(120),
  nameFa: z.string().max(120).optional(),
  active: z.number().int().min(0).max(1).default(1),
})

// POST — create or update a scope entry.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('erp.numbering', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.id) {
      await pgQuery(`UPDATE numbering_scopes SET kind=$2, code=$3, name_en=$4, name_fa=$5, active=$6 WHERE id=$1`,
        [d.id, d.kind, d.code, d.nameEn, d.nameFa ?? null, d.active])
      await logAction(auth.user, 'update', 'numbering_scope', d.id, null, d)
      return NextResponse.json({ ok: true })
    }
    const dup = await pgQuery(`SELECT 1 FROM numbering_scopes WHERE kind=$1 AND code=$2`, [d.kind, d.code])
    if (dup.length) return badRequest('A scope with this kind + code already exists')
    const row = (await pgQuery(
      `INSERT INTO numbering_scopes (kind, code, name_en, name_fa, active) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [d.kind, d.code, d.nameEn, d.nameFa ?? null, d.active]))[0] as { id: number }
    await logAction(auth.user, 'create', 'numbering_scope', row.id, null, d)
    return NextResponse.json({ id: row.id })
  } catch (e) { return apiError(e, 'Failed to save scope') }
}

// DELETE — remove a scope. ?id=
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('erp.numbering', 'write', 'delete')
  if ('error' in auth) return auth.error
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) return badRequest('id required')
  try {
    await pgQuery(`DELETE FROM numbering_scopes WHERE id=$1`, [id])
    await logAction(auth.user, 'delete', 'numbering_scope', id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete scope') }
}
