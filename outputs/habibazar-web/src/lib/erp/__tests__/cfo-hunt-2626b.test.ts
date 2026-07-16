import { describe, it, expect } from 'vitest'
import { chequeKpis, pettyCashSummary, canTransition } from '../banking'
import { computeTaxes, vatOf, extractInclusive, IRAN_VAT } from '../tax'

/**
 * Phase 26.26b بند ۵ — CFO financial-integrity hunt (pure-engine slice).
 * The DB-driven scenarios (closed-period assertPostable on every write path,
 * overpayment landing, void GL-linked payment reversal, credit-guard on a
 * credit note) are proven numerically in scripts/verify-2626b-cfo.ts against
 * live Postgres. These are the deterministic engine properties behind the
 * cheque / petty-cash / VAT scenarios.
 */

describe('CFO hunt — bounced cheque (scenario 1)', () => {
  it('a bounced received cheque is excluded from open inflow and counted as bounced', () => {
    const before = chequeKpis([{ status: 'deposited', amount: 5_000_000, dueDate: '2026-07-20' }], '2026-07-15')
    expect(before.openAmount).toBe(5_000_000) // deposited received cheque = open inflow
    expect(before.bounced).toBe(0)
    // The cheque bounces → the money never lands: openAmount drops, bounced rises.
    const after = chequeKpis([{ status: 'bounced', amount: 5_000_000, dueDate: '2026-07-20' }], '2026-07-15')
    expect(after.openAmount).toBe(0)
    expect(after.bounced).toBe(1)
  })
  it('the received-cheque machine allows deposited→bounced but not cleared→bounced', () => {
    expect(canTransition('received', 'deposited', 'bounced')).toBe(true)
    expect(canTransition('received', 'cleared', 'bounced')).toBe(false)
  })
})

describe('CFO hunt — petty-cash negative balance (scenario 6)', () => {
  it('over-spending drives the balance negative and raises lowBalance (never silently 0)', () => {
    const s = pettyCashSummary([
      { kind: 'float', amount: 1_000_000 },
      { kind: 'expense', amount: 1_300_000 },
    ])
    expect(s.balance).toBe(-300_000) // truthfully negative, not clamped to 0
    expect(s.lowBalance).toBe(true)  // flagged for replenishment
  })
  it('replenishment restores a healthy balance', () => {
    const s = pettyCashSummary([
      { kind: 'float', amount: 1_000_000 },
      { kind: 'expense', amount: 1_300_000 },
      { kind: 'replenish', amount: 1_000_000 },
    ])
    expect(s.balance).toBe(700_000)
    expect(s.lowBalance).toBe(false)
  })
})

describe('CFO hunt — VAT rounding (scenario 5)', () => {
  it('Iran VAT 9% rounds to 2 decimals deterministically', () => {
    expect(IRAN_VAT.rate).toBe(9)
    expect(vatOf(33_333)).toBe(2999.97)   // 33333 * 0.09 = 2999.97
    expect(vatOf(100)).toBe(9)
  })
  it('computeTaxes VAT-add keeps grandTotal = base + tax to the cent', () => {
    const r = computeTaxes(1_234_567, [{ kind: 'vat', rate: 9 }])
    expect(r.taxTotal).toBe(111_111.03)             // 1234567 * 0.09 rounded
    expect(r.grandTotal).toBe(1_234_567 + 111_111.03)
  })
  it('extractInclusive splits a VAT-inclusive gross without drift', () => {
    const { net, tax } = extractInclusive(109, 9)
    expect(net + tax).toBe(109)
    expect(tax).toBeCloseTo(9, 2)
  })
})
