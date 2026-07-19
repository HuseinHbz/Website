/**
 * Vendor Portal data layer (Phase 26.1) — token-gated, READ-ONLY external
 * access for suppliers. No second auth system: an admin issues a high-entropy
 * magic link (128-bit token, expiring, revocable); the public page shows only
 * that vendor's own documents, payments and balance. Every access refreshes
 * last_used_at for auditability.
 */
import { randomBytes } from 'crypto'
import { pgQuery } from '@/lib/db'
import { vendorPayable } from './purchasing'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const num = (v: unknown) => Number(v ?? 0)

/** Issue (or reissue) a portal token for a vendor. Default validity: 90 days. */
export async function issueVendorToken(vendorId: number, createdBy?: string, days = 90): Promise<string> {
  const token = randomBytes(16).toString('hex') // 128-bit
  const expires = new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  await pgQuery(
    `INSERT INTO vendor_portal_tokens (vendor_id, token, expires_at, created_by, created_at) VALUES ($1,$2,$3,$4,${NOW})`,
    [vendorId, token, expires, createdBy ?? null])
  return token
}

/** Revoke every active token of a vendor. */
export async function revokeVendorTokens(vendorId: number): Promise<number> {
  const r = await pgQuery<{ id: number }>(`UPDATE vendor_portal_tokens SET revoked=true WHERE vendor_id=$1 AND revoked=false RETURNING id`, [vendorId])
  return r.length
}

export interface PortalData {
  vendor: { name: string; code: string; grade: string; currency: string }
  documents: { docNo: string | null; docType: string; date: string; status: string; total: number; paidTotal: number }[]
  payments: { date: string; amount: number; method: string; reference: string | null }[]
  outstanding: number
}

/** Resolve a portal token to that vendor's read-only view; null when invalid. */
export async function portalData(token: string): Promise<PortalData | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null
  const t = (await pgQuery<{ id: number; vendor_id: number; expires_at: string; revoked: boolean }>(
    `SELECT id, vendor_id, expires_at, revoked FROM vendor_portal_tokens WHERE token=$1`, [token]))[0]
  if (!t || t.revoked) return null
  if (t.expires_at.replace(' ', 'T') < new Date().toISOString().slice(0, 19)) return null
  await pgQuery(`UPDATE vendor_portal_tokens SET last_used_at=${NOW} WHERE id=$1`, [t.id])

  const v = (await pgQuery<{ name: string; code: string; grade: string; currency: string }>(
    `SELECT name, code, grade, currency FROM purchase_vendors WHERE id=$1 AND active=true`, [t.vendor_id]))[0]
  if (!v) return null
  const documents = (await pgQuery<{ doc_no: string | null; doc_type: string; date: string; status: string; total: number; paid_total: number }>(
    `SELECT doc_no, doc_type, date, status, total::float AS total, paid_total::float AS paid_total
     FROM purchase_documents WHERE vendor_id=$1 AND status NOT IN ('draft') ORDER BY date DESC LIMIT 100`, [t.vendor_id]))
    .map(d => ({ docNo: d.doc_no, docType: d.doc_type, date: d.date, status: d.status, total: num(d.total), paidTotal: num(d.paid_total) }))
  const payments = (await pgQuery<{ date: string; amount: number; method: string; reference: string | null }>(
    `SELECT date, amount::float AS amount, method, reference FROM purchase_payments WHERE vendor_id=$1 ORDER BY date DESC LIMIT 100`, [t.vendor_id]))
    .map(p => ({ date: p.date, amount: num(p.amount), method: p.method, reference: p.reference }))
  const inv = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total),0) AS t FROM purchase_documents WHERE vendor_id=$1 AND doc_type='invoice' AND status NOT IN ('void','draft')`, [t.vendor_id]))[0]?.t)
  const paid = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(amount),0) AS t FROM purchase_payments WHERE vendor_id=$1`, [t.vendor_id]))[0]?.t)
  const cn = num((await pgQuery<{ t: number }>(`SELECT COALESCE(SUM(total),0) AS t FROM purchase_documents WHERE vendor_id=$1 AND doc_type='credit_note' AND status NOT IN ('void','draft')`, [t.vendor_id]))[0]?.t)
  return { vendor: v, documents, payments, outstanding: vendorPayable({ invoicedTotal: inv, paidTotal: paid, creditNotesTotal: cn }).outstanding }
}
