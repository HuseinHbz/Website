/**
 * Inventory server data layer — loads products + their move ledger from
 * PostgreSQL and computes live stock levels/valuation via the pure engine
 * (lib/erp/inventory.ts). Shared by the products API and the dashboard so the
 * on-hand/valuation numbers are computed in exactly one place.
 */
import { pgQuery } from '@/lib/db'
import {
  valuate, stockStatus, inventoryKpis,
  type Move, type ValuationMethod, type StockStatus,
} from './inventory'

export interface ProductLevel {
  id: number
  sku: string
  barcode: string | null
  nameEn: string
  nameFa: string | null
  category: string
  unit: string
  price: number
  valuationMethod: ValuationMethod
  reorderPoint: number
  minStock: number
  maxStock: number
  safetyStock: number
  active: number
  onHand: number
  value: number
  avgCost: number
  status: StockStatus
}

interface ProductRow {
  id: number; sku: string; barcode: string | null; nameEn: string; nameFa: string | null
  category: string; unit: string; price: string; valuationMethod: ValuationMethod
  reorderPoint: string; minStock: string; maxStock: string; safetyStock: string; active: number
}
interface MoveRow { productId: number; qty: string; unitCost: string }

/** Load all products with live on-hand + valuation + reorder status. */
export async function loadProductLevels(): Promise<ProductLevel[]> {
  const products = (await pgQuery(
    `SELECT id, sku, barcode, name_en AS "nameEn", name_fa AS "nameFa", category, unit,
            price, valuation_method AS "valuationMethod", reorder_point AS "reorderPoint",
            min_stock AS "minStock", max_stock AS "maxStock", safety_stock AS "safetyStock", active
     FROM inv_products ORDER BY name_en`, [],
  )) as unknown as ProductRow[]

  // One pass over the whole ledger, grouped by product (oldest-first per product).
  const moves = (await pgQuery(
    `SELECT product_id AS "productId", qty, unit_cost AS "unitCost"
     FROM inv_moves ORDER BY product_id, created_at, id`, [],
  )) as unknown as MoveRow[]
  const byProduct = new Map<number, Move[]>()
  for (const m of moves) {
    const list = byProduct.get(m.productId) ?? []
    list.push({ type: 'receipt', qty: Number(m.qty), unitCost: Number(m.unitCost) })
    byProduct.set(m.productId, list)
  }

  return products.map(p => {
    const v = valuate(byProduct.get(p.id) ?? [], p.valuationMethod)
    const reorder = {
      onHand: v.onHand,
      reorderPoint: Number(p.reorderPoint), minStock: Number(p.minStock),
      maxStock: Number(p.maxStock), safetyStock: Number(p.safetyStock),
    }
    return {
      id: p.id, sku: p.sku, barcode: p.barcode, nameEn: p.nameEn, nameFa: p.nameFa,
      category: p.category, unit: p.unit, price: Number(p.price), valuationMethod: p.valuationMethod,
      reorderPoint: Number(p.reorderPoint), minStock: Number(p.minStock),
      maxStock: Number(p.maxStock), safetyStock: Number(p.safetyStock), active: p.active,
      onHand: v.onHand, value: v.value, avgCost: v.avgCost, status: stockStatus(reorder),
    }
  })
}

/** Dashboard payload: KPIs + low-stock list + recent moves + per-warehouse split. */
export async function inventoryOverview() {
  const levels = await loadProductLevels()
  const kpis = inventoryKpis(levels)
  const lowStock = levels
    .filter(l => l.status === 'out' || l.status === 'reorder' || l.status === 'below_safety')
    .sort((a, b) => a.onHand - b.onHand)
    .slice(0, 20)

  const recentMoves = (await pgQuery(
    `SELECT m.id, m.type, m.qty, m.unit_cost AS "unitCost", m.created_at AS "createdAt",
            p.sku, p.name_en AS "productEn", p.name_fa AS "productFa", w.code AS "warehouse"
     FROM inv_moves m JOIN inv_products p ON p.id=m.product_id JOIN inv_warehouses w ON w.id=m.warehouse_id
     ORDER BY m.created_at DESC, m.id DESC LIMIT 15`, [],
  ))

  const byWarehouse = (await pgQuery(
    `SELECT w.code AS "warehouse", w.name_en AS "nameEn", w.name_fa AS "nameFa",
            COALESCE(SUM(m.qty),0)::float AS "onHand"
     FROM inv_warehouses w LEFT JOIN inv_moves m ON m.warehouse_id=w.id
     GROUP BY w.id, w.code, w.name_en, w.name_fa ORDER BY w.code`, [],
  ))

  const topValue = [...levels].sort((a, b) => b.value - a.value).slice(0, 8)

  return { kpis, lowStock, recentMoves, byWarehouse, topValue }
}
