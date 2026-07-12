import { describe, it, expect } from 'vitest'
import { budgetTotal, actualTotal, budgetVariance, budgetSummary, consumptionStatus, forecastRemaining, canTransition, isEditable } from '@/lib/erp/budget'
import { centerRollup, profitLine, allocate, buildTree } from '@/lib/erp/costCenter'
import { forecast, projectGrowth, nextPeriod } from '@/lib/erp/forecast'
import { buildFinancialKpis, growthRate, collectionDays, inventoryTurnover } from '@/lib/erp/kpiEngine'
import { deriveAlerts } from '@/lib/erp/financialAlerts'

describe('budget engine (26.11 M1/M2)', () => {
  it('totals + variance (100B budget vs 120B actual = +20%)', () => {
    const lines = [{ category: 'Hardware', amount: 100 }]
    const actuals = [{ category: 'Hardware', amount: 120 }]
    expect(budgetTotal(lines)).toBe(100)
    expect(actualTotal(actuals)).toBe(120)
    const rows = budgetVariance(lines, actuals, 'category')
    expect(rows[0].variance).toBe(20)
    expect(rows[0].variancePct).toBe(20)
    expect(rows[0].consumptionPct).toBe(120)
    expect(rows[0].status).toBe('over')
    expect(rows[0].remaining).toBe(-20)
  })

  it('consumption status thresholds', () => {
    expect(consumptionStatus(120)).toBe('over')
    expect(consumptionStatus(95)).toBe('warning')
    expect(consumptionStatus(70)).toBe('on_track')
    expect(consumptionStatus(30)).toBe('under')
  })

  it('groups by category and summarises over-budget + at-risk', () => {
    const lines = [{ category: 'Hardware', amount: 5000 }, { category: 'Software', amount: 1000 }, { category: 'HR', amount: 10000 }]
    const actuals = [{ category: 'Hardware', amount: 5200 }, { category: 'Software', amount: 950 }, { category: 'HR', amount: 9200 }]
    const rows = budgetVariance(lines, actuals, 'category')
    const s = budgetSummary(rows)
    expect(s.budget).toBe(16000)
    expect(s.actual).toBe(15350)
    expect(s.overBudget.map(r => r.key)).toContain('Hardware')  // 104%
    expect(s.atRisk.map(r => r.key)).toContain('HR')            // 92%
    expect(s.status).toBe('warning')                             // 15350/16000 = 95.9% → warning
  })

  it('forecast remaining projects full-period spend', () => {
    // spent 60 of 100 budget with half the year elapsed → projected 120, over by 20
    const f = forecastRemaining(100, 60, 0.5)
    expect(f.projected).toBe(120)
    expect(f.remaining).toBe(40)
    expect(f.forecastVariance).toBe(20)
  })

  it('lifecycle transitions draft→review→approved→locked', () => {
    expect(canTransition('draft', 'review')).toBe(true)
    expect(canTransition('review', 'approved')).toBe(true)
    expect(canTransition('approved', 'locked')).toBe(true)
    expect(canTransition('locked', 'draft')).toBe(false)
    expect(canTransition('draft', 'approved')).toBe(false)
    expect(isEditable('draft')).toBe(true)
    expect(isEditable('locked')).toBe(false)
  })
})

describe('cost/profit center engine (26.11 M3/M4)', () => {
  it('profit line: Tehran 50B rev − 30B cost = 20B, 40% margin', () => {
    const p = profitLine(1, 50, 30)
    expect(p.profit).toBe(20)
    expect(p.marginPct).toBe(40)
  })

  it('rolls up revenue/expense per center', () => {
    const rows = centerRollup([
      { costCenterId: 1, type: 'revenue', amount: 50 },
      { costCenterId: 1, type: 'expense', amount: 30 },
      { costCenterId: 2, type: 'expense', amount: 10 },
    ])
    const c1 = rows.find(r => r.costCenterId === 1)!
    expect(c1.profit).toBe(20)
    expect(c1.marginPct).toBe(40)
    const c2 = rows.find(r => r.costCenterId === 2)!
    expect(c2.cost).toBe(10)
    expect(c2.revenue).toBe(0)
  })

  it('allocates a shared cost by weight and ties to total', () => {
    const a = allocate(100, [{ costCenterId: 1, weight: 1 }, { costCenterId: 2, weight: 3 }])
    expect(a.reduce((s, x) => s + x.amount, 0)).toBe(100)
    expect(a.find(x => x.costCenterId === 2)!.amount).toBe(75)
  })

  it('builds a tree and ignores cycles', () => {
    const tree = buildTree([{ id: 1, code: 'A', name: 'A', kind: 'department' }, { id: 2, code: 'B', name: 'B', kind: 'department', parentId: 1 }])
    expect(tree).toHaveLength(1)
    expect(tree[0].children[0].id).toBe(2)
    const cyc = buildTree([{ id: 1, code: 'A', name: 'A', kind: 'department', parentId: 2 }, { id: 2, code: 'B', name: 'B', kind: 'department', parentId: 1 }])
    expect(cyc.length).toBeGreaterThanOrEqual(1) // no infinite loop
  })
})

describe('forecast engine (26.11 M5)', () => {
  const hist = [{ period: '2025-01', value: 100 }, { period: '2025-02', value: 110 }, { period: '2025-03', value: 120 }]
  it('trend continues the upward line', () => {
    const r = forecast(hist, { method: 'trend', horizon: 2 })
    expect(r.forecast).toHaveLength(2)
    expect(r.forecast[0].period).toBe('2025-04')
    expect(r.forecast[0].value).toBeGreaterThan(120)
  })
  it('growth applies compound %', () => {
    const r = forecast([{ period: '2025-03', value: 100 }], { method: 'growth', horizon: 1, growthPct: 15 })
    expect(r.forecast[0].value).toBe(115)
  })
  it('moving average is flat at the trailing mean', () => {
    const r = forecast(hist, { method: 'moving_average', horizon: 1, window: 3 })
    expect(r.forecast[0].value).toBe(110)
  })
  it('seasonal falls back to trend without a full cycle', () => {
    const r = forecast(hist, { method: 'seasonal', horizon: 1, seasonLength: 12 })
    expect(r.forecast[0].value).toBeGreaterThan(0)
  })
  it('projectGrowth + nextPeriod helpers', () => {
    expect(projectGrowth(100, 15)).toBe(115)
    expect(nextPeriod('2025-12')).toBe('2026-01')
  })
})

describe('KPI engine (26.11 M6)', () => {
  it('derives gross/net margin, runway and growth', () => {
    const k = buildFinancialKpis({
      revenue: 1000, cogs: 600, expenses: 800, netIncome: 200,
      cash: 900, monthlyBurn: 300, outstandingAR: 500, outstandingAP: 300, inventoryValue: 400,
      revenueHistory: [{ period: '2025-01', value: 800 }, { period: '2025-02', value: 1000 }],
    })
    expect(k.profit.gross).toBe(400)
    expect(k.profit.grossMarginPct).toBe(40)
    expect(k.profit.netMarginPct).toBe(20)
    expect(k.cash.runwayMonths).toBe(3)
    expect(k.revenue.growthRatePct).toBe(25)
  })
  it('growthRate / collectionDays / inventoryTurnover', () => {
    expect(growthRate([{ period: 'a', value: 100 }, { period: 'b', value: 115 }])).toBe(15)
    expect(collectionDays(500, 1000, 30)).toBe(15)
    expect(inventoryTurnover(600, 300)).toBe(2)
  })
})

describe('financial alerts engine (26.11 M9)', () => {
  it('fires budget overrun, cash shortage, AR overdue, FX', () => {
    const alerts = deriveAlerts({
      budgets: [{ id: 1, name: 'IT', consumptionPct: 95 }, { id: 2, name: 'Sales', consumptionPct: 130 }],
      cash: { balance: 100, monthlyBurn: 200 },
      overdueAR: [{ customerId: 5, customer: 'Acme', amount: 5000, daysOverdue: 45 }],
      fx: [{ code: 'USD', exposurePct: 40, changePct: 25 }],
    })
    expect(alerts.find(a => a.kind === 'budget_overrun' && a.severity === 'warning')).toBeTruthy()
    expect(alerts.find(a => a.kind === 'budget_overrun' && a.severity === 'critical')).toBeTruthy()
    expect(alerts.find(a => a.kind === 'cash_shortage' && a.severity === 'critical')).toBeTruthy()
    expect(alerts.find(a => a.kind === 'ar_overdue')).toBeTruthy()
    expect(alerts.find(a => a.kind === 'fx_exposure')).toBeTruthy()
    // fingerprints are stable + unique per subject
    expect(new Set(alerts.map(a => a.fingerprint)).size).toBe(alerts.length)
  })
  it('no alerts on a healthy book', () => {
    expect(deriveAlerts({ budgets: [{ name: 'IT', consumptionPct: 40 }], cash: { balance: 1000, monthlyBurn: 100 } })).toHaveLength(0)
  })
})
