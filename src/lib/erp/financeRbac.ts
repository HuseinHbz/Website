/**
 * Finance RBAC scope layer (Phase 26.11, M12) — ADDITIVE over the 3-role core
 * auth (`canDo`), never a rewrite. A `users.finance_role` (ceo/cfo/
 * finance_manager/dept_manager/accountant) plus cost-center membership decides
 * who sees consolidated data vs only their own cost centers.
 *
 * - CEO / CFO / finance_manager (and super_admin/administrator) → consolidated.
 * - dept_manager / accountant → restricted to assigned cost centers.
 */
import { pgQuery } from '@/lib/db'
import type { AdminUser } from '@/lib/admin/auth'

export const FINANCE_ROLES = ['ceo', 'cfo', 'finance_manager', 'dept_manager', 'accountant'] as const
export type FinanceRole = (typeof FINANCE_ROLES)[number]

const CONSOLIDATED: FinanceRole[] = ['ceo', 'cfo', 'finance_manager']

export async function financeRole(user: AdminUser): Promise<FinanceRole | null> {
  const r = (await pgQuery<{ finance_role: string | null }>(`SELECT finance_role FROM users WHERE id=$1`, [user.id]))[0]
  const v = r?.finance_role as FinanceRole | null | undefined
  return v && FINANCE_ROLES.includes(v) ? v : null
}

/** Core admins always see everything; finance CONSOLIDATED roles too. */
export async function canSeeConsolidated(user: AdminUser): Promise<boolean> {
  if (user.role === 'super_admin' || user.role === 'administrator') return true
  const fr = await financeRole(user)
  return fr != null && CONSOLIDATED.includes(fr)
}

/**
 * The cost-center ids a user may see, or `null` for unrestricted (consolidated).
 * Restricted users with no membership get an empty list (they see nothing).
 */
export async function scopedCostCenterIds(user: AdminUser): Promise<number[] | null> {
  if (await canSeeConsolidated(user)) return null
  const rows = await pgQuery<{ cost_center_id: number }>(
    `SELECT cost_center_id FROM erp_cost_center_members WHERE user_id=$1
     UNION SELECT id FROM erp_cost_centers WHERE manager_user_id=$1`, [user.id])
  return rows.map(r => r.cost_center_id)
}

/** Set a user's finance role (administrator only — enforced by the route). */
export async function setFinanceRole(userId: string, role: FinanceRole | null): Promise<void> {
  await pgQuery(`UPDATE users SET finance_role=$2 WHERE id=$1`, [userId, role])
}

/** Assign / remove a user's cost-center membership. */
export async function setCostCenterMember(costCenterId: number, userId: string, add: boolean): Promise<void> {
  if (add) await pgQuery(`INSERT INTO erp_cost_center_members (cost_center_id, user_id) VALUES ($1,$2) ON CONFLICT (cost_center_id, user_id) DO NOTHING`, [costCenterId, userId])
  else await pgQuery(`DELETE FROM erp_cost_center_members WHERE cost_center_id=$1 AND user_id=$2`, [costCenterId, userId])
}
