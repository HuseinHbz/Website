/**
 * Go-Live onboarding checklist (Phase 26.25b بند ۲). READ-ONLY: it inspects the
 * live configuration + data already managed by existing pages and reports what is
 * ready vs incomplete, each with a direct link to the page that fixes it. It never
 * rebuilds any settings UI — it points at the real ones.
 */
import { pgQuery } from '@/lib/db'

export interface ChecklistItem {
  key: string
  labelEn: string; labelFa: string
  ready: boolean
  href: string
  hintEn: string; hintFa: string
  optional?: boolean
}

async function setting(table: 'site_settings' | 'erp_settings', key: string): Promise<string> {
  const r = (await pgQuery<{ value: string }>(`SELECT value FROM ${table} WHERE key=$1`, [key]))[0]
  return (r?.value ?? '').trim()
}
async function count(sql: string): Promise<number> {
  return Number((await pgQuery<{ c: number }>(sql))[0]?.c ?? 0)
}

export async function goLiveChecklist(): Promise<{ items: ChecklistItem[]; readyCount: number; total: number; requiredReady: boolean }> {
  const [companyName, smtpHost, smsToken, kaveToken, zarinpal, moadianKey, usdRate] = await Promise.all([
    setting('site_settings', 'company_name'),
    setting('site_settings', 'smtp_host'),
    setting('site_settings', 'sms_ir_api_key'),
    setting('erp_settings', 'kavenegar_api_key'),
    setting('erp_settings', 'zarinpal_merchant_id'),
    setting('erp_settings', 'moadian_private_key'),
    '', // placeholder for the rate check below
  ])
  const [products, customers, kbPublic, rateRows] = await Promise.all([
    count(`SELECT COUNT(*)::int AS c FROM inv_products WHERE active=1`),
    count(`SELECT COUNT(*)::int AS c FROM sales_customers WHERE active=1`),
    count(`SELECT COUNT(*)::int AS c FROM ai_knowledge_base WHERE portal_public=1 AND active=true`),
    count(`SELECT COUNT(*)::int AS c FROM erp_exchange_rates`),
  ])
  void usdRate

  const items: ChecklistItem[] = [
    { key: 'company', ready: !!companyName, href: '/admin/company', labelEn: 'Company profile & branding', labelFa: 'پروفایل و برند شرکت', hintEn: 'Legal name, registration, logo — printed on every document.', hintFa: 'نام قانونی، ثبت، لوگو — روی هر سند چاپ می‌شود.' },
    { key: 'products', ready: products > 0, href: '/admin/inventory', labelEn: 'At least one product/service', labelFa: 'حداقل یک کالا/خدمت', hintEn: 'Add products so invoices can have lines.', hintFa: 'کالا اضافه کنید تا فاکتور خط داشته باشد.' },
    { key: 'customers', ready: customers > 0, href: '/admin/sales', labelEn: 'At least one customer', labelFa: 'حداقل یک مشتری', hintEn: 'Create a customer to invoice.', hintFa: 'برای صدور فاکتور یک مشتری بسازید.' },
    { key: 'smtp', ready: !!smtpHost, href: '/admin/settings', labelEn: 'Email (SMTP) configured', labelFa: 'ایمیل (SMTP) تنظیم شده', hintEn: 'Needed for portal OTP + document email.', hintFa: 'برای OTP پرتال و ایمیل اسناد لازم است.' },
    { key: 'sms', ready: !!smsToken || !!kaveToken, href: '/admin/settings', labelEn: 'SMS provider configured', labelFa: 'ارائه‌دهنده پیامک تنظیم شده', hintEn: 'SMS.ir or Kavenegar — for portal OTP + campaigns.', hintFa: 'SMS.ir یا کاوه‌نگار — برای OTP و کمپین.' },
    { key: 'payment', ready: !!zarinpal, href: '/admin/settings', labelEn: 'Payment gateway (Zarinpal)', labelFa: 'درگاه پرداخت (زرین‌پال)', hintEn: 'Merchant id for online invoice payment.', hintFa: 'شناسه پذیرنده برای پرداخت آنلاین فاکتور.' },
    { key: 'rates', ready: rateRows > 0, href: '/admin/finance', labelEn: 'Exchange rates set', labelFa: 'نرخ ارز ثبت شده', hintEn: 'Only if you transact in USD/EUR.', hintFa: 'فقط اگر با ارز معامله می‌کنید.', optional: true },
    { key: 'kb', ready: kbPublic > 0, href: '/admin/ai-agents', labelEn: 'Portal help articles published', labelFa: 'مقالات راهنمای پرتال', hintEn: 'Flag KB articles portal_public for the help center.', hintFa: 'مقالات دانش را برای مرکز راهنما عمومی کنید.', optional: true },
    { key: 'moadian', ready: !!moadianKey, href: '/admin/finance', labelEn: 'سامانه مودیان key (Iran e-invoice)', labelFa: 'کلید سامانه مودیان', hintEn: 'Private key + memory id for real submission.', hintFa: 'کلید خصوصی و شناسه حافظه برای ارسال واقعی.', optional: true },
  ]
  const required = items.filter(i => !i.optional)
  const readyCount = items.filter(i => i.ready).length
  return { items, readyCount, total: items.length, requiredReady: required.every(i => i.ready) }
}
