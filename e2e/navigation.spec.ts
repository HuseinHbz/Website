import { test, expect } from '@playwright/test'

/**
 * 26.31 — every public page must be reachable BY CLICKING from the homepage.
 * Nine pages existed with content but no link anywhere; this spec is the guard
 * that stops that from happening again.
 */

const ORPHANS = [
  '/technologies', '/academy', '/events', '/products',
  '/solutions', '/industries', '/docs', '/search', '/projects',
]

test.use({ storageState: { cookies: [], origins: [] } })   // public site: no admin session

test('every previously orphaned page is linked from the homepage (no URL typing)', async ({ page }) => {
  await page.goto('/fa')
  await page.waitForLoadState('networkidle')
  const hrefs = await page.locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href') || ''))
  for (const p of ORPHANS) {
    expect(hrefs.some(h => h === `/fa${p}` || h === p), `${p} must be linked from the homepage`).toBeTruthy()
  }
})

test('header dropdown opens on click and navigates (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/fa')
  await page.waitForLoadState('networkidle')
  const parent = page.getByRole('button', { name: /دانش|Knowledge/ }).first()
  await expect(parent).toHaveAttribute('aria-expanded', 'false')
  await parent.click()
  await expect(parent).toHaveAttribute('aria-expanded', 'true')
  const docs = page.getByRole('menuitem', { name: /مستندات|Documentation/ }).first()
  await expect(docs).toBeVisible()
  await docs.click()
  await expect(page).toHaveURL(/\/fa\/docs/)
})

test('Escape closes the dropdown (keyboard accessibility)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/fa')
  const parent = page.getByRole('button', { name: /خدمات|Services/ }).first()
  await parent.click()
  await expect(parent).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(parent).toHaveAttribute('aria-expanded', 'false')
})

test('mobile accordion works on touch (no hover, no HTML5 drag)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto('/fa')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /menu|منو/i }).first().click().catch(async () => {
    await page.locator('[aria-controls="mobile-menu"]').first().click()
  })
  const parent = page.locator('#mobile-menu').getByRole('button', { name: /نمونه‌کارها|Our Work/ }).first()
  await parent.click()
  await expect(parent).toHaveAttribute('aria-expanded', 'true')
  const tech = page.locator('#mobile-menu').getByRole('link', { name: /فناوری‌ها|Technologies/ }).first()
  await expect(tech).toBeVisible()
  await tech.click()
  await expect(page).toHaveURL(/\/fa\/technologies/)
})

test('the footer links every public page (crawlable path for search engines)', async ({ page }) => {
  await page.goto('/fa')
  const footerHrefs = await page.locator('footer a[href]').evaluateAll(as => as.map(a => a.getAttribute('href') || ''))
  for (const p of ORPHANS) {
    expect(footerHrefs.some(h => h.endsWith(p)), `${p} must be in the footer`).toBeTruthy()
  }
})

test('search is reachable from the header', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/fa')
  await page.locator('header a[href$="/search"]').first().click()
  await expect(page).toHaveURL(/\/fa\/search/)
})
