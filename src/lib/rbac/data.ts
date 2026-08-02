/**
 * Phase 26.27 — RBAC data layer: load a user's explicit grants/ops, persist
 * changes with a full audit trail (rbac_audit: who, when, for whom, which key,
 * old → new). The decision itself is the pure engine (engine.ts).
 */
import { pgQuery } from '@/lib/db'
import type { Grants, OpGrants, PermLevel } from './engine'
import { isValidKey, isValidOpKey } from './registry'

export interface UserRbac { grants: Grants; ops: OpGrants }

/** Load explicit grants + op grants for a user (company-agnostic rows + this company). */
export async function loadUserRbac(userId: string, companyId?: number | null): Promise<UserRbac> {
  const grants: Grants = {}
  const ops: OpGrants = {}
  const g = await pgQuery<{ permission_key: string; level: PermLevel; company_id: number | null }>(
    `SELECT permission_key, level, company_id FROM rbac_user_grants WHERE user_id=$1 AND (company_id IS NULL OR company_id=$2)`,
    [userId, companyId ?? null])
  // company-specific row overrides the global row for the same key
  for (const r of g.filter(x => x.company_id === null)) grants[r.permission_key] = r.level
  for (const r of g.filter(x => x.company_id !== null)) grants[r.permission_key] = r.level
  const o = await pgQuery<{ op_key: string; allowed: boolean; company_id: number | null }>(
    `SELECT op_key, allowed, company_id FROM rbac_user_ops WHERE user_id=$1 AND (company_id IS NULL OR company_id=$2)`,
    [userId, companyId ?? null])
  for (const r of o.filter(x => x.company_id === null)) ops[r.op_key] = r.allowed
  for (const r of o.filter(x => x.company_id !== null)) ops[r.op_key] = r.allowed
  return { grants, ops }
}

/** True when the user has ANY rbac rows (used to decide legacy fallback fast). */
export async function hasAnyRbac(userId: string): Promise<boolean> {
  const r = await pgQuery<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM rbac_user_grants WHERE user_id=$1)
          + (SELECT COUNT(*) FROM rbac_user_ops    WHERE user_id=$1) AS n`, [userId])
  return Number(r[0]?.n ?? 0) > 0
}

/** Set/clear one grant (level=null clears → back to inheritance). Audited. */
export async function setGrant(actorId: string, userId: string, key: string, level: PermLevel | null, companyId?: number | null): Promise<void> {
  if (!isValidKey(key)) throw new Error(`Unknown permission key: ${key}`)
  const old = (await pgQuery<{ level: string }>(
    `SELECT level FROM rbac_user_grants WHERE user_id=$1 AND permission_key=$2 AND company_id IS NOT DISTINCT FROM $3`,
    [userId, key, companyId ?? null]))[0]?.level ?? null
  if (level === null) {
    await pgQuery(`DELETE FROM rbac_user_grants WHERE user_id=$1 AND permission_key=$2 AND company_id IS NOT DISTINCT FROM $3`,
      [userId, key, companyId ?? null])
  } else {
    await pgQuery(
      `INSERT INTO rbac_user_grants (user_id, permission_key, level, company_id, granted_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, permission_key, company_id) DO UPDATE SET level=EXCLUDED.level, granted_by=EXCLUDED.granted_by`,
      [userId, key, level, companyId ?? null, actorId])
  }
  await pgQuery(`INSERT INTO rbac_audit (actor_id, target_user_id, permission_key, old_value, new_value, company_id)
                 VALUES ($1,$2,$3,$4,$5,$6)`, [actorId, userId, key, old, level, companyId ?? null])
}

/** Set/clear one sensitive-op grant. Audited. */
export async function setOp(actorId: string, userId: string, opKey: string, allowed: boolean | null, companyId?: number | null): Promise<void> {
  if (!isValidOpKey(opKey)) throw new Error(`Unknown op key: ${opKey}`)
  const old = (await pgQuery<{ allowed: boolean }>(
    `SELECT allowed FROM rbac_user_ops WHERE user_id=$1 AND op_key=$2 AND company_id IS NOT DISTINCT FROM $3`,
    [userId, opKey, companyId ?? null]))[0]?.allowed
  if (allowed === null) {
    await pgQuery(`DELETE FROM rbac_user_ops WHERE user_id=$1 AND op_key=$2 AND company_id IS NOT DISTINCT FROM $3`,
      [userId, opKey, companyId ?? null])
  } else {
    await pgQuery(
      `INSERT INTO rbac_user_ops (user_id, op_key, allowed, company_id, granted_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, op_key, company_id) DO UPDATE SET allowed=EXCLUDED.allowed, granted_by=EXCLUDED.granted_by`,
      [userId, opKey, allowed, companyId ?? null, actorId])
  }
  await pgQuery(`INSERT INTO rbac_audit (actor_id, target_user_id, permission_key, old_value, new_value, company_id)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
    [actorId, userId, opKey, old === undefined ? null : String(old), allowed === null ? null : String(allowed), companyId ?? null])
}

/** Row scope for a key (ABAC بند ۶): default 'all' (today's behaviour, R5). */
export async function rowScopeFor(userId: string, key: string, companyId?: number | null): Promise<'all' | 'own' | 'department' | 'company'> {
  const r = (await pgQuery<{ scope: 'all' | 'own' | 'department' | 'company' }>(
    `SELECT scope FROM rbac_row_scope WHERE user_id=$1 AND permission_key=$2 AND (company_id IS NULL OR company_id=$3)
     ORDER BY company_id NULLS LAST LIMIT 1`, [userId, key, companyId ?? null]))[0]
  return r?.scope ?? 'all'
}

export async function setRowScope(actorId: string, userId: string, key: string, scope: 'all' | 'own' | 'department' | 'company' | null, companyId?: number | null): Promise<void> {
  if (!isValidKey(key)) throw new Error(`Unknown permission key: ${key}`)
  if (scope === null) {
    await pgQuery(`DELETE FROM rbac_row_scope WHERE user_id=$1 AND permission_key=$2 AND company_id IS NOT DISTINCT FROM $3`,
      [userId, key, companyId ?? null])
  } else {
    await pgQuery(
      `INSERT INTO rbac_row_scope (user_id, permission_key, scope, company_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, permission_key, company_id) DO UPDATE SET scope=EXCLUDED.scope`,
      [userId, key, scope, companyId ?? null])
  }
  await pgQuery(`INSERT INTO rbac_audit (actor_id, target_user_id, permission_key, old_value, new_value, company_id)
                 VALUES ($1,$2,$3,$4,$5,$6)`, [actorId, userId, `${key}#scope`, null, scope, companyId ?? null])
}

/**
 * بند ۶.۲ sensitive-field visibility. A user with NO rbac rows at all sees the
 * field (legacy behaviour, R5). An rbac-managed user (any grant/op row) must be
 * explicitly granted the field's op — default-deny; explicit false always hides.
 */
export async function sensitiveFieldVisible(userId: string, opKey: string): Promise<boolean> {
  const { isOpAllowed } = await import('./engine')
  const rbac = await loadUserRbac(userId)
  const allowed = isOpAllowed(rbac.ops, rbac.grants, opKey)
  if (allowed !== null) return allowed
  return Object.keys(rbac.grants).length === 0 && Object.keys(rbac.ops).length === 0
}

/** Copy all grants/ops/scopes from one user to another (بند ۴ helper). Audited per row. */
export async function copyRbac(actorId: string, fromUserId: string, toUserId: string): Promise<number> {
  const src = await loadUserRbac(fromUserId)
  let n = 0
  for (const [k, v] of Object.entries(src.grants)) { await setGrant(actorId, toUserId, k, v); n++ }
  for (const [k, v] of Object.entries(src.ops)) { await setOp(actorId, toUserId, k, v); n++ }
  return n
}
