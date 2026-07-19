import { test, request as pwRequest } from '@playwright/test'
import { createHash } from 'node:crypto'
import { Client } from 'pg'
const DB = process.env.DATABASE_URL
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
test('debug otp full', async () => {
  const c = new Client({ connectionString: DB })
  await c.connect()
  const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
  const codeA = `E2E-A-${RUN}`, codeB = `E2E-B-${RUN}`
  const phoneA = `0912${String(Date.now()).slice(-7)}`
  const phoneB = `0913${String(Date.now()).slice(-7)}`
  const code = '424242'
  const A = await c.query(`INSERT INTO sales_customers (code,name,kind,phone,updated_at) VALUES ($1,'مشتری الف','company',$2,${NOW}) RETURNING id`, [codeA, phoneA])
  const B = await c.query(`INSERT INTO sales_customers (code,name,kind,phone,updated_at) VALUES ($1,'مشتری ب','company',$2,${NOW}) RETURNING id`, [codeB, phoneB])
  const custA = A.rows[0].id, custB = B.rows[0].id
  await c.query(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice',$2,$1,'2026-07-14','confirmed',5000000,5000000,1,${NOW}) RETURNING id`, [custA, `E2E-INV-A-${RUN}`])
  await c.query(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice',$2,$1,'2026-07-14','confirmed',7000000,7000000,1,${NOW}) RETURNING id`, [custB, `E2E-INV-B-${RUN}`])
  const s = await c.query(
    `INSERT INTO customer_portal_sessions (customer_id, channel, identifier, otp_hash, otp_expires_at, attempts, verified, created_at, updated_at)
     VALUES ($1,'otp',$2,$3, to_char(now() + interval '5 minutes','YYYY-MM-DD HH24:MI:SS'),0,0,${NOW},${NOW}) RETURNING id`,
    [custA, phoneA, sha256(code)])
  const sessionId = s.rows[0].id
  console.log('sessionId', sessionId, 'typeof', typeof sessionId)
  const ctx = await pwRequest.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000' })
  const verify = await ctx.post('/api/portal/auth/verify', { data: { sessionId, code } })
  console.log('verify', verify.status(), await verify.text())
  const row = await c.query(`SELECT id, attempts, verified, revoked, otp_hash IS NULL AS hash_gone, otp_expires_at FROM customer_portal_sessions WHERE id=$1`, [sessionId])
  console.log('row after', JSON.stringify(row.rows[0]))
  await c.end()
})
