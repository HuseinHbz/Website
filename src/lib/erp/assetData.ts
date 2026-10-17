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

// ── ERPFIX-5 (BUG-ERP-09) — depreciation posting ────────────────────────────
import { withTransaction } from '@/lib/db'
import { insertPostedEntry, loadGlMap, accountIdByCode } from './glPosting'

const NOW_LITERAL = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

/**
 * Post one calendar-month of depreciation for every asset whose method is
 * not 'none' and that isn't already fully depreciated or retired/disposed.
 * Decision_gate answered (recommended): reuses the EXISTING monthly engine
 * (depreciate/ageInYears) unchanged — the expense for the month is the
 * DELTA between accumulated-at-period-end and accumulated-at-period-start,
 * so it is correct for every method (straight-line/declining/SYD) and for
 * catch-up (any number of back months) without a second calculation.
 * Idempotent per (asset, periodKey) via the UNIQUE index — a repeat run for
 * an already-posted month posts nothing new for that asset.
 */
export async function postDepreciationRun(periodKey: string, userId?: string, dryRun = false): Promise<{
  periodKey: string; posted: { assetId: number; amount: number }[]; skipped: { assetId: number; reason: string }[]; entryId: number | null; total: number
}> {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) throw new Error('periodKey must be YYYY-MM')
  const [y, m] = periodKey.split('-').map(Number)
  const periodStart = new Date(Date.UTC(y, m - 1, 1))
  const periodEnd = new Date(Date.UTC(y, m, 1)) // first day of NEXT month = end of this one
  const today = new Date()
  if (periodEnd.getTime() > today.getTime() + 86_400_000) throw new Error('Cannot post depreciation for a future period')

  const rows = (await pgQuery(`${SELECT} WHERE status NOT IN ('retired','disposed') AND depreciation_method <> 'none'`, [])) as unknown as AssetRow[]
  const already = new Set((await pgQuery<{ asset_id: number }>(
    `SELECT asset_id FROM asset_depreciation_postings WHERE period_key=$1`, [periodKey])).map(r => r.asset_id))

  const posted: { assetId: number; amount: number }[] = []
  const skipped: { assetId: number; reason: string }[] = []
  const lines: { accountId: number; debit: number; credit: number; memo: string | null }[] = []
  const toApply: { assetId: number; amount: number }[] = []

  const map = await loadGlMap()
  const [expenseAcc, accDeprAcc] = await Promise.all([accountIdByCode(map.depreciationExpense), accountIdByCode(map.accDepreciation)])

  for (const a of rows) {
    if (already.has(a.id)) { skipped.push({ assetId: a.id, reason: 'already posted this period' }); continue }
    const rate = Number(a.exchangeRate) || 1
    const basePrice = a.purchasePrice * rate, baseResidual = a.residualValue * rate
    const ageAtStart = ageInYears(a.purchaseDate, periodStart)
    const ageAtEnd = ageInYears(a.purchaseDate, periodEnd)
    const depAtStart = depreciate({ purchasePrice: basePrice, residualValue: baseResidual, usefulLifeYears: a.usefulLifeYears, method: a.depreciationMethod, ageYears: ageAtStart })
    const depAtEnd = depreciate({ purchasePrice: basePrice, residualValue: baseResidual, usefulLifeYears: a.usefulLifeYears, method: a.depreciationMethod, ageYears: ageAtEnd })
    const amount = round2(depAtEnd.accumulated - depAtStart.accumulated)
    if (amount <= 0) { skipped.push({ assetId: a.id, reason: depAtEnd.fullyDepreciated ? 'fully depreciated' : 'no depreciation this period' }); continue }
    posted.push({ assetId: a.id, amount })
    toApply.push({ assetId: a.id, amount })
    lines.push({ accountId: expenseAcc, debit: amount, credit: 0, memo: `Depreciation ${periodKey} — asset #${a.id}` })
    lines.push({ accountId: accDeprAcc, debit: 0, credit: amount, memo: `Accumulated depreciation ${periodKey} — asset #${a.id}` })
  }

  const total = round2(posted.reduce((s, p) => s + p.amount, 0))
  if (posted.length === 0 || dryRun) return { periodKey, posted, skipped, entryId: null, total }

  const dateStr = `${periodKey}-01`
  const entryId = await withTransaction(async query => {
    const e = await insertPostedEntry(query, dateStr, `Depreciation run ${periodKey}`, `DEPR-${periodKey}`, total, userId, lines)
    for (const p of toApply) {
      await query(
        `INSERT INTO asset_depreciation_postings (asset_id, period_key, entry_id, amount, created_at) VALUES ($1,$2,$3,$4,${NOW_LITERAL})`,
        [p.assetId, periodKey, e.id, p.amount])
    }
    return e.id
  })
  return { periodKey, posted, skipped, entryId, total }
}

/** Reconcile the posting trail against assetData's own book-value math —
 * catches any drift between the two for an accountant review. */
export async function depreciationReconciliation(): Promise<{ assetId: number; bookEngineAccumulated: number; postedAccumulated: number; diff: number }[]> {
  const assets = await loadAssets()
  const posted = await pgQuery<{ asset_id: number; s: number }>(
    `SELECT asset_id, COALESCE(SUM(amount),0)::float AS s FROM asset_depreciation_postings GROUP BY asset_id`)
  const postedMap = new Map(posted.map(p => [p.asset_id, Number(p.s)]))
  return assets
    .map(a => ({ assetId: a.id, bookEngineAccumulated: a.accumulatedDepreciation, postedAccumulated: round2(postedMap.get(a.id) ?? 0) }))
    .map(r => ({ ...r, diff: round2(r.bookEngineAccumulated - r.postedAccumulated) }))
    .filter(r => Math.abs(r.diff) > 0.01)
}
