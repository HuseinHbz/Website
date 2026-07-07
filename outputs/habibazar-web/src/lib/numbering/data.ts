/**
 * Enterprise Numbering Engine — admin read/data layer (Phase 21.11).
 *
 * Reads for the admin console: format list, live counters, audit history (with
 * search), and the dashboard rollup. Generation itself lives in `service.ts`.
 */
import { pgQuery } from '@/lib/db'
import { previewDocumentNumber } from './service'

export interface FormatRecord {
  id: number; docType: string; nameEn: string; nameFa: string | null
  pattern: string; prefix: string; suffix: string; resetPolicy: string
  padding: number; increment: number; startNumber: number; minNumber: number
  maxNumber: number | null; alphabet: string; fiscalStartMonth: number; active: number
  createdAt: string; updatedAt: string
  nextNumber?: string | null
}

const FORMAT_COLS = `id, doc_type AS "docType", name_en AS "nameEn", name_fa AS "nameFa",
  pattern, prefix, suffix, reset_policy AS "resetPolicy", padding, increment,
  start_number AS "startNumber", min_number AS "minNumber",
  CASE WHEN max_number IS NULL THEN NULL ELSE max_number::int END AS "maxNumber",
  alphabet, fiscal_start_month AS "fiscalStartMonth", active,
  created_at AS "createdAt", updated_at AS "updatedAt"`

export async function listFormats(withPreview = false): Promise<FormatRecord[]> {
  const rows = await pgQuery<FormatRecord>(`SELECT ${FORMAT_COLS} FROM numbering_formats ORDER BY doc_type`)
  if (!withPreview) return rows
  return Promise.all(rows.map(async r => ({ ...r, nextNumber: await previewDocumentNumber(r.docType) })))
}

export interface CounterRecord {
  id: number; formatId: number; docType: string; scopeKey: string; periodKey: string
  currentValue: number; lastNumber: string | null; updatedAt: string
}
export async function listCounters(docType?: string): Promise<CounterRecord[]> {
  const params: unknown[] = []
  let where = ''
  if (docType) { params.push(docType); where = 'WHERE f.doc_type=$1' }
  return pgQuery<CounterRecord>(
    `SELECT c.id, c.format_id AS "formatId", f.doc_type AS "docType", c.scope_key AS "scopeKey",
            c.period_key AS "periodKey", c.current_value::int AS "currentValue",
            c.last_number AS "lastNumber", c.updated_at AS "updatedAt"
     FROM numbering_counters c JOIN numbering_formats f ON f.id=c.format_id
     ${where} ORDER BY c.updated_at DESC LIMIT 500`, params)
}

export interface AuditRecord {
  id: number; docType: string; number: string; scopeKey: string; periodKey: string
  counterValue: number | null; module: string | null; source: string; status: string
  userId: string | null; ip: string | null; createdAt: string
}
/** Audit history with optional free-text (number/doc_type/module) + filters. */
export async function listAudit(opts: { q?: string; docType?: string; status?: string; limit?: number } = {}): Promise<AuditRecord[]> {
  const conds: string[] = []
  const params: unknown[] = []
  if (opts.q) { params.push(`%${opts.q}%`); conds.push(`(number ILIKE $${params.length} OR doc_type ILIKE $${params.length} OR module ILIKE $${params.length})`) }
  if (opts.docType) { params.push(opts.docType); conds.push(`doc_type=$${params.length}`) }
  if (opts.status) { params.push(opts.status); conds.push(`status=$${params.length}`) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  params.push(Math.min(opts.limit ?? 100, 500))
  return pgQuery<AuditRecord>(
    `SELECT id, doc_type AS "docType", number, scope_key AS "scopeKey", period_key AS "periodKey",
            counter_value::int AS "counterValue", module, source, status, user_id AS "userId", ip,
            created_at AS "createdAt"
     FROM numbering_audit ${where} ORDER BY created_at DESC LIMIT $${params.length}`, params)
}

export interface NumberingDashboard {
  formats: number; activeFormats: number; counters: number
  generated: number; reserved: number; failed: number
  recent: AuditRecord[]
  lastByType: { docType: string; number: string; createdAt: string }[]
  byModule: { module: string; count: number }[]
}
export async function numberingDashboard(): Promise<NumberingDashboard> {
  const [f, statusCounts, counters, recent, lastByType, byModule] = await Promise.all([
    pgQuery<{ total: number; active: number }>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE active=1)::int active FROM numbering_formats`),
    pgQuery<{ status: string; n: number }>(`SELECT status, COUNT(*)::int n FROM numbering_audit GROUP BY status`),
    pgQuery<{ n: number }>(`SELECT COUNT(*)::int n FROM numbering_counters`),
    listAudit({ limit: 15 }),
    pgQuery<{ docType: string; number: string; createdAt: string }>(
      `SELECT DISTINCT ON (doc_type) doc_type AS "docType", number, created_at AS "createdAt"
       FROM numbering_audit WHERE status='generated' ORDER BY doc_type, created_at DESC`),
    pgQuery<{ module: string; count: number }>(
      `SELECT COALESCE(module,'—') AS module, COUNT(*)::int count FROM numbering_audit GROUP BY module ORDER BY count DESC LIMIT 10`),
  ])
  const s = Object.fromEntries(statusCounts.map(x => [x.status, x.n]))
  return {
    formats: f[0]?.total ?? 0, activeFormats: f[0]?.active ?? 0, counters: counters[0]?.n ?? 0,
    generated: s.generated ?? 0, reserved: s.reserved ?? 0, failed: s.failed ?? 0,
    recent, lastByType, byModule,
  }
}
