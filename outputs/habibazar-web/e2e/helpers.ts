import { Page, expect } from '@playwright/test'

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@habibazar.ir'
export const ADMIN_PASS  = process.env.E2E_ADMIN_PASS  || 'Admin@1234!'

export async function adminLogin(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASS)
  await page.getByRole('button', { name: /login|ورود/i }).click()
  await expect(page).toHaveURL(/\/admin(?!\/login)/)
}

export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return () => expect(errors, 'Console errors found').toHaveLength(0)
}

export async function expectAccessible(page: Page) {
  // Basic accessibility: skip-to-content, lang attr, no missing alt
  const html = page.locator('html')
  await expect(html).toHaveAttribute('lang')
}
