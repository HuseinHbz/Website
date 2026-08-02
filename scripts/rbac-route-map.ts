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
  'ai-analytics': 'ai.ai-analytics',
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
  'crm/tickets': 'operations.crm.tickets',
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
  'erp/numbering': 'system.numbering',
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
  'redirects': 'brand.seo',
  'seo': 'brand.seo',
  'page-templates': 'brand.templates',
}

/**
 * Routes explicitly exempt from requirePermission (audit:rbac list).
 * 26.28 بند ۰.۳ RULE: adding to this list requires a WRITTEN one-line reason —
 * "it was easier" is not one. navigation + workspaces were REMOVED here after
 * gaining real guards (بند ۰.۱/۰.۲).
 */
export const EXCEPTIONS = new Set([
  'auth/login',    // pre-auth by definition — no user exists yet to authorize
  'auth/logout',   // ends the session; only destroys the caller's own cookie
  'auth/me',       // returns the caller's OWN identity + grants; no foreign data
  'auth/2fa',      // self-service 2FA; managing ANOTHER user is op-gated in-route (security.users:reset_2fa)
  'nav-prefs',     // per-user favorites/recents — reads/writes only the caller's own row
  'nav-badges',    // per-user pending counters derived from the caller's visible modules
  'table-prefs',   // per-user table column layout — own row only
  'table-views',   // saved views; sharing visibility is enforced inside tableViews.ts
  'dashboards',           // per-user layout row; role/dept scopes need manage_users in-route
  'dashboards/data',      // widget payloads are RBAC-filtered per widget (tree engine, بند ۰.۴)
  'dashboards/shares',    // share targets validated in-route; snapshot is the sharer's own layout
  'dashboards/templates', // template apply/save is per-user; delete is role-gated in-route
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
