import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

/**
 * Standard Persian-facing API error contract for the media/upload surface
 * (Mission: فارسی‌سازی پیام‌ها و خطاها). Every admin-visible upload error
 * uses this shape so the panel can show a Persian, actionable message with
 * a stable English `errorCode` (for logs/debugging) and a `requestId` that
 * ties the client-visible failure to the exact server log line — without
 * ever leaking the raw internal error (stack trace, path, SQL, secrets) to
 * the client. The raw cause is still logged server-side via `logFa`.
 */
export type ApiErrorResponse = {
  success: false
  errorCode: string
  messageFa: string
  requestId: string
  stage?: string
  fieldErrors?: Record<string, string>
  retryable?: boolean
}

export function newRequestId(): string {
  return randomUUID()
}

export function apiErrorFa(
  status: number,
  errorCode: string,
  messageFa: string,
  opts: { stage?: string; fieldErrors?: Record<string, string>; retryable?: boolean; requestId?: string } = {},
): NextResponse<ApiErrorResponse> {
  const requestId = opts.requestId ?? newRequestId()
  return NextResponse.json<ApiErrorResponse>({
    success: false,
    errorCode,
    messageFa,
    requestId,
    stage: opts.stage,
    fieldErrors: opts.fieldErrors,
    retryable: opts.retryable,
  }, { status })
}

/** Structured server-side log line — Persian event/status text for a human
 *  scanning logs, a stable English errorCode for grep/alerting, and the
 *  real cause attached (never sent to the client). */
export function logFa(event: string, errorCode: string, messageFa: string, requestId: string, cause?: unknown) {
  console.error(JSON.stringify({
    event, status: 'ناموفق', errorCode, messageFa, requestId,
    cause: cause instanceof Error ? cause.message : cause ? String(cause) : undefined,
  }))
}
