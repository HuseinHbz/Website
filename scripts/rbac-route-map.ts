/**
 * 26.27 بند ۳ — derive the route→permission-key mapping from the registry.
 * Prints every /api/admin route with its resolved key (or UNMAPPED).
 * Used by the codemod and embedded in the phase report.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { permissionTree } from '@/lib/rbac/registry'

const API_ROOT = 'src/app/api/admin'

/** explicit overrides where the api path doesn't textually match a module */
export const OVERRIDES: Record<string, string> = {
  'overview': 'executive.home',
  'dashboard': 'executive.dashboard',
  'search': 'executive.search',
  'about': 'brand.about',
  'hero': 'brand.hero',
  'heroes': 'brand.hero',
  'ai-kb': 'ai.ai-kb',
  'ai-modules': 'ai.ai-control',
  'ai-analytics': 'analytics.ai-analytics',
  'ai': 'ai.ai-agents',
  'audit-logs': 'security.audit',
  'courses': 'brand.academy',
  'events': 'brand.events-mgr',
  'crm/inbound': 'crm.crm',
  'crm/leads': 'crm.crm',
  'crm/activities': 'crm.crm',
  'crm/campaigns': 'crm.crm',
  'crm/customers': 'crm.crm.customers',
  'crm/dashboard': 'crm.crm.dashboard',
  'crm/tickets': 'crm.crm.tickets',
  'erp/finance': 'erp.finance',
  'erp/sales': 'erp.sales',
  'erp/purchasing': 'erp.purchasing',
  'erp/inventory': 'erp.inventory',
  'erp/assets': 'erp.assets',
  'erp/projects': 'erp.project-management',
  'erp/treasury': 'erp.treasury',
  'erp/approvals': 'erp.approvals',
  'erp/bi': 'erp.business-intelligence',
  'erp/documents': 'erp.documents',
  'erp/import': 'erp.import-center',
  'erp/integrations': 'erp.integration-hub',
  'erp/master-data': 'erp.master-data',
  'erp/moadian': 'erp.moadian',
  'erp/numbering': 'erp.numbering',
  'erp/payments': 'erp.payments',
  'erp/reports': 'erp.reports',
  'erp/rules': 'erp.rules',
  'erp/health': 'operations.health',
  'erp/settings': 'system.settings',
  'settings/integrations': 'system.settings.integrations',
  'settings/onboarding': 'system.settings.onboarding',
  'settings': 'system.settings',
  'users': 'security.users',
  'flags': 'system.flags',
  'organizations': 'crm.organizations',
  'organization': 'system.organization',
  'sites': 'system.sites',
  'backup': 'backup.backup',
  'logs': 'operations.logs-monitoring',
  'operations': 'operations.operations',
  'database': 'operations.database',
  'soc': 'security.soc',
  'workflows': 'erp.workflows',
  'media': 'brand.media',
  'resync': 'system.settings',
  'redirects': 'system.seo',
  'seo': 'system.seo',
  'page-templates': 'brand.templates',
}

/** routes that are auth/self-service utilities — explicitly exempt (audit:rbac list) */
export const EXCEPTIONS = new Set([
  'auth/login', 'auth/logout', 'auth/me', 'auth/2fa',
  'nav-prefs', 'nav-badges', 'navigation', 'table-prefs', 'table-views',
  'dashboards', 'dashboards/data', 'dashboards/shares', 'dashboards/templates',
  'workspaces',
])

function routeDirs(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...routeDirs(p, base ? `${base}/${e}` : e))
    else if (e === 'route.ts') out.push(base)
  }
  return out
}

export function keyForApiRoute(route: string): string | null {
  const clean = route.replace(/\/\[[^\]]+\]/g, '')   // drop [id] segments
  if (EXCEPTIONS.has(clean)) return null
  // longest override prefix wins
  const parts = clean.split('/')
  for (let i = parts.length; i >= 1; i--) {
    const prefix = parts.slice(0, i).join('/')
    if (OVERRIDES[prefix]) return OVERRIDES[prefix]
  }
  // textual match: find a module key whose post-workspace remainder equals a prefix
  const { nodes } = permissionTree()
  let best: string | null = null
  for (const n of nodes) {
    if (n.kind === 'workspace') continue
    const rest = n.key.slice(n.key.indexOf('.') + 1).replace(/\./g, '/')
    for (let i = parts.length; i >= 1; i--) {
      const prefix = parts.slice(0, i).join('/')
      if (rest === prefix && (!best || n.key.length > best.length)) best = n.key
    }
  }
  return best
}

if (process.argv[1]?.includes('rbac-route-map')) {
  const routes = routeDirs(API_ROOT).sort()
  let unmapped = 0
  for (const r of routes) {
    const clean = r.replace(/\/\[[^\]]+\]/g, '')
    if (EXCEPTIONS.has(clean)) { console.log(`${r.padEnd(48)} → (exception)`); continue }
    const k = keyForApiRoute(r)
    if (!k) { unmapped++; console.log(`${r.padEnd(48)} → ❌ UNMAPPED`) }
    else console.log(`${r.padEnd(48)} → ${k}`)
  }
  console.log(`\n${routes.length} routes · ${unmapped} unmapped`)
  if (unmapped > 0) process.exit(1)
}
