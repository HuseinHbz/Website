/**
 * Master-data versioning data layer (Phase 26.17 M3). Records a version row into
 * `master_data_history` whenever a tracked entity's fields actually change, serves
 * the timeline, and restores a prior version. Distinct from `logAction` (generic
 * audit): this is a per-entity, restorable value store.
 */
import { pgQuery } from '@/lib/db'
import { diffValues, restorePayload, type HistoryEntry } from './versioning'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// Which fields are versioned per entity type (price/credit-limit are called out).
export const TRACKED: Record<string, string[]> = {
  product: ['sku', 'nameEn', 'nameFa', 'price', 'cost', 'categoryId', 'defaultSupplierId', 'active'],
  customer: ['name', 'creditLimit', 'nationalId', 'economicCode', 'active'],
  supplier: ['name', 'economicCode', 'iban', 'paymentTerms', 'active'],
  category: ['code', 'nameEn', 'nameFa', 'parentId', 'active'],
}

/** Record a version if any tracked field changed. Returns the new version no. */
export async function recordVersion(entityType: string, entityId: number, oldObj: Record<string, unknown>, newObj: Record<string, unknown>, changedBy?: string, reason?: string): Promise<number | null> {
  const fields = TRACKED[entityType] ?? Object.keys(newObj)
  if (diffValues(oldObj, newObj, fields).length === 0) return null
  const last = (await pgQuery<{ v: number }>(`SELECT COALESCE(MAX(version),0)::int AS v FROM master_data_history WHERE entity_type=$1 AND entity_id=$2`, [entityType, entityId]))[0].v
  const version = last + 1
  await pgQuery(
    `INSERT INTO master_data_history (entity_type, entity_id, version, old_value, new_value, changed_by, change_reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,${NOW})`,
    [entityType, entityId, version, JSON.stringify(pick(oldObj, fields)), JSON.stringify(pick(newObj, fields)), changedBy ?? null, reason ?? null])
  return version
}

const pick = (o: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.map(f => [f, o?.[f] ?? null]))

export async function entityHistory(entityType: string, entityId: number): Promise<HistoryEntry[]> {
  return pgQuery<HistoryEntry>(
    `SELECT id, version, old_value AS "oldValue", new_value AS "newValue", changed_by AS "changedBy", change_reason AS "changeReason", created_at AS "createdAt"
     FROM master_data_history WHERE entity_type=$1 AND entity_id=$2 ORDER BY version DESC`, [entityType, entityId])
}

/**
 * Restore a product to the values recorded in a history entry. Only the product
 * entity is restorable in this pass (price/name/category are the common cases);
 * the restore itself is versioned so the timeline stays complete.
 */
export async function restoreProductVersion(historyId: number, changedBy?: string): Promise<{ restoredTo: number }> {
  const h = (await pgQuery<{ entity_id: number; new_value: string | null }>(`SELECT entity_id, new_value FROM master_data_history WHERE id=$1 AND entity_type='product'`, [historyId]))[0]
  if (!h) throw new Error('History entry not found')
  const payload = restorePayload({ newValue: h.new_value })
  if (!payload) throw new Error('Nothing to restore')
  const cur = (await pgQuery<Record<string, unknown>>(
    `SELECT sku, name_en AS "nameEn", name_fa AS "nameFa", price::float AS price, cost::float AS cost, category_id AS "categoryId", default_supplier_id AS "defaultSupplierId", active FROM inv_products WHERE id=$1`, [h.entity_id]))[0]
  await pgQuery(
    `UPDATE inv_products SET price=COALESCE($2,price), cost=COALESCE($3,cost), name_en=COALESCE($4,name_en), name_fa=COALESCE($5,name_fa), category_id=$6, updated_at=${NOW} WHERE id=$1`,
    [h.entity_id, payload.price ?? null, payload.cost ?? null, payload.nameEn ?? null, payload.nameFa ?? null, payload.categoryId ?? null])
  await recordVersion('product', h.entity_id, cur, { ...cur, ...payload }, changedBy, `Restore of version from history #${historyId}`)
  return { restoredTo: h.entity_id }
}
