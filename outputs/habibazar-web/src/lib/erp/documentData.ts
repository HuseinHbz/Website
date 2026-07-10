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
import { nextNumber } from '@/lib/numbering/integrate'
import {
  buildSalesPayload, renderDocumentHtml, defaultTitle,
  type DocPayload, type DocModel, type GenDocType, type DocMeta, type DocBranding, type DocTemplateConfig,
} from './documents'

/** site_settings key → DocBranding field (Phase 26 Company Profile). */
const COMPANY_KEYS: Record<string, keyof DocBranding> = {
  company_logo_url: 'logoUrl', company_seal_url: 'sealUrl', company_signature_url: 'signatureUrl',
  company_signature_title: 'signatureTitle', company_reg_no: 'regNo', company_national_id: 'nationalId',
  company_economic_code: 'economicCode', company_tax_no: 'taxNo', company_vat_no: 'vatNo',
  company_iban: 'iban', company_bank_name: 'bankName', company_swift: 'swift',
  company_address: 'address', company_postal_code: 'postalCode', company_phone: 'phone',
  company_email: 'email', company_website: 'website',
}

/** Load the company profile (branding block) from site_settings. Never throws. */
export async function loadCompanyProfile(): Promise<{ branding: DocBranding; companyName: string | null }> {
  try {
    const keys = [...Object.keys(COMPANY_KEYS), 'company_name', 'company_commercial_name']
    const rows = await pgQuery<{ key: string; value: string }>(
      `SELECT key, value FROM site_settings WHERE key = ANY($1)`, [keys])
    const map = new Map(rows.map(r => [r.key, r.value]))
    const branding: DocBranding = {}
    for (const [key, field] of Object.entries(COMPANY_KEYS)) {
      const v = map.get(key)
      if (v?.trim()) branding[field] = v.trim()
    }
    const companyName = map.get('company_commercial_name')?.trim() || map.get('company_name')?.trim() || null
    return { branding, companyName }
  } catch { return { branding: {}, companyName: null } }
}

/** Load a designer template's config by key (null when missing/inactive). */
export async function loadTemplateConfig(key: string): Promise<DocTemplateConfig | null> {
  try {
    const r = (await pgQuery<{ config: string }>(
      `SELECT config FROM doc_templates WHERE key=$1 AND active=true`, [key]))[0]
    return r ? JSON.parse(r.config) as DocTemplateConfig : null
  } catch { return null }
}

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
  /** Designer template applied at render time. */
  templateKey?: string
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
      `SELECT d.doc_no AS "docNo", d.date, c.name AS "customerName", c.address, c.email, c.phone,
              c.kind, c.national_id AS "nationalId", c.reg_no AS "regNo", c.economic_code AS "economicCode", c.tax_id AS "taxId"
       FROM sales_documents d JOIN sales_customers c ON c.id=d.customer_id WHERE d.id=$1`, [input.sourceId]))[0] as
      { docNo: string; date: string; customerName: string; address: string | null; email: string | null; phone: string | null;
        kind: string | null; nationalId: string | null; regNo: string | null; economicCode: string | null; taxId: string | null } | undefined
    if (!doc) throw new Error('Source sales document not found')
    const lines = (await pgQuery(
      `SELECT description, qty::float AS qty, unit_price::float AS "unitPrice", discount_pct::float AS "discountPct", tax_pct::float AS "taxPct"
       FROM sales_document_lines WHERE document_id=$1 ORDER BY line_no, id`, [input.sourceId])) as
      { description: string; qty: number; unitPrice: number; discountPct: number; taxPct: number }[]
    partyName = doc.customerName
    // Legal identity (Phase 26.2): حقیقی (individual) → national ID; حقوقی
    // (company) → registration/national-ID/economic code, as Iranian tax
    // invoices require the buyer's identifiers on the document.
    const legal = doc.kind === 'individual'
      ? [doc.nationalId ? `National ID: ${doc.nationalId}` : '']
      : [doc.regNo ? `Reg. no: ${doc.regNo}` : '', doc.nationalId ? `National ID: ${doc.nationalId}` : '',
         doc.economicCode ? `Economic code: ${doc.economicCode}` : '', doc.taxId ? `Tax no: ${doc.taxId}` : '']
    partyInfo = [...legal, doc.address, doc.email, doc.phone].filter(Boolean).join('\n')
    payload = buildSalesPayload(lines, input.currency ?? 'USD', [{ label: 'Reference', value: doc.docNo }])
  } else {
    // Manual composition.
    const lines = (input.lines ?? []).map(l => ({ description: l.description, qty: l.qty, unitPrice: l.unitPrice, lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100 }))
    const total = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100
    payload = { lines, subtotal: total, discountTotal: 0, taxTotal: 0, total, currency: input.currency ?? 'USD', meta: input.meta ?? [], body: input.body }
    sourceType = null; sourceId = null
  }

  const number = await nextNumber(`doc_${input.type}`, { module: 'documents', userId, legacyPrefix: PREFIX[input.type] })
  const verifyCode = randomBytes(6).toString('hex').toUpperCase()
  const title = input.title || defaultTitle(input.type)
  const date = input.date || new Date().toISOString().slice(0, 10)

  const row = (await pgQuery(
    `INSERT INTO gen_documents (type, number, title, party_name, party_info, date, payload, source_type, source_id, verify_code, created_by, template_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [input.type, number, title, partyName, partyInfo, date, JSON.stringify(payload), sourceType, sourceId, verifyCode, userId, input.templateKey ?? null]))[0] as { id: number }
  return { id: row.id, number }
}

interface DocRow { id: number; type: GenDocType; number: string; title: string; partyName: string | null; partyInfo: string | null; date: string; payload: string; verifyCode: string; status: string; templateKey: string | null }

export async function loadDocumentRow(id: number): Promise<DocRow | null> {
  const r = (await pgQuery(
    `SELECT id, type, number, title, party_name AS "partyName", party_info AS "partyInfo", date, payload, verify_code AS "verifyCode", status, template_key AS "templateKey"
     FROM gen_documents WHERE id=$1`, [id]))[0] as unknown as DocRow | undefined
  return r ?? null
}

/** Render a stored document to print-ready HTML (with its verification QR).
 * Company branding is applied automatically; a designer template (stored on the
 * document, or passed explicitly) layers watermark/terms/toggles on top. */
export async function renderDocument(id: number, templateKey?: string): Promise<string | null> {
  const row = await loadDocumentRow(id)
  if (!row) return null
  const payload = JSON.parse(row.payload) as DocPayload
  const verifyUrl = `${SITE.url}/verify/${row.verifyCode}`
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 168 })
  const { branding, companyName } = await loadCompanyProfile()
  const tplKey = templateKey ?? row.templateKey ?? null
  const template = tplKey ? await loadTemplateConfig(tplKey) : null
  const model: DocModel = {
    type: row.type, number: row.number, date: row.date, title: row.title,
    partyName: row.partyName ?? '', partyInfo: row.partyInfo ?? undefined,
    issuerName: companyName ?? SITE.name ?? 'HBZ Technology', issuerInfo: SITE.url,
    payload, verifyCode: row.verifyCode, verifyUrl,
    branding, template: template ?? undefined,
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
