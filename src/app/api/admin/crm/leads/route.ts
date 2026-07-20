import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, guardJson, requirePermission } from '@/lib/api/respond'
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
  ownerId: z.string().max(64).optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'read')
    if ('error' in auth) return auth.error
    const mine = req.nextUrl.searchParams.get('mine') === '1'
    const rows = await pgQuery(
      `SELECT l.id, l.name, l.email, l.phone, l.company, l.source, l.status, l.score, l.value, l.notes,
              l.owner_id AS "ownerId", u.name AS "ownerName", l.converted_customer_id AS "convertedCustomerId",
              l.created_at AS "createdAt", l.updated_at AS "updatedAt",
              (SELECT MAX(a.created_at) FROM crm_activities a WHERE a.lead_id=l.id) AS "lastActivityAt"
       FROM crm_leads l LEFT JOIN users u ON u.id=l.owner_id
       ${mine ? 'WHERE l.owner_id=$1' : ''}
       ORDER BY l.updated_at DESC`, mine ? [auth.user.id] : []
    ) as { status: LeadStatus; value: number; score: number; lastActivityAt: string | null; createdAt: string }[]
    const stats = pipelineStats(rows.map((r) => ({ status: r.status, value: r.value, score: r.score })))
    // بند ۵.۵ — SLA: open leads with no activity for N days (configurable) →
    // idempotent business_alerts (fingerprint upsert) + a live counter.
    const slaDays = Number((await pgQuery<{ value: string }>(`SELECT value FROM erp_settings WHERE key='crm_sla_days'`))[0]?.value ?? 7)
    const cutoff = Date.now() - slaDays * 86_400_000
    const stale = (rows as unknown as { id: number; name: string; status: string; lastActivityAt: string | null; createdAt: string }[])
      .filter(l => !['won', 'lost'].includes(l.status) && new Date(l.lastActivityAt ?? l.createdAt).getTime() < cutoff)
    for (const l of stale) {
      await pgQuery(
        `INSERT INTO business_alerts (kind, domain, severity, title_en, title_fa, detail, ref_type, ref_id, fingerprint)
         VALUES ('crm_sla','operational','warning',$1,$2,$3,'crm_leads',$4,$5)
         ON CONFLICT (fingerprint) DO UPDATE SET updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS')`,
        [`Lead "${l.name}" has no activity for over ${slaDays} days`,
         `سرنخ «${l.name}» بیش از ${slaDays} روز بدون فعالیت است`,
         `status=${l.status}`, l.id, `crm_sla:${l.id}`]).catch(() => null)
    }
    return NextResponse.json({ leads: rows, stats, sla: { days: slaDays, breached: stale.length } })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'edit')
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
        d.notes || null, d.ownerId ?? auth.user.id],
    ))[0] as { id: number }
    await logAction(auth.user, 'CREATE', 'crm_leads', result.id, null, { ...d, score })
    return NextResponse.json({ id: result.id, score })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'edit')
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
        status=$7, score=$8, value=$9, notes=$10, owner_id=COALESCE($11, owner_id), updated_at=to_char(now(), 'YYYY-MM-DD HH24:MI:SS') WHERE id=$1`,
      [d.id, merged.name, d.email ?? existing.email ?? null, d.phone ?? existing.phone ?? null,
        d.company ?? existing.company ?? null, merged.source, merged.status,
        score, merged.value, d.notes ?? existing.notes ?? null, d.ownerId ?? null],
    )
    await logAction(auth.user, 'UPDATE', 'crm_leads', d.id, existing, { ...d, score })
    return NextResponse.json({ ok: true, score })
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission('crm.crm', 'write', 'delete')
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
