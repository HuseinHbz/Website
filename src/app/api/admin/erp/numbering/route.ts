import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { validateFormat } from '@/lib/numbering/format'
import { listFormats, listCounters, listAudit, numberingDashboard } from '@/lib/numbering/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// GET — ?view=dashboard | formats | counters | audit
export async function GET(req: NextRequest) {
  const auth = await requirePermission('system.numbering', 'read')
  if ('error' in auth) return auth.error
  const p = req.nextUrl.searchParams
  const view = p.get('view') ?? 'formats'
  try {
    switch (view) {
      case 'dashboard': return NextResponse.json(await numberingDashboard())
      case 'counters': return NextResponse.json({ counters: await listCounters(p.get('docType') ?? undefined) })
      case 'audit': return NextResponse.json({ audit: await listAudit({ q: p.get('q') ?? undefined, docType: p.get('docType') ?? undefined, status: p.get('status') ?? undefined }) })
      default: return NextResponse.json({ formats: await listFormats(true) })
    }
  } catch (e) { return apiError(e, 'Failed to load numbering data') }
}

const formatSchema = z.object({
  docType: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, 'lower snake_case only'),
  nameEn: z.string().min(1).max(120),
  nameFa: z.string().max(120).optional(),
  pattern: z.string().min(1).max(200),
  prefix: z.string().max(40).default(''),
  suffix: z.string().max(40).default(''),
  resetPolicy: z.enum(['never', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'fiscal']).default('yearly'),
  padding: z.number().int().min(0).max(20).default(6),
  increment: z.number().int().min(1).max(1000).default(1),
  startNumber: z.number().int().min(0).default(1),
  minNumber: z.number().int().min(0).default(1),
  maxNumber: z.number().int().positive().nullable().optional(),
  alphabet: z.enum(['numeric', 'hex']).default('numeric'),
  fiscalStartMonth: z.number().int().min(1).max(12).default(1),
  randomLength: z.number().int().min(0).max(32).default(4),
  active: z.number().int().min(0).max(1).default(1),
})

// POST — create a numbering format.
export async function POST(req: NextRequest) {
  const auth = await requirePermission('system.numbering', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, formatSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const v = validateFormat(d)
  if (!v.ok) return badRequest(v.errors.join('; '))
  try {
    const exists = await pgQuery(`SELECT 1 FROM numbering_formats WHERE doc_type=$1`, [d.docType])
    if (exists.length) return badRequest('A format for this document type already exists')
    const row = (await pgQuery(
      `INSERT INTO numbering_formats (doc_type, name_en, name_fa, pattern, prefix, suffix, reset_policy,
         padding, increment, start_number, min_number, max_number, alphabet, fiscal_start_month, random_length, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [d.docType, d.nameEn, d.nameFa ?? null, d.pattern, d.prefix, d.suffix, d.resetPolicy,
       d.padding, d.increment, d.startNumber, d.minNumber, d.maxNumber ?? null, d.alphabet, d.fiscalStartMonth, d.randomLength, d.active, auth.user.id]))[0] as { id: number }
    await logAction(auth.user, 'create', 'numbering_format', d.docType, null, d)
    return NextResponse.json({ id: row.id })
  } catch (e) { return apiError(e, 'Failed to create format') }
}

const updateSchema = formatSchema.partial().extend({ id: z.number().int().positive() })

// PUT — update a format (docType immutable).
export async function PUT(req: NextRequest) {
  const auth = await requirePermission('system.numbering', 'write', 'edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, updateSchema)
  if ('error' in parsed) return parsed.error
  const { id, docType: _ignore, ...d } = parsed.data
  const map: Record<string, string> = {
    nameEn: 'name_en', nameFa: 'name_fa', pattern: 'pattern', prefix: 'prefix', suffix: 'suffix',
    resetPolicy: 'reset_policy', padding: 'padding', increment: 'increment', startNumber: 'start_number',
    minNumber: 'min_number', maxNumber: 'max_number', alphabet: 'alphabet', fiscalStartMonth: 'fiscal_start_month',
    randomLength: 'random_length', active: 'active',
  }
  const sets: string[] = []
  const params: unknown[] = []
  for (const [k, col] of Object.entries(map)) {
    if (k in d) { params.push((d as Record<string, unknown>)[k]); sets.push(`${col}=$${params.length}`) }
  }
  if (!sets.length) return badRequest('Nothing to update')
  // Validate resulting pattern if changed.
  if (d.pattern) { const v = validateFormat({ docType: 'x', pattern: d.pattern }); if (!v.ok) return badRequest(v.errors.join('; ')) }
  params.push(id)
  try {
    await pgQuery(`UPDATE numbering_formats SET ${sets.join(', ')}, updated_at=${NOW} WHERE id=$${params.length}`, params)
    await logAction(auth.user, 'update', 'numbering_format', id, null, d)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to update format') }
}

// DELETE — remove a format (and its counters via cascade). ?id=
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission('system.numbering', 'write', 'delete')
  if ('error' in auth) return auth.error
  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!id) return badRequest('id required')
  try {
    await pgQuery(`DELETE FROM numbering_formats WHERE id=$1`, [id])
    await logAction(auth.user, 'delete', 'numbering_format', id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete format') }
}
