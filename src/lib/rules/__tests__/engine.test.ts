import { describe, it, expect } from 'vitest'
import { evalCondition, ruleMatches, runRules, validateRuleSet, type RuleSet } from '../engine'

describe('condition operators', () => {
  const f = { amount: 1500, tier: 'gold', tags: ['vip', 'new'], nested: { qty: 3 } }
  it('handles comparison, membership, contains, between, dotted paths', () => {
    expect(evalCondition({ field: 'amount', op: 'gte', value: 1000 }, f)).toBe(true)
    expect(evalCondition({ field: 'amount', op: 'between', value: [1000, 2000] }, f)).toBe(true)
    expect(evalCondition({ field: 'tier', op: 'in', value: ['gold', 'platinum'] }, f)).toBe(true)
    expect(evalCondition({ field: 'tags', op: 'contains', value: 'vip' }, f)).toBe(true)
    expect(evalCondition({ field: 'nested.qty', op: 'eq', value: 3 }, f)).toBe(true)
    expect(evalCondition({ field: 'amount', op: 'lt', value: 100 }, f)).toBe(false)
  })
})

describe('ruleMatches', () => {
  const f = { amount: 1500, country: 'US' }
  it('combines conditions with all / any', () => {
    expect(ruleMatches({ id: 'r', conditions: [{ field: 'amount', op: 'gte', value: 1000 }, { field: 'country', op: 'eq', value: 'US' }], match: 'all', outputs: {} }, f)).toBe(true)
    expect(ruleMatches({ id: 'r', conditions: [{ field: 'amount', op: 'gte', value: 9999 }, { field: 'country', op: 'eq', value: 'US' }], match: 'any', outputs: {} }, f)).toBe(true)
    expect(ruleMatches({ id: 'r', conditions: [], outputs: {} }, f)).toBe(true)
  })
})

// A discount decision table (higher priority wins in first-match mode).
const DISCOUNT: RuleSet = {
  mode: 'first',
  rules: [
    { id: 'vip', priority: 20, conditions: [{ field: 'tier', op: 'eq', value: 'gold' }], outputs: { discountPct: 20 } },
    { id: 'bulk', priority: 10, conditions: [{ field: 'amount', op: 'gte', value: 1000 }], outputs: { discountPct: 10 } },
    { id: 'none', priority: 0, conditions: [], outputs: { discountPct: 0 } },
  ],
}

describe('runRules', () => {
  it('first-match returns the highest-priority match', () => {
    const r = runRules(DISCOUNT, { tier: 'gold', amount: 1500 })
    expect(r.matched).toEqual(['vip'])
    expect(r.outputs.discountPct).toBe(20)
  })
  it('falls through to the next rule when higher ones do not match', () => {
    const r = runRules(DISCOUNT, { tier: 'silver', amount: 1500 })
    expect(r.matched).toEqual(['bulk'])
    expect(r.outputs.discountPct).toBe(10)
  })
  it('collect mode merges every match (later overrides)', () => {
    const set: RuleSet = { mode: 'collect', rules: [
      { id: 'a', priority: 10, conditions: [], outputs: { x: 1, y: 1 } },
      { id: 'b', priority: 5, conditions: [], outputs: { y: 2 } },
    ] }
    const r = runRules(set, {})
    expect(r.matched).toEqual(['a', 'b'])
    expect(r.outputs).toEqual({ x: 1, y: 2 })
  })
  it('produces a full trace for simulation', () => {
    const r = runRules(DISCOUNT, { tier: 'silver', amount: 500 })
    expect(r.trace.map(t => t.matched)).toEqual([false, false, true])
    expect(r.outputs.discountPct).toBe(0)
  })
})

describe('validateRuleSet', () => {
  it('accepts a well-formed set and rejects bad ones', () => {
    expect(validateRuleSet(DISCOUNT).valid).toBe(true)
    expect(validateRuleSet({ rules: [{ id: 'a', conditions: [{ field: 'x', op: 'bogus' as never }], outputs: {} }] }).valid).toBe(false)
    expect(validateRuleSet({ rules: [{ id: 'a', conditions: [], outputs: {} }, { id: 'a', conditions: [], outputs: {} }] }).valid).toBe(false)
  })
})
