import { describe, it, expect } from 'vitest'
import {
  scorePct, grade, domainQuality, overallScore,
  normalizeKey, duplicateGroups, duplicateBurden, integritySummary,
  type IntegrityIssue,
} from '../quality'

describe('scorePct + grade', () => {
  it('computes a percentage', () => {
    expect(scorePct(8, 10)).toBe(80)
    expect(scorePct(10, 10)).toBe(100)
    expect(scorePct(0, 10)).toBe(0)
  })
  it('treats an empty set as a clean 100', () => {
    expect(scorePct(0, 0)).toBe(100)
  })
  it('clamps present within [0, total]', () => {
    expect(scorePct(15, 10)).toBe(100)
    expect(scorePct(-5, 10)).toBe(0)
  })
  it('grades by band', () => {
    expect(grade(97)).toBe('excellent')
    expect(grade(88)).toBe('good')
    expect(grade(72)).toBe('fair')
    expect(grade(40)).toBe('poor')
  })
})

describe('domainQuality', () => {
  it('averages per-field coverage into a domain score', () => {
    const q = domainQuality('customers', 10, [
      { key: 'email', en: 'Email', fa: 'ایمیل', present: 10, total: 10 }, // 100
      { key: 'phone', en: 'Phone', fa: 'تلفن', present: 6, total: 10 },   // 60
    ])
    expect(q.score).toBe(80)
    expect(q.grade).toBe('fair')
    expect(q.fields[1].missing).toBe(4)
    expect(q.fields[1].pct).toBe(60)
  })
  it('is a clean 100 for an empty domain', () => {
    const q = domainQuality('products', 0, [{ key: 'x', en: 'X', fa: 'X', present: 0, total: 0 }])
    expect(q.score).toBe(100)
    expect(q.grade).toBe('excellent')
  })
  it('handles no field specs', () => {
    expect(domainQuality('d', 5, []).score).toBe(100)
  })
})

describe('overallScore', () => {
  it('averages domain scores', () => {
    expect(overallScore([{ score: 90 }, { score: 80 }, { score: 100 }])).toBe(90)
  })
  it('is 100 with no domains', () => {
    expect(overallScore([])).toBe(100)
  })
})

describe('normalizeKey', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizeKey('  Foo   Bar ')).toBe('foo bar')
    expect(normalizeKey('ACME')).toBe('acme')
  })
  it('maps null/undefined/blank to empty', () => {
    expect(normalizeKey(null)).toBe('')
    expect(normalizeKey(undefined)).toBe('')
    expect(normalizeKey('   ')).toBe('')
  })
})

interface Rec { id: number; name: string; key: string | null }
const rows: Rec[] = [
  { id: 1, name: 'A', key: '0012345' },
  { id: 2, name: 'B', key: '0012345' }, // dup of 1
  { id: 3, name: 'C', key: ' 0012345 ' }, // dup of 1 after normalize
  { id: 4, name: 'D', key: '999' },
  { id: 5, name: 'E', key: null }, // ignored
  { id: 6, name: 'F', key: '' },   // ignored
]

describe('duplicateGroups', () => {
  it('groups records sharing a non-empty normalized key', () => {
    const g = duplicateGroups(rows, 'customer.national_id', r => r.key, r => r.id, r => r.name)
    expect(g).toHaveLength(1)
    expect(g[0].value).toBe('0012345')
    expect(g[0].members.map(m => m.id).sort()).toEqual([1, 2, 3])
  })
  it('ignores singletons and blank/null keys', () => {
    const g = duplicateGroups(rows, 'k', r => r.key, r => r.id, r => r.name)
    expect(g.every(grp => grp.members.length > 1)).toBe(true)
    expect(g.flatMap(grp => grp.members.map(m => m.id))).not.toContain(4)
    expect(g.flatMap(grp => grp.members.map(m => m.id))).not.toContain(5)
  })
  it('duplicateBurden counts redundant records (Σ members−1)', () => {
    const g = duplicateGroups(rows, 'k', r => r.key, r => r.id, r => r.name)
    expect(duplicateBurden(g)).toBe(2) // 3 members → 2 redundant
  })
  it('empty input → no groups, zero burden', () => {
    const g = duplicateGroups([], 'k', (r: Rec) => r.key, r => r.id, r => r.name)
    expect(g).toHaveLength(0)
    expect(duplicateBurden(g)).toBe(0)
  })
})

describe('integritySummary', () => {
  const issues: IntegrityIssue[] = [
    { code: 'e1', severity: 'error', en: 'E', fa: 'E', count: 2 },
    { code: 'w1', severity: 'warning', en: 'W', fa: 'W', count: 3 },
    { code: 'r1', severity: 'recommendation', en: 'R', fa: 'R', count: 5 },
    { code: 'z1', severity: 'error', en: 'Z', fa: 'Z', count: 0 }, // dropped
  ]
  it('drops zero-count issues and sorts by severity', () => {
    const s = integritySummary(issues)
    expect(s.issues).toHaveLength(3)
    expect(s.issues[0].severity).toBe('error')
    expect(s.issues.some(i => i.code === 'z1')).toBe(false)
  })
  it('tallies per-severity affected counts', () => {
    const s = integritySummary(issues)
    expect(s.errors).toBe(2)
    expect(s.warnings).toBe(3)
    expect(s.recommendations).toBe(5)
    expect(s.totalAffected).toBe(10)
  })
  it('scores errors heaviest', () => {
    const s = integritySummary(issues)
    // 2*8 + 3*3 + 5*1 = 30 penalty
    expect(s.score).toBe(70)
  })
  it('a clean set scores 100', () => {
    expect(integritySummary([{ code: 'x', severity: 'error', en: 'X', fa: 'X', count: 0 }]).score).toBe(100)
    expect(integritySummary([]).score).toBe(100)
  })
  it('floors the score at 0', () => {
    const s = integritySummary([{ code: 'big', severity: 'error', en: 'B', fa: 'B', count: 100 }])
    expect(s.score).toBe(0)
  })
})
