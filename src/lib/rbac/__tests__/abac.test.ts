import { describe, it, expect } from 'vitest'
import { stripFields } from '../data'
import { SCOPED_MODULES, SENSITIVE_FIELDS, isValidOpKey, isValidKey } from '../registry'

describe('26.28 بند ۳ — stripFields (sensitive-field cover)', () => {
  it('removes the KEY entirely — not undefined, not null', () => {
    const out = stripFields([{ sku: 'A', value: 10, avgCost: 5, onHand: 3 }], ['value', 'avgCost'])
    expect('value' in out[0]).toBe(false)
    expect('avgCost' in out[0]).toBe(false)
    expect(Object.keys(out[0]).sort()).toEqual(['onHand', 'sku'])
  })

  it('leaves non-listed fields byte-identical', () => {
    const row = { a: 1, b: 'x', c: null as unknown }
    expect(stripFields([row], ['missing'])[0]).toEqual(row)
  })

  it('handles empty rows and empty field lists', () => {
    expect(stripFields([], ['value'])).toEqual([])
    expect(stripFields([{ a: 1 }], [])).toEqual([{ a: 1 }])
  })

  it('does not mutate the input rows', () => {
    const row = { a: 1, secret: 2 }
    stripFields([row], ['secret'])
    expect(row.secret).toBe(2)
  })
})

describe('26.28 بند ۲.۳ — SCOPED_MODULES registry honesty', () => {
  it('every scoped module is a real registry key', () => {
    for (const key of Object.keys(SCOPED_MODULES)) expect(isValidKey(key), key).toBe(true)
  })

  it('never advertises the unimplemented company scope (no empty promises)', () => {
    for (const scopes of Object.values(SCOPED_MODULES)) {
      expect(scopes).not.toContain('company')
    }
  })

  it('always offers all (the R5 default) so a scope can be reverted', () => {
    for (const scopes of Object.values(SCOPED_MODULES)) expect(scopes).toContain('all')
  })

  it('covers the priority modules of the spec (CRM / sales / projects)', () => {
    expect(Object.keys(SCOPED_MODULES)).toEqual(expect.arrayContaining([
      'crm.crm', 'crm.crm.tickets', 'crm.crm.customers', 'erp.sales', 'erp.project-management',
    ]))
  })
})

describe('26.28 بند ۳ — SENSITIVE_FIELDS registry', () => {
  it('every field-cover key is a registered sensitive op', () => {
    for (const opKey of Object.keys(SENSITIVE_FIELDS)) expect(isValidOpKey(opKey), opKey).toBe(true)
  })

  it('declares concrete routes and fields (auditable, not hand-waving)', () => {
    for (const cfg of Object.values(SENSITIVE_FIELDS)) {
      expect(cfg.routes.length).toBeGreaterThan(0)
      expect(cfg.fields.length).toBeGreaterThan(0)
    }
  })
})

describe('26.28 بند ۱.۵ — financial-op pattern for the mandatory-2FA policy', () => {
  const FINANCIAL_OP = /^(erp\.(finance|sales|purchasing|treasury|approvals|moadian))|^system\.settings\.integrations|^backup\.backup/
  it.each([
    'erp.finance:post', 'erp.finance:close_period', 'erp.sales:confirm', 'erp.purchasing:void',
    'erp.treasury:reconcile', 'erp.approvals:approve', 'erp.moadian:submit',
    'system.settings.integrations:write', 'backup.backup:restore',
  ])('%s is policy-covered', op => expect(FINANCIAL_OP.test(op)).toBe(true))

  it.each(['erp.inventory:cost_view', 'security.users:reset_2fa', 'crm.crm:whatever'])(
    '%s is NOT policy-covered (non-financial)', op => expect(FINANCIAL_OP.test(op)).toBe(false))
})
