import { test, expect } from '@playwright/test'

test.describe('SEO', () => {
  for (const locale of ['fa', 'en']) {
    test(`[${locale}] homepage has title, description, og tags`, async ({ page }) => {
      await page.goto(`/${locale}`)

      // Title
      const title = await page.title()
      expect(title.length).toBeGreaterThan(10)

      // Meta description
      const desc = await page.locator('meta[name="description"]').getAttribute('content')
      expect(desc).toBeTruthy()
      expect((desc ?? '').length).toBeGreaterThan(20)

      // OG tags
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
      const ogDesc  = await page.locator('meta[property="og:description"]').getAttribute('content')
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
      expect(ogTitle).toBeTruthy()
      expect(ogDesc).toBeTruthy()
      expect(ogImage).toBeTruthy()

      // Canonical
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
      expect(canonical).toContain('habibazar.ir')

      // hreflang
      const hreflang = await page.locator('link[rel="alternate"][hreflang]').count()
      expect(hreflang).toBeGreaterThanOrEqual(2)
    })
  }

  test('structured data (JSON-LD) is present on homepage', async ({ page }) => {
    await page.goto('/fa')
    const scripts = page.locator('script[type="application/ld+json"]')
    const count = await scripts.count()
    expect(count).toBeGreaterThanOrEqual(1)

    const content = await scripts.first().textContent()
    const data = JSON.parse(content ?? '{}')
    expect(data['@context']).toBe('https://schema.org')
  })

  test('no broken canonical links', async ({ page }) => {
    await page.goto('/en')
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toMatch(/^https?:\/\//)
  })
})
