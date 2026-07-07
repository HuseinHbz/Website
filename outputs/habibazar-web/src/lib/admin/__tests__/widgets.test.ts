import { describe, it, expect } from 'vitest'
import { WIDGETS, widgetById, widgetsForWorkspace, defaultLayout, sanitizeLayout } from '../widgets'

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
})
