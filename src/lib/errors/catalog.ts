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
