/**
 * Price-list data layer (Phase 26.9). Named catalogs of per-product prices used
 * to fill sales-line descriptions and unit prices. Pure DB access; the sales
 * document engine keeps its own line math.
 */
import { pgQuery } from '@/lib/db'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export interface PriceList { id: number; code: string; nameEn: string; nameFa: string; currency: string; isDefault: boolean; active: boolean; itemCount: number }
export interface PriceListItem { id: number; productId: number; sku: string; nameEn: string; nameFa: string | null; unitPrice: number }

export async function listPriceLists(): Promise<PriceList[]> {
  return (await pgQuery(
    `SELECT p.id, p.code, p.name_en AS "nameEn", p.name_fa AS "nameFa", p.currency, p.is_default AS "isDefault", p.active,
            (SELECT COUNT(*)::int FROM price_list_items i WHERE i.price_list_id=p.id) AS "itemCount"
     FROM price_lists p ORDER BY p.is_default DESC, p.code`)) as unknown as PriceList[]
}

export async function priceListItems(priceListId: number): Promise<PriceListItem[]> {
  return (await pgQuery(
    `SELECT i.id, i.product_id AS "productId", pr.sku, pr.name_en AS "nameEn", pr.name_fa AS "nameFa", i.unit_price::float AS "unitPrice"
     FROM price_list_items i JOIN inv_products pr ON pr.id=i.product_id
     WHERE i.price_list_id=$1 ORDER BY pr.name_en`, [priceListId])) as unknown as PriceListItem[]
}

export async function savePriceList(p: { id?: number; code: string; nameEn: string; nameFa: string; currency?: string; active?: boolean }, userId?: string): Promise<number> {
  if (p.id) {
    await pgQuery(`UPDATE price_lists SET code=$2, name_en=$3, name_fa=$4, currency=$5, active=$6, updated_at=${NOW} WHERE id=$1`,
      [p.id, p.code, p.nameEn, p.nameFa, p.currency ?? 'IRR', p.active ?? true])
    return p.id
  }
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO price_lists (code, name_en, name_fa, currency, active, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,${NOW},${NOW}) RETURNING id`,
    [p.code, p.nameEn, p.nameFa, p.currency ?? 'IRR', p.active ?? true, userId ?? null]))[0]
  return row.id
}

/** Upsert a product price into a list (delete when price is null). */
export async function setPriceListItem(priceListId: number, productId: number, unitPrice: number | null) {
  if (unitPrice == null) {
    await pgQuery(`DELETE FROM price_list_items WHERE price_list_id=$1 AND product_id=$2`, [priceListId, productId])
    return
  }
  await pgQuery(
    `INSERT INTO price_list_items (price_list_id, product_id, unit_price) VALUES ($1,$2,$3)
     ON CONFLICT (price_list_id, product_id) DO UPDATE SET unit_price=$3`, [priceListId, productId, unitPrice])
}

export async function deletePriceList(id: number) {
  await pgQuery(`DELETE FROM price_lists WHERE id=$1`, [id])
}
