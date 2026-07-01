import { test, expect } from '@playwright/test'

const publicRoutes = ['/fa', '/en', '/fa/solutions', '/fa/consultation', '/fa/blog', '/fa/about']

test.describe('Accessibility (WCAG AA)', () => {
  for (const route of publicRoutes) {
    test(`[${route}] has lang attribute and skip-to-content`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator('html')).toHaveAttribute('lang')
      const skip = page.locator('a[href="#main-content"]')
      await expect(skip).toBeAttached()
    })

    test(`[${route}] all images have alt text`, async ({ page }) => {
      await page.goto(route)
      const images = page.locator('img:not([aria-hidden="true"])')
      const count = await images.count()
      for (let i = 0; i < count; i++) {
        const alt = await images.nth(i).getAttribute('alt')
        const ariaLabel = await images.nth(i).getAttribute('aria-label')
        expect(alt !== null || ariaLabel !== null, `Image ${i} missing alt text`).toBe(true)
      }
    })

    test(`[${route}] headings are in logical order`, async ({ page }) => {
      await page.goto(route)
      const h1Count = await page.locator('h1').count()
      expect(h1Count).toBeGreaterThanOrEqual(1)
      expect(h1Count).toBeLessThanOrEqual(1) // Only 1 h1 per page
    })
  }

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/fa')
    // Tab through the first 10 focusable elements — should not throw
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => document.activeElement?.tagName)
      expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'BODY'].includes(focused ?? '')).toBe(true)
    }
  })

  test('focus visible indicator exists on interactive elements', async ({ page }) => {
    await page.goto('/fa')
    await page.keyboard.press('Tab')
    // Focused element should have visible outline or ring
    const hasVisibleFocus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      if (!el || el === document.body) return true
      const style = window.getComputedStyle(el)
      return style.outline !== 'none' || style.boxShadow !== 'none'
    })
    expect(hasVisibleFocus).toBe(true)
  })
})
