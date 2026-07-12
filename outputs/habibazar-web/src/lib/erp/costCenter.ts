/**
 * Cost / Profit Center engine (Phase 26.11, M3/M4) — pure, unit-tested.
 *
 * A profit center is a cost center that also carries revenue (kind='profit'), so
 * ONE engine computes both: cost roll-up per center, and revenue/cost/profit/
 * margin for profit centers. `costCenterData.ts` supplies natural-sign balances
 * from POSTED GL lines grouped by cost_center_id × account type.
 */

export const CC_KINDS = ['department', 'branch', 'project', 'business_unit', 'profit'] as const
export type CostCenterKind = (typeof CC_KINDS)[number]

export type LiteType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface CenterLine {
  costCenterId: number | null
  type: LiteType
  /** natural-sign balance for the account on this center (revenue/expense ≥ 0). */
  amount: number
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

export interface CenterRollup {
  costCenterId: number | null
  revenue: number
  cost: number       // expense total
  profit: number     // revenue − cost
  marginPct: number  // profit / revenue × 100
}

/** Roll up revenue/expense per center → cost, profit and margin (one pass). */
export function centerRollup(lines: CenterLine[]): CenterRollup[] {
  const rev = new Map<string, number>()
  const exp = new Map<string, number>()
  const keys = new Set<string>()
  const idOf = (l: CenterLine) => (l.costCenterId == null ? 'null' : String(l.costCenterId))
  for (const l of lines) {
    const k = idOf(l)
    keys.add(k)
    if (l.type === 'revenue') rev.set(k, (rev.get(k) ?? 0) + (Number(l.amount) || 0))
    else if (l.type === 'expense') exp.set(k, (exp.get(k) ?? 0) + (Number(l.amount) || 0))
  }
  return [...keys].map(k => {
    const revenue = round2(rev.get(k) ?? 0)
    const cost = round2(exp.get(k) ?? 0)
    return profitLine(k === 'null' ? null : Number(k), revenue, cost)
  }).sort((a, b) => b.cost - a.cost)
}

/** revenue/cost → profit + margin for a single center. */
export function profitLine(costCenterId: number | null, revenue: number, cost: number): CenterRollup {
  const profit = round2(revenue - cost)
  return { costCenterId, revenue: round2(revenue), cost: round2(cost), profit, marginPct: revenue > 0 ? round2(profit / revenue * 100) : 0 }
}

/** Distribute a shared amount across centers by weight (remainder→largest weight). */
export function allocate(total: number, weights: { costCenterId: number; weight: number }[]): { costCenterId: number; amount: number }[] {
  const sum = weights.reduce((s, w) => s + Math.max(0, w.weight), 0)
  if (sum <= 0) return weights.map(w => ({ costCenterId: w.costCenterId, amount: 0 }))
  const out = weights.map(w => ({ costCenterId: w.costCenterId, amount: round2(total * Math.max(0, w.weight) / sum) }))
  // Fix rounding drift onto the biggest-weight center so the split ties to `total`.
  const drift = round2(total - out.reduce((s, o) => s + o.amount, 0))
  if (drift !== 0 && out.length) {
    let bi = 0
    for (let i = 1; i < weights.length; i++) if (weights[i].weight > weights[bi].weight) bi = i
    out[bi].amount = round2(out[bi].amount + drift)
  }
  return out
}

export interface CenterNode { id: number; code: string; name: string; kind: CostCenterKind; parentId?: number | null }
export interface CenterTreeNode extends CenterNode { children: CenterTreeNode[] }

/** Build the parent/child tree (cycle-safe; orphans surface at the root). */
export function buildTree(nodes: CenterNode[]): CenterTreeNode[] {
  const byId = new Map<number, CenterTreeNode>(nodes.map(n => [n.id, { ...n, children: [] }]))
  const roots: CenterTreeNode[] = []
  for (const n of byId.values()) {
    const parent = n.parentId != null ? byId.get(n.parentId) : undefined
    if (parent && parent.id !== n.id && !isAncestor(byId, n.id, parent.id)) parent.children.push(n)
    else roots.push(n)
  }
  return roots
}
function isAncestor(byId: Map<number, CenterTreeNode>, ancestorId: number, nodeId: number): boolean {
  let cur = byId.get(nodeId)
  const seen = new Set<number>()
  while (cur && cur.parentId != null && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (cur.parentId === ancestorId) return true
    cur = byId.get(cur.parentId)
  }
  return false
}
