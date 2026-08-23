import { NextResponse } from 'next/server'
import type { BuiltError } from './factory'

/**
 * Shape a BuiltError into the JSON response. `error` stays the existing
 * English-message field every current admin manager/client already reads
 * (`res.error`/`crud.errorOf`) — zero breaking change. `error_fa`/`code`/
 * `severity`/`recoverable` are additive, for any caller that wants them.
 * Never includes a raw stack trace, SQL detail, or internal implementation
 * detail — only the catalog's own bilingual text.
 */
export function toApiResponse(err: BuiltError): NextResponse {
  return NextResponse.json(
    {
      error: err.en,
      error_fa: err.fa,
      code: err.code,
      severity: err.severity,
      recoverable: err.recoverable,
    },
    { status: err.httpStatus },
  )
}
