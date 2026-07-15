/**
 * Enterprise Sales — domain logic (Phase 21 ERP, Module 2).
 *
 * Pure, deterministic maths for sales documents (quotations, sales orders,
 * invoices, credit notes) and customer credit. No DB access → fully unit-tested.
 * Shared by the API, dashboards and PDF/document generation so a total is
 * computed in exactly one place.
 *
 * Line convention: net = qty × unit price, then a per-line discount %, then tax %
 * on the discounted net. Document totals sum the lines.
 */

export const DOC_TYPES = ['quote', 'order', 'invoice', 'credit_note', 'debit_note'] as const
export type DocType = (typeof DOC_TYPES)[number]

export const DOC_STATUSES = ['draft', 'sent', 'confirmed', 'partial', 'paid', 'void'] as const
export type DocStatus = (typeof DOC_STATUSES)[number]

export interface LineInput {
  qty: number
  unitPrice: number
  discountPct: number
  taxPct: number
}

export interface LineTotals {
  gross: number       // qty × unit price
  discount: number    // discount amount
  net: number         // gross − discount (taxable base)
  tax: number         // tax on net
  total: number       // net + tax
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
function clampPct(p: number): number { return Math.max(0, Math.min(100, p || 0)) }

/** Totals for a single document line. */
export function lineTotals(l: LineInput): LineTotals {
  const gross = round2((l.qty || 0) * (l.unitPrice || 0))
  const discount = round2(gross * clampPct(l.discountPct) / 100)
  const net = round2(gross - discount)
  const tax = round2(net * clampPct(l.taxPct) / 100)
  return { gross, discount, net, tax, total: round2(net + tax) }
}

export interface DocumentTotals {
  subtotal: number      // Σ gross
  discountTotal: number // Σ discount
  taxTotal: number      // Σ tax
  total: number         // Σ total (net + tax)
}

/** Roll a set of lines into document totals. */
export function documentTotals(lines: LineInput[]): DocumentTotals {
  let subtotal = 0, discountTotal = 0, taxTotal = 0, total = 0
  for (const l of lines) {
    const t = lineTotals(l)
    subtotal += t.gross; discountTotal += t.discount; taxTotal += t.tax; total += t.total
  }
  return { subtotal: round2(subtotal), discountTotal: round2(discountTotal), taxTotal: round2(taxTotal), total: round2(total) }
}

export interface CustomerCreditInput {
  creditLimit: number
  invoicedTotal: number     // Σ posted invoice totals
  paidTotal: number         // Σ payments received
  creditNotesTotal: number  // Σ credit notes issued
}

export interface CustomerCredit {
  outstanding: number   // invoiced − paid − credit notes (amount owed)
  available: number     // credit limit − outstanding
  overLimit: boolean
  utilizationPct: number
}

/** Customer credit position from their billing history. */
export function customerCredit(i: CustomerCreditInput): CustomerCredit {
  const outstanding = round2(i.invoicedTotal - i.paidTotal - i.creditNotesTotal)
  const available = round2(i.creditLimit - outstanding)
  return {
    outstanding,
    available,
    overLimit: i.creditLimit > 0 && outstanding > i.creditLimit,
    utilizationPct: i.creditLimit > 0 ? Math.round((outstanding / i.creditLimit) * 1000) / 10 : 0,
  }
}

/** Invoice payment status from its total and amount paid. */
export function invoiceStatus(total: number, paid: number): DocStatus {
  if (paid <= 0) return 'sent'
  if (paid + 0.005 >= total) return 'paid'
  return 'partial'
}

export interface SalesKpis {
  customers: number
  quotes: number
  orders: number
  invoiced: number       // Σ invoice totals
  collected: number      // Σ payments
  outstanding: number     // invoiced − collected − credit notes
  wonValue: number
  taxCollected: number
}

/** Dashboard KPI rollup from document/payment aggregates. */
export function salesKpis(a: {
  customers: number; quotes: number; orders: number
  invoiced: number; collected: number; creditNotes: number; taxCollected: number; ordersValue: number
}): SalesKpis {
  return {
    customers: a.customers,
    quotes: a.quotes,
    orders: a.orders,
    invoiced: round2(a.invoiced),
    collected: round2(a.collected),
    outstanding: round2(a.invoiced - a.collected - a.creditNotes),
    wonValue: round2(a.ordersValue),
    taxCollected: round2(a.taxCollected),
  }
}

// ── Double-entry GL posting primitives (shared, single source) ───────────────
// `PostingLine` + `postingBalanced` live here (sales is the lower module that
// purchasing already imports); purchasing re-exports them so both sides turn a
// document total into balanced double-entry with one primitive — no duplication.
export interface PostingLine { accountCode: string; debit: number; credit: number; memo: string }
/** A set of posting lines is valid only when Σdebit = Σcredit. */
export function postingBalanced(lines: PostingLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0)
  const c = lines.reduce((s, l) => s + l.credit, 0)
  return Math.abs(round2(d) - round2(c)) < 0.001
}

// ── Sales → General-Ledger posting (Phase 26.15.1) ───────────────────────────
// Reuses the same `PostingLine` primitive as purchasing so a document total is
// turned into balanced double-entry in exactly one place. A sales *invoice*
// posts:  Dr 1100 Accounts Receivable (gross) / Cr 4000 Sales Revenue (net) /
// Cr 2100 Taxes Payable (VAT).  A *credit_note* (sales return) reverses it.
// `net` = subtotal − discount, `tax` = VAT, `total` = net + tax.
export type SalesPostingKind = 'invoice' | 'credit_note'

export function salesInvoicePostingLines(net: number, tax: number, total: number, kind: SalesPostingKind = 'invoice'): PostingLine[] {
  const ar = { accountCode: '1100', memo: 'Accounts receivable' }
  const rev = { accountCode: '4000', memo: 'Sales revenue' }
  const vat = { accountCode: '2100', memo: 'VAT payable' }
  const lines: PostingLine[] = kind === 'credit_note'
    ? [
        { ...rev, debit: round2(net), credit: 0 },
        ...(tax > 0 ? [{ ...vat, debit: round2(tax), credit: 0 }] : []),
        { ...ar, debit: 0, credit: round2(total) },
      ]
    : [
        { ...ar, debit: round2(total), credit: 0 },
        { ...rev, debit: 0, credit: round2(net) },
        ...(tax > 0 ? [{ ...vat, debit: 0, credit: round2(tax) }] : []),
      ]
  return lines
}

// ── Sales return validation (Phase 26.26, BUG-013) ────────────────────────────
// A return produces a credit note against a source invoice. PURE guards so the
// route can reject bad returns deterministically (and unit-test them):
//  - only a confirmed/partial/paid invoice may be returned (never draft/sent/void)
//  - the cumulative returned amount may never exceed the invoice total (idempotency)
export type ReturnableStatus = 'draft' | 'sent' | 'confirmed' | 'partial' | 'paid' | 'void'
const RETURNABLE = new Set(['confirmed', 'partial', 'paid'])

export function isInvoiceReturnable(status: string): boolean {
  return RETURNABLE.has(status)
}

export function remainingReturnable(invoiceTotal: number, priorReturned: number): number {
  return Math.max(0, round2(invoiceTotal - priorReturned))
}

export interface ReturnVerdict { ok: boolean; error?: string; amount: number }

/** Validate a requested return amount against the invoice state. */
export function validateReturnRequest(input: {
  status: string; invoiceTotal: number; priorReturned: number; requestedAmount: number
}): ReturnVerdict {
  if (!isInvoiceReturnable(input.status)) return { ok: false, error: 'only a confirmed/partial/paid invoice can be returned', amount: 0 }
  const remaining = remainingReturnable(input.invoiceTotal, input.priorReturned)
  const amount = round2(input.requestedAmount)
  if (amount <= 0) return { ok: false, error: 'nothing to return', amount: 0 }
  if (amount > remaining + 0.001) return { ok: false, error: `return ${amount} exceeds remaining returnable ${remaining}`, amount }
  return { ok: true, amount }
}

/** True when an invoice may still be voided (no settled payment against it). */
export function canVoidInvoice(hasPayments: boolean): boolean {
  return !hasPayments
}
