import { describe, it, expect } from 'vitest'
import { orderForImport, diffAgainstLive, summarizePlan, type CoaTemplateNode } from '../coaImport'

const nodes: CoaTemplateNode[] = [
  { level: 'detail', code: '1101', parentCode: 'C1_11', nameEn: null, nameFa: 'صندوق', accountType: 'asset', sortOrder: 2 },
  { level: 'group', code: 'G1', parentCode: null, nameEn: 'Current Assets', nameFa: 'دارایی‌های جاری', accountType: 'asset', sortOrder: 0 },
  { level: 'control', code: 'C1_11', parentCode: 'G1', nameEn: null, nameFa: 'موجودی نقد', accountType: 'asset', sortOrder: 1 },
  { level: 'detail', code: '9101', parentCode: 'C9_91', nameEn: null, nameFa: 'اسناد تضمینی', accountType: 'memo', sortOrder: 3 },
]

describe('orderForImport', () => {
  it('orders group before control before detail, regardless of input order', () => {
    const out = orderForImport(nodes)
    expect(out.map(n => n.level)).toEqual(['group', 'control', 'detail', 'detail'])
  })
  it('preserves sortOrder within the same level', () => {
    const shuffled = [...nodes].reverse()
    const out = orderForImport(shuffled)
    expect(out.map(n => n.code)).toEqual(['G1', 'C1_11', '1101', '9101'])
  })
})

describe('diffAgainstLive', () => {
  it('marks codes already present in the live set as exists=true', () => {
    const live = new Set(['G1', '1101'])
    const plan = diffAgainstLive(nodes, live)
    const byCode = new Map(plan.map(p => [p.code, p.exists]))
    expect(byCode.get('G1')).toBe(true)
    expect(byCode.get('1101')).toBe(true)
    expect(byCode.get('C1_11')).toBe(false)
    expect(byCode.get('9101')).toBe(false)
  })
  it('an empty live set marks everything new', () => {
    const plan = diffAgainstLive(nodes, new Set())
    expect(plan.every(p => !p.exists)).toBe(true)
  })
})

describe('summarizePlan', () => {
  it('counts only non-existing nodes as toCreate, grouped by account type', () => {
    const plan = diffAgainstLive(nodes, new Set(['G1']))
    const summary = summarizePlan(plan)
    expect(summary.totalNodes).toBe(4)
    expect(summary.alreadyExists).toBe(1)
    expect(summary.toCreate).toBe(3)
    expect(summary.byType.asset).toBe(2) // control C1_11 + detail 1101
    expect(summary.byType.memo).toBe(1)  // detail 9101
  })
  it('a fully-existing plan creates nothing', () => {
    const allCodes = new Set(nodes.map(n => n.code))
    const plan = diffAgainstLive(nodes, allCodes)
    const summary = summarizePlan(plan)
    expect(summary.toCreate).toBe(0)
    expect(summary.alreadyExists).toBe(4)
  })
})
