import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const warehouses = await pgQuery(
      `SELECT w.id, w.code, w.name_en AS "nameEn", w.name_fa AS "nameFa", w.branch, w.address, w.active,
              (SELECT COUNT(*)::int FROM inv_locations l WHERE l.warehouse_id=w.id) AS "locationCount"
       FROM inv_warehouses w ORDER BY w.code`, [])
    return NextResponse.json({ warehouses })
  } catch (e) { return apiError(e, 'Failed to load warehouses') }
}

const schema = z.object({
  id: z.number().int().positive().optional(),
  code: z.string().min(1).max(40),
  nameEn: z.string().min(1).max(160),
  nameFa: z.string().max(160).optional(),
  branch: z.string().max(120).optional(),
  address: z.string().max(400).optional(),
  active: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (!d.id) {
      const dup = (await pgQuery(`SELECT id FROM inv_warehouses WHERE code=$1`, [d.code]))[0]
      if (dup) return badRequest('A warehouse with this code already exists')
      const row = (await pgQuery(
        `INSERT INTO inv_warehouses (code, name_en, name_fa, branch, address, active)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [d.code, d.nameEn, d.nameFa ?? null, d.branch ?? null, d.address ?? null, d.active ? 1 : 0],
      ))[0] as { id: number }
      await logAction(auth.user, 'inv.warehouse.create', 'inv_warehouse', row.id)
      return NextResponse.json({ id: row.id })
    }
    await pgQuery(
      `UPDATE inv_warehouses SET code=$2, name_en=$3, name_fa=$4, branch=$5, address=$6, active=$7 WHERE id=$1`,
      [d.id, d.code, d.nameEn, d.nameFa ?? null, d.branch ?? null, d.address ?? null, d.active ? 1 : 0],
    )
    await logAction(auth.user, 'inv.warehouse.update', 'inv_warehouse', d.id)
    return NextResponse.json({ id: d.id })
  } catch (e) { return apiError(e, 'Failed to save warehouse') }
}

export const PUT = POST

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    const moves = (await pgQuery(`SELECT 1 FROM inv_moves WHERE warehouse_id=$1 LIMIT 1`, [parsed.data.id]))[0]
    if (moves) return badRequest('Warehouse has stock movements and cannot be deleted')
    await pgQuery(`DELETE FROM inv_warehouses WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'inv.warehouse.delete', 'inv_warehouse', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete warehouse') }
}
