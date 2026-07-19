/**
 * Cost / Profit Center server layer (Phase 26.11, M3/M4). CRUD + actuals roll-up
 * from POSTED GL lines grouped by cost_center_id × account type, fed to the pure
 * `costCenter.ts` engine. No aggregation logic here beyond the SQL sums.
 */
import { pgQuery } from '@/lib/db'
import { centerRollup, buildTree, type CenterLine, type CostCenterKind, type CenterNode } from './costCenter'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export interface CostCenterRow {
  id: number; code: string; nameEn: string; nameFa: string | null
  kind: CostCenterKind; parentId: number | null; managerUserId: string | null
  companyId: number | null; active: number
}

export async function listCostCenters(): Promise<CostCenterRow[]> {
  return (await pgQuery(
    `SELECT id, code, name_en AS "nameEn", name_fa AS "nameFa", kind, parent_id AS "parentId",
            manager_user_id AS "managerUserId", company_id AS "companyId", active
     FROM erp_cost_centers ORDER BY kind, code`)) as unknown as CostCenterRow[]
}

export async function createCostCenter(input: { code: string; nameEn: string; nameFa?: string; kind: CostCenterKind; parentId?: number | null; managerUserId?: string | null; companyId?: number | null }): Promise<{ id: number }> {
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO erp_cost_centers (code, name_en, name_fa, kind, parent_id, manager_user_id, company_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [input.code, input.nameEn, input.nameFa ?? null, input.kind, input.parentId ?? null, input.managerUserId ?? null, input.companyId ?? null]))[0]
  return r
}

export async function updateCostCenter(id: number, patch: { nameEn?: string; nameFa?: string; kind?: CostCenterKind; parentId?: number | null; managerUserId?: string | null; active?: number }): Promise<void> {
  await pgQuery(
    `UPDATE erp_cost_centers SET
       name_en=COALESCE($2,name_en), name_fa=COALESCE($3,name_fa), kind=COALESCE($4,kind),
       parent_id=$5, manager_user_id=$6, active=COALESCE($7,active), updated_at=${NOW}
     WHERE id=$1`,
    [id, patch.nameEn ?? null, patch.nameFa ?? null, patch.kind ?? null, patch.parentId ?? null, patch.managerUserId ?? null, patch.active ?? null])
}

export async function deleteCostCenter(id: number): Promise<void> {
  await pgQuery(`DELETE FROM erp_cost_centers WHERE id=$1`, [id])
}

/** Natural-sign revenue/expense per cost center from POSTED GL lines. */
export async function centerActuals(costCenterIds?: number[]): Promise<CenterLine[]> {
  const gate = costCenterIds?.length ? `AND l.cost_center_id = ANY($1)` : ''
  const rows = await pgQuery<{ costCenterId: number | null; type: string; amount: number }>(
    `SELECT l.cost_center_id AS "costCenterId", a.type,
            COALESCE(SUM(CASE WHEN a.type='revenue' THEN l.credit - l.debit ELSE l.debit - l.credit END),0)::float AS amount
     FROM gl_journal_lines l
     JOIN gl_journal_entries e ON e.id = l.entry_id AND e.status='posted'
     JOIN gl_accounts a ON a.id = l.account_id
     WHERE a.type IN ('revenue','expense') AND l.cost_center_id IS NOT NULL ${gate}
     GROUP BY l.cost_center_id, a.type`, costCenterIds?.length ? [costCenterIds] : [])
  return rows.map(r => ({ costCenterId: r.costCenterId, type: r.type as CenterLine['type'], amount: Number(r.amount) }))
}

export interface CenterOverviewRow {
  id: number; code: string; nameEn: string; nameFa: string | null; kind: CostCenterKind
  revenue: number; cost: number; profit: number; marginPct: number
}

/** Dashboard: every center enriched with its live revenue/cost/profit/margin. */
export async function costCenterOverview(costCenterIds?: number[]): Promise<{ centers: CenterOverviewRow[]; tree: ReturnType<typeof buildTree>; totals: { revenue: number; cost: number; profit: number } }> {
  const centers = await listCostCenters()
  const scoped = costCenterIds?.length ? centers.filter(c => costCenterIds.includes(c.id)) : centers
  const rollup = centerRollup(await centerActuals(costCenterIds))
  const byId = new Map(rollup.map(r => [r.costCenterId, r]))
  const rows: CenterOverviewRow[] = scoped.map(c => {
    const r = byId.get(c.id)
    return { id: c.id, code: c.code, nameEn: c.nameEn, nameFa: c.nameFa, kind: c.kind, revenue: r?.revenue ?? 0, cost: r?.cost ?? 0, profit: r?.profit ?? 0, marginPct: r?.marginPct ?? 0 }
  })
  const nodes: CenterNode[] = scoped.map(c => ({ id: c.id, code: c.code, name: c.nameEn, kind: c.kind, parentId: c.parentId }))
  const totals = rows.reduce((s, r) => ({ revenue: s.revenue + r.revenue, cost: s.cost + r.cost, profit: s.profit + r.profit }), { revenue: 0, cost: 0, profit: 0 })
  return { centers: rows, tree: buildTree(nodes), totals: { revenue: Math.round(totals.revenue * 100) / 100, cost: Math.round(totals.cost * 100) / 100, profit: Math.round(totals.profit * 100) / 100 } }
}
