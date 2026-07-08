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
