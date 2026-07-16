import { chromium, type FullConfig } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ADMIN_EMAIL, ADMIN_PASS } from './helpers'

export const ADMIN_STATE = 'e2e/.auth/admin.json'

/**
 * 26.26c بند ۳: log in ONCE and persist the admin session to storageState, so the
 * full suite runs with zero per-test logins (the per-IP login limiter — 10/15min —
 * would otherwise fire partway through an auth-heavy run). auth.spec deliberately
 * resets to a clean state to still exercise the real login flow.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || config.projects[0]?.use?.baseURL || 'http://localhost:3000'
  const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
  const browser = await chromium.launch({ executablePath })
  const page = await browser.newPage({ baseURL })
  // Retry the login up to 3× — a cold `next start` can be slow to hydrate the
  // login form / first client navigation.
  let ok = false
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      await page.goto('/admin/login', { waitUntil: 'networkidle' })
      await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
      await page.getByLabel(/password/i).fill(ADMIN_PASS)
      await page.getByRole('button', { name: /login|sign in|ورود/i }).click()
      await page.waitForURL(/\/admin(?!\/login)/, { timeout: 20000 })
      ok = true
    } catch (e) { if (attempt === 3) throw e }
  }
  mkdirSync(dirname(ADMIN_STATE), { recursive: true })
  await page.context().storageState({ path: ADMIN_STATE })
  await browser.close()
}
