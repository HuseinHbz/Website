/**
 * Full-remediation Phase 7 — the stable, machine-readable business-error
 * codes. Adding a code here is additive and safe; RENAMING or REMOVING one
 * is a breaking API change for any client that switches on `error.code`.
 *
 * Naming: ERP-<MODULE>-<CONDITION>, upper-snake, module matches the ERP
 * module the error belongs to (SALES, PURCHASING, INVENTORY, FINANCE,
 * APPROVAL, MOADIAN, ...).
 */
export const ERROR_CODES = [
  'ERP-SALES-CREDIT-LIMIT-EXCEEDED',
  'ERP-SALES-VOID-PAID-INVOICE-BLOCKED',
  'ERP-SALES-CUSTOMER-NOT-FOUND',
  'ERP-FINANCE-JOURNAL-UNBALANCED',
  'ERP-FINANCE-POSTED-ENTRY-IMMUTABLE',
  'ERP-PURCHASING-PAYMENT-BLOCKED-MISMATCH',
  'ERP-GENERIC-VALIDATION-FAILED',
  'ERP-GENERIC-NOT-FOUND',
  'ERP-GENERIC-FORBIDDEN',
  'ERP-GENERIC-UNAUTHORIZED',
  'ERP-GENERIC-INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]
