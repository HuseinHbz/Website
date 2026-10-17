import { describe, it, expect } from 'vitest'
import { defaultClassification, defaultCashFlowCategory, resolvedClassification, needsClassificationQueue } from '../classification'

describe('account classification defaults (ERPFIX-7, BUG-ERP-19)', () => {
  it('splits assets into current/non-current by code range', () => {
    expect(defaultClassification('1100', 'asset')).toBe('current_asset')
    expect(defaultClassification('1500', 'asset')).toBe('non_current_asset')
    expect(defaultClassification('1590', 'asset')).toBe('non_current_asset')
  })
  it('splits liabilities into current/non-current by code range', () => {
    expect(defaultClassification('2000', 'liability')).toBe('current_liability')
    expect(defaultClassification('2500', 'liability')).toBe('non_current_liability')
  })
  it('equity is always equity', () => {
    expect(defaultClassification('3000', 'equity')).toBe('equity')
  })
  it('revenue/expense split operating vs non-operating/tax', () => {
    expect(defaultClassification('4000', 'revenue')).toBe('operating_revenue')
    expect(defaultClassification('4900', 'revenue')).toBe('non_operating_revenue')
    expect(defaultClassification('6100', 'expense')).toBe('operating_expense')
    expect(defaultClassification('6980', 'expense')).toBe('tax_expense')
  })
  it('an unparsable code is unclassified, never guessed', () => {
    expect(defaultClassification('ABC', 'asset')).toBe('unclassified')
  })
  it('cash-flow category: cash accounts detected by code prefix', () => {
    expect(defaultCashFlowCategory('1010', 'asset')).toBe('cash')
    expect(defaultCashFlowCategory('1200', 'asset')).toBe('operating')
    expect(defaultCashFlowCategory('1500', 'asset')).toBe('investing')
    expect(defaultCashFlowCategory('3000', 'equity')).toBe('financing')
  })
  it('resolvedClassification prefers the stored value over the default', () => {
    const acc = { id: 1, code: '1100', type: 'asset' as const, classification: 'non_current_asset' as const }
    expect(resolvedClassification(acc)).toBe('non_current_asset')
  })
  it('needsClassificationQueue lists only unverified accounts', () => {
    const accounts = [
      { id: 1, code: '1100', type: 'asset' as const, classificationVerified: true },
      { id: 2, code: '1200', type: 'asset' as const, classificationVerified: false },
    ]
    const q = needsClassificationQueue(accounts)
    expect(q.map(a => a.id)).toEqual([2])
  })
})
