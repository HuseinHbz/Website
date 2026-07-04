import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { assetStats, warrantyState, ASSET_TYPES, ASSET_STATUSES, type AssetType, type AssetStatus } from '@/lib/erp/assets'

// ERP Asset register API. Reuses the validated subsystems: zod validation,
// requireAdmin RBAC, and audit logging.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(200),
  type: z.enum(ASSET_TYPES).optional(),
  serial: z.string().trim().max(120).optional().nullable(),
  vendor: z.string().trim().max(120).optional().nullable(),
  status: z.enum(ASSET_STATUSES).optional(),
  location: z.string().trim().max(200).optional().nullable(),
  assignedTo: z.string().trim().max(200).optional().nullable(),
  purchaseDate: z.string().trim().max(30).optional().nullable(),
  warrantyExpiry: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
})

interface Row { type: AssetType; status: AssetStatus; warrantyExpiry: string | null }

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const rows = await pgQuery(
      `SELECT id, name, type, serial, vendor, status, location, assigned_to AS "assignedTo",
              purchase_date AS "purchaseDate", warranty_expiry AS "warrantyExpiry", notes,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM assets ORDER BY updated_at DESC`
    ) as (Row & Record<string, unknown>)[]
    const withHealth = rows.map((r) => ({ ...r, warranty: warrantyState(r.warrantyExpiry) }))
    const stats = assetStats(rows.map((r) => ({ type: r.type, status: r.status, warrantyExpiry: r.warrantyExpiry })))
    return NextResponse.json({ assets: withHealth, stats })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin('edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, schema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const result = (await pgQuery(
      `INSERT INTO assets (name, type, serial, vendor, status, location, assigned_to, purchase_date, warranty_expiry, notes, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [d.name, d.type ?? 'other', d.serial || null, d.vendor || null,
        d.status ?? 'active', d.location || null, d.assignedTo || null,
        d.purchaseDate || null, d.warrantyExpiry || null, d.notes || null,
        auth.user.id],
    ))[0] as { id: number }
    await logAction(auth.user, 'CREATE', 'assets', result.id, null, d)
    return NextResponse.json({ id: result.id })
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
    const existing = (await pgQuery(`SELECT * FROM assets WHERE id=$1`, [d.id]))[0] as Record<string, unknown> | undefined
    if (!existing) return badRequest('asset not found')
    await pgQuery(
      `UPDATE assets SET name=$2, type=$3, serial=$4, vendor=$5, status=$6,
        location=$7, assigned_to=$8, purchase_date=$9, warranty_expiry=$10,
        notes=$11, updated_at=to_char(now(), 'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`,
      [d.id, d.name, d.type ?? existing.type, d.serial ?? existing.serial ?? null,
        d.vendor ?? existing.vendor ?? null, d.status ?? existing.status,
        d.location ?? existing.location ?? null, d.assignedTo ?? existing.assigned_to ?? null,
        d.purchaseDate ?? existing.purchase_date ?? null, d.warrantyExpiry ?? existing.warranty_expiry ?? null,
        d.notes ?? existing.notes ?? null],
    )
    await logAction(auth.user, 'UPDATE', 'assets', d.id, existing, d)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin('delete')
    if ('error' in auth) return auth.error
    const { id } = await req.json().catch(() => ({}))
    if (!id || typeof id !== 'number') return badRequest('id required')
    await pgQuery(`DELETE FROM assets WHERE id=$1`, [id])
    await logAction(auth.user, 'DELETE', 'assets', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
