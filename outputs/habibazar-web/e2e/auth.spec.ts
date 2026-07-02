import { test, expect } from '@playwright/test'
import { adminLogin, ADMIN_EMAIL, ADMIN_PASS } from './helpers'

test.describe('Authentication', () => {
  test('admin login page renders', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel(/email/i).fill('wrong@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /login|sign in|ورود/i }).click()
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 })
  })

  test('protected admin route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('protected API returns 401 without token', async ({ request }) => {
    const res = await request.get('/api/admin/dashboard')
    expect(res.status()).toBe(401)
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await adminLogin(page)
    await expect(page).toHaveURL(/\/admin(?!\/login)/)
  })
})
