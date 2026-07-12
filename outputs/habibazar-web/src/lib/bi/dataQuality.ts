/**
 * Data governance / quality engine (Phase 26.13, M9) — pure, unit-tested.
 * Turns raw quality-check counts (from the data layer's COUNT queries) into a
 * 0..100 quality score, a graded issue list and fix suggestions.
 */

export type QualitySeverity = 'low' | 'medium' | 'high'
export interface QualityCheck {
  key: string
  labelEn: string
  labelFa: string
  affected: number       // rows failing the check
  total: number          // rows examined
  severity: QualitySeverity
  suggestionEn: string
  suggestionFa: string
}

export interface QualityIssue extends QualityCheck { failRatePct: number }
export interface QualityReport { score: number; grade: 'A' | 'B' | 'C' | 'D'; issues: QualityIssue[]; totalAffected: number }

const WEIGHT: Record<QualitySeverity, number> = { low: 1, medium: 2, high: 3 }

/** Overall quality score (100 = perfect), weighted by severity, + graded issues. */
export function qualityReport(checks: QualityCheck[]): QualityReport {
  const issues: QualityIssue[] = checks.map(c => ({ ...c, failRatePct: c.total > 0 ? Math.round(c.affected / c.total * 1000) / 10 : 0 }))
  const totalWeight = checks.reduce((s, c) => s + WEIGHT[c.severity], 0)
  // Penalty = weighted average fail rate.
  const penalty = totalWeight > 0
    ? issues.reduce((s, c) => s + c.failRatePct * WEIGHT[c.severity], 0) / totalWeight
    : 0
  const score = Math.round(Math.max(0, 100 - penalty) * 10) / 10
  const grade: QualityReport['grade'] = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D'
  return {
    score, grade,
    issues: issues.filter(i => i.affected > 0).sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity] || b.failRatePct - a.failRatePct),
    totalAffected: checks.reduce((s, c) => s + c.affected, 0),
  }
}
