/**
 * Approval platform data layer (Phase 26.12). Matrix-driven multi-level approval
 * orchestration over PostgreSQL — reuses the pure engines (`lib/approval/*`), the
 * Business Rules routing, `logAction` audit, `canDo`+`finance_role` RBAC and
 * `notifications`. NOT a second workflow executor: the graph engine stays for
 * graph flows; this is the centralized approval store every ERP module calls.
 */
import { pgQuery } from '@/lib/db'
import type { AdminUser } from '@/lib/admin/auth'
import { financeRole } from './financeRbac'
import {
  resolveApprovalPlan, type MatrixRule, type ApprovalLevelPlan, type ApprovalDocType,
} from '@/lib/approval/matrix'
import { approvalState, canActFor, type ApprovalActionRec, type Delegation, type Decision } from '@/lib/approval/engine'
import { dueEscalations, slaBreached } from '@/lib/approval/escalation'
import { approvalKpis, type RequestFact, type ActionFact } from '@/lib/approval/analytics'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// ── Matrix (M1) ──────────────────────────────────────────────────────────────
export async function loadMatrix(docType?: string): Promise<MatrixRule[]> {
  const gate = docType ? `WHERE active=1 AND doc_type=$1` : `WHERE active=1`
  const rows = await pgQuery<{ id: number; doc_type: string; min_amount: number; max_amount: number | null; condition: string | null; levels: string; priority: number }>(
    `SELECT id, doc_type, min_amount::float AS min_amount, max_amount::float AS max_amount, condition, levels, priority FROM approval_matrix ${gate} ORDER BY doc_type, priority DESC, min_amount`,
    docType ? [docType] : [])
  return rows.map(r => ({
    id: r.id, docType: r.doc_type as ApprovalDocType, minAmount: Number(r.min_amount),
    maxAmount: r.max_amount == null ? null : Number(r.max_amount),
    condition: r.condition ? JSON.parse(r.condition) : null, levels: JSON.parse(r.levels) as ApprovalLevelPlan[], priority: r.priority,
  }))
}
export async function listMatrixRows() {
  return pgQuery(`SELECT id, doc_type AS "docType", name_en AS "nameEn", name_fa AS "nameFa", min_amount::float AS "minAmount", max_amount::float AS "maxAmount", condition, levels, priority, active FROM approval_matrix ORDER BY doc_type, priority DESC, min_amount`)
}
export async function upsertMatrixRule(input: { id?: number; docType: string; nameEn?: string; nameFa?: string; minAmount: number; maxAmount?: number | null; condition?: unknown; levels: unknown; priority?: number }, userId: string): Promise<{ id: number }> {
  if (input.id) {
    await pgQuery(`UPDATE approval_matrix SET doc_type=$2, name_en=$3, name_fa=$4, min_amount=$5, max_amount=$6, condition=$7, levels=$8, priority=$9, updated_at=${NOW} WHERE id=$1`,
      [input.id, input.docType, input.nameEn ?? null, input.nameFa ?? null, input.minAmount, input.maxAmount ?? null, input.condition ? JSON.stringify(input.condition) : null, JSON.stringify(input.levels), input.priority ?? 0])
    return { id: input.id }
  }
  const r = (await pgQuery<{ id: number }>(`INSERT INTO approval_matrix (doc_type, name_en, name_fa, min_amount, max_amount, condition, levels, priority, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [input.docType, input.nameEn ?? null, input.nameFa ?? null, input.minAmount, input.maxAmount ?? null, input.condition ? JSON.stringify(input.condition) : null, JSON.stringify(input.levels), input.priority ?? 0, userId]))[0]
  return r
}
export async function deleteMatrixRule(id: number): Promise<void> { await pgQuery(`DELETE FROM approval_matrix WHERE id=$1`, [id]) }

// ── Requests (M8/M15) ────────────────────────────────────────────────────────
export interface RequestInput {
  docType: ApprovalDocType; refType?: string; refId?: number; title: string; amount: number; currency?: string
  department?: string; costCenterId?: number; projectId?: number; context?: Record<string, unknown>
}

/** Create an approval request: resolves + snapshots the plan from the matrix. */
export async function createApprovalRequest(input: RequestInput, userId: string): Promise<{ id: number; levels: number; autoApproved: boolean }> {
  const matrix = await loadMatrix(input.docType)
  const plan = resolveApprovalPlan(matrix, { docType: input.docType, amount: input.amount, context: { department: input.department, cost_center: input.costCenterId, project: input.projectId, ...(input.context ?? {}) } })
  const autoApproved = plan.length === 0   // no rule → nothing to approve
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO approval_requests (doc_type, ref_type, ref_id, title, amount, currency, department, cost_center_id, project_id, context, plan, status, current_level, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [input.docType, input.refType ?? null, input.refId ?? null, input.title, input.amount, input.currency ?? 'IRR',
     input.department ?? null, input.costCenterId ?? null, input.projectId ?? null, JSON.stringify(input.context ?? {}),
     JSON.stringify(plan), autoApproved ? 'approved' : 'pending', plan[0]?.level ?? 1, userId]))[0]
  if (autoApproved) await pgQuery(`UPDATE approval_requests SET decided_at=${NOW} WHERE id=$1`, [r.id])
  else await queueNotification(r.id, 'request', input.title)
  return { id: r.id, levels: new Set(plan.map(l => l.level)).size, autoApproved }
}

interface RequestRow {
  id: number; docType: string; refType: string | null; refId: number | null; title: string; amount: number; currency: string
  department: string | null; status: string; currentLevel: number; plan: string; pendingSince: string; decidedAt: string | null
  escalationStages: string; slaBreached: number; createdBy: string; createdAt: string
}
async function getRow(id: number): Promise<RequestRow | null> {
  const r = (await pgQuery(
    `SELECT id, doc_type AS "docType", ref_type AS "refType", ref_id AS "refId", title, amount::float AS amount, currency,
            department, status, current_level AS "currentLevel", plan, pending_since AS "pendingSince", decided_at AS "decidedAt",
            escalation_stages AS "escalationStages", sla_breached AS "slaBreached", created_by AS "createdBy", created_at AS "createdAt"
     FROM approval_requests WHERE id=$1`, [id]))[0] as unknown as RequestRow | undefined
  return r ?? null
}
async function actionsFor(id: number): Promise<ApprovalActionRec[]> {
  const rows = await pgQuery<{ level: number; approver_id: string; decision: string; on_behalf_of: string | null; created_at: string }>(
    `SELECT level, approver_id, decision, on_behalf_of, created_at FROM approval_actions WHERE request_id=$1 ORDER BY id`, [id])
  return rows.map(a => ({ level: a.level, approverId: a.approver_id, decision: a.decision as Decision, onBehalfOf: a.on_behalf_of, at: a.created_at }))
}

export async function getApprovalRequest(id: number) {
  const row = await getRow(id)
  if (!row) return null
  const plan = JSON.parse(row.plan) as ApprovalLevelPlan[]
  const actions = await actionsFor(id)
  const state = approvalState(plan, actions)
  const comments = await pgQuery(`SELECT c.id, c.author_id AS "authorId", u.name AS "authorName", c.body, c.internal, c.attachment_url AS "attachmentUrl", c.created_at AS "createdAt" FROM workflow_comments c LEFT JOIN users u ON u.id=c.author_id WHERE c.request_id=$1 ORDER BY c.id`, [id])
  const escalations = await pgQuery(`SELECT stage, action, target, created_at AS "createdAt" FROM workflow_escalations WHERE request_id=$1 ORDER BY stage`, [id])
  return { request: row, plan, actions, state, comments, escalations }
}

// ── Delegation (M5) ──────────────────────────────────────────────────────────
async function activeDelegations(toUserId?: string): Promise<Delegation[]> {
  const gate = toUserId ? `WHERE active=1 AND to_user_id=$1` : `WHERE active=1`
  const rows = await pgQuery<{ from_user_id: string; to_user_id: string; start_date: string; end_date: string; doc_type: string | null; department: string | null }>(
    `SELECT from_user_id, to_user_id, start_date, end_date, doc_type, department FROM approval_delegations ${gate}`, toUserId ? [toUserId] : [])
  return rows.map(d => ({ fromUserId: d.from_user_id, toUserId: d.to_user_id, startDate: d.start_date, endDate: d.end_date, docType: d.doc_type, department: d.department }))
}

/**
 * Can this user act on the request's current level? Core admins always; the
 * user's finance_role matching a role approver; a user approver by id; or an
 * active delegation from a principal who could. Returns the principal acted for.
 */
async function resolveActor(user: AdminUser, row: RequestRow, level: ApprovalLevelPlan): Promise<{ allowed: boolean; onBehalfOf: string | null }> {
  if (user.role === 'super_admin' || user.role === 'administrator') return { allowed: true, onBehalfOf: null }
  const fr = await financeRole(user)
  const roleRefs = level.approvers.filter(a => a.type === 'role').map(a => a.ref)
  const userRefs = level.approvers.filter(a => a.type === 'user').map(a => a.ref)
  if ((fr && roleRefs.includes(fr)) || userRefs.includes(user.id)) return { allowed: true, onBehalfOf: null }
  // Delegation: is the user a delegate of a principal who satisfies the level?
  const today = new Date().toISOString().slice(0, 10)
  const dels = await activeDelegations(user.id)
  for (const d of dels) {
    if (!canActFor(user.id, d.fromUserId, [d], today, row.docType, row.department ?? undefined)) continue
    const pr = (await pgQuery<{ finance_role: string | null }>(`SELECT finance_role FROM users WHERE id=$1`, [d.fromUserId]))[0]
    if ((pr?.finance_role && roleRefs.includes(pr.finance_role)) || userRefs.includes(d.fromUserId)) return { allowed: true, onBehalfOf: d.fromUserId }
  }
  return { allowed: false, onBehalfOf: null }
}

/** Approve / reject / request-change at the current level (RBAC + delegation + audit). */
export async function actOnRequest(id: number, user: AdminUser, decision: Decision, comment: string | undefined, ip: string | undefined): Promise<{ status: string }> {
  const row = await getRow(id)
  if (!row) throw new Error('Request not found')
  if (row.status !== 'pending' && row.status !== 'changes_requested') throw new Error(`Request is already ${row.status}`)
  const plan = JSON.parse(row.plan) as ApprovalLevelPlan[]
  const level = plan.find(l => l.level === row.currentLevel)
  if (!level) throw new Error('No current level to act on')
  const actor = await resolveActor(user, row, level)
  if (!actor.allowed) throw new Error('You are not an authorized approver for this level')

  await pgQuery(`INSERT INTO approval_actions (request_id, level, approver_id, on_behalf_of, decision, comment, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, row.currentLevel, user.id, actor.onBehalfOf, decision, comment ?? null, ip ?? null])

  const actions = await actionsFor(id)
  const state = approvalState(plan, actions)
  const decidedAt = (state.status === 'approved' || state.status === 'rejected') ? `${NOW}` : 'decided_at'
  await pgQuery(
    `UPDATE approval_requests SET status=$2, current_level=$3, decided_at=${decidedAt}, pending_since=CASE WHEN $3 <> current_level THEN ${NOW} ELSE pending_since END, updated_at=${NOW} WHERE id=$1`,
    [id, state.status, state.currentLevel ?? row.currentLevel])

  if (state.status === 'approved') { await advanceDocument(row); await queueNotification(id, 'completion', row.title) }
  return { status: state.status }
}

/** Bulk approve (permission-checked per request; skips unauthorized). */
export async function bulkApprove(ids: number[], user: AdminUser, ip?: string): Promise<{ approved: number; skipped: number }> {
  let approved = 0, skipped = 0
  for (const id of ids) {
    try { await actOnRequest(id, user, 'approved', 'Bulk approval', ip); approved++ } catch { skipped++ }
  }
  return { approved, skipped }
}

/** ERP integration hook (M15): advance the source document when fully approved. */
async function advanceDocument(row: RequestRow): Promise<void> {
  if (!row.refType || !row.refId) return
  try {
    if (row.refType === 'purchase_documents') await pgQuery(`UPDATE purchase_documents SET status='approved' WHERE id=$1 AND status NOT IN ('paid','void')`, [row.refId])
    else if (row.refType === 'payment_orders') await pgQuery(`UPDATE payment_orders SET status='approved' WHERE id=$1 AND status='pending_approval'`, [row.refId])
    else if (row.refType === 'sales_documents') await pgQuery(`UPDATE sales_documents SET status='confirmed' WHERE id=$1 AND status='sent'`, [row.refId])
    else if (row.refType === 'gen_documents') await pgQuery(`UPDATE gen_documents SET status='issued' WHERE id=$1`, [row.refId])
  } catch { /* document advance is best-effort; the approval itself is authoritative */ }
}

// ── Comments (M9) ────────────────────────────────────────────────────────────
export async function addComment(requestId: number, userId: string, body: string, opts: { internal?: boolean; attachmentUrl?: string; mentions?: string[] } = {}): Promise<{ id: number }> {
  const r = (await pgQuery<{ id: number }>(`INSERT INTO workflow_comments (request_id, author_id, body, internal, attachment_url, mentions) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [requestId, userId, body, opts.internal ? 1 : 0, opts.attachmentUrl ?? null, opts.mentions ? JSON.stringify(opts.mentions) : null]))[0]
  return r
}

// ── Delegations CRUD ─────────────────────────────────────────────────────────
export async function listDelegations() {
  return pgQuery(`SELECT d.id, d.from_user_id AS "fromUserId", uf.name AS "fromName", d.to_user_id AS "toUserId", ut.name AS "toName", d.start_date AS "startDate", d.end_date AS "endDate", d.doc_type AS "docType", d.department, d.active FROM approval_delegations d LEFT JOIN users uf ON uf.id=d.from_user_id LEFT JOIN users ut ON ut.id=d.to_user_id ORDER BY d.id DESC`)
}
export async function createDelegation(input: { fromUserId: string; toUserId: string; startDate: string; endDate: string; docType?: string; department?: string }, userId: string): Promise<{ id: number }> {
  const r = (await pgQuery<{ id: number }>(`INSERT INTO approval_delegations (from_user_id, to_user_id, start_date, end_date, doc_type, department, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [input.fromUserId, input.toUserId, input.startDate, input.endDate, input.docType ?? null, input.department ?? null, userId]))[0]
  return r
}
export async function revokeDelegation(id: number): Promise<void> { await pgQuery(`UPDATE approval_delegations SET active=0 WHERE id=$1`, [id]) }

// ── Escalation (M6) ──────────────────────────────────────────────────────────
export async function scanEscalations(): Promise<{ escalated: number; breached: number }> {
  const rows = await pgQuery<{ id: number; title: string; pending_since: string; escalation_stages: string }>(
    `SELECT id, title, pending_since, escalation_stages FROM approval_requests WHERE status IN ('pending','changes_requested')`)
  const now = new Date().toISOString()
  let escalated = 0, breached = 0
  for (const r of rows) {
    const fired: number[] = JSON.parse(r.escalation_stages || '[]')
    const due = dueEscalations(new Date(r.pending_since.replace(' ', 'T') + 'Z').toISOString(), now, fired)
    if (slaBreached(new Date(r.pending_since.replace(' ', 'T') + 'Z').toISOString(), now)) { await pgQuery(`UPDATE approval_requests SET sla_breached=1 WHERE id=$1`, [r.id]); breached++ }
    for (const e of due) {
      await pgQuery(`INSERT INTO workflow_escalations (request_id, stage, action, target) VALUES ($1,$2,$3,$4) ON CONFLICT (request_id, stage) DO NOTHING`, [r.id, e.stage, e.action, e.target ?? null])
      await queueNotification(r.id, e.action === 'reminder' ? 'reminder' : 'escalation', r.title)
      fired.push(e.stage); escalated++
    }
    if (due.length) await pgQuery(`UPDATE approval_requests SET escalation_stages=$2 WHERE id=$1`, [r.id, JSON.stringify([...new Set(fired)])])
  }
  return { escalated, breached }
}

// ── Notifications (M12) ──────────────────────────────────────────────────────
async function queueNotification(requestId: number, kind: string, detail: string): Promise<void> {
  try { await pgQuery(`INSERT INTO workflow_notifications (request_id, channel, kind, status, detail) VALUES ($1,'internal',$2,'queued',$3)`, [requestId, kind, detail]) } catch { /* best-effort */ }
}

// ── Inbox (M8) ───────────────────────────────────────────────────────────────
export async function inbox(tab: 'pending' | 'approved' | 'rejected' | 'delegated' | 'expired', userId: string) {
  if (tab === 'delegated') {
    return pgQuery(`SELECT r.* FROM approval_requests r WHERE r.created_by IN (SELECT from_user_id FROM approval_delegations WHERE to_user_id=$1 AND active=1) ORDER BY r.id DESC LIMIT 200`, [userId])
  }
  if (tab === 'expired') return pgQuery(`SELECT id, doc_type AS "docType", title, amount::float AS amount, currency, department, status, current_level AS "currentLevel", pending_since AS "pendingSince", sla_breached AS "slaBreached", created_at AS "createdAt" FROM approval_requests WHERE status IN ('pending','changes_requested') AND sla_breached=1 ORDER BY pending_since LIMIT 200`)
  const status = tab === 'pending' ? `status IN ('pending','changes_requested')` : `status='${tab}'`
  return pgQuery(`SELECT id, doc_type AS "docType", title, amount::float AS amount, currency, department, status, current_level AS "currentLevel", pending_since AS "pendingSince", sla_breached AS "slaBreached", created_at AS "createdAt" FROM approval_requests WHERE ${status} ORDER BY id DESC LIMIT 200`)
}

// ── Analytics (M11) ──────────────────────────────────────────────────────────
export async function approvalAnalytics() {
  const rows = await pgQuery<{ id: number; docType: string; department: string | null; status: string; createdAt: string; decidedAt: string | null; slaBreached: number }>(
    `SELECT id, doc_type AS "docType", department, status, created_at AS "createdAt", decided_at AS "decidedAt", sla_breached AS "slaBreached" FROM approval_requests`)
  const actions = (await pgQuery(`SELECT request_id AS "requestId", approver_id AS "approverId", decision, EXTRACT(EPOCH FROM (created_at::timestamp - (SELECT created_at::timestamp FROM approval_requests WHERE id=request_id)))/3600.0 AS "waitedHours" FROM approval_actions`)) as unknown as ActionFact[]
  const facts: RequestFact[] = rows.map(r => ({ id: r.id, docType: r.docType, department: r.department, status: r.status, createdAt: r.createdAt, decidedAt: r.decidedAt, slaBreached: !!r.slaBreached }))
  return approvalKpis(facts, actions)
}
