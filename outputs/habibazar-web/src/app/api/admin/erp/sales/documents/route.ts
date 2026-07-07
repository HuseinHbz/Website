import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { logAction } from '@/lib/admin/audit'
import { DOC_TYPES, documentTotals, lineTotals } from '@/lib/erp/sales'
import { nextNumber } from '@/lib/numbering/integrate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const PREFIX: Record<string, string> = { quote: 'QT', order: 'SO', invoice: 'INV', credit_note: 'CN' }

// GET — list documents of a type (?type=), or one document with its lines (?id=).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (id) {
      const doc = (await pgQuery(
        `SELECT d.id, d.doc_type AS "docType", d.doc_no AS "docNo", d.customer_id AS "customerId", d.date, d.due_date AS "dueDate",
                d.status, d.subtotal::float AS subtotal, d.discount_total::float AS "discountTotal", d.tax_total::float AS "taxTotal",
                d.total::float AS total, d.notes, c.name AS "customerName"
         FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id WHERE d.id=$1`, [id]))[0]
      if (!doc) return badRequest('Not found')
      const lines = await pgQuery(
        `SELECT id, description, qty::float AS qty, unit_price::float AS "unitPrice", discount_pct::float AS "discountPct", tax_pct::float AS "taxPct", line_total::float AS "lineTotal"
         FROM sales_document_lines WHERE document_id=$1 ORDER BY line_no, id`, [id])
      const paid = (await pgQuery(`SELECT COALESCE(SUM(amount),0)::float AS paid FROM sales_payments WHERE document_id=$1`, [id]))[0] as { paid: number }
      return NextResponse.json({ doc, lines, paid: paid.paid })
    }
    const type = req.nextUrl.searchParams.get('type')
    const rows = await pgQuery(
      `SELECT d.id, d.doc_type AS "docType", d.doc_no AS "docNo", d.date, d.due_date AS "dueDate", d.status,
              d.total::float AS total, c.name AS "customerName",
              COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.document_id=d.id),0)::float AS paid
       FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id
       ${type ? 'WHERE d.doc_type=$1' : ''}
       ORDER BY d.date DESC, d.id DESC LIMIT 300`, type ? [type] : [])
    return NextResponse.json({ documents: rows })
  } catch (e) { return apiError(e, 'Failed to load documents') }
}

const createSchema = z.object({
  id: z.number().int().positive().optional(),
  docType: z.enum(DOC_TYPES),
  customerId: z.number().int().positive(),
  date: z.string().min(1).max(30),
  dueDate: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  sourceId: z.number().int().positive().optional(),
  lines: z.array(z.object({
    description: z.string().min(1).max(300),
    qty: z.number().positive(),
    unitPrice: z.number().min(0),
    discountPct: z.number().min(0).max(100).default(0),
    taxPct: z.number().min(0).max(100).default(0),
  })).min(1).max(200),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, createSchema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  const totals = documentTotals(d.lines)
  try {
    let docId = d.id
    if (docId) {
      const cur = (await pgQuery(`SELECT status FROM sales_documents WHERE id=$1`, [docId]))[0] as { status: string } | undefined
      if (!cur) return badRequest('Not found')
      if (cur.status !== 'draft') return badRequest('Only draft documents can be edited')
      await pgQuery(
        `UPDATE sales_documents SET customer_id=$2, date=$3, due_date=$4, notes=$5, subtotal=$6, discount_total=$7, tax_total=$8, total=$9, updated_at=${NOW} WHERE id=$1`,
        [docId, d.customerId, d.date, d.dueDate ?? null, d.notes ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total])
      await pgQuery(`DELETE FROM sales_document_lines WHERE document_id=$1`, [docId])
    } else {
      const docNo = await nextNumber(d.docType, { module: 'sales', userId: auth.user.id, legacyPrefix: PREFIX[d.docType] })
      const row = (await pgQuery(
        `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, due_date, status, subtotal, discount_total, tax_total, total, source_id, notes, created_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11,$12,${NOW}) RETURNING id`,
        [d.docType, docNo, d.customerId, d.date, d.dueDate ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total, d.sourceId ?? null, d.notes ?? null, auth.user.id]))[0] as { id: number }
      docId = row.id
    }
    for (let i = 0; i < d.lines.length; i++) {
      const l = d.lines[i]
      await pgQuery(`INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [docId, l.description, l.qty, l.unitPrice, l.discountPct, l.taxPct, lineTotals(l).total, i])
    }
    await logAction(auth.user, d.id ? 'sales.doc.update' : 'sales.doc.create', 'sales_document', docId!, null, { docType: d.docType, total: totals.total })
    return NextResponse.json({ id: docId, total: totals.total })
  } catch (e) { return apiError(e, 'Failed to save document') }
}

const opSchema = z.object({ id: z.number().int().positive(), op: z.enum(['send', 'confirm', 'void', 'convert']), toType: z.enum(DOC_TYPES).optional() })

// PUT — lifecycle: send/confirm/void, or convert a quote→order or order→invoice
// (copies the lines into a new draft document that references the source).
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, opSchema)
  if ('error' in parsed) return parsed.error
  const { id, op, toType } = parsed.data
  try {
    const src = (await pgQuery(`SELECT * FROM sales_documents WHERE id=$1`, [id]))[0] as Record<string, unknown> | undefined
    if (!src) return badRequest('Not found')
    if (op === 'convert') {
      if (!toType) return badRequest('toType required')
      const docNo = await nextNumber(toType, { module: 'sales', userId: auth.user.id, legacyPrefix: PREFIX[toType] })
      const newDoc = (await pgQuery(
        `INSERT INTO sales_documents (doc_type, doc_no, customer_id, date, due_date, status, subtotal, discount_total, tax_total, total, source_id, notes, created_by, updated_at)
         VALUES ($1,$2,$3,to_char(now(),'YYYY-MM-DD'),$4,'draft',$5,$6,$7,$8,$9,$10,$11,${NOW}) RETURNING id`,
        [toType, docNo, src.customer_id, src.due_date ?? null, src.subtotal, src.discount_total, src.tax_total, src.total, id, src.notes ?? null, auth.user.id]))[0] as { id: number }
      await pgQuery(
        `INSERT INTO sales_document_lines (document_id, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no)
         SELECT $1, description, qty, unit_price, discount_pct, tax_pct, line_total, line_no FROM sales_document_lines WHERE document_id=$2`,
        [newDoc.id, id])
      await pgQuery(`UPDATE sales_documents SET status='confirmed', updated_at=${NOW} WHERE id=$1`, [id])
      await logAction(auth.user, 'sales.doc.convert', 'sales_document', id, null, { toType, newId: newDoc.id })
      return NextResponse.json({ id: newDoc.id, docNo })
    }
    const status = op === 'send' ? 'sent' : op === 'confirm' ? 'confirmed' : 'void'
    await pgQuery(`UPDATE sales_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, status])
    await logAction(auth.user, `sales.doc.${op}`, 'sales_document', id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Operation failed') }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin('delete')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, z.object({ id: z.number().int().positive() }))
  if ('error' in parsed) return parsed.error
  try {
    const paid = (await pgQuery(`SELECT 1 FROM sales_payments WHERE document_id=$1 LIMIT 1`, [parsed.data.id]))[0]
    if (paid) return badRequest('Document has payments; void it instead')
    await pgQuery(`DELETE FROM sales_documents WHERE id=$1`, [parsed.data.id])
    await logAction(auth.user, 'sales.doc.delete', 'sales_document', parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to delete document') }
}
