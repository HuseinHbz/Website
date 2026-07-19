import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { loadProductLevels } from '@/lib/erp/inventoryData'
import { inventoryKpis } from '@/lib/erp/inventory'
import { recordVersion } from '@/lib/masterdata/versionData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — products with live on-hand, valuation and reorder status + KPI rollup.
// `?picker=1[&q=...]` returns a lightweight, server-limited search (SKU/barcode/
// name) for the enterprise product picker — never loads the whole catalog (26.15).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const sp = req.nextUrl.searchParams
    if (sp.get('picker')) {
      const q = (sp.get('q') ?? '').trim().toLowerCase()
      const term = `%${q}%`
      const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 25))
      const rows = await pgQuery(
        `SELECT id, sku, barcode, name_en AS "nameEn", name_fa AS "nameFa", price::float AS price
         FROM inv_products WHERE active=1 AND ($1='%%' OR lower(sku) LIKE $1 OR lower(name_en) LIKE $1
           OR lower(COALESCE(name_fa,'')) LIKE $1 OR lower(COALESCE(barcode,'')) LIKE $1)
         ORDER BY name_en LIMIT $2`, [term, limit])
      return NextResponse.json({ products: rows, picker: true })
    }
    const products = await loadProductLevels()
    return NextResponse.json({ products, kpis: inventoryKpis(products) })
  } catch (e) { return apiError(e, 'Failed to load products') }
}

const schema = z.object({
  id: z.number().int().positive().optional(),
  sku: z.string().min(1).max(80),
  barcode: z.string().max(120).optional(),
  nameEn: z.string().min(1).max(200),
  nameFa: z.string().max(200).optional(),
  category: z.string().min(1).max(60).default('general'),
  unit: z.string().min(1).max(20).default('pcs'),
  cost: z.number().min(0).default(0),
  price: z.number().min(0).default(0),
  trackLot: z.boolean().default(false),
  trackSerial: z.boolean().default(false),
  valuationMethod: z.enum(['fifo', 'lifo', 'wavg']).default('wavg'),
  reorderPoint: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  maxStock: z.number().min(0).default(0),
  safetyStock: z.number().min(0).default(0),
  active: z.boolean().default(true),
  openingWarehouseId: z.number().int().positive().optional(),
  openingQty: z.number().min(0).optional(),
  defaultSupplierId: z.number().int().positive().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (!d.id) {
      const dup = (await pgQuery(`SELECT id FROM inv_products WHERE sku=$1`, [d.sku]))[0]
      if (dup) return badRequest('A product with this SKU already exists')
      const row = (await pgQuery(
        `INSERT INTO inv_products (sku, barcode, name_en, name_fa, category, unit, cost, price,
           track_lot, track_serial, valuation_method, reorder_point, min_stock, max_stock, safety_stock, active, default_supplier_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
        [d.sku, d.barcode ?? null, d.nameEn, d.nameFa ?? null, d.category, d.unit, d.cost, d.price,
         d.trackLot ? 1 : 0, d.trackSerial ? 1 : 0, d.valuationMethod, d.reorderPoint, d.minStock, d.maxStock, d.safetyStock, d.active ? 1 : 0, d.defaultSupplierId ?? null],
      ))[0] as { id: number }
      // 26.10: opening stock — receive the initial quantity into the chosen
      // warehouse so a newly-defined product isn't immediately 'out of stock'.
      if (d.openingWarehouseId && (d.openingQty ?? 0) > 0) {
        await pgQuery(
          `INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at)
           VALUES ($1,$2,'receipt',$3,$4,'Opening stock',$5, to_char(now(),'YYYY-MM-DD HH24:MI:SS'))`,
          [row.id, d.openingWarehouseId, d.openingQty, d.cost, auth.user.id])
      }
      await logAction(auth.user, 'inv.product.create', 'inv_product', row.id, null, { sku: d.sku, openingQty: d.openingQty ?? 0 })
      return NextResponse.json({ id: row.id })
    }
    // Phase 26.17 M3 — snapshot the tracked fields before the change for versioning.
    const before = (await pgQuery<Record<string, unknown>>(
      `SELECT sku, name_en AS "nameEn", name_fa AS "nameFa", price::float AS price, cost::float AS cost, category_id AS "categoryId", default_supplier_id AS "defaultSupplierId", active FROM inv_products WHERE id=$1`, [d.id]))[0]
    await pgQuery(
      `UPDATE inv_products SET sku=$2, barcode=$3, name_en=$4, name_fa=$5, category=$6, unit=$7, cost=$8, price=$9,
         track_lot=$10, track_serial=$11, valuation_method=$12, reorder_point=$13, min_stock=$14, max_stock=$15,
         safety_stock=$16, active=$17, default_supplier_id=$18, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`,
      [d.id, d.sku, d.barcode ?? null, d.nameEn, d.nameFa ?? null, d.category, d.unit, d.cost, d.price,
       d.trackLot ? 1 : 0, d.trackSerial ? 1 : 0, d.valuationMethod, d.reorderPoint, d.minStock, d.maxStock, d.safetyStock, d.active ? 1 : 0, d.defaultSupplierId ?? null],
    )
    if (before) await recordVersion('product', d.id,
      before,
      { sku: d.sku, nameEn: d.nameEn, nameFa: d.nameFa ?? null, price: d.price, cost: d.cost, categoryId: before.categoryId, defaultSupplierId: d.defaultSupplierId ?? null, active: d.active ? 1 : 0 },
      auth.user.id)
    await logAction(auth.user, 'inv.product.update', 'inv_product', d.id)
    return NextResponse.json({ id: d.id })
  } catch (e) { return apiError(e, 'Failed to save product') }
}

export const PUT = POST

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    await pgQuery(`DELETE FROM inv_products WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'inv.product.delete', 'inv_product', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete product') }
}
