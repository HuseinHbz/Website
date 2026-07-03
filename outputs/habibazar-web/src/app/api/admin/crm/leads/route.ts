import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { scoreLead, pipelineStats, LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from '@/lib/crm/leads'

// CRM lead pipeline API. Reuses the validated subsystems: zod validation,
// requireAdmin RBAC, and audit logging. Writes re-score the lead server-side.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function client(): Database.Database {
  return (getDb() as unknown as { $client: Database.Database }).$client
}

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
    const rows = client().prepare(
      `SELECT id, name, email, phone, company, source, status, score, value, notes, owner_id AS ownerId, created_at AS createdAt, updated_at AS updatedAt
       FROM crm_leads ORDER BY updated_at DESC`
    ).all() as { status: LeadStatus; value: number; score: number }[]
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
    const result = client().prepare(
      `INSERT INTO crm_leads (name, email, phone, company, source, status, score, value, notes, owner_id)
       VALUES (@name,@email,@phone,@company,@source,@status,@score,@value,@notes,@ownerId) RETURNING id`
    ).get({
      name: d.name, email: d.email || null, phone: d.phone || null, company: d.company || null,
      source: d.source ?? 'other', status: d.status ?? 'new', score, value: d.value ?? 0,
      notes: d.notes || null, ownerId: auth.user.id,
    }) as { id: number }
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
    const db = client()
    const existing = db.prepare(`SELECT * FROM crm_leads WHERE id=?`).get(d.id) as Record<string, unknown> | undefined
    if (!existing) return badRequest('lead not found')
    const merged = { ...existing, ...d, source: d.source ?? (existing.source as string), status: d.status ?? (existing.status as string), value: d.value ?? (existing.value as number) }
    const score = scoreLead(merged as never)
    db.prepare(
      `UPDATE crm_leads SET name=@name, email=@email, phone=@phone, company=@company, source=@source,
        status=@status, score=@score, value=@value, notes=@notes, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id: d.id, name: merged.name, email: d.email ?? existing.email ?? null, phone: d.phone ?? existing.phone ?? null,
      company: d.company ?? existing.company ?? null, source: merged.source, status: merged.status,
      score, value: merged.value, notes: d.notes ?? existing.notes ?? null,
    })
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
    const { id } = await req.json().catch(() => ({}))
    if (!id || typeof id !== 'number') return badRequest('id required')
    client().prepare(`DELETE FROM crm_leads WHERE id=?`).run(id)
    await logAction(auth.user, 'DELETE', 'crm_leads', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
