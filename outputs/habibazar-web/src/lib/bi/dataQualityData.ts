/**
 * Data governance data layer (Phase 26.13, M9). Runs real COUNT checks over the
 * live ERP tables (missing customer/supplier data, invalid documents, duplicate
 * records, currency inconsistency) and feeds the pure `dataQuality` engine for a
 * score + graded issue list + fix suggestions. Snapshots into data_quality_checks.
 */
import { pgQuery } from '@/lib/db'
import { qualityReport, type QualityCheck } from './dataQuality'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

async function count(sql: string): Promise<number> { try { return Number((await pgQuery<{ v: number }>(sql))[0]?.v ?? 0) } catch { return 0 } }

interface CheckDef { key: string; en: string; fa: string; severity: QualityCheck['severity']; affected: string; total: string; sugEn: string; sugFa: string }

const CHECKS: CheckDef[] = [
  { key: 'customer_no_email', en: 'Customers missing email', fa: 'مشتریان بدون ایمیل', severity: 'medium',
    affected: `SELECT COUNT(*)::int AS v FROM sales_customers WHERE email IS NULL OR email=''`, total: `SELECT COUNT(*)::int AS v FROM sales_customers`,
    sugEn: 'Collect a contact email for each customer.', sugFa: 'برای هر مشتری ایمیل ثبت کنید.' },
  { key: 'customer_no_id', en: 'Company customers missing national/economic ID', fa: 'مشتریان حقوقی بدون شناسه/کداقتصادی', severity: 'high',
    affected: `SELECT COUNT(*)::int AS v FROM sales_customers WHERE kind='company' AND (national_id IS NULL OR national_id='') AND (economic_code IS NULL OR economic_code='')`, total: `SELECT COUNT(*)::int AS v FROM sales_customers WHERE kind='company'`,
    sugEn: 'Add legal identifiers required on tax invoices.', sugFa: 'شناسه‌های حقوقی لازم برای فاکتور مالیاتی را کامل کنید.' },
  { key: 'vendor_no_contact', en: 'Suppliers missing contact info', fa: 'تأمین‌کنندگان بدون اطلاعات تماس', severity: 'medium',
    affected: `SELECT COUNT(*)::int AS v FROM purchase_vendors WHERE (email IS NULL OR email='') AND (phone IS NULL OR phone='')`, total: `SELECT COUNT(*)::int AS v FROM purchase_vendors`,
    sugEn: 'Record a phone or email for each supplier.', sugFa: 'برای هر تأمین‌کننده تلفن یا ایمیل ثبت کنید.' },
  { key: 'invoice_zero_total', en: 'Invoices with zero total', fa: 'فاکتورهای با مبلغ صفر', severity: 'high',
    affected: `SELECT COUNT(*)::int AS v FROM sales_documents WHERE doc_type='invoice' AND status<>'void' AND total<=0`, total: `SELECT COUNT(*)::int AS v FROM sales_documents WHERE doc_type='invoice' AND status<>'void'`,
    sugEn: 'Review invoices with no amount — likely incomplete.', sugFa: 'فاکتورهای بدون مبلغ را بررسی کنید.' },
  { key: 'duplicate_customer', en: 'Duplicate customer names', fa: 'نام مشتری تکراری', severity: 'medium',
    affected: `SELECT COALESCE(SUM(c-1),0)::int AS v FROM (SELECT COUNT(*) AS c FROM sales_customers GROUP BY lower(name) HAVING COUNT(*)>1) t`, total: `SELECT COUNT(*)::int AS v FROM sales_customers`,
    sugEn: 'Merge duplicate customer records.', sugFa: 'رکوردهای تکراری مشتری را ادغام کنید.' },
  { key: 'currency_missing', en: 'Documents with missing currency', fa: 'اسناد بدون ارز', severity: 'low',
    affected: `SELECT COUNT(*)::int AS v FROM sales_documents WHERE currency IS NULL OR currency=''`, total: `SELECT COUNT(*)::int AS v FROM sales_documents`,
    sugEn: 'Ensure every document carries a currency code.', sugFa: 'برای هر سند کد ارز ثبت شود.' },
]

export async function runDataQuality(): Promise<ReturnType<typeof qualityReport>> {
  const checks: QualityCheck[] = []
  for (const c of CHECKS) {
    const affected = await count(c.affected)
    const total = await count(c.total)
    checks.push({ key: c.key, labelEn: c.en, labelFa: c.fa, affected, total, severity: c.severity, suggestionEn: c.sugEn, suggestionFa: c.sugFa })
    await pgQuery(`INSERT INTO data_quality_checks (check_key, label_en, label_fa, severity, affected, total, last_run) VALUES ($1,$2,$3,$4,$5,$6,${NOW})
      ON CONFLICT (check_key) DO UPDATE SET affected=EXCLUDED.affected, total=EXCLUDED.total, last_run=${NOW}`,
      [c.key, c.en, c.fa, c.severity, affected, total])
  }
  return qualityReport(checks)
}
