import { describe, it, expect } from 'vitest'
import { toKebabSlug, uniqueFilename, validateAssetName } from '../slug'

describe('toKebabSlug', () => {
  it('converts a normal English name to kebab-case', () => {
    expect(toKebabSlug('Firewall Packet Inspection')).toBe('firewall-packet-inspection')
  })
  it('collapses punctuation and repeated separators', () => {
    expect(toKebabSlug('SD-WAN  Multi--Site!!')).toBe('sd-wan-multi-site')
  })
  it('trims leading/trailing separators', () => {
    expect(toKebabSlug('  -Hello World-  ')).toBe('hello-world')
  })
  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(200)
    expect(toKebabSlug(long).length).toBe(80)
  })
})

describe('uniqueFilename', () => {
  it('returns the plain name when there is no conflict', () => {
    expect(uniqueFilename('hero-topology', 'mp4', new Set())).toBe('hero-topology.mp4')
  })
  it('appends -2 on the first conflict (the spec-mandated pattern)', () => {
    expect(uniqueFilename('hero-topology', 'mp4', new Set(['hero-topology.mp4']))).toBe('hero-topology-2.mp4')
  })
  it('keeps incrementing past multiple existing conflicts', () => {
    const existing = new Set(['x.png', 'x-2.png', 'x-3.png'])
    expect(uniqueFilename('x', 'png', existing)).toBe('x-4.png')
  })
})

describe('validateAssetName', () => {
  it('rejects a name under 2 characters', () => {
    expect(validateAssetName('a', 'English name').ok).toBe(false)
  })
  it('rejects a name over 80 characters', () => {
    expect(validateAssetName('a'.repeat(81), 'English name').ok).toBe(false)
  })
  it('accepts a name within 2–80 characters', () => {
    expect(validateAssetName('Firewall', 'English name').ok).toBe(true)
  })
  it('treats whitespace-only padding as trimmed for the length check', () => {
    expect(validateAssetName('  ab  ', 'English name').ok).toBe(true)
    expect(validateAssetName('  a  ', 'English name').ok).toBe(false)
  })
})
