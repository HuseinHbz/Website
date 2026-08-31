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

/**
 * Phase-10: parses a vendor id out of `party_ref` (`vendor:5`) — the ONLY
 * structural link a Treasury payment order has to a specific vendor. Not a
 * real FK (party_ref is a free-text column), so this is deliberately
 * defensive: an unparseable/missing ref means "no vendor identified,
 * allocate nothing" rather than guessing.
 */
function vendorIdFromPartyRef(partyRef: string | null): number | null {
  const m = /^vendor:(\d+)$/.exec(partyRef ?? '')
  return m ? Number(m[1]) : null
}

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
/**
 * Phase-10: closes the Treasury supplier-payment ↔ AP subledger gap
 * documented (not fixed) in Phase 9. Discovery confirmed the model already
 * has everything needed: `purchase_payments.document_id` is nullable —
 * exactly the "one row per allocated invoice" shape `sales_payments`
 * already uses for receipts — and `purchase_documents.paid_total` gives an
 * exact per-invoice outstanding balance (a stronger signal than the
 * receipt side even has). Reuses `allocateReceipt` UNCHANGED (it is
 * already generic — amount + a list of {id, open} — not sales-specific;
 * no second allocation engine was written) against the vendor's open
 * invoices, resolved from `party_ref` (`vendor:N`). Runs inside the SAME
 * transaction/lock this function already had — one commit covers the
 * status transition, every allocated `purchase_payments` row, each
 * invoice's `paid_total`/status update, and the GL post; a failure at any
 * point rolls back all of it. If `party_ref` doesn't identify a vendor
 * (or the vendor has no open invoices), the payment still posts its GL
 * entry exactly as before — no invoice-level information to allocate
 * against is the honest, existing "nothing to match" case, not an error.
 */
export async function processPayment(id: number, user: AdminUser): Promise<{ glEntryId: number; alreadyProcessed: boolean; apAllocations: { invoiceId: number; amount: number }[]; unappliedAmount: number }> {
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_payment_process:${id}`])
    const p = (await query<{ status: string; payment_type: PaymentType; amount: number; date: string; party: string | null; party_ref: string | null; gl_entry_id: number | null }>(
      `SELECT status, payment_type, amount::float AS amount, date, party, party_ref, gl_entry_id FROM payment_orders WHERE id=$1`, [id]))[0]
    if (!p) throw new Error('Payment not found')
    if (p.status === 'completed') {
      const unapplied = (await query<{ s: number }>(`SELECT COALESCE(SUM(amount),0)::float AS s FROM purchase_payments WHERE reference=$1 AND document_id IS NULL`, [`TRZPAY-${id}`]))[0]
      return { glEntryId: p.gl_entry_id!, alreadyProcessed: true, apAllocations: [], unappliedAmount: Number(unapplied.s) }
    }
    if (p.status !== 'approved') throw new Error(`Payment must be approved before processing (is ${p.status})`)
    await query(`UPDATE payment_orders SET status='processing', updated_at=${NOW} WHERE id=$1`, [id])

    // Post the GL entry FIRST (one entry for the whole payment amount,
    // matching every other Treasury payment) so its id can be stamped onto
    // every allocated purchase_payments row below — without that stamp,
    // Phase-7's postPurchasePaymentToGl (gl_entry_id-IS-NULL-guarded) could
    // later run on one of these rows and post a SECOND, duplicate GL entry
    // for money this Treasury payment already booked (the exact
    // cross-module double-post class closed for receipts in Phase 8).
    const glId = await postGl(query, paymentGlLines(p.payment_type, Number(p.amount)), `Payment ${p.payment_type} ${p.party ?? ''}`.trim(), `TRZPAY-${id}`, p.date, user.id)

    let apAllocations: { invoiceId: number; amount: number }[] = []
    let unappliedAmount = 0
    if (p.payment_type === 'supplier_payment') {
      let vendorId = vendorIdFromPartyRef(p.party_ref)
      // party_ref is free text, not a real FK — a stale/typo'd/nonexistent
      // vendor id must never reach an INSERT (would violate purchase_payments'
      // vendor_id FK). Confirm the vendor actually exists before allocating
      // or recording any unapplied amount against it.
      if (vendorId != null) {
        const vendorExists = await query<{ id: number }>(`SELECT id FROM purchase_vendors WHERE id=$1`, [vendorId])
        if (vendorExists.length === 0) vendorId = null
      }
      if (vendorId != null) {
        // Phase 11 fix: the `treasury_payment_process:${id}` lock above only
        // serializes calls against the SAME payment id — it does nothing for
        // two DIFFERENT payments racing to allocate against the SAME
        // vendor's open invoices. Without a vendor-scoped lock, both
        // transactions can read an invoice's pre-race "open" balance before
        // either commits, each correctly compute their OWN incremental
        // update against a freshly re-read paid_total, and still drive
        // paid_total past the invoice's own total (a real overpay, not
        // merely a lost update — verified live under
        // scripts/verify-phase11-financial-controls.ts). Serialize the
        // whole allocation decision per vendor so a second concurrent
        // payment always sees the first payment's committed allocation.
        await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_ap_allocate:vendor:${vendorId}`])
        // Oldest-first, same discipline as the receipt side — never more
        // than each invoice's real outstanding balance (paid_total-aware,
        // so this is exact, not the receipt side's "no partial tracking"
        // approximation).
        const invs = await query<{ id: number; open: number }>(
          `SELECT id, (total - paid_total)::float AS open FROM purchase_documents
           WHERE vendor_id=$1 AND doc_type='invoice' AND status IN ('confirmed','partial') AND (total - paid_total) > 0.001
           ORDER BY date`, [vendorId])
        const alloc = allocateReceipt(Number(p.amount), invs.map(i => ({ id: i.id, open: Number(i.open) })))
        apAllocations = alloc.allocations
        for (const a of apAllocations) {
          await query(
            `INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, created_at) VALUES ($1,$2,$3,$4,'bank',$5,$6,$7,${NOW})`,
            [vendorId, a.invoiceId, p.date, a.amount, `TRZPAY-${id}`, user.id, glId])
          const inv = (await query<{ total: number; paid_total: number }>(`SELECT total::float AS total, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [a.invoiceId]))[0]
          const paid = Number(inv.paid_total) + a.amount
          const status = paid + 0.001 >= Number(inv.total) ? 'paid' : 'partial'
          await query(`UPDATE purchase_documents SET paid_total=$2, status=$3, updated_at=${NOW} WHERE id=$1`, [a.invoiceId, paid, status])
        }
        // Phase 11: money conservation — payment amount = Σ allocated + unapplied.
        // Any amount `allocateReceipt` couldn't place against an open invoice
        // (the vendor's open AP is smaller than the payment) is NEVER
        // discarded and NEVER used to push an invoice's paid_total past its
        // own total. It is recorded as its own purchase_payments row with
        // document_id=NULL — reusing the EXISTING nullable column (no schema
        // change, no new "advance" table/column) — vendor_id set, tagged
        // with the SAME gl_entry_id. `vendorPosition`'s AP balance query
        // (`SUM(amount) FROM purchase_payments WHERE vendor_id=$1`, no
        // document_id filter) already includes this row with zero code
        // changes, correctly showing the vendor's balance go negative — a
        // vendor debit balance / prepayment, exactly how an over-returned
        // customer credit already surfaces elsewhere in this codebase
        // (shown, never floored at zero). Future-invoice consumption of
        // this balance is intentionally NOT implemented — the symmetric
        // customer-side concept (`receipt_transactions.advance`) has been
        // record-only with no consumption path since Phase 8, so building
        // consumption only for suppliers would be a one-sided capability
        // with no evidenced product need; documented in
        // docs/engineering/phase11-treasury-unapplied-cash-audit.md.
        if (alloc.advance > 0.001) {
          unappliedAmount = alloc.advance
          await query(
            `INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, note, created_at) VALUES ($1,NULL,$2,$3,'bank',$4,$5,$6,$7,${NOW})`,
            [vendorId, p.date, alloc.advance, `TRZPAY-${id}`, user.id, glId, 'Unapplied supplier payment (exceeds open AP at processing time)'])
        }
      }
    }

    await query(`UPDATE payment_orders SET status='completed', gl_entry_id=$2, updated_at=${NOW} WHERE id=$1`, [id, glId])
    return { glEntryId: glId, alreadyProcessed: false, apAllocations, unappliedAmount }
  })
}

// ── Supplier prepayment consumption (Phase 12) ───────────────────────────────
/**
 * Phase 12: consumes a vendor's existing unapplied Treasury cash (Phase 11's
 * document_id=NULL purchase_payments rows) against that vendor's currently
 * open invoices — the "future-invoice consumption" half of the unapplied-cash
 * lifecycle Phase 11 deliberately left undone.
 *
 * Schema decision (see docs/engineering/phase12-supplier-prepayment-audit.md):
 * no migration, no new columns. An unapplied SOURCE row's remaining balance is
 * derived, never mutated — `purchase_payments` rows stay append-only (the same
 * discipline BUG-020/CC-family already enforces for the GL). Consuming amount
 * X of source row S against invoice I writes exactly TWO new rows sharing the
 * reference `AP-CONSUME:${S.id}`:
 *   - a NEGATIVE adjustment (vendor_id=S.vendor_id, document_id=NULL, amount=-X)
 *   - a POSITIVE allocation (document_id=I,        amount=+X)
 * Both stamped with SOURCE row S's own gl_entry_id — never NULL. This is not
 * cosmetic: `postPurchasePaymentToGl` treats gl_entry_id IS NULL as "a real
 * cash payment nobody posted yet" and will post a brand-new Dr AP/Cr Bank
 * entry for it. Since consumption moves already-paid cash between subledger
 * buckets (unapplied → a specific invoice) with NO new bank movement, leaving
 * gl_entry_id null would create a phantom, duplicate cash-out entry the first
 * time anything called that poster. Reusing S's existing (already-posted)
 * gl_entry_id makes both new rows correctly inert to that poster (Section 8:
 * option A — no new GL event, by design) while remaining fully traceable back
 * to the Treasury payment that actually moved the cash.
 *
 * A source row's remaining balance = its own amount + Σ(negative adjustment
 * rows whose reference is `AP-CONSUME:${source.id}`) — computed fresh from the
 * database on every call, so re-running this function (after a partial
 * consumption, or with nothing left to consume) is naturally idempotent: it
 * just finds a smaller/zero remaining balance and does correspondingly less
 * or nothing. Distribution is oldest-source-first × oldest-invoice-first,
 * reusing `allocateReceipt` unchanged as the per-source distribution
 * primitive — no second allocation engine.
 *
 * Concurrency: locks the SAME `treasury_ap_allocate:vendor:${vendorId}`
 * advisory key `processPayment` already takes before its own AP allocation —
 * deliberately the same lock domain, not a new one, so a new Treasury
 * payment being processed for this vendor and a consumption run for this
 * vendor can never interleave (Section 5, Scenario F).
 */
export interface ConsumptionDetail { sourceId: number; invoiceId: number; amount: number }
export async function consumeUnappliedForVendor(vendorId: number, userId: string, date?: string): Promise<{ totalConsumed: number; details: ConsumptionDetail[] }> {
  const today = date ?? new Date().toISOString().slice(0, 10)
  return withTransaction(async query => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`treasury_ap_allocate:vendor:${vendorId}`])

    // Every still-open unapplied SOURCE row, oldest first, with its remaining
    // (unconsumed) balance derived from the append-only ledger — never a
    // stored/mutated counter.
    const sources = await query<{ id: number; amount: number; gl_entry_id: number | null; consumed: number }>(
      `SELECT s.id, s.amount::float AS amount, s.gl_entry_id,
              COALESCE((SELECT SUM(-c.amount) FROM purchase_payments c
                        WHERE c.document_id IS NULL AND c.reference = 'AP-CONSUME:'||s.id), 0)::float AS consumed
       FROM purchase_payments s
       WHERE s.vendor_id = $1 AND s.document_id IS NULL AND s.amount > 0
       ORDER BY s.date, s.id`, [vendorId])

    const invRows = await query<{ id: number; open: number }>(
      `SELECT id, (total - paid_total)::float AS open FROM purchase_documents
       WHERE vendor_id=$1 AND doc_type='invoice' AND status IN ('confirmed','partial') AND (total - paid_total) > 0.001
       ORDER BY date, id`, [vendorId])
    const invoicePool = invRows.map(r => ({ id: r.id, open: Math.round(Number(r.open) * 100) / 100 }))

    const details: ConsumptionDetail[] = []
    let totalConsumed = 0
    for (const src of sources) {
      const remaining = Math.round((Number(src.amount) - Number(src.consumed)) * 100) / 100
      if (remaining <= 0.001) continue
      if (!invoicePool.some(i => i.open > 0.001)) break

      const { allocations } = allocateReceipt(remaining, invoicePool)
      for (const a of allocations) {
        await query(
          `INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, note, created_at) VALUES ($1,NULL,$2,$3,'bank',$4,$5,$6,$7,${NOW})`,
          [vendorId, today, -a.amount, `AP-CONSUME:${src.id}`, userId, src.gl_entry_id, `Unapplied payment #${src.id} consumed against invoice #${a.invoiceId}`])
        await query(
          `INSERT INTO purchase_payments (vendor_id, document_id, date, amount, method, reference, created_by, gl_entry_id, note, created_at) VALUES ($1,$2,$3,$4,'bank',$5,$6,$7,$8,${NOW})`,
          [vendorId, a.invoiceId, today, a.amount, `AP-CONSUME:${src.id}`, userId, src.gl_entry_id, `Settled from unapplied payment #${src.id}`])

        const inv = (await query<{ total: number; paid_total: number }>(`SELECT total::float AS total, paid_total::float AS "paid_total" FROM purchase_documents WHERE id=$1`, [a.invoiceId]))[0]
        const paid = Math.round((Number(inv.paid_total) + a.amount) * 100) / 100
        const status = paid + 0.001 >= Number(inv.total) ? 'paid' : 'partial'
        await query(`UPDATE purchase_documents SET paid_total=$2, status=$3, updated_at=${NOW} WHERE id=$1`, [a.invoiceId, paid, status])

        details.push({ sourceId: src.id, invoiceId: a.invoiceId, amount: a.amount })
        totalConsumed = Math.round((totalConsumed + a.amount) * 100) / 100
        const pool = invoicePool.find(i => i.id === a.invoiceId)!
        pool.open = Math.round((pool.open - a.amount) * 100) / 100
      }
    }
    return { totalConsumed, details }
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
