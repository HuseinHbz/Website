import { NextResponse } from 'next/server'
import type Database from 'better-sqlite3'
import { apiError, requireAdmin } from '@/lib/api/respond'
import { getDb } from '@/lib/db'
import { riskLevel, riskScore, type SecuritySignals } from '@/lib/soc/risk'

// SOC (Security Operations Center) overview — aggregates the REAL security signal
// already captured by the platform (logger.security → system_logs, audit LOGIN
// events, AI-guard blocks) into a threat posture. Read-only; does not duplicate
// the Security & 2FA settings page or the raw Logs & Monitoring stream.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function client(): Database.Database {
  return (getDb() as unknown as { $client: Database.Database }).$client
}
function count(db: Database.Database, sql: string, ...params: unknown[]): number {
  try { return (db.prepare(sql).get(...params) as { c: number }).c } catch { return 0 }
}

export async function GET() {
  try {
    const auth = await requireAdmin('manage_settings')
    if ('error' in auth) return auth.error
    const db = client()
    const since = new Date(Date.now() - 86_400_000).toISOString()

    const failedLogins = count(db, `SELECT count(*) c FROM system_logs WHERE ts>=? AND message LIKE '%Failed login%'`, since)
    const injectionBlocks = count(db, `SELECT count(*) c FROM system_logs WHERE ts>=? AND message LIKE '%prompt-injection%'`, since)
    const permissionDenied = count(db, `SELECT count(*) c FROM system_logs WHERE ts>=? AND (message LIKE '%Forbidden%' OR message LIKE '%permission%')`, since)
    const rateLimited = count(db, `SELECT count(*) c FROM system_logs WHERE ts>=? AND (message LIKE '%Too many%' OR message LIKE '%rate limit%')`, since)
    const securityErrors = count(db, `SELECT count(*) c FROM system_logs WHERE ts>=? AND source='security' AND level='error'`, since)
    const successfulLogins = count(db, `SELECT count(*) c FROM audit_logs WHERE action='LOGIN' AND created_at>=?`, since)

    // Offending IPs from failed-login meta; ≥5 in 24h = brute-force suspect.
    let topIps: { ip: string; attempts: number }[] = []
    try {
      topIps = db.prepare(
        `SELECT json_extract(meta,'$.ip') ip, count(*) attempts FROM system_logs
         WHERE ts>=? AND message LIKE '%Failed login%' AND json_extract(meta,'$.ip') IS NOT NULL
         GROUP BY ip ORDER BY attempts DESC LIMIT 10`
      ).all(since) as { ip: string; attempts: number }[]
    } catch { topIps = [] }
    const bruteForceIps = topIps.filter((r) => r.attempts >= 5).length

    const signals: SecuritySignals = { failedLogins, bruteForceIps, injectionBlocks, permissionDenied, rateLimited, securityErrors }
    const level = riskLevel(signals)

    // Recent security threat timeline.
    let timeline: { ts: string; level: string; source: string; message: string }[] = []
    try {
      timeline = db.prepare(
        `SELECT ts, level, source, message FROM system_logs
         WHERE source IN ('security','ai') OR level='error' OR message LIKE '%[SECURITY]%'
         ORDER BY id DESC LIMIT 20`
      ).all() as typeof timeline
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
