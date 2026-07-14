/**
 * Phase 26.24b closeout — fast regressions for behaviours that were only ever
 * covered by live-PG scripts in 26.23/26.24 (BUG-009), plus the new BUG-008
 * purchase auto-post and the delegation self-approval fix (بند ۳).
 */
import { describe, it, expect } from 'vitest'
import { reversalLines } from '../glPosting'
import { purchaseInvoicePostingLines, postingBalanced } from '../purchasing'
import { salesInvoicePostingLines } from '../sales'
import { isSeparationViolation, wouldCreateDelegationCycle, type Delegation } from '@/lib/approval/engine'
import { decideLeadConversion } from '@/lib/crm/leads'

// ── بند ۲.۴ + بند ۱: purchase invoice posting (balance + AP credit) ───────────
describe('purchase invoice → GL posting', () => {
  it('balances Σdebit = Σcredit = total and credits Accounts Payable', () => {
    const net = 10_000_000, tax = 900_000, total = 10_900_000
    const lines = purchaseInvoicePostingLines(net, tax, total)
    expect(postingBalanced(lines)).toBe(true)
    const ap = lines.find(l => l.accountCode === '2000')
    expect(ap?.credit).toBe(total)      // AP credited by the full gross total
    expect(ap?.debit).toBe(0)
    const inv = lines.find(l => l.accountCode === '1200')
    expect(inv?.debit).toBe(net)         // inventory debited net
    const vat = lines.find(l => l.accountCode === '2100')
    expect(vat?.debit).toBe(tax)         // recoverable VAT input debited
  })
  it('omits the VAT line when tax is zero but still balances', () => {
    const lines = purchaseInvoicePostingLines(5_000_000, 0, 5_000_000)
    expect(lines.some(l => l.accountCode === '2100')).toBe(false)
    expect(postingBalanced(lines)).toBe(true)
  })
})

// ── بند ۲.۱: void → reversal is a balanced mirror ─────────────────────────────
describe('reversal entry (void)', () => {
  it('mirrors debit↔credit so the reversal balances against the original', () => {
    const original = salesInvoicePostingLines(10_000_000, 900_000, 10_900_000, 'invoice')
      .map((l, i) => ({ accountId: i + 1, debit: l.debit, credit: l.credit, memo: l.memo }))
    const rev = reversalLines(original)
    // Every line is swapped.
    rev.forEach((r, i) => { expect(r.debit).toBe(original[i].credit); expect(r.credit).toBe(original[i].debit) })
    // Original + reversal net to zero on every account.
    const netByAcct = new Map<number, number>()
    for (const l of [...original, ...rev]) netByAcct.set(l.accountId, (netByAcct.get(l.accountId) ?? 0) + l.debit - l.credit)
    for (const v of netByAcct.values()) expect(v).toBe(0)
  })
  it('preserves memo and defaults a missing memo to null', () => {
    const rev = reversalLines([{ accountId: 1, debit: 100, credit: 0, memo: 'x' }, { accountId: 2, debit: 0, credit: 100 }])
    expect(rev[0].memo).toBe('x')
    expect(rev[1].memo).toBeNull()
  })
})

// ── بند ۲.۲ + بند ۳: separation of duties on the effective decision owner ─────
describe('maker/checker separation of duties', () => {
  it('blocks the creator approving their own journal entry (maker = checker)', () => {
    expect(isSeparationViolation('journal_entry', 'userA', 'userA')).toBe(true)
  })
  it('blocks a delegate acting ON BEHALF OF the creator (delegation proxy)', () => {
    // userB is the nominal actor but represents userA (the creator) via delegation.
    expect(isSeparationViolation('journal_entry', 'userA', 'userB', 'userA')).toBe(true)
  })
  it('allows a genuine third-party checker', () => {
    expect(isSeparationViolation('journal_entry', 'userA', 'userB', 'userC')).toBe(false)
    expect(isSeparationViolation('journal_entry', 'userA', 'userB')).toBe(false)
  })
  it('does not apply to non journal-entry docs', () => {
    expect(isSeparationViolation('purchase_documents', 'userA', 'userA')).toBe(false)
  })
})

// ── بند ۳: cyclic / self delegation rejected at creation ──────────────────────
describe('delegation cycle guard', () => {
  const del = (from: string, to: string): Delegation => ({ fromUserId: from, toUserId: to, startDate: '2026-01-01', endDate: '2026-12-31' })
  it('rejects self-delegation (A→A)', () => {
    expect(wouldCreateDelegationCycle('A', 'A', [])).toBe(true)
  })
  it('rejects a cycle (A→B while B→A is active)', () => {
    expect(wouldCreateDelegationCycle('A', 'B', [del('B', 'A')])).toBe(true)
  })
  it('allows a valid third-party delegation (A→B, no reverse)', () => {
    expect(wouldCreateDelegationCycle('A', 'B', [del('C', 'D')])).toBe(false)
  })
})

// ── بند ۲.۳: CRM lead → customer conversion decision ──────────────────────────
describe('lead conversion decision (dedup + idempotency)', () => {
  it('short-circuits an already-converted lead (idempotent double-click)', () => {
    expect(decideLeadConversion({ status: 'won', convertedCustomerId: 42 }, null)).toEqual({ action: 'already', customerId: 42 })
  })
  it('rejects a non-qualified lead', () => {
    expect(decideLeadConversion({ status: 'new', convertedCustomerId: null }, null)).toEqual({ action: 'reject', reason: expect.any(String) })
  })
  it('links to an existing customer when email/phone matches (dedup)', () => {
    expect(decideLeadConversion({ status: 'qualified', convertedCustomerId: null }, 7)).toEqual({ action: 'link', customerId: 7 })
  })
  it('creates a new customer when there is no match', () => {
    expect(decideLeadConversion({ status: 'proposal', convertedCustomerId: null }, null)).toEqual({ action: 'create' })
  })
})
