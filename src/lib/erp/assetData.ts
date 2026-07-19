/**
 * Asset Management server data layer — loads assets from PostgreSQL and enriches
 * each with computed depreciation (book value), warranty/insurance/calibration
 * health, and open-maintenance status via the pure engines. Shared by the assets
 * API and the asset dashboard so financials are computed in exactly one place.
 */
import { pgQuery } from '@/lib/db'
import { warrantyState, type WarrantyState } from './assets'
import { depreciate, ageInYears, type DepreciationMethod } from './depreciation'

export interface AssetRow {
  id: number; name: string; type: string; category: string | null; model: string | null
  manufacturer: string | null; serial: string | null; barcode: string | null; vendor: string | null
  status: string; location: string | null; department: string | null; employee: string | null
  costCenter: string | null; project: string | null; assignedTo: string | null
  purchaseDate: string | null; purchasePrice: number
  currency: string
  exchangeRate: number; residualValue: number
  usefulLifeYears: number; depreciationMethod: DepreciationMethod
  warrantyExpiry: string | null; insurancePolicy: string | null; insuranceExpiry: string | null
  contractRef: string | null; calibrationDue: string | null
  gpsLat: number | null; gpsLng: number | null; notes: string | null
  createdAt: string; updatedAt: string
}

export interface EnrichedAsset extends AssetRow {
  bookValue: number
  accumulatedDepreciation: number
  lifeUsedPct: number
  warranty: { state: WarrantyState; days: number | null }
  insurance: { state: WarrantyState; days: number | null }
  calibration: { state: WarrantyState; days: number | null }
  openMaintenance: number
}

const SELECT = `
  SELECT id, name, type, category, model, manufacturer, serial, barcode, vendor, status,
         location, department, employee, cost_center AS "costCenter", project, assigned_to AS "assignedTo",
         purchase_date AS "purchaseDate", purchase_price::float AS "purchasePrice",
         currency, exchange_rate::float AS "exchangeRate",
         residual_value::float AS "residualValue", useful_life_years::float AS "usefulLifeYears",
         depreciation_method AS "depreciationMethod", warranty_expiry AS "warrantyExpiry",
         insurance_policy AS "insurancePolicy", insurance_expiry AS "insuranceExpiry",
         contract_ref AS "contractRef", calibration_due AS "calibrationDue",
         gps_lat::float AS "gpsLat", gps_lng::float AS "gpsLng", notes,
         created_at AS "createdAt", updated_at AS "updatedAt"
  FROM assets`

function enrich(a: AssetRow, openMaint: number): EnrichedAsset {
  // 26.8: depreciate on the Rial base (original price × the immutable
  // registration rate) so multi-currency assets aggregate correctly; the
  // stored original price/currency are never touched.
  const rate = Number(a.exchangeRate) || 1
  const dep = depreciate({
    purchasePrice: a.purchasePrice * rate, residualValue: a.residualValue * rate,
    usefulLifeYears: a.usefulLifeYears, method: a.depreciationMethod,
    ageYears: ageInYears(a.purchaseDate),
  })
  return {
    ...a,
    bookValue: dep.bookValue,
    accumulatedDepreciation: dep.accumulated,
    lifeUsedPct: dep.lifeUsedPct,
    warranty: warrantyState(a.warrantyExpiry),
    insurance: warrantyState(a.insuranceExpiry),
    calibration: warrantyState(a.calibrationDue),
    openMaintenance: openMaint,
  }
}

/** Load all assets enriched with depreciation + health. */
export async function loadAssets(): Promise<EnrichedAsset[]> {
  const rows = (await pgQuery(`${SELECT} ORDER BY updated_at DESC`, [])) as unknown as AssetRow[]
  const openMaint = (await pgQuery(
    `SELECT asset_id AS "assetId", COUNT(*)::int AS n FROM asset_maintenance
     WHERE status IN ('scheduled','overdue') GROUP BY asset_id`, [],
  )) as { assetId: number; n: number }[]
  const openMap = new Map(openMaint.map(o => [o.assetId, o.n]))
  return rows.map(r => enrich(r, openMap.get(r.id) ?? 0))
}

/** Load a single enriched asset by id. */
export async function loadAsset(id: number): Promise<EnrichedAsset | null> {
  const row = (await pgQuery(`${SELECT} WHERE id=$1`, [id]))[0] as unknown as AssetRow | undefined
  if (!row) return null
  const om = (await pgQuery(`SELECT COUNT(*)::int AS n FROM asset_maintenance WHERE asset_id=$1 AND status IN ('scheduled','overdue')`, [id]))[0] as { n: number }
  return enrich(row, om?.n ?? 0)
}

export interface AssetKpis {
  total: number
  active: number
  maintenance: number
  retired: number
  totalCost: number
  totalBookValue: number
  totalDepreciation: number
  warrantyExpiring: number
  warrantyExpired: number
  insuranceExpiring: number
  calibrationDue: number
  openMaintenance: number
}

/** Roll enriched assets into portfolio KPIs (used by the list header + dashboard). */
export function assetKpisFrom(assets: EnrichedAsset[]): AssetKpis {
  return {
    total: assets.length,
    active: assets.filter(a => a.status === 'active').length,
    maintenance: assets.filter(a => a.status === 'maintenance').length,
    retired: assets.filter(a => a.status === 'retired').length,
    totalCost: round2(assets.reduce((s, a) => s + a.purchasePrice, 0)),
    totalBookValue: round2(assets.reduce((s, a) => s + a.bookValue, 0)),
    totalDepreciation: round2(assets.reduce((s, a) => s + a.accumulatedDepreciation, 0)),
    warrantyExpiring: assets.filter(a => a.warranty.state === 'expiring').length,
    warrantyExpired: assets.filter(a => a.warranty.state === 'expired').length,
    insuranceExpiring: assets.filter(a => a.insurance.state === 'expiring' || a.insurance.state === 'expired').length,
    calibrationDue: assets.filter(a => a.calibration.state === 'expiring' || a.calibration.state === 'expired').length,
    openMaintenance: assets.reduce((s, a) => s + a.openMaintenance, 0),
  }
}

/** Dashboard payload: KPIs + attention lists + charts. */
export async function assetOverview() {
  const assets = await loadAssets()
  const kpis = assetKpisFrom(assets)
  const byType = groupCount(assets, a => a.type)
  const byStatus = groupCount(assets, a => a.status)
  const attention = assets
    .filter(a => a.warranty.state === 'expired' || a.warranty.state === 'expiring' || a.calibration.state !== 'none' && a.calibration.state !== 'ok' || a.openMaintenance > 0)
    .slice(0, 15)
  const upcomingMaintenance = (await pgQuery(
    `SELECT m.id, m.type, m.status, m.scheduled_date AS "scheduledDate", m.vendor,
            a.name AS "assetName", a.id AS "assetId"
     FROM asset_maintenance m JOIN assets a ON a.id=m.asset_id
     WHERE m.status IN ('scheduled','overdue') ORDER BY m.scheduled_date NULLS LAST LIMIT 15`, [],
  ))
  return { kpis, byType, byStatus, attention, upcomingMaintenance }
}

function groupCount<T>(rows: T[], key: (r: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) { const k = key(r) || '—'; m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}
function round2(n: number): number { return Math.round(n * 100) / 100 }
