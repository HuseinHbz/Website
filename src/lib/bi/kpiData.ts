/**
 * KPI management data layer (Phase 26.13, M2). CRUD over kpi_definitions,
 * computes actuals by evaluating each KPI's formula against a LIVE metrics
 * dictionary (assembled from the verified 26.11 financial-intelligence layer +
 * inventory), scores vs target and snapshots into kpi_values (history). No
 * duplicated aggregation — it reuses `assembleKpis` and the pure formula engine.
 */
import { pgQuery } from '@/lib/db'
import { evalFormula, validateFormula, scoreKpi, scorecard, type KpiDirection } from './kpiFormula'
import { assembleKpis } from '@/lib/erp/financialIntelligenceData'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

/** The live metric dictionary KPI formulas resolve against. */
export async function liveMetrics(): Promise<Record<string, number>> {
  const { input, kpis } = await assembleKpis()
  return {
    revenue: input.revenue, cogs: input.cogs ?? input.expenses, expenses: input.expenses,
    net_income: input.netIncome, cash: input.cash, inventory_value: input.inventoryValue,
    ar: input.outstandingAR, ap: input.outstandingAP, gross_profit: kpis.profit.gross,
    annual_revenue: input.annualRevenue ?? input.revenue,
  }
}

export interface KpiDef {
  id: number; code: string; nameEn: string; nameFa: string | null; category: string
  formula: string | null; unit: string | null; direction: KpiDirection; target: number | null; weight: number; active: number
}

export async function listKpis(category?: string): Promise<KpiDef[]> {
  const gate = category ? `WHERE active=1 AND category=$1` : `WHERE active=1`
  return (await pgQuery(
    `SELECT id, code, name_en AS "nameEn", name_fa AS "nameFa", category, formula, unit, direction, target::float AS target, weight::float AS weight, active
     FROM kpi_definitions ${gate} ORDER BY category, code`, category ? [category] : [])) as unknown as KpiDef[]
}

export async function upsertKpi(input: { id?: number; code: string; nameEn: string; nameFa?: string; category: string; formula?: string; unit?: string; direction: KpiDirection; target?: number | null; weight?: number }): Promise<{ id: number }> {
  if (input.formula) { const v = validateFormula(input.formula); if (!v.valid) throw new Error(`Invalid formula: ${v.error}`) }
  if (input.id) {
    await pgQuery(`UPDATE kpi_definitions SET code=$2, name_en=$3, name_fa=$4, category=$5, formula=$6, unit=$7, direction=$8, target=$9, weight=$10, updated_at=${NOW} WHERE id=$1`,
      [input.id, input.code, input.nameEn, input.nameFa ?? null, input.category, input.formula ?? null, input.unit ?? null, input.direction, input.target ?? null, input.weight ?? 1])
    return { id: input.id }
  }
  return (await pgQuery<{ id: number }>(`INSERT INTO kpi_definitions (code, name_en, name_fa, category, formula, unit, direction, target, weight) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [input.code, input.nameEn, input.nameFa ?? null, input.category, input.formula ?? null, input.unit ?? null, input.direction, input.target ?? null, input.weight ?? 1]))[0]
}
export async function deleteKpi(id: number): Promise<void> { await pgQuery(`DELETE FROM kpi_definitions WHERE id=$1`, [id]) }

export interface KpiComputed extends KpiDef { actual: number; attainmentPct: number; status: string; weightedScore: number }

/** Compute every KPI's actual from its formula + score it. */
export async function computeKpis(category?: string): Promise<{ kpis: KpiComputed[]; scorecard: { score: number; totalWeight: number } }> {
  const defs = await listKpis(category)
  const metrics = await liveMetrics()
  const kpis: KpiComputed[] = defs.map(d => {
    const actual = d.formula ? evalFormula(d.formula, metrics) : Number(metrics[d.code] ?? 0)
    const s = scoreKpi({ actual, target: d.target, direction: d.direction, weight: d.weight })
    return { ...d, actual, attainmentPct: s.attainmentPct, status: s.status, weightedScore: s.weightedScore }
  })
  return { kpis, scorecard: scorecard(defs.map((d, i) => ({ actual: kpis[i].actual, target: d.target, direction: d.direction, weight: d.weight }))) }
}

/** Snapshot the current KPI actuals into kpi_values for the given period (history). */
export async function snapshotKpis(period: string): Promise<{ saved: number }> {
  const { kpis } = await computeKpis()
  for (const k of kpis) {
    await pgQuery(
      `INSERT INTO kpi_values (kpi_id, period, actual, target, attainment_pct, status) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (kpi_id, period) DO UPDATE SET actual=EXCLUDED.actual, target=EXCLUDED.target, attainment_pct=EXCLUDED.attainment_pct, status=EXCLUDED.status`,
      [k.id, period, k.actual, k.target, k.attainmentPct, k.status])
  }
  return { saved: kpis.length }
}

export async function kpiHistory(kpiId: number) {
  return pgQuery(`SELECT period, actual::float AS actual, target::float AS target, attainment_pct::float AS "attainmentPct", status FROM kpi_values WHERE kpi_id=$1 ORDER BY period DESC LIMIT 24`, [kpiId])
}
