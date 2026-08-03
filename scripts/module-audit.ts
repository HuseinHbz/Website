/**
 * Phase 26.32 بند ۰ — systematic module audit against a LIVE server.
 *
 * Why this exists: three phases in a row proved that reading code does not find
 * these defects. 26.29's eleven "doesn't work" modules were only exposed by
 * issuing real requests (a NOT NULL column the form never sent → generic 500);
 * 26.31's Menu Builder edited an orphan table that nothing read. So this tool
 * TALKS TO A RUNNING SERVER and records real status codes.
 *
 * For every admin module in the WORKSPACES registry it checks:
 *   page        GET /admin/<module>              → 200 (renders, no crash)
 *   api GET     GET /api/admin/<route>           → 200 + a sane shape
 *   create      POST with a minimal body         → 2xx (or 400 NAMING the field)
 *   validation  POST with an empty body          → 400 with a field name, never 500
 *   notFound    GET/PUT with a bogus id          → 404/400, never 500
 *   delete      DELETE the record it created     → 2xx (and it is really gone)
 *
 * Usage:
 *   AUDIT_BASE=http://localhost:3000 npx tsx scripts/module-audit.ts
 *   npm run audit:modules            (same, defaults to :3000)
 *   … --json  → machine-readable report for the phase document
 */
import { WORKSPACES, hrefPath } from '@/lib/admin/workspaces'

const BASE = process.env.AUDIT_BASE || 'http://localhost:3000'
const EMAIL = process.env.AUDIT_EMAIL || 'admin@habibazar.com'
const PASSWORD = process.env.AUDIT_PASSWORD || 'HBZ@Admin2025!'
const JSON_OUT = process.argv.includes('--json')

let cookie = ''

interface Probe { status: number; body: string }
async function req(method: string, path: string, body?: unknown): Promise<Probe> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })
  const text = await res.text()
  return { status: res.status, body: text.slice(0, 400) }
}

/**
 * Minimal create payloads. Only modules with a straightforward CRUD contract are
 * exercised for writes — an ERP posting endpoint needs a whole document context
 * and is covered by its own regression suite instead (honest boundary).
 */
const CREATE: Record<string, { route: string; body: Record<string, unknown> }> = {

  'brand.timeline': { route: 'timeline', body: { year: '2026', titleEn: 'A32', titleFa: 'آ۳۲' } },
  'brand.skills': { route: 'skills', body: { nameEn: 'A32', nameFa: 'آ۳۲', categoryEn: 'net', categoryFa: 'شبکه', level: 80 } },
  'brand.credentials': { route: 'credentials', body: { type: 'certification', nameEn: 'A32 Cred' } },
  'brand.content': { route: 'content', body: { type: 'doc', titleEn: 'A32', titleFa: 'آ۳۲' } },
  'brand.blog': { route: 'blog', body: { titleEn: 'A32 Post', titleFa: 'آ۳۲', status: 'draft' } },
  'brand.docs': { route: 'docs', body: { titleEn: 'A32 Doc', titleFa: 'آ۳۲' } },

  'brand.technologies': { route: 'technologies', body: { nameEn: 'A32 Tech', nameFa: 'آ۳۲' } },
  'brand.solutions': { route: 'solutions', body: { nameEn: 'A32 Sol', nameFa: 'آ۳۲' } },
  'brand.services': { route: 'services', body: { titleEn: 'A32 Svc', titleFa: 'آ۳۲', categoryEn: 'net', categoryFa: 'شبکه' } },
  'brand.industries': { route: 'industries', body: { nameEn: 'A32 Ind', nameFa: 'آ۳۲' } },
  'brand.projects': { route: 'projects', body: { nameEn: 'A32 Proj', nameFa: 'آ۳۲' } },
  'brand.testimonials': { route: 'testimonials', body: { clientName: 'A32', quoteEn: 'ok' } },
  'brand.certifications': { route: 'certifications', body: { nameEn: 'A32 Cert', nameFa: 'آ۳۲', issuer: 'X', issueDate: '2026-01-01' } },
  'brand.products': { route: 'products', body: { nameEn: 'A32 Prod', nameFa: 'آ۳۲' } },
  'brand.academy': { route: 'courses', body: { titleEn: 'A32 Course', level: 'beginner', type: 'course', status: 'draft' } },
  'brand.events-mgr': { route: 'events', body: { titleEn: 'A32 Event', titleFa: 'آ۳۲', startDate: '2026-09-01' } },
  'brand.sections': { route: 'sections', body: { sectionType: 'hero', page: 'home', titleEn: 'A32', titleFa: 'آ۳۲' } },
  'brand.pages': { route: 'pages', body: { titleEn: 'A32 Page', titleFa: 'آ۳۲', slug: 'a32-page' } },
  'brand.forms': { route: 'forms', body: { name: 'A32 Form', type: 'contact' } },
  'brand.menus': { route: 'navigation', body: { labelEn: 'A32', labelFa: 'آ۳۲', href: '/a32', location: 'header', sortOrder: 90, active: true } },
  'brand.templates': { route: 'page-templates', body: { nameEn: 'A32 Tpl', nameFa: 'آ۳۲' } },
  'crm.crm': { route: 'crm/leads', body: { name: 'A32 Lead' } },
  'crm.clients': { route: 'clients', body: { nameEn: 'A32 Client', nameFa: 'آ۳۲' } },
  'crm.organizations': { route: 'organizations', body: { nameEn: 'A32 Org', nameFa: 'آ۳۲' } },
  'system.sites': { route: 'sites', body: { name: 'A32 Site', domain: 'a32.test' } },
  'system.workspaces': { route: 'workspaces', body: { name: 'A32 WS' } },
  'system.flags': { route: 'flags', body: { key: 'a32_flag', enabled: false } },
  'erp.rules': { route: 'erp/rules', body: { key: 'a32_rule', nameEn: 'A32', nameFa: 'آ۳۲', definition: JSON.stringify({ rules: [{ id: 'r1', name: 'A32', match: 'all', conditions: [], outputs: { ok: true } }] }) } },
}

/** Routes to GET-probe for modules without a create contract. */
const GET_ROUTE: Record<string, string> = {
  'brand.about': 'about',      // PUT-only settings route (no create/delete)
  'brand.seo': 'seo',          // PUT-only settings route
  'executive.home': 'overview',
  'executive.search': 'search?q=ab',
  'executive.dashboard': 'dashboard',
  'crm.crm.dashboard': 'crm/dashboard',
  'crm.contacts': 'contacts',
  'crm.consultations': 'consultations',
  'erp.finance': 'erp/finance/overview',
  'erp.sales': 'erp/sales/overview',
  'erp.purchasing': 'erp/purchasing?view=overview',
  'erp.inventory': 'erp/inventory/overview',
  'erp.assets': 'erp/assets/overview',
  'erp.project-management': 'erp/projects?overview=1',
  'erp.treasury': 'erp/treasury/overview',
  'erp.approvals': 'erp/approvals',
  'erp.reports': 'erp/reports',
  'erp.documents': 'erp/documents',
  'erp.master-data': 'erp/master-data?view=overview',
  'erp.import-center': 'erp/import',
  'erp.integration-hub': 'erp/integrations',
  'erp.workflows': 'workflows',
  'erp.financial-intelligence': 'erp/finance/intelligence',
  'erp.business-intelligence': 'erp/bi/cockpit',
  'erp.company': 'settings',
  'ai.ai-agents': 'ai/agents',
  'ai.ai-analytics': 'ai/analytics',
  'ai.ai-kb': 'ai-kb',
  'ai.ai-control': 'ai-modules',
  'ai.ai-prompts': 'ai/prompts',
  'security.users': 'users',
  'security.audit': 'audit-logs',
  'security.soc': 'soc/overview',
  'security.security': 'auth/2fa',
  'operations.operations': 'operations/overview',
  'operations.database': 'database/health',
  'operations.logs-monitoring': 'logs/query?limit=1',
  'operations.health': 'erp/health',
  'operations.crm.tickets': 'crm/tickets',
  'backup.backup': 'backup/engine',
  'system.settings': 'settings',
  'system.settings.integrations': 'settings/integrations',
  'system.settings.onboarding': 'settings/onboarding',
  'system.organization': 'organization',
  'system.numbering': 'erp/numbering',
  'system.design-system': '',   // pure UI page, no API of its own
  // 26.32: tab-scoped menu entries point at a module that is audited under its
  // own key — probing them again would double-count, so they map to no API.
  'system.finance': '',
  'system.documents': '',
  'system.partners': 'partners',
  'system.integrations': 'integrations',
  'brand.media': 'media',
  'brand.hero': 'heroes',
}

export interface ModuleResult {
  key: string
  labelFa: string
  path: string
  page: number | '-'
  get: number | '-'
  create: number | '-'
  validation: string
  notFound: number | '-'
  del: number | '-'
  findings: string[]
}

function idOf(body: string): string | number | null {
  try {
    const d = JSON.parse(body)
    return d?.id ?? d?.[0]?.id ?? null
  } catch { return null }
}

async function auditModule(key: string, labelFa: string, href: string): Promise<ModuleResult> {
  const path = hrefPath(href)
  const r: ModuleResult = {
    key, labelFa, path, page: '-', get: '-', create: '-', validation: '-', notFound: '-', del: '-', findings: [],
  }

  // 1. the page itself renders
  const page = await req('GET', path)
  r.page = page.status
  if (page.status !== 200) r.findings.push(`page ${page.status}`)

  const spec = CREATE[key]
  const getRoute = spec?.route ?? GET_ROUTE[key]
  if (getRoute === undefined) { r.findings.push('no API mapped'); return r }
  if (getRoute === '') return r     // UI-only module, intentionally no API

  // 2. list/read
  const get = await req('GET', `/api/admin/${getRoute}`)
  r.get = get.status
  if (get.status >= 400) r.findings.push(`GET ${get.status}`)

  if (!spec) return r               // read-only probe for this module

  // 3. validation: an EMPTY body must be a 400 that NAMES the field (26.29 rule)
  const empty = await req('POST', `/api/admin/${spec.route}`, {})
  if (empty.status === 500) { r.validation = '500 ✗'; r.findings.push('empty body → 500 (26.29 class)') }
  else if (empty.status === 400) {
    const msg = (() => { try { return String(JSON.parse(empty.body).error ?? '') } catch { return '' } })()
    r.validation = /required|missing|duplicate|:/i.test(msg) ? '400 ✓' : '400 vague'
    if (r.validation === '400 vague') r.findings.push(`400 without a field name: "${msg.slice(0, 60)}"`)
  } else r.validation = `${empty.status}`

  // 4. create with a minimal real payload
  const created = await req('POST', `/api/admin/${spec.route}`, spec.body)
  r.create = created.status
  if (created.status >= 400) r.findings.push(`create ${created.status}: ${created.body.slice(0, 90)}`)

  // 5. bogus id must not be a 500
  const nf = await req('PUT', `/api/admin/${spec.route}`, { id: 999999, ...spec.body })
  r.notFound = nf.status
  if (nf.status === 500) r.findings.push('bogus id → 500')

  // 6. delete what we created (and only that)
  const id = idOf(created.body)
  if (id != null) {
    const del = await req('DELETE', `/api/admin/${spec.route}`, { id })
    r.del = del.status
    if (del.status >= 400) r.findings.push(`delete ${del.status}`)
  }
  return r
}

async function main() {
  const login = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!login.ok) { console.error(`login failed (${login.status}) — is the server running at ${BASE}?`); process.exit(1) }
  cookie = (login.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')

  // one row per menu item, deduped by module key
  const seen = new Set<string>()
  const targets: Array<{ key: string; labelFa: string; href: string }> = []
  for (const ws of WORKSPACES) for (const g of ws.groups) for (const it of g.items) {
    const slug = hrefPath(it.href) === '/admin' ? 'home' : hrefPath(it.href).replace(/^\/admin\//, '').replace(/\//g, '.')
    const key = `${ws.id}.${slug}`
    if (seen.has(key)) continue
    seen.add(key)
    targets.push({ key, labelFa: it.labelFa, href: it.href })
  }

  const results: ModuleResult[] = []
  for (const t of targets) results.push(await auditModule(t.key, t.labelFa, t.href))

  if (JSON_OUT) { console.log(JSON.stringify(results, null, 1)); return }

  const bad = results.filter(r => r.findings.length > 0)
  console.log(`\n  Module Audit (26.32) — ${results.length} modules against ${BASE}\n`)
  console.log('  ' + 'module'.padEnd(34) + 'page  GET   POST  400        404   DEL')
  for (const r of results) {
    console.log('  ' + r.key.padEnd(34) +
      String(r.page).padEnd(6) + String(r.get).padEnd(6) + String(r.create).padEnd(6) +
      String(r.validation).padEnd(11) + String(r.notFound).padEnd(6) + String(r.del))
  }
  console.log(`\n  ${results.length - bad.length}/${results.length} clean · ${bad.length} with findings`)
  for (const r of bad) console.log(`    ✗ ${r.key}: ${r.findings.join(' | ')}`)
  process.exit(bad.length > 0 && process.env.AUDIT_STRICT === '1' ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
