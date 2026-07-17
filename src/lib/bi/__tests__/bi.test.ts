import { describe, it, expect } from 'vitest'
import { evalFormula, validateFormula, tokenize, attainment, kpiStatus, scoreKpi, scorecard } from '@/lib/bi/kpiFormula'
import { krProgress, objectiveProgress, okrStatus, confidence, alignmentRollup } from '@/lib/bi/okr'
import { caseDurations, cycleTime, aggregateStages, bottleneck, delayChangePct, performanceScore } from '@/lib/bi/processMining'
import { businessHoursBetween, slaState, dueSlaEscalations, PRIORITY_HOURS } from '@/lib/bi/sla'
import { buildAlerts, channelsFor, alertSummary } from '@/lib/bi/businessAlerts'
import { qualityReport } from '@/lib/bi/dataQuality'

describe('KPI formula engine (26.13 M2)', () => {
  it('evaluates arithmetic + precedence + parens', () => {
    expect(evalFormula('2 + 3 * 4', {})).toBe(14)
    expect(evalFormula('(2 + 3) * 4', {})).toBe(20)
    expect(evalFormula('-5 + 10', {})).toBe(5)
  })
  it('resolves named metrics (gross margin)', () => {
    expect(evalFormula('(revenue - cogs) / revenue * 100', { revenue: 1000, cogs: 600 })).toBe(40)
  })
  it('missing metric → 0, div-by-zero → 0', () => {
    expect(evalFormula('a + b', { a: 5 })).toBe(5)
    expect(evalFormula('x / y', { x: 5, y: 0 })).toBe(0)
  })
  it('validates + lists referenced metrics', () => {
    const v = validateFormula('(revenue - cogs) / revenue')
    expect(v.valid).toBe(true)
    expect(v.metrics.sort()).toEqual(['cogs', 'revenue'])
    expect(validateFormula('2 +* 3').valid).toBe(false)
    expect(validateFormula('(1 + 2').valid).toBe(false)
  })
  it('tokenizes dotted identifiers', () => {
    expect(tokenize('sales.total').filter(t => t.t === 'id')).toHaveLength(1)
  })
  it('attainment + status honour direction', () => {
    expect(attainment(90, 100, 'higher_better')).toBe(90)
    expect(attainment(80, 100, 'lower_better')).toBe(125)   // lower actual is better
    expect(kpiStatus(96, true)).toBe('on_target')
    expect(kpiStatus(85, true)).toBe('at_risk')
    expect(kpiStatus(50, true)).toBe('off_target')
    expect(kpiStatus(50, false)).toBe('no_target')
  })
  it('scoreKpi + scorecard weighted', () => {
    expect(scoreKpi({ actual: 100, target: 100, direction: 'higher_better', weight: 2 }).status).toBe('on_target')
    const s = scorecard([{ actual: 100, target: 100, direction: 'higher_better', weight: 1 }, { actual: 50, target: 100, direction: 'higher_better', weight: 1 }])
    expect(s.score).toBe(75)
  })
})

describe('OKR engine (26.13 M3)', () => {
  it('key result + objective progress', () => {
    expect(krProgress({ start: 0, target: 100, current: 40 })).toBe(40)
    expect(krProgress({ start: 100, target: 0, current: 50 })).toBe(50)  // downward KR
    expect(objectiveProgress([{ start: 0, target: 100, current: 40 }, { start: 0, target: 100, current: 60 }])).toBe(50)
  })
  it('status + confidence vs elapsed time', () => {
    expect(okrStatus(0, 0.5)).toBe('not_started')
    expect(okrStatus(48, 0.5)).toBe('on_track')
    expect(okrStatus(20, 0.5)).toBe('behind')
    expect(confidence(50, 0.5)).toBe(1)
    expect(alignmentRollup([{ progress: 40 }, { progress: 60 }])).toBe(50)
  })
})

describe('process mining (26.13 M4)', () => {
  const c1 = [{ stage: 'draft', at: '2026-01-01T08:00:00Z' }, { stage: 'submitted', at: '2026-01-01T10:00:00Z' }, { stage: 'approved', at: '2026-01-01T18:00:00Z' }]
  it('durations, cycle time, bottleneck', () => {
    const d = caseDurations(c1)
    expect(d[0].hours).toBe(2)
    expect(cycleTime(c1)).toBe(10)
    const stats = aggregateStages([c1, c1])
    expect(bottleneck(stats)!.transition).toBe('submitted→approved')
    expect(bottleneck(stats)!.avgHours).toBe(8)
  })
  it('delay change + performance score', () => {
    expect(delayChangePct(135, 100)).toBe(35)   // "increased 35%"
    expect(performanceScore(10, 10, 0)).toBe(100)
    expect(performanceScore(20, 10, 0)).toBe(50)
    expect(performanceScore(10, 10, 50)).toBe(50)
  })
})

describe('SLA engine (26.13 M5)', () => {
  it('business hours skip nights/weekends', () => {
    // Sat 2026-01-03 08:00 → 12:00 = 4 business hours (Sat is a working day).
    expect(businessHoursBetween('2026-01-03T08:00:00Z', '2026-01-03T12:00:00Z')).toBe(4)
    // Across a day boundary: only the working window counts, capped at 9h/day.
    const h = businessHoursBetween('2026-01-03T08:00:00Z', '2026-01-04T17:00:00Z')
    expect(h).toBeGreaterThan(9)
  })
  it('holiday excluded', () => {
    expect(businessHoursBetween('2026-01-03T08:00:00Z', '2026-01-03T17:00:00Z', undefined, ['2026-01-03'])).toBe(0)
  })
  it('state + escalation + priority', () => {
    expect(slaState(3, 10)).toBe('within')
    expect(slaState(9, 10)).toBe('due_soon')
    expect(slaState(11, 10)).toBe('breached')
    expect(dueSlaEscalations(9, 10, [1]).map(r => r.level)).toEqual([2])
    expect(PRIORITY_HOURS.critical).toBe(4)
  })
})

describe('business alert engine (26.13 M6)', () => {
  it('routes channels by severity + dedupes + summarises', () => {
    expect(channelsFor('critical')).toContain('webhook')
    expect(channelsFor('info')).toEqual(['dashboard'])
    const alerts = buildAlerts([
      { kind: 'budget_over', domain: 'financial', severity: 'critical', titleEn: 'Budget over', titleFa: 'فراتر از بودجه', refType: 'budget', refId: 1 },
      { kind: 'budget_over', domain: 'financial', severity: 'critical', titleEn: 'dup', titleFa: 'dup', refType: 'budget', refId: 1 }, // dedup
      { kind: 'low_stock', domain: 'operational', severity: 'warning', titleEn: 'Low stock', titleFa: 'کسری موجودی' },
      { kind: 'failed_login', domain: 'security', severity: 'info', titleEn: 'Login', titleFa: 'ورود' },
    ])
    expect(alerts).toHaveLength(3)                 // one deduped
    expect(alerts[0].severity).toBe('critical')    // sorted
    const s = alertSummary(alerts)
    expect(s.total).toBe(3); expect(s.critical).toBe(1); expect(s.byDomain.financial).toBe(1)
  })
})

describe('data quality engine (26.13 M9)', () => {
  it('scores + grades + filters issues', () => {
    const r = qualityReport([
      { key: 'cust_no_email', labelEn: 'Customers missing email', labelFa: '', affected: 10, total: 100, severity: 'medium', suggestionEn: 'Add email', suggestionFa: '' },
      { key: 'dup_vendor', labelEn: 'Duplicate vendors', labelFa: '', affected: 0, total: 50, severity: 'high', suggestionEn: 'Merge', suggestionFa: '' },
    ])
    expect(r.issues).toHaveLength(1)               // only the failing check surfaces
    expect(r.score).toBeLessThan(100)
    expect(['A', 'B', 'C', 'D']).toContain(r.grade)
    expect(r.totalAffected).toBe(10)
  })
})
