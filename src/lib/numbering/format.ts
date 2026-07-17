/**
 * Enterprise Numbering Engine — pure format core (Phase 21.11).
 *
 * Everything here is deterministic and I/O-free → fully unit-tested. The
 * concurrency-safe counter increment lives in `service.ts`; this module turns a
 * counter value + context into a rendered document number, computes the reset
 * period bucket, pads counters, validates a format, and builds a match regex.
 * Placeholders: {PREFIX} {SUFFIX} {YEAR} {MONTH} {DAY} {COMPANY} {BRANCH}
 * {WAREHOUSE} {DEPARTMENT} {DOCUMENT_TYPE} {PROJECT} {COUNTER} {RANDOM}
 * {CUSTOM_FIELD}.
 */

export type ResetPolicy = 'never' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'fiscal'
export type Alphabet = 'numeric' | 'hex'

export interface NumberFormat {
  docType: string
  pattern: string
  prefix?: string
  suffix?: string
  resetPolicy: ResetPolicy
  padding: number
  increment: number
  startNumber: number
  minNumber: number
  maxNumber?: number | null
  alphabet: Alphabet
  fiscalStartMonth?: number
  randomLength?: number
}

export interface NumberContext {
  company?: string
  branch?: string
  warehouse?: string
  department?: string
  project?: string
  customField?: string
  random?: string
  uuid?: string
}

export const PLACEHOLDERS = [
  'PREFIX', 'SUFFIX', 'YEAR', 'MONTH', 'DAY', 'COMPANY', 'BRANCH', 'WAREHOUSE',
  'DEPARTMENT', 'DOCUMENT_TYPE', 'PROJECT', 'COUNTER', 'RANDOM', 'UUID', 'CUSTOM_FIELD',
] as const
export type Placeholder = (typeof PLACEHOLDERS)[number]

const pad2 = (n: number) => String(n).padStart(2, '0')

/** ISO week number (1..53) for weekly reset buckets. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * The period bucket a number belongs to under a reset policy. Two dates share a
 * counter iff they map to the same key; a new key ⇒ the counter restarts.
 */
export function periodKey(policy: ResetPolicy, date: Date, fiscalStartMonth = 1): string {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  switch (policy) {
    case 'never': return ''
    case 'daily': return `${y}-${pad2(m)}-${pad2(date.getUTCDate())}`
    case 'weekly': return `${y}-W${pad2(isoWeek(date))}`
    case 'monthly': return `${y}-${pad2(m)}`
    case 'quarterly': return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
    case 'yearly': return `${y}`
    case 'fiscal': {
      // Fiscal year labelled by the calendar year it starts in.
      const fy = m >= fiscalStartMonth ? y : y - 1
      return `FY${fy}`
    }
  }
}

/** Extract the placeholder tokens used in a pattern, in order of appearance. */
export function parsePlaceholders(pattern: string): string[] {
  return [...pattern.matchAll(/\{([A-Z_]+)\}/g)].map(m => m[1])
}

/** Pad/format a counter value per padding + alphabet. */
export function padCounter(value: number, padding: number, alphabet: Alphabet = 'numeric'): string {
  const s = alphabet === 'hex' ? value.toString(16).toUpperCase() : String(value)
  return s.padStart(Math.max(0, padding), '0')
}

export interface RenderResult { number: string }

/** Render a full document number for a given counter value + date + context. */
export function renderNumber(fmt: NumberFormat, counter: number, date: Date, ctx: NumberContext = {}): string {
  const y = date.getUTCFullYear()
  const values: Record<Placeholder, string> = {
    PREFIX: fmt.prefix ?? '',
    SUFFIX: fmt.suffix ?? '',
    YEAR: String(y),
    MONTH: pad2(date.getUTCMonth() + 1),
    DAY: pad2(date.getUTCDate()),
    COMPANY: ctx.company ?? '',
    BRANCH: ctx.branch ?? '',
    WAREHOUSE: ctx.warehouse ?? '',
    DEPARTMENT: ctx.department ?? '',
    DOCUMENT_TYPE: fmt.docType.toUpperCase(),
    PROJECT: ctx.project ?? '',
    COUNTER: padCounter(counter, fmt.padding, fmt.alphabet),
    RANDOM: ctx.random ?? '',
    UUID: ctx.uuid ?? '',
    CUSTOM_FIELD: ctx.customField ?? '',
  }
  const raw = fmt.pattern.replace(/\{([A-Z_]+)\}/g, (m, key: string) =>
    key in values ? values[key as Placeholder] : m)
  // Collapse separators left empty by absent placeholders (e.g. "--" or a
  // dangling leading/trailing dash) so numbers stay clean when scope is unused.
  return raw.replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
}

export interface FormatValidation { ok: boolean; errors: string[] }

/** Validate a format definition before it is persisted or used. */
export function validateFormat(fmt: Partial<NumberFormat>): FormatValidation {
  const errors: string[] = []
  if (!fmt.docType || !/^[a-z0-9_]+$/.test(fmt.docType)) errors.push('docType must be lower snake_case')
  if (!fmt.pattern || !parsePlaceholders(fmt.pattern).includes('COUNTER')) errors.push('pattern must include {COUNTER}')
  const bad = parsePlaceholders(fmt.pattern ?? '').filter(p => !PLACEHOLDERS.includes(p as Placeholder))
  if (bad.length) errors.push(`unknown placeholders: ${bad.join(', ')}`)
  if ((fmt.padding ?? 0) < 0 || (fmt.padding ?? 0) > 20) errors.push('padding must be 0..20')
  if ((fmt.increment ?? 1) < 1) errors.push('increment must be ≥ 1')
  if ((fmt.startNumber ?? 1) < 0) errors.push('startNumber must be ≥ 0')
  if (fmt.maxNumber != null && fmt.startNumber != null && fmt.maxNumber < fmt.startNumber) errors.push('maxNumber < startNumber')
  return { ok: errors.length === 0, errors }
}

/**
 * A regex that matches numbers produced by this format (placeholders become
 * character classes). Used by `validateDocumentNumber` to detect manual/invalid
 * numbers without touching the DB.
 */
export function formatRegex(fmt: NumberFormat): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const counterClass = fmt.alphabet === 'hex' ? '[0-9A-Fa-f]+' : '[0-9]+'
  let src = ''
  const re = /\{([A-Z_]+)\}|([^{]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(fmt.pattern))) {
    if (m[2] != null) { src += esc(m[2]); continue }
    const key = m[1]
    switch (key) {
      case 'PREFIX': src += esc(fmt.prefix ?? ''); break
      case 'SUFFIX': src += esc(fmt.suffix ?? ''); break
      case 'DOCUMENT_TYPE': src += esc(fmt.docType.toUpperCase()); break
      case 'YEAR': src += '[0-9]{4}'; break
      case 'MONTH': case 'DAY': src += '[0-9]{2}'; break
      case 'COUNTER': src += counterClass; break
      case 'UUID': src += '[0-9a-fA-F-]{36}'; break
      case 'RANDOM': src += '[A-Za-z0-9]+'; break
      default: src += '[A-Za-z0-9]*'
    }
  }
  return new RegExp(`^${src.replace(/-{2,}/g, '-').replace(/^-|-$/g, '')}$`)
}
