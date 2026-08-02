import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const KINDS = ['call', 'meeting', 'email', 'note', 'task'] as const

// GET — activity timeline for one lead (?leadId=), newest first.
export async function GET(req: NextRequest) {
  const auth = await requirePermission('crm.crm', 'read')
  if ('error' in auth) return auth.error
  try {
    const leadId = Number(req.nextUrl.searchParams.get('leadId'))
    if (!leadId) return badRequest('leadId required')
    const activities = await pgQuery(
      `SELECT a.id, a.kind, a.body, a.due_at AS "dueAt", a.done, a.assigned_to AS "assignedTo",
              ua.name AS "assignedName", uc.name AS "createdByName", a.created_at AS "createdAt"
       FROM crm_activities a LEFT JOIN users ua ON ua.id=a.assigned_to LEFT JOIN users uc ON uc.id=a.created_by
       WHERE a.lead_id=$1 ORDER BY a.created_at DESC, a.id DESC LIMIT 300`, [leadId])
    return NextResponse.json({ activities })
  } catch (e) { return apiError(e, 'Failed to load activities') }
}

const createSchema = z.object({
  leadId: z.number().int().positive(),
  kind: z.enum(KINDS).default('note'),
  body: z.string().trim().min(1).max(4000),
  dueAt: z.string().max(30).optional().nullable(),
  assignedTo: z.string().max(64).optional().nullable(),
})

// POST — log an activity on a lead (touches the lead's updated_at → SLA reset).
export async function POST(req: NextRequest) {
  const auth = await requirePermission('crm.crm', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, createSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const lead = (await pgQuery(`SELECT id FROM crm_leads WHERE id=$1`, [d.leadId]))[0]
    if (!lead) return badRequest('Lead not found')
    const row = (await pgQuery<{ id: number }>(
      `INSERT INTO crm_activities (lead_id, kind, body, due_at, assigned_to, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [d.leadId, d.kind, d.body, d.dueAt ?? null, d.assignedTo ?? null, auth.user.id]))[0]
    await pgQuery(`UPDATE crm_leads SET updated_at=${NOW} WHERE id=$1`, [d.leadId])
    // Resolve any open SLA alert for this lead — it just got an activity.
    await pgQuery(`UPDATE business_alerts SET status='resolved', updated_at=${NOW} WHERE fingerprint=$1 AND status='open'`, [`crm_sla:${d.leadId}`]).catch(() => null)
    await logAction(auth.user, 'crm.activity.create', 'crm_activities', row.id, null, { leadId: d.leadId, kind: d.kind })
    return NextResponse.json({ id: row.id })
  } catch (e) { return apiError(e, 'Failed to create activity') }
}

const updateSchema = z.object({
  id: z.number().int().positive(),
  body: z.string().trim().min(1).max(4000).optional(),
  dueAt: z.string().max(30).optional().nullable(),
  done: z.boolean().optional(),
  assignedTo: z.string().max(64).optional().nullable(),
})

// PUT — edit / complete an activity.
export async function PUT(req: NextRequest) {
  const auth = await requirePermission('crm.crm', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, updateSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const before = (await pgQuery(`SELECT kind, body, done FROM crm_activities WHERE id=$1`, [d.id]))[0]
    if (!before) return badRequest('Not found')
    await pgQuery(
      `UPDATE crm_activities SET body=COALESCE($2,body), due_at=COALESCE($3,due_at),
        done=COALESCE($4,done), assigned_to=COALESCE($5,assigned_to), updated_at=${NOW} WHERE id=$1`,
      [d.id, d.body ?? null, d.dueAt ?? null, d.done === undefined ? null : (d.done ? 1 : 0), d.assignedTo ?? null])
    await logAction(auth.user, 'crm.activity.update', 'crm_activities', d.id, before, d)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to update activity') }
}

// DELETE — remove an activity (delete permission).
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('crm.crm', 'write', 'delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    const before = (await pgQuery(`SELECT lead_id, kind, body FROM crm_activities WHERE id=$1`, [parsed.data.id]))[0]
    if (!before) return badRequest('Not found')
    await pgQuery(`DELETE FROM crm_activities WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'crm.activity.delete', 'crm_activities', parsed.data.id, before, null)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete activity') }
}
