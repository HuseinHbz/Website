import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest, guardJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { scoreLead, pipelineStats, LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from '@/lib/crm/leads'

// CRM lead pipeline API. Reuses the validated subsystems: zod validation,
// requireAdmin RBAC, and audit logging. Writes re-score the lead server-side.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const upsertSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal('')).nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  source: z.enum(LEAD_SOURCES).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  value: z.number().int().min(0).max(1_000_000_000).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
})

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const rows = await pgQuery(
      `SELECT id, name, email, phone, company, source, status, score, value, notes, owner_id AS "ownerId", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM crm_leads ORDER BY updated_at DESC`
    ) as { status: LeadStatus; value: number; score: number }[]
    const stats = pipelineStats(rows.map((r) => ({ status: r.status, value: r.value, score: r.score })))
    return NextResponse.json({ leads: rows, stats })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin('edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, upsertSchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    const score = scoreLead(d)
    const result = (await pgQuery(
      `INSERT INTO crm_leads (name, email, phone, company, source, status, score, value, notes, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [d.name, d.email || null, d.phone || null, d.company || null,
        d.source ?? 'other', d.status ?? 'new', score, d.value ?? 0,
        d.notes || null, auth.user.id],
    ))[0] as { id: number }
    await logAction(auth.user, 'CREATE', 'crm_leads', result.id, null, { ...d, score })
    return NextResponse.json({ id: result.id, score })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin('edit')
    if ('error' in auth) return auth.error
    const parsed = await readJson(req, upsertSchema)
    if ('error' in parsed) return parsed.error
    const d = parsed.data
    if (!d.id) return badRequest('id required')
    const existing = (await pgQuery(`SELECT * FROM crm_leads WHERE id=$1`, [d.id]))[0] as Record<string, unknown> | undefined
    if (!existing) return badRequest('lead not found')
    const merged = { ...existing, ...d, source: d.source ?? (existing.source as string), status: d.status ?? (existing.status as string), value: d.value ?? (existing.value as number) }
    const score = scoreLead(merged as never)
    await pgQuery(
      `UPDATE crm_leads SET name=$2, email=$3, phone=$4, company=$5, source=$6,
        status=$7, score=$8, value=$9, notes=$10, updated_at=to_char(now(), 'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`,
      [d.id, merged.name, d.email ?? existing.email ?? null, d.phone ?? existing.phone ?? null,
        d.company ?? existing.company ?? null, merged.source, merged.status,
        score, merged.value, d.notes ?? existing.notes ?? null],
    )
    await logAction(auth.user, 'UPDATE', 'crm_leads', d.id, existing, { ...d, score })
    return NextResponse.json({ ok: true, score })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin('delete')
    if ('error' in auth) return auth.error
    const { id } = await guardJson(req).catch(() => ({}))
    if (!id || typeof id !== 'number') return badRequest('id required')
    await pgQuery(`DELETE FROM crm_leads WHERE id=$1`, [id])
    await logAction(auth.user, 'DELETE', 'crm_leads', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
