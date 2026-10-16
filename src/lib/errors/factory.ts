import { CATALOG } from './catalog'
import type { ErrorCode } from './codes'

export interface BuiltError {
  code: ErrorCode
  httpStatus: number
  severity: string
  module: string
  recoverable: boolean
  recommendedAction?: string
  en: string
  fa: string
}

/** Extract a catalog entry's params type so callers get real autocomplete/type-checking. */
type ParamsOf<C extends ErrorCode> = Parameters<(typeof CATALOG)[C]['en']>[0]

/**
 * Build a fully-shaped bilingual error from a catalog code. Never throws —
 * an unknown code (should be impossible given the ErrorCode union, but this
 * guards a bad string from user input) falls back to ERP-GENERIC-INTERNAL
 * rather than crashing the request.
 */
export function businessError<C extends ErrorCode>(code: C, params: ParamsOf<C>): BuiltError {
  const def = CATALOG[code] ?? CATALOG['ERP-GENERIC-INTERNAL']
  return {
    code: def.code,
    httpStatus: def.httpStatus,
    severity: def.severity,
    module: def.module,
    recoverable: def.recoverable,
    recommendedAction: 'recommendedAction' in def ? def.recommendedAction : undefined,
    // `def` is CATALOG[C] narrowed to the union of every entry's shape (TS
    // can't correlate the generic key with one specific entry), so calling
    // `.en`/`.fa` needs an escape hatch — `unknown` (not `any`) is enough
    // since `params` is already correctly typed as ParamsOf<C> by the
    // public signature above; this only bridges the internal union.
    en: (def.en as (p: unknown) => string)(params),
    fa: (def.fa as (p: unknown) => string)(params),
  }
}

/**
 * ERPFIX-1 — a throwable carrier for a catalog error. Data-layer code (the GL
 * posting core) has no NextResponse to return, so it throws this; `apiError`
 * recognises it and answers with the full bilingual `toApiResponse` shape.
 * `message` stays the catalog's English text so existing callers that read
 * `e.message` keep working unchanged.
 */
export class BusinessErrorException extends Error {
  readonly built: BuiltError
  constructor(built: BuiltError) {
    super(built.en)
    this.name = 'BusinessErrorException'
    this.built = built
  }
}

/** Shorthand: build + throw a catalog error. */
export function throwBusinessError<C extends ErrorCode>(code: C, params: ParamsOf<C>): never {
  throw new BusinessErrorException(businessError(code, params))
}
