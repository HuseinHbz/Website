import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { assetStats, warrantyState, ASSET_TYPES, ASSET_STATUSES, type AssetType, type AssetStatus } from '@/lib/erp/assets'

// ERP Asset register API. Reuses the validated subsystems: zod validation,
// requireAdmin RBAC, and audit logging.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function client(): Database.Database {
  return (getDb() as unknown as { $client: Database.Database }).$client
}

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
    const rows = client().prepare(
      `SELECT id, name, type, serial, vendor, status, location, assigned_to AS assignedTo,
              purchase_date AS purchaseDate, warranty_expiry AS warrantyExpiry, notes,
              created_at AS createdAt, updated_at AS updatedAt
       FROM assets ORDER BY updated_at DESC`
    ).all() as (Row & Record<string, unknown>)[]
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
    const result = client().prepare(
      `INSERT INTO assets (name, type, serial, vendor, status, location, assigned_to, purchase_date, warranty_expiry, notes, owner_id)
       VALUES (@name,@type,@serial,@vendor,@status,@location,@assignedTo,@purchaseDate,@warrantyExpiry,@notes,@ownerId) RETURNING id`
    ).get({
      name: d.name, type: d.type ?? 'other', serial: d.serial || null, vendor: d.vendor || null,
      status: d.status ?? 'active', location: d.location || null, assignedTo: d.assignedTo || null,
      purchaseDate: d.purchaseDate || null, warrantyExpiry: d.warrantyExpiry || null, notes: d.notes || null,
      ownerId: auth.user.id,
    }) as { id: number }
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
    const db = client()
    const existing = db.prepare(`SELECT * FROM assets WHERE id=?`).get(d.id) as Record<string, unknown> | undefined
    if (!existing) return badRequest('asset not found')
    db.prepare(
      `UPDATE assets SET name=@name, type=@type, serial=@serial, vendor=@vendor, status=@status,
        location=@location, assigned_to=@assignedTo, purchase_date=@purchaseDate, warranty_expiry=@warrantyExpiry,
        notes=@notes, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id: d.id, name: d.name, type: d.type ?? existing.type, serial: d.serial ?? existing.serial ?? null,
      vendor: d.vendor ?? existing.vendor ?? null, status: d.status ?? existing.status,
      location: d.location ?? existing.location ?? null, assignedTo: d.assignedTo ?? existing.assigned_to ?? null,
      purchaseDate: d.purchaseDate ?? existing.purchase_date ?? null, warrantyExpiry: d.warrantyExpiry ?? existing.warranty_expiry ?? null,
      notes: d.notes ?? existing.notes ?? null,
    })
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
    client().prepare(`DELETE FROM assets WHERE id=?`).run(id)
    await logAction(auth.user, 'DELETE', 'assets', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
