import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

/**
 * 26.27 بند ۷ E2E — four users, tree grants set through the real permissions
 * API, enforcement observed on real routes and in the rendered menu.
 *   super_admin        — full access (storageState from global-setup)
 *   finance specialist — erp.finance write WITHOUT :post → draft 200, post 403
 *   auditor            — read grants only → writes 403
 *   employee           — erp none → ERP GET 403 + ERP absent from the sidebar
 */

const PASS = 'Rbac2627!Test'
const USERS = [
  { key: 'fs', name: 'RBAC Finance Spec', email: 'rbac-fs@test.ir', role: 'editor' },
  { key: 'aud', name: 'RBAC Auditor', email: 'rbac-aud@test.ir', role: 'auditor' },
  { key: 'emp', name: 'RBAC Employee', email: 'rbac-emp@test.ir', role: 'editor' },
] as const

test.describe.configure({ mode: 'serial' })

let ids: Record<string, string> = {}

async function login(baseURL: string, email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL })
  const r = await ctx.post('/api/admin/auth/login', { data: { email, password: PASS } })
  expect(r.ok(), `login ${email}`).toBeTruthy()
  return ctx
}

test('setup: create users and assign tree grants via the permissions API', async ({ request, baseURL }) => {
  const list = await (await request.get('/api/admin/users')).json()
  for (const u of USERS) {
    const existing = Array.isArray(list) ? list.find((x: { email: string }) => x.email === u.email) : null
    if (existing) { ids[u.key] = existing.id; continue }
    const r = await request.post('/api/admin/users', { data: { name: u.name, email: u.email, password: PASS, role: u.role } })
    expect(r.ok()).toBeTruthy()
    ids[u.key] = (await r.json()).id
  }
  const grant = (uid: string, body: object) => request.post(`/api/admin/users/${uid}/permissions`, { data: body })
  // finance specialist: erp.finance write, :post explicitly denied
  expect((await grant(ids.fs, { action: 'grant', key: 'erp.finance', level: 'write' })).ok()).toBeTruthy()
  expect((await grant(ids.fs, { action: 'op', opKey: 'erp.finance:post', allowed: false })).ok()).toBeTruthy()
  // auditor: read on erp
  expect((await grant(ids.aud, { action: 'grant', key: 'erp', level: 'read' })).ok()).toBeTruthy()
  // employee: erp denied entirely
  expect((await grant(ids.emp, { action: 'grant', key: 'erp', level: 'none' })).ok()).toBeTruthy()
})

test('finance specialist: journal draft 200, post 403 (op not implied by write)', async ({ baseURL }) => {
  const ctx = await login(baseURL!, 'rbac-fs@test.ir')
  const accounts = await (await ctx.get('/api/admin/erp/finance/accounts')).json()
  const flat = (accounts.accounts ?? accounts ?? []) as { id: number }[]
  expect(flat.length).toBeGreaterThan(1)
  const draft = await ctx.post('/api/admin/erp/finance/journal', {
    data: { date: '2026-08-01', memo: 'rbac e2e', lines: [
      { accountId: flat[0].id, debit: 1000, credit: 0 },
      { accountId: flat[1].id, debit: 0, credit: 1000 },
    ] },
  })
  expect(draft.status(), 'draft create allowed with write').toBe(200)
  const { id } = await draft.json()
  const post = await ctx.put('/api/admin/erp/finance/journal', { data: { op: 'post', id } })
  expect(post.status(), 'post denied without :post op').toBe(403)
  // create-and-post fast path is the same op → also 403
  const inline = await ctx.post('/api/admin/erp/finance/journal', {
    data: { date: '2026-08-01', post: true, lines: [
      { accountId: flat[0].id, debit: 500, credit: 0 },
      { accountId: flat[1].id, debit: 0, credit: 500 },
    ] },
  })
  expect(inline.status(), 'create-and-post denied too').toBe(403)
  await ctx.dispose()
})

test('auditor: reads 200, any write 403 server-side', async ({ baseURL }) => {
  const ctx = await login(baseURL!, 'rbac-aud@test.ir')
  expect((await ctx.get('/api/admin/erp/finance/overview')).status()).toBe(200)
  const w = await ctx.post('/api/admin/erp/sales/customers', { data: { name: 'X' } })
  expect(w.status(), 'auditor write blocked').toBe(403)
  await ctx.dispose()
})

test('employee: erp none → GET 403 and ERP hidden from navigation', async ({ browser, baseURL }) => {
  const ctx = await login(baseURL!, 'rbac-emp@test.ir')
  expect((await ctx.get('/api/admin/erp/finance/overview')).status(), 'none blocks even GET').toBe(403)
  const state = await ctx.storageState()
  const page = await (await browser.newContext({ baseURL, storageState: state })).newPage()
  await page.goto('/admin/home')
  await page.waitForLoadState('networkidle')
  const erpLinks = page.locator('a[href^="/admin/finance"], a[href^="/admin/sales"], a[href^="/admin/purchasing"]')
  expect(await erpLinks.count(), 'ERP modules not rendered for a none grant').toBe(0)
  await page.close()
  await ctx.dispose()
})
