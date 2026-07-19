/**
 * ERP asset domain logic (Phase 16 foundation).
 *
 * Pure, deterministic helpers for asset warranty/lifecycle health and portfolio
 * statistics — shared by the API, dashboards and any future automation. No DB
 * access here, so it is fully unit-testable.
 */

export const ASSET_TYPES = ['server', 'network', 'firewall', 'switch', 'router', 'access_point', 'storage', 'vm', 'cloud', 'laptop', 'license', 'other'] as const
export const ASSET_STATUSES = ['active', 'maintenance', 'retired', 'spare'] as const
export type AssetType = (typeof ASSET_TYPES)[number]
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export type WarrantyState = 'ok' | 'expiring' | 'expired' | 'none'

/** Days between now and an ISO date (negative = in the past). */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - now.getTime()) / 86_400_000)
}

/** Warranty state: expired (past), expiring (≤ 30d), ok (>30d), or none. */
export function warrantyState(warrantyExpiry: string | null | undefined, now: Date = new Date()): { state: WarrantyState; days: number | null } {
  const days = daysUntil(warrantyExpiry, now)
  if (days === null) return { state: 'none', days: null }
  if (days < 0) return { state: 'expired', days }
  if (days <= 30) return { state: 'expiring', days }
  return { state: 'ok', days }
}

export interface AssetLike { type: AssetType; status: AssetStatus; warrantyExpiry?: string | null }
export interface AssetStats {
  total: number
  byType: Record<string, number>
  byStatus: Record<AssetStatus, number>
  warrantyExpiring: number
  warrantyExpired: number
  active: number
}

/** Portfolio rollup for the Asset Center dashboard. */
export function assetStats(assets: AssetLike[], now: Date = new Date()): AssetStats {
  const byType: Record<string, number> = {}
  const byStatus = Object.fromEntries(ASSET_STATUSES.map((s) => [s, 0])) as Record<AssetStatus, number>
  let warrantyExpiring = 0, warrantyExpired = 0
  for (const a of assets) {
    byType[a.type] = (byType[a.type] ?? 0) + 1
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
    const w = warrantyState(a.warrantyExpiry, now).state
    if (w === 'expiring') warrantyExpiring++
    else if (w === 'expired') warrantyExpired++
  }
  return { total: assets.length, byType, byStatus, warrantyExpiring, warrantyExpired, active: byStatus.active }
}
