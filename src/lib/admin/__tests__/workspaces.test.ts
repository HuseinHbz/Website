import { describe, it, expect } from 'vitest'
import { WORKSPACES, workspaceForPath, workspaceById, workspaceHome, allNavItems, roleCan, visibleWorkspaces, visibleGroups, quickActionsFor, breadcrumbFor, findItem, roleDefaultFavorites, hrefPath } from '../workspaces'

describe('workspace registry', () => {
  // 26.29 بند ۲: content + documentation merged into brand, analytics into
  // executive → 12 workspaces became 9 (CC-005 in contract-changes.md).
  it('has 9 workspaces with unique ids', () => {
    expect(WORKSPACES).toHaveLength(9)
    expect(new Set(WORKSPACES.map(w => w.id)).size).toBe(9)
  })

  // 26.29 بند ۲.۵ — the invariant that replaces cross-listing: one module, one item.
  it('every menu item is unique (zero duplicates across the whole registry)', () => {
    const hrefs = WORKSPACES.flatMap(w => w.groups.flatMap(g => g.items.map(i => i.href)))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('no two modules share a Persian label (بند ۳ — no confusing twins)', () => {
    const labels = WORKSPACES.flatMap(w => w.groups.flatMap(g => g.items.map(i => i.labelFa)))
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('resolves the active workspace by longest-matching href', () => {
    expect(workspaceForPath('/admin').id).toBe('executive')
    expect(workspaceForPath('/admin/finance').id).toBe('erp')
    expect(workspaceForPath('/admin/finance/journal').id).toBe('erp')
    expect(workspaceForPath('/admin/users').id).toBe('security')
    // ai-kb must win over any '/admin/ai' prefix collision
    expect(workspaceForPath('/admin/ai-agents').id).toBe('ai')
    // a workspace dashboard resolves to its own workspace
    expect(workspaceForPath('/admin/dashboards/operations').id).toBe('operations')
    expect(workspaceForPath('/admin/dashboards/erp').id).toBe('erp')
  })

  it('falls back to executive for unknown paths', () => {
    expect(workspaceForPath('/admin/nonexistent').id).toBe('executive')
  })

  // BUG-010 (26.26): a ?tab= href must resolve to its OWN workspace, not jump to
  // executive. Regression: treasury + business-intelligence were mis-owned.
  it('resolves ?tab= module pages to their own workspace (BUG-010)', () => {
    expect(workspaceForPath('/admin/treasury').id).toBe('erp')
    expect(workspaceForPath('/admin/business-intelligence').id).toBe('erp')
    expect(workspaceForPath('/admin/financial-intelligence').id).toBe('erp')
    expect(workspaceForPath('/admin/approvals').id).toBe('erp')
  })

  it('every registry item resolves to a workspace that CONTAINS it — never the executive fallback (table, BUG-010)', () => {
    // A page may be cross-listed in several workspaces (e.g. /admin/reports lives
    // in both analytics + erp) and resolves deterministically to the first-listed
    // one. The invariant is MEMBERSHIP: the resolved workspace must contain the
    // path — so no registered page (esp. a ?tab= page) falls through to executive.
    const contains = (wsId: string, path: string) => {
      const ws = WORKSPACES.find(w => w.id === wsId)!
      return ws.groups.some(g => g.items.some(it => hrefPath(it.href) === path))
    }
    for (const ws of WORKSPACES) {
      for (const g of ws.groups) {
        for (const it of g.items) {
          const path = hrefPath(it.href)
          const resolved = workspaceForPath(path)
          expect(contains(resolved.id, path), `${it.href} → '${resolved.id}' which does not contain it`).toBe(true)
        }
      }
    }
  })

  // BUG-011 (26.26): the sidebar switcher and the /admin/home grid MUST show the
  // same set — both read visibleWorkspaces(role). This is the single source of truth.
  it('visibleWorkspaces is the one source for both switcher and dashboard grid (BUG-011)', () => {
    for (const role of ['super_admin', 'administrator', 'editor', 'auditor', 'viewer'] as const) {
      const vis = visibleWorkspaces(role)
      // deterministic, subset of the registry, and every entry is a real workspace
      expect(vis.length).toBeGreaterThan(0)
      expect(vis.length).toBeLessThanOrEqual(WORKSPACES.length)
      expect(vis.every(w => WORKSPACES.some(x => x.id === w.id))).toBe(true)
      // idempotent — calling twice gives the same count (no hidden state)
      expect(visibleWorkspaces(role).length).toBe(vis.length)
    }
    // a read-only role sees fewer than a super_admin (RBAC actually filters)
    expect(visibleWorkspaces('viewer').length).toBeLessThanOrEqual(visibleWorkspaces('super_admin').length)
  })

  // BUG-010 second root (26.26b بند ۲.۱): context-aware resolution keeps a user in
  // their current workspace for a CROSS-LISTED page, instead of jumping to the
  // first-listed owner (the reported Treasury/BI/dashboard jump).
  // 26.29: after the dedupe there are no cross-listed pages left, so the
  // context-aware branch can only be exercised on a tab-scoped module. The
  // guarantee under test is unchanged: context never moves you out of a
  // workspace that legitimately owns the path (CC-005).
  it('context-aware resolution keeps a user in a workspace that owns the path (بند ۲.۱)', () => {
    expect(workspaceForPath('/admin/dashboard').id).toBe('executive')
    expect(workspaceForPath('/admin/dashboard', 'executive').id).toBe('executive')
    expect(workspaceForPath('/admin/reports', 'erp').id).toBe('erp')
    expect(workspaceForPath('/admin/treasury', 'erp').id).toBe('erp')
  })

  it('context does NOT override when the current workspace does not own the path', () => {
    // Treasury is only in erp; being "in" another workspace must not keep you there.
    expect(workspaceForPath('/admin/treasury', 'crm').id).toBe('erp')
    // an unknown current id is ignored
    expect(workspaceForPath('/admin/treasury', 'nonsense').id).toBe('erp')
  })

  it('strong assertion: every NON-cross-listed item resolves to exactly its workspace (بند ۲.۲)', () => {
    // Build the set of paths that appear in more than one workspace.
    const owners = new Map<string, Set<string>>()
    for (const ws of WORKSPACES) for (const g of ws.groups) for (const it of g.items) {
      const p = hrefPath(it.href); if (!owners.has(p)) owners.set(p, new Set())
      owners.get(p)!.add(ws.id)
    }
    for (const ws of WORKSPACES) for (const g of ws.groups) for (const it of g.items) {
      const p = hrefPath(it.href)
      if (owners.get(p)!.size === 1) {
        // single-owner → the STRONG invariant: resolves to exactly this workspace.
        expect(workspaceForPath(p).id, `${it.href} single-owner`).toBe(ws.id)
      }
    }
  })

  it('boundary match: /admin/sales-returns is NOT owned by the sales item', () => {
    // If /admin/sales-returns existed it must not collapse onto /admin/sales.
    // (uses startsWith(p + "/") so a hyphen sibling never matches.)
    expect(workspaceForPath('/admin/sales').id).toBe('erp')
    // a nested real path still resolves to the owner
    expect(workspaceForPath('/admin/sales/anything').id).toBe('erp')
  })

  it('workspaceById + workspaceHome resolve', () => {
    const erp = workspaceById('erp')!
    expect(erp.nameEn).toBe('ERP Platform')
    expect(workspaceHome(erp)).toBe('/admin/finance')
  })

  it('allNavItems de-duplicates hrefs', () => {
    const items = allNavItems()
    expect(new Set(items.map(i => i.href)).size).toBe(items.length)
    // reports appears in both ERP and Analytics but only once here
    expect(items.filter(i => i.href === '/admin/reports')).toHaveLength(1)
  })
})

describe('navigation RBAC', () => {
  it('roleCan mirrors the RBAC matrix', () => {
    expect(roleCan('super_admin', 'manage_users')).toBe(true)
    expect(roleCan('administrator', 'manage_users')).toBe(false)
    expect(roleCan('administrator', 'manage_settings')).toBe(true)
    expect(roleCan('editor', 'manage_settings')).toBe(false)
    expect(roleCan('editor', 'edit')).toBe(true)
  })
  it('editors cannot see Security or System workspaces', () => {
    const ids = visibleWorkspaces('editor').map(w => w.id)
    expect(ids).not.toContain('security')
    expect(ids).not.toContain('system')
    expect(ids).toContain('erp')
    expect(visibleWorkspaces('super_admin').length).toBe(WORKSPACES.length)
  })
  it('visibleGroups drops empty groups + gated items', () => {
    const erp = workspaceById('erp')!
    expect(visibleGroups('editor', erp).length).toBeGreaterThan(0)
    // security workspace is fully hidden from editors → no groups
    expect(visibleGroups('editor', workspaceById('security')!).length).toBe(0)
  })
  it('quickActionsFor filters by permission', () => {
    expect(quickActionsFor('editor', 'security')).toHaveLength(0)
    expect(quickActionsFor('super_admin', 'security').length).toBeGreaterThan(0)
    expect(quickActionsFor('editor', 'crm').length).toBeGreaterThan(0)
  })
  it('roleDefaultFavorites only returns hrefs the role may see', () => {
    const sa = roleDefaultFavorites('super_admin')
    expect(sa).toContain('/admin/users')      // super_admin sees Security
    expect(sa.length).toBeGreaterThan(0)
    const ed = roleDefaultFavorites('editor')
    expect(ed).not.toContain('/admin/users')  // editor cannot see Security
    expect(ed).toContain('/admin')            // dashboard always visible
  })
})

describe('breadcrumb engine', () => {
  it('builds Workspaces › Workspace › Module', () => {
    const c = breadcrumbFor('/admin/inventory')
    expect(c.map(x => x.href)).toEqual(['/admin/home', '/admin/finance', '/admin/inventory'])
    expect(c[1].labelEn).toBe('ERP Platform')
  })
  it('collapses to 2 crumbs on a workspace landing page', () => {
    expect(breadcrumbFor('/admin/finance').map(x => x.href)).toEqual(['/admin/home', '/admin/finance'])
  })
  it('handles dashboard routes', () => {
    const c = breadcrumbFor('/admin/dashboards/operations')
    expect(c[c.length - 1].labelEn).toBe('Dashboard')
    expect(c[1].labelEn).toBe('Operations Center')
  })
  it('findItem resolves the active module', () => {
    expect(findItem('/admin/numbering')?.item.href).toBe('/admin/numbering')
    expect(findItem('/admin/nope')).toBeNull()
  })
})

describe('read-only roles (26.22)', () => {
  it('auditor and viewer hold no write permissions', () => {
    for (const role of ['auditor', 'viewer']) {
      expect(roleCan(role, 'edit')).toBe(false)
      expect(roleCan(role, 'manage_settings')).toBe(false)
      expect(roleCan(role, 'manage_users')).toBe(false)
    }
  })
  // 26.29: analytics/documentation were merged away; the shareholder view is
  // now executive + brand (dashboards and public content). CC-005.
  it('viewer sees only the executive + brand workspaces', () => {
    const ids = visibleWorkspaces('viewer').map(w => w.id).sort()
    expect(ids).toEqual(['brand', 'executive'])
  })
  it('auditor sees the security workspace (audit trail) but never ERP editing', () => {
    const ids = visibleWorkspaces('auditor').map(w => w.id)
    expect(ids).toContain('security')
    expect(ids).toContain('operations')
    expect(ids).not.toContain('erp')
  })
  it('full-permission roles are unaffected by the whitelist', () => {
    const ids = visibleWorkspaces('super_admin').map(w => w.id)
    expect(ids).toContain('erp')
    expect(ids).toContain('security')
  })
})
