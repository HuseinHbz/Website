import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
// Use the pre-provisioned Chromium when it exists (this sandbox / remote env);
// otherwise fall back to Playwright's own installed browser (CI installs it),
// by leaving executablePath undefined. (26.26b بند ۳.۲)
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium'
const chromiumExecutable = existsSync(CHROMIUM_PATH) ? CHROMIUM_PATH : undefined

export default defineConfig({
  testDir: './e2e',
  // 26.26c بند ۳: log in once, reuse the session (no per-test login → no limiter).
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fa',
    // Default: every spec starts authenticated via the saved admin session.
    storageState: 'e2e/.auth/admin.json',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
      },
    },
  ],

  // Do NOT start the server here — run `next build && next start` separately in CI
})
