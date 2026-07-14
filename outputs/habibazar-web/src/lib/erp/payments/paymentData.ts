/**
 * Payment gateway data layer (Phase 26.24 بند ۴.۲). Creates a payment
 * transaction, hands off to the provider, and on verify reconciles it into
 * sales_payments + auto-posts the GL receipt (reuses 26.23 postSalesPaymentToGl).
 */
import { pgQuery } from '@/lib/db'
import { getProvider } from './gateway'
import { postSalesPaymentToGl } from '@/lib/erp/glPosting'
import { invoiceStatus } from '@/lib/erp/sales'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

async function providerConfig(provider: string) {
  const rows = await pgQuery<{ key: string; value: string }>(
    `SELECT key, value FROM erp_settings WHERE key IN ($1,$2)`, [`pay_${provider}_merchant`, 'pay_sandbox'])
  const m = new Map(rows.map(r => [r.key, r.value]))
  return { merchantId: m.get(`pay_${provider}_merchant`) || undefined, sandbox: (m.get('pay_sandbox') ?? 'true') !== 'false' }
}

/** Create a gateway payment for a sales invoice → redirect URL. */
export async function createPayment(input: { provider: string; documentId?: number; customerId?: number; amount: number; description: string; callbackUrl: string; mobile?: string }): Promise<{ ok: boolean; txId?: number; redirectUrl?: string; error?: string }> {
  const cfg = await providerConfig(input.provider)
  const tx = (await pgQuery<{ id: number }>(
    `INSERT INTO payment_transactions (provider, document_id, customer_id, amount, currency, status, description, callback_url, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'IRR','created',$5,$6,${NOW},${NOW}) RETURNING id`,
    [input.provider, input.documentId ?? null, input.customerId ?? null, input.amount, input.description, input.callbackUrl]))[0]
  const res = await getProvider(input.provider).init(
    { amount: input.amount, description: input.description, callbackUrl: `${input.callbackUrl}?tx=${tx.id}`, mobile: input.mobile }, cfg)
  if (!res.ok) {
    await pgQuery(`UPDATE payment_transactions SET status='failed', updated_at=${NOW} WHERE id=$1`, [tx.id])
    return { ok: false, txId: tx.id, error: res.error }
  }
  await pgQuery(`UPDATE payment_transactions SET authority=$2, status='pending', updated_at=${NOW} WHERE id=$1`, [tx.id, res.authority])
  return { ok: true, txId: tx.id, redirectUrl: res.redirectUrl }
}

/** Verify a gateway callback → reconcile to sales_payments + post the GL receipt. */
export async function verifyPayment(txId: number, userId?: string): Promise<{ ok: boolean; refId?: string; paymentId?: number; error?: string }> {
  const tx = (await pgQuery<{ id: number; provider: string; authority: string | null; amount: number; status: string; document_id: number | null; customer_id: number | null; sales_payment_id: number | null }>(
    `SELECT id, provider, authority, amount::float AS amount, status, document_id, customer_id, sales_payment_id FROM payment_transactions WHERE id=$1`, [txId]))[0]
  if (!tx) return { ok: false, error: 'Transaction not found' }
  if (tx.status === 'verified' && tx.sales_payment_id) return { ok: true, paymentId: tx.sales_payment_id }
  if (!tx.authority) return { ok: false, error: 'No provider authority' }

  const cfg = await providerConfig(tx.provider)
  const res = await getProvider(tx.provider).verify(tx.authority, num(tx.amount), cfg)
  if (!res.ok) {
    await pgQuery(`UPDATE payment_transactions SET status='failed', updated_at=${NOW} WHERE id=$1`, [txId])
    return { ok: false, error: res.error }
  }

  // Reconcile: create the sales_payment (if tied to an invoice), post the GL.
  let paymentId: number | undefined
  if (tx.document_id && tx.customer_id) {
    const pay = (await pgQuery<{ id: number }>(
      `INSERT INTO sales_payments (customer_id, document_id, date, amount, method, reference, currency, exchange_rate)
       VALUES ($1,$2,to_char(now(),'YYYY-MM-DD'),$3,'card',$4,'IRR',1) RETURNING id`,
      [tx.customer_id, tx.document_id, num(tx.amount), res.refId ?? `PAY-${txId}`]))[0]
    paymentId = pay.id
    // Recompute invoice paid-status + auto-post the receipt to the GL.
    const doc = (await pgQuery<{ total: number }>(`SELECT total::float AS total FROM sales_documents WHERE id=$1`, [tx.document_id]))[0]
    const paid = num((await pgQuery<{ p: number }>(`SELECT COALESCE(SUM(amount),0)::float AS p FROM sales_payments WHERE document_id=$1`, [tx.document_id]))[0]?.p)
    await pgQuery(`UPDATE sales_documents SET status=$2, updated_at=${NOW} WHERE id=$1`, [tx.document_id, invoiceStatus(num(doc.total), paid)])
    try { await postSalesPaymentToGl(pay.id, userId) } catch { /* stays unposted; self-heal can post */ }
  }
  await pgQuery(`UPDATE payment_transactions SET status='verified', ref_id=$2, sales_payment_id=$3, updated_at=${NOW} WHERE id=$1`, [txId, res.refId ?? null, paymentId ?? null])
  return { ok: true, refId: res.refId, paymentId }
}
