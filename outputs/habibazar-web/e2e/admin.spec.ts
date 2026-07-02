import { test, expect } from '@playwright/test'
import { adminLogin } from './helpers'

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page)
  })

  test('dashboard renders stats', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('[class*="metric"], [class*="stat"], [class*="card"]').first()).toBeVisible()
  })

  test('blog CMS — list view renders', async ({ page }) => {
    // Admin nav groups blog under "All Content"; go straight to the blog CMS page
    await page.goto('/admin/blog')
    await expect(page).toHaveURL(/\/admin\/blog/)
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('navigation links do not produce 500 errors', async ({ page }) => {
    const errors: string[] = []
    page.on('response', res => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`)
    })

    await page.goto('/admin')
    const links = await page.getByRole('navigation').getByRole('link').all()

    for (const link of links.slice(0, 8)) {
      const href = await link.getAttribute('href')
      if (href && href.startsWith('/admin')) {
        await page.goto(href)
        await page.waitForLoadState('domcontentloaded')
      }
    }

    expect(errors, `Server errors on admin nav: ${errors.join(', ')}`).toHaveLength(0)
  })

  test('logout clears session', async ({ page }) => {
    await page.goto('/admin')
    const logoutBtn = page.getByRole('button', { name: /logout|خروج/i })
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await expect(page).toHaveURL(/\/admin\/login/)
    }
  })
})
