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
import { sanitizeRichHtml } from './richtext'
import { toJalaliStr } from './jalali'
import { faDigits } from '@/lib/admin/chartRtl'

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
  /** Rich HTML body (contracts) — sanitized at render time; wins over `body`. */
  bodyHtml?: string
}

/** Company identity/branding printed on documents (loaded from site_settings). */
export interface DocBranding {
  logoUrl?: string
  /** Full-width uploaded letterhead banner printed at the top of the page. */
  letterheadUrl?: string
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
  /** Render right-to-left with Persian labels (Iranian invoice templates). */
  rtl?: boolean
  customFields?: { label: string; value: string }[]
}

export interface DocModel {
  type: GenDocType
  number: string
  date: string
  /** Optional payment/validity due date (ISO or pre-formatted) — printed next
   *  to the issue date when present. Every document type may carry one
   *  (an invoice's payment due date, a quotation's validity deadline, …). */
  dueDate?: string
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

/** Legal identity kind (Phase 26.2 concept, reused here) — حقیقی (individual,
 *  only a national ID) vs حقوقی (legal entity: registration/national/
 *  economic/tax IDs). One function builds the printed lines either way, so
 *  a sales-sourced document (documentData.ts) and a manually-composed one
 *  (DocumentCenter's Document tab) never diverge in format. */
export interface PartyLegalIds { kind: 'individual' | 'company'; nationalId?: string; regNo?: string; economicCode?: string; taxId?: string }
export function buildLegalIdentityLines(ids: PartyLegalIds, rtl: boolean): string[] {
  const L = rtl
    ? { nid: 'شناسه ملی', reg: 'شماره ثبت', eco: 'کد اقتصادی', tax: 'شماره مالیاتی' }
    : { nid: 'National ID', reg: 'Reg. no', eco: 'Economic code', tax: 'Tax no' }
  if (ids.kind === 'individual') {
    return ids.nationalId ? [`${L.nid}: ${ids.nationalId}`] : []
  }
  return [
    ids.regNo ? `${L.reg}: ${ids.regNo}` : '',
    ids.nationalId ? `${L.nid}: ${ids.nationalId}` : '',
    ids.economicCode ? `${L.eco}: ${ids.economicCode}` : '',
    ids.taxId ? `${L.tax}: ${ids.taxId}` : '',
  ].filter(Boolean)
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

/** Minimal inline-SVG line icons (16–18px, currentColor stroke) — used
 *  instead of emoji glyphs in the printed document. Emoji rendering depends
 *  on the viewer's OS/browser font (confirmed to render as a blank/black
 *  box in a headless-Chromium "Save as PDF" without a color-emoji font
 *  installed) — an inline SVG path always renders identically everywhere,
 *  which matters for a real document a customer receives. */
const ICON_PATHS: Record<string, string> = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  server: 'M4 5h16v5H4V5Zm0 9h16v5H4v-5Zm3 2.5h.01M7 7.5h.01',
  bank: 'M3 10 12 4l9 6M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18',
  phone: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18Z',
  pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
}
function svgIcon(name: keyof typeof ICON_PATHS, size = 15): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="${ICON_PATHS[name]}"/></svg>`
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
// DOC-BRAND: a document generated against a Persian (rtl) template must not
// print an English title ("INVOICE") at the top of an otherwise-Persian
// page — the exact leak a real screenshot caught. Both maps are kept next
// to each other on purpose so a new GenDocType can't be added to one and
// forgotten in the other (TITLES_FA keyed off the same GenDocType union).
const TITLES_FA: Record<GenDocType, string> = {
  invoice: 'فاکتور', quotation: 'پیش‌فاکتور', purchase_order: 'سفارش خرید', contract: 'قرارداد',
  proposal: 'پیشنهاد', warranty: 'گواهی گارانتی', delivery_note: 'برگهٔ تحویل کالا',
  service_report: 'گزارش خدمات', completion_certificate: 'گواهی اتمام کار', financial_report: 'گزارش مالی',
  receipt: 'رسید', payment_voucher: 'سند پرداخت', journal_voucher: 'سند حسابداری',
}
export function defaultTitle(type: GenDocType, rtl = false): string {
  return (rtl ? TITLES_FA[type] : TITLES[type]) ?? (rtl ? 'سند' : 'DOCUMENT')
}
// Reverse lookup so a document stored BEFORE this fix (title="INVOICE",
// saved verbatim into gen_documents.title) still prints correctly the next
// time it's rendered against an rtl template — defense in depth alongside
// fixing the write path in documentData.ts.
const EN_TO_FA_TITLE = new Map(Object.entries(TITLES).map(([type, en]) => [en, TITLES_FA[type as GenDocType]]))

/**
 * Render a document model to a complete, self-contained, print-ready HTML page.
 * `qrDataUrl` is a data: URI for the verification QR (generated by the caller).
 *
 * 2026-08: single unified HBZ letterhead design (replaces the prior 40-variant
 * Invoice Designer library at the maintainer's explicit request — "one
 * background/layout for every invoice, only the name/type changes"). The
 * data model, escaping, and every field toggle (`DocTemplateConfig`) are
 * UNCHANGED — only the visual chrome around the same data changed, so a
 * generated document's content/behavior is identical to before, just
 * restyled into the diagonal navy-header letterhead.
 */
export function renderDocumentHtml(m: DocModel, qrDataUrl: string): string {
  const p = m.payload
  const b = m.branding ?? {}
  const t = m.template ?? {}
  const accent = safeAccent(t.accentColor, '#0f2a52')
  const show = (v: boolean | undefined) => v !== false
  const rtl = t.rtl === true
  // 26.33 (fa-IR digits) + 26.24 (Jalali dates): centralized here so EVERY
  // caller of renderDocumentHtml gets a correctly localized Persian document
  // for free — a single fix here propagates everywhere instead of each call
  // site having to remember to convert. `money()` and any other numeral
  // text stays digit-for-digit correct in the money-formatting logic
  // itself; only the DIGITS are swapped to fa-IR for display when rtl.
  // The system-generated document NUMBER (e.g. INV-2026-0001) is
  // deliberately NOT touched — same convention as every other ERP document
  // number in this codebase (Latin/ASCII, never localized).
  const fmtNum = (s: string | number) => (rtl ? faDigits(s) : String(s))
  const fmtMoney = (n: number, currency: string) => fmtNum(money(n, currency))
  // A document stored before this fix (or one whose caller still passes the
  // English default) shows the Persian equivalent when rendered against an
  // rtl template — the title is display-only here, never mutates storage.
  const displayTitle = rtl ? (EN_TO_FA_TITLE.get(m.title) ?? m.title) : m.title
  const fmtDate = (iso: string) => {
    const looksIso = /^\d{4}-\d{2}-\d{2}/.test(iso)
    const display = rtl && looksIso ? toJalaliStr(iso) : iso
    return rtl ? faDigits(display) : display
  }
  const L = rtl
    ? { to: 'مشتری', subtotal: 'جمع کل (بدون مالیات)', discount: 'تخفیف', tax: 'مالیات بر ارزش افزوده', total: 'مبلغ قابل پرداخت', desc: 'شرح خدمات', row: 'ردیف', qty: 'تعداد', unit: 'قیمت واحد (ریال)', amount: 'مبلغ کل (ریال)', payment: 'اطلاعات پرداخت', terms: 'شرایط و ضوابط', paymentNote: 'دستور پرداخت', verify: 'برای استعلام فاکتور اسکن کنید', print: 'چاپ / ذخیره PDF', reg: 'شماره ثبت', nid: 'شناسه ملی', eco: 'کد اقتصادی', taxno: 'شماره مالیاتی', vat: 'شماره ارزش افزوده', bill: 'اطلاعات مشتری', project: 'اطلاعات پروژه', seller: 'اطلاعات فروشنده', company: 'نام شرکت / سازمان', bank: 'نام بانک', acc: 'شماره حساب', iban: 'شماره شبا', swift: 'کد سوییفت', signer: 'مهندس ارشد زیرساخت و شبکه', dueDate: 'تاریخ سررسید' }
    : { to: 'BILL TO', subtotal: 'SUBTOTAL', discount: 'DISCOUNT', tax: 'TAX', total: 'TOTAL AMOUNT', desc: 'DESCRIPTION', row: '#', qty: 'QTY', unit: 'UNIT PRICE', amount: 'AMOUNT', payment: 'PAYMENT INFORMATION', terms: 'TERMS &amp; CONDITIONS', paymentNote: 'PAYMENT INSTRUCTIONS', verify: 'Scan to verify this invoice', print: 'Print / Save PDF', reg: 'Reg. no', nid: 'National ID', eco: 'Economic code', taxno: 'Tax no', vat: 'VAT no', bill: 'BILL TO', project: 'PROJECT DETAILS', seller: 'SELLER INFORMATION', company: 'Company Name', bank: 'Bank Name', acc: 'Account Number', iban: 'IBAN', swift: 'SWIFT', signer: 'Senior Infrastructure &amp; Network Engineer', dueDate: 'Due Date' }
  // DOC-BRAND follow-up: the second card was ALWAYS titled "Project Details"
  // even though its actual content (the issuer's own legal identity — Reg.
  // no/National ID/Economic code — plus the doc's reference meta) is SELLER
  // information for every commercial document type. A buy/sell invoice has
  // no "project" — only contracts/proposals genuinely are project-scoped.
  const PROJECT_TYPED = new Set<GenDocType>(['contract', 'proposal'])
  const secondCardLabel = PROJECT_TYPED.has(m.type) ? L.project : L.seller
  const idLine = (label: string, v?: string) => (v ? `<div>${escapeHtml(label)}: ${escapeHtml(v)}</div>` : '')
  const identity = [
    idLine(L.reg, b.regNo), idLine(L.nid, b.nationalId), idLine(L.eco, b.economicCode),
    idLine(L.taxno, b.taxNo), idLine(L.vat, b.vatNo),
  ].join('')
  const contactBits = [b.phone, b.email, b.website, b.address, b.postalCode ? `Postal ${b.postalCode}` : '']
    .filter(Boolean).map(x => escapeHtml(String(x))).join(' · ')
  // Kept as plain "Label Value" text (not split across separate span/strong
  // elements) so a printed/copy-pasted invoice still reads "IBAN IR12..."
  // as one contiguous token — matches the pre-redesign format exactly.
  const bankRow = (label: string, v?: string) => (v ? `<div class="info-row"><strong>${escapeHtml(label)} ${escapeHtml(v)}</strong></div>` : '')
  const bankBits = [bankRow(L.bank, b.bankName), bankRow(L.iban, b.iban), bankRow(L.swift, b.swift)].join('')
  const customRows = (t.customFields ?? [])
    .map(f => `<div class="info-row"><span>${escapeHtml(f.label)}</span><strong>${escapeHtml(f.value)}</strong></div>`).join('')
  const hasLines = p.lines.length > 0
  const rows = p.lines.map((l, i) => `
      <tr>
        <td class="num rownum">${fmtNum(i + 1)}</td>
        <td>${escapeHtml(l.description)}</td>
        <td class="num">${fmtNum(l.qty)}</td>
        <td class="num">${fmtMoney(l.unitPrice, p.currency)}</td>
        <td class="num">${fmtMoney(l.lineTotal, p.currency)}</td>
      </tr>`).join('')
  const metaRows = p.meta.map(x => `<div class="info-row"><span>${escapeHtml(x.label)}</span><strong>${escapeHtml(x.value)}</strong></div>`).join('')
  const totals = hasLines ? `
    <table class="totals">
      <tr><td>${L.subtotal}</td><td class="num">${fmtMoney(p.subtotal, p.currency)}</td></tr>
      ${p.discountTotal ? `<tr><td>${L.discount}</td><td class="num">-${fmtMoney(p.discountTotal, p.currency)}</td></tr>` : ''}
      ${p.taxTotal ? `<tr><td>${L.tax}</td><td class="num">${fmtMoney(p.taxTotal, p.currency)}</td></tr>` : ''}
      <tr class="grand"><td>${L.total}</td><td class="num">${fmtMoney(p.total, p.currency)}</td></tr>
    </table>` : ''

  return `<!doctype html>
<html lang="${rtl ? 'fa' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(displayTitle)} ${escapeHtml(m.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Tahoma, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
  .page { max-width: 900px; margin: 24px auto; background: #fff; position: relative; box-shadow: 0 8px 30px rgba(15,23,42,.12); overflow: hidden; }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 5; }
  .watermark span { font-size: 90px; font-weight: 800; letter-spacing: 8px; color: rgba(15,23,42,.07); transform: rotate(-28deg); text-transform: uppercase; white-space: nowrap; }

  /* ── Diagonal letterhead header ── */
  .header { position: relative; min-height: 168px; overflow: hidden; }
  /* The diagonal navy shape + logo always sit at the physical LEFT and the
     title/meta at the physical RIGHT, in both languages (matches the
     approved mockup exactly for fa AND en) — so this is pinned to ltr and
     does NOT mirror with the page's dir, even though the rest of the
     document (info cards, tables, text alignment) correctly follows rtl. */
  .header-bg { position: absolute; inset: 0; background: linear-gradient(135deg, #060d1f 0%, ${accent} 100%); clip-path: polygon(0 0, 55% 0, 40% 100%, 0 100%); }
  .header-bg::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 30% 20%, rgba(56,189,248,.35), transparent 55%); }
  .header-inner { position: relative; display: flex; direction: ltr; justify-content: space-between; align-items: flex-start; padding: 30px 40px; z-index: 1; }
  /* An uploaded logo can be any real-world file — an opaque-background PNG/
     JPG, or a transparent-background PNG — not only a pure white silhouette.
     The old filter: brightness(0) invert(1) rule assumed the latter and forced
     EVERY logo into a flat white shape, which for anything with visible
     background pixels renders as a plain white block (the reported "logo
     isn't placed" bug). A small white card behind the image instead
     guarantees legibility against the dark header for any logo file. */
  .header-logo-chip { display: inline-flex; align-items: center; justify-content: center; background: #fff; border-radius: 10px; padding: 8px 14px; max-width: 210px; }
  .header-logo { max-height: 40px; max-width: 182px; display: block; }
  .header-brand { color: #cbd5e1; font-size: 11px; letter-spacing: 2px; margin-top: 8px; text-transform: uppercase; }
  .header-right { text-align: right; }
  .header-title { font-size: 34px; font-weight: 800; color: #0f172a; letter-spacing: 1px; margin: 0; }
  .header-subtitle { font-size: 15px; font-weight: 600; color: ${accent}; margin: 2px 0 14px; }
  .header-meta { font-size: 12.5px; color: #475569; }
  .header-meta .info-row { direction: ${rtl ? 'rtl' : 'ltr'}; justify-content: flex-end; gap: 10px; border: none; padding: 2px 0; }
  .header-meta .info-row span { color: #64748b; }
  .header-meta .info-row strong { color: #0f172a; min-width: 90px; text-align: right; }

  /* ── Body ── */
  .body-pad { padding: 28px 40px 40px; position: relative; z-index: 1; }
  .cards { display: flex; gap: 20px; margin-bottom: 24px; }
  .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; }
  .card-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; letter-spacing: .5px; color: ${accent}; text-transform: uppercase; margin-bottom: 10px; }
  .card .name { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .info-row { display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; padding: 3px 0; color: #334155; }
  .info-row span { color: #64748b; }
  .info-row strong { color: #0f172a; font-weight: 600; }
  .identity { font-size: 11px; color: #64748b; margin-top: 6px; line-height: 1.7; }

  .body.rich { white-space: normal; font-size: 13px; line-height: 1.7; color: #334155; margin: 16px 0; }
  .body.rich p { margin: 0 0 8px; }
  .body.rich h1, .body.rich h2, .body.rich h3, .body.rich h4 { margin: 14px 0 6px; color: #0f172a; }
  .body.rich ul, .body.rich ol { margin: 6px 0; padding-inline-start: 22px; }
  .body.rich blockquote { margin: 8px 0; padding-inline-start: 12px; border-inline-start: 3px solid #ddd; color: #555; }
  .body.plain { font-size: 13px; line-height: 1.7; color: #334155; white-space: pre-line; margin: 16px 0; }

  table.items { width: 100%; border-collapse: separate; border-spacing: 0; margin: 4px 0 20px; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
  table.items thead th { background: ${accent}; color: #fff; text-align: ${rtl ? 'right' : 'left'}; font-size: 11.5px; letter-spacing: .5px; padding: 12px 14px; font-weight: 700; }
  table.items thead th.num { text-align: center; }
  table.items tbody td { padding: 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
  table.items tbody tr:last-child td { border-bottom: none; }
  table.items tbody tr:nth-child(even) { background: #f8fafc; }
  .rownum { color: ${accent}; font-weight: 700; }
  .num { text-align: center; }
  table.items td.num, table.items th.num { text-align: center; }

  .totals-wrap { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
  table.totals { border-collapse: collapse; min-width: 260px; background: #f8fafc; border-radius: 12px; overflow: hidden; }
  table.totals td { padding: 8px 16px; font-size: 13px; }
  table.totals tr.grand td { font-size: 17px; font-weight: 800; color: #fff; background: ${accent}; padding: 12px 16px; }
  .terms-box { flex: 1; min-width: 220px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; font-size: 12px; color: #475569; line-height: 1.8; display: flex; flex-direction: column; gap: 12px; }
  .terms-box strong { display: block; color: #0f172a; font-size: 12px; margin-bottom: 4px; }
  .terms-box ul { margin: 0; padding-inline-start: 18px; }
  .terms-section + .terms-section { padding-top: 12px; border-top: 1px dashed #e2e8f0; }

  .pay-foot { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  .pay-box { flex: 1; min-width: 220px; }
  .pay-box .card-title { margin-bottom: 8px; }
  .sign-box { text-align: center; font-size: 12px; color: #475569; }
  .sig-img { max-height: 56px; display: block; margin: 0 auto 4px; }
  .seal { max-height: 80px; opacity: .9; margin-bottom: 4px; }
  .sign-box .line { width: 170px; border-top: 1px solid #94a3b8; margin: 10px auto 6px; }
  .sign-box .signer-name { font-weight: 700; color: #0f172a; font-size: 13px; }
  .verify-box { text-align: center; font-size: 10.5px; color: #64748b; }
  .verify-box img { width: 76px; height: 76px; border-radius: 8px; }

  /* ── Bottom contact bar ── */
  .footbar { background: linear-gradient(135deg, #060d1f, ${accent}); color: #e2e8f0; padding: 16px 40px; display: flex; flex-wrap: wrap; gap: 18px; justify-content: space-between; font-size: 12px; }
  .footbar span { white-space: nowrap; }
  .footnote { font-size: 10px; color: #94a3b8; text-align: center; padding: 6px 0; }

  .print-btn { position: fixed; top: 16px; ${rtl ? 'left' : 'right'}: 16px; background: ${accent}; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; z-index: 10; box-shadow: 0 4px 14px rgba(0,0,0,.2); }
  @media print { .print-btn { display: none; } body { padding: 0; background: #fff; } .page { margin: 0; max-width: 100%; box-shadow: none; } }
</style></head>
<body>
  <button class="print-btn" onclick="window.print()">${L.print}</button>
  <div class="page">
    ${t.watermarkText ? `<div class="watermark"><span>${escapeHtml(t.watermarkText)}</span></div>` : ''}
    ${show(t.showLogo) && b.letterheadUrl ? `<img class="letterhead" src="${escapeHtml(b.letterheadUrl)}" alt="letterhead" style="width:100%;display:block">` : ''}

    <div class="header">
      <div class="header-bg"></div>
      <div class="header-inner">
        <div>
          ${show(t.showLogo) && b.logoUrl ? `<div class="header-logo-chip"><img class="header-logo" src="${escapeHtml(b.logoUrl)}" alt="logo"></div>` : `<div class="header-logo" style="color:#fff;font-weight:800;font-size:22px">${escapeHtml(m.issuerName)}</div>`}
          <div class="header-brand">${escapeHtml(m.issuerInfo || b.website || '')}</div>
        </div>
        <div class="header-right">
          <h1 class="header-title">${escapeHtml(displayTitle)}</h1>
          ${t.variant ? `<div class="header-subtitle">${escapeHtml(t.variant)}</div>` : ''}
          <div class="header-meta">
            <div class="info-row"><span>${rtl ? 'شماره فاکتور' : 'Invoice No.'}</span><strong>${escapeHtml(m.number)}</strong></div>
            <div class="info-row"><span>${rtl ? 'تاریخ صدور' : 'Issue Date'}</span><strong>${escapeHtml(fmtDate(m.date))}</strong></div>
            ${m.dueDate ? `<div class="info-row"><span>${L.dueDate}</span><strong>${escapeHtml(fmtDate(m.dueDate))}</strong></div>` : ''}
            <div class="info-row"><span>${rtl ? 'ارز' : 'Currency'}</span><strong>${escapeHtml(p.currency)}</strong></div>
          </div>
        </div>
      </div>
    </div>

    <div class="body-pad">
      ${t.headerNote ? `<div class="body plain">${escapeHtml(t.headerNote)}</div>` : ''}

      <div class="cards">
        <div class="card">
          <div class="card-title">${svgIcon('user')} ${L.bill}</div>
          <div class="name">${escapeHtml(m.partyName)}</div>
          ${m.partyInfo ? `<div class="identity" style="margin-top:2px;white-space:pre-line">${escapeHtml(m.partyInfo)}</div>` : ''}
        </div>
        <div class="card">
          <div class="card-title">${svgIcon('server')} ${secondCardLabel}</div>
          ${metaRows}${customRows}
          ${identity ? `<div class="identity">${identity}</div>` : ''}
        </div>
      </div>

      ${p.bodyHtml ? `<div class="body rich" dir="${rtl ? 'rtl' : 'ltr'}">${sanitizeRichHtml(p.bodyHtml)}</div>` : p.body ? `<div class="body plain">${escapeHtml(p.body)}</div>` : ''}

      ${hasLines ? `<table class="items"><thead><tr><th class="num">${L.row}</th><th>${L.desc}</th><th class="num">${L.qty}</th><th class="num">${L.unit}</th><th class="num">${L.amount}</th></tr></thead><tbody>${rows}</tbody></table>` : ''}

      <div class="totals-wrap">
        ${(t.terms || t.paymentInstructions) ? `<div class="terms-box">
          ${t.paymentInstructions ? `<div class="terms-section"><strong>${L.paymentNote}</strong><div>${escapeHtml(t.paymentInstructions)}</div></div>` : ''}
          ${t.terms ? `<div class="terms-section"><strong>${L.terms}</strong><div>${escapeHtml(t.terms)}</div></div>` : ''}
        </div>` : `<div></div>`}
        ${totals}
      </div>

      <div class="pay-foot">
        ${bankBits ? `<div class="pay-box"><div class="card-title">${svgIcon('bank')} ${L.payment}</div>${bankBits}</div>` : '<div class="pay-box"></div>'}
        <div class="sign-box">
          ${show(t.showSeal) && b.sealUrl ? `<img class="seal" src="${escapeHtml(b.sealUrl)}" alt="seal">` : ''}
          ${show(t.showSignature) && b.signatureUrl ? `<img class="sig-img" src="${escapeHtml(b.signatureUrl)}" alt="signature">` : `<div class="line"></div>`}
          <div class="signer-name">${escapeHtml(b.ceoName || m.issuerName)}</div>
          <div>${b.signatureTitle ? escapeHtml(b.signatureTitle) : L.signer}</div>
        </div>
        ${show(t.showQr) ? `<div class="verify-box"><img src="${qrDataUrl}" alt="verify"><br>${L.verify}<br>${escapeHtml(m.verifyCode)}${t.showBarcode === true ? (code39Svg(m.number, { moduleWidth: 1, height: 30 }) ?? '') : ''}</div>` : '<div></div>'}
      </div>
    </div>

    <div class="footbar">
      ${b.phone ? `<span>${svgIcon('phone', 13)} ${escapeHtml(b.phone)}</span>` : ''}
      ${b.email ? `<span>${svgIcon('mail', 13)} ${escapeHtml(b.email)}</span>` : ''}
      ${b.website ? `<span>${svgIcon('globe', 13)} ${escapeHtml(b.website)}</span>` : ''}
      ${b.address ? `<span>${svgIcon('pin', 13)} ${escapeHtml(b.address)}</span>` : ''}
    </div>
    ${contactBits && !(b.phone || b.email || b.website || b.address) ? `<div class="footnote">${contactBits}</div>` : ''}
    ${t.footerNote ? `<div class="footnote">${escapeHtml(t.footerNote)}</div>` : ''}
  </div>
</body></html>`
}
