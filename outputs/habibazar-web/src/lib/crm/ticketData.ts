/**
 * Support-ticket data layer (Phase 26.25b بند ۱). Thin persistence over the
 * pure SLA engine (`tickets.ts`) + the shared numbering engine. Every portal query
 * is scoped to a server-provided customerId (IDOR-safe); admin queries see all.
 * SLA breaches raise idempotent business_alerts + advance the escalation stage.
 */
import { pgQuery } from '@/lib/db'
import { nextNumber } from '@/lib/numbering/integrate'
import {
  activeBusinessHours, ticketSlaState, ticketEscalations, targetHoursFor, isOpenStatus,
  canTransitionTicket, firstResponseBreached, type PausedInterval,
} from './tickets'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

interface TicketRow {
  id: number; ticket_no: string | null; customer_id: number; subject: string; category: string
  priority: string; status: string; owner_id: string | null; company_id: number | null
  first_response_at: string | null; resolved_at: string | null; source: string
  paused_hours: number; pending_since: string | null; sla_level: number
  created_at: string; updated_at: string
}

function currentPaused(t: Pick<TicketRow, 'paused_hours' | 'pending_since'>): { pausedHours: number; live: PausedInterval[] } {
  // Historical pending time is already folded into paused_hours; if the ticket is
  // pending right now, add the live open interval [pending_since, now].
  const live: PausedInterval[] = t.pending_since ? [{ from: t.pending_since, to: new Date().toISOString() }] : []
  return { pausedHours: Number(t.paused_hours) || 0, live }
}

function slaFor(t: TicketRow) {
  const { pausedHours, live } = currentPaused(t)
  // active = businessHours(created→now) − storedPausedHours − livePending
  const gross = activeBusinessHours(isoOf(t.created_at), new Date().toISOString(), live)
  const active = Math.max(0, Math.round((gross - pausedHours) * 100) / 100)
  return {
    activeHours: active,
    state: ticketSlaState(active, t.priority),
    targetHours: targetHoursFor(t.priority),
    firstResponseBreached: firstResponseBreached(active, t.priority, !!t.first_response_at),
  }
}

// Stored timestamps are 'YYYY-MM-DD HH24:MI:SS' (local) — normalise to ISO-ish.
function isoOf(ts: string): string {
  return ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z'
}

export async function createTicket(input: {
  customerId: number; subject: string; category?: string; priority?: string; source?: string
  body: string; attachmentUrl?: string; authorKind: 'agent' | 'customer'; authorId?: string; companyId?: number
}): Promise<{ id: number; ticketNo: string }> {
  const ticketNo = await nextNumber('ticket').catch(() => `TK-${Date.now()}`)
  const priority = ['low', 'normal', 'high', 'urgent'].includes(input.priority ?? '') ? input.priority! : 'normal'
  const t = (await pgQuery<{ id: number }>(
    `INSERT INTO crm_tickets (ticket_no, customer_id, subject, category, priority, status, source, company_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,'new',$6,$7,${NOW}) RETURNING id`,
    [ticketNo, input.customerId, input.subject.slice(0, 300), (input.category ?? 'general').slice(0, 60), priority, input.source ?? 'portal', input.companyId ?? null]))[0]
  await pgQuery(
    `INSERT INTO crm_ticket_messages (ticket_id, author_kind, author_id, body, attachment_url, internal)
     VALUES ($1,$2,$3,$4,$5,0)`,
    [t.id, input.authorKind, input.authorId ?? null, input.body.slice(0, 5000), input.attachmentUrl ?? null])
  return { id: t.id, ticketNo }
}

async function loadTicket(id: number): Promise<TicketRow | undefined> {
  return (await pgQuery<TicketRow>(`SELECT * FROM crm_tickets WHERE id=$1`, [id]))[0]
}

/** Admin list with SLA state; optional filters. */
export async function listTickets(filter: { status?: string; priority?: string; ownerId?: string; customerId?: number } = {}) {
  const where: string[] = []; const params: unknown[] = []
  if (filter.status === 'open') where.push(`status IN ('new','open','pending')`)
  else if (filter.status) { params.push(filter.status); where.push(`status=$${params.length}`) }
  if (filter.priority) { params.push(filter.priority); where.push(`priority=$${params.length}`) }
  if (filter.ownerId) { params.push(filter.ownerId); where.push(`owner_id=$${params.length}`) }
  if (filter.customerId) { params.push(filter.customerId); where.push(`customer_id=$${params.length}`) }
  const rows = await pgQuery<TicketRow & { customer_name: string }>(
    `SELECT t.*, c.name AS customer_name FROM crm_tickets t JOIN sales_customers c ON c.id=t.customer_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.updated_at DESC LIMIT 500`, params)
  return rows.map(r => ({
    id: r.id, ticketNo: r.ticket_no, customerId: r.customer_id, customerName: r.customer_name,
    subject: r.subject, category: r.category, priority: r.priority, status: r.status,
    ownerId: r.owner_id, firstResponseAt: r.first_response_at, resolvedAt: r.resolved_at,
    source: r.source, createdAt: r.created_at, updatedAt: r.updated_at, sla: slaFor(r),
  }))
}

/**
 * Ticket detail + messages. `includeInternal=false` (portal) NEVER returns internal
 * notes. `customerId`, when given, enforces ownership → returns null on mismatch.
 */
export async function getTicket(id: number, opts: { includeInternal: boolean; customerId?: number }) {
  const t = await loadTicket(id)
  if (!t) return null
  if (opts.customerId != null && t.customer_id !== opts.customerId) return null   // IDOR guard
  const msgs = await pgQuery<{ id: number; author_kind: string; author_id: string | null; body: string; attachment_url: string | null; internal: number; created_at: string }>(
    `SELECT id, author_kind, author_id, body, attachment_url, internal, created_at FROM crm_ticket_messages
     WHERE ticket_id=$1 ${opts.includeInternal ? '' : 'AND internal=0'} ORDER BY created_at ASC, id ASC`, [id])
  return {
    id: t.id, ticketNo: t.ticket_no, customerId: t.customer_id, subject: t.subject, category: t.category,
    priority: t.priority, status: t.status, ownerId: t.owner_id, source: t.source,
    firstResponseAt: t.first_response_at, resolvedAt: t.resolved_at, createdAt: t.created_at, updatedAt: t.updated_at,
    sla: slaFor(t),
    messages: msgs.map(m => ({ id: m.id, authorKind: m.author_kind, authorId: m.author_id, body: m.body, attachmentUrl: m.attachment_url, internal: !!m.internal, createdAt: m.created_at })),
  }
}

/** Add a reply. Agent replies set first_response_at (once); customer replies reopen a resolved ticket. */
export async function addTicketMessage(id: number, input: {
  authorKind: 'agent' | 'customer' | 'system'; authorId?: string; body: string; attachmentUrl?: string; internal?: boolean; customerId?: number
}): Promise<{ ok: boolean }> {
  const t = await loadTicket(id)
  if (!t) return { ok: false }
  if (input.customerId != null && t.customer_id !== input.customerId) return { ok: false }   // IDOR guard
  // A customer can never post an internal note.
  const internal = input.authorKind === 'agent' && input.internal ? 1 : 0
  await pgQuery(
    `INSERT INTO crm_ticket_messages (ticket_id, author_kind, author_id, body, attachment_url, internal)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, input.authorKind, input.authorId ?? null, input.body.slice(0, 5000), input.attachmentUrl ?? null, internal])
  // First agent response stamps first_response_at (public replies only).
  if (input.authorKind === 'agent' && !internal && !t.first_response_at) {
    await pgQuery(`UPDATE crm_tickets SET first_response_at=${NOW}, status=CASE WHEN status='new' THEN 'open' ELSE status END, updated_at=${NOW} WHERE id=$1`, [id])
  } else if (input.authorKind === 'customer' && (t.status === 'resolved' || t.status === 'pending')) {
    // Customer replied → un-pause + reopen.
    await unpauseAndSet(t, 'open')
  } else {
    await pgQuery(`UPDATE crm_tickets SET updated_at=${NOW} WHERE id=$1`, [id])
  }
  return { ok: true }
}

async function unpauseAndSet(t: TicketRow, to: string) {
  // Fold the live pending interval into paused_hours, clear pending_since, set status.
  if (t.pending_since) {
    const live = activeBusinessHours(isoOf(t.pending_since), new Date().toISOString(), [])
    await pgQuery(`UPDATE crm_tickets SET paused_hours = paused_hours + $2, pending_since=NULL, status=$3, updated_at=${NOW} WHERE id=$1`, [t.id, live, to])
  } else {
    await pgQuery(`UPDATE crm_tickets SET status=$2, updated_at=${NOW} WHERE id=$1`, [t.id, to])
  }
}

export async function setTicketStatus(id: number, to: string, actorId?: string): Promise<{ ok: boolean; error?: string }> {
  const t = await loadTicket(id)
  if (!t) return { ok: false, error: 'not_found' }
  if (!canTransitionTicket(t.status, to)) return { ok: false, error: 'invalid_transition' }
  if (to === 'pending') {
    await pgQuery(`UPDATE crm_tickets SET status='pending', pending_since=${NOW}, updated_at=${NOW} WHERE id=$1`, [id])
  } else if (to === 'resolved' || to === 'closed') {
    // leaving pending folds the paused interval; also stamp resolved_at
    if (t.pending_since) { const live = activeBusinessHours(isoOf(t.pending_since), new Date().toISOString(), []); await pgQuery(`UPDATE crm_tickets SET paused_hours=paused_hours+$2, pending_since=NULL WHERE id=$1`, [id, live]) }
    await pgQuery(`UPDATE crm_tickets SET status=$2, resolved_at=${NOW}, updated_at=${NOW} WHERE id=$1`, [id, to])
  } else {
    await unpauseAndSet(t, to)
  }
  await pgQuery(`INSERT INTO crm_ticket_messages (ticket_id, author_kind, author_id, body, internal) VALUES ($1,'system',$2,$3,1)`,
    [id, actorId ?? null, `status → ${to}`])
  return { ok: true }
}

export async function assignTicket(id: number, ownerId: string | null): Promise<{ ok: boolean }> {
  await pgQuery(`UPDATE crm_tickets SET owner_id=$2, updated_at=${NOW} WHERE id=$1`, [id, ownerId])
  return { ok: true }
}

export async function setTicketPriority(id: number, priority: string): Promise<{ ok: boolean }> {
  if (!['low', 'normal', 'high', 'urgent'].includes(priority)) return { ok: false }
  await pgQuery(`UPDATE crm_tickets SET priority=$2, updated_at=${NOW} WHERE id=$1`, [id, priority])
  return { ok: true }
}

/**
 * Scan open tickets → raise idempotent SLA business_alerts + advance the escalation
 * stage. Returns the counts. Auto-resolves the alert when a ticket leaves breach.
 */
export async function scanTicketSla(): Promise<{ breached: number; escalated: number }> {
  const rows = await pgQuery<TicketRow>(`SELECT * FROM crm_tickets WHERE status IN ('new','open','pending')`)
  let breached = 0, escalated = 0
  for (const t of rows) {
    const sla = slaFor(t)
    const stages = ticketEscalations(sla.activeHours, t.priority, Array.from({ length: t.sla_level }, (_, i) => i + 1))
    if (stages.length) {
      const top = Math.max(...stages.map(s => s.level))
      await pgQuery(`UPDATE crm_tickets SET sla_level=$2 WHERE id=$1`, [t.id, top])
      escalated++
    }
    if (sla.state === 'breached') {
      breached++
      await pgQuery(
        `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, metric_value, ref_type, ref_id, channels, fingerprint, updated_at)
         VALUES ('ticket_sla_breach','operational','warning',$1,$2,$3,$4,'ticket',$5,'["inapp"]',$6,${NOW})
         ON CONFLICT (fingerprint) DO UPDATE SET metric_value=EXCLUDED.metric_value, detail=EXCLUDED.detail, updated_at=${NOW},
           status=CASE WHEN business_alerts.status='resolved' THEN 'open' ELSE business_alerts.status END`,
        [`Ticket ${t.ticket_no ?? t.id} breached SLA`, `تیکت ${t.ticket_no ?? t.id} از SLA عبور کرد`,
         `${sla.activeHours}h elapsed vs ${sla.targetHours}h target (${t.priority})`, sla.activeHours, t.id, `ticket_sla:${t.id}`])
    }
  }
  // Auto-resolve alerts for tickets no longer breached/open.
  const open = await pgQuery<{ fingerprint: string; ref_id: number }>(`SELECT fingerprint, ref_id FROM business_alerts WHERE kind='ticket_sla_breach' AND status<>'resolved'`)
  for (const a of open) {
    const t = rows.find(r => r.id === Number(a.ref_id))
    if (!t || !isOpenStatus(t.status) || slaFor(t).state !== 'breached') {
      await pgQuery(`UPDATE business_alerts SET status='resolved', updated_at=${NOW} WHERE fingerprint=$1`, [a.fingerprint])
    }
  }
  return { breached, escalated }
}

/** Portal-facing: a customer's own tickets only. */
export async function listCustomerTickets(customerId: number) {
  const rows = await pgQuery<TicketRow>(`SELECT * FROM crm_tickets WHERE customer_id=$1 ORDER BY updated_at DESC LIMIT 200`, [customerId])
  return rows.map(r => ({
    id: r.id, ticketNo: r.ticket_no, subject: r.subject, category: r.category, priority: r.priority,
    status: r.status, createdAt: r.created_at, updatedAt: r.updated_at, sla: slaFor(r),
  }))
}
