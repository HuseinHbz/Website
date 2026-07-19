/**
 * Category tree data layer (Phase 26.17 M1). Persists the `erp_categories`
 * hierarchy and enforces the business rules the pure engine can't (product
 * linkage, cycle-safe move, migration from the legacy free-text category).
 */
import { pgQuery } from '@/lib/db'
import { buildTree, canMove, levelOf, treeStats, descendants, type CategoryRow, type CategoryNode, type TreeStats } from './categoryTree'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function allRows(): Promise<CategoryRow[]> {
  return pgQuery<CategoryRow>(
    `SELECT id, parent_id AS "parentId", code, name_en AS "nameEn", name_fa AS "nameFa", level, sort_order AS "sortOrder", active FROM erp_categories`)
}

async function productCounts(): Promise<Record<number, number>> {
  const rows = await pgQuery<{ category_id: number; n: number }>(
    `SELECT category_id, COUNT(*)::int AS n FROM inv_products WHERE category_id IS NOT NULL AND active=1 GROUP BY category_id`)
  return Object.fromEntries(rows.map(r => [r.category_id, r.n]))
}

export async function categoryTree(): Promise<{ tree: CategoryNode[]; stats: TreeStats; flat: CategoryRow[] }> {
  const rows = await allRows()
  const counts = await productCounts()
  return { tree: buildTree(rows, counts), stats: treeStats(rows), flat: rows }
}

export async function createCategory(d: { code: string; nameEn: string; nameFa?: string; parentId?: number | null; description?: string; sortOrder?: number }, userId?: string): Promise<{ id: number }> {
  const rows = await allRows()
  const level = levelOf(rows, d.parentId ?? null)
  const dup = (await pgQuery(`SELECT id FROM erp_categories WHERE code=$1`, [d.code]))[0]
  if (dup) throw new Error('A category with this code already exists')
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO erp_categories (parent_id, code, name_en, name_fa, description, level, sort_order, active, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,${NOW},${NOW}) RETURNING id`,
    [d.parentId ?? null, d.code, d.nameEn, d.nameFa ?? null, d.description ?? null, level, d.sortOrder ?? 0, userId ?? null]))[0]
  return row
}

export async function updateCategory(id: number, d: { code?: string; nameEn?: string; nameFa?: string; description?: string; sortOrder?: number }): Promise<void> {
  await pgQuery(
    `UPDATE erp_categories SET code=COALESCE($2,code), name_en=COALESCE($3,name_en), name_fa=COALESCE($4,name_fa),
       description=COALESCE($5,description), sort_order=COALESCE($6,sort_order), updated_at=${NOW} WHERE id=$1`,
    [id, d.code ?? null, d.nameEn ?? null, d.nameFa ?? null, d.description ?? null, d.sortOrder ?? null])
}

/** Move a category under a new parent (cycle-guarded); re-levels the subtree. */
export async function moveCategory(id: number, newParentId: number | null): Promise<void> {
  const rows = await allRows()
  if (!canMove(rows, id, newParentId)) throw new Error('Illegal move — would create a cycle')
  const newLevel = levelOf(rows, newParentId)
  await pgQuery(`UPDATE erp_categories SET parent_id=$2, level=$3, updated_at=${NOW} WHERE id=$1`, [id, newParentId, newLevel])
  // Re-level descendants relative to the moved node's delta.
  const oldLevel = rows.find(r => r.id === id)?.level ?? newLevel
  const delta = newLevel - oldLevel
  if (delta !== 0) {
    const desc = descendants(rows, id)
    if (desc.length) await pgQuery(`UPDATE erp_categories SET level = level + $2, updated_at=${NOW} WHERE id = ANY($1)`, [desc, delta])
  }
}

/** Merge `fromId` into `toId`: repoint child categories + products, archive source. */
export async function mergeCategory(fromId: number, toId: number): Promise<{ movedChildren: number; movedProducts: number }> {
  if (fromId === toId) throw new Error('Cannot merge a category into itself')
  const rows = await allRows()
  if (descendants(rows, fromId).includes(toId)) throw new Error('Cannot merge into a descendant')
  const c = await pgQuery(`UPDATE erp_categories SET parent_id=$2, updated_at=${NOW} WHERE parent_id=$1 RETURNING id`, [fromId, toId])
  const p = await pgQuery(`UPDATE inv_products SET category_id=$2 WHERE category_id=$1 RETURNING id`, [fromId, toId])
  await pgQuery(`UPDATE erp_categories SET active=0, updated_at=${NOW} WHERE id=$1`, [fromId])
  return { movedChildren: c.length, movedProducts: p.length }
}

/** Archive a category. Business rule: it must have no ACTIVE products linked. */
export async function archiveCategory(id: number): Promise<void> {
  const cnt = (await pgQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM inv_products WHERE category_id=$1 AND active=1`, [id]))[0].n
  if (cnt > 0) throw new Error(`Cannot archive — ${cnt} active product(s) still use this category`)
  await pgQuery(`UPDATE erp_categories SET active=0, updated_at=${NOW} WHERE id=$1`, [id])
}

/**
 * Migration strategy: create a category row for every distinct legacy
 * `inv_products.category` string that has no tree node yet, then link the
 * products to it. Idempotent — safe to run repeatedly.
 */
export async function migrateLegacyCategories(userId?: string): Promise<{ created: number; linked: number }> {
  const legacy = await pgQuery<{ category: string }>(
    `SELECT DISTINCT category FROM inv_products WHERE COALESCE(category,'')<>'' AND category<>'general' AND category_id IS NULL`)
  let created = 0
  let linked = 0
  for (const l of legacy) {
    const code = `cat-${l.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 60) || `cat-${created}`
    let cat = (await pgQuery<{ id: number }>(`SELECT id FROM erp_categories WHERE code=$1`, [code]))[0]
    if (!cat) {
      cat = (await pgQuery<{ id: number }>(
        `INSERT INTO erp_categories (code, name_en, name_fa, level, active, created_by, created_at, updated_at)
         VALUES ($1,$2,$2,0,1,$3,${NOW},${NOW}) RETURNING id`, [code, l.category, userId ?? null]))[0]
      created++
    }
    const r = await pgQuery(`UPDATE inv_products SET category_id=$1 WHERE category=$2 AND category_id IS NULL RETURNING id`, [cat.id, l.category])
    linked += r.length
  }
  return { created, linked }
}
