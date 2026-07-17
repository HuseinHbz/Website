/**
 * OKR data layer (Phase 26.13, M3). CRUD objectives + key results; progress /
 * confidence / status computed by the pure `okr.ts` engine. Approval reuses the
 * 26.12 approval platform (an objective can be routed via createApprovalRequest).
 */
import { pgQuery } from '@/lib/db'
import { objectiveProgress, okrStatus, confidence, alignmentRollup, krProgress, type KeyResult } from './okr'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export interface KrRow extends KeyResult { id: number; title: string; unit: string | null }
export interface ObjectiveRow {
  id: number; title: string; description: string | null; level: string; parentId: number | null
  ownerId: string | null; department: string | null; period: string; status: string
  startDate: string | null; endDate: string | null; progressPct: number; confidence: number | null
}

function elapsedFraction(start: string | null, end: string | null): number {
  if (!start || !end) return 0.5
  const s = Date.parse(start), e = Date.parse(end), n = Date.now()
  if (isNaN(s) || isNaN(e) || e <= s) return 0.5
  return Math.min(1, Math.max(0, (n - s) / (e - s)))
}

export async function listObjectives(period?: string): Promise<(ObjectiveRow & { krCount: number; status2: string })[]> {
  const gate = period ? `WHERE period=$1` : ''
  const rows = (await pgQuery(
    `SELECT id, title, description, level, parent_id AS "parentId", owner_id AS "ownerId", department, period, status,
            start_date AS "startDate", end_date AS "endDate", progress_pct::float AS "progressPct", confidence::float AS confidence
     FROM okr_objectives ${gate} ORDER BY level, id DESC`, period ? [period] : [])) as unknown as ObjectiveRow[]
  const out = []
  for (const o of rows) {
    const krs = (await pgQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM okr_results WHERE objective_id=$1`, [o.id]))[0]
    out.push({ ...o, krCount: krs?.n ?? 0, status2: okrStatus(o.progressPct, elapsedFraction(o.startDate, o.endDate)) })
  }
  return out
}

export async function getObjective(id: number): Promise<{ objective: ObjectiveRow; keyResults: KrRow[] } | null> {
  const o = (await pgQuery(
    `SELECT id, title, description, level, parent_id AS "parentId", owner_id AS "ownerId", department, period, status,
            start_date AS "startDate", end_date AS "endDate", progress_pct::float AS "progressPct", confidence::float AS confidence
     FROM okr_objectives WHERE id=$1`, [id]))[0] as unknown as ObjectiveRow | undefined
  if (!o) return null
  const keyResults = (await pgQuery(`SELECT id, title, start_value::float AS start, target_value::float AS target, current_value::float AS current, weight::float AS weight, unit FROM okr_results WHERE objective_id=$1 ORDER BY id`, [id])) as unknown as KrRow[]
  return { objective: o, keyResults }
}

export async function createObjective(input: { title: string; description?: string; level: string; parentId?: number; ownerId?: string; department?: string; period: string; startDate?: string; endDate?: string; keyResults?: { title: string; startValue: number; targetValue: number; currentValue?: number; weight?: number; unit?: string }[] }, userId: string): Promise<{ id: number }> {
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO okr_objectives (title, description, level, parent_id, owner_id, department, period, start_date, end_date, created_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active') RETURNING id`,
    [input.title, input.description ?? null, input.level, input.parentId ?? null, input.ownerId ?? null, input.department ?? null, input.period, input.startDate ?? null, input.endDate ?? null, userId]))[0]
  for (const kr of input.keyResults ?? [])
    await pgQuery(`INSERT INTO okr_results (objective_id, title, start_value, target_value, current_value, weight, unit) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [r.id, kr.title, kr.startValue, kr.targetValue, kr.currentValue ?? kr.startValue, kr.weight ?? 1, kr.unit ?? null])
  await recomputeObjective(r.id)
  return r
}

/** Update a key result's current value and recompute the objective progress. */
export async function updateKeyResult(krId: number, currentValue: number): Promise<void> {
  const kr = (await pgQuery<{ objective_id: number }>(`UPDATE okr_results SET current_value=$2 WHERE id=$1 RETURNING objective_id`, [krId, currentValue]))[0]
  if (kr) await recomputeObjective(kr.objective_id)
}

async function recomputeObjective(id: number): Promise<void> {
  const krs = (await pgQuery(`SELECT start_value::float AS start, target_value::float AS target, current_value::float AS current, weight::float AS weight FROM okr_results WHERE objective_id=$1`, [id])) as unknown as KeyResult[]
  const progress = objectiveProgress(krs)
  const o = (await pgQuery<{ start_date: string | null; end_date: string | null }>(`SELECT start_date, end_date FROM okr_objectives WHERE id=$1`, [id]))[0]
  const conf = confidence(progress, elapsedFraction(o?.start_date ?? null, o?.end_date ?? null))
  await pgQuery(`UPDATE okr_objectives SET progress_pct=$2, confidence=$3, updated_at=${NOW} WHERE id=$1`, [id, progress, conf])
}

export async function deleteObjective(id: number): Promise<void> { await pgQuery(`DELETE FROM okr_objectives WHERE id=$1`, [id]) }

/** Company alignment = weighted rollup of company-level objective progress. */
export async function okrAlignment(period: string): Promise<{ company: number; byLevel: Record<string, number> }> {
  const rows = (await pgQuery<{ level: string; progress: number }>(`SELECT level, progress_pct::float AS progress FROM okr_objectives WHERE period=$1 AND status='active'`, [period]))
  const byLevel: Record<string, number> = {}
  for (const lvl of ['company', 'department', 'employee']) {
    const g = rows.filter(r => r.level === lvl)
    byLevel[lvl] = alignmentRollup(g.map(r => ({ progress: r.progress })))
  }
  return { company: byLevel.company, byLevel }
}
export { krProgress }
