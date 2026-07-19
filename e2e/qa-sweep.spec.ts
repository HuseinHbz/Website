import { test, expect } from '@playwright/test'

/**
 * 26.26c بند ۴ — real QA page-walk. Visits every admin route (authenticated via the
 * shared storageState) on a freshly-seeded DB (≈ empty business data) and records,
 * per page: console errors, page crashes, an unexpected redirect to /admin/login,
 * and horizontal overflow (body scrollWidth > viewport). Fails on a hard defect
 * (crash / login-bounce / console error); overflow is reported as a warning line so
 * the whole sweep still completes and prints a full table.
 */
const ROUTES = [
  '/admin', '/admin/about', '/admin/academy', '/admin/ai-agents', '/admin/ai-analytics',
  '/admin/ai-control', '/admin/ai-kb', '/admin/ai-prompts', '/admin/approvals', '/admin/assets',
  '/admin/audit', '/admin/backup', '/admin/blog', '/admin/business-intelligence', '/admin/certifications',
  '/admin/clients', '/admin/company', '/admin/consultations', '/admin/contacts', '/admin/content',
  '/admin/credentials', '/admin/crm', '/admin/crm/dashboard', '/admin/crm/tickets', '/admin/dashboard',
  '/admin/database', '/admin/design-system', '/admin/docs', '/admin/documents', '/admin/events-mgr',
  '/admin/finance', '/admin/financial-intelligence', '/admin/flags', '/admin/forms', '/admin/health',
  '/admin/hero', '/admin/import-center', '/admin/industries', '/admin/integration-hub', '/admin/integrations',
  '/admin/inventory', '/admin/logs-monitoring', '/admin/master-data', '/admin/media', '/admin/menus',
  '/admin/numbering', '/admin/operations', '/admin/organization', '/admin/organizations', '/admin/pages',
  '/admin/partners', '/admin/products', '/admin/project-management', '/admin/projects', '/admin/purchasing',
  '/admin/reports', '/admin/rules', '/admin/sales', '/admin/search', '/admin/sections',
  '/admin/security', '/admin/seo', '/admin/services', '/admin/settings', '/admin/settings/integrations',
  '/admin/settings/onboarding', '/admin/sites', '/admin/skills', '/admin/soc', '/admin/solutions',
  '/admin/technologies', '/admin/templates', '/admin/testimonials', '/admin/timeline', '/admin/treasury',
  '/admin/users', '/admin/workflows', '/admin/workspaces',
]

// Console noise that is not a real defect (network hiccups to un-configured externals).
const IGNORE = [/favicon/i, /Failed to load resource/i, /net::ERR/i, /\[Fast Refresh\]/i]

test.describe('QA sweep — admin page walk (26.26c بند ۴)', () => {
  test.describe.configure({ timeout: 180_000 })

  test('every admin page loads without crash / login-bounce / console error', async ({ page }) => {
    const findings: string[] = []
    const hard: string[] = []
    for (const route of ROUTES) {
      const errors: string[] = []
      const onErr = (m: import('@playwright/test').ConsoleMessage) => { if (m.type() === 'error' && !IGNORE.some(re => re.test(m.text()))) errors.push(m.text()) }
      const onCrash = (e: Error) => errors.push('PAGEERROR: ' + e.message)
      page.on('console', onErr); page.on('pageerror', onCrash)
      let status = 'ok'
      try {
        await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 })
        await page.waitForTimeout(400)
        if (/\/admin\/login/.test(page.url())) { status = 'LOGIN-BOUNCE'; hard.push(`${route} → redirected to login`) }
        else {
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
          if (overflow > 4) { status = `overflow +${overflow}px`; findings.push(`${route} — horizontal overflow +${overflow}px`) }
          if (errors.length) { status = `console:${errors.length}`; hard.push(`${route} — console error: ${errors[0].slice(0, 120)}`) }
        }
      } catch (e) { status = 'CRASH'; hard.push(`${route} — ${(e as Error).message.slice(0, 120)}`) }
      page.off('console', onErr); page.off('pageerror', onCrash)
      console.log(`  ${status === 'ok' ? '✓' : '⚠'} ${route.padEnd(34)} ${status}`)
    }
    console.log(`\n  QA sweep: ${ROUTES.length} pages · ${hard.length} hard defects · ${findings.length} overflow warnings`)
    for (const f of findings) console.log('   ⚠ ' + f)
    for (const h of hard) console.log('   ✗ ' + h)
    expect(hard, `Hard defects:\n${hard.join('\n')}`).toHaveLength(0)
  })
})
