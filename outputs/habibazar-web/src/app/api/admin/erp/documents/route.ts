import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { DOC_TYPES } from '@/lib/erp/documents'
import { createDocument } from '@/lib/erp/documentData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — the generated-document catalog (optionally filtered by type).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const type = req.nextUrl.searchParams.get('type')
    const rows = await pgQuery(
      `SELECT id, type, number, title, party_name AS "partyName", date, verify_code AS "verifyCode", status, created_at AS "createdAt"
       FROM gen_documents ${type ? 'WHERE type=$1' : ''} ORDER BY created_at DESC LIMIT 200`, type ? [type] : [])
    return NextResponse.json({ documents: rows })
  } catch (e) { return apiError(e, 'Failed to load documents') }
}

const schema = z.object({
  type: z.enum(DOC_TYPES),
  sourceType: z.literal('sales').optional(),
  sourceId: z.number().int().positive().optional(),
  title: z.string().max(200).optional(),
  partyName: z.string().max(200).optional(),
  partyInfo: z.string().max(600).optional(),
  date: z.string().max(30).optional(),
  currency: z.string().max(8).optional(),
  body: z.string().max(8000).optional(),
  lines: z.array(z.object({ description: z.string().min(1).max(300), qty: z.number(), unitPrice: z.number() })).max(200).optional(),
  meta: z.array(z.object({ label: z.string().max(80), value: z.string().max(200) })).max(20).optional(),
  templateKey: z.string().max(60).optional(),
})

// POST — generate a document (from a sales source or a manual composition).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  try {
    const r = await createDocument(parsed.data, auth.user.id)
    await logAction(auth.user, 'doc.generate', 'gen_document', r.id, null, { type: parsed.data.type, number: r.number })
    return NextResponse.json(r)
  } catch (e) { return apiError(e, 'Failed to generate document') }
}

// PUT — void a document.
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    await pgQuery(`UPDATE gen_documents SET status='void' WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'doc.void', 'gen_document', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to void document') }
}
