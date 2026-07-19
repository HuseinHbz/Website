/**
 * Enterprise Numbering Engine — generation service (Phase 21.11).
 *
 * The ONLY place a document number is minted. Concurrency safety comes from a
 * transactional `INSERT … ON CONFLICT (format_id, scope_key, period_key) DO
 * UPDATE … RETURNING current_value` — the counter row's unique index serialises
 * concurrent increments — guarded additionally by a per-scope `pg_advisory_xact_lock`.
 * Result: zero duplicate numbers even under hundreds of simultaneous callers.
 * Every module MUST call `generateDocumentNumber` — never number on its own.
 */
import { randomBytes, randomUUID } from 'crypto'
import { getPool, pgQuery } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  renderNumber, periodKey, formatRegex, parsePlaceholders, type NumberFormat, type NumberContext,
} from './format'

/** Crypto-random base36 token of a given length (for the {RANDOM} placeholder). */
function randomToken(len: number): string {
  if (len <= 0) return ''
  let out = ''
  while (out.length < len) out += randomBytes(8).readUInt32BE(0).toString(36)
  return out.slice(0, len).toUpperCase()
}

/** Auto-fill {RANDOM}/{UUID} in the context when the pattern uses them. */
function withGenerated(fmt: NumberFormat, ctx: NumberContext): NumberContext {
  const used = parsePlaceholders(fmt.pattern)
  const out: NumberContext = { ...ctx }
  if (used.includes('RANDOM') && out.random == null) out.random = randomToken(fmt.randomLength ?? 4)
  if (used.includes('UUID') && out.uuid == null) out.uuid = randomUUID()
  return out
}

export interface GenerateScope { company?: string; branch?: string; warehouse?: string; department?: string }
export interface GenerateOptions {
  docType: string
  scope?: GenerateScope
  context?: NumberContext
  module?: string
  source?: string
  userId?: string | null
  ip?: string | null
  date?: Date
}
export interface GeneratedNumber {
  number: string; counter: number; formatId: number; docType: string
  scopeKey: string; periodKey: string
}

interface FormatRow {
  id: number; doc_type: string; pattern: string; prefix: string; suffix: string
  reset_policy: NumberFormat['resetPolicy']; padding: number; increment: number
  start_number: number; min_number: number; max_number: string | number | null
  alphabet: NumberFormat['alphabet']; fiscal_start_month: number; random_length: number | null; active: number
}

function toFormat(r: FormatRow): NumberFormat {
  return {
    docType: r.doc_type, pattern: r.pattern, prefix: r.prefix, suffix: r.suffix,
    resetPolicy: r.reset_policy, padding: r.padding, increment: r.increment,
    startNumber: r.start_number, minNumber: r.min_number,
    maxNumber: r.max_number == null ? null : Number(r.max_number),
    alphabet: r.alphabet, fiscalStartMonth: r.fiscal_start_month, randomLength: r.random_length ?? 4,
  }
}

/** Compose a stable scope key (multi-company/branch/warehouse independence). */
export function scopeKeyOf(scope?: GenerateScope): string {
  if (!scope) return ''
  const parts = [scope.company, scope.branch, scope.warehouse, scope.department].map(x => (x ?? '').trim())
  return parts.some(Boolean) ? parts.join('|') : ''
}

async function loadFormat(docType: string): Promise<FormatRow | null> {
  const rows = await pgQuery<FormatRow>('SELECT * FROM numbering_formats WHERE doc_type=$1', [docType])
  return rows[0] ?? null
}

/**
 * Atomically mint the next number for a document type. Concurrency-safe.
 * Throws on unknown/inactive format or counter overflow (both audited as failed).
 */
export async function generateDocumentNumber(opts: GenerateOptions): Promise<GeneratedNumber> {
  const { docType, scope, context, module, source = 'api', userId = null, ip = null } = opts
  const date = opts.date ?? new Date()
  const skey = scopeKeyOf(scope)
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const fr = (await client.query<FormatRow>('SELECT * FROM numbering_formats WHERE doc_type=$1', [docType])).rows[0]
    if (!fr || !fr.active) throw new Error(`No active numbering format for "${docType}"`)
    const fmt = toFormat(fr)
    const pkey = periodKey(fmt.resetPolicy, date, fmt.fiscalStartMonth)

    // Serialise this (format, scope, period) bucket across sessions.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${fr.id}:${skey}:${pkey}`])

    // First number in a bucket = start_number; subsequent = current + increment.
    const up = await client.query<{ current_value: string }>(
      `INSERT INTO numbering_counters (format_id, scope_key, period_key, current_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (format_id, scope_key, period_key)
       DO UPDATE SET current_value = numbering_counters.current_value + $5,
                     updated_at = to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
       RETURNING current_value`,
      [fr.id, skey, pkey, fmt.startNumber, fmt.increment],
    )
    const counter = Number(up.rows[0].current_value)
    if (fmt.maxNumber != null && counter > fmt.maxNumber) {
      throw new Error(`Counter overflow for "${docType}" (${counter} > ${fmt.maxNumber})`)
    }
    const number = renderNumber(fmt, counter, date, withGenerated(fmt, context ?? {}))

    await client.query(
      `UPDATE numbering_counters SET last_number=$1 WHERE format_id=$2 AND scope_key=$3 AND period_key=$4`,
      [number, fr.id, skey, pkey],
    )
    await client.query(
      `INSERT INTO numbering_audit (format_id, doc_type, number, scope_key, period_key, counter_value, module, source, status, user_id, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [fr.id, docType, number, skey, pkey, counter, module ?? null, source, 'generated', userId, ip],
    )
    await client.query('COMMIT')
    return { number, counter, formatId: fr.id, docType, scopeKey: skey, periodKey: pkey }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    // Best-effort failure audit (outside the rolled-back txn).
    await pgQuery(
      `INSERT INTO numbering_audit (doc_type, number, scope_key, module, source, status, user_id, ip)
       VALUES ($1,$2,$3,$4,$5,'failed',$6,$7)`,
      [docType, '', skey, module ?? null, source, userId, ip],
    ).catch(() => {})
    logger.error('numbering.generate.failed', { docType, error: e instanceof Error ? e : String(e) })
    throw e
  } finally {
    client.release()
  }
}

/** Reserve a number (consumes a counter value; audited as `reserved`). */
export async function reserveNumber(opts: GenerateOptions): Promise<GeneratedNumber> {
  const g = await generateDocumentNumber({ ...opts, source: opts.source ?? 'reserve' })
  await pgQuery(`UPDATE numbering_audit SET status='reserved' WHERE number=$1 AND doc_type=$2`, [g.number, g.docType])
  return g
}

/** Release a previously reserved number (marks the audit row `released`). */
export async function releaseReservedNumber(docType: string, number: string): Promise<boolean> {
  const rows = await pgQuery(
    `UPDATE numbering_audit SET status='released' WHERE number=$1 AND doc_type=$2 AND status='reserved' RETURNING id`,
    [number, docType],
  )
  return rows.length > 0
}

/** Preview the NEXT number without consuming it. */
export async function previewDocumentNumber(docType: string, opts: { scope?: GenerateScope; context?: NumberContext; date?: Date } = {}): Promise<string | null> {
  const fr = await loadFormat(docType)
  if (!fr || !fr.active) return null
  const fmt = toFormat(fr)
  const date = opts.date ?? new Date()
  const pkey = periodKey(fmt.resetPolicy, date, fmt.fiscalStartMonth)
  const skey = scopeKeyOf(opts.scope)
  const cur = await pgQuery<{ current_value: string }>(
    `SELECT current_value FROM numbering_counters WHERE format_id=$1 AND scope_key=$2 AND period_key=$3`,
    [fr.id, skey, pkey],
  )
  const next = cur.length ? Number(cur[0].current_value) + fmt.increment : fmt.startNumber
  return renderNumber(fmt, next, date, withGenerated(fmt, opts.context ?? {}))
}

/** Alias — the next number that WOULD be generated. */
export const getNextNumber = previewDocumentNumber

export interface NumberValidation { valid: boolean; matchesFormat: boolean; duplicate: boolean; reason?: string }

/** Validate a number against its format shape + uniqueness (no mutation). */
export async function validateDocumentNumber(docType: string, number: string): Promise<NumberValidation> {
  const fr = await loadFormat(docType)
  if (!fr) return { valid: false, matchesFormat: false, duplicate: false, reason: 'unknown document type' }
  const matchesFormat = formatRegex(toFormat(fr)).test(number)
  const dup = await pgQuery(
    `SELECT 1 FROM numbering_audit WHERE doc_type=$1 AND number=$2 AND status IN ('generated','reserved') LIMIT 1`,
    [docType, number],
  )
  const duplicate = dup.length > 0
  return { valid: matchesFormat && !duplicate, matchesFormat, duplicate, reason: !matchesFormat ? 'does not match format' : duplicate ? 'duplicate number' : undefined }
}

/** Reset (restart) a counter bucket. Omitting scope/period resets all buckets of the type. */
export async function resetCounter(docType: string, scopeKey?: string, periodKey?: string): Promise<number> {
  const fr = await loadFormat(docType)
  if (!fr) return 0
  const conds = ['format_id=$1']
  const params: unknown[] = [fr.id]
  if (scopeKey != null) { params.push(scopeKey); conds.push(`scope_key=$${params.length}`) }
  if (periodKey != null) { params.push(periodKey); conds.push(`period_key=$${params.length}`) }
  const rows = await pgQuery(`DELETE FROM numbering_counters WHERE ${conds.join(' AND ')} RETURNING id`, params)
  return rows.length
}
