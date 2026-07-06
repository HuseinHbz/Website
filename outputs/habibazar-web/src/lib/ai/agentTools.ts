/**
 * Agent tools (Phase 22 — AI Agents v2).
 *
 * Read-only "tools" that fetch a compact, live snapshot of a module (CRM / ERP /
 * Security / Backup / Infrastructure) so a data-backed agent grounds its answer
 * in real data instead of guessing. This is the "handler seam" idea from the
 * workflow engine applied to agents: the LLM never touches the DB — the server
 * gathers a bounded snapshot and injects it as read-only context.
 *
 * Each gatherer is defensive (returns '' on any error) and bounded in size, so a
 * tool failure never breaks an agent run — the agent simply answers without the
 * live block (and its guardrail tells it to ask for missing data).
 */
import { pgQuery } from '@/lib/db'
import { pipelineStats, type LeadStatus } from '@/lib/crm/leads'
import { assetStats, type AssetLike } from '@/lib/erp/assets'

/** Which agents have a live data tool (by agent id). */
export const AGENT_TOOLS: Record<string, string> = {
  crm: 'crm', erp: 'erp', security: 'security', backup: 'backup', infrastructure: 'infrastructure',
}

export function hasTool(agentId: string): boolean {
  return agentId in AGENT_TOOLS
}

async function crmSnapshot(): Promise<string> {
  try {
    const rows = (await pgQuery(`SELECT status, value, score FROM crm_leads`, [])) as { status: LeadStatus; value: number; score: number }[]
    if (rows.length === 0) return 'CRM: no leads recorded.'
    const s = pipelineStats(rows)
    const byStatus = Object.entries(s.byStatus).map(([k, v]) => `${k}=${v}`).join(', ')
    return `CRM leads snapshot: total=${s.total}; by stage: ${byStatus}; open pipeline value=$${s.openValue}; won value=$${s.wonValue}; win rate=${s.winRate}%; avg score=${s.avgScore}.`
  } catch { return '' }
}

async function erpSnapshot(): Promise<string> {
  try {
    const rows = (await pgQuery(`SELECT type, status, warranty_expiry AS "warrantyExpiry" FROM assets`, [])) as AssetLike[]
    if (rows.length === 0) return 'ERP: no assets recorded.'
    const s = assetStats(rows)
    return `ERP asset snapshot: total=${s.total}; active=${s.active}; in maintenance=${s.byStatus.maintenance}; retired=${s.byStatus.retired}; warranty expiring soon=${s.warrantyExpiring}; warranty expired=${s.warrantyExpired}.`
  } catch { return '' }
}

async function securitySnapshot(): Promise<string> {
  try {
    const rows = (await pgQuery(
      `SELECT level, message FROM system_logs
       WHERE source='security' AND ts >= to_char(now() - interval '24 hours','YYYY-MM-DD HH24:MI:SS')`, [],
    )) as { level: string; message: string }[]
    const total = rows.length
    const failed = rows.filter(r => /login|auth/i.test(r.message)).length
    const injections = rows.filter(r => /inject|jailbreak/i.test(r.message)).length
    const errors = rows.filter(r => r.level === 'error').length
    return `Security snapshot (24h): security events=${total}; auth/login-related=${failed}; prompt-injection blocks=${injections}; error-level=${errors}.`
  } catch { return '' }
}

async function backupSnapshot(): Promise<string> {
  try {
    const rows = (await pgQuery(`SELECT status, started_at AS "startedAt" FROM backups ORDER BY started_at DESC LIMIT 20`, [])) as { status: string; startedAt: string }[]
    if (rows.length === 0) return 'Backup: no backup runs recorded.'
    const ok = rows.filter(r => r.status === 'success').length
    const failed = rows.filter(r => r.status === 'failed').length
    return `Backup snapshot (last ${rows.length} runs): success=${ok}; failed=${failed}; most recent=${rows[0].status} at ${rows[0].startedAt}.`
  } catch { return '' }
}

async function infraSnapshot(): Promise<string> {
  try {
    const { opsSnapshot } = await import('@/lib/ops/snapshot')
    const s = await opsSnapshot()
    const m = s.metrics
    const upH = Math.round((s.infra.uptimeSec / 3600) * 10) / 10
    return `Infrastructure snapshot: CPU=${m.cpuLoadPct}%; memory=${m.memPct}% (${m.memUsedMb}/${m.memTotalMb} MB); disk=${m.diskUsedPct ?? '?'}%; requests/min=${m.requestsPerMin}; error rate=${m.errorRatePct}%; uptime=${upH}h.`
  } catch { return '' }
}

/** Gather the live context block for an agent, or '' if it has no tool / no data. */
export async function gatherAgentContext(agentId: string): Promise<string> {
  let block = ''
  switch (agentId) {
    case 'crm': block = await crmSnapshot(); break
    case 'erp': block = await erpSnapshot(); break
    case 'security': block = await securitySnapshot(); break
    case 'backup': block = await backupSnapshot(); break
    case 'infrastructure': block = await infraSnapshot(); break
    default: return ''
  }
  if (!block) return ''
  return `\n\n--- LIVE MODULE DATA (read-only, current) ---\n${block}\n--- END LIVE DATA ---\nUse the live data above when answering; if it is insufficient, say what else you need.`
}
