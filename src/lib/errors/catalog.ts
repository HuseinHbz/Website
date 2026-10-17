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
  'ERP-SALES-INVALID-TRANSITION': {
    code: 'ERP-SALES-INVALID-TRANSITION',
    httpStatus: 409,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    recommendedAction: 'Reload the document — its status has already moved past the operation you attempted.',
    en: (p: { reason: string }) => `This operation is not allowed on the document's current status: ${p.reason}`,
    fa: (p: { reason: string }) => `این عملیات روی وضعیت فعلی سند مجاز نیست: ${p.reason}`,
  },
  'ERP-SALES-VOID-DELIVERED': {
    code: 'ERP-SALES-VOID-DELIVERED',
    httpStatus: 409,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    recommendedAction: 'Return the shipment first, then void the order.',
    en: () => 'This order has an active (non-returned) shipment and cannot be voided directly — return the shipment first.',
    fa: () => 'این سفارش دارای ارسال فعال (غیربرگشتی) است و قابل ابطال مستقیم نیست — ابتدا ارسال را برگشت بزنید.',
  },
  'ERP-SALES-DELETE-NOT-DRAFT': {
    code: 'ERP-SALES-DELETE-NOT-DRAFT',
    httpStatus: 409,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    recommendedAction: 'Void the document instead — it books a balanced reversal and keeps the audit trail.',
    en: () => 'Only a draft document (with no ledger or inventory effect) can be deleted — void it instead.',
    fa: () => 'فقط سند پیش‌نویس (بدون اثر دفتری یا انباری) قابل حذف است — به‌جای آن از ابطال استفاده کنید.',
  },
  'ERP-PURCHASING-INVALID-TRANSITION': {
    code: 'ERP-PURCHASING-INVALID-TRANSITION',
    httpStatus: 409,
    severity: 'warning',
    module: 'purchasing',
    recoverable: true,
    recommendedAction: 'Reload the document — its status does not allow this conversion.',
    en: (p: { reason: string }) => `This conversion is not allowed on the document's current status: ${p.reason}`,
    fa: (p: { reason: string }) => `این تبدیل روی وضعیت فعلی سند مجاز نیست: ${p.reason}`,
  },
  'ERP-PURCHASING-NOTHING-TO-CONVERT': {
    code: 'ERP-PURCHASING-NOTHING-TO-CONVERT',
    httpStatus: 409,
    severity: 'warning',
    module: 'purchasing',
    recoverable: true,
    recommendedAction: 'Every line on this document has already been fully converted downstream.',
    en: () => 'This document has already been fully converted — no remaining quantity to convert.',
    fa: () => 'این سند قبلاً به‌طور کامل تبدیل شده است — مقدار باقی‌مانده‌ای برای تبدیل نیست.',
  },
  'ERP-PURCHASING-DIRECT-PAYMENT-BLOCKED': {
    code: 'ERP-PURCHASING-DIRECT-PAYMENT-BLOCKED',
    httpStatus: 409,
    severity: 'warning',
    module: 'purchasing',
    recoverable: true,
    recommendedAction: 'Use the Treasury payment-order flow for a payment this large.',
    en: (p: { amount: string }) => `A direct purchase payment of ${p.amount} Rial exceeds the allowed direct-payment ceiling — use a Treasury payment order instead.`,
    fa: (p: { amount: string }) => `پرداخت مستقیم خرید به مبلغ ${p.amount} ریال بیش از سقف مجاز پرداخت مستقیم است — از دستور پرداخت خزانه استفاده کنید.`,
  },
  'ERP-PURCHASING-DOC-LOCKED': {
    code: 'ERP-PURCHASING-DOC-LOCKED',
    httpStatus: 409,
    severity: 'warning',
    module: 'purchasing',
    recoverable: true,
    recommendedAction: 'A submitted/approved/received document cannot be edited — only a draft can be changed.',
    en: () => 'This purchase document is no longer a draft and cannot be edited.',
    fa: () => 'این سند خرید دیگر پیش‌نویس نیست و قابل ویرایش نیست.',
  },
  'ERP-SALES-DIRECT-INVOICE-REQUIRES-DELIVERY': {
    code: 'ERP-SALES-DIRECT-INVOICE-REQUIRES-DELIVERY',
    httpStatus: 409,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    recommendedAction: 'Convert from a delivered sales order instead, or deliver this invoice\'s stock first.',
    en: () => 'This invoice has stock lines with no linked delivery — confirm is blocked until the goods are delivered (invoice_stock_mode=require_delivery).',
    fa: () => 'این فاکتور خط کالایی بدون تحویل مرتبط دارد — تا تحویل کالا تأیید مسدود است (invoice_stock_mode=require_delivery).',
  },
  'ERP-SALES-DIRECT-INVOICE-INSUFFICIENT-STOCK': {
    code: 'ERP-SALES-DIRECT-INVOICE-INSUFFICIENT-STOCK',
    httpStatus: 409,
    severity: 'warning',
    module: 'sales',
    recoverable: true,
    recommendedAction: 'Receive more stock, reduce the invoiced quantity, or switch invoice_stock_mode to warn/require_delivery.',
    en: (p: { reason: string }) => `This direct invoice cannot auto-issue stock: ${p.reason}`,
    fa: (p: { reason: string }) => `این فاکتور مستقیم نمی‌تواند موجودی را خودکار خروج بزند: ${p.reason}`,
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
