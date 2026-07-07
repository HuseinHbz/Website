import { describe, it, expect } from 'vitest'
import { WIDGETS, widgetById, widgetsForWorkspace, defaultLayout, sanitizeLayout, pickLayout, widgetTtl } from '../widgets'

describe('widget registry', () => {
  it('has unique widget ids', () => {
    expect(new Set(WIDGETS.map(w => w.id)).size).toBe(WIDGETS.length)
  })
  it('resolves widgets by workspace (executive sees all)', () => {
    expect(widgetsForWorkspace('crm').every(w => w.workspace === 'crm')).toBe(true)
    expect(widgetsForWorkspace('executive').length).toBe(WIDGETS.length)
  })
  it('builds a default layout with sizes', () => {
    const l = defaultLayout('crm')
    expect(l.length).toBeGreaterThan(0)
    expect(l.every(e => widgetById(e.id))).toBe(true)
    expect(l[0].size).toMatch(/sm|md|lg/)
  })
  it('sanitizes a saved layout: drops foreign/duplicate/invalid entries', () => {
    const dirty = [
      { id: 'kpi_crm_pipeline', size: 'md' as const },
      { id: 'kpi_crm_pipeline', size: 'sm' as const }, // dup
      { id: 'kpi_net_income', size: 'sm' as const },   // foreign to crm
      { id: 'nonexistent', size: 'sm' as const },
    ]
    const clean = sanitizeLayout('crm', dirty)
    expect(clean).toEqual([{ id: 'kpi_crm_pipeline', size: 'md' }])
  })
  it('preserves + clamps widget config', () => {
    const clean = sanitizeLayout('operations', [{ id: 'ops_system_health', size: 'md', config: { refreshInterval: 99999, warn: 80, critical: 90 } }])
    expect(clean[0].config).toEqual({ refreshInterval: 3600, warn: 80, critical: 90 })
  })
})

describe('layout resolution (user → role → default)', () => {
  it('prefers user, then role, then workspace default', () => {
    const u = [{ id: 'kpi_crm_pipeline', size: 'sm' as const }]
    const r = [{ id: 'kpi_crm_leads', size: 'sm' as const }]
    expect(pickLayout('crm', u, r).source).toBe('user')
    expect(pickLayout('crm', null, r).source).toBe('role')
    expect(pickLayout('crm', [], r).source).toBe('role')
    expect(pickLayout('crm', null, null).source).toBe('default')
    expect(pickLayout('crm', null, null).layout.length).toBeGreaterThan(0)
  })
  it('widgetTtl: ops widgets short, others default 5min', () => {
    expect(widgetTtl('ops_system_health')).toBe(30_000)
    expect(widgetTtl('kpi_net_income')).toBe(300_000)
  })
})
