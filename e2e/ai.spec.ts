import { test, expect } from '@playwright/test'

test.describe('AI Platform', () => {
  test('AI page renders without crashing', async ({ page }) => {
    await page.goto('/fa/ai')
    await expect(page).not.toHaveURL(/error/)
    await expect(page.locator('body')).not.toContainText(/Internal Server Error/)
  })

  test('AI chat API handles missing API key gracefully', async ({ request }) => {
    const res = await request.post('/api/ai/chat', {
      data: {
        messages: [{ role: 'user', content: 'Hello' }],
        locale: 'en',
      },
    })
    // Should return 200 with a graceful message, or 503 — never 500 with a stack trace
    expect([200, 400, 503]).toContain(res.status())
    const body = await res.json()
    if (res.status() !== 200) {
      expect(body.error).toBeTruthy()
    }
  })

  test('AI modules API is accessible', async ({ request }) => {
    const res = await request.get('/api/ai/modules')
    expect([200, 404]).toContain(res.status())
  })

  test('AI search API responds', async ({ request }) => {
    const res = await request.get('/api/ai/search?q=network')
    expect([200, 400]).toContain(res.status())
  })
})
