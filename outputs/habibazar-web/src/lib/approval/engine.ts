/**
 * Approval state engine (Phase 26.12, M1/M4/M5) — pure, unit-tested.
 *
 * Given a resolved plan (from `matrix.ts`) and the actions collected so far,
 * computes the overall status, the current level and who is still awaited —
 * honouring parallel completion rules (all / any / min) and the "any rejection
 * stops" rule, plus delegation resolution.
 */
import { levelSatisfied, type ApprovalLevelPlan, type Approver } from './matrix'

export type Decision = 'approved' | 'rejected' | 'changes_requested'
export interface ApprovalActionRec {
  level: number
  approverId: string     // the acting user
  decision: Decision
  onBehalfOf?: string | null   // set when acting via delegation
  at?: string
}
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'

export interface ApprovalState {
  status: ApprovalStatus
  currentLevel: number | null
  approvedLevels: number[]
  awaiting: Approver[]        // approvers of the current level not yet satisfied
  progressPct: number
}

/** Compute the live state of a request from its plan + actions. */
export function approvalState(plan: ApprovalLevelPlan[], actions: ApprovalActionRec[]): ApprovalState {
  if (actions.some(a => a.decision === 'rejected'))
    return { status: 'rejected', currentLevel: null, approvedLevels: [], awaiting: [], progressPct: 0 }
  const levels = [...plan].sort((a, b) => a.level - b.level)
  const approvedLevels: number[] = []
  for (const lvl of levels) {
    const approvedCount = new Set(actions.filter(a => a.level === lvl.level && a.decision === 'approved').map(a => a.approverId)).size
    if (levelSatisfied(lvl, approvedCount)) { approvedLevels.push(lvl.level); continue }
    // First unsatisfied level → this is the current level; its approvers are awaited.
    const changesReq = actions.some(a => a.level === lvl.level && a.decision === 'changes_requested')
    return {
      status: changesReq ? 'changes_requested' : 'pending',
      currentLevel: lvl.level, approvedLevels, awaiting: lvl.approvers,
      progressPct: levels.length ? Math.round(approvedLevels.length / levels.length * 100) : 0,
    }
  }
  return { status: 'approved', currentLevel: null, approvedLevels, awaiting: [], progressPct: 100 }
}

// ── Delegation (M5) ──────────────────────────────────────────────────────────
export interface Delegation {
  fromUserId: string
  toUserId: string
  startDate: string          // 'YYYY-MM-DD'
  endDate: string
  docType?: string | null    // optional scope
  department?: string | null // optional scope
}

/** Is a delegation active for this moment + optional doc/department scope? */
export function delegationActive(d: Delegation, on: string, docType?: string, department?: string): boolean {
  if (on < d.startDate || on > d.endDate) return false
  if (d.docType && docType && d.docType !== docType) return false
  if (d.department && department && d.department !== department) return false
  return true
}

/** Can `actor` act on behalf of the required approver `principal`? Direct or via an active delegation. */
export function canActFor(actor: string, principal: string, delegations: Delegation[], on: string, docType?: string, department?: string): boolean {
  if (actor === principal) return true
  return delegations.some(d => d.toUserId === actor && d.fromUserId === principal && delegationActive(d, on, docType, department))
}

/** All users who may currently act for a principal (principal + active delegates). */
export function effectiveApprovers(principal: string, delegations: Delegation[], on: string, docType?: string, department?: string): string[] {
  const out = new Set<string>([principal])
  for (const d of delegations) if (d.fromUserId === principal && delegationActive(d, on, docType, department)) out.add(d.toUserId)
  return [...out]
}

/**
 * Separation-of-duties guard (26.24b بند ۳). A journal-entry posting request may
 * never be decided by its own creator — whether the creator acts directly OR a
 * delegate acts on the creator's behalf (the effective decision owner is the
 * creator either way). `onBehalfOf` is the principal a delegate is representing.
 */
export function isSeparationViolation(docType: string, createdBy: string, actorId: string, onBehalfOf?: string | null): boolean {
  if (docType !== 'journal_entry') return false
  return createdBy === actorId || createdBy === onBehalfOf
}

/**
 * Would creating a from→to delegation form a self-loop or a cycle? (26.24b بند ۳)
 * A user cannot delegate to themselves, and an active reverse delegation (to→from)
 * must not already exist — otherwise a principal's authority could round-trip back.
 */
export function wouldCreateDelegationCycle(fromUserId: string, toUserId: string, existing: Delegation[]): boolean {
  if (fromUserId === toUserId) return true
  return existing.some(d => d.fromUserId === toUserId && d.toUserId === fromUserId)
}
