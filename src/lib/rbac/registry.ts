/**
 * Phase 26.27 — tree permission registry, GENERATED from the workspace registry.
 *
 * Key grammar (the tree):
 *   <workspace>                          e.g. "erp"
 *   <workspace>.<module>                 e.g. "erp.finance"   (module slug = admin
 *                                        path minus /admin/, "/" → ".")
 *   <workspace>.<module>.<tab>           e.g. "erp.treasury.reconcile" (from ?tab=)
 *   <module-key>:<op>                    e.g. "erp.finance.journal:post" — sensitive
 *                                        operation, NEVER implied by write (بند ۱).
 *
 * WORKSPACES is the single source of truth for admin nav (Phase 22); deriving
 * the tree from it means a new module/tab automatically gets a permission node —
 * a hand-written list would rot (بند ۱ principle). `audit:rbac` enforces the
 * bijection both ways.
 */
import { WORKSPACES, hrefPath } from '@/lib/admin/workspaces'

export type PermLevel = 'none' | 'read' | 'write'

export interface PermNode {
  key: string
  kind: 'workspace' | 'module' | 'tab'
  parent: string | null
  labelEn: string
  labelFa: string
  href?: string
  ops?: string[]          // sensitive ops declared for this module
}

/** module slug from an admin href: /admin/crm/tickets → crm.tickets ; /admin → home */
export function moduleSlug(href: string): string {
  const p = hrefPath(href)
  const rest = p === '/admin' ? 'home' : p.replace(/^\/admin\//, '')
  return rest.replace(/\//g, '.')
}

function tabOf(href: string): string | null {
  const q = href.split('?')[1]
  if (!q) return null
  const m = /(?:^|&)tab=([^&]+)/.exec(q)
  return m ? m[1] : null
}

/**
 * Sensitive operations per MODULE key (بند ۱ must_include). `write` on the
 * module does NOT imply these — each needs an explicit per-user grant
 * (separation of duties). Keys here must be module keys from the registry.
 */
export const SENSITIVE_OPS: Record<string, string[]> = {
  'erp.finance': ['post', 'void', 'delete', 'close_period', 'reopen_period'],
  'erp.sales': ['confirm', 'void', 'return', 'post', 'payment_create', 'refund'],
  'erp.purchasing': ['confirm', 'void', 'post'],
  'erp.treasury': ['reconcile', 'cheque_state'],
  // Phase 28 — HR. Payroll ops are separated because calculating a run,
  // approving it and paying it must be able to sit with different people
  // (maker/checker); `sensitive_view` gates national id and bank details.
  'hr.employees': ['sensitive_view', 'delete'],
  'erp.inventory': ['cost_view'],   // بند ۶.۲ — sensitive-field grant (unit cost / valuation)
  'erp.approvals': ['approve', 'reject', 'delegate'],
  'erp.moadian': ['submit'],
  'security.users': ['create', 'role_change', 'reset_2fa', 'grant_edit'],
  'system.settings.integrations': ['write'],
  'backup.backup': ['restore'],
}

/**
 * 26.28 بند ۳ — sensitive fields covered by a field-grant op. The listed keys
 * are REMOVED from the API payload (stripFields) for rbac-managed users without
 * the op — never hidden with CSS. Secrets in settings/integrations are already
 * write-only + masked at the source (26.26b BUG-015), so they need no op here.
 */
export const SENSITIVE_FIELDS: Record<string, { routes: string[]; fields: string[] }> = {
  'erp.inventory:cost_view': {
    routes: ['erp/inventory/products', 'erp/inventory/overview'],
    fields: ['value', 'avgCost', 'unitCost', 'kpis.totalValue', 'topValue'],
  },
  // Phase 28.1 R8 — HR holds the most sensitive data the organisation has.
  // Without this grant the columns are ABSENT from the payload, not hidden by
  // CSS: an HR coordinator can manage people without seeing bank details.
  'hr.employees:sensitive_view': {
    routes: ['hr/employees'],
    fields: ['nationalId', 'iban', 'bankAccount', 'insuranceNo'],
  },
}

/**
 * 26.28 بند ۲.۳ — modules with a REAL row-scope implementation (server-side WHERE).
 * The permission-tree UI shows the scope selector ONLY for these keys, and only
 * offers the scopes each one actually enforces — no empty promises.
 */
export const SCOPED_MODULES: Record<string, Array<'all' | 'own' | 'department'>> = {
  'crm.crm': ['all', 'own', 'department'],            // leads + activities (owner_id / assigned_to)
  'crm.crm.customers': ['all', 'own', 'department'],  // Customer 360 (sales_customers.owner_id)
  'operations.crm.tickets': ['all', 'own', 'department'],  // tickets (owner_id) — moved workspace in 26.29
  'erp.sales': ['all', 'own', 'department'],          // documents (customer owner / created_by)
  'erp.project-management': ['all', 'own', 'department'], // pm_projects (created_by)
  // Phase 28.1 — a line manager sees their own team, an employee only
  // themselves, HR sees everyone. Enforced in the WHERE, never as a UI filter.
  'hr.employees': ['all', 'own', 'department'],
}

/**
 * API-only modules with no dedicated nav page (served inside another page's UI)
 * — added to the tree explicitly so their routes are still node-governed.
 */
export const EXTRA_MODULES: Array<{ key: string; parent: string; labelEn: string; labelFa: string }> = [
  { key: 'erp.moadian', parent: 'erp', labelEn: 'Moadian e-invoice', labelFa: 'سامانه مودیان' },
  { key: 'erp.payments', parent: 'erp', labelEn: 'Payment gateway', labelFa: 'درگاه پرداخت' },
  { key: 'crm.crm.customers', parent: 'crm.crm', labelEn: 'Customer 360', labelFa: 'مشتری ۳۶۰' },
  { key: 'system.settings.integrations', parent: 'system.settings', labelEn: 'Integration credentials', labelFa: 'اتصالات' },
  { key: 'system.settings.onboarding', parent: 'system.settings', labelEn: 'Onboarding', labelFa: 'راه‌اندازی' },
]

let cache: { nodes: PermNode[]; byKey: Map<string, PermNode> } | null = null

/** Build (and cache) the full permission tree from WORKSPACES. Pure aside from the cache. */
export function permissionTree(): { nodes: PermNode[]; byKey: Map<string, PermNode> } {
  if (cache) return cache
  const nodes: PermNode[] = []
  const byKey = new Map<string, PermNode>()
  const add = (n: PermNode) => { if (!byKey.has(n.key)) { nodes.push(n); byKey.set(n.key, n) } }

  for (const ws of WORKSPACES) {
    add({ key: ws.id, kind: 'workspace', parent: null, labelEn: ws.nameEn, labelFa: ws.nameFa })
    for (const g of ws.groups) {
      for (const item of g.items) {
        const mod = `${ws.id}.${moduleSlug(item.href)}`
        const tab = tabOf(item.href)
        if (!byKey.has(mod)) {
          add({
            key: mod, kind: 'module', parent: ws.id,
            labelEn: tab ? moduleSlug(item.href) : item.labelEn,
            labelFa: tab ? moduleSlug(item.href) : item.labelFa,
            href: hrefPath(item.href),
            ops: SENSITIVE_OPS[mod],
          })
        }
        if (tab) {
          add({ key: `${mod}.${tab}`, kind: 'tab', parent: mod, labelEn: item.labelEn, labelFa: item.labelFa, href: item.href })
        }
      }
    }
  }
  for (const x of EXTRA_MODULES) {
    if (!byKey.has(x.key)) add({ key: x.key, kind: x.key.split('.').length > 2 ? 'tab' : 'module', parent: x.parent, labelEn: x.labelEn, labelFa: x.labelFa })
  }
  // sensitive-op holders that are module-level settings pages nested deeper
  for (const opKey of Object.keys(SENSITIVE_OPS)) {
    if (!byKey.has(opKey)) {
      // e.g. system.settings.integrations exists as module (href /admin/settings/integrations)
      // if the workspace registry didn't produce it, surface loudly via audit:rbac.
      continue
    }
    const n = byKey.get(opKey)!
    n.ops = SENSITIVE_OPS[opKey]
  }
  cache = { nodes, byKey }
  return cache
}

export function isValidKey(key: string): boolean {
  return permissionTree().byKey.has(key)
}

/** All op keys ("module:op") declared in the registry. */
export function allOpKeys(): string[] {
  const out: string[] = []
  for (const [mod, ops] of Object.entries(SENSITIVE_OPS)) for (const op of ops) out.push(`${mod}:${op}`)
  return out
}

export function isValidOpKey(opKey: string): boolean {
  const i = opKey.lastIndexOf(':')
  if (i < 1) return false
  const mod = opKey.slice(0, i), op = opKey.slice(i + 1)
  return (SENSITIVE_OPS[mod] ?? []).includes(op)
}

/**
 * Longest-prefix module/tab key for an admin pathname (+ optional tab) —
 * defense-in-depth for middleware; routes declare their key IN CODE (بند ۳),
 * never from a header (ADR-002's x-pathname design is rejected: spoofable).
 */
export function keyForPath(pathname: string, tab?: string | null): string | null {
  const { nodes } = permissionTree()
  let best: PermNode | null = null
  for (const n of nodes) {
    if (n.kind === 'workspace' || !n.href) continue
    const p = hrefPath(n.href)
    if (pathname === p || pathname.startsWith(p + '/')) {
      if (!best || (best.href && p.length > hrefPath(best.href).length)) best = n
    }
  }
  if (!best) return null
  if (tab && permissionTree().byKey.has(`${best.key}.${tab}`)) return `${best.key}.${tab}`
  return best.key
}

/** Parent chain of a key, most specific first: tab → module → workspace. */
export function ancestry(key: string): string[] {
  const { byKey } = permissionTree()
  const chain: string[] = []
  let cur: string | null = key
  while (cur) {
    chain.push(cur)
    const node: PermNode | undefined = byKey.get(cur)
    cur = node?.parent ?? (cur.includes('.') && !node ? cur.slice(0, cur.lastIndexOf('.')) : null)
  }
  return chain
}
