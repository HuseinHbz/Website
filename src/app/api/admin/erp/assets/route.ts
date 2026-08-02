import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { rialRateFor } from '@/lib/erp/currencyData'
import { ASSET_TYPES, ASSET_STATUSES } from '@/lib/erp/assets'
import { DEPRECIATION_METHODS } from '@/lib/erp/depreciation'
import { loadAssets, assetKpisFrom } from '@/lib/erp/assetData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(200),
  type: z.enum(ASSET_TYPES).default('other'),
  category: z.string().trim().max(80).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  manufacturer: z.string().trim().max(120).optional().nullable(),
  serial: z.string().trim().max(120).optional().nullable(),
  barcode: z.string().trim().max(120).optional().nullable(),
  vendor: z.string().trim().max(120).optional().nullable(),
  status: z.enum(ASSET_STATUSES).default('active'),
  location: z.string().trim().max(200).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  employee: z.string().trim().max(120).optional().nullable(),
  costCenter: z.string().trim().max(120).optional().nullable(),
  project: z.string().trim().max(120).optional().nullable(),
  assignedTo: z.string().trim().max(200).optional().nullable(),
  purchaseDate: z.string().trim().max(30).optional().nullable(),
  purchasePrice: z.number().min(0).default(0),
  currency: z.enum(['IRR', 'IRT', 'USD', 'EUR']).default('IRR'),
  residualValue: z.number().min(0).default(0),
  usefulLifeYears: z.number().min(0).max(100).default(0),
  depreciationMethod: z.enum(DEPRECIATION_METHODS).default('none'),
  warrantyExpiry: z.string().trim().max(30).optional().nullable(),
  insurancePolicy: z.string().trim().max(120).optional().nullable(),
  insuranceExpiry: z.string().trim().max(30).optional().nullable(),
  contractRef: z.string().trim().max(120).optional().nullable(),
  calibrationDue: z.string().trim().max(30).optional().nullable(),
  gpsLat: z.number().optional().nullable(),
  gpsLng: z.number().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
})

export async function GET() {
  try {
    const auth = await requirePermission('erp.assets', 'read')
    if ('error' in auth) return auth.error
    const assets = await loadAssets()
    return NextResponse.json({ assets, stats: assetKpisFrom(assets) })
  } catch (e) { return apiError(e) }
}

const COLS = `name, type, category, model, manufacturer, serial, barcode, vendor, status, location,
  department, employee, cost_center, project, assigned_to, purchase_date, purchase_price, residual_value,
  useful_life_years, depreciation_method, warranty_expiry, insurance_policy, insurance_expiry,
  contract_ref, calibration_due, gps_lat, gps_lng, notes, currency`

function values(d: z.infer<typeof schema>) {
  return [
    d.name, d.type, d.category ?? null, d.model ?? null, d.manufacturer ?? null, d.serial ?? null,
    d.barcode ?? null, d.vendor ?? null, d.status, d.location ?? null, d.department ?? null,
    d.employee ?? null, d.costCenter ?? null, d.project ?? null, d.assignedTo ?? null,
    d.purchaseDate ?? null, d.purchasePrice, d.residualValue, d.usefulLifeYears, d.depreciationMethod,
    d.warrantyExpiry ?? null, d.insurancePolicy ?? null, d.insuranceExpiry ?? null, d.contractRef ?? null,
    d.calibrationDue ?? null, d.gpsLat ?? null, d.gpsLng ?? null, d.notes ?? null, d.currency,
  ]
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('erp.assets', 'write', 'edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, schema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const ph = values(d).map((_, i) => `$${i + 1}`).join(',')
    const result = (await pgQuery(
      `INSERT INTO assets (${COLS}, owner_id, exchange_rate) VALUES (${ph}, $${values(d).length + 1}, $${values(d).length + 2}) RETURNING id`,
      [...values(d), auth.user.id, (await rialRateFor(d.currency)) ?? 1],
    ))[0] as { id: number }
    await pgQuery(
      `INSERT INTO asset_activity (asset_id, action, detail, user_id) VALUES ($1,'created',$2,$3)`,
      [result.id, `Asset "${d.name}" created`, auth.user.id],
    )
    await logAction(auth.user, 'CREATE', 'assets', result.id, null, { name: d.name })
    return NextResponse.json({ id: result.id })
  } catch (e) { return apiError(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission('erp.assets', 'write', 'edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, schema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    if (!d.id) return badRequest('id required')
    const existing = (await pgQuery(`SELECT id, status, currency FROM assets WHERE id=$1`, [d.id]))[0] as { id: number; status: string; currency: string | null } | undefined
    if (!existing) return badRequest('asset not found')
    // Original registration rate is immutable; recapture only on a currency change.
    const rateSql = existing.currency !== d.currency ? `, exchange_rate=${(await rialRateFor(d.currency)) ?? 1}` : ''
    const cols = COLS.split(',').map((c, i) => `${c.trim()}=$${i + 2}`).join(', ')
    await pgQuery(
      `UPDATE assets SET ${cols}${rateSql}, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`,
      [d.id, ...values(d)],
    )
    if (existing.status !== d.status) {
      await pgQuery(`INSERT INTO asset_activity (asset_id, action, detail, user_id) VALUES ($1,'status',$2,$3)`,
        [d.id, `Status ${existing.status} → ${d.status}`, auth.user.id])
    }
    await logAction(auth.user, 'UPDATE', 'assets', d.id, existing, { name: d.name })
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission('erp.assets', 'write', 'delete')
    if ('error' in auth) return auth.error
    const { id } = await req.json().catch(() => ({}))
    if (!id || typeof id !== 'number') return badRequest('id required')
    await pgQuery(`DELETE FROM assets WHERE id=$1`, [id])
    await logAction(auth.user, 'DELETE', 'assets', id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
