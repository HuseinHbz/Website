/**
 * Document Generation Engine — server layer. Creates catalogued documents from a
 * live source (a sales invoice/quotation) or a manual composition, loads them,
 * verifies by code, and renders the print-ready HTML (with a QR data-URL). Uses
 * the pure engine (lib/erp/documents.ts) for all shaping/rendering.
 */
import { randomBytes } from 'crypto'
import QRCode from 'qrcode'
import { pgQuery } from '@/lib/db'
import { SITE } from '@/lib/site'
import {
  buildSalesPayload, renderDocumentHtml, defaultTitle,
  type DocPayload, type DocModel, type GenDocType, type DocMeta,
} from './documents'

const PREFIX: Record<string, string> = {
  invoice: 'INV', quotation: 'QT', purchase_order: 'PO', contract: 'CT', proposal: 'PR',
  warranty: 'WR', delivery_note: 'DN', service_report: 'SR', completion_certificate: 'CC', financial_report: 'FR',
}

export interface CreateManualLine { description: string; qty: number; unitPrice: number }
export interface CreateInput {
  type: GenDocType
  sourceType?: 'sales'
  sourceId?: number
  // manual composition (used when no source)
  title?: string
  partyName?: string
  partyInfo?: string
  date?: string
  currency?: string
  body?: string
  lines?: CreateManualLine[]
  meta?: DocMeta[]
}

/** Create a document, pulling from a sales source when given, else manual. */
export async function createDocument(input: CreateInput, userId: string): Promise<{ id: number; number: string }> {
  let payload: DocPayload
  let partyName = input.partyName ?? ''
  let partyInfo = input.partyInfo ?? ''
  let sourceType: string | null = input.sourceType ?? null
  let sourceId: number | null = input.sourceId ?? null

  if (input.sourceType === 'sales' && input.sourceId) {
    const doc = (await pgQuery(
      `SELECT d.doc_no AS "docNo", d.date, c.name AS "customerName", c.address, c.email, c.phone
       FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id WHERE d.id=$1`, [input.sourceId]))[0] as
      { docNo: string; date: string; customerName: string; address: string | null; email: string | null; phone: string | null } | undefined
    if (!doc) throw new Error('Source sales document not found')
    const lines = (await pgQuery(
      `SELECT description, qty::float AS qty, unit_price::float AS "unitPrice", discount_pct::float AS "discountPct", tax_pct::float AS "taxPct"
       FROM sales_document_lines WHERE document_id=$1 ORDER BY line_no, id`, [input.sourceId])) as
      { description: string; qty: number; unitPrice: number; discountPct: number; taxPct: number }[]
    partyName = doc.customerName
    partyInfo = [doc.address, doc.email, doc.phone].filter(Boolean).join('\n')
    payload = buildSalesPayload(lines, input.currency ?? 'USD', [{ label: 'Reference', value: doc.docNo }])
  } else {
    // Manual composition.
    const lines = (input.lines ?? []).map(l => ({ description: l.description, qty: l.qty, unitPrice: l.unitPrice, lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100 }))
    const total = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100
    payload = { lines, subtotal: total, discountTotal: 0, taxTotal: 0, total, currency: input.currency ?? 'USD', meta: input.meta ?? [], body: input.body }
    sourceType = null; sourceId = null
  }

  const number = `${PREFIX[input.type] ?? 'DOC'}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
  const verifyCode = randomBytes(6).toString('hex').toUpperCase()
  const title = input.title || defaultTitle(input.type)
  const date = input.date || new Date().toISOString().slice(0, 10)

  const row = (await pgQuery(
    `INSERT INTO gen_documents (type, number, title, party_name, party_info, date, payload, source_type, source_id, verify_code, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [input.type, number, title, partyName, partyInfo, date, JSON.stringify(payload), sourceType, sourceId, verifyCode, userId]))[0] as { id: number }
  return { id: row.id, number }
}

interface DocRow { id: number; type: GenDocType; number: string; title: string; partyName: string | null; partyInfo: string | null; date: string; payload: string; verifyCode: string; status: string }

export async function loadDocumentRow(id: number): Promise<DocRow | null> {
  const r = (await pgQuery(
    `SELECT id, type, number, title, party_name AS "partyName", party_info AS "partyInfo", date, payload, verify_code AS "verifyCode", status
     FROM gen_documents WHERE id=$1`, [id]))[0] as unknown as DocRow | undefined
  return r ?? null
}

/** Render a stored document to print-ready HTML (with its verification QR). */
export async function renderDocument(id: number): Promise<string | null> {
  const row = await loadDocumentRow(id)
  if (!row) return null
  const payload = JSON.parse(row.payload) as DocPayload
  const verifyUrl = `${SITE.url}/verify/${row.verifyCode}`
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 168 })
  const model: DocModel = {
    type: row.type, number: row.number, date: row.date, title: row.title,
    partyName: row.partyName ?? '', partyInfo: row.partyInfo ?? undefined,
    issuerName: SITE.name ?? 'HBZ Technology', issuerInfo: SITE.url,
    payload, verifyCode: row.verifyCode, verifyUrl,
  }
  return renderDocumentHtml(model, qr)
}

/** Public verification: does a document with this code exist and is it issued? */
export async function verifyDocument(code: string): Promise<{ valid: boolean; number?: string; type?: string; date?: string; title?: string }> {
  const r = (await pgQuery(`SELECT number, type, date, title, status FROM gen_documents WHERE verify_code=$1`, [code.toUpperCase()]))[0] as
    { number: string; type: string; date: string; title: string; status: string } | undefined
  if (!r || r.status !== 'issued') return { valid: false }
  return { valid: true, number: r.number, type: r.type, date: r.date, title: r.title }
}
