/**
 * Phase 26.25 — CRM/portal/pilot unit regressions. Pure predicates for the
 * behaviours the phase relies on (journal-delete guard, credit guard, AR aging,
 * portal ownership, campaign opt-out, SLA).
 */
import { describe, it, expect } from 'vitest'
import { isJournalEntryDeletable } from '../ledger'
import { agingBuckets, creditDecision, daysBetween } from '@/lib/crm/aging'
import { normalizeTarget, canSend, campaignReport } from '@/lib/crm/campaign'
import { checkOtp, isSessionValid, ownsResource, sha256, generateOtp, MAX_OTP_ATTEMPTS } from '@/lib/crm/portal'

// ── بند ۰.۴: DELETE journal is draft-only ────────────────────────────────────
describe('journal entry delete guard', () => {
  it('allows deleting a draft', () => expect(isJournalEntryDeletable('draft')).toBe(true))
  it('rejects deleting posted/voided (permanent audit records)', () => {
    expect(isJournalEntryDeletable('posted')).toBe(false)
    expect(isJournalEntryDeletable('void')).toBe(false)
  })
})

// ── بند ۱.۲: AR aging buckets ─────────────────────────────────────────────────
describe('AR aging', () => {
  const asOf = '2026-07-14'
  it('buckets invoices by days past due', () => {
    const b = agingBuckets([
      { outstanding: 100, dueDate: '2026-07-10' },  // 4d → current
      { outstanding: 200, dueDate: '2026-06-01' },  // 43d → 31-60
      { outstanding: 300, dueDate: '2026-05-01' },  // 74d → 61-90
      { outstanding: 400, dueDate: '2026-01-01' },  // 194d → 90+
      { outstanding: 0, dueDate: '2020-01-01' },    // zero ignored
    ], asOf)
    expect(b).toEqual({ current: 100, d31_60: 200, d61_90: 300, d90plus: 400, total: 1000 })
  })
  it('daysBetween is signed whole days', () => expect(daysBetween('2026-07-14', '2026-07-04')).toBe(10))
})

// ── بند ۱.۳: credit guard ─────────────────────────────────────────────────────
describe('credit guard', () => {
  it('no limit (0) → never exceeded, always allowed', () => {
    const d = creditDecision({ creditLimit: 0, currentBalance: 5000, newAmount: 9999, mode: 'block' })
    expect(d.exceeded).toBe(false); expect(d.allowed).toBe(true); expect(d.available).toBe(Infinity)
  })
  it('warn mode → exceeded but still allowed (alert only)', () => {
    const d = creditDecision({ creditLimit: 1000, currentBalance: 800, newAmount: 500, mode: 'warn' })
    expect(d.exceeded).toBe(true); expect(d.allowed).toBe(true); expect(d.projected).toBe(1300)
  })
  it('block mode → exceeded and rejected', () => {
    const d = creditDecision({ creditLimit: 1000, currentBalance: 800, newAmount: 500, mode: 'block' })
    expect(d.exceeded).toBe(true); expect(d.allowed).toBe(false)
  })
  it('within limit → allowed', () => {
    expect(creditDecision({ creditLimit: 1000, currentBalance: 200, newAmount: 300, mode: 'block' }).allowed).toBe(true)
  })
})

// ── بند ۴: campaign opt-out + normalization + report ──────────────────────────
describe('campaign engine', () => {
  it('normalizes Iranian phones to leading-zero form', () => {
    expect(normalizeTarget('sms', '+98 912 345 6789')).toBe('09123456789')
    expect(normalizeTarget('sms', '0098-912-345-6789')).toBe('09123456789')
    expect(normalizeTarget('email', ' Foo@Bar.CoM ')).toBe('foo@bar.com')
  })
  it('opt-out blocks a normalized target (server-side, campaign cannot override)', () => {
    const opt = new Set(['09123456789'])
    expect(canSend('sms', '+989123456789', opt)).toBe(false)
    expect(canSend('sms', '09120000000', opt)).toBe(true)
    expect(canSend('sms', '', opt)).toBe(false)
  })
  it('computes CAC and ROI', () => {
    const r = campaignReport({ sent: 100, failed: 2, skippedOptOut: 5, leads: 20, conversions: 4, wonValue: 10_000_000, cost: 2_000_000 })
    expect(r.cac).toBe(500_000)          // 2M / 4
    expect(r.roi).toBe(4)                 // (10M - 2M) / 2M
  })
})

// ── بند ۲: portal auth primitives ─────────────────────────────────────────────
describe('portal auth', () => {
  const now = '2026-07-14T12:00:00.000Z'
  it('generateOtp is 6 numeric digits', () => expect(generateOtp()).toMatch(/^\d{6}$/))
  it('checkOtp validates hash + expiry + attempts', () => {
    const rec = { otpHash: sha256('123456'), otpExpiresAt: '2026-07-14T12:04:00.000Z', attempts: 0, verified: 0 }
    expect(checkOtp(rec, '123456', now)).toBe('ok')
    expect(checkOtp(rec, '000000', now)).toBe('mismatch')
    expect(checkOtp(rec, '123456', '2026-07-14T12:10:00.000Z')).toBe('expired')
    expect(checkOtp({ ...rec, attempts: MAX_OTP_ATTEMPTS }, '123456', now)).toBe('too_many_attempts')
    expect(checkOtp({ ...rec, otpHash: null }, '123456', now)).toBe('no_pending')
  })
  it('isSessionValid enforces verified + token + expiry + not-revoked', () => {
    const h = sha256('tok')
    const base = { tokenHash: h, verified: 1, revoked: 0, expiresAt: '2026-07-14T20:00:00.000Z' }
    expect(isSessionValid(base, h, now)).toBe(true)
    expect(isSessionValid(base, sha256('other'), now)).toBe(false)
    expect(isSessionValid({ ...base, revoked: 1 }, h, now)).toBe(false)
    expect(isSessionValid({ ...base, expiresAt: '2026-07-14T06:00:00.000Z' }, h, now)).toBe(false)
  })
  it('ownsResource is the IDOR guard', () => {
    expect(ownsResource(7, 7)).toBe(true)
    expect(ownsResource(7, 8)).toBe(false)
    expect(ownsResource(7, null)).toBe(false)
  })
})

// ── 26.25a بند ۰.۳: concurrent-login shed guard ───────────────────────────────
import { shouldShedLogin, MAX_CONCURRENT_LOGINS } from '@/lib/admin/loginGuard'
describe('login concurrency guard (DoS mitigation)', () => {
  it('sheds only at/above the cap', () => {
    expect(shouldShedLogin(0)).toBe(false)
    expect(shouldShedLogin(MAX_CONCURRENT_LOGINS - 1)).toBe(false)
    expect(shouldShedLogin(MAX_CONCURRENT_LOGINS)).toBe(true)
    expect(shouldShedLogin(2, 2)).toBe(true)
  })
})
