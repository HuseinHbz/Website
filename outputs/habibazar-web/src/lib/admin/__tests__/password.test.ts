import { describe, it, expect, afterEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { hashPassword, verifyPassword, isBcryptHash } from '../password'
import { rateLimitBypassActive } from '@/lib/rateLimit'

describe('password — scrypt hashing (26.25b بند ۰.۲)', () => {
  it('round-trips: a scrypt hash verifies its own password, rejects a wrong one', async () => {
    const hash = await hashPassword('HBZ@Admin2025!')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(isBcryptHash(hash)).toBe(false)

    const ok = await verifyPassword('HBZ@Admin2025!', hash)
    expect(ok.valid).toBe(true)
    expect(ok.needsRehash).toBe(false) // scrypt is already current — no upgrade

    const bad = await verifyPassword('wrong-password', hash)
    expect(bad.valid).toBe(false)
    expect(bad.needsRehash).toBe(false)
  })

  it('produces a distinct salt per hash (same password → different digest)', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toEqual(b)
    expect((await verifyPassword('same', a)).valid).toBe(true)
    expect((await verifyPassword('same', b)).valid).toBe(true)
  })

  it('back-compat: verifies a LEGACY bcrypt hash and flags needsRehash', async () => {
    const legacy = bcrypt.hashSync('OldPass123', 12)
    expect(isBcryptHash(legacy)).toBe(true)

    const ok = await verifyPassword('OldPass123', legacy)
    expect(ok.valid).toBe(true)
    expect(ok.needsRehash).toBe(true) // must be upgraded to scrypt on next login

    const bad = await verifyPassword('nope', legacy)
    expect(bad.valid).toBe(false)
    expect(bad.needsRehash).toBe(false)
  })

  it('login-with-old-hash → success + the rehashed scrypt still logs in', async () => {
    // simulates signIn(): verify against bcrypt, rehash to scrypt, next login verifies scrypt
    const legacy = bcrypt.hashSync('Migrate!42', 12)
    const first = await verifyPassword('Migrate!42', legacy)
    expect(first.valid && first.needsRehash).toBe(true)

    const upgraded = await hashPassword('Migrate!42') // rehash-on-login
    expect(isBcryptHash(upgraded)).toBe(false)

    const second = await verifyPassword('Migrate!42', upgraded)
    expect(second.valid).toBe(true)
    expect(second.needsRehash).toBe(false)
  })

  it('rejects malformed stored hashes without throwing', async () => {
    for (const junk of ['', 'not-a-hash', 'scrypt$1$2', 'scrypt$x$y$z$aa$bb']) {
      const r = await verifyPassword('x', junk)
      expect(r.valid).toBe(false)
    }
  })
})

describe('rateLimitBypassActive — production hard-gate (26.25b بند ۰.۵)', () => {
  const prev = { flag: process.env.RATE_LIMIT_DISABLED, env: process.env.NODE_ENV }
  afterEach(() => {
    process.env.RATE_LIMIT_DISABLED = prev.flag
    process.env.NODE_ENV = prev.env
  })

  it('is INERT in production even when the flag is set', () => {
    process.env.NODE_ENV = 'production'
    process.env.RATE_LIMIT_DISABLED = '1'
    expect(rateLimitBypassActive()).toBe(false)
  })

  it('is active only in non-production with the flag set', () => {
    process.env.NODE_ENV = 'test'
    process.env.RATE_LIMIT_DISABLED = '1'
    expect(rateLimitBypassActive()).toBe(true)
    process.env.RATE_LIMIT_DISABLED = '0'
    expect(rateLimitBypassActive()).toBe(false)
  })
})
