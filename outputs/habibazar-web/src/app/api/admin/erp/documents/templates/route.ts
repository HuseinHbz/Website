import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

interface TplRow { id: number; key: string; name_en: string; name_fa: string; doc_type: string | null; config: string; active: boolean; updated_at: string }
const toTpl = (r: TplRow) => ({ id: r.id, key: r.key, nameEn: r.name_en, nameFa: r.name_fa, docType: r.doc_type, config: JSON.parse(r.config || '{}') as Record<string, unknown>, active: r.active, updatedAt: r.updated_at })

// GET — designer template catalog.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const rows = await pgQuery<TplRow>(`SELECT * FROM doc_templates ORDER BY active DESC, key`)
    return NextResponse.json({ templates: rows.map(toTpl) })
  } catch (e) { return apiError(e, 'Failed to load templates') }
}

const configSchema = z.object({
  variant: z.string().max(40).optional(),
  accentColor: z.string().max(9).optional(),
  watermarkText: z.string().max(40).optional(),
  headerNote: z.string().max(500).optional(),
  terms: z.string().max(4000).optional(),
  paymentInstructions: z.string().max(1000).optional(),
  footerNote: z.string().max(300).optional(),
  showLogo: z.boolean().optional(),
  showSeal: z.boolean().optional(),
  showSignature: z.boolean().optional(),
  showQr: z.boolean().optional(),
  showBarcode: z.boolean().optional(),
  rtl: z.boolean().optional(),
  customFields: z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })).max(12).optional(),
}).strict()

const create = z.object({ action: z.literal('create'), key: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/), nameEn: z.string().min(1).max(80), nameFa: z.string().min(1).max(80), docType: z.string().max(40).optional(), config: configSchema.default({}) })
const update = z.object({ action: z.literal('update'), id: z.number().int(), nameEn: z.string().max(80).optional(), nameFa: z.string().max(80).optional(), docType: z.string().max(40).nullable().optional(), config: configSchema.optional(), active: z.boolean().optional() })
const remove = z.object({ action: z.literal('delete'), id: z.number().int() })
const body = z.discriminatedUnion('action', [create, update, remove])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'create') {
      const dup = await pgQuery(`SELECT 1 FROM doc_templates WHERE key=$1`, [d.key])
      if (dup.length) return NextResponse.json({ error: 'Key already exists' }, { status: 409 })
      const row = (await pgQuery<{ id: number }>(
        `INSERT INTO doc_templates (key, name_en, name_fa, doc_type, config, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,${NOW},${NOW}) RETURNING id`,
        [d.key, d.nameEn, d.nameFa, d.docType ?? null, JSON.stringify(d.config), auth.user.id]))[0]
      await logAction(auth.user, 'doc.template.create', 'doc_templates', String(row.id), { key: d.key })
      return NextResponse.json({ id: row.id })
    }
    if (d.action === 'update') {
      await pgQuery(
        `UPDATE doc_templates SET name_en=COALESCE($2,name_en), name_fa=COALESCE($3,name_fa),
           doc_type=COALESCE($4,doc_type), config=COALESCE($5,config), active=COALESCE($6,active), updated_at=${NOW} WHERE id=$1`,
        [d.id, d.nameEn ?? null, d.nameFa ?? null, d.docType ?? null, d.config ? JSON.stringify(d.config) : null, d.active ?? null])
      await logAction(auth.user, 'doc.template.update', 'doc_templates', String(d.id), {})
      return NextResponse.json({ ok: true })
    }
    if (!['super_admin', 'administrator'].includes(auth.user.role)) return NextResponse.json({ error: 'Delete requires elevated rights' }, { status: 403 })
    await pgQuery(`DELETE FROM doc_templates WHERE id=$1`, [d.id])
    await logAction(auth.user, 'doc.template.delete', 'doc_templates', String(d.id), {})
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to update template') }
}
