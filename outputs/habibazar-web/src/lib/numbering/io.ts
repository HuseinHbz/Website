/**
 * Enterprise Numbering Engine — config import/export (Phase 21.11, item 2).
 *
 * Back up / restore the *format definitions* (not the live counters) as JSON or
 * CSV. Import is idempotent (upsert by doc_type) and every row is validated by the
 * pure `validateFormat` before it touches the DB — a bad row is reported, never
 * persisted. Counters are deliberately excluded so importing a config never
 * rewinds or corrupts a live sequence.
 */
import { pgQuery } from '@/lib/db'
import { toCsv, type Row, type Column } from '@/lib/reports/pivot'
import { validateFormat, type ResetPolicy, type Alphabet } from './format'

export interface ExportFormat {
  docType: string; nameEn: string; nameFa: string | null; pattern: string
  prefix: string; suffix: string; resetPolicy: string; padding: number
  increment: number; startNumber: number; minNumber: number; maxNumber: number | null
  alphabet: string; fiscalStartMonth: number; randomLength: number; active: number
}

const COLUMNS: Column[] = [
  { key: 'docType', label: 'docType' }, { key: 'nameEn', label: 'nameEn' }, { key: 'nameFa', label: 'nameFa' },
  { key: 'pattern', label: 'pattern' }, { key: 'prefix', label: 'prefix' }, { key: 'suffix', label: 'suffix' },
  { key: 'resetPolicy', label: 'resetPolicy' }, { key: 'padding', label: 'padding' }, { key: 'increment', label: 'increment' },
  { key: 'startNumber', label: 'startNumber' }, { key: 'minNumber', label: 'minNumber' }, { key: 'maxNumber', label: 'maxNumber' },
  { key: 'alphabet', label: 'alphabet' }, { key: 'fiscalStartMonth', label: 'fiscalStartMonth' },
  { key: 'randomLength', label: 'randomLength' }, { key: 'active', label: 'active' },
]

export async function exportFormats(): Promise<ExportFormat[]> {
  return pgQuery<ExportFormat>(
    `SELECT doc_type AS "docType", name_en AS "nameEn", name_fa AS "nameFa", pattern, prefix, suffix,
            reset_policy AS "resetPolicy", padding, increment, start_number AS "startNumber",
            min_number AS "minNumber", CASE WHEN max_number IS NULL THEN NULL ELSE max_number::int END AS "maxNumber",
            alphabet, fiscal_start_month AS "fiscalStartMonth", random_length AS "randomLength", active
     FROM numbering_formats ORDER BY doc_type`)
}

export async function exportCsv(): Promise<string> {
  const rows = await exportFormats()
  return toCsv(COLUMNS, rows as unknown as Row[])
}

export interface ImportReport { imported: number; updated: number; skipped: { docType: string; reason: string }[] }

/** Upsert format definitions from a parsed JSON array; validate each row. */
export async function importFormats(items: unknown[]): Promise<ImportReport> {
  const report: ImportReport = { imported: 0, updated: 0, skipped: [] }
  for (const raw of items) {
    const r = raw as Partial<ExportFormat>
    const docType = String(r.docType ?? '').trim()
    if (!docType) { report.skipped.push({ docType: '(blank)', reason: 'missing docType' }); continue }
    const candidate = {
      docType,
      pattern: String(r.pattern ?? '{PREFIX}-{YEAR}-{COUNTER}'),
      resetPolicy: (r.resetPolicy ?? 'yearly') as ResetPolicy,
      padding: Number(r.padding ?? 6), increment: Number(r.increment ?? 1),
      startNumber: Number(r.startNumber ?? 1), minNumber: Number(r.minNumber ?? 1),
      maxNumber: r.maxNumber == null ? null : Number(r.maxNumber),
      alphabet: (r.alphabet ?? 'numeric') as Alphabet,
    }
    const v = validateFormat(candidate)
    if (!v.ok) { report.skipped.push({ docType, reason: v.errors.join('; ') }); continue }
    const existing = await pgQuery(`SELECT id FROM numbering_formats WHERE doc_type=$1`, [docType])
    await pgQuery(
      `INSERT INTO numbering_formats (doc_type, name_en, name_fa, pattern, prefix, suffix, reset_policy,
         padding, increment, start_number, min_number, max_number, alphabet, fiscal_start_month, random_length, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (doc_type) DO UPDATE SET
         name_en=EXCLUDED.name_en, name_fa=EXCLUDED.name_fa, pattern=EXCLUDED.pattern, prefix=EXCLUDED.prefix,
         suffix=EXCLUDED.suffix, reset_policy=EXCLUDED.reset_policy, padding=EXCLUDED.padding,
         increment=EXCLUDED.increment, start_number=EXCLUDED.start_number, min_number=EXCLUDED.min_number,
         max_number=EXCLUDED.max_number, alphabet=EXCLUDED.alphabet, fiscal_start_month=EXCLUDED.fiscal_start_month,
         random_length=EXCLUDED.random_length, active=EXCLUDED.active, updated_at=to_char(now(),'YYYY-MM-DD HH24:MI:SS')`,
      [docType, r.nameEn ?? docType, r.nameFa ?? null, candidate.pattern, r.prefix ?? '', r.suffix ?? '',
       candidate.resetPolicy, candidate.padding, candidate.increment, candidate.startNumber, candidate.minNumber,
       candidate.maxNumber, candidate.alphabet, Number(r.fiscalStartMonth ?? 1), Number(r.randomLength ?? 4), Number(r.active ?? 1)])
    if (existing.length) report.updated++; else report.imported++
  }
  return report
}
