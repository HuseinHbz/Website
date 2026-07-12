/**
 * SLA data layer (Phase 26.13, M5). CRUD sla_definitions; start/resolve SLA
 * events; scan business-hours elapsed → state + escalation via the pure `sla.ts`
 * engine. Escalations queue a notification (reuse) — connects SLA to the
 * notification/approval engines.
 */
import { pgQuery } from '@/lib/db'
import { businessHoursBetween, slaState, dueSlaEscalations, DEFAULT_HOURS, DEFAULT_SLA_ESCALATION, type BusinessHours, type SlaEscalationRule } from './sla'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export async function listSlaDefs() {
  return pgQuery(`SELECT id, code, name_en AS "nameEn", name_fa AS "nameFa", sla_type AS "slaType", target_hours::float AS "targetHours", priority, active FROM sla_definitions ORDER BY sla_type, code`)
}
export async function upsertSlaDef(input: { id?: number; code: string; nameEn: string; nameFa?: string; slaType: string; targetHours: number; priority?: string; businessHours?: BusinessHours; holidays?: string[]; escalation?: SlaEscalationRule[] }): Promise<{ id: number }> {
  if (input.id) {
    await pgQuery(`UPDATE sla_definitions SET code=$2, name_en=$3, name_fa=$4, sla_type=$5, target_hours=$6, priority=$7, business_hours=$8, holidays=$9, escalation=$10 WHERE id=$1`,
      [input.id, input.code, input.nameEn, input.nameFa ?? null, input.slaType, input.targetHours, input.priority ?? null, JSON.stringify(input.businessHours ?? null), JSON.stringify(input.holidays ?? null), JSON.stringify(input.escalation ?? null)])
    return { id: input.id }
  }
  return (await pgQuery<{ id: number }>(`INSERT INTO sla_definitions (code, name_en, name_fa, sla_type, target_hours, priority, business_hours, holidays, escalation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [input.code, input.nameEn, input.nameFa ?? null, input.slaType, input.targetHours, input.priority ?? null, JSON.stringify(input.businessHours ?? null), JSON.stringify(input.holidays ?? null), JSON.stringify(input.escalation ?? null)]))[0]
}

export async function startSlaEvent(slaId: number, refType?: string, refId?: number): Promise<{ id: number }> {
  return (await pgQuery<{ id: number }>(`INSERT INTO sla_events (sla_id, ref_type, ref_id) VALUES ($1,$2,$3) RETURNING id`, [slaId, refType ?? null, refId ?? null]))[0]
}
export async function resolveSlaEvent(id: number): Promise<void> {
  await pgQuery(`UPDATE sla_events SET resolved_at=${NOW}, state='resolved' WHERE id=$1`, [id])
}

/** Scan open SLA events → recompute business-hours elapsed, state, escalations. */
export async function scanSla(): Promise<{ scanned: number; breached: number; escalated: number }> {
  const events = await pgQuery<{ id: number; sla_id: number; started_at: string; escalation_levels: string; target_hours: number; business_hours: string | null; holidays: string | null; escalation: string | null }>(
    `SELECT e.id, e.sla_id, e.started_at, e.escalation_levels, d.target_hours::float AS target_hours, d.business_hours, d.holidays, d.escalation
     FROM sla_events e JOIN sla_definitions d ON d.id=e.sla_id WHERE e.state<>'resolved'`)
  const now = new Date().toISOString()
  let breached = 0, escalated = 0
  for (const e of events) {
    const hours: BusinessHours = e.business_hours ? (JSON.parse(e.business_hours) ?? DEFAULT_HOURS) : DEFAULT_HOURS
    const holidays: string[] = e.holidays ? (JSON.parse(e.holidays) ?? []) : []
    const rules: SlaEscalationRule[] = e.escalation ? (JSON.parse(e.escalation) ?? DEFAULT_SLA_ESCALATION) : DEFAULT_SLA_ESCALATION
    const elapsed = businessHoursBetween(new Date(e.started_at.replace(' ', 'T') + 'Z').toISOString(), now, hours, holidays)
    const state = slaState(elapsed, e.target_hours)
    if (state === 'breached') breached++
    const fired: number[] = JSON.parse(e.escalation_levels || '[]')
    const due = dueSlaEscalations(elapsed, e.target_hours, fired, rules)
    for (const r of due) { fired.push(r.level); escalated++; await queueSlaNotification(e.id, r) }
    await pgQuery(`UPDATE sla_events SET elapsed_hours=$2, state=$3, escalation_levels=$4 WHERE id=$1`, [e.id, elapsed, state, JSON.stringify([...new Set(fired)])])
  }
  return { scanned: events.length, breached, escalated }
}

async function queueSlaNotification(eventId: number, rule: SlaEscalationRule): Promise<void> {
  try { await pgQuery(`INSERT INTO workflow_notifications (channel, kind, status, detail) VALUES ('internal','escalation','queued',$1)`, [`SLA event ${eventId} → L${rule.level}${rule.target ? ` (${rule.target})` : ''}`]) } catch { /* best-effort */ }
}

export async function listSlaEvents(state?: string) {
  const gate = state ? `WHERE e.state=$1` : ''
  return pgQuery(`SELECT e.id, e.sla_id AS "slaId", d.name_en AS "slaName", e.ref_type AS "refType", e.ref_id AS "refId", e.started_at AS "startedAt", e.elapsed_hours::float AS "elapsedHours", e.state, e.escalation_levels AS "escalationLevels" FROM sla_events e JOIN sla_definitions d ON d.id=e.sla_id ${gate} ORDER BY e.id DESC LIMIT 200`, state ? [state] : [])
}
