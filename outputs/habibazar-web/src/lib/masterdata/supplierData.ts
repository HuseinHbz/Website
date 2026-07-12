/**
 * Alternative-supplier data layer (Phase 26.17 M2). Persists the
 * `inv_product_suppliers` M2M and returns ranked/compared sources via the pure
 * ranking engine. Reuses `purchase_vendors` (no duplicate supplier master).
 */
import { pgQuery } from '@/lib/db'
import { rankSuppliers, bestSupplier, compareSuppliers, type ProductSupplier, type RankedSupplier } from './supplierRanking'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function rowsFor(productId: number): Promise<ProductSupplier[]> {
  return pgQuery<ProductSupplier>(
    `SELECT ps.id, ps.supplier_id AS "supplierId", v.name AS "supplierName", ps.purchase_price::float AS "purchasePrice",
            ps.currency, ps.lead_time_days AS "leadTimeDays", ps.minimum_order_qty::float AS "minimumOrderQty",
            ps.quality_score::float AS "qualityScore", ps.delivery_score::float AS "deliveryScore", ps.is_primary AS "isPrimary"
     FROM inv_product_suppliers ps JOIN purchase_vendors v ON v.id=ps.supplier_id
     WHERE ps.product_id=$1 AND ps.active=1`, [productId])
}

export async function productSuppliers(productId: number): Promise<{ suppliers: RankedSupplier[]; best: RankedSupplier | null; comparison: ReturnType<typeof compareSuppliers> }> {
  const rows = await rowsFor(productId)
  return { suppliers: rankSuppliers(rows), best: bestSupplier(rows), comparison: compareSuppliers(rows) }
}

export async function addProductSupplier(d: {
  productId: number; supplierId: number; supplierCode?: string; purchasePrice: number; currency?: string
  leadTimeDays?: number; minimumOrderQty?: number; qualityScore?: number; deliveryScore?: number; isPrimary?: boolean
}): Promise<{ id: number }> {
  const dup = (await pgQuery(`SELECT id FROM inv_product_suppliers WHERE product_id=$1 AND supplier_id=$2`, [d.productId, d.supplierId]))[0] as { id: number } | undefined
  if (dup) {
    await pgQuery(
      `UPDATE inv_product_suppliers SET supplier_code=$2, purchase_price=$3, currency=$4, lead_time_days=$5, minimum_order_qty=$6, quality_score=$7, delivery_score=$8, active=1 WHERE id=$1`,
      [dup.id, d.supplierCode ?? null, d.purchasePrice, d.currency ?? 'IRR', d.leadTimeDays ?? 0, d.minimumOrderQty ?? 0, d.qualityScore ?? 0, d.deliveryScore ?? 0])
    if (d.isPrimary) await setPrimary(d.productId, d.supplierId)
    return { id: dup.id }
  }
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO inv_product_suppliers (product_id, supplier_id, supplier_code, purchase_price, currency, lead_time_days, minimum_order_qty, quality_score, delivery_score, is_primary, active, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,${NOW}) RETURNING id`,
    [d.productId, d.supplierId, d.supplierCode ?? null, d.purchasePrice, d.currency ?? 'IRR', d.leadTimeDays ?? 0, d.minimumOrderQty ?? 0, d.qualityScore ?? 0, d.deliveryScore ?? 0, d.isPrimary ? 1 : 0]))[0]
  if (d.isPrimary) await setPrimary(d.productId, d.supplierId)
  return row
}

/** Exactly one primary supplier per product; also mirrors to inv_products.default_supplier_id. */
export async function setPrimary(productId: number, supplierId: number): Promise<void> {
  await pgQuery(`UPDATE inv_product_suppliers SET is_primary = CASE WHEN supplier_id=$2 THEN 1 ELSE 0 END WHERE product_id=$1`, [productId, supplierId])
  await pgQuery(`UPDATE inv_products SET default_supplier_id=$2 WHERE id=$1`, [productId, supplierId])
}

export async function removeProductSupplier(id: number): Promise<void> {
  await pgQuery(`UPDATE inv_product_suppliers SET active=0 WHERE id=$1`, [id])
}
