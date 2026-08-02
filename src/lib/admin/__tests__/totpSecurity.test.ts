import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret, isEncryptedSecret, generateRecoveryCodes } from '../totpSecurity'

describe('2FA hardening — secret encryption at rest (26.27 بند ۵.۴)', () => {
  it('encrypt → decrypt round-trips', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const stored = encryptSecret(secret)
    expect(stored.startsWith('enc:v1:')).toBe(true)
    expect(stored).not.toContain(secret)
    expect(decryptSecret(stored)).toBe(secret)
  })

  it('legacy plaintext secret passes through decryptSecret unchanged (idempotent migration)', () => {
    expect(decryptSecret('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP')
    expect(isEncryptedSecret('JBSWY3DPEHPK3PXP')).toBe(false)
    expect(isEncryptedSecret(encryptSecret('x'))).toBe(true)
  })

  it('each encryption uses a fresh IV (no deterministic ciphertext)', () => {
    const a = encryptSecret('SECRET')
    const b = encryptSecret('SECRET')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('SECRET')
    expect(decryptSecret(b)).toBe('SECRET')
  })

  it('tampered ciphertext fails authentication (GCM tag)', () => {
    const stored = encryptSecret('SECRET')
    const parts = stored.split(':')
    const data = Buffer.from(parts[4], 'base64url')
    data[0] ^= 0xff
    parts[4] = data.toString('base64url')
    expect(() => decryptSecret(parts.join(':'))).toThrow()
  })
})

describe('recovery codes (26.27 بند ۵.۱)', () => {
  it('generates 10 distinct 10-hex-char codes', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const c of codes) expect(c).toMatch(/^[0-9a-f]{10}$/)
  })
})
