/**
 * Payment lifecycle engine (Phase 26.14, M4/M5) — pure, unit-tested.
 * State machine + GL posting lines for the payment/receipt lifecycle. Approval
 * routing is delegated to the 26.12 approval platform (payment_request doc type);
 * GL posting reuses the existing journal — no second accounting engine here.
 */

export const PAYMENT_TYPES = ['supplier_payment', 'customer_refund', 'internal_transfer', 'salary_payment', 'tax_payment', 'foreign_payment'] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const PAYMENT_STATUSES = ['draft', 'pending_approval', 'approved', 'processing', 'completed', 'rejected', 'cancelled'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

const FLOW: Record<PaymentStatus, PaymentStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['processing', 'cancelled'],
  processing: ['completed'],
  completed: [],
  rejected: ['draft'],
  cancelled: [],
}
export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return FLOW[from]?.includes(to) ?? false
}
export function isFinalPayment(s: PaymentStatus): boolean { return s === 'completed' || s === 'cancelled' }

export interface GlLine { accountCode: string; debit: number; credit: number; memo?: string }

/**
 * Balanced GL lines for a payment/receipt. Bank account code defaults to 1010.
 * Receipts (customer receipt) debit the bank and credit AR.
 */
export function paymentGlLines(type: PaymentType | 'customer_receipt', amount: number, bankCode = '1010'): GlLine[] {
  const a = Math.abs(amount)
  switch (type) {
    case 'supplier_payment': return [{ accountCode: '2000', debit: a, credit: 0, memo: 'AP settled' }, { accountCode: bankCode, debit: 0, credit: a, memo: 'Bank out' }]
    case 'foreign_payment': return [{ accountCode: '2000', debit: a, credit: 0 }, { accountCode: bankCode, debit: 0, credit: a }]
    case 'tax_payment': return [{ accountCode: '2100', debit: a, credit: 0, memo: 'Taxes payable' }, { accountCode: bankCode, debit: 0, credit: a }]
    case 'salary_payment': return [{ accountCode: '6100', debit: a, credit: 0, memo: 'Salaries' }, { accountCode: bankCode, debit: 0, credit: a }]
    case 'customer_refund': return [{ accountCode: '1100', debit: a, credit: 0, memo: 'AR contra' }, { accountCode: bankCode, debit: 0, credit: a }]
    case 'internal_transfer': return [{ accountCode: bankCode, debit: a, credit: 0, memo: 'Transfer in' }, { accountCode: '1010', debit: 0, credit: a, memo: 'Transfer out' }]
    case 'customer_receipt': return [{ accountCode: bankCode, debit: a, credit: 0, memo: 'Bank in' }, { accountCode: '1100', debit: 0, credit: a, memo: 'AR settled' }]
  }
}

export function glBalanced(lines: GlLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0), c = lines.reduce((s, l) => s + l.credit, 0)
  return Math.abs(d - c) < 0.005 && d > 0
}

// ── AR settlement (M5) ───────────────────────────────────────────────────────
export interface Allocation { invoiceId: number; amount: number }
/** Allocate a receipt across invoices (oldest-first) up to their open balance. */
export function allocateReceipt(amount: number, invoices: { id: number; open: number }[]): { allocations: Allocation[]; advance: number } {
  let remaining = Math.round(amount * 100) / 100
  const allocations: Allocation[] = []
  for (const inv of invoices) {
    if (remaining <= 0) break
    const pay = Math.min(remaining, Math.max(0, inv.open))
    if (pay > 0) { allocations.push({ invoiceId: inv.id, amount: Math.round(pay * 100) / 100 }); remaining = Math.round((remaining - pay) * 100) / 100 }
  }
  return { allocations, advance: Math.max(0, remaining) }   // leftover = advance/on-account
}

/** The approval role required for a payment amount (Toman tiers per the spec). */
export function requiredApprovalRole(amount: number): 'finance_manager' | 'cfo' | 'ceo' {
  if (amount < 100_000_000) return 'finance_manager'
  if (amount <= 1_000_000_000) return 'cfo'
  return 'ceo'
}
