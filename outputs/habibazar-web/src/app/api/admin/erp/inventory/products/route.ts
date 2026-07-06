import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { loadProductLevels } from '@/lib/erp/inventoryData'
import { inventoryKpis } from '@/lib/erp/inventory'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — products with live on-hand, valuation and reorder status + KPI rollup.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
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
           track_lot, track_serial, valuation_method, reorder_point, min_stock, max_stock, safety_stock, active, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, to_char(now(),'YYYY-MM-DD HH24:MI:SS')) RETURNING id`,
        [d.sku, d.barcode ?? null, d.nameEn, d.nameFa ?? null, d.category, d.unit, d.cost, d.price,
         d.trackLot ? 1 : 0, d.trackSerial ? 1 : 0, d.valuationMethod, d.reorderPoint, d.minStock, d.maxStock, d.safetyStock, d.active ? 1 : 0],
      ))[0] as { id: number }
      await logAction(auth.user, 'inv.product.create', 'inv_product', row.id, null, { sku: d.sku })
      return NextResponse.json({ id: row.id })
    }
    await pgQuery(
      `UPDATE inv_products SET sku=$2, barcode=$3, name_en=$4, name_fa=$5, category=$6, unit=$7, cost=$8, price=$9,
         track_lot=$10, track_serial=$11, valuation_method=$12, reorder_point=$13, min_stock=$14, max_stock=$15,
         safety_stock=$16, active=$17, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`,
      [d.id, d.sku, d.barcode ?? null, d.nameEn, d.nameFa ?? null, d.category, d.unit, d.cost, d.price,
       d.trackLot ? 1 : 0, d.trackSerial ? 1 : 0, d.valuationMethod, d.reorderPoint, d.minStock, d.maxStock, d.safetyStock, d.active ? 1 : 0],
    )
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
