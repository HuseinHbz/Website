/**
 * Approval analytics (Phase 26.12, M11) — pure, unit-tested.
 *
 * Derives workflow KPIs (average approval time, rejection rate, bottleneck
 * approvers, SLA violations, per-department performance) from request/action
 * records the data layer already loads. No I/O.
 */

export interface RequestFact {
  id: number
  docType: string
  department?: string | null
  status: string            // pending/approved/rejected/changes_requested
  createdAt: string
  decidedAt?: string | null
  slaBreached?: boolean
}
export interface ActionFact { requestId: number; approverId: string; decision: string; waitedHours?: number }

function round1(n: number): number { return Math.round(n * 10) / 10 }

export interface ApprovalKpis {
  total: number
  pending: number
  approved: number
  rejected: number
  rejectionRatePct: number
  avgApprovalHours: number
  slaViolations: number
  bottlenecks: { approverId: string; count: number; avgWaitHours: number }[]
  byDepartment: { department: string; total: number; approved: number; rejected: number; avgHours: number }[]
}

export function approvalKpis(requests: RequestFact[], actions: ActionFact[]): ApprovalKpis {
  const total = requests.length
  const pending = requests.filter(r => r.status === 'pending' || r.status === 'changes_requested').length
  const approved = requests.filter(r => r.status === 'approved').length
  const rejected = requests.filter(r => r.status === 'rejected').length
  const decided = requests.filter(r => r.decidedAt)
  const avgApprovalHours = decided.length
    ? round1(decided.reduce((s, r) => s + hours(r.createdAt, r.decidedAt!), 0) / decided.length)
    : 0

  // Bottlenecks: approvers by pending-action count + average wait.
  const byApprover = new Map<string, { count: number; wait: number }>()
  for (const a of actions) {
    const cur = byApprover.get(a.approverId) ?? { count: 0, wait: 0 }
    cur.count++; cur.wait += a.waitedHours ?? 0
    byApprover.set(a.approverId, cur)
  }
  const bottlenecks = [...byApprover.entries()]
    .map(([approverId, v]) => ({ approverId, count: v.count, avgWaitHours: round1(v.wait / (v.count || 1)) }))
    .sort((a, b) => b.avgWaitHours - a.avgWaitHours || b.count - a.count)
    .slice(0, 10)

  // Per-department performance.
  const byDept = new Map<string, { total: number; approved: number; rejected: number; hours: number; decided: number }>()
  for (const r of requests) {
    const key = r.department ?? '—'
    const cur = byDept.get(key) ?? { total: 0, approved: 0, rejected: 0, hours: 0, decided: 0 }
    cur.total++
    if (r.status === 'approved') cur.approved++
    if (r.status === 'rejected') cur.rejected++
    if (r.decidedAt) { cur.hours += hours(r.createdAt, r.decidedAt); cur.decided++ }
    byDept.set(key, cur)
  }
  const byDepartment = [...byDept.entries()].map(([department, v]) => ({
    department, total: v.total, approved: v.approved, rejected: v.rejected,
    avgHours: v.decided ? round1(v.hours / v.decided) : 0,
  })).sort((a, b) => b.total - a.total)

  return {
    total, pending, approved, rejected,
    rejectionRatePct: total ? round1(rejected / total * 100) : 0,
    avgApprovalHours,
    slaViolations: requests.filter(r => r.slaBreached).length,
    bottlenecks, byDepartment,
  }
}

function hours(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso), b = Date.parse(toIso)
  return isNaN(a) || isNaN(b) ? 0 : Math.max(0, (b - a) / 3_600_000)
}
