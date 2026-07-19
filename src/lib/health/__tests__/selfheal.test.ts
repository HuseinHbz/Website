import { describe, it, expect } from 'vitest'
import {
  HEAL_CHECKS, checkDef, actionFor, riskScore, overallHealth, healthGrade,
  isExpiredContract, hasNegativeMargin, duplicatePaymentGroups, buildHealthPrompt,
  type HealFinding, type HealthComponent,
} from '../selfheal'

describe('HEAL_CHECKS registry', () => {
  it('has 12 unique, bilingual checks', () => {
    expect(HEAL_CHECKS).toHaveLength(12)
    expect(new Set(HEAL_CHECKS.map(c => c.code)).size).toBe(12)
    for (const c of HEAL_CHECKS) {
      expect(c.en.length).toBeGreaterThan(0)
      expect(c.fa.length).toBeGreaterThan(0)
      expect(['critical', 'warning', 'info']).toContain(c.severity)
    }
  })
  it('marks only the provably-safe checks auto-fixable', () => {
    const fixable = HEAL_CHECKS.filter(c => c.autoFixable).map(c => c.code)
    expect(fixable.sort()).toEqual(['contract_expired_active', 'import_job_stuck', 'orphan_holds', 'purchase_invoice_unposted', 'sales_invoice_unposted'])
  })
  it('checkDef finds by code and returns undefined for unknown', () => {
    expect(checkDef('gl_unbalanced')?.severity).toBe('critical')
    expect(checkDef('nope')).toBeUndefined()
  })
})

describe('actionFor', () => {
  const fix = checkDef('sales_invoice_unposted')!
  const crit = checkDef('gl_unbalanced')!
  const info = checkDef('negative_margin')!
  it('auto-fixed when fixable and fixed', () => expect(actionFor(fix, true)).toBe('auto_fixed'))
  it('alert when fixable but not fully fixed', () => expect(actionFor(fix, false)).toBe('alert'))
  it('alert for critical non-fixable', () => expect(actionFor(crit, false)).toBe('alert'))
  it('recommendation for info severity', () => expect(actionFor(info, false)).toBe('recommendation'))
})

describe('riskScore', () => {
  const f = (severity: HealFinding['severity'], count: number, fixed = 0): HealFinding =>
    ({ code: 'x', count, fixed, action: 'alert', severity })
  it('is 0 with no findings', () => expect(riskScore([])).toBe(0))
  it('weights critical > warning > info', () => {
    expect(riskScore([f('critical', 1)])).toBe(12)
    expect(riskScore([f('warning', 1)])).toBe(5)
    expect(riskScore([f('info', 1)])).toBe(1)
  })
  it('ignores fixed findings', () => expect(riskScore([f('critical', 3, 3)])).toBe(0))
  it('counts only the open remainder', () => expect(riskScore([f('warning', 4, 2)])).toBe(10))
  it('caps at 100', () => expect(riskScore([f('critical', 50)])).toBe(100))
})

describe('overallHealth / healthGrade', () => {
  const c = (score: number, weight: number): HealthComponent => ({ key: 'k', en: 'e', fa: 'f', score, weight })
  it('returns 100 with no components', () => expect(overallHealth([])).toBe(100))
  it('weights components', () => expect(overallHealth([c(100, 3), c(0, 1)])).toBe(75))
  it('clamps out-of-range scores', () => expect(overallHealth([c(150, 1), c(-20, 1)])).toBe(50))
  it('grades boundaries', () => {
    expect(healthGrade(90)).toBe('healthy')
    expect(healthGrade(89)).toBe('degraded')
    expect(healthGrade(75)).toBe('degraded')
    expect(healthGrade(74)).toBe('at_risk')
    expect(healthGrade(50)).toBe('at_risk')
    expect(healthGrade(49)).toBe('critical')
  })
})

describe('business validators', () => {
  it('isExpiredContract', () => {
    expect(isExpiredContract('2026-01-01', '2026-07-13')).toBe(true)
    expect(isExpiredContract('2027-01-01', '2026-07-13')).toBe(false)
    expect(isExpiredContract(null, '2026-07-13')).toBe(false)
  })
  it('hasNegativeMargin', () => {
    expect(hasNegativeMargin(90, 100)).toBe(true)
    expect(hasNegativeMargin(110, 100)).toBe(false)
    expect(hasNegativeMargin(0, 100)).toBe(false) // unpriced ≠ negative margin
    expect(hasNegativeMargin(50, 0)).toBe(false) // no cost recorded
  })
  it('duplicatePaymentGroups groups by target+amount+date', () => {
    const groups = duplicatePaymentGroups([
      { id: 1, refId: 7, amount: 500, date: '2026-07-01' },
      { id: 2, refId: 7, amount: 500, date: '2026-07-01' },
      { id: 3, refId: 7, amount: 500, date: '2026-07-02' }, // different day
      { id: 4, refId: 8, amount: 500, date: '2026-07-01' }, // different target
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].map(p => p.id)).toEqual([1, 2])
  })
  it('duplicatePaymentGroups ignores non-positive amounts', () => {
    expect(duplicatePaymentGroups([
      { id: 1, refId: 7, amount: 0, date: 'd' },
      { id: 2, refId: 7, amount: 0, date: 'd' },
    ])).toHaveLength(0)
  })
})

describe('buildHealthPrompt', () => {
  it('grounds the system prompt in the snapshot only', () => {
    const { systemPrompt, userMessage } = buildHealthPrompt('root_cause', 'RISK 42', { locale: 'fa' })
    expect(systemPrompt).toContain('RISK 42')
    expect(systemPrompt).toContain('Persian')
    expect(systemPrompt).toContain('Never invent')
    expect(userMessage).toContain('ROOT-CAUSE')
  })
  it('appends the optional question and covers every action', () => {
    for (const kind of ['root_cause', 'recommend', 'risk', 'forecast', 'optimize', 'workflow'] as const) {
      const { userMessage } = buildHealthPrompt(kind, 's', { question: 'why?' })
      expect(userMessage).toContain('Question: why?')
      expect(userMessage.length).toBeGreaterThan(20)
    }
  })
})
