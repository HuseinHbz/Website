import { describe, it, expect } from 'vitest'
import {
  maskSecret, providerStatus, INTEGRATION_KEYS, SECRET_KEYS, INTEGRATION_PROVIDERS,
} from '../integrationSettings'

describe('integration settings (BUG-015) — pure helpers', () => {
  it('masks secrets to a non-reversible last-4 hint', () => {
    expect(maskSecret('sk_live_ABCD1234')).toBe('•••• 1234')
    expect(maskSecret('abc')).toBe('••••')
    expect(maskSecret('')).toBeNull()
    expect(maskSecret(undefined)).toBeNull()
  })
  it('never returns the full secret from maskSecret', () => {
    const secret = 'super-secret-token-9999'
    expect(maskSecret(secret)).not.toContain('super-secret')
    expect(maskSecret(secret)).toBe('•••• 9999')
  })
  it('derives live vs sandbox from the present keys', () => {
    expect(providerStatus(['a', 'b'], new Set(['a', 'b']))).toBe('live')
    expect(providerStatus(['a', 'b'], new Set(['a']))).toBe('sandbox')
    expect(providerStatus([], new Set())).toBe('live')
  })
  it('registry allow-list covers all provider fields; secret set is a subset', () => {
    const allFields = INTEGRATION_PROVIDERS.flatMap(p => p.fields.map(f => f.key))
    expect(new Set(INTEGRATION_KEYS)).toEqual(new Set(allFields))
    for (const k of SECRET_KEYS) expect(INTEGRATION_KEYS).toContain(k)
    // The known secrets are present and non-secret config keys are NOT secret.
    expect(SECRET_KEYS.has('moadian_private_key')).toBe(true)
    expect(SECRET_KEYS.has('whatsapp_token')).toBe(true)
    expect(SECRET_KEYS.has('telegram_bot_token')).toBe(true)
    expect(SECRET_KEYS.has('pay_sandbox')).toBe(false)
    expect(SECRET_KEYS.has('sms_sender')).toBe(false)
    expect(SECRET_KEYS.has('moadian_api_url')).toBe(false)
  })
})
