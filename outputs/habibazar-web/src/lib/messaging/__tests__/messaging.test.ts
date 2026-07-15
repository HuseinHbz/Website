/**
 * Phase 26.25s gate 6.1 — multi-channel messaging pure-engine tests: WhatsApp
 * 24h window, telegram chat_id, opt-out, fallback chain, webhook signatures,
 * signed unsubscribe.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { decideSend, whatsappWindowOpen, nextFallbackChannel, backoffSeconds } from '../sendDecision'
import { verifyWhatsappSignature, verifyTelegramSecret, whatsappChallenge, signUnsubscribe, verifyUnsubscribe } from '../webhookVerify'

const now = '2026-07-14T12:00:00.000Z'

describe('WhatsApp 24h window (بند ۴.۳)', () => {
  it('is open inside 24h, closed outside', () => {
    expect(whatsappWindowOpen('2026-07-14T02:00:00.000Z', now)).toBe(true)   // 10h ago
    expect(whatsappWindowOpen('2026-07-12T02:00:00.000Z', now)).toBe(false)  // 58h ago
    expect(whatsappWindowOpen(null, now)).toBe(false)
  })
  it('inside window → free-form allowed', () => {
    expect(decideSend({ channel: 'whatsapp', address: '98912', optedOut: false, lastInboundAt: '2026-07-14T06:00:00.000Z', nowIso: now })).toEqual({ send: true, mode: 'freeform' })
  })
  it('outside window with template → template mode', () => {
    expect(decideSend({ channel: 'whatsapp', address: '98912', optedOut: false, lastInboundAt: null, hasApprovedTemplate: true, nowIso: now })).toEqual({ send: true, mode: 'template' })
  })
  it('outside window, no template → rejected (not blindly attempted)', () => {
    expect(decideSend({ channel: 'whatsapp', address: '98912', optedOut: false, lastInboundAt: null, hasApprovedTemplate: false, nowIso: now })).toEqual({ send: false, reason: 'outside_24h_window_no_template' })
  })
})

describe('telegram + opt-out send decision', () => {
  it('telegram without chat_id → skip with reason', () => {
    expect(decideSend({ channel: 'telegram', address: null, optedOut: false, nowIso: now })).toEqual({ send: false, reason: 'no_chat_id' })
  })
  it('opt-out blocks every channel server-side', () => {
    for (const channel of ['sms', 'email', 'whatsapp', 'telegram'] as const)
      expect(decideSend({ channel, address: 'x', optedOut: true, lastInboundAt: now, hasApprovedTemplate: true, nowIso: now }).send).toBe(false)
  })
  it('sms/email free-form allowed when opted in', () => {
    expect(decideSend({ channel: 'sms', address: '0912', optedOut: false, nowIso: now }).send).toBe(true)
  })
})

describe('fallback chain + backoff (بند ۴.۴)', () => {
  it('returns the next channel only on non-delivery', () => {
    expect(nextFallbackChannel(['whatsapp', 'sms'], 'whatsapp', false)).toBe('sms')
    expect(nextFallbackChannel(['whatsapp', 'sms'], 'whatsapp', true)).toBeNull()
    expect(nextFallbackChannel(['whatsapp', 'sms'], 'sms', false)).toBeNull()
  })
  it('backoff grows exponentially and caps', () => {
    expect(backoffSeconds(0)).toBe(2); expect(backoffSeconds(3)).toBe(16); expect(backoffSeconds(20)).toBe(900)
  })
})

describe('webhook signature verification (بند ۶.۱ security)', () => {
  it('WhatsApp X-Hub-Signature-256 valid/invalid', () => {
    const body = '{"entry":[]}', secret = 'app-secret'
    const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyWhatsappSignature(body, sig, secret)).toBe(true)
    expect(verifyWhatsappSignature(body, sig, 'wrong')).toBe(false)
    expect(verifyWhatsappSignature(body, 'sha256=deadbeef', secret)).toBe(false)
    expect(verifyWhatsappSignature(body, null, secret)).toBe(false)
  })
  it('Telegram secret token compare', () => {
    expect(verifyTelegramSecret('s3cr3t', 's3cr3t')).toBe(true)
    expect(verifyTelegramSecret('nope', 's3cr3t')).toBe(false)
    expect(verifyTelegramSecret(null, 's3cr3t')).toBe(false)
  })
  it('WhatsApp GET challenge echoes only on match', () => {
    expect(whatsappChallenge('subscribe', 'vt', 'CH', 'vt')).toBe('CH')
    expect(whatsappChallenge('subscribe', 'bad', 'CH', 'vt')).toBeNull()
  })
})

describe('signed unsubscribe link (security)', () => {
  it('round-trips and rejects tamper/expiry', () => {
    const t = signUnsubscribe('sms', '09120000000', 'secret')
    expect(verifyUnsubscribe(t, 'secret')?.target).toBe('09120000000')
    expect(verifyUnsubscribe(t, 'other')).toBeNull()
    expect(verifyUnsubscribe(t + 'x', 'secret')).toBeNull()
    const expired = signUnsubscribe('sms', 'x', 'secret', -1)   // already expired
    expect(verifyUnsubscribe(expired, 'secret')).toBeNull()
  })
})
