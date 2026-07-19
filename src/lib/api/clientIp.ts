/**
 * Best-effort client IP for the audit trail (Phase 26.9, Task 11).
 * Behind nginx the real IP arrives in x-forwarded-for / x-real-ip; falls back
 * to the platform-provided address. Returns undefined when unknown (audit
 * still records the event, just without an IP) — never throws.
 */
import type { NextRequest } from 'next/server'

export function clientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || undefined
}
