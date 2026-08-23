/**
 * Full-remediation Phase 7 — centralized bilingual business-error catalog.
 * Every business error should eventually flow through here: a stable code
 * + an English message + a Persian message, in one place, so the two
 * languages can never drift apart (CLAUDE.md rule 18 / RULE-017/018 of the
 * hardening program). Wired first into the sales credit-limit-exceeded
 * path (the master prompt's own worked example) as a real, verified usage
 * — NOT a repo-wide migration of every existing `apiError`/`badRequest`
 * call site, which stays a tracked follow-up (see
 * docs/engineering/full-remediation-plan.json).
 *
 * Usage in an API route:
 *   import { businessError, toApiResponse } from '@/lib/errors'
 *   if (decision.mode === 'block') {
 *     return toApiResponse(businessError('ERP-SALES-CREDIT-LIMIT-EXCEEDED', {
 *       limit: decision.limit.toLocaleString(),
 *       projected: decision.projected.toLocaleString(),
 *     }))
 *   }
 */
export { ERROR_CODES, type ErrorCode } from './codes'
export { CATALOG, type ErrorDefinition, type Severity } from './catalog'
export { businessError, type BuiltError } from './factory'
export { toApiResponse } from './formatter'
