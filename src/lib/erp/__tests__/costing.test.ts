import { describe, it, expect } from 'vitest'
import { costByCategory, costingSummary, costingKpis } from '../costing'

describe('cost by category', () => {
  it('sums per category and folds in timesheet labor', () => {
    const c = costByCategory([
      { category: 'equipment', amount: 500 },
      { category: 'purchase', amount: 300 },
      { category: 'labor', amount: 200 },
    ], 1000)
    expect(c.equipment).toBe(500)
    expect(c.purchase).toBe(300)
    expect(c.labor).toBe(1200) // 200 manual + 1000 from timesheets
  })
})

describe('costing summary', () => {
  const summary = costingSummary({
    budget: 10000,
    costEntries: [{ category: 'equipment', amount: 2000 }, { category: 'purchase', amount: 1000 }],
    revenueEntries: [{ amount: 8000 }],
    laborFromTimesheets: 2000,
    progressPct: 50,
  })
  it('totals cost incl. derived labor', () => {
    expect(summary.totalCost).toBe(5000) // 2000 + 1000 + 2000 labor
  })
  it('computes profit and margin', () => {
    expect(summary.totalRevenue).toBe(8000)
    expect(summary.profit).toBe(3000)
    expect(summary.marginPct).toBe(37.5)
    expect(summary.isLoss).toBe(false)
  })
  it('computes budget variance', () => {
    expect(summary.variance).toBe(5000) // 10000 - 5000
    expect(summary.overBudget).toBe(false)
  })
  it('forecasts cost at completion via earned value', () => {
    // 5000 spent at 50% → EAC 10000; VAC 0
    expect(summary.eac).toBe(10000)
    expect(summary.vac).toBe(0)
    expect(summary.forecastOverrun).toBe(false)
  })
  it('flags a projected overrun when cost outpaces progress', () => {
    const s = costingSummary({ budget: 10000, costEntries: [{ category: 'purchase', amount: 6000 }], revenueEntries: [], progressPct: 50 })
    expect(s.eac).toBe(12000) // 6000 / 0.5
    expect(s.forecastOverrun).toBe(true)
    expect(s.vac).toBe(-2000)
  })
  it('reports a loss when cost exceeds revenue', () => {
    const s = costingSummary({ budget: 5000, costEntries: [{ category: 'purchase', amount: 7000 }], revenueEntries: [{ amount: 4000 }], progressPct: 100 })
    expect(s.profit).toBe(-3000)
    expect(s.isLoss).toBe(true)
    expect(s.overBudget).toBe(true)
  })
})

describe('portfolio costing KPIs', () => {
  it('rolls up budget, cost, revenue and over-budget count', () => {
    const k = costingKpis([
      { budget: 10000, cost: 5000, revenue: 8000 },
      { budget: 5000, cost: 7000, revenue: 6000 },
    ])
    expect(k.projects).toBe(2)
    expect(k.budget).toBe(15000)
    expect(k.cost).toBe(12000)
    expect(k.revenue).toBe(14000)
    expect(k.profit).toBe(2000)
    expect(k.overBudget).toBe(1)
  })
})
