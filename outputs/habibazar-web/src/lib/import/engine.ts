/**
 * Enterprise Data Import & Migration — pure engine (Phase 26.18).
 * Deterministic, no DB, fully unit-tested. Owns:
 *   - the per-entity field specs (what each import template looks like),
 *   - header → field auto-mapping (every company's Excel is different),
 *   - value coercion + per-record validation (reusing the 26.16/26.17 quality
 *     validators — NOT a second validation engine),
 *   - duplicate conflict classification against existing identity keys,
 *   - count-tiered approval (<100 auto · 100–1000 manager · >1000 admin),
 *   - the import-job state machine, and Dr=Cr checks for financial imports.
 * The data layer (importData.ts) persists; this module decides.
 */
import { normalizeKey, isValidEmail, isValidIranNationalId, isValidEconomicCode } from '@/lib/masterdata/quality'

export const ENTITY_TYPES = ['customer', 'supplier', 'product', 'category', 'warehouse', 'inventory', 'opening_balance', 'journal'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export type FieldType = 'text' | 'number' | 'boolean'
export interface FieldSpec {
  key: string
  en: string
  fa: string
  required?: boolean
  type?: FieldType
  /** Named validity check (reuses the master-data quality validators). */
  check?: 'email' | 'nationalId' | 'economicCode'
  /** Identity key checked against existing records for duplicate detection. */
  identity?: boolean
  /** Foreign reference resolved at validate time (needs DB context). */
  ref?: 'product' | 'warehouse' | 'account' | 'supplier' | 'category'
  synonyms?: string[]
}

export const ENTITY_SPECS: Record<EntityType, FieldSpec[]> = {
  customer: [
    { key: 'code', en: 'Customer Code', fa: 'کد مشتری', required: true, identity: true, synonyms: ['cust_code', 'customercode', 'id'] },
    { key: 'name', en: 'Name', fa: 'نام', required: true, synonyms: ['cust_name', 'customername', 'fullname', 'company'] },
    { key: 'kind', en: 'Kind (individual/company)', fa: 'نوع (حقیقی/حقوقی)', synonyms: ['type', 'party'] },
    { key: 'nationalId', en: 'National ID', fa: 'شناسه ملی', check: 'nationalId', identity: true, synonyms: ['national_id', 'nid', 'melli'] },
    { key: 'economicCode', en: 'Economic Code', fa: 'کد اقتصادی', check: 'economicCode', synonyms: ['economic_code', 'eco_code'] },
    { key: 'phone', en: 'Phone', fa: 'تلفن', identity: true, synonyms: ['mobile', 'mobileno', 'tel', 'phone_number'] },
    { key: 'email', en: 'Email', fa: 'ایمیل', check: 'email', identity: true, synonyms: ['mail', 'e-mail'] },
    { key: 'creditLimit', en: 'Credit Limit', fa: 'سقف اعتبار', type: 'number', synonyms: ['credit', 'credit_limit', 'limit'] },
  ],
  supplier: [
    { key: 'code', en: 'Supplier Code', fa: 'کد تأمین‌کننده', required: true, identity: true, synonyms: ['vendor_code', 'vendorcode'] },
    { key: 'name', en: 'Name', fa: 'نام', required: true, synonyms: ['vendor_name', 'suppliername', 'company'] },
    { key: 'kind', en: 'Kind', fa: 'نوع', synonyms: ['type'] },
    { key: 'economicCode', en: 'Economic Code', fa: 'کد اقتصادی', check: 'economicCode', identity: true, synonyms: ['economic_code', 'eco_code'] },
    { key: 'taxId', en: 'Tax ID', fa: 'شناسه مالیاتی', identity: true, synonyms: ['tax_id', 'vat_id'] },
    { key: 'phone', en: 'Phone', fa: 'تلفن', synonyms: ['mobile', 'tel'] },
    { key: 'email', en: 'Email', fa: 'ایمیل', check: 'email', synonyms: ['mail'] },
    { key: 'iban', en: 'IBAN (Sheba)', fa: 'شبا', synonyms: ['sheba', 'bank_account', 'account'] },
    { key: 'paymentTerms', en: 'Payment Terms (days)', fa: 'مهلت پرداخت (روز)', type: 'number', synonyms: ['terms', 'payment_days'] },
    { key: 'currency', en: 'Currency', fa: 'ارز', synonyms: ['curr'] },
  ],
  product: [
    { key: 'sku', en: 'SKU', fa: 'کد کالا', required: true, identity: true, synonyms: ['code', 'product_code', 'item_code'] },
    { key: 'barcode', en: 'Barcode', fa: 'بارکد', identity: true, synonyms: ['ean', 'upc'] },
    { key: 'nameEn', en: 'Name (EN)', fa: 'نام انگلیسی', required: true, synonyms: ['name', 'product_name', 'title'] },
    { key: 'nameFa', en: 'Name (FA)', fa: 'نام فارسی', synonyms: ['persian_name', 'name_fa'] },
    { key: 'category', en: 'Category', fa: 'دسته', synonyms: ['cat', 'group'] },
    { key: 'unit', en: 'Unit', fa: 'واحد', synonyms: ['uom'] },
    { key: 'cost', en: 'Cost', fa: 'بهای تمام‌شده', type: 'number', synonyms: ['purchase_price', 'buy_price'] },
    { key: 'price', en: 'Price', fa: 'قیمت فروش', type: 'number', synonyms: ['sale_price', 'sell_price'] },
  ],
  category: [
    { key: 'code', en: 'Code', fa: 'کد', required: true, identity: true },
    { key: 'nameEn', en: 'Name (EN)', fa: 'نام انگلیسی', required: true, synonyms: ['name'] },
    { key: 'nameFa', en: 'Name (FA)', fa: 'نام فارسی', synonyms: ['persian_name'] },
    { key: 'parentCode', en: 'Parent Code', fa: 'کد والد', synonyms: ['parent'] },
  ],
  warehouse: [
    { key: 'code', en: 'Code', fa: 'کد', required: true, identity: true },
    { key: 'nameEn', en: 'Name (EN)', fa: 'نام انگلیسی', required: true, synonyms: ['name', 'warehouse_name'] },
    { key: 'nameFa', en: 'Name (FA)', fa: 'نام فارسی', synonyms: ['persian_name'] },
    { key: 'branch', en: 'Branch', fa: 'شعبه', synonyms: ['location'] },
  ],
  inventory: [
    { key: 'sku', en: 'Product SKU', fa: 'کد کالا', required: true, ref: 'product', synonyms: ['product', 'product_code', 'item'] },
    { key: 'warehouse', en: 'Warehouse Code', fa: 'کد انبار', required: true, ref: 'warehouse', synonyms: ['warehouse_code', 'store'] },
    { key: 'qty', en: 'Quantity', fa: 'تعداد', required: true, type: 'number', synonyms: ['quantity', 'stock', 'onhand'] },
    { key: 'unitCost', en: 'Unit Cost', fa: 'بهای واحد', type: 'number', synonyms: ['cost', 'unit_cost'] },
  ],
  opening_balance: [
    { key: 'account', en: 'Account Code', fa: 'کد حساب', required: true, ref: 'account', synonyms: ['account_code', 'gl', 'coa'] },
    { key: 'amount', en: 'Amount', fa: 'مبلغ', required: true, type: 'number', synonyms: ['balance', 'value'] },
  ],
  journal: [
    { key: 'ref', en: 'Entry Ref', fa: 'شماره سند', required: true, synonyms: ['entry', 'voucher', 'doc_no'] },
    { key: 'date', en: 'Date', fa: 'تاریخ', synonyms: ['entry_date'] },
    { key: 'account', en: 'Account Code', fa: 'کد حساب', required: true, ref: 'account', synonyms: ['account_code', 'gl'] },
    { key: 'debit', en: 'Debit', fa: 'بدهکار', type: 'number', synonyms: ['dr'] },
    { key: 'credit', en: 'Credit', fa: 'بستانکار', type: 'number', synonyms: ['cr'] },
    { key: 'memo', en: 'Memo', fa: 'شرح', synonyms: ['description', 'narration'] },
  ],
}

/** Template CSV (header row) for an entity — used by the template designer/export. */
export function templateCsv(entity: EntityType): string {
  return ENTITY_SPECS[entity].map(f => f.key).join(',')
}

// ── Mapping ──────────────────────────────────────────────────────────────────
const normHeader = (s: string) => s.toLowerCase().replace(/[\s_\-./]+/g, '')

/**
 * Suggest a mapping {fieldKey → source header} for arbitrary file headers:
 * exact key > exact EN/FA label > synonym > substring containment.
 */
export function autoMapColumns(headers: string[], entity: EntityType): Record<string, string> {
  const spec = ENTITY_SPECS[entity]
  const out: Record<string, string> = {}
  const used = new Set<string>()
  const claim = (key: string, header: string) => { out[key] = header; used.add(header) }
  const free = (h: string) => !used.has(h)

  for (const f of spec) {
    const nk = normHeader(f.key)
    const hit = headers.find(h => free(h) && normHeader(h) === nk)
    if (hit) claim(f.key, hit)
  }
  for (const f of spec) {
    if (out[f.key]) continue
    const hit = headers.find(h => free(h) && (normHeader(h) === normHeader(f.en) || h.trim() === f.fa))
    if (hit) claim(f.key, hit)
  }
  for (const f of spec) {
    if (out[f.key] || !f.synonyms) continue
    const syns = f.synonyms.map(normHeader)
    const hit = headers.find(h => free(h) && syns.includes(normHeader(h)))
    if (hit) claim(f.key, hit)
  }
  for (const f of spec) {
    if (out[f.key]) continue
    const nk = normHeader(f.key)
    const hit = headers.find(h => free(h) && (normHeader(h).includes(nk) || nk.includes(normHeader(h))) && normHeader(h).length >= 3)
    if (hit) claim(f.key, hit)
  }
  return out
}

/** Apply a saved mapping to one raw row (header→cell record). */
export function applyMapping(raw: Record<string, string>, mapping: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [field, header] of Object.entries(mapping)) {
    if (!header) continue
    out[field] = (raw[header] ?? '').trim()
  }
  return out
}

// ── Coercion + validation ────────────────────────────────────────────────────
export function coerce(type: FieldType | undefined, raw: string): { value: string | number | boolean | null; error?: string } {
  const v = (raw ?? '').trim()
  if (v === '') return { value: null }
  if (type === 'number') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? { value: n } : { value: null, error: 'not a number' }
  }
  if (type === 'boolean') return { value: /^(1|true|yes|on|بله)$/i.test(v) }
  return { value: v }
}

export interface ValidationIssue { field: string; code: string; severity: 'error' | 'warning'; message: string }
export interface ValidationContext {
  /** Existing identity keys per field (normalized) — duplicate detection. */
  existing?: Partial<Record<string, Set<string>>>
  /** Existing reference keys (normalized) per ref kind — relationship checks. */
  refs?: Partial<Record<NonNullable<FieldSpec['ref']>, Set<string>>>
  /** How identity conflicts resolve: block (error) / skip / update (warnings). */
  resolution?: 'block' | 'skip' | 'update'
}

export interface RecordValidation {
  status: 'valid' | 'warning' | 'error'
  record: Record<string, string | number | boolean | null>
  issues: ValidationIssue[]
  /** True when an identity key matched an existing record. */
  conflict: boolean
}

const CHECKS: Record<NonNullable<FieldSpec['check']>, (v: string) => boolean> = {
  email: v => isValidEmail(v),
  nationalId: v => isValidIranNationalId(v),
  economicCode: v => isValidEconomicCode(v),
}

/** Validate one mapped row: required → type → format → relationships → duplicates. */
export function validateRecord(entity: EntityType, mapped: Record<string, string>, ctx: ValidationContext = {}): RecordValidation {
  const spec = ENTITY_SPECS[entity]
  const issues: ValidationIssue[] = []
  const record: Record<string, string | number | boolean | null> = {}
  let conflict = false

  for (const f of spec) {
    const raw = mapped[f.key] ?? ''
    const { value, error } = coerce(f.type, raw)
    record[f.key] = value
    if (f.required && (value == null || value === '')) {
      issues.push({ field: f.key, code: 'required', severity: 'error', message: `${f.en} is required` })
      continue
    }
    if (error) { issues.push({ field: f.key, code: 'type', severity: 'error', message: `${f.en}: ${error}` }); continue }
    if (value == null || value === '') continue
    if (f.check && typeof value === 'string' && !CHECKS[f.check](value)) {
      issues.push({ field: f.key, code: 'format', severity: f.check === 'nationalId' ? 'error' : 'warning', message: `${f.en} is invalid` })
    }
    if (f.ref && ctx.refs) {
      const known = ctx.refs[f.ref]
      if (known && !known.has(normalizeKey(String(value)))) {
        issues.push({ field: f.key, code: 'relationship', severity: 'error', message: `${f.en} "${value}" not found` })
      }
    }
    if (f.identity && ctx.existing) {
      const set = ctx.existing[f.key]
      if (set && set.has(normalizeKey(String(value)))) {
        conflict = true
        const res = ctx.resolution ?? 'block'
        if (res === 'block') issues.push({ field: f.key, code: 'duplicate', severity: 'error', message: `${f.en} "${value}" already exists` })
        else issues.push({ field: f.key, code: 'duplicate', severity: 'warning', message: `${f.en} "${value}" exists — will ${res}` })
      }
    }
  }
  // Journal rows must carry exactly one side.
  if (entity === 'journal') {
    const d = Number(record.debit ?? 0), c = Number(record.credit ?? 0)
    if (d === 0 && c === 0) issues.push({ field: 'debit', code: 'business', severity: 'error', message: 'Row needs a debit or a credit' })
    if (d !== 0 && c !== 0) issues.push({ field: 'debit', code: 'business', severity: 'error', message: 'Row cannot carry both sides' })
  }
  const status = issues.some(i => i.severity === 'error') ? 'error' : issues.length ? 'warning' : 'valid'
  return { status, record, issues, conflict }
}

/** Dr = Cr over a set of journal rows (grouped per entry ref by the caller). */
export function journalGroupBalanced(rows: { debit?: number | null; credit?: number | null }[]): { ok: boolean; debit: number; credit: number } {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const debit = r2(rows.reduce((s, r) => s + Number(r.debit ?? 0), 0))
  const credit = r2(rows.reduce((s, r) => s + Number(r.credit ?? 0), 0))
  return { ok: Math.abs(debit - credit) < 0.005 && debit > 0, debit, credit }
}

// ── Approval tiers (M6) ──────────────────────────────────────────────────────
export type ApprovalTier = 'auto' | 'manager' | 'admin'
/** <100 auto · 100–1000 manager · >1000 admin. */
export function approvalTierFor(rowCount: number): ApprovalTier {
  if (rowCount < 100) return 'auto'
  if (rowCount <= 1000) return 'manager'
  return 'admin'
}
/** Which core RBAC roles satisfy a tier. */
export function tierSatisfiedBy(tier: ApprovalTier, role: string): boolean {
  if (tier === 'auto') return ['editor', 'administrator', 'super_admin'].includes(role)
  if (tier === 'manager') return ['administrator', 'super_admin'].includes(role)
  return role === 'super_admin'
}

// ── Job state machine (M7) ───────────────────────────────────────────────────
export const JOB_STATUSES = ['draft', 'mapping', 'validating', 'validated', 'approved', 'processing', 'completed', 'failed', 'rolled_back'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ['mapping', 'validating'],
  mapping: ['validating', 'mapping'],
  validating: ['validated', 'failed'],
  validated: ['approved', 'mapping', 'validating'],
  approved: ['processing'],
  processing: ['completed', 'failed'],
  completed: ['rolled_back'],
  failed: ['mapping', 'validating'],
  rolled_back: [],
}
export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to)
}
