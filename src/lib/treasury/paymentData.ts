/**
 * Payment + Receipt data layer (Phase 26.14, M4/M5). Payment-order lifecycle
 * wired to the 26.12 approval platform, GL posting reusing the existing journal
 * (no second accounting engine), and receipt AR-settlement. State transitions
 * validated by the pure `payments.ts` engine.
 */
import { pgQuery } from '@/lib/db'
import type { AdminUser } from '@/lib/admin/auth'
import { canTransitionPayment, paymentGlLines, glBalanced, allocateReceipt, type PaymentType, type PaymentStatus, type GlLine } from './payments'
import { createApprovalRequest } from '@/lib/erp/approvalData'
import { nextNumber } from '@/lib/numbering/integrate'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

/** Post a balanced set of GL lines as a POSTED journal entry. Reuses the journal. */
async function postGl(lines: GlLine[], memo: string, date: string, userId: string): Promise<number> {
  if (!glBalanced(lines)) throw new Error('GL lines are not balanced')
  const codes = [...new Set(lines.map(l => l.accountCode))]
  const accts = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE code = ANY($1)`, [codes])
  const byCode = new Map(accts.map(a => [a.code, a.id]))
  for (const c of codes) if (!byCode.has(c)) throw new Error(`GL account ${c} missing — run migrations`)
  const total = lines.reduce((s, l) => s + l.debit, 0)
  const entry = (await pgQuery<{ id: number }>(
    `INSERT INTO gl_journal_entries (entry_no, date, memo, status, total, created_by, posted_at) VALUES ($1,$2,$3,'posted',$4,$5,${NOW}) RETURNING id`,
    [`TRZ-${Date.now().toString(36)}`, date, memo, total, userId]))[0]
  for (let i = 0; i < lines.length; i++) await pgQuery(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
    [entry.id, byCode.get(lines[i].accountCode), lines[i].debit, lines[i].credit, lines[i].memo ?? null, i])
  return entry.id
}

// ── Payment orders (M4) ──────────────────────────────────────────────────────
export interface PaymentInput { paymentType: PaymentType; party?: string; partyRef?: string; amount: number; currency?: string; bankAccountId?: number; date?: string; memo?: string; companyId?: number }

export async function createPayment(input: PaymentInput, userId: string): Promise<{ id: number; number: string }> {
  const number = await nextNumber('payment_order', { module: 'treasury', userId, legacyPrefix: 'PAY' }).catch(() => `PAY-${Date.now().toString(36)}`)
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO payment_orders (payment_no, payment_type, party, party_ref, amount, currency, bank_account_id, date, memo, company_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [number, input.paymentType, input.party ?? null, input.partyRef ?? null, input.amount, input.currency ?? 'IRR', input.bankAccountId ?? null, date, input.memo ?? null, input.companyId ?? null, userId]))[0]
  return { id: r.id, number }
}

export async function listPayments(status?: string) {
  const gate = status ? `WHERE status=$1` : ''
  return pgQuery(`SELECT id, payment_no AS "paymentNo", payment_type AS "paymentType", party, amount::float AS amount, currency, date, status, approval_request_id AS "approvalRequestId", gl_entry_id AS "glEntryId" FROM payment_orders ${gate} ORDER BY id DESC LIMIT 300`, status ? [status] : [])
}

/** Submit for approval (M4): routes through the 26.12 approval platform. */
export async function submitPayment(id: number, userId: string): Promise<{ approvalRequestId: number; levels: number }> {
  const p = (await pgQuery<{ status: string; payment_type: string; amount: number; party: string | null }>(`SELECT status, payment_type, amount::float AS amount, party FROM payment_orders WHERE id=$1`, [id]))[0]
  if (!p) throw new Error('Payment not found')
  if (!canTransitionPayment(p.status as PaymentStatus, 'pending_approval')) throw new Error(`Cannot submit a ${p.status} payment`)
  const req = await createApprovalRequest({ docType: 'payment_request', refType: 'payment_orders', refId: id, title: `${p.payment_type} ${p.party ?? ''}`.trim(), amount: Number(p.amount) }, userId)
  await pgQuery(`UPDATE payment_orders SET status=CASE WHEN $2 THEN 'approved' ELSE 'pending_approval' END, approval_request_id=$3, updated_at=${NOW} WHERE id=$1`, [id, req.autoApproved, req.id])
  return { approvalRequestId: req.id, levels: req.levels }
}

/** Process an approved payment (M4): post to GL + mark completed. */
export async function processPayment(id: number, user: AdminUser): Promise<{ glEntryId: number }> {
  const p = (await pgQuery<{ status: string; payment_type: PaymentType; amount: number; date: string; party: string | null }>(`SELECT status, payment_type, amount::float AS amount, date, party FROM payment_orders WHERE id=$1`, [id]))[0]
  if (!p) throw new Error('Payment not found')
  if (p.status !== 'approved') throw new Error(`Payment must be approved before processing (is ${p.status})`)
  await pgQuery(`UPDATE payment_orders SET status='processing', updated_at=${NOW} WHERE id=$1`, [id])
  const glId = await postGl(paymentGlLines(p.payment_type, Number(p.amount)), `Payment ${p.payment_type} ${p.party ?? ''}`.trim(), p.date, user.id)
  await pgQuery(`UPDATE payment_orders SET status='completed', gl_entry_id=$2, updated_at=${NOW} WHERE id=$1`, [id, glId])
  return { glEntryId: glId }
}

// ── Receipts (M5) ────────────────────────────────────────────────────────────
export interface ReceiptInput { receiptType?: string; customerId?: number; amount: number; currency?: string; bankAccountId?: number; date?: string; invoiceIds?: number[] }

export async function createReceipt(input: ReceiptInput, userId: string): Promise<{ id: number; allocations: { invoiceId: number; amount: number }[]; advance: number; glEntryId: number }> {
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  // Open invoices for the customer (oldest first). Sales AR is tracked via
  // sales_payments (no per-invoice paid_total), so open = the invoice total for
  // not-yet-paid invoices; a full allocation marks it paid, a partial one partial.
  let allocations: { invoiceId: number; amount: number }[] = []
  let advance = input.amount
  if (input.customerId) {
    const invs = (await pgQuery<{ id: number; open: number }>(
      `SELECT id, total::float AS open FROM sales_documents WHERE customer_id=$1 AND doc_type='invoice' AND status IN ('sent','confirmed','partial') ${input.invoiceIds?.length ? 'AND id = ANY($2)' : ''} ORDER BY date`,
      input.invoiceIds?.length ? [input.customerId, input.invoiceIds] : [input.customerId]))
    const res = allocateReceipt(input.amount, invs.map(i => ({ id: i.id, open: Number(i.open) })))
    allocations = res.allocations; advance = res.advance
    const openById = new Map(invs.map(i => [i.id, Number(i.open)]))
    for (const a of allocations) await pgQuery(`UPDATE sales_documents SET status = CASE WHEN $2 >= $3 THEN 'paid' ELSE 'partial' END WHERE id=$1`, [a.invoiceId, a.amount, openById.get(a.invoiceId) ?? a.amount])
    // The receipt IS a real AR payment — record it in sales_payments.
    await pgQuery(`INSERT INTO sales_payments (customer_id, amount, date) VALUES ($1,$2,$3)`, [input.customerId, input.amount, date])
  }
  const glId = await postGl(paymentGlLines('customer_receipt', input.amount), 'Customer receipt', date, userId)
  const number = await nextNumber('receipt', { module: 'treasury', userId, legacyPrefix: 'RCP' }).catch(() => `RCP-${Date.now().toString(36)}`)
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO receipt_transactions (receipt_no, receipt_type, customer_id, amount, currency, bank_account_id, date, allocations, advance, gl_entry_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [number, input.receiptType ?? 'customer_receipt', input.customerId ?? null, input.amount, input.currency ?? 'IRR', input.bankAccountId ?? null, date, JSON.stringify(allocations), advance, glId, userId]))[0]
  return { id: r.id, allocations, advance, glEntryId: glId }
}

export async function listReceipts() {
  return pgQuery(`SELECT r.id, r.receipt_no AS "receiptNo", r.receipt_type AS "receiptType", COALESCE(c.name,'?') AS customer, r.amount::float AS amount, r.currency, r.date, r.advance::float AS advance, r.gl_entry_id AS "glEntryId" FROM receipt_transactions r LEFT JOIN sales_customers c ON c.id=r.customer_id ORDER BY r.id DESC LIMIT 300`)
}
