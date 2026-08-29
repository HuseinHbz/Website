/**
 * Three-Way Match engine (Phase 5) — pure, deterministic, unit-tested.
 *
 * Phase 4's procurement audit found NO matching logic anywhere in the
 * repository: an invoice line carried no reference back to the PO/receipt
 * line it came from, so nothing compared what was ordered, received and
 * billed. This is the smallest architecture consistent with the existing
 * procurement model (a single purchase_documents/purchase_document_lines
 * pair reused across every doc_type, order→receipt→invoice already copying
 * lines 1:1 via convertDocument): line-level ancestry (po_line_id/
 * receipt_line_id) plus this pure comparator.
 *
 * No configured price/tax tolerance mechanism exists anywhere else in the
 * codebase (searched: no `tolerance` concept outside banking's unrelated
 * statement-reconciliation window) — inventing a tolerance percentage here
 * would be exactly the kind of undocumented business rule the audit
 * forbids, so price/tax comparison is EXACT (to the hundredth of a unit,
 * matching how money is already rounded elsewhere in this module). If the
 * business wants a tolerance band, that is a real, separate product
 * decision — recorded as remaining work, not assumed.
 */

export type MatchStatus = 'matched' | 'mismatch' | 'pending'

export interface MatchLineInput {
  /** Ordered qty/unit price/tax % from the PO line, or null if this invoice
   * line has no traceable PO ancestry (a standalone invoice). */
  poQty: number | null
  poPrice: number | null
  poTaxPct: number | null
  /** Qty actually received on the linked receipt line, or null if there is
   * no linked receipt (e.g. the invoice was converted straight from the PO,
   * or is standalone). */
  receivedQty: number | null
  invoiceQty: number
  invoicePrice: number
  invoiceTaxPct: number
}

export interface MatchLineResult {
  status: MatchStatus
  reasons: string[]
}

const EPS = 0.005

/**
 * Quantity rule (Phase 3 of the master prompt): invoice qty must never
 * exceed either the received qty or the ordered qty. Partial receipts are
 * supported (the invoice may bill less than ordered) — only an invoice
 * qty ABOVE what was received/ordered is a defect.
 */
export function matchLine(input: MatchLineInput): MatchLineResult {
  const reasons: string[] = []
  if (input.poQty == null || input.receivedQty == null) {
    return { status: 'pending', reasons: ['no linked purchase order / receipt line to match against'] }
  }
  if (input.invoiceQty > input.receivedQty + EPS)
    reasons.push(`invoice qty ${input.invoiceQty} exceeds received qty ${input.receivedQty}`)
  if (input.invoiceQty > input.poQty + EPS)
    reasons.push(`invoice qty ${input.invoiceQty} exceeds ordered qty ${input.poQty}`)
  if (input.poPrice != null && Math.abs(input.invoicePrice - input.poPrice) > EPS)
    reasons.push(`invoice unit price ${input.invoicePrice} differs from PO unit price ${input.poPrice}`)
  if (input.poTaxPct != null && Math.abs(input.invoiceTaxPct - input.poTaxPct) > EPS)
    reasons.push(`invoice tax ${input.invoiceTaxPct}% differs from PO tax ${input.poTaxPct}%`)
  return { status: reasons.length ? 'mismatch' : 'matched', reasons }
}

/** Document-level status: worst-of across its lines. An invoice with zero
 * lines, or where every line is unmatchable (no PO ancestry), is 'pending'
 * — never silently reported as 'matched'. */
export function overallMatchStatus(lines: MatchStatus[]): MatchStatus {
  if (lines.length === 0) return 'pending'
  if (lines.some(s => s === 'mismatch')) return 'mismatch'
  if (lines.some(s => s === 'pending')) return 'pending'
  return 'matched'
}
