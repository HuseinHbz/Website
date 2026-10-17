/**
 * Enterprise Purchasing Engine (Phase 26.1) — pure, deterministic, unit-tested.
 *
 * Procure-to-pay logic: document totals (reuses the sales line math),
 * multi-level approval routing by amount, budget validation, vendor evaluation
 * scoring / rating, and the vendor payable position. No I/O — the data layer
 * supplies rows. Distinct from Sales (this is the buy side).
 */
import { documentTotals, type LineInput, type DocumentTotals } from './sales'

export type { LineInput, DocumentTotals }
export { documentTotals }

/** The unified purchasing document types (one header table, like sales). */
export type PurchaseDocType =
  | 'request' | 'rfq' | 'quotation' | 'order' | 'receipt'
  | 'invoice' | 'return' | 'credit_note'
export type PurchaseStatus =
  | 'draft' | 'submitted' | 'approved' | 'rejected'
  | 'confirmed' | 'received' | 'partial' | 'paid' | 'closed' | 'void'

const round2 = (n: number) => Math.round(n * 100) / 100

// ── Multi-level approval routing ────────────────────────────────────────────
export interface ApprovalTier { level: number; upTo: number | null; role: string }
/** Default approval matrix by document amount (base currency). Higher amounts
 * require more approval levels. `upTo: null` = no ceiling (top tier). */
export const DEFAULT_APPROVAL_MATRIX: ApprovalTier[] = [
  { level: 1, upTo: 50_000_000, role: 'editor' },          // ≤ 50M Rial
  { level: 2, upTo: 500_000_000, role: 'administrator' },  // ≤ 500M Rial
  { level: 3, upTo: null, role: 'super_admin' },           // above → exec sign-off
]

/** How many approval levels a document of this amount needs. */
export function requiredApprovalLevels(amount: number, matrix: ApprovalTier[] = DEFAULT_APPROVAL_MATRIX): number {
  let levels = 1
  for (const tier of matrix) {
    levels = tier.level
    if (tier.upTo === null || amount <= tier.upTo) break
  }
  return levels
}

/** Is a document fully approved given the approvals collected so far? */
export function isFullyApproved(amount: number, approvedLevels: number[], matrix?: ApprovalTier[]): boolean {
  const need = requiredApprovalLevels(amount, matrix)
  const distinct = new Set(approvedLevels)
  for (let l = 1; l <= need; l++) if (!distinct.has(l)) return false
  return true
}

// ── Budget validation ────────────────────────────────────────────────────────
export interface BudgetCheck { budget: number; committed: number; requested: number }
export interface BudgetResult { available: number; remainingAfter: number; withinBudget: boolean; utilizationPct: number }
/** Validate a purchase against a budget envelope (e.g. per department/project). */
export function validateBudget(b: BudgetCheck): BudgetResult {
  const available = round2(b.budget - b.committed)
  const remainingAfter = round2(available - b.requested)
  return {
    available,
    remainingAfter,
    withinBudget: remainingAfter >= 0,
    utilizationPct: b.budget > 0 ? round2((b.committed + b.requested) / b.budget * 100) : 0,
  }
}

// ── Vendor evaluation / rating ───────────────────────────────────────────────
export interface VendorScoreInput {
  quality: number        // 0..5
  delivery: number       // 0..5 (on-time)
  price: number          // 0..5 (competitiveness)
  service: number        // 0..5
  compliance: number     // 0..5
}
export interface VendorScore { score: number; stars: number; grade: 'A' | 'B' | 'C' | 'D' }
/** Weighted 0..100 vendor score + star rating + letter grade. */
export function vendorScore(i: VendorScoreInput): VendorScore {
  const clamp = (n: number) => Math.max(0, Math.min(5, n || 0))
  // Weights: quality 30, delivery 25, price 20, service 15, compliance 10.
  const weighted = clamp(i.quality) * 6 + clamp(i.delivery) * 5 + clamp(i.price) * 4 + clamp(i.service) * 3 + clamp(i.compliance) * 2
  const score = round2(weighted) // 0..100
  const stars = Math.round((score / 100) * 5)
  const grade: VendorScore['grade'] = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D'
  return { score, stars, grade }
}

// ── Vendor payable position ──────────────────────────────────────────────────
export interface VendorPayableInput {
  invoicedTotal: number      // Σ purchase-invoice totals
  paidTotal: number          // Σ payment vouchers
  creditNotesTotal: number   // Σ vendor credit notes
}
export interface VendorPayable { outstanding: number; hasBalance: boolean }
export function vendorPayable(i: VendorPayableInput): VendorPayable {
  const outstanding = round2(i.invoicedTotal - i.paidTotal - i.creditNotesTotal)
  return { outstanding, hasBalance: outstanding > 0 }
}

/** Purchase-invoice settlement status from its total vs payments. */
export function purchaseInvoiceStatus(total: number, paid: number): PurchaseStatus {
  if (paid <= 0) return 'confirmed'
  if (paid + 0.001 >= total) return 'paid'
  return 'partial'
}

// ── GL posting (double-entry integration) ───────────────────────────────────
// `PostingLine`/`postingBalanced` are defined once in ./sales (the module
// purchasing already depends on) and re-exported here for backward compatibility.
export { postingBalanced, type PostingLine } from './sales'
import type { PostingLine } from './sales'
/**
 * Double-entry lines for a purchase invoice (goods): Dr Inventory (net),
 * Dr Taxes Payable (recoverable VAT input), Cr Accounts Payable (gross total).
 * Always balances (Σdebit = Σcredit = total).
 */
export function purchaseInvoicePostingLines(net: number, tax: number, total: number): PostingLine[] {
  const lines: PostingLine[] = [
    { accountCode: '1200', debit: round2(net), credit: 0, memo: 'Purchase (net)' },
  ]
  // ERPFIX-7 (BUG-ERP-20): sentinel distinct from the sales side's output-VAT
  // sentinel — glPosting's applyGlMap translates it to the configured
  // INPUT-VAT account (gl_map_vat_input, falling back to gl_map_vat).
  if (tax > 0) lines.push({ accountCode: '2100-IN', debit: round2(tax), credit: 0, memo: 'VAT input' })
  lines.push({ accountCode: '2000', debit: 0, credit: round2(total), memo: 'Accounts payable' })
  return lines
}
// ERPFIX-5 (BUG-ERP-11): a purchase invoice's lines are no longer always
// debited to Inventory (1200). Each line carries a `lineClass` — 'stock'
// (has a product_id, as before), 'expense' (a service line — no product),
// or 'fixed_asset' (an asset acquisition, explicitly marked) — and is routed
// to the matching account. The AP credit is computed from the SUM of the
// actual debit lines (not a separately-passed total) so the entry balances
// exactly even with per-class rounding. Decision_gate answered: no GR/IR
// accrual in this phase — this function only closes "services never go to
// inventory"; the separate receipt-vs-invoice timing gap stays visible via
// the read-only "unbilled receipts" report, not a new accrual account.
export type PurchaseLineClass = 'stock' | 'expense' | 'fixed_asset'
export interface ClassifiedPurchaseLine { amount: number; taxAmount: number; lineClass: PurchaseLineClass }
const PURCHASE_LINE_CLASS_ACCOUNT: Record<PurchaseLineClass, string> = {
  stock: '1200', expense: '6300', fixed_asset: '1500',
}
const PURCHASE_LINE_CLASS_MEMO: Record<PurchaseLineClass, string> = {
  stock: 'Purchase (net) — inventory', expense: 'Purchase (net) — services', fixed_asset: 'Purchase (net) — fixed assets',
}
export function purchaseInvoicePostingLinesByClass(classified: ClassifiedPurchaseLine[]): PostingLine[] {
  const byClass = new Map<PurchaseLineClass, { net: number; tax: number }>()
  for (const l of classified) {
    const e = byClass.get(l.lineClass) ?? { net: 0, tax: 0 }
    e.net += l.amount; e.tax += l.taxAmount
    byClass.set(l.lineClass, e)
  }
  const lines: PostingLine[] = []
  let totalTax = 0
  for (const [cls, v] of byClass) {
    if (Math.abs(v.net) > 0.0001) lines.push({ accountCode: PURCHASE_LINE_CLASS_ACCOUNT[cls], debit: round2(v.net), credit: 0, memo: PURCHASE_LINE_CLASS_MEMO[cls] })
    totalTax += v.tax
  }
  if (Math.abs(totalTax) > 0.0001) lines.push({ accountCode: '2100-IN', debit: round2(totalTax), credit: 0, memo: 'VAT input' })
  // AP is the sum of the lines actually posted above — guarantees Σdebit=Σcredit
  // exactly, independent of any per-class rounding residue.
  const apTotal = round2(lines.reduce((s, l) => s + l.debit, 0))
  lines.push({ accountCode: '2000', debit: 0, credit: apTotal, memo: 'Accounts payable' })
  return lines
}

/** Payment of a vendor invoice: Dr Accounts Payable, Cr Bank. */
export function purchasePaymentPostingLines(amount: number): PostingLine[] {
  return [
    { accountCode: '2000', debit: round2(amount), credit: 0, memo: 'Settle payable' },
    { accountCode: '1010', debit: 0, credit: round2(amount), memo: 'Bank payment' },
  ]
}

// ── Analytics ────────────────────────────────────────────────────────────────
export interface PurchaseDocFact {
  docType: PurchaseDocType
  status: PurchaseStatus | string
  total: number
  /** ISO date (YYYY-MM-DD…). */
  date: string
  vendorName?: string | null
}
export interface PurchaseAnalytics {
  /** Committed spend per month (orders+invoices, non-draft/void/rejected), oldest→newest. */
  monthlySpend: { month: string; total: number }[]
  /** Spend by document type (same commitment filter). */
  byType: { type: string; total: number; count: number }[]
  /** Top vendors by committed spend. */
  topVendorSpend: { vendor: string; total: number }[]
  /** Document-count distribution by status (all docs). */
  byStatus: { status: string; count: number }[]
}

const COMMITTED_TYPES: PurchaseDocType[] = ['order', 'invoice']
const NON_COMMITTED_STATUS = new Set(['draft', 'void', 'rejected'])

/** Roll raw purchasing documents into the analytics dashboard series. */
export function purchaseAnalytics(rows: PurchaseDocFact[], months = 12): PurchaseAnalytics {
  const committed = rows.filter(r => COMMITTED_TYPES.includes(r.docType) && !NON_COMMITTED_STATUS.has(String(r.status)))

  const monthKey = (d: string) => d.slice(0, 7)
  const spendByMonth = new Map<string, number>()
  for (const r of committed) {
    const k = monthKey(r.date)
    spendByMonth.set(k, round2((spendByMonth.get(k) ?? 0) + r.total))
  }
  const monthlySpend = [...spendByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-months)
    .map(([month, total]) => ({ month, total }))

  const typeAgg = new Map<string, { total: number; count: number }>()
  for (const r of committed) {
    const t = typeAgg.get(r.docType) ?? { total: 0, count: 0 }
    t.total = round2(t.total + r.total); t.count++
    typeAgg.set(r.docType, t)
  }
  const byType = [...typeAgg.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.total - a.total)

  const vendorAgg = new Map<string, number>()
  for (const r of committed) {
    const v = r.vendorName?.trim()
    if (!v) continue
    vendorAgg.set(v, round2((vendorAgg.get(v) ?? 0) + r.total))
  }
  const topVendorSpend = [...vendorAgg.entries()].map(([vendor, total]) => ({ vendor, total }))
    .sort((a, b) => b.total - a.total).slice(0, 8)

  const statusAgg = new Map<string, number>()
  for (const r of rows) statusAgg.set(String(r.status), (statusAgg.get(String(r.status)) ?? 0) + 1)
  const byStatus = [...statusAgg.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)

  return { monthlySpend, byType, topVendorSpend, byStatus }
}

// ── KPIs ─────────────────────────────────────────────────────────────────────
export interface PurchaseKpis {
  openOrders: number; ordersValue: number
  pendingApproval: number
  payables: number
  vendors: number
}
export function purchaseKpis(a: {
  orders: { status: PurchaseStatus; total: number }[]
  pendingApproval: number
  payables: number
  vendors: number
}): PurchaseKpis {
  const open = a.orders.filter(o => ['confirmed', 'partial', 'received'].includes(o.status))
  return {
    openOrders: open.length,
    ordersValue: round2(open.reduce((s, o) => s + o.total, 0)),
    pendingApproval: a.pendingApproval,
    payables: round2(a.payables),
    vendors: a.vendors,
  }
}
