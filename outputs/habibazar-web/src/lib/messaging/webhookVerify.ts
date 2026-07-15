/**
 * Webhook + unsubscribe verification (Phase 26.25s security notes) — PURE crypto
 * helpers. Webhooks are PUBLIC routes: the signature MUST be verified before any
 * body processing, and the opt-out link is HMAC-signed + expiring (never a raw
 * guessable id). All timing-safe.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** WhatsApp Cloud: verify `X-Hub-Signature-256: sha256=<hmac>` over the raw body. */
export function verifyWhatsappSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return safeEq(header, expected)
}

/** Telegram: compare the `X-Telegram-Bot-Api-Secret-Token` header to our secret. */
export function verifyTelegramSecret(header: string | null, secret: string): boolean {
  if (!header || !secret) return false
  return safeEq(header, secret)
}

/** WhatsApp GET verify challenge: echo hub.challenge iff mode+token match. */
export function whatsappChallenge(mode: string | null, token: string | null, challenge: string | null, verifyToken: string): string | null {
  if (mode === 'subscribe' && token && verifyToken && safeEq(token, verifyToken)) return challenge ?? ''
  return null
}

export interface UnsubToken { channel: string; target: string; exp: number }

/** HMAC-signed, expiring opt-out token → `<base64url payload>.<sig>`. */
export function signUnsubscribe(channel: string, target: string, secret: string, ttlDays = 30): string {
  const exp = Date.now() + ttlDays * 86_400_000
  const payload = Buffer.from(JSON.stringify({ channel, target, exp } satisfies UnsubToken)).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** Verify + decode an unsubscribe token; null when tampered or expired. */
export function verifyUnsubscribe(token: string, secret: string, nowMs = Date.now()): UnsubToken | null {
  const [payload, sig] = (token ?? '').split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  if (!safeEq(sig, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as UnsubToken
    if (typeof data.exp !== 'number' || nowMs > data.exp) return null
    return data
  } catch { return null }
}
