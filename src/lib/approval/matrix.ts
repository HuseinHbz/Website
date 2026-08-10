/**
 * Approval Matrix + dynamic routing (Phase 26.12, M1/M2/M7) — pure, unit-tested.
 *
 * Generalises the purchasing tier logic (`erp/purchasing.ts`) to EVERY document
 * type: a matrix maps (docType, amount, context) → an ordered list of approval
 * levels, each level a set of approvers (parallel within a level) + a completion
 * rule. Dynamic routing conditions reuse the Business Rules engine
 * (`ruleMatches`) — no second condition evaluator.
 */
import { evalCondition, type Condition } from '@/lib/rules/engine'

/** Dynamic routing condition (reuses the Business Rules `Condition` model). */
export interface RouteCondition { match?: 'all' | 'any'; conditions: Condition[] }

/** True when the routing condition passes for the facts (reuses `evalCondition`). */
export function routeMatches(cond: RouteCondition | null | undefined, facts: Record<string, unknown>): boolean {
  if (!cond || !cond.conditions?.length) return true
  return cond.match === 'any'
    ? cond.conditions.some(c => evalCondition(c, facts))
    : cond.conditions.every(c => evalCondition(c, facts))
}

export const DOC_TYPES = [
  'purchase_request', 'purchase_order', 'invoice', 'payment_request', 'journal_entry', 'expense_claim',
  'discount_approval', 'large_contract', 'credit_override',
  'leave_request', 'recruitment_request', 'hr_portal_request',
  'asset_purchase', 'asset_disposal',
  'budget_change', 'project_expense',
] as const
export type ApprovalDocType = (typeof DOC_TYPES)[number]

export const APPROVER_TYPES = ['role', 'user', 'department', 'cost_center', 'project'] as const
export type ApproverType = (typeof APPROVER_TYPES)[number]

export interface Approver { type: ApproverType; ref: string; label?: string }
export type LevelMode = 'all' | 'any' | 'min'
export interface ApprovalLevelPlan {
  level: number
  mode: LevelMode            // all = every approver, any = one, min = minCount
  minCount?: number
  approvers: Approver[]
}

/** One matrix rule: applies to a docType within an amount range + optional condition. */
export interface MatrixRule {
  id?: number
  docType: ApprovalDocType
  minAmount: number
  maxAmount: number | null   // null = no upper bound
  condition?: RouteCondition | null   // dynamic routing (rules engine); optional
  levels: ApprovalLevelPlan[]
  priority?: number
}

export interface ResolveInput {
  docType: ApprovalDocType
  amount: number
  context?: Record<string, unknown>   // department, cost_center, vendorRisk, discountPct, …
}

/** Pick the matching rule: docType + amount in range + condition passes; highest priority wins. */
export function matchRule(rules: MatrixRule[], input: ResolveInput): MatrixRule | null {
  const cands = rules
    .filter(r => r.docType === input.docType)
    .filter(r => input.amount >= r.minAmount && (r.maxAmount === null || input.amount <= r.maxAmount))
    .filter(r => routeMatches(r.condition, { amount: input.amount, ...(input.context ?? {}) }))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (b.minAmount - a.minAmount))
  return cands[0] ?? null
}

/** Resolve the ordered approval levels for a document, or [] when nothing matches. */
export function resolveApprovalPlan(rules: MatrixRule[], input: ResolveInput): ApprovalLevelPlan[] {
  const rule = matchRule(rules, input)
  if (!rule) return []
  return [...rule.levels].sort((a, b) => a.level - b.level)
}

/** Total distinct levels a plan requires. */
export function requiredLevels(plan: ApprovalLevelPlan[]): number {
  return new Set(plan.map(l => l.level)).size
}

/** Is a level satisfied by the approvals collected for it? */
export function levelSatisfied(level: ApprovalLevelPlan, approvedCount: number): boolean {
  if (level.mode === 'any') return approvedCount >= 1
  if (level.mode === 'min') return approvedCount >= (level.minCount ?? 1)
  return approvedCount >= level.approvers.length   // 'all'
}

/**
 * Default enterprise matrix (Toman thresholds from the spec). Amounts are in the
 * document currency's base unit; callers pass Toman for the seeded rules.
 */
export function defaultPurchaseMatrix(): MatrixRule[] {
  const L = (level: number, ...roles: string[]): ApprovalLevelPlan => ({ level, mode: 'all', approvers: roles.map(r => ({ type: 'role' as const, ref: r })) })
  return [
    { docType: 'purchase_order', minAmount: 0, maxAmount: 100_000_000, levels: [L(1, 'dept_manager')] },
    { docType: 'purchase_order', minAmount: 100_000_001, maxAmount: 1_000_000_000, levels: [L(1, 'dept_manager'), L(2, 'finance_manager')] },
    { docType: 'purchase_order', minAmount: 1_000_000_001, maxAmount: null, levels: [L(1, 'dept_manager'), L(2, 'cfo'), L(3, 'ceo')] },
  ]
}
