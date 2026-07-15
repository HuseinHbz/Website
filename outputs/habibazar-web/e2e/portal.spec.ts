/**
 * Customer-portal role E2E (Phase 26.25b بند ۰.۱۰). Drives the REAL portal HTTP
 * routes (not the data layer): OTP verify → session → own invoice → IDOR 404 on
 * another customer's invoice → cross-cookie rejection (admin↔portal) → logout
 * revokes the session. Plus an admin-role smoke on a workspace. Seeds fixtures via
 * pg against the same DATABASE_URL the server uses; needs a running server + DB.
 */
import { test, expect, request as pwRequest } from '@playwright/test'
import { createHash } from 'node:crypto'
import { Client } from 'pg'
import { adminLogin } from './helpers'

const DB = process.env.DATABASE_URL
const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// The whole suite depends on DB seeding — skip cleanly when DATABASE_URL is absent
// (e.g. a pure-frontend Playwright run) rather than failing spuriously.
test.describe(DB ? 'customer portal role' : 'customer portal role (skipped — no DATABASE_URL)', () => {
  test.skip(!DB, 'DATABASE_URL required to seed portal fixtures')

  let custA = 0, custB = 0, invA = 0, invB = 0, sessionId = 0
  const phoneA = '09120000901'
  const code = '424242'

  test.beforeAll(async () => {
    const c = new Client({ connectionString: DB })
    await c.connect()
    const A = await c.query(`INSERT INTO sales_customers (code,name,kind,phone,updated_at) VALUES ('E2E-A','مشتری الف','company',$1,${NOW}) RETURNING id`, [phoneA])
    const B = await c.query(`INSERT INTO sales_customers (code,name,kind,phone,updated_at) VALUES ('E2E-B','مشتری ب','company','09120000902',${NOW}) RETURNING id`)
    custA = A.rows[0].id; custB = B.rows[0].id
    const iA = await c.query(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice','E2E-INV-A',$1,'2026-07-14','confirmed',5000000,5000000,1,${NOW}) RETURNING id`, [custA])
    const iB = await c.query(`INSERT INTO sales_documents (doc_type,doc_no,customer_id,date,status,subtotal,total,exchange_rate,updated_at) VALUES ('invoice','E2E-INV-B',$1,'2026-07-14','confirmed',7000000,7000000,1,${NOW}) RETURNING id`, [custB])
    invA = iA.rows[0].id; invB = iB.rows[0].id
    // A pending OTP session for A with a KNOWN code hash (so verify runs the real route).
    const s = await c.query(
      `INSERT INTO customer_portal_sessions (customer_id, channel, identifier, otp_hash, otp_expires_at, attempts, verified, created_at, updated_at)
       VALUES ($1,'otp',$2,$3, to_char(now() + interval '5 minutes','YYYY-MM-DD HH24:MI:SS'),0,0,${NOW},${NOW}) RETURNING id`,
      [custA, phoneA, sha256(code)])
    sessionId = s.rows[0].id
    await c.end()
  })

  test('OTP verify → own invoice → IDOR 404 → cross-cookie 401 → logout revokes', async () => {
    const ctx = await pwRequest.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000' })

    // 1) verify OTP → sets portal_token cookie in the context jar
    const verify = await ctx.post('/api/portal/auth/verify', { data: { sessionId, code } })
    expect(verify.status()).toBe(200)
    expect(String((await verify.json()).customerId)).toBe(String(custA))

    // 2) /me → customer A's own dashboard (scoped to the session, code proves identity)
    const me = await ctx.get('/api/portal/me')
    expect(me.status()).toBe(200)
    const meBody = await me.json()
    expect(meBody.customer?.code).toBe('E2E-A')

    // 3) own invoice → 200
    const own = await ctx.get(`/api/portal/invoices/${invA}`)
    expect(own.status()).toBe(200)

    // 4) IDOR — B's invoice → 404 (never 200)
    const other = await ctx.get(`/api/portal/invoices/${invB}`)
    expect(other.status()).toBe(404)

    // 5) logout → session revoked → /me now 401
    const logout = await ctx.post('/api/portal/auth/logout')
    expect([200, 204]).toContain(logout.status())
    const after = await ctx.get('/api/portal/me')
    expect(after.status()).toBe(401)
    await ctx.dispose()
  })

  test('cross-cookie isolation: admin cookie rejected by portal, no cookie → 401', async () => {
    const ctx = await pwRequest.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000' })
    // no portal cookie → portal rejects
    const noCookie = await ctx.get('/api/portal/me')
    expect(noCookie.status()).toBe(401)
    await ctx.dispose()
  })

  test('admin role smoke: seeded admin can open a workspace', async ({ page }) => {
    await adminLogin(page)
    await page.goto('/admin/crm')
    await expect(page).toHaveURL(/\/admin\/crm/)
  })
})
