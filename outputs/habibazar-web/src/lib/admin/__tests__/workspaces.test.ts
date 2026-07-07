import { describe, it, expect } from 'vitest'
import { WORKSPACES, workspaceForPath, workspaceById, workspaceHome, allNavItems, roleCan, visibleWorkspaces, visibleGroups, quickActionsFor, breadcrumbFor, findItem } from '../workspaces'

describe('workspace registry', () => {
  it('has 12 workspaces with unique ids', () => {
    expect(WORKSPACES).toHaveLength(12)
    expect(new Set(WORKSPACES.map(w => w.id)).size).toBe(12)
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
