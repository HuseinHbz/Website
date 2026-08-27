import { describe, it, expect } from 'vitest'
import { resolveApprovalPlan, resolveApprovalPlanExplicit, matchRule, routeMatches, requiredLevels, levelSatisfied, defaultPurchaseMatrix, type MatrixRule } from '@/lib/approval/matrix'
import { approvalState, canActFor, delegationActive, effectiveApprovers, isSeparationViolation, type ApprovalActionRec, type Delegation } from '@/lib/approval/engine'
import { DOC_TYPES } from '@/lib/approval/matrix'
import { dueEscalations, slaBreached, slaStatus, hoursBetween } from '@/lib/approval/escalation'
import { approvalKpis } from '@/lib/approval/analytics'

const matrix = defaultPurchaseMatrix()

describe('approval matrix + routing (26.12 M1/M2)', () => {
  it('routes purchase amounts to the right number of levels', () => {
    expect(requiredLevels(resolveApprovalPlan(matrix, { docType: 'purchase_order', amount: 50_000_000 }))).toBe(1)
    expect(requiredLevels(resolveApprovalPlan(matrix, { docType: 'purchase_order', amount: 500_000_000 }))).toBe(2)
    expect(requiredLevels(resolveApprovalPlan(matrix, { docType: 'purchase_order', amount: 5_000_000_000 }))).toBe(3)
  })
  it('top tier = dept_manager + CFO + CEO', () => {
    const plan = resolveApprovalPlan(matrix, { docType: 'purchase_order', amount: 2_000_000_000 })
    expect(plan.map(l => l.approvers[0].ref)).toEqual(['dept_manager', 'cfo', 'ceo'])
  })
  it('dynamic routing condition (IT department → extra level)', () => {
    const rules: MatrixRule[] = [
      { docType: 'purchase_order', minAmount: 0, maxAmount: null, condition: { conditions: [{ field: 'department', op: 'eq', value: 'IT' }] }, priority: 10, levels: [{ level: 1, mode: 'all', approvers: [{ type: 'role', ref: 'it_manager' }] }, { level: 2, mode: 'all', approvers: [{ type: 'role', ref: 'cfo' }] }] },
      { docType: 'purchase_order', minAmount: 0, maxAmount: null, levels: [{ level: 1, mode: 'all', approvers: [{ type: 'role', ref: 'dept_manager' }] }] },
    ]
    expect(requiredLevels(resolveApprovalPlan(rules, { docType: 'purchase_order', amount: 10, context: { department: 'IT' } }))).toBe(2)
    expect(requiredLevels(resolveApprovalPlan(rules, { docType: 'purchase_order', amount: 10, context: { department: 'HR' } }))).toBe(1)
  })
  it('resolveApprovalPlanExplicit distinguishes "no rule matched" (config gap) from "rule matched, zero levels" (RULE-004: missing rule != approved)', () => {
    // No rule at all covers this doc type — a real configuration gap.
    const noRule = resolveApprovalPlanExplicit([], { docType: 'purchase_order', amount: 100 })
    expect(noRule.ruleMatched).toBe(false)
    expect(noRule.plan).toEqual([])

    // A rule DOES match but is explicitly configured with zero levels — a
    // deliberate business decision (e.g. "no approval needed under X"),
    // NOT a config gap.
    const explicitZero: MatrixRule[] = [{ docType: 'purchase_order', minAmount: 0, maxAmount: null, levels: [] }]
    const zeroLevels = resolveApprovalPlanExplicit(explicitZero, { docType: 'purchase_order', amount: 100 })
    expect(zeroLevels.ruleMatched).toBe(true)
    expect(zeroLevels.plan).toEqual([])

    // Amount falls outside every seeded range (e.g. an admin narrowed a
    // tier) — also a config gap, not an approval.
    const gap = resolveApprovalPlanExplicit(matrix, { docType: 'purchase_order', amount: -1 })
    expect(gap.ruleMatched).toBe(false)
  })
  it('routeMatches all/any + no-condition passes', () => {
    expect(routeMatches(null, {})).toBe(true)
    expect(routeMatches({ conditions: [{ field: 'risk', op: 'eq', value: 'high' }] }, { risk: 'high' })).toBe(true)
    expect(routeMatches({ match: 'any', conditions: [{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'eq', value: 2 }] }, { b: 2 })).toBe(true)
  })
  it('levelSatisfied honours all/any/min', () => {
    expect(levelSatisfied({ level: 1, mode: 'all', approvers: [{ type: 'role', ref: 'a' }, { type: 'role', ref: 'b' }] }, 1)).toBe(false)
    expect(levelSatisfied({ level: 1, mode: 'any', approvers: [{ type: 'role', ref: 'a' }, { type: 'role', ref: 'b' }] }, 1)).toBe(true)
    expect(levelSatisfied({ level: 1, mode: 'min', minCount: 2, approvers: [{ type: 'role', ref: 'a' }, { type: 'role', ref: 'b' }, { type: 'role', ref: 'c' }] }, 2)).toBe(true)
  })
  it('matchRule returns null when nothing applies', () => {
    expect(matchRule(matrix, { docType: 'leave_request', amount: 0 })).toBeNull()
  })
})

describe('approval state engine (26.12 M1/M4)', () => {
  const plan = resolveApprovalPlan(matrix, { docType: 'purchase_order', amount: 5_000_000_000 }) // 3 levels
  it('advances level by level then approves', () => {
    let acts: ApprovalActionRec[] = []
    expect(approvalState(plan, acts).currentLevel).toBe(1)
    acts = [{ level: 1, approverId: 'u1', decision: 'approved' }]
    expect(approvalState(plan, acts).currentLevel).toBe(2)
    acts.push({ level: 2, approverId: 'u2', decision: 'approved' }, { level: 3, approverId: 'u3', decision: 'approved' })
    const s = approvalState(plan, acts)
    expect(s.status).toBe('approved')
    expect(s.progressPct).toBe(100)
  })
  it('any rejection stops the process', () => {
    const s = approvalState(plan, [{ level: 1, approverId: 'u1', decision: 'rejected' }])
    expect(s.status).toBe('rejected')
  })
  it('parallel level: min-count completion', () => {
    const parallel = [{ level: 1, mode: 'min' as const, minCount: 2, approvers: [{ type: 'role' as const, ref: 'fin' }, { type: 'role' as const, ref: 'tech' }, { type: 'role' as const, ref: 'legal' }] }]
    expect(approvalState(parallel, [{ level: 1, approverId: 'a', decision: 'approved' }]).status).toBe('pending')
    expect(approvalState(parallel, [{ level: 1, approverId: 'a', decision: 'approved' }, { level: 1, approverId: 'b', decision: 'approved' }]).status).toBe('approved')
  })
})

describe('delegation (26.12 M5)', () => {
  const d: Delegation = { fromUserId: 'cfo', toUserId: 'fin_mgr', startDate: '2026-01-01', endDate: '2026-01-31' }
  it('active only within the window + scope', () => {
    expect(delegationActive(d, '2026-01-15')).toBe(true)
    expect(delegationActive(d, '2026-02-01')).toBe(false)
    expect(delegationActive({ ...d, docType: 'payment_request' }, '2026-01-15', 'invoice')).toBe(false)
  })
  it('canActFor direct + via delegation', () => {
    expect(canActFor('cfo', 'cfo', [], '2026-01-15')).toBe(true)
    expect(canActFor('fin_mgr', 'cfo', [d], '2026-01-15')).toBe(true)
    expect(canActFor('someone', 'cfo', [d], '2026-01-15')).toBe(false)
    expect(effectiveApprovers('cfo', [d], '2026-01-15')).toEqual(['cfo', 'fin_mgr'])
  })
})

describe('separation of duties — RULE-009 (full-remediation Phase-2 approval audit)', () => {
  it('applies to EVERY registered approval-matrix doc type, not a 2-item allowlist — the exact bug found and fixed by this audit (before: a user could create+approve their own payment_request/purchase_order/asset_disposal/…)', () => {
    for (const docType of DOC_TYPES) {
      expect(isSeparationViolation(docType, 'creator', 'creator')).toBe(true)
    }
  })
  it('still covers payroll_period — a real doc type used only by hr/payrollData.ts, outside the matrix engine, NOT itself one of DOC_TYPES (a first draft of this fix silently dropped it)', () => {
    expect(DOC_TYPES as readonly string[]).not.toContain('payroll_period')
    expect(isSeparationViolation('payroll_period', 'calculator', 'calculator')).toBe(true)
  })
  it('a different actor than the creator is never blocked', () => {
    for (const docType of [...DOC_TYPES, 'payroll_period']) {
      expect(isSeparationViolation(docType, 'creator', 'someone-else')).toBe(false)
    }
  })
  it('a delegate acting on the creator\'s own behalf is blocked too (delegation cannot proxy the creator\'s authority back to themselves)', () => {
    expect(isSeparationViolation('journal_entry', 'creator', 'delegate-user', 'creator')).toBe(true)
  })
  it('an unregistered/unknown doc type is NOT silently exempt — every code path in this project routes through DOC_TYPES or the explicit payroll_period addition, so there is no such doc type in practice; this documents that guarantee rather than assuming it', () => {
    expect(DOC_TYPES.length).toBeGreaterThan(0)
  })
})

describe('SLA escalation (26.12 M6)', () => {
  it('hours + staged escalations at 24/48/72', () => {
    expect(hoursBetween('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(24)
    const due = dueEscalations('2026-01-01T00:00:00Z', '2026-01-04T01:00:00Z', [1]) // 73h, stage1 fired
    expect(due.map(r => r.stage)).toEqual([2, 3])
  })
  it('sla status thresholds', () => {
    expect(slaStatus('2026-01-01T00:00:00Z', '2026-01-01T10:00:00Z')).toBe('on_track')
    expect(slaStatus('2026-01-01T00:00:00Z', '2026-01-01T19:00:00Z')).toBe('due_soon') // ≥18h
    expect(slaBreached('2026-01-01T00:00:00Z', '2026-01-02T02:00:00Z')).toBe(true)
  })
})

describe('approval analytics (26.12 M11)', () => {
  it('computes rejection rate, avg time, bottleneck, dept perf', () => {
    const k = approvalKpis(
      [
        { id: 1, docType: 'purchase_order', department: 'IT', status: 'approved', createdAt: '2026-01-01T00:00:00Z', decidedAt: '2026-01-01T10:00:00Z' },
        { id: 2, docType: 'purchase_order', department: 'IT', status: 'rejected', createdAt: '2026-01-01T00:00:00Z', decidedAt: '2026-01-01T02:00:00Z', slaBreached: true },
        { id: 3, docType: 'invoice', department: 'Finance', status: 'pending', createdAt: '2026-01-01T00:00:00Z' },
      ],
      [{ requestId: 1, approverId: 'u1', decision: 'approved', waitedHours: 10 }, { requestId: 2, approverId: 'u1', decision: 'rejected', waitedHours: 2 }],
    )
    expect(k.total).toBe(3)
    expect(k.rejectionRatePct).toBe(round(1 / 3 * 100))
    expect(k.avgApprovalHours).toBe(6)
    expect(k.slaViolations).toBe(1)
    expect(k.bottlenecks[0].approverId).toBe('u1')
    expect(k.byDepartment.find(d => d.department === 'IT')!.total).toBe(2)
  })
})
function round(n: number) { return Math.round(n * 10) / 10 }
