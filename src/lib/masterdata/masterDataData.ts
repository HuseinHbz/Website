/**
 * Master-Data Governance data layer (Phase 26.16). Reads live customer/supplier/
 * product tables and runs the pure `quality` engine over them: per-domain
 * completeness score, per-record duplicate groups, and cross-module relation
 * integrity. One write op — a safe, transactional customer merge. Read-only
 * everywhere else; reuses existing tables (no new master tables).
 */
import { pgQuery, getPool } from '@/lib/db'
import {
  domainQuality, overallScore, duplicateGroups, duplicateBurden, integritySummary,
  dimensionRollup, isValidEmail, isValidEconomicCode,
  type DomainQuality, type DuplicateGroup, type IntegrityIssue, type IntegritySummary, type FieldCoverage,
  type DimensionScore,
} from './quality'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

// ── Completeness (per domain) ────────────────────────────────────────────────
async function coverage(total: number, spec: { key: string; en: string; fa: string; sql: string }[], where = ''): Promise<FieldCoverage[]> {
  if (total === 0) return spec.map(s => ({ key: s.key, en: s.en, fa: s.fa, present: 0, total: 0 }))
  const out: FieldCoverage[] = []
  for (const s of spec) {
    const r = (await pgQuery<{ v: number }>(`SELECT COUNT(*)::int AS v FROM ${where} WHERE (${s.sql})`))[0]
    out.push({ key: s.key, en: s.en, fa: s.fa, present: r.v, total })
  }
  return out
}

export async function customerQuality(): Promise<DomainQuality> {
  const total = (await pgQuery<{ v: number }>(`SELECT COUNT(*)::int AS v FROM sales_customers`))[0].v
  const fields = await coverage(total, [
    { key: 'email', en: 'Email', fa: 'ایمیل', sql: "email IS NOT NULL AND email<>''" },
    { key: 'phone', en: 'Phone', fa: 'تلفن', sql: "phone IS NOT NULL AND phone<>''" },
    { key: 'taxIdentity', en: 'Tax/National identity', fa: 'شناسه مالیاتی/ملی', sql: "kind<>'company' OR (COALESCE(national_id,'')<>'' OR COALESCE(economic_code,'')<>'')" },
    { key: 'creditLimit', en: 'Credit limit set', fa: 'سقف اعتبار', sql: 'credit_limit > 0' },
  ], 'sales_customers')
  return domainQuality('customers', total, fields)
}

export async function supplierQuality(): Promise<DomainQuality> {
  const total = (await pgQuery<{ v: number }>(`SELECT COUNT(*)::int AS v FROM purchase_vendors`))[0].v
  const fields = await coverage(total, [
    { key: 'contact', en: 'Contact (phone/email)', fa: 'اطلاعات تماس', sql: "COALESCE(email,'')<>'' OR COALESCE(phone,'')<>''" },
    { key: 'economicCode', en: 'Economic code', fa: 'کد اقتصادی', sql: "COALESCE(economic_code,'')<>''" },
    { key: 'iban', en: 'Bank (IBAN)', fa: 'شبا بانکی', sql: "COALESCE(iban,'')<>''" },
  ], 'purchase_vendors')
  return domainQuality('suppliers', total, fields)
}

export async function productQuality(): Promise<DomainQuality> {
  const total = (await pgQuery<{ v: number }>(`SELECT COUNT(*)::int AS v FROM inv_products`))[0].v
  const fields = await coverage(total, [
    { key: 'barcode', en: 'Barcode', fa: 'بارکد', sql: "COALESCE(barcode,'')<>''" },
    { key: 'nameFa', en: 'Persian name', fa: 'نام فارسی', sql: "COALESCE(name_fa,'')<>''" },
    { key: 'category', en: 'Category assigned', fa: 'دسته‌بندی', sql: "COALESCE(category,'')<>'' AND category<>'general'" },
    { key: 'supplier', en: 'Default supplier', fa: 'تأمین‌کننده پیش‌فرض', sql: 'default_supplier_id IS NOT NULL' },
  ], 'inv_products')
  return domainQuality('products', total, fields)
}

// ── Duplicate detection (per identity key) ───────────────────────────────────
export async function detectDuplicates(): Promise<{ groups: DuplicateGroup[]; burden: number }> {
  // Detection considers only *active* records — a merged/archived duplicate is
  // already resolved and shouldn't resurface as an actionable duplicate.
  const custs = await pgQuery<{ id: number; name: string; national_id: string | null; phone: string | null; email: string | null }>(
    `SELECT id, name, national_id, phone, email FROM sales_customers WHERE active=1`)
  const vendors = await pgQuery<{ id: number; name: string; economic_code: string | null; tax_id: string | null }>(
    `SELECT id, name, economic_code, tax_id FROM purchase_vendors WHERE active=true`)
  const products = await pgQuery<{ id: number; name_en: string; sku: string | null; barcode: string | null }>(
    `SELECT id, name_en, sku, barcode FROM inv_products WHERE active=1`)
  const groups: DuplicateGroup[] = [
    ...duplicateGroups(custs, 'customer.national_id', r => r.national_id, r => r.id, r => r.name),
    ...duplicateGroups(custs, 'customer.phone', r => r.phone, r => r.id, r => r.name),
    ...duplicateGroups(custs, 'customer.email', r => r.email, r => r.id, r => r.name),
    ...duplicateGroups(vendors, 'supplier.economic_code', r => r.economic_code, r => r.id, r => r.name),
    ...duplicateGroups(vendors, 'supplier.tax_id', r => r.tax_id, r => r.id, r => r.name),
    ...duplicateGroups(products, 'product.sku', r => r.sku, r => r.id, r => r.name_en),
    ...duplicateGroups(products, 'product.barcode', r => r.barcode, r => r.id, r => r.name_en),
  ]
  return { groups, burden: duplicateBurden(groups) }
}

// ── Relation integrity (business checks FKs don't enforce) ────────────────────
export async function relationIntegrity(): Promise<IntegritySummary> {
  const one = async (sql: string) => (await pgQuery<{ v: number }>(sql))[0].v
  const issues: IntegrityIssue[] = [
    { code: 'product_no_stock', severity: 'warning', en: 'Products with no stock in any warehouse', fa: 'کالاهای بدون موجودی در هیچ انباری', count:
      await one(`SELECT COUNT(*)::int AS v FROM inv_products p WHERE active=1 AND COALESCE((SELECT SUM(qty) FROM inv_moves m WHERE m.product_id=p.id),0) <= 0`) },
    { code: 'product_no_supplier', severity: 'recommendation', en: 'Active products without a default supplier', fa: 'کالاهای فعال بدون تأمین‌کننده پیش‌فرض', count:
      await one(`SELECT COUNT(*)::int AS v FROM inv_products WHERE active=1 AND default_supplier_id IS NULL`) },
    { code: 'product_dangling_supplier', severity: 'error', en: 'Products whose default supplier no longer exists', fa: 'کالاهایی که تأمین‌کننده پیش‌فرض‌شان حذف شده', count:
      await one(`SELECT COUNT(*)::int AS v FROM inv_products p WHERE default_supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM purchase_vendors v WHERE v.id=p.default_supplier_id)`) },
    { code: 'product_no_category', severity: 'warning', en: 'Products without a real category', fa: 'کالاهای بدون دسته‌بندی واقعی', count:
      await one(`SELECT COUNT(*)::int AS v FROM inv_products WHERE active=1 AND (COALESCE(category,'')='' OR category='general')`) },
    { code: 'customer_over_limit', severity: 'warning', en: 'Active customers over their credit limit', fa: 'مشتریان فعال بالای سقف اعتبار', count:
      await one(`SELECT COUNT(*)::int AS v FROM sales_customers c WHERE c.active=1 AND c.credit_limit > 0 AND (
        COALESCE((SELECT SUM(CASE WHEN doc_type IN ('invoice','debit_note') THEN total WHEN doc_type='credit_note' THEN -total ELSE 0 END) FROM sales_documents d WHERE d.customer_id=c.id AND d.status<>'void' AND d.deleted_at IS NULL),0)
        - COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.customer_id=c.id),0)) > c.credit_limit`) },
    { code: 'customer_inactive_open', severity: 'warning', en: 'Inactive customers with an open balance', fa: 'مشتریان غیرفعال با مانده باز', count:
      await one(`SELECT COUNT(*)::int AS v FROM sales_customers c WHERE c.active=0 AND (
        COALESCE((SELECT SUM(CASE WHEN doc_type IN ('invoice','debit_note') THEN total WHEN doc_type='credit_note' THEN -total ELSE 0 END) FROM sales_documents d WHERE d.customer_id=c.id AND d.status<>'void' AND d.deleted_at IS NULL),0)
        - COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.customer_id=c.id),0)) > 0`) },
    { code: 'company_customer_no_tax', severity: 'warning', en: 'Company customers with invoices but no tax identity', fa: 'مشتریان حقوقی دارای فاکتور بدون شناسه مالیاتی', count:
      await one(`SELECT COUNT(*)::int AS v FROM sales_customers c WHERE c.kind='company' AND COALESCE(c.national_id,'')='' AND COALESCE(c.economic_code,'')=''
        AND EXISTS (SELECT 1 FROM sales_documents d WHERE d.customer_id=c.id AND d.doc_type='invoice' AND d.status<>'void')`) },
    { code: 'purchase_no_vendor', severity: 'error', en: 'Purchase documents without a supplier', fa: 'اسناد خرید بدون تأمین‌کننده', count:
      await one(`SELECT COUNT(*)::int AS v FROM purchase_documents WHERE vendor_id IS NULL`) },
  ]
  return integritySummary(issues)
}

// ── Overview (assemble) ──────────────────────────────────────────────────────
export interface MasterDataOverview {
  domains: DomainQuality[]
  overall: number
  duplicates: { total: number; burden: number }
  integrity: { score: number; errors: number; warnings: number; recommendations: number }
}
export async function masterDataOverview(): Promise<MasterDataOverview> {
  const [customers, suppliers, products] = await Promise.all([customerQuality(), supplierQuality(), productQuality()])
  const dupes = await detectDuplicates()
  const integ = await relationIntegrity()
  const domains = [customers, suppliers, products]
  return {
    domains,
    overall: overallScore(domains),
    duplicates: { total: dupes.groups.length, burden: dupes.burden },
    integrity: { score: integ.score, errors: integ.errors, warnings: integ.warnings, recommendations: integ.recommendations },
  }
}

// ── Customer merge (the one write op) ────────────────────────────────────────
// Repoints the financial children of `duplicateId` onto `primaryId` in a single
// transaction, then archives the duplicate (active=0). Safe + reversible-audited.
export async function mergeCustomers(primaryId: number, duplicateId: number): Promise<{ movedDocuments: number; movedPayments: number }> {
  if (primaryId === duplicateId) throw new Error('Cannot merge a customer into itself')
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const exists = await client.query(`SELECT id FROM sales_customers WHERE id = ANY($1)`, [[primaryId, duplicateId]])
    if (exists.rows.length !== 2) throw new Error('Both customers must exist')
    const d = await client.query(`UPDATE sales_documents SET customer_id=$1 WHERE customer_id=$2`, [primaryId, duplicateId])
    const p = await client.query(`UPDATE sales_payments SET customer_id=$1 WHERE customer_id=$2`, [primaryId, duplicateId])
    await client.query(`UPDATE sales_customers SET active=0, updated_at=${NOW} WHERE id=$1`, [duplicateId])
    await client.query('COMMIT')
    return { movedDocuments: d.rowCount ?? 0, movedPayments: p.rowCount ?? 0 }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ── M7: five-dimension data quality per domain (Phase 26.17) ─────────────────
const pctOf = (a: number, b: number) => (b <= 0 ? 100 : Math.round((a / b) * 100))

export async function qualityDimensions(): Promise<{ domain: string; dimensions: DimensionScore[]; score: number }[]> {
  const out: { domain: string; dimensions: DimensionScore[]; score: number }[] = []

  // Customers: completeness (reuse), validity (email + economic code), uniqueness, relationship.
  const cq = await customerQuality()
  const custTotal = (await pgQuery<{ v: number }>(`SELECT COUNT(*)::int AS v FROM sales_customers`))[0].v
  const custEmails = await pgQuery<{ email: string | null }>(`SELECT email FROM sales_customers WHERE COALESCE(email,'')<>''`)
  const validEmail = custEmails.filter(r => isValidEmail(r.email)).length
  const custEco = await pgQuery<{ economic_code: string | null }>(`SELECT economic_code FROM sales_customers WHERE kind='company' AND COALESCE(economic_code,'')<>''`)
  const validEco = custEco.filter(r => isValidEconomicCode(r.economic_code)).length
  const validityCust = Math.round(((custEmails.length ? pctOf(validEmail, custEmails.length) : 100) + (custEco.length ? pctOf(validEco, custEco.length) : 100)) / 2)
  const dupes = await detectDuplicates()
  const custDupBurden = dupes.groups.filter(g => g.keyType.startsWith('customer.')).reduce((s, g) => s + (g.members.length - 1), 0)
  const uniquenessCust = custTotal ? Math.max(0, 100 - Math.round((custDupBurden / custTotal) * 100)) : 100
  const integ = await relationIntegrity()
  out.push(dims('customers', [
    { dimension: 'completeness', score: cq.score, issues: cq.fields.reduce((s, f) => s + f.missing, 0) },
    { dimension: 'validity', score: validityCust, issues: (custEmails.length - validEmail) + (custEco.length - validEco) },
    { dimension: 'uniqueness', score: uniquenessCust, issues: custDupBurden },
    { dimension: 'relationship', score: integ.score, issues: integ.errors + integ.warnings },
  ]))

  const sq = await supplierQuality()
  const supDupBurden = dupes.groups.filter(g => g.keyType.startsWith('supplier.')).reduce((s, g) => s + (g.members.length - 1), 0)
  const supTotal = (await pgQuery<{ v: number }>(`SELECT COUNT(*)::int AS v FROM purchase_vendors`))[0].v
  out.push(dims('suppliers', [
    { dimension: 'completeness', score: sq.score, issues: sq.fields.reduce((s, f) => s + f.missing, 0) },
    { dimension: 'uniqueness', score: supTotal ? Math.max(0, 100 - Math.round((supDupBurden / supTotal) * 100)) : 100, issues: supDupBurden },
    { dimension: 'relationship', score: integ.score, issues: integ.errors },
  ]))

  const pq = await productQuality()
  const prodDupBurden = dupes.groups.filter(g => g.keyType.startsWith('product.')).reduce((s, g) => s + (g.members.length - 1), 0)
  const prodTotal = (await pgQuery<{ v: number }>(`SELECT COUNT(*)::int AS v FROM inv_products`))[0].v
  out.push(dims('products', [
    { dimension: 'completeness', score: pq.score, issues: pq.fields.reduce((s, f) => s + f.missing, 0) },
    { dimension: 'uniqueness', score: prodTotal ? Math.max(0, 100 - Math.round((prodDupBurden / prodTotal) * 100)) : 100, issues: prodDupBurden },
    { dimension: 'relationship', score: integ.score, issues: integ.errors + integ.warnings },
  ]))
  return out
}

function dims(domain: string, dimensions: DimensionScore[]) {
  return { domain, dimensions, score: dimensionRollup(dimensions) }
}

// ── M5: data-steward issue queue (assign / resolve / ignore) ─────────────────
export interface StewardIssue { id: number; issueKey: string; entityType: string; titleEn: string; titleFa: string | null; severity: string; status: string; assignedTo: string | null; resolutionNote: string | null; createdAt: string }

/** Materialise the live scan into the issue queue (idempotent by issue_key). */
export async function generateIssues(userId?: string): Promise<{ created: number }> {
  const integ = await relationIntegrity()
  const dupes = await detectDuplicates()
  const candidates: { key: string; entity: string; en: string; fa: string; sev: string }[] = [
    ...integ.issues.map(i => ({ key: `integrity.${i.code}`, entity: 'relation', en: `${i.en} (${i.count})`, fa: `${i.fa} (${i.count})`, sev: i.severity })),
    ...(dupes.groups.length ? [{ key: 'duplicate.records', entity: 'duplicate', en: `${dupes.groups.length} duplicate group(s)`, fa: `${dupes.groups.length} گروه تکراری`, sev: 'warning' }] : []),
  ]
  let created = 0
  for (const c of candidates) {
    const exists = (await pgQuery(`SELECT id FROM master_data_issues WHERE issue_key=$1 AND status='open'`, [c.key]))[0]
    if (exists) continue
    await pgQuery(
      `INSERT INTO master_data_issues (issue_key, entity_type, title_en, title_fa, severity, status, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'open',$6,${NOW},${NOW})`, [c.key, c.entity, c.en, c.fa, c.sev, userId ?? null])
    created++
  }
  return { created }
}

export async function listIssues(status?: string): Promise<StewardIssue[]> {
  return pgQuery<StewardIssue>(
    `SELECT id, issue_key AS "issueKey", entity_type AS "entityType", title_en AS "titleEn", title_fa AS "titleFa", severity, status, assigned_to AS "assignedTo", resolution_note AS "resolutionNote", created_at AS "createdAt"
     FROM master_data_issues ${status && status !== 'all' ? 'WHERE status=$1' : ''} ORDER BY created_at DESC LIMIT 500`, status && status !== 'all' ? [status] : [])
}

export async function updateIssue(id: number, action: 'assign' | 'resolve' | 'ignore', value?: string): Promise<void> {
  if (action === 'assign') await pgQuery(`UPDATE master_data_issues SET assigned_to=$2, status='in_progress', updated_at=${NOW} WHERE id=$1`, [id, value ?? null])
  else if (action === 'resolve') await pgQuery(`UPDATE master_data_issues SET status='resolved', resolution_note=$2, updated_at=${NOW} WHERE id=$1`, [id, value ?? null])
  else await pgQuery(`UPDATE master_data_issues SET status='ignored', resolution_note=$2, updated_at=${NOW} WHERE id=$1`, [id, value ?? null])
}
