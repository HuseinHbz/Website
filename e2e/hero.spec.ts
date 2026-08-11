import { test, expect } from '@playwright/test'
import { adminLogin } from './helpers'

/**
 * Regression guard for the "no way to create a hero" bug: the Heroes tab had
 * no create button at all, so nobody could ever create the first hero on the
 * platform. This locks in the fix end-to-end (button → modal → API →
 * builder opens) so it can never silently regress back to that state.
 */
test.describe('Hero Design Engine — create flow', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page)
  })

  test('the Heroes tab has a create affordance', async ({ page }) => {
    await page.goto('/admin/hero')
    await page.getByRole('button', { name: /^heroes$|هیروها/i }).click()
    await expect(page.getByRole('button', { name: /new hero|هیروی جدید/i })).toBeVisible()
  })

  test('creating a hero opens the builder for it', async ({ page }) => {
    await page.goto('/admin/hero')
    await page.getByRole('button', { name: /^heroes$|هیروها/i }).click()
    await page.getByRole('button', { name: /new hero|هیروی جدید/i }).click()

    const name = `E2E Test Hero ${Date.now()}`
    await page.getByLabel(/^name|^نام/i).fill(name)
    await page.getByRole('button', { name: /create.*builder|ساخت و بازکردن/i }).click()

    // The builder opened for the new hero — its name shows in the header and
    // the DRAFT status badge appears; this is the exact loop that was
    // completely broken (create had no caller anywhere in the UI).
    await expect(page.getByText(name)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/draft/i)).toBeVisible()

    // Clean up via the real delete API — CI runs this against a throwaway
    // DB per job, but a local/dev run shouldn't accumulate test heroes.
    const list = await page.request.get('/api/admin/heroes').then(r => r.json())
    const created = list.heroes?.find((h: { name: string }) => h.name === name)
    if (created) {
      await page.request.post('/api/admin/heroes', { data: { action: 'bulk', op: 'delete', ids: [created.id] } })
    }
  })
})
