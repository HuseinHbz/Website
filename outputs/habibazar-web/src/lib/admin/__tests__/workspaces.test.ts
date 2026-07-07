import { describe, it, expect } from 'vitest'
import { WORKSPACES, workspaceForPath, workspaceById, workspaceHome, allNavItems } from '../workspaces'

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
