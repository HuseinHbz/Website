import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { pgQuery } from '@/lib/db'
import { riskLevel, riskScore, type SecuritySignals } from '@/lib/soc/risk'

// SOC (Security Operations Center) overview — aggregates the REAL security signal
// already captured by the platform (logger.security → system_logs, audit LOGIN
// events, AI-guard blocks) into a threat posture. Read-only; does not duplicate
// the Security & 2FA settings page or the raw Logs & Monitoring stream.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function count(sql: string, params: unknown[] = []): Promise<number> {
  try { return Number(((await pgQuery(sql, params))[0] as { c: number } | undefined)?.c ?? 0) } catch { return 0 }
}

export async function GET() {
  try {
    const auth = await requirePermission('security.soc', 'read', 'manage_settings')
    if ('error' in auth) return auth.error
    const since = new Date(Date.now() - 86_400_000).toISOString()

    const failedLogins = await count(`SELECT count(*) c FROM system_logs WHERE ts>=$1 AND message ILIKE '%Failed login%'`, [since])
    const injectionBlocks = await count(`SELECT count(*) c FROM system_logs WHERE ts>=$1 AND message ILIKE '%prompt-injection%'`, [since])
    const permissionDenied = await count(`SELECT count(*) c FROM system_logs WHERE ts>=$1 AND (message ILIKE '%Forbidden%' OR message ILIKE '%permission%')`, [since])
    const rateLimited = await count(`SELECT count(*) c FROM system_logs WHERE ts>=$1 AND (message ILIKE '%Too many%' OR message ILIKE '%rate limit%')`, [since])
    const securityErrors = await count(`SELECT count(*) c FROM system_logs WHERE ts>=$1 AND source='security' AND level='error'`, [since])
    const successfulLogins = await count(`SELECT count(*) c FROM audit_logs WHERE action='LOGIN' AND created_at>=$1`, [since])

    // Offending IPs from failed-login meta; ≥5 in 24h = brute-force suspect.
    let topIps: { ip: string; attempts: number }[] = []
    try {
      topIps = await pgQuery(
        `SELECT (meta::jsonb->>'ip') ip, count(*)::int attempts FROM system_logs
         WHERE ts>=$1 AND message ILIKE '%Failed login%' AND (meta::jsonb->>'ip') IS NOT NULL
         GROUP BY ip ORDER BY attempts DESC LIMIT 10`,
        [since],
      ) as { ip: string; attempts: number }[]
    } catch { topIps = [] }
    const bruteForceIps = topIps.filter((r) => r.attempts >= 5).length

    const signals: SecuritySignals = { failedLogins, bruteForceIps, injectionBlocks, permissionDenied, rateLimited, securityErrors }
    const level = riskLevel(signals)

    // Recent security threat timeline.
    let timeline: { ts: string; level: string; source: string; message: string }[] = []
    try {
      timeline = await pgQuery(
        `SELECT ts, level, source, message FROM system_logs
         WHERE source IN ('security','ai') OR level='error' OR message ILIKE '%[SECURITY]%'
         ORDER BY id DESC LIMIT 20`
      ) as typeof timeline
    } catch { timeline = [] }

    return NextResponse.json({
      windowHours: 24,
      risk: { level, score: riskScore(signals) },
      signals: { ...signals, successfulLogins },
      topIps,
      timeline,
      generatedAt: new Date().toISOString(),
    })
  } catch (e: unknown) {
    return apiError(e)
  }
}
