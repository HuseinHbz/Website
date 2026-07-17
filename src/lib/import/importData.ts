/**
 * Import & Migration data layer (Phase 26.18). Persists import jobs and drives
 * the pipeline: upload → mapping → validation (with live DB context) → tiered
 * approval → transactional execution (recording every inserted record into
 * migration_transactions) → rollback (reverse migration). Reuses `parseCsv`
 * (dataTable platform), the 26.16/26.17 validators via the pure import engine,
 * and `postOpeningBalance` (26.9) for financial migration — no duplicate engines.
 */
import { createHash } from 'crypto'
import { pgQuery, getPool } from '@/lib/db'
import { parseCsv } from '@/lib/admin/dataTableExport'
import { normalizeKey } from '@/lib/masterdata/quality'
import { postOpeningBalance } from '@/lib/erp/accountingData'
import { nextNumber } from '@/lib/numbering/integrate'
import { isXlsx, xlsxToMatrix } from './xlsx'
import { cleanseRecord } from './cleanse'
import {
  ENTITY_SPECS, autoMapColumns, applyMapping, validateRecord, journalGroupBalanced,
  approvalTierFor, tierSatisfiedBy, canTransitionJob,
  type EntityType, type JobStatus, type ValidationContext,
} from './engine'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"
type Resolution = 'block' | 'skip' | 'update'
interface MappingBlob { fields: Record<string, string>; resolution: Resolution }

export interface ImportJob {
  id: number; entityType: EntityType; name: string; sourceSystem: string | null
  fileName: string | null; fileHash: string | null; status: JobStatus
  totalRows: number; validRows: number; warningRows: number; errorRows: number; importedRows: number
  mapping: MappingBlob; approvalTier: string; approvedBy: string | null; approvedAt: string | null
  error: string | null; createdBy: string | null; createdAt: string; completedAt: string | null
}

const parseMapping = (s: string | null): MappingBlob => {
  try { const v = JSON.parse(s || '{}'); return { fields: v.fields ?? {}, resolution: v.resolution ?? 'skip' } } catch { return { fields: {}, resolution: 'skip' } }
}

function rowOf(r: Record<string, unknown>): ImportJob {
  return {
    id: Number(r.id), entityType: r.entity_type as EntityType, name: String(r.name), sourceSystem: (r.source_system as string) ?? null,
    fileName: (r.file_name as string) ?? null, fileHash: (r.file_hash as string) ?? null, status: r.status as JobStatus,
    totalRows: Number(r.total_rows), validRows: Number(r.valid_rows), warningRows: Number(r.warning_rows),
    errorRows: Number(r.error_rows), importedRows: Number(r.imported_rows), mapping: parseMapping(r.mapping as string),
    approvalTier: String(r.approval_tier), approvedBy: (r.approved_by as string) ?? null, approvedAt: (r.approved_at as string) ?? null,
    error: (r.error as string) ?? null, createdBy: (r.created_by as string) ?? null, createdAt: String(r.created_at), completedAt: (r.completed_at as string) ?? null,
  }
}

async function history(jobId: number | null, action: string, actor?: string, detail?: unknown) {
  await pgQuery(`INSERT INTO import_history (job_id, action, actor, detail, created_at) VALUES ($1,$2,$3,$4,${NOW})`,
    [jobId, action, actor ?? null, detail ? JSON.stringify(detail) : null])
}

async function setStatus(jobId: number, from: JobStatus, to: JobStatus): Promise<void> {
  if (!canTransitionJob(from, to)) throw new Error(`Illegal job transition ${from} → ${to}`)
  await pgQuery(`UPDATE import_jobs SET status=$2, updated_at=${NOW} WHERE id=$1`, [jobId, to])
}

// ── Create (upload) ──────────────────────────────────────────────────────────
export async function createJob(d: { entityType: EntityType; name: string; sourceSystem?: string; fileName: string; content: string | Buffer; sheet?: string }, userId?: string): Promise<{ id: number; headers: string[]; suggested: Record<string, string>; totalRows: number; sheetNames?: string[] }> {
  const isJson = d.fileName.toLowerCase().endsWith('.json')
  const buf = Buffer.isBuffer(d.content) ? d.content : null
  let headers: string[] = []
  let rows: Record<string, string>[] = []
  let sheetNames: string[] | undefined
  const fromMatrix = (matrix: string[][]) => {
    if (matrix.length < 2) throw new Error('File needs a header row and at least one data row')
    headers = matrix[0].map(h => h.trim())
    rows = matrix.slice(1).filter(cells => cells.some(c => c.trim() !== ''))
      .map(cells => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()])))
  }
  if (buf && isXlsx(buf)) {
    // Native .xlsx (Phase 26.19): multi-sheet, shared strings, Unicode/Persian.
    const wb = xlsxToMatrix(buf, d.sheet)
    sheetNames = wb.sheetNames
    fromMatrix(wb.matrix)
  } else if (isJson) {
    const arr = JSON.parse(buf ? buf.toString('utf8') : (d.content as string))
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('JSON must be a non-empty array of objects')
    headers = [...new Set(arr.flatMap((o: object) => Object.keys(o)))]
    rows = arr.map((o: Record<string, unknown>) => Object.fromEntries(headers.map(h => [h, o[h] == null ? '' : String(o[h])])))
  } else {
    fromMatrix(parseCsv(buf ? buf.toString('utf8') : (d.content as string)))
  }
  if (rows.length > 20000) throw new Error('Maximum 20,000 rows per import job')
  const fileHash = createHash('sha256').update(buf ?? (d.content as string)).digest('hex')
  const suggested = autoMapColumns(headers, d.entityType)
  const tier = approvalTierFor(rows.length)
  const job = (await pgQuery<{ id: number }>(
    `INSERT INTO import_jobs (entity_type, name, source_system, file_name, file_hash, status, total_rows, mapping, approval_tier, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,${NOW},${NOW}) RETURNING id`,
    [d.entityType, d.name, d.sourceSystem ?? null, d.fileName, fileHash, rows.length, JSON.stringify({ fields: suggested, resolution: 'skip' }), tier, userId ?? null]))[0]
  // Store rows (chunked multi-row insert).
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const values = chunk.map((_, j) => `($1, $${j * 2 + 2}, $${j * 2 + 3})`).join(',')
    const params: unknown[] = [job.id]
    chunk.forEach((r, j) => { params.push(i + j + 1, JSON.stringify(r)) })
    await pgQuery(`INSERT INTO import_job_rows (job_id, row_no, raw) VALUES ${values}`, params)
  }
  await history(job.id, 'created', userId, { fileName: d.fileName, fileHash, rows: rows.length, tier, sheet: sheetNames ? (d.sheet ?? sheetNames[0]) : undefined })
  return { id: job.id, headers, suggested, totalRows: rows.length, sheetNames }
}

// ── Read ─────────────────────────────────────────────────────────────────────
export async function listJobs(): Promise<ImportJob[]> {
  const rows = await pgQuery(`SELECT * FROM import_jobs ORDER BY id DESC LIMIT 200`)
  return rows.map(rowOf)
}

export async function getJob(id: number, previewRows = 15): Promise<{ job: ImportJob; headers: string[]; preview: Record<string, string>[]; errors: { rowNo: number; field: string | null; code: string; severity: string; message: string }[] }> {
  const r = (await pgQuery(`SELECT * FROM import_jobs WHERE id=$1`, [id]))[0]
  if (!r) throw new Error('Job not found')
  const raw = await pgQuery<{ raw: string }>(`SELECT raw FROM import_job_rows WHERE job_id=$1 ORDER BY row_no LIMIT $2`, [id, previewRows])
  const preview = raw.map(x => JSON.parse(x.raw) as Record<string, string>)
  const headers = preview.length ? Object.keys(preview[0]) : []
  const errors = (await pgQuery(
    `SELECT row_no AS "rowNo", field, code, severity, message FROM import_validation_errors WHERE job_id=$1 ORDER BY row_no LIMIT 300`, [id])) as { rowNo: number; field: string | null; code: string; severity: string; message: string }[]
  return { job: rowOf(r), headers, preview, errors }
}

// ── Mapping ──────────────────────────────────────────────────────────────────
export async function saveJobMapping(jobId: number, fields: Record<string, string>, resolution: Resolution): Promise<void> {
  const job = rowOf((await pgQuery(`SELECT * FROM import_jobs WHERE id=$1`, [jobId]))[0] ?? {})
  if (!['draft', 'mapping', 'validated', 'failed'].includes(job.status)) throw new Error(`Cannot re-map a ${job.status} job`)
  await pgQuery(`UPDATE import_jobs SET mapping=$2, status='mapping', updated_at=${NOW} WHERE id=$1`, [jobId, JSON.stringify({ fields, resolution })])
}

// ── Validation (M4 + M5, with live DB context) ───────────────────────────────
async function keySet(sql: string): Promise<Set<string>> {
  const rows = await pgQuery<{ v: string | null }>(sql)
  return new Set(rows.map(r => normalizeKey(r.v)).filter(Boolean))
}

async function buildContext(entity: EntityType, resolution: Resolution): Promise<ValidationContext> {
  const ctx: ValidationContext = { resolution, existing: {}, refs: {} }
  if (entity === 'customer') {
    ctx.existing = {
      code: await keySet(`SELECT code AS v FROM sales_customers`),
      nationalId: await keySet(`SELECT national_id AS v FROM sales_customers WHERE active=1`),
      phone: await keySet(`SELECT phone AS v FROM sales_customers WHERE active=1`),
      email: await keySet(`SELECT email AS v FROM sales_customers WHERE active=1`),
    }
  } else if (entity === 'supplier') {
    ctx.existing = {
      code: await keySet(`SELECT code AS v FROM purchase_vendors`),
      economicCode: await keySet(`SELECT economic_code AS v FROM purchase_vendors WHERE active=true`),
      taxId: await keySet(`SELECT tax_id AS v FROM purchase_vendors WHERE active=true`),
    }
  } else if (entity === 'product') {
    ctx.existing = {
      sku: await keySet(`SELECT sku AS v FROM inv_products`),
      barcode: await keySet(`SELECT barcode AS v FROM inv_products WHERE active=1`),
    }
  } else if (entity === 'category') {
    ctx.existing = { code: await keySet(`SELECT code AS v FROM erp_categories`) }
  } else if (entity === 'warehouse') {
    ctx.existing = { code: await keySet(`SELECT code AS v FROM inv_warehouses`) }
  } else if (entity === 'inventory') {
    ctx.refs = {
      product: await keySet(`SELECT sku AS v FROM inv_products WHERE active=1`),
      warehouse: await keySet(`SELECT code AS v FROM inv_warehouses WHERE active=1`),
    }
  } else if (entity === 'opening_balance' || entity === 'journal') {
    ctx.refs = { account: await keySet(`SELECT code AS v FROM gl_accounts WHERE active=1`) }
  }
  return ctx
}

export async function validateJob(jobId: number): Promise<{ valid: number; warnings: number; errors: number; tier: string }> {
  const jr = (await pgQuery(`SELECT * FROM import_jobs WHERE id=$1`, [jobId]))[0]
  if (!jr) throw new Error('Job not found')
  const job = rowOf(jr)
  await setStatus(jobId, job.status, 'validating')
  await pgQuery(`DELETE FROM import_validation_errors WHERE job_id=$1`, [jobId])
  const ctx = await buildContext(job.entityType, job.mapping.resolution)
  const rows = await pgQuery<{ id: number; row_no: number; raw: string }>(`SELECT id, row_no, raw FROM import_job_rows WHERE job_id=$1 ORDER BY row_no`, [jobId])

  let valid = 0, warnings = 0, errors = 0
  const journalGroups = new Map<string, { debit: number; credit: number; rowNos: number[] }>()

  for (const r of rows) {
    // 26.19: field-aware cleansing (Persian digits, phone, email, national code)
    // runs BEFORE validation so legacy formats normalize instead of failing.
    const mapped = cleanseRecord(applyMapping(JSON.parse(r.raw), job.mapping.fields))
    const res = validateRecord(job.entityType, mapped, ctx)
    let status = res.status
    // Conflicted rows under 'skip' resolution get skipped at execute time.
    const message = res.issues.map(i => i.message).join('; ') || null
    for (const i of res.issues) {
      await pgQuery(`INSERT INTO import_validation_errors (job_id, row_no, field, code, severity, message) VALUES ($1,$2,$3,$4,$5,$6)`,
        [jobId, r.row_no, i.field, i.code, i.severity, i.message])
    }
    if (job.entityType === 'journal' && status !== 'error') {
      const ref = String(res.record.ref ?? '')
      const g = journalGroups.get(ref) ?? { debit: 0, credit: 0, rowNos: [] }
      g.debit += Number(res.record.debit ?? 0); g.credit += Number(res.record.credit ?? 0); g.rowNos.push(r.row_no)
      journalGroups.set(ref, g)
    }
    await pgQuery(`UPDATE import_job_rows SET mapped=$2, status=$3, message=$4 WHERE id=$1`,
      [r.id, JSON.stringify({ ...res.record, __conflict: res.conflict }), status, message])
    if (status === 'valid') valid++; else if (status === 'warning') warnings++; else errors++
  }

  // Journal: every entry group must balance (Dr = Cr) — else its rows error out.
  for (const [ref, g] of journalGroups) {
    const bal = journalGroupBalanced([{ debit: g.debit, credit: 0 }, { debit: 0, credit: g.credit }])
    if (!bal.ok) {
      for (const rowNo of g.rowNos) {
        await pgQuery(`UPDATE import_job_rows SET status='error', message=$3 WHERE job_id=$1 AND row_no=$2`, [jobId, rowNo, `Entry "${ref}" unbalanced (Dr ${g.debit} ≠ Cr ${g.credit})`])
        await pgQuery(`INSERT INTO import_validation_errors (job_id, row_no, field, code, severity, message) VALUES ($1,$2,'ref','balance','error',$3)`, [jobId, rowNo, `Entry "${ref}" unbalanced (Dr ${g.debit} ≠ Cr ${g.credit})`])
      }
    }
  }
  // Exact recount from the rows table (journal fix-ups may have flipped rows).
  const counts = (await pgQuery<{ valid: number; warnings: number; errors: number }>(
    `SELECT COUNT(*) FILTER (WHERE status='valid')::int AS valid,
            COUNT(*) FILTER (WHERE status='warning')::int AS warnings,
            COUNT(*) FILTER (WHERE status='error')::int AS errors
     FROM import_job_rows WHERE job_id=$1`, [jobId]))[0]
  valid = counts.valid; warnings = counts.warnings; errors = counts.errors
  const importable = valid + warnings
  const finalStatus: JobStatus = errors > 0 && importable === 0 ? 'failed' : 'validated'
  await pgQuery(`UPDATE import_jobs SET valid_rows=$2, warning_rows=$3, error_rows=$4, status=$5, updated_at=${NOW} WHERE id=$1`,
    [jobId, valid, warnings, errors, finalStatus])
  await history(jobId, 'validated', undefined, { valid, warnings, errors })
  return { valid, warnings, errors, tier: job.approvalTier }
}

// ── Approval (M6) ────────────────────────────────────────────────────────────
export async function approveJob(jobId: number, user: { id: string; role: string }): Promise<void> {
  const job = rowOf((await pgQuery(`SELECT * FROM import_jobs WHERE id=$1`, [jobId]))[0] ?? {})
  if (job.status !== 'validated') throw new Error('Only a validated job can be approved')
  if (!tierSatisfiedBy(job.approvalTier as 'auto' | 'manager' | 'admin', user.role)) {
    throw new Error(`This import (${job.totalRows} rows) requires ${job.approvalTier} approval`)
  }
  await pgQuery(`UPDATE import_jobs SET status='approved', approved_by=$2, approved_at=${NOW}, updated_at=${NOW} WHERE id=$1`, [jobId, user.id])
  await history(jobId, 'approved', user.id, { tier: job.approvalTier })
}

// ── Execution (M7/M8) ────────────────────────────────────────────────────────
type Rec = Record<string, string | number | boolean | null> & { __conflict?: boolean }

export async function executeJob(jobId: number, userId?: string, opts: { dryRun?: boolean } = {}): Promise<{ imported: number; skipped: number; dryRun?: boolean }> {
  const dryRun = opts.dryRun === true
  const job = rowOf((await pgQuery(`SELECT * FROM import_jobs WHERE id=$1`, [jobId]))[0] ?? {})
  if (job.status !== 'approved') throw new Error('Job must be approved before execution')
  // Dry-run (26.19): financial single-shot entities simulate by reporting the
  // would-be counts only; row entities run the full transaction then ROLL BACK.
  if (dryRun && (job.entityType === 'opening_balance')) {
    const n = (await pgQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM import_job_rows WHERE job_id=$1 AND status IN ('valid','warning')`, [jobId]))[0].n
    await history(jobId, 'dry_run', userId, { wouldImport: n })
    return { imported: n, skipped: 0, dryRun: true }
  }
  if (!dryRun) await setStatus(jobId, 'approved', 'processing')
  const rows = await pgQuery<{ id: number; row_no: number; mapped: string; status: string }>(
    `SELECT id, row_no, mapped, status FROM import_job_rows WHERE job_id=$1 AND status IN ('valid','warning') ORDER BY row_no`, [jobId])
  const recs = rows.map(r => ({ rowId: r.id, rec: JSON.parse(r.mapped) as Rec }))
  const resolution = job.mapping.resolution
  const pool = getPool()
  const client = await pool.connect()
  let imported = 0, skipped = 0
  const log = async (table: string, recordId: number, op = 'insert') =>
    client.query(`INSERT INTO migration_transactions (job_id, entity_type, table_name, record_id, op, created_at) VALUES ($1,$2,$3,$4,$5,${NOW})`, [jobId, job.entityType, table, recordId, op])
  const markRow = (rowId: number, status: string) => client.query(`UPDATE import_job_rows SET status=$2 WHERE id=$1`, [rowId, status])

  try {
    // Journal numbers are minted before the transaction (numbering is atomic on
    // its own). A dry run must not consume numbers — placeholders are used.
    let journalNos: Map<string, string> | null = null
    if (job.entityType === 'journal') {
      journalNos = new Map()
      const refs = [...new Set(recs.map(x => String(x.rec.ref)))]
      for (const ref of refs) journalNos.set(ref, dryRun ? `DRY-${jobId}-${ref}` : await nextNumber('journal', { legacyPrefix: 'JV' }))
    }
    // Opening balance goes through the 26.9 engine (self-balancing + audited entry).
    if (job.entityType === 'opening_balance') {
      const codes = recs.map(x => String(x.rec.account))
      const accs = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE lower(code) = ANY($1)`, [codes.map(c => c.toLowerCase())])
      const idOf = new Map(accs.map(a => [a.code.toLowerCase(), a.id]))
      const entries = recs.map(x => ({ accountId: idOf.get(String(x.rec.account).toLowerCase())!, amount: Number(x.rec.amount ?? 0) }))
      const { entryId } = await postOpeningBalance({ date: new Date().toISOString().slice(0, 10), entries }, userId)
      await pgQuery(`INSERT INTO migration_transactions (job_id, entity_type, table_name, record_id, op, created_at) VALUES ($1,'opening_balance','gl_journal_entries',$2,'insert',${NOW})`, [jobId, entryId])
      for (const x of recs) await pgQuery(`UPDATE import_job_rows SET status='imported' WHERE id=$1`, [x.rowId])
      imported = recs.length
      await pgQuery(`UPDATE import_jobs SET status='completed', imported_rows=$2, completed_at=${NOW}, updated_at=${NOW} WHERE id=$1`, [jobId, imported])
      await history(jobId, 'executed', userId, { imported, entryId })
      return { imported, skipped }
    }

    await client.query('BEGIN')
    if (job.entityType === 'customer' || job.entityType === 'supplier' || job.entityType === 'product' || job.entityType === 'warehouse' || job.entityType === 'category') {
      for (const { rowId, rec } of recs) {
        if (rec.__conflict && resolution === 'skip') { await markRow(rowId, 'skipped'); skipped++; continue }
        let res: { rows: { id: number; inserted: boolean }[] }
        if (job.entityType === 'customer') {
          res = await client.query(
            `INSERT INTO sales_customers (code, name, kind, national_id, economic_code, phone, email, credit_limit, active, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,${NOW}) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, national_id=EXCLUDED.national_id, economic_code=EXCLUDED.economic_code, phone=EXCLUDED.phone, email=EXCLUDED.email, credit_limit=EXCLUDED.credit_limit, updated_at=${NOW}
             RETURNING id, (xmax = 0) AS inserted`,
            [rec.code, rec.name, rec.kind === 'individual' || rec.kind === 'حقیقی' ? 'individual' : 'company', rec.nationalId ?? null, rec.economicCode ?? null, rec.phone ?? null, rec.email ?? null, rec.creditLimit ?? 0])
        } else if (job.entityType === 'supplier') {
          res = await client.query(
            `INSERT INTO purchase_vendors (code, name, kind, economic_code, tax_id, phone, email, iban, currency, payment_terms, active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, economic_code=EXCLUDED.economic_code, tax_id=EXCLUDED.tax_id, phone=EXCLUDED.phone, email=EXCLUDED.email, iban=EXCLUDED.iban
             RETURNING id, (xmax = 0) AS inserted`,
            [rec.code, rec.name, rec.kind === 'individual' || rec.kind === 'حقیقی' ? 'individual' : 'company', rec.economicCode ?? null, rec.taxId ?? null, rec.phone ?? null, rec.email ?? null, rec.iban ?? null, rec.currency ?? 'IRR', rec.paymentTerms ?? 0])
        } else if (job.entityType === 'product') {
          res = await client.query(
            `INSERT INTO inv_products (sku, barcode, name_en, name_fa, category, unit, cost, price, active, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,${NOW}) ON CONFLICT (sku) DO UPDATE SET barcode=EXCLUDED.barcode, name_en=EXCLUDED.name_en, name_fa=EXCLUDED.name_fa, category=EXCLUDED.category, cost=EXCLUDED.cost, price=EXCLUDED.price, updated_at=${NOW}
             RETURNING id, (xmax = 0) AS inserted`,
            [rec.sku, rec.barcode ?? null, rec.nameEn, rec.nameFa ?? null, rec.category ?? 'general', rec.unit ?? 'pcs', rec.cost ?? 0, rec.price ?? 0])
        } else if (job.entityType === 'warehouse') {
          res = await client.query(
            `INSERT INTO inv_warehouses (code, name_en, name_fa, branch, active) VALUES ($1,$2,$3,$4,1)
             ON CONFLICT (code) DO UPDATE SET name_en=EXCLUDED.name_en, name_fa=EXCLUDED.name_fa, branch=EXCLUDED.branch
             RETURNING id, (xmax = 0) AS inserted`,
            [rec.code, rec.nameEn, rec.nameFa ?? null, rec.branch ?? null])
        } else {
          res = await client.query(
            `INSERT INTO erp_categories (code, name_en, name_fa, level, active, created_by, created_at, updated_at) VALUES ($1,$2,$3,0,1,$4,${NOW},${NOW})
             ON CONFLICT (code) DO UPDATE SET name_en=EXCLUDED.name_en, name_fa=EXCLUDED.name_fa, updated_at=${NOW}
             RETURNING id, (xmax = 0) AS inserted`,
            [rec.code, rec.nameEn, rec.nameFa ?? null, userId ?? null])
        }
        const row = res.rows[0]
        const table = job.entityType === 'customer' ? 'sales_customers' : job.entityType === 'supplier' ? 'purchase_vendors' : job.entityType === 'product' ? 'inv_products' : job.entityType === 'warehouse' ? 'inv_warehouses' : 'erp_categories'
        await log(table, row.id, row.inserted ? 'insert' : 'update')
        await markRow(rowId, 'imported'); imported++
      }
    } else if (job.entityType === 'inventory') {
      const skus = recs.map(x => String(x.rec.sku).toLowerCase())
      const whs = recs.map(x => String(x.rec.warehouse).toLowerCase())
      const prods = await pgQuery<{ id: number; sku: string; cost: number }>(`SELECT id, sku, cost::float AS cost FROM inv_products WHERE lower(sku) = ANY($1)`, [skus])
      const wrows = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM inv_warehouses WHERE lower(code) = ANY($1)`, [whs])
      const pOf = new Map(prods.map(p => [p.sku.toLowerCase(), p]))
      const wOf = new Map(wrows.map(w => [w.code.toLowerCase(), w.id]))
      for (const { rowId, rec } of recs) {
        const p = pOf.get(String(rec.sku).toLowerCase())!
        const wid = wOf.get(String(rec.warehouse).toLowerCase())!
        const res = await client.query(
          `INSERT INTO inv_moves (product_id, warehouse_id, type, qty, unit_cost, ref, created_by, created_at)
           VALUES ($1,$2,'receipt',$3,$4,$5,$6,${NOW}) RETURNING id`,
          [p.id, wid, Number(rec.qty), rec.unitCost ?? p.cost ?? 0, `Import job #${jobId}`, userId ?? null])
        await log('inv_moves', res.rows[0].id, 'insert')
        await markRow(rowId, 'imported'); imported++
      }
    } else if (job.entityType === 'journal') {
      const groups = new Map<string, { rowIds: number[]; recs: Rec[] }>()
      for (const { rowId, rec } of recs) {
        const g = groups.get(String(rec.ref)) ?? { rowIds: [], recs: [] }
        g.rowIds.push(rowId); g.recs.push(rec)
        groups.set(String(rec.ref), g)
      }
      const codes = [...new Set(recs.map(x => String(x.rec.account).toLowerCase()))]
      const accs = await pgQuery<{ id: number; code: string }>(`SELECT id, code FROM gl_accounts WHERE lower(code) = ANY($1)`, [codes])
      const aOf = new Map(accs.map(a => [a.code.toLowerCase(), a.id]))
      for (const [ref, g] of groups) {
        const total = g.recs.reduce((s, r) => s + Number(r.debit ?? 0), 0)
        const date = String(g.recs[0].date || new Date().toISOString().slice(0, 10))
        const entry = await client.query(
          `INSERT INTO gl_journal_entries (entry_no, date, memo, reference, status, total, created_by, created_at, posted_at)
           VALUES ($1,$2,$3,$4,'posted',$5,$6,${NOW},${NOW}) RETURNING id`,
          [journalNos!.get(ref), date, `Imported entry ${ref}`, `IMP-${jobId}`, total, userId ?? null])
        let ln = 0
        for (const r of g.recs) {
          await client.query(`INSERT INTO gl_journal_lines (entry_id, account_id, debit, credit, memo, line_no) VALUES ($1,$2,$3,$4,$5,$6)`,
            [entry.rows[0].id, aOf.get(String(r.account).toLowerCase()), Number(r.debit ?? 0), Number(r.credit ?? 0), r.memo ?? null, ln++])
        }
        await log('gl_journal_entries', entry.rows[0].id, 'insert')
        for (const rowId of g.rowIds) { await markRow(rowId, 'imported'); imported++ }
      }
    } else {
      throw new Error(`Unsupported entity ${job.entityType}`)
    }
    // Dry run: the whole write set is rolled back — nothing persists, the job
    // stays approved and the report shows exactly what a real run would do.
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    if (!dryRun) {
      await pgQuery(`UPDATE import_jobs SET status='failed', error=$2, updated_at=${NOW} WHERE id=$1`, [jobId, e instanceof Error ? e.message : 'Execution failed'])
      await history(jobId, 'failed', userId, { error: e instanceof Error ? e.message : String(e) })
    }
    throw e
  } finally {
    client.release()
  }
  if (dryRun) {
    await history(jobId, 'dry_run', userId, { wouldImport: imported, wouldSkip: skipped })
    return { imported, skipped, dryRun: true }
  }
  await pgQuery(`UPDATE import_jobs SET status='completed', imported_rows=$2, completed_at=${NOW}, updated_at=${NOW} WHERE id=$1`, [jobId, imported])
  await history(jobId, 'executed', userId, { imported, skipped })
  return { imported, skipped }
}

// ── Rollback (M8) ────────────────────────────────────────────────────────────
const ROLLBACK_TABLES = new Set(['sales_customers', 'purchase_vendors', 'inv_products', 'inv_warehouses', 'erp_categories', 'inv_moves', 'gl_journal_entries'])

export async function rollbackJob(jobId: number, userId?: string): Promise<{ reversed: number; notReversible: number }> {
  const job = rowOf((await pgQuery(`SELECT * FROM import_jobs WHERE id=$1`, [jobId]))[0] ?? {})
  if (job.status !== 'completed') throw new Error('Only a completed job can be rolled back')
  const txs = await pgQuery<{ id: number; table_name: string; record_id: number; op: string }>(
    `SELECT id, table_name, record_id, op FROM migration_transactions WHERE job_id=$1 ORDER BY id DESC`, [jobId])
  let reversed = 0, notReversible = 0
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const t of txs) {
      if (t.op !== 'insert' || !ROLLBACK_TABLES.has(t.table_name)) { notReversible++; continue }
      await client.query(`DELETE FROM ${t.table_name} WHERE id=$1`, [t.record_id]) // gl_journal_lines cascade
      reversed++
    }
    await client.query(`UPDATE import_jobs SET status='rolled_back', updated_at=${NOW} WHERE id=$1`, [jobId])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
  await pgQuery(`UPDATE import_job_rows SET status='pending' WHERE job_id=$1 AND status='imported'`, [jobId])
  await history(jobId, 'rolled_back', userId, { reversed, notReversible })
  return { reversed, notReversible }
}

// ── Templates + mappings (M2/M3) ─────────────────────────────────────────────
export async function listTemplates(): Promise<{ id: number; entityType: string; name: string; fields: string[]; version: number }[]> {
  const rows = await pgQuery<{ id: number; entity_type: string; name: string; fields: string; version: number }>(`SELECT id, entity_type, name, fields, version FROM import_templates ORDER BY entity_type, name`)
  return rows.map(r => ({ id: r.id, entityType: r.entity_type, name: r.name, fields: JSON.parse(r.fields || '[]'), version: r.version }))
}
export async function saveTemplate(d: { id?: number; entityType: EntityType; name: string; fields: string[] }, userId?: string): Promise<{ id: number }> {
  if (d.id) {
    await pgQuery(`UPDATE import_templates SET name=$2, fields=$3, version=version+1 WHERE id=$1`, [d.id, d.name, JSON.stringify(d.fields)])
    return { id: d.id }
  }
  const r = (await pgQuery<{ id: number }>(`INSERT INTO import_templates (entity_type, name, fields, created_by, created_at) VALUES ($1,$2,$3,$4,${NOW}) RETURNING id`,
    [d.entityType, d.name, JSON.stringify(d.fields), userId ?? null]))[0]
  return r
}
export async function deleteTemplate(id: number): Promise<void> { await pgQuery(`DELETE FROM import_templates WHERE id=$1`, [id]) }

export async function listMappings(entityType?: string): Promise<{ id: number; entityType: string; name: string; sourceSystem: string | null; mapping: Record<string, string> }[]> {
  const rows = await pgQuery<{ id: number; entity_type: string; name: string; source_system: string | null; mapping: string }>(
    `SELECT id, entity_type, name, source_system, mapping FROM import_mappings ${entityType ? 'WHERE entity_type=$1' : ''} ORDER BY name`, entityType ? [entityType] : [])
  return rows.map(r => ({ id: r.id, entityType: r.entity_type, name: r.name, sourceSystem: r.source_system, mapping: JSON.parse(r.mapping || '{}') }))
}
export async function saveMappingProfile(d: { entityType: EntityType; name: string; sourceSystem?: string; mapping: Record<string, string> }, userId?: string): Promise<{ id: number }> {
  const r = (await pgQuery<{ id: number }>(`INSERT INTO import_mappings (entity_type, name, source_system, mapping, created_by, created_at) VALUES ($1,$2,$3,$4,$5,${NOW}) RETURNING id`,
    [d.entityType, d.name, d.sourceSystem ?? null, JSON.stringify(d.mapping), userId ?? null]))[0]
  return r
}

// ── Analytics (M11) ──────────────────────────────────────────────────────────
export interface ImportAnalytics {
  totalJobs: number; completed: number; failed: number; rolledBack: number
  recordsImported: number; errorRows: number; warningRows: number
  qualityPct: number
  byEntity: { entity: string; jobs: number; imported: number }[]
  recent: { id: number; name: string; entityType: string; status: string; importedRows: number; createdAt: string }[]
}
export async function importAnalytics(): Promise<ImportAnalytics> {
  const s = (await pgQuery<{ total: number; completed: number; failed: number; rolled: number; imported: number; errs: number; warns: number; valid: number; totalr: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status='completed')::int AS completed,
            COUNT(*) FILTER (WHERE status='failed')::int AS failed,
            COUNT(*) FILTER (WHERE status='rolled_back')::int AS rolled,
            COALESCE(SUM(imported_rows),0)::int AS imported,
            COALESCE(SUM(error_rows),0)::int AS errs,
            COALESCE(SUM(warning_rows),0)::int AS warns,
            COALESCE(SUM(valid_rows),0)::int AS valid,
            COALESCE(SUM(total_rows),0)::int AS totalr
     FROM import_jobs`))[0]
  const byEntity = await pgQuery<{ entity: string; jobs: number; imported: number }>(
    `SELECT entity_type AS entity, COUNT(*)::int AS jobs, COALESCE(SUM(imported_rows),0)::int AS imported FROM import_jobs GROUP BY entity_type ORDER BY imported DESC`)
  const recent = (await pgQuery(`SELECT id, name, entity_type AS "entityType", status, imported_rows AS "importedRows", created_at AS "createdAt" FROM import_jobs ORDER BY id DESC LIMIT 10`)) as ImportAnalytics['recent']
  return {
    totalJobs: s.total, completed: s.completed, failed: s.failed, rolledBack: s.rolled,
    recordsImported: s.imported, errorRows: s.errs, warningRows: s.warns,
    qualityPct: s.totalr > 0 ? Math.round(((s.valid + s.warns) / s.totalr) * 100) : 100,
    byEntity, recent,
  }
}
