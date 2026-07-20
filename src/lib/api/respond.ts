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

/**
 * Phase 26.27 — tree-RBAC route guard. The permission KEY IS DECLARED IN THE
 * ROUTE FILE (never from a header/URL/body — the spoofable x-pathname design of
 * ADR-002 is rejected). Decision order:
 *   1. explicit tree grants (rbac_user_grants) via the pure engine —
 *      deny-dominates / most-specific-wins / inheritance
 *   2. no explicit grant on the chain → EXACTLY the legacy behaviour the route
 *      had before (requireAdmin(legacyAction)) — R5 absolute backward compat.
 *
 *   const auth = await requirePermission('erp.finance', 'write', 'edit')
 *   if ('error' in auth) return auth.error
 */
export async function requirePermission(
  key: string,
  need: 'read' | 'write',
  legacyAction?: Action,
): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const user = await getAdminUser()
  if (!user) return { error: unauthorized() }
  try {
    const { loadUserRbac } = await import('@/lib/rbac/data')
    const { effectiveLevel, levelSatisfies } = await import('@/lib/rbac/engine')
    const rbac = await loadUserRbac(user.id)
    const level = effectiveLevel(rbac.grants, key)
    if (level !== null) {
      if (!levelSatisfies(level, need)) return { error: forbidden() }
      // an explicit tree grant satisfies the need; the coarse legacy action is
      // superseded for this user (the grant is the more specific instruction)
      return { user }
    }
  } catch {
    // rbac tables unavailable (mid-migration) → legacy path below, never a 500
  }
  if (legacyAction && !canDo(user.role, legacyAction)) return { error: forbidden() }
  return { user }
}

/**
 * Sensitive-op guard (بند ۳): `write` on the module NEVER implies the op.
 * Explicit rbac_user_ops row decides; with no row the legacy coarse action
 * decides exactly as before (R5).
 */
export async function requireOp(
  user: AdminUser,
  opKey: string,
  legacyAction?: Action,
): Promise<NextResponse | null> {
  try {
    const { loadUserRbac } = await import('@/lib/rbac/data')
    const { isOpAllowed } = await import('@/lib/rbac/engine')
    const rbac = await loadUserRbac(user.id)
    const allowed = isOpAllowed(rbac.ops, rbac.grants, opKey)
    if (allowed === true) return null
    if (allowed === false) return forbidden('This operation requires an explicit grant')
  } catch { /* legacy below */ }
  if (legacyAction && !canDo(user.role, legacyAction)) return forbidden()
  return null
}

/**
 * Tree-only check for routes that manage getAdminUser themselves: returns a 403
 * when an explicit tree grant denies/downgrades, null otherwise (no grant →
 * legacy behaviour untouched, R5).
 */
export async function checkTreePermission(user: AdminUser, key: string, need: 'read' | 'write'): Promise<NextResponse | null> {
  try {
    const { loadUserRbac } = await import('@/lib/rbac/data')
    const { effectiveLevel, levelSatisfies } = await import('@/lib/rbac/engine')
    const rbac = await loadUserRbac(user.id)
    const level = effectiveLevel(rbac.grants, key)
    if (level !== null && !levelSatisfies(level, need)) return forbidden()
  } catch { /* mid-migration → legacy */ }
  return null
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
