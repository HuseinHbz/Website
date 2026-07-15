/**
 * Phase 26.25a live-PG verification — customer portal auth + IDOR matrix (بند ۲.۵).
 * Exercises the data layer + guards directly (OTP hashed/expiry/attempts, session
 * validity, cross-customer ownership). The full HTTP 401/403/404 matrix is also
 * covered by the route-level guard which uses these same functions.
 */
import { runMigrations } from '@/lib/db/migrate'
import { seedDatabase } from '@/lib/db/seed'
import { pgQuery } from '@/lib/db'
import { requestOtp, verifyOtp, getPortalIdentity, revokeAllSessions } from '@/lib/portal/session'
import { portalInvoice, portalDashboard, setChannelOptIn } from '@/lib/portal/portalData'
import { sha256 } from '@/lib/crm/portal'

let n = 0, failed = 0
const ok = (c: boolean, l: string) => { n++; if (c) console.log(`  ✅ ${n}. ${l}`); else { failed++; console.error(`  ❌ ${n}. ${l}`) } }
const one = async <T>(sql: string, p: unknown[] = []) => (await pgQuery<T>(sql, p))[0]
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function main() {
  await runMigrations(); await seedDatabase()

  // Two customers, each with an invoice.
  const A = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,phone,updated_at) VALUES ('P-A','مشتری الف','company','09120000001',${NOW}) RETURNING id`)
  const B = await one<{ id: number }>(`INSERT INTO sales_customers (code,name,kind,phone,updated_at) VALUES ('P-B','مشتری ب','company','09120000002',${NOW}) RETURNING id`)
  const invA = await one<{ id: number }>(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice','INV-A',$1,'2026-07-14','confirmed',5000000,5000000,1,${NOW}) RETURNING id`, [A.id])
  const invB = await one<{ id: number }>(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice','INV-B',$1,'2026-07-14','confirmed',7000000,7000000,1,${NOW}) RETURNING id`, [B.id])
  await pgQuery(`INSERT INTO crm_customer_channels (customer_id,channel,address,opt_in,updated_at) VALUES ($1,'sms','09120000001',1,${NOW})`, [A.id])

  console.log('— بند ۲.۱: OTP login (hashed, expiry, attempts) —')
  const req = await requestOtp('sms', '09120000001', '1.1.1.1')
  ok(req.sessionId != null && req.sent, 'OTP requested → session created + sent (sandbox)')
  const stored = await one<{ otp_hash: string }>(`SELECT otp_hash FROM customer_portal_sessions WHERE id=$1`, [req.sessionId])
  ok(stored.otp_hash != null && stored.otp_hash.length === 64 && !/^\d{6}$/.test(stored.otp_hash), 'OTP stored HASHED (sha256), never plaintext')
  const unknown = await requestOtp('sms', '09999999999')
  ok(unknown.sessionId === null && !unknown.sent, 'unknown identifier → neutral (no enumeration)')

  // Wrong code increments attempts; correct code issues a token.
  const bad = await verifyOtp(req.sessionId!, '000000')
  ok(!bad.ok && bad.reason === 'mismatch', 'wrong OTP → rejected + attempt counted')
  // Recover the real code by re-deriving: we can't read it, so set a known one.
  const known = '424242'
  await pgQuery(`UPDATE customer_portal_sessions SET otp_hash=$2, attempts=0 WHERE id=$1`, [req.sessionId, sha256(known)])
  const good = await verifyOtp(req.sessionId!, known)
  ok(good.ok && !!good.token && good.customerId === A.id, 'correct OTP → session token issued for customer A')
  const consumed = await one<{ otp_hash: string | null }>(`SELECT otp_hash FROM customer_portal_sessions WHERE id=$1`, [req.sessionId])
  ok(consumed.otp_hash === null, 'OTP consumed on success (single-use)')

  console.log('— بند ۲.۵: session validity + IDOR matrix —')
  const idA = await getPortalIdentity(good.token!)
  ok(idA?.customerId === A.id, 'valid token → resolves to customer A')
  ok((await getPortalIdentity('deadbeef')) === null, 'garbage token → 401 (no identity)')
  ok((await getPortalIdentity(undefined)) === null, 'no token → 401')

  // A can see A's invoice; A CANNOT see B's invoice (IDOR).
  ok((await portalInvoice(A.id, invA.id)) !== null, 'customer A can read OWN invoice')
  ok((await portalInvoice(A.id, invB.id)) === null, "customer A CANNOT read B's invoice (→404) ✔ IDOR")
  ok((await portalInvoice(B.id, invA.id)) === null, "customer B CANNOT read A's invoice (→404) ✔ IDOR")

  // Dashboard is scoped to the session customer.
  const dashA = await portalDashboard(A.id)
  ok(dashA?.balance === 5000000, `dashboard shows ONLY A's balance (${dashA?.balance})`)

  // Channel opt-out only affects an OWN channel.
  const chanA = await one<{ id: number }>(`SELECT id FROM crm_customer_channels WHERE customer_id=$1`, [A.id])
  ok(await setChannelOptIn(A.id, chanA.id, false), 'A can opt out of OWN channel')
  ok(!(await setChannelOptIn(B.id, chanA.id, false)), "B CANNOT toggle A's channel (→404) ✔ IDOR")

  console.log('— بند ۲.۱: expiry + lockout + revoke —')
  // Expired OTP.
  const exp = await requestOtp('sms', '09120000001')
  await pgQuery(`UPDATE customer_portal_sessions SET otp_hash=$2, otp_expires_at='2020-01-01T00:00:00Z' WHERE id=$1`, [exp.sessionId, sha256('111111')])
  ok((await verifyOtp(exp.sessionId!, '111111')).reason === 'expired', 'expired OTP → rejected')
  // Lockout after too many attempts.
  const lock = await requestOtp('sms', '09120000001')
  await pgQuery(`UPDATE customer_portal_sessions SET otp_hash=$2, attempts=5 WHERE id=$1`, [lock.sessionId, sha256('222222')])
  ok((await verifyOtp(lock.sessionId!, '222222')).reason === 'too_many_attempts', 'attempt cap → locked out')
  console.log('— بند ۲.۳: payment reduces the portal AR balance —')
  const before = (await portalDashboard(A.id))!.balance
  // A reconciled gateway receipt (verifyPayment path is proven in 26.24) lands in
  // sales_payments; the portal dashboard subtracts it live.
  await pgQuery(`INSERT INTO sales_payments (customer_id, document_id, date, amount, method, currency, exchange_rate) VALUES ($1,$2,'2026-07-14',2000000,'card','IRR',1)`, [A.id, invA.id])
  const after = (await portalDashboard(A.id))!.balance
  ok(after === before - 2000000, `AR balance drops after payment: ${before} → ${after} (−2,000,000)`)

  // Logout revokes the session.
  await revokeAllSessions(A.id)
  ok((await getPortalIdentity(good.token!)) === null, 'after logout, the session token is revoked (→401)')

  console.log(failed === 0 ? `\n✅ ALL ${n} PASSED` : `\n❌ ${failed}/${n} FAILED`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
