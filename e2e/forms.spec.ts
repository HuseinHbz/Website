import { test, expect } from '@playwright/test'

test.describe('Forms & Contact', () => {
  test('consultation form page renders', async ({ page }) => {
    await page.goto('/fa/consultation')
    await expect(page.locator('form, [class*="form"]').first()).toBeVisible()
  })

  test('consultation form validates required fields', async ({ page }) => {
    await page.goto('/fa/consultation')
    const submit = page.getByRole('button', { name: /submit|ارسال|send/i })
    if (await submit.isVisible()) {
      await submit.click()
      // Should show validation errors, not navigate away
      await expect(page).toHaveURL(/consultation/)
    }
  })

  test('consultation API rejects empty body', async ({ request }) => {
    const res = await request.post('/api/consultation', { data: {} })
    expect([400, 422]).toContain(res.status())
  })

  test('consultation API rejects invalid email', async ({ request }) => {
    const res = await request.post('/api/consultation', {
      data: {
        name: 'Test User',
        email: 'not-an-email',
        company: 'Test Co',
        message: 'Hello',
      },
    })
    expect([400, 422]).toContain(res.status())
  })

  test('intro-call page renders', async ({ page }) => {
    await page.goto('/fa/consultation/intro-call')
    await expect(page).not.toHaveURL(/error/)
  })
})
