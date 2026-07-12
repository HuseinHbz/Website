/**
 * Enterprise product category tree — pure engine (Phase 26.17 M1). Deterministic,
 * no DB, so fully unit-tested. Builds an unlimited hierarchy, guards moves against
 * cycles, and computes level/stats. The data layer persists; this decides shape.
 */

export interface CategoryRow {
  id: number
  parentId: number | null
  code: string
  nameEn: string
  nameFa?: string | null
  level: number
  sortOrder: number
  active: number
}

export interface CategoryNode extends CategoryRow {
  children: CategoryNode[]
  productCount?: number
}

/** Build a nested tree from a flat list, sorted by sortOrder then name. */
export function buildTree(rows: CategoryRow[], counts: Record<number, number> = {}): CategoryNode[] {
  const byId = new Map<number, CategoryNode>()
  for (const r of rows) byId.set(r.id, { ...r, children: [], productCount: counts[r.id] ?? 0 })
  const roots: CategoryNode[] = []
  for (const node of byId.values()) {
    if (node.parentId != null && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node)
    else roots.push(node)
  }
  const sort = (ns: CategoryNode[]) => {
    ns.sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn))
    ns.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots
}

/** All descendant ids of `id` (excludes `id` itself). */
export function descendants(rows: CategoryRow[], id: number): number[] {
  const childrenOf = new Map<number, number[]>()
  for (const r of rows) {
    if (r.parentId == null) continue
    const arr = childrenOf.get(r.parentId) ?? []
    arr.push(r.id)
    childrenOf.set(r.parentId, arr)
  }
  const out: number[] = []
  const walk = (n: number) => { for (const c of childrenOf.get(n) ?? []) { out.push(c); walk(c) } }
  walk(id)
  return out
}

/**
 * A move is legal only if the new parent is neither the node itself nor one of
 * its descendants (which would create a cycle). Moving to root (null) is always ok.
 */
export function canMove(rows: CategoryRow[], id: number, newParentId: number | null): boolean {
  if (newParentId == null) return true
  if (newParentId === id) return false
  if (!rows.some(r => r.id === newParentId)) return false
  return !descendants(rows, id).includes(newParentId)
}

/** Depth of a node given its parent (root = 0). */
export function levelOf(rows: CategoryRow[], parentId: number | null): number {
  if (parentId == null) return 0
  let level = 0
  let cur: number | null = parentId
  const byId = new Map(rows.map(r => [r.id, r]))
  const seen = new Set<number>()
  while (cur != null && byId.has(cur) && !seen.has(cur)) {
    seen.add(cur)
    level++
    cur = byId.get(cur)!.parentId
  }
  return level
}

export interface TreeStats { total: number; active: number; roots: number; maxDepth: number; leaves: number }

export function treeStats(rows: CategoryRow[]): TreeStats {
  const tree = buildTree(rows)
  let maxDepth = 0
  let leaves = 0
  const walk = (n: CategoryNode, depth: number) => {
    maxDepth = Math.max(maxDepth, depth)
    if (n.children.length === 0) leaves++
    n.children.forEach(c => walk(c, depth + 1))
  }
  tree.forEach(r => walk(r, 1))
  return {
    total: rows.length,
    active: rows.filter(r => r.active === 1).length,
    roots: tree.length,
    maxDepth,
    leaves,
  }
}
