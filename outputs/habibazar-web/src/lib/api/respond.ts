import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { getAdminUser, canDo, type AdminUser } from '@/lib/admin/auth'

// Generic 500 — never leak internal error messages to the client. The real
// error is logged server-side (visible in /admin/logs-monitoring).
export function apiError(e: unknown, message = 'Internal server error', status = 500) {
  if (e instanceof BodyError) return NextResponse.json({ error: e.message }, { status: 400 })
  logger.error(message, { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined })
  return NextResponse.json({ error: message }, { status })
}

export function badRequest(message = 'Bad request') {
  return NextResponse.json({ error: message }, { status: 400 })
}
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}
export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

type Action = Parameters<typeof canDo>[1]

/**
 * Enforce that a valid, active admin (with a live DB session) is making the
 * request — closes the gap where a revoked/deactivated session's unexpired JWT
 * could still write. Optionally enforce an RBAC action.
 *
 *   const auth = await requireAdmin('delete')
 *   if ('error' in auth) return auth.error
 *   const user = auth.user
 */
export async function requireAdmin(action?: Action): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const user = await getAdminUser()
  if (!user) return { error: unauthorized() }
  if (action && !canDo(user.role, action)) return { error: forbidden() }
  return { user }
}

/** Thrown by guardJson; apiError maps it to a 400 instead of a generic 500. */
export class BodyError extends Error {}

const MAX_BODY_BYTES = 512 * 1024   // 512 KB — CMS bodies incl. base64-free content
const MAX_DEPTH = 10
const MAX_ARRAY = 5000
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function assertSafe(v: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) throw new BodyError('Body too deeply nested')
  if (Array.isArray(v)) {
    if (v.length > MAX_ARRAY) throw new BodyError('Array too large')
    for (const x of v) assertSafe(x, depth + 1)
    return
  }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) throw new BodyError('Illegal key in body')
      assertSafe((v as Record<string, unknown>)[k], depth + 1)
    }
  }
}

/**
 * Structural guard for legacy CMS routes that accept flexible bodies (Phase 26
 * hardening): enforces a JSON object/array, a hard size cap, bounded nesting
 * depth and array sizes, and rejects prototype-pollution keys. Throws BodyError
 * (→ 400 via apiError). New routes should prefer `readJson` with a zod schema.
 */
// The default type parameter mirrors Response.json()'s `any` so the 44 legacy
// call sites keep their existing inference — the value added here is the
// RUNTIME guard; compile-time safety for new routes comes from readJson + zod.
export async function guardJson<T = any>(req: Request): Promise<T> {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > MAX_BODY_BYTES) throw new BodyError('Body too large')
  let text: string
  try { text = await req.text() } catch { throw new BodyError('Unreadable body') }
  if (text.length > MAX_BODY_BYTES) throw new BodyError('Body too large')
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new BodyError('Invalid JSON body') }
  if (raw === null || (typeof raw !== 'object')) throw new BodyError('Body must be a JSON object')
  assertSafe(raw)
  return raw as T
}

/** Parse + zod-validate a JSON body. Returns data or a 400 response. */
export async function readJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { error: badRequest('Invalid JSON body') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: badRequest(first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Validation failed') }
  }
  return { data: parsed.data }
}
