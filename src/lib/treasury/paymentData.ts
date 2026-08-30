/**
 * Payment + Receipt data layer (Phase 26.14, M4/M5). Payment-order lifecycle
 * wired to the 26.12 approval platform, GL posting reusing the existing journal
 * (no second accounting engine), and receipt AR-settlement. State transitions
 * validated by the pure `payments.ts` engine.
 *
 * Phase-8 treasury audit finding: this whole module ran as sequences of bare,
 * unlocked, non-transactional pgQuery calls — a genuinely separate payment
 * path from the Phase-4/7-hardened sales_payments/purchase_payments flow,
 * with none of that hardening. Fixed:
 *  - createPayment: runOnce double-submit guard (matches every other
 *    create-a-financial-document path in this codebase).
 *  - processPayment: the whole approved→processing→GL-post→completed
 *    sequence now runs inside one transaction locked per payment id — a
 *    mid-sequence failure used to leave a 'processing' payment with an
 *    orphan posted GL entry never linked back; two concurrent calls could
 *    both pass status==='approved' and both post a duplicate GL entry.
 *  - createReceipt: the whole allocate→mark-invoices→insert-sales_payment→
 *    GL-post→insert-receipt sequence now runs inside one transaction
 *    locked per customer id — closes both a mid-sequence orphan risk and a
 *    real double-allocation race (two concurrent receipts for the same
 *    customer reading the same "open" invoice balances). The inserted
 *    sales_payments row is now ALSO stamped with the SAME gl_entry_id this
 *    function posts — the old code left it null, which meant Phase 7's
 *    postSalesPaymentToGl (gl_entry_id-null-guarded) could later run again
 *    on the very same payment and post a SECOND, duplicate GL entry for
 *    money that was already booked via this Treasury path. GL posting
 *    itself now reuses the shared, transaction-aware `insertPostedEntry`/
 *    `accountIdByCode`/`nextNumber('journal',...)` primitives instead of a
 *    local ad-hoc poster that minted its own non-sequential entry numbers.
 */
import { pgQuery, withTransaction, type TxQuery } from '@/lib/db'
import type { AdminUser } from '@/lib/admin/auth'
import { canTransitionPayment, paymentGlLines, glBalanced, allocateReceipt, type PaymentType, type PaymentStatus, type GlLine } from './payments'
import { createApprovalRequest } from '@/lib/erp/approvalData'
import { nextNumber } from '@/lib/numbering/integrate'
import { insertPostedEntry, accountIdByCode } from '@/lib/erp/glPosting'
import { runOnce } from '@/lib/api/idempotency'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

/** Post a balanced set of GL lines as a POSTED journal entry, inside the
 * caller's own transaction — reuses the shared posting primitives (real
 * numbering, real account resolution) rather than a local reimplementation. */
async function postGl(query: TxQuery, lines: GlLine[], memo: string, reference: string, date: string, userId: string): Promise<number> {
  if (!glBalanced(lines)) throw new Error('GL lines are not balanced')
  const codes = [...new Set(lines.map(l => l.accountCode))]
  const idOf = new Map<string, number>()
  for (const c of codes) idOf.set(c, await accountIdByCode(c, query))
  const total = lines.reduce((s, l) => s + l.debit, 0)
  const entry = await insertPostedEntry(query, date, memo, reference, total, userId,
    lines.map(l => ({ accountId: idOf.get(l.accountCode)!, debit: l.debit, credit: l.credit, memo: l.memo ?? null })))
  return entry.id
}

// ── Payment orders (M4) ──────────────────────────────────────────────────────
export interface PaymentInput { paymentType: PaymentType; party?: string; partyRef?: string; amount: number; currency?: string; bankAccountId?: number; date?: string; memo?: string; companyId?: number }

export async function createPayment(input: PaymentInput, userId: string): Promise<{ id: number; number: string }> {
  return runOnce(userId, 'treasury/payments.create', input, async () => {
    const number = await nextNumber('payment_order', { module: 'treasury', userId, legacyPrefix: 'PAY' }).catch(() => `PAY-${Date.now().toString(36)}`)
    const date = input.date ?? new Date().toISOString().slice(0, 10)
    const r = (await pgQuery<{ id: number }>(
      `INSERT INTO payment_orders (payment_no, payment_type, party, party_ref, amount, currency, bank_account_id, date, memo, company_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [number, input.paymentType, input.party ?? null, input.partyRef ?? null, input.amount, input.currency ?? 'IRR', input.bankAccountId ?? null, date, input.memo ?? null, input.companyId ?? null, userId]))[0]
    return { id: r.id, number }
  })
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

/**
 * Process an approved payment (M4): post to GL + mark completed. The whole
 * status-check, GL-post, and header update now run inside one transaction
 * locked per payment id — a second concurrent call blocks until the first
 * commits, then correctly sees status='completed' and is idempotently
 * refused rather than double-posting.
 */
export async function processPayment(id: number, user: AdminUser): Promise<{ glEntryId: number; alreadyProcessed: boolean }> {
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_payment_process:${id}`])
    const p = (await query<{ status: string; payment_type: PaymentType; amount: number; date: string; party: string | null; gl_entry_id: number | null }>(
      `SELECT status, payment_type, amount::float AS amount, date, party, gl_entry_id FROM payment_orders WHERE id=$1`, [id]))[0]
    if (!p) throw new Error('Payment not found')
    if (p.status === 'completed') return { glEntryId: p.gl_entry_id!, alreadyProcessed: true }
    if (p.status !== 'approved') throw new Error(`Payment must be approved before processing (is ${p.status})`)
    await query(`UPDATE payment_orders SET status='processing', updated_at=${NOW} WHERE id=$1`, [id])
    const glId = await postGl(query, paymentGlLines(p.payment_type, Number(p.amount)), `Payment ${p.payment_type} ${p.party ?? ''}`.trim(), `TRZPAY-${id}`, p.date, user.id)
    await query(`UPDATE payment_orders SET status='completed', gl_entry_id=$2, updated_at=${NOW} WHERE id=$1`, [id, glId])
    return { glEntryId: glId, alreadyProcessed: false }
  })
}

// ── Receipts (M5) ────────────────────────────────────────────────────────────
export interface ReceiptInput { receiptType?: string; customerId?: number; amount: number; currency?: string; bankAccountId?: number; date?: string; invoiceIds?: number[] }

/**
 * Record a customer receipt: allocate across open invoices (oldest-first),
 * write the real sales_payments row (the AR subledger's own record — reused,
 * never a parallel AR ledger), post the GL, and catalog the receipt. The
 * whole sequence is one transaction locked per customer id, closing both a
 * mid-sequence orphan-write risk and a real double-allocation race (two
 * concurrent receipts for the same customer both reading the same "open"
 * invoice balances and both allocating against them).
 */
export async function createReceipt(input: ReceiptInput, userId: string): Promise<{ id: number; allocations: { invoiceId: number; amount: number }[]; advance: number; glEntryId: number }> {
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  return withTransaction(async query => {
    if (input.customerId) await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_receipt_customer:${input.customerId}`])
    // Open invoices for the customer (oldest first). Sales AR is tracked via
    // sales_payments (no per-invoice paid_total), so open = the invoice total for
    // not-yet-paid invoices; a full allocation marks it paid, a partial one partial.
    let allocations: { invoiceId: number; amount: number }[] = []
    let advance = input.amount
    let paymentId: number | null = null
    if (input.customerId) {
      const invs = await query<{ id: number; open: number }>(
        `SELECT id, total::float AS open FROM sales_documents WHERE customer_id=$1 AND doc_type='invoice' AND status IN ('sent','confirmed','partial') ${input.invoiceIds?.length ? 'AND id = ANY($2)' : ''} ORDER BY date`,
        input.invoiceIds?.length ? [input.customerId, input.invoiceIds] : [input.customerId])
      const res = allocateReceipt(input.amount, invs.map(i => ({ id: i.id, open: Number(i.open) })))
      allocations = res.allocations; advance = res.advance
      const openById = new Map(invs.map(i => [i.id, Number(i.open)]))
      for (const a of allocations) await query(`UPDATE sales_documents SET status = CASE WHEN $2 >= $3 THEN 'paid' ELSE 'partial' END WHERE id=$1`, [a.invoiceId, a.amount, openById.get(a.invoiceId) ?? a.amount])
      // The receipt IS a real AR payment — record it in sales_payments (the
      // one AR subledger table; never a parallel ledger).
      const pay = (await query<{ id: number }>(`INSERT INTO sales_payments (customer_id, amount, date) VALUES ($1,$2,$3) RETURNING id`, [input.customerId, input.amount, date]))[0]
      paymentId = pay.id
    }
    const glId = await postGl(query, paymentGlLines('customer_receipt', input.amount), 'Customer receipt', `TRZRCP-${Date.now()}`, date, userId)
    // Stamp the SAME gl_entry_id onto the sales_payments row this receipt
    // created — without this, Phase 7's postSalesPaymentToGl (gated on
    // gl_entry_id IS NULL) would later post a SECOND, duplicate GL entry
    // for money already booked here.
    if (paymentId) await query(`UPDATE sales_payments SET gl_entry_id=$2 WHERE id=$1`, [paymentId, glId])
    const number = await nextNumber('receipt', { module: 'treasury', userId, legacyPrefix: 'RCP' }).catch(() => `RCP-${Date.now().toString(36)}`)
    const r = (await query<{ id: number }>(
      `INSERT INTO receipt_transactions (receipt_no, receipt_type, customer_id, amount, currency, bank_account_id, date, allocations, advance, gl_entry_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [number, input.receiptType ?? 'customer_receipt', input.customerId ?? null, input.amount, input.currency ?? 'IRR', input.bankAccountId ?? null, date, JSON.stringify(allocations), advance, glId, userId]))[0]
    return { id: r.id, allocations, advance, glEntryId: glId }
  })
}

export async function listReceipts() {
  return pgQuery(`SELECT r.id, r.receipt_no AS "receiptNo", r.receipt_type AS "receiptType", COALESCE(c.name,'?') AS customer, r.amount::float AS amount, r.currency, r.date, r.advance::float AS advance, r.gl_entry_id AS "glEntryId" FROM receipt_transactions r LEFT JOIN sales_customers c ON c.id=r.customer_id ORDER BY r.id DESC LIMIT 300`)
}
