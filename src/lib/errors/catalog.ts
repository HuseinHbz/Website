import type { ErrorCode } from './codes'

export type Severity = 'info' | 'warning' | 'error' | 'critical'

export interface ErrorDefinition<P extends Record<string, string | number> = Record<string, never>> {
  code: ErrorCode
  httpStatus: number
  severity: Severity
  module: string
  recoverable: boolean
  recommendedAction?: string
  en: (params: P) => string
  fa: (params: P) => string
}

/**
 * The catalog. One entry per code — this is the single source of truth for
 * both languages, so a bilingual message can never drift (the failure mode
 * this phase exists to close: hardcoded English in one code path, hardcoded
 * Persian in another, never both together).
 */
export const CATALOG = {
  'ERP-SALES-CREDIT-LIMIT-EXCEEDED': {
    code: 'ERP-SALES-CREDIT-LIMIT-EXCEEDED',
    httpStatus: 400,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    recommendedAction: 'Increase the customer credit limit, collect an outstanding balance, or switch credit_guard_mode to warn.',
    en: (p: { limit: string; projected: string }) =>
      `Customer credit limit has been exceeded and invoice confirmation was blocked (limit ${p.limit}, projected balance ${p.projected}).`,
    fa: (p: { limit: string; projected: string }) =>
      `سقف اعتبار مشتری (${p.limit}) با مانده پیش‌بینی‌شده ${p.projected} عبور کرده و تایید فاکتور متوقف شد.`,
  },
  'ERP-SALES-CUSTOMER-NOT-FOUND': {
    code: 'ERP-SALES-CUSTOMER-NOT-FOUND',
    httpStatus: 404,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    en: () => 'The selected customer does not exist.',
    fa: () => 'مشتری انتخاب‌شده وجود ندارد.',
  },
  'ERP-SALES-VOID-PAID-INVOICE-BLOCKED': {
    code: 'ERP-SALES-VOID-PAID-INVOICE-BLOCKED',
    httpStatus: 400,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    recommendedAction: 'Issue a return/credit note or a refund first — deleting a settled financial document breaks the audit trail.',
    en: () => 'This invoice has payments recorded against it and cannot be voided directly — issue a return or refund first.',
    fa: () => 'این فاکتور دارای پرداخت ثبت‌شده است و به‌طور مستقیم قابل ابطال نیست — ابتدا برگشت کالا یا استرداد وجه ثبت کنید.',
  },
  'ERP-FINANCE-JOURNAL-UNBALANCED': {
    code: 'ERP-FINANCE-JOURNAL-UNBALANCED',
    httpStatus: 400,
    severity: 'warning',
    module: 'finance',
    recoverable: true,
    en: (p: { reason: string }) => `The journal entry is not balanced and cannot be posted: ${p.reason}`,
    fa: (p: { reason: string }) => `سند حسابداری موازنه ندارد و قابل ثبت نیست: ${p.reason}`,
  },
  'ERP-FINANCE-POSTED-ENTRY-IMMUTABLE': {
    code: 'ERP-FINANCE-POSTED-ENTRY-IMMUTABLE',
    httpStatus: 400,
    severity: 'warning',
    module: 'finance',
    recoverable: true,
    recommendedAction: 'Use a reversal entry instead — a posted/voided journal entry is a permanent audit record.',
    en: () => 'Only draft entries can be deleted — a posted or voided entry is a permanent audit record. Use a reversal instead.',
    fa: () => 'فقط اسناد پیش‌نویس قابل حذف‌اند — سند ثبت‌شده یا باطل‌شده یک رکورد دائمی حسابرسی است. به‌جای آن از سند اصلاحی (reversal) استفاده کنید.',
  },
  'ERP-FINANCE-PERIOD-CLOSED': {
    code: 'ERP-FINANCE-PERIOD-CLOSED',
    httpStatus: 400,
    severity: 'warning',
    module: 'finance',
    recoverable: true,
    recommendedAction: 'Post in an open period, or have an authorised user reopen the period (a locked period can never be reopened).',
    en: (p: { name: string; status: string }) => `Fiscal period "${p.name}" is ${p.status}; postings are not allowed.`,
    fa: (p: { name: string; status: string }) => `دورهٔ مالی «${p.name}» ${p.status === 'locked' ? 'قفل' : 'بسته'} است و ثبت سند در آن مجاز نیست.`,
  },
  'ERP-FINANCE-DATE-OUTSIDE-PERIODS': {
    code: 'ERP-FINANCE-DATE-OUTSIDE-PERIODS',
    httpStatus: 400,
    severity: 'warning',
    module: 'finance',
    recoverable: true,
    recommendedAction: 'Define a fiscal period that covers this date (Finance → Accounting), or set erp_settings.gl_require_period to off.',
    en: (p: { date: string }) => `The date ${p.date} is not inside any defined fiscal period; define a period that covers it before posting.`,
    fa: (p: { date: string }) => `تاریخ ${p.date} در هیچ دورهٔ مالی تعریف‌شده‌ای قرار ندارد؛ پیش از ثبت، دوره‌ای که این تاریخ را پوشش دهد تعریف کنید.`,
  },
  'ERP-FINANCE-INVALID-DATE': {
    code: 'ERP-FINANCE-INVALID-DATE',
    httpStatus: 400,
    severity: 'warning',
    module: 'finance',
    recoverable: true,
    en: (p: { date: string }) => `"${p.date}" is not a valid posting date (expected a real calendar date as YYYY-MM-DD).`,
    fa: (p: { date: string }) => `«${p.date}» تاریخ ثبت معتبری نیست (یک تاریخ واقعی به‌شکل YYYY-MM-DD لازم است).`,
  },
  'ERP-FINANCE-YEAR-ALREADY-CLOSED': {
    code: 'ERP-FINANCE-YEAR-ALREADY-CLOSED',
    httpStatus: 400,
    severity: 'warning',
    module: 'finance',
    recoverable: true,
    recommendedAction: 'Reverse the existing closing entry first if the year really has to be closed again.',
    en: (p: { name: string; entryId: number }) => `Year ${p.name} is already closed (entry #${p.entryId}).`,
    fa: (p: { name: string; entryId: number }) => `سال ${p.name} قبلاً بسته شده است (سند #${p.entryId}).`,
  },
  'ERP-FINANCE-NO-EXCHANGE-RATE': {
    code: 'ERP-FINANCE-NO-EXCHANGE-RATE',
    httpStatus: 400,
    severity: 'warning',
    module: 'finance',
    recoverable: true,
    recommendedAction: 'Set a Rial rate for this currency in Finance → Currency (dated on or before the transaction), or pass an explicit exchange rate.',
    en: (p: { currency: string }) => `No exchange rate is configured for ${p.currency} — set one in Finance → Currency before recording this transaction.`,
    fa: (p: { currency: string }) => `برای ارز ${p.currency} نرخ تبدیلی ثبت نشده است — پیش از ثبت این تراکنش، نرخ را در مالی ← ارز تعریف کنید.`,
  },
  'ERP-FINANCE-PAYMENT-CURRENCY-MISMATCH': {
    code: 'ERP-FINANCE-PAYMENT-CURRENCY-MISMATCH',
    httpStatus: 400,
    severity: 'warning',
    module: 'finance',
    recoverable: true,
    recommendedAction: 'Record the payment in the invoice currency, or pass conversionRate (invoice-currency units per one unit of the payment currency).',
    en: (p: { invoiceCurrency: string; paymentCurrency: string }) => `This invoice is in ${p.invoiceCurrency} but the payment is in ${p.paymentCurrency}; give an explicit conversion rate or pay in ${p.invoiceCurrency}.`,
    fa: (p: { invoiceCurrency: string; paymentCurrency: string }) => `ارز فاکتور ${p.invoiceCurrency} و ارز پرداخت ${p.paymentCurrency} است؛ نرخ تبدیل صریح بدهید یا پرداخت را به ${p.invoiceCurrency} ثبت کنید.`,
  },
  'ERP-PURCHASING-PAYMENT-BLOCKED-MISMATCH': {
    code: 'ERP-PURCHASING-PAYMENT-BLOCKED-MISMATCH',
    httpStatus: 400,
    severity: 'warning',
    module: 'purchasing',
    recoverable: true,
    recommendedAction: 'Resolve the quantity/price/tax mismatch against the purchase order and receipt, or have an administrator override with a recorded reason.',
    en: (p: { reasons: string }) => `This invoice does not match its purchase order/receipt and cannot be paid: ${p.reasons}`,
    fa: (p: { reasons: string }) => `این فاکتور با سفارش خرید/رسید کالا مطابقت ندارد و قابل پرداخت نیست: ${p.reasons}`,
  },
  'ERP-SALES-INSUFFICIENT-STOCK': {
    code: 'ERP-SALES-INSUFFICIENT-STOCK',
    httpStatus: 400,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    recommendedAction: 'Reduce the ordered quantity, choose a different warehouse, or receive more stock before confirming.',
    en: (p: { reason: string }) => `The order cannot be confirmed — not enough available stock to reserve: ${p.reason}`,
    fa: (p: { reason: string }) => `سفارش قابل تایید نیست — موجودی کافی برای رزرو وجود ندارد: ${p.reason}`,
  },
  'ERP-SALES-DELIVERY-EXCEEDS-RESERVATION': {
    code: 'ERP-SALES-DELIVERY-EXCEEDS-RESERVATION',
    httpStatus: 400,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    en: (p: { reason: string }) => `The delivery quantity exceeds what is reserved for this order: ${p.reason}`,
    fa: (p: { reason: string }) => `مقدار تحویل بیشتر از مقدار رزروشده برای این سفارش است: ${p.reason}`,
  },
  'ERP-GENERIC-VALIDATION-FAILED': {
    code: 'ERP-GENERIC-VALIDATION-FAILED',
    httpStatus: 400,
    severity: 'warning',
    module: 'generic',
    recoverable: true,
    en: (p: { detail: string }) => `Validation failed: ${p.detail}`,
    fa: (p: { detail: string }) => `اعتبارسنجی ناموفق بود: ${p.detail}`,
  },
  'ERP-GENERIC-NOT-FOUND': {
    code: 'ERP-GENERIC-NOT-FOUND',
    httpStatus: 404,
    severity: 'info',
    module: 'generic',
    recoverable: false,
    en: () => 'The requested resource was not found.',
    fa: () => 'مورد درخواستی یافت نشد.',
  },
  'ERP-GENERIC-FORBIDDEN': {
    code: 'ERP-GENERIC-FORBIDDEN',
    httpStatus: 403,
    severity: 'warning',
    module: 'generic',
    recoverable: false,
    en: () => 'You do not have permission to perform this action.',
    fa: () => 'شما مجوز انجام این عملیات را ندارید.',
  },
  'ERP-GENERIC-UNAUTHORIZED': {
    code: 'ERP-GENERIC-UNAUTHORIZED',
    httpStatus: 401,
    severity: 'warning',
    module: 'generic',
    recoverable: true,
    en: () => 'Your session has expired. Please sign in again.',
    fa: () => 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
  },
  'ERP-GENERIC-INTERNAL': {
    code: 'ERP-GENERIC-INTERNAL',
    httpStatus: 500,
    severity: 'critical',
    module: 'generic',
    recoverable: false,
    en: () => 'An unexpected error occurred. It has been logged for review.',
    fa: () => 'خطای غیرمنتظره‌ای رخ داد. این خطا برای بررسی ثبت شد.',
  },
} as const

// Each entry above structurally matches ErrorDefinition<P> for its own P
// (verified by TS inference at the call sites in factory.ts). The map as a
// whole isn't annotated as Record<ErrorCode, ErrorDefinition<P>> because
// that would collapse every entry's distinct params type to one shape.
// Coverage against ErrorCode is enforced by the unit test that iterates
// ERROR_CODES against this catalog.
