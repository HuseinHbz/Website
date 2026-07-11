/**
 * Document Generation Engine — pure core (Phase 21 ERP, Module 8).
 *
 * One engine that turns any business record into a normalized document model and
 * renders it to print-ready HTML (the browser's "Save as PDF" produces the PDF —
 * no heavy runtime PDF dependency). Every document gets a verify code + QR so it
 * can be authenticated. Pure and side-effect-free → unit-tested; the API layer
 * loads source data + generates the QR data-URL and hands them here.
 */
import { code39Svg } from './barcode'

export const DOC_TYPES = [
  'invoice', 'quotation', 'purchase_order', 'contract', 'proposal', 'warranty',
  'delivery_note', 'service_report', 'completion_certificate', 'financial_report',
  'receipt', 'payment_voucher', 'journal_voucher',
] as const
export type GenDocType = (typeof DOC_TYPES)[number]

export interface DocLine { description: string; qty: number; unitPrice: number; lineTotal: number }
export interface DocMeta { label: string; value: string }
export interface DocPayload {
  lines: DocLine[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  currency: string
  meta: DocMeta[]
  body?: string
}

/** Company identity/branding printed on documents (loaded from site_settings). */
export interface DocBranding {
  logoUrl?: string
  sealUrl?: string
  signatureUrl?: string
  signatureTitle?: string
  regNo?: string
  nationalId?: string
  economicCode?: string
  taxNo?: string
  vatNo?: string
  iban?: string
  bankName?: string
  swift?: string
  address?: string
  postalCode?: string
  phone?: string
  email?: string
  website?: string
  ceoName?: string
}

/** Designer-controlled presentation config (persisted per template). */
export interface DocTemplateConfig {
  variant?: string             // official | unofficial | tax | retail | service | ...
  accentColor?: string         // sanitized hex
  watermarkText?: string
  headerNote?: string
  terms?: string
  paymentInstructions?: string
  footerNote?: string
  showLogo?: boolean
  showSeal?: boolean
  showSignature?: boolean
  showQr?: boolean
  /** Code 39 barcode of the document number (opt-in). */
  showBarcode?: boolean
  customFields?: { label: string; value: string }[]
}

export interface DocModel {
  type: GenDocType
  number: string
  date: string
  title: string
  partyName: string
  partyInfo?: string
  issuerName: string
  issuerInfo?: string
  payload: DocPayload
  verifyCode: string
  verifyUrl: string
  branding?: DocBranding
  template?: DocTemplateConfig
}

/** Only accept a safe hex accent (guards inline CSS injection). */
export function safeAccent(c: string | undefined, fallback = '#4f46e5'): string {
  return c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fallback
}

/** Escape text for safe HTML interpolation. */
export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
/** Currency formatting standard (26.7): Rial/Toman suffix, $/€ prefix, no decimals for IRR/IRT. */
export function money(n: number, currency = 'IRR'): string {
  const zero = currency === 'IRR' || currency === 'IRT'
  const num = (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: zero ? 0 : 2, maximumFractionDigits: zero ? 0 : 2 })
  if (currency === 'USD') return `$${num}`
  if (currency === 'EUR') return `€${num}`
  if (currency === 'IRR') return `${num} ریال`
  if (currency === 'IRT') return `${num} تومان`
  return `${num} ${currency}`
}

interface SalesLine { description: string; qty: number; unitPrice: number; discountPct: number; taxPct: number }
/** Build a document payload from a sales document's lines (invoice/quote/order). */
export function buildSalesPayload(lines: SalesLine[], currency = 'IRR', meta: DocMeta[] = []): DocPayload {
  let subtotal = 0, discountTotal = 0, taxTotal = 0, total = 0
  const out: DocLine[] = lines.map(l => {
    const gross = round2(l.qty * l.unitPrice)
    const disc = round2(gross * Math.min(100, Math.max(0, l.discountPct)) / 100)
    const net = round2(gross - disc)
    const tax = round2(net * Math.min(100, Math.max(0, l.taxPct)) / 100)
    const lt = round2(net + tax)
    subtotal += gross; discountTotal += disc; taxTotal += tax; total += lt
    return { description: l.description, qty: l.qty, unitPrice: l.unitPrice, lineTotal: lt }
  })
  return { lines: out, subtotal: round2(subtotal), discountTotal: round2(discountTotal), taxTotal: round2(taxTotal), total: round2(total), currency, meta }
}

const TITLES: Record<GenDocType, string> = {
  invoice: 'INVOICE', quotation: 'QUOTATION', purchase_order: 'PURCHASE ORDER', contract: 'CONTRACT',
  proposal: 'PROPOSAL', warranty: 'WARRANTY CERTIFICATE', delivery_note: 'DELIVERY NOTE',
  service_report: 'SERVICE REPORT', completion_certificate: 'CERTIFICATE OF COMPLETION', financial_report: 'FINANCIAL REPORT',
  receipt: 'RECEIPT', payment_voucher: 'PAYMENT VOUCHER', journal_voucher: 'JOURNAL VOUCHER',
}
export function defaultTitle(type: GenDocType): string { return TITLES[type] ?? 'DOCUMENT' }

/**
 * Render a document model to a complete, self-contained, print-ready HTML page.
 * `qrDataUrl` is a data: URI for the verification QR (generated by the caller).
 */
export function renderDocumentHtml(m: DocModel, qrDataUrl: string): string {
  const p = m.payload
  const b = m.branding ?? {}
  const t = m.template ?? {}
  const accent = safeAccent(t.accentColor)
  const show = (v: boolean | undefined) => v !== false
  const idLine = (label: string, v?: string) => (v ? `<div>${escapeHtml(label)}: ${escapeHtml(v)}</div>` : '')
  const identity = [
    idLine('Reg. no', b.regNo), idLine('National ID', b.nationalId), idLine('Economic code', b.economicCode),
    idLine('Tax no', b.taxNo), idLine('VAT no', b.vatNo),
  ].join('')
  const contactBits = [b.phone, b.email, b.website, b.address, b.postalCode ? `Postal ${b.postalCode}` : '']
    .filter(Boolean).map(x => escapeHtml(String(x))).join(' · ')
  const bankBits = [b.bankName, b.iban ? `IBAN ${b.iban}` : '', b.swift ? `SWIFT ${b.swift}` : '']
    .filter(Boolean).map(x => escapeHtml(String(x))).join(' · ')
  const customRows = (t.customFields ?? [])
    .map(f => `<div class="meta-row"><span>${escapeHtml(f.label)}</span><strong>${escapeHtml(f.value)}</strong></div>`).join('')
  const hasLines = p.lines.length > 0
  const rows = p.lines.map(l => `
      <tr>
        <td>${escapeHtml(l.description)}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${money(l.unitPrice, p.currency)}</td>
        <td class="num">${money(l.lineTotal, p.currency)}</td>
      </tr>`).join('')
  const metaRows = p.meta.map(x => `<div class="meta-row"><span>${escapeHtml(x.label)}</span><strong>${escapeHtml(x.value)}</strong></div>`).join('')
  const totals = hasLines ? `
    <table class="totals">
      <tr><td>Subtotal</td><td class="num">${money(p.subtotal, p.currency)}</td></tr>
      ${p.discountTotal ? `<tr><td>Discount</td><td class="num">-${money(p.discountTotal, p.currency)}</td></tr>` : ''}
      ${p.taxTotal ? `<tr><td>Tax</td><td class="num">${money(p.taxTotal, p.currency)}</td></tr>` : ''}
      <tr class="grand"><td>Total</td><td class="num">${money(p.total, p.currency)}</td></tr>
    </table>` : ''

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(m.title)} ${escapeHtml(m.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 32px; background: #fff; }
  .doc { max-width: 800px; margin: 0 auto; position: relative; }
  .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
  .watermark span { font-size: 90px; font-weight: 800; letter-spacing: 8px; color: rgba(30,30,60,.06); transform: rotate(-28deg); text-transform: uppercase; white-space: nowrap; }
  .logo { max-height: 56px; max-width: 200px; margin-bottom: 8px; display: block; }
  .identity { font-size: 11px; color: #777; margin-top: 6px; line-height: 1.6; }
  .seal-sign { display: flex; gap: 24px; align-items: flex-end; }
  .seal { max-height: 90px; opacity: .9; }
  .sig-img { max-height: 60px; display: block; margin: 0 auto 4px; }
  .terms { font-size: 11px; color: #666; line-height: 1.7; margin-top: 20px; padding-top: 12px; border-top: 1px dashed #ddd; white-space: pre-line; }
  .footnote { font-size: 10px; color: #999; margin-top: 10px; text-align: center; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${accent}; padding-bottom: 18px; margin-bottom: 24px; }
  .head h1 { font-size: 28px; letter-spacing: 2px; margin: 0 0 4px; color: ${accent}; }
  .issuer { font-size: 13px; color: #555; }
  .num-block { text-align: right; font-size: 13px; }
  .num-block .n { font-size: 15px; font-weight: 700; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
  .party { flex: 1; }
  .party .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
  .party .name { font-size: 15px; font-weight: 600; }
  .party .info { font-size: 12px; color: #666; white-space: pre-line; }
  table.items { width: 100%; border-collapse: collapse; margin: 16px 0; }
  table.items th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #888; border-bottom: 2px solid #e5e5ef; padding: 8px 6px; }
  table.items td { padding: 9px 6px; border-bottom: 1px solid #eee; font-size: 13px; }
  .num { text-align: right; }
  table.totals { margin-left: auto; margin-top: 12px; border-collapse: collapse; min-width: 260px; }
  table.totals td { padding: 6px 10px; font-size: 13px; }
  table.totals tr.grand td { font-size: 16px; font-weight: 700; border-top: 2px solid ${accent}; color: ${accent}; }
  .meta { margin: 16px 0; }
  .meta-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px dashed #eee; }
  .body { font-size: 13px; line-height: 1.7; color: #333; white-space: pre-line; margin: 16px 0; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; }
  .verify { font-size: 11px; color: #888; }
  .verify img { width: 84px; height: 84px; }
  .sign { text-align: center; font-size: 12px; color: #666; }
  .sign .line { width: 180px; border-top: 1px solid #999; margin-bottom: 6px; padding-top: 40px; }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #4f46e5; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 0; } }
</style></head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  ${t.watermarkText ? `<div class="watermark"><span>${escapeHtml(t.watermarkText)}</span></div>` : ''}
  <div class="doc">
    <div class="head">
      <div>
        ${show(t.showLogo) && b.logoUrl ? `<img class="logo" src="${escapeHtml(b.logoUrl)}" alt="logo">` : ''}
        <h1>${escapeHtml(m.title)}</h1>
        <div class="issuer">${escapeHtml(m.issuerName)}${m.issuerInfo ? `<br>${escapeHtml(m.issuerInfo)}` : ''}</div>
        ${identity ? `<div class="identity">${identity}</div>` : ''}
      </div>
      <div class="num-block"><div class="n">${escapeHtml(m.number)}</div><div>${escapeHtml(m.date)}</div>${t.variant ? `<div>${escapeHtml(t.variant)}</div>` : ''}${t.showBarcode === true ? (code39Svg(m.number, { moduleWidth: 1, height: 34 }) ?? '') : ''}</div>
    </div>
    ${t.headerNote ? `<div class="body">${escapeHtml(t.headerNote)}</div>` : ''}
    <div class="parties">
      <div class="party"><div class="label">To</div><div class="name">${escapeHtml(m.partyName)}</div>${m.partyInfo ? `<div class="info">${escapeHtml(m.partyInfo)}</div>` : ''}</div>
    </div>
    ${metaRows || customRows ? `<div class="meta">${metaRows}${customRows}</div>` : ''}
    ${p.body ? `<div class="body">${escapeHtml(p.body)}</div>` : ''}
    ${hasLines ? `<table class="items"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
    ${totals}
    ${t.paymentInstructions ? `<div class="terms"><strong>Payment</strong><br>${escapeHtml(t.paymentInstructions)}</div>` : ''}
    ${t.terms ? `<div class="terms"><strong>Terms &amp; Conditions</strong><br>${escapeHtml(t.terms)}</div>` : ''}
    <div class="foot">
      ${show(t.showQr) ? `<div class="verify"><img src="${qrDataUrl}" alt="verify"><br>Verify: ${escapeHtml(m.verifyCode)}<br>${escapeHtml(m.verifyUrl)}</div>` : '<div></div>'}
      <div class="seal-sign">
        ${show(t.showSeal) && b.sealUrl ? `<img class="seal" src="${escapeHtml(b.sealUrl)}" alt="seal">` : ''}
        <div class="sign">
          ${show(t.showSignature) && b.signatureUrl ? `<img class="sig-img" src="${escapeHtml(b.signatureUrl)}" alt="signature"><div style="border-top:1px solid #999;width:180px;padding-top:6px">${escapeHtml(b.signatureTitle || b.ceoName || 'Authorized signature')}</div>` : `<div class="line"></div>${escapeHtml(b.signatureTitle || b.ceoName || 'Authorized signature')}`}
        </div>
      </div>
    </div>
    ${bankBits ? `<div class="footnote">${bankBits}</div>` : ''}
    ${contactBits ? `<div class="footnote">${contactBits}</div>` : ''}
    ${t.footerNote ? `<div class="footnote">${escapeHtml(t.footerNote)}</div>` : ''}
  </div>
</body></html>`
}
