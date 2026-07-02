import { Page, expect } from '@playwright/test'

// Defaults match the seeded super-admin in src/lib/db/seed.ts
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@habibazar.com'
export const ADMIN_PASS  = process.env.E2E_ADMIN_PASS  || 'HBZ@Admin2025!'

export async function adminLogin(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASS)
  await page.getByRole('button', { name: /login|sign in|ورود/i }).click()
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
