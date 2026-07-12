/**
 * Centralized business alert engine (Phase 26.13, M6) — pure, unit-tested.
 * Generalises the financial alerts (26.11) across financial / operational /
 * security domains with severity + channel routing + stable fingerprints. The
 * data layer feeds live signals; this file only classifies + routes + dedupes.
 */

export type AlertDomain = 'financial' | 'operational' | 'security'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertChannel = 'dashboard' | 'email' | 'notification' | 'webhook'

export interface AlertSignal {
  kind: string
  domain: AlertDomain
  severity: AlertSeverity
  titleEn: string
  titleFa: string
  detail?: string
  metricValue?: number
  refType?: string
  refId?: number
}

export interface BusinessAlert extends AlertSignal {
  fingerprint: string
  channels: AlertChannel[]
}

/** Severity → channel routing policy. */
export function channelsFor(severity: AlertSeverity): AlertChannel[] {
  if (severity === 'critical') return ['dashboard', 'email', 'notification', 'webhook']
  if (severity === 'warning') return ['dashboard', 'notification']
  return ['dashboard']
}

function fp(parts: (string | number | undefined)[]): string {
  return parts.filter(p => p != null).map(String).join('|').toLowerCase().replace(/\s+/g, '-')
}

/** Finalise signals into alerts: attach channels + a stable fingerprint, dedupe. */
export function buildAlerts(signals: AlertSignal[]): BusinessAlert[] {
  const seen = new Set<string>()
  const out: BusinessAlert[] = []
  for (const s of signals) {
    const fingerprint = fp([s.domain, s.kind, s.refType, s.refId])
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    out.push({ ...s, fingerprint, channels: channelsFor(s.severity) })
  }
  return out.sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
}
function sevRank(s: AlertSeverity): number { return s === 'critical' ? 2 : s === 'warning' ? 1 : 0 }

/** Summary counts by domain + severity for the alert center. */
export function alertSummary(alerts: BusinessAlert[]): { total: number; critical: number; warning: number; byDomain: Record<string, number> } {
  const byDomain: Record<string, number> = {}
  for (const a of alerts) byDomain[a.domain] = (byDomain[a.domain] ?? 0) + 1
  return { total: alerts.length, critical: alerts.filter(a => a.severity === 'critical').length, warning: alerts.filter(a => a.severity === 'warning').length, byDomain }
}
