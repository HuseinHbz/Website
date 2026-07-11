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
