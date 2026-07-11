import { describe, it, expect } from 'vitest'
import { resolveActiveHref, hrefMatches, hrefPath, QUICK_ACTIONS, WORKSPACES, workspaceForPath } from '../workspaces'

describe('Navigation Resolver Engine (26.7)', () => {
  it('hrefPath strips query/hash', () => {
    expect(hrefPath('/admin/sales?new=invoice')).toBe('/admin/sales')
    expect(hrefPath('/admin/sales')).toBe('/admin/sales')
  })
  it('exact match wins over any prefix match', () => {
    const hrefs = ['/admin/sales', '/admin/sales/invoices', '/admin']
    expect(resolveActiveHref('/admin/sales', hrefs)).toBe('/admin/sales')
    expect(resolveActiveHref('/admin/sales/invoices', hrefs)).toBe('/admin/sales/invoices')
  })
  it('nested route match picks the LONGEST parent (single winner)', () => {
    const hrefs = ['/admin/sales', '/admin/sales/invoices']
    expect(resolveActiveHref('/admin/sales/invoices/42', hrefs)).toBe('/admin/sales/invoices')
  })
  it('boundary-safe: /admin/settings does not activate /admin/s… siblings', () => {
    expect(hrefMatches('/admin/settings', '/admin/se')).toBe(false)
    expect(hrefMatches('/admin/settings/x', '/admin/settings')).toBe(true)
  })
  it('action links (?new=) never activate for a pathname', () => {
    expect(hrefMatches('/admin/sales', '/admin/sales?new=invoice')).toBe(false)
    expect(resolveActiveHref('/admin/sales', ['/admin/sales', '/admin/sales?new=invoice'])).toBe('/admin/sales')
  })
  it('no match → null', () => {
    expect(resolveActiveHref('/admin/unknown', ['/admin/sales'])).toBeNull()
  })
})

describe('Navigation regression (26.7 duplicate-active fix)', () => {
  it('quick actions never share an exact href with a module item', () => {
    const moduleHrefs = new Set(WORKSPACES.flatMap(w => w.groups.flatMap(g => g.items.map(i => i.href))))
    for (const actions of Object.values(QUICK_ACTIONS)) {
      for (const a of actions) {
        // Either a distinct path or a distinct route identity via query params.
        expect(moduleHrefs.has(a.href) && !a.href.includes('?')).toBe(false)
      }
    }
  })
  it('ERP quick actions carry unique route identities', () => {
    const erp = QUICK_ACTIONS.erp.map(a => a.href)
    expect(erp).toContain('/admin/sales?new=invoice')
    expect(erp).toContain('/admin/inventory?new=product')
    expect(erp).toContain('/admin/finance?new=journal')
  })
  it('on /admin/sales exactly one sidebar candidate is active', () => {
    const candidates = ['/admin/sales', '/admin/sales?new=invoice', '/admin/inventory', '/admin/finance?new=journal']
    const active = candidates.filter(h => h === resolveActiveHref('/admin/sales', candidates))
    expect(active).toEqual(['/admin/sales'])
  })
  it('workspaceForPath still resolves ERP + system paths', () => {
    expect(workspaceForPath('/admin/sales').id).toBe('erp')
    expect(workspaceForPath('/admin/settings').id).toBe('system')
  })
})
