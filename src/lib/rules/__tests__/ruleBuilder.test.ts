import { describe, it, expect } from 'vitest'
import { parseDef, serializeDef } from '@/lib/rules/builder'
import { runRules, type RuleSet } from '@/lib/rules/engine'

const STARTER = JSON.stringify({
  mode: 'first',
  rules: [
    { id: 'vip', priority: 20, match: 'all', conditions: [{ field: 'tier', op: 'eq', value: 'gold' }], outputs: { discountPct: 20 } },
    { id: 'bulk', priority: 10, conditions: [{ field: 'amount', op: 'gte', value: 1000 }], outputs: { discountPct: 10 } },
    { id: 'default', priority: 0, conditions: [], outputs: { discountPct: 0 } },
  ],
})

describe('26.10 rule builder parse/serialize round-trip', () => {
  it('the visual model serializes to engine-valid JSON that evaluates the same', () => {
    const model = parseDef(STARTER)!
    expect(model.rules).toHaveLength(3)
    expect(model.rules[0].conditions[0]).toEqual({ field: 'tier', op: 'eq', value: 'gold' })
    const json = serializeDef(model)
    const rebuilt = JSON.parse(json) as RuleSet
    // gold tier → 20% via the engine (value coerced back correctly)
    expect(runRules(rebuilt, { tier: 'gold', amount: 100 }).outputs.discountPct).toBe(20)
    // bulk → 10%
    expect(runRules(rebuilt, { tier: 'silver', amount: 1500 }).outputs.discountPct).toBe(10)
    // default → 0
    expect(runRules(rebuilt, { tier: 'silver', amount: 5 }).outputs.discountPct).toBe(0)
  })
  it('coerces numbers/booleans and drops value for truthy/falsy ops', () => {
    const model = parseDef(JSON.stringify({ mode: 'collect', rules: [{ id: 'r', conditions: [{ field: 'active', op: 'truthy' }, { field: 'n', op: 'gt', value: 5 }], outputs: { ok: true, n: 3 } }] }))!
    const rebuilt = JSON.parse(serializeDef(model))
    expect(rebuilt.rules[0].conditions[0]).toEqual({ field: 'active', op: 'truthy' }) // no value key
    expect(rebuilt.rules[0].conditions[1].value).toBe(5) // number
    expect(rebuilt.rules[0].outputs).toEqual({ ok: true, n: 3 })
  })
})
