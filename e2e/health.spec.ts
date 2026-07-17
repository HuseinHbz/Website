import { test, expect } from '@playwright/test'

test.describe('Health & Infrastructure', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.ts).toBeTruthy()
    expect(typeof body.uptime).toBe('number')
  })

  test('sitemap.xml is served', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('xml')
    const text = await res.text()
    expect(text).toContain('<urlset')
    expect(text).toContain('habibazar.ir')
  })

  test('robots.txt disallows admin', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const text = await res.text()
    expect(text).toContain('Disallow: /admin')
  })

  test('rate limiting returns 429 on login abuse', async ({ request }) => {
    // Hit login endpoint 11 times rapidly — 11th should be rate limited
    const payload = { email: 'test@test.com', password: 'wrong' }
    let got429 = false
    for (let i = 0; i < 12; i++) {
      const res = await request.post('/api/admin/auth/login', { data: payload })
      if (res.status() === 429) { got429 = true; break }
    }
    expect(got429).toBe(true)
  })

  test('security headers are present', async ({ request }) => {
    const res = await request.get('/fa')
    const headers = res.headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['strict-transport-security']).toBeTruthy()
    expect(headers['content-security-policy']).toBeTruthy()
  })
})
