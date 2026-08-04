/**
 * Phase 27 بند۱ — the opportunity engine.
 *
 * The weighted-value figure is the one a sales manager forecasts against, so it
 * is tested against hand-computed numbers rather than against itself.
 */
import { describe, it, expect } from 'vitest'
import {
  weightedValue, pipelineSummary, lossBreakdown, canTransition, allowedTransitions,
  requiresReason, isClosed, itemTotal, itemsTotal, STAGE_DEFAULT_PROBABILITY,
  type Opportunity,
} from '../opportunities'

const opp = (o: Partial<Opportunity>): Opportunity => ({
  title: 'x', amount: 0, probability: 0, stage: 'identified', ...o,
})

describe('weightedValue', () => {
  it('is amount × probability', () => {
    expect(weightedValue({ amount: 1_000_000, probability: 30 })).toBe(300_000)
  })
  it('is zero at 0% — a dead deal contributes nothing', () => {
    expect(weightedValue({ amount: 5_000_000, probability: 0 })).toBe(0)
  })
  it('is the full amount at 100%', () => {
    expect(weightedValue({ amount: 5_000_000, probability: 100 })).toBe(5_000_000)
  })
  it('rounds to whole currency', () => {
    expect(weightedValue({ amount: 333, probability: 33 })).toBe(109.89)
  })
})

describe('pipelineSummary', () => {
  const rows = [
    opp({ amount: 1_000_000, probability: 10, stage: 'identified' }),
    opp({ amount: 2_000_000, probability: 50, stage: 'proposal' }),
    opp({ amount: 4_000_000, probability: 75, stage: 'negotiation' }),
    opp({ amount: 3_000_000, probability: 100, stage: 'won' }),
    opp({ amount: 500_000, probability: 0, stage: 'lost', outcomeReason: 'price' }),
  ]

  it('counts only OPEN deals in the pipeline value', () => {
    // won/lost are decided; including them would double-count revenue
    expect(pipelineSummary(rows).openValue).toBe(7_000_000)
    expect(pipelineSummary(rows).openCount).toBe(3)
  })

  it('weights the pipeline — the number the raw sum flatters', () => {
    // 1M×10% + 2M×50% + 4M×75% = 100k + 1M + 3M
    expect(pipelineSummary(rows).weightedValue).toBe(4_100_000)
  })

  it('reports won and lost value separately', () => {
    const s = pipelineSummary(rows)
    expect(s.wonValue).toBe(3_000_000)
    expect(s.lostValue).toBe(500_000)
  })

  it('computes win rate over DECIDED deals only', () => {
    expect(pipelineSummary(rows).winRatePct).toBe(50)  // 1 won / (1 won + 1 lost)
  })

  it('a pipeline with nothing decided has a 0% win rate, not NaN', () => {
    const s = pipelineSummary([opp({ amount: 100, probability: 10 })])
    expect(s.winRatePct).toBe(0)
    expect(Number.isNaN(s.winRatePct)).toBe(false)
  })

  it('an empty pipeline is all zeros', () => {
    const s = pipelineSummary([])
    expect(s).toMatchObject({ totalCount: 0, openCount: 0, openValue: 0, weightedValue: 0, winRatePct: 0 })
  })

  it('breaks down by stage', () => {
    const s = pipelineSummary(rows)
    expect(s.byStage.find(b => b.stage === 'negotiation')).toMatchObject({ count: 1, value: 4_000_000, weighted: 3_000_000 })
  })
})

describe('stage transitions', () => {
  it('allows moving backwards between open stages — real deals go quiet', () => {
    expect(canTransition('negotiation', 'qualified')).toBe(true)
  })
  it('does not offer a no-op transition', () => {
    expect(canTransition('proposal', 'proposal')).toBe(false)
  })
  it('a closed deal reopens only into an open stage', () => {
    expect(allowedTransitions('won')).toEqual(['identified', 'qualified', 'proposal', 'negotiation'])
    expect(canTransition('won', 'lost')).toBe(false)
  })
  it('knows which stages are closed', () => {
    expect(isClosed('won')).toBe(true)
    expect(isClosed('lost')).toBe(true)
    expect(isClosed('proposal')).toBe(false)
  })
  it('a loss must state a reason; a win need not', () => {
    expect(requiresReason('lost')).toBe(true)
    expect(requiresReason('won')).toBe(false)
  })
  it('suggests a probability per stage', () => {
    expect(STAGE_DEFAULT_PROBABILITY.negotiation).toBe(75)
    expect(STAGE_DEFAULT_PROBABILITY.lost).toBe(0)
  })
})

describe('lossBreakdown', () => {
  it('aggregates by reason, biggest first', () => {
    const r = lossBreakdown([
      opp({ stage: 'lost', amount: 100, outcomeReason: 'price' }),
      opp({ stage: 'lost', amount: 200, outcomeReason: 'price' }),
      opp({ stage: 'lost', amount: 50, outcomeReason: 'timing' }),
      opp({ stage: 'won', amount: 900 }),
    ])
    expect(r[0]).toEqual({ reason: 'price', count: 2, value: 300 })
    expect(r[1]).toEqual({ reason: 'timing', count: 1, value: 50 })
  })
  it('a loss with no reason is labelled, not dropped', () => {
    expect(lossBreakdown([opp({ stage: 'lost', amount: 10 })])[0].reason).toBe('unspecified')
  })
})

describe('item math (matches the sales line convention)', () => {
  it('applies discount then tax on the net', () => {
    // 10 × 1000 = 10 000 → −10% = 9 000 → +9% tax = 9 810
    expect(itemTotal({ qty: 10, unitPrice: 1000, discountPct: 10, taxPct: 9 })).toBe(9810)
  })
  it('sums the proposed lines', () => {
    expect(itemsTotal([
      { qty: 2, unitPrice: 100 },
      { qty: 1, unitPrice: 50, discountPct: 10 },
    ])).toBe(245)
  })
  it('an empty proposal totals zero', () => {
    expect(itemsTotal([])).toBe(0)
  })
})
