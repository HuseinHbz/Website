import { test, expect } from '@playwright/test'

/**
 * Resilience & graceful degradation tests.
 * These tests verify the app degrades gracefully, not that failures don't occur.
 */
test.describe('Resilience & Graceful Degradation', () => {
  // 26.26c بند ۳: these probe public + UNauthenticated behaviour (e.g. admin API
  // must 401 without a token), so run on a clean state — not the shared admin
  // storageState, which would smuggle a valid token into "without token".
  test.use({ storageState: { cookies: [], origins: [] } })

  test('API returns structured error on invalid input, not crash', async ({ request }) => {
    const res = await request.post('/api/consultation', {
      data: {},
    })
    expect([400, 422]).toContain(res.status())
    const body = await res.json()
    expect(body.error || body.message || body.errors).toBeTruthy()
  })

  test('search handles empty query gracefully', async ({ request }) => {
    const res = await request.get('/api/search?q=')
    expect([200, 400]).toContain(res.status())
    expect(res.status()).not.toBe(500)
  })

  test('blog API handles unknown slug', async ({ request }) => {
    const res = await request.get('/api/blog/this-post-does-not-exist-xyz')
    expect([404, 200]).toContain(res.status())
    expect(res.status()).not.toBe(500)
  })

  test('admin API returns 401 not 500 without token', async ({ request }) => {
    const res = await request.post('/api/admin/blog', { data: { title: 'test' } })
    expect(res.status()).toBe(401)
  })

  test('rate limiter returns correct 429 structure', async ({ request }) => {
    // Exhaust the login rate limit
    const payload = { email: 'x@x.com', password: 'wrong' }
    let rateLimited = false
    for (let i = 0; i < 15; i++) {
      const res = await request.post('/api/admin/auth/login', { data: payload })
      if (res.status() === 429) {
        const body = await res.json()
        expect(body.error).toBeTruthy()
        const retryAfter = res.headers()['retry-after']
        expect(retryAfter).toBeTruthy()
        rateLimited = true
        break
      }
    }
    expect(rateLimited).toBe(true)
  })

  test('health check degrades to 503 when appropriate', async ({ request }) => {
    const res = await request.get('/api/health')
    // Should be 200 (ok) or 503 (degraded/down) — never 500
    expect([200, 503]).toContain(res.status())
  })
})
