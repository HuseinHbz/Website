import { test, expect } from '@playwright/test'
import { expectAccessible } from './helpers'

test.describe('Public Website', () => {
  test('homepage loads with correct title', async ({ page }) => {
    await page.goto('/fa')
    await expect(page).toHaveTitle(/حسین حبیب|HBZ/i)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expectAccessible(page)
  })

  test('EN locale redirects correctly', async ({ page }) => {
    await page.goto('/en')
    await expect(page).toHaveURL('/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })

  test('skip-to-content link exists', async ({ page }) => {
    await page.goto('/fa')
    const skip = page.locator('a[href="#main-content"]')
    await expect(skip).toBeAttached()
  })

  test('404 page renders correctly', async ({ page }) => {
    const res = await page.goto('/fa/this-page-does-not-exist-xyz')
    expect(res?.status()).toBe(404)
    await expect(page.locator('h1, p')).toContainText(/not found|یافت نشد|404/i)
  })

  test('solutions page loads', async ({ page }) => {
    await page.goto('/fa/solutions')
    await expect(page).not.toHaveURL(/error/)
    await expect(page.locator('body')).not.toContainText(/Internal Server Error/)
  })

  test('consultation page loads', async ({ page }) => {
    await page.goto('/fa/consultation')
    await expect(page).not.toHaveURL(/error/)
    await expect(page.locator('body')).not.toContainText(/Internal Server Error/)
  })

  test('search page renders', async ({ page }) => {
    await page.goto('/fa/search')
    await expect(page).not.toHaveURL(/error/)
  })

  test('blog page renders', async ({ page }) => {
    await page.goto('/fa/blog')
    await expect(page).not.toHaveURL(/error/)
  })
})
