import { describe, it, expect } from 'vitest'
import { sniffImageType, sanitizeSvg, validateLogoUpload, extensionFor, MAX_LOGO_BYTES } from '../fileValidation'

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const WEBP_HEADER = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)])
const ICO_HEADER = Buffer.from([0x00, 0x00, 0x01, 0x00, 0, 0, 0, 0])

describe('sniffImageType', () => {
  it('detects PNG by magic bytes regardless of extension', () => {
    expect(sniffImageType(PNG_HEADER)).toBe('png')
  })
  it('detects WebP (RIFF....WEBP)', () => {
    expect(sniffImageType(WEBP_HEADER)).toBe('webp')
  })
  it('detects ICO', () => {
    expect(sniffImageType(ICO_HEADER)).toBe('ico')
  })
  it('detects a plain SVG', () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'))).toBe('svg')
  })
  it('detects an SVG with an XML prolog', () => {
    expect(sniffImageType(Buffer.from('<?xml version="1.0"?>\n<svg><rect/></svg>'))).toBe('svg')
  })
  it('rejects a renamed executable (no real image signature)', () => {
    const fakeExe = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(20)]) // "MZ" DOS header
    expect(sniffImageType(fakeExe)).toBeNull()
  })
  it('rejects a JPEG (not in the accepted logo formats)', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
    expect(sniffImageType(jpeg)).toBeNull()
  })
  it('rejects plain text pretending to be an image', () => {
    expect(sniffImageType(Buffer.from('hello world, not an image'))).toBeNull()
  })
})

describe('sanitizeSvg', () => {
  it('passes through a clean SVG unchanged in structure', () => {
    const clean = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
    const out = sanitizeSvg(clean)
    expect(out).toContain('<svg')
    expect(out).toContain('<circle')
  })
  it('strips <script> tags', () => {
    const evil = '<svg><script>alert(1)</script><rect/></svg>'
    const out = sanitizeSvg(evil)
    expect(out).not.toBeNull()
    expect(out).not.toMatch(/<script/i)
  })
  it('strips onload/onclick event-handler attributes', () => {
    const evil = '<svg onload="alert(1)"><rect onclick="evil()"/></svg>'
    const out = sanitizeSvg(evil)
    expect(out).not.toBeNull()
    expect(out).not.toMatch(/on\w+\s*=/i)
  })
  it('strips javascript: hrefs', () => {
    const evil = '<svg><a href="javascript:alert(1)"><rect/></a></svg>'
    const out = sanitizeSvg(evil)
    expect(out).not.toBeNull()
    expect(out).not.toMatch(/javascript:/i)
  })
  it('strips <foreignObject> (can embed arbitrary HTML/script)', () => {
    const evil = '<svg><foreignObject><body onload="x()"></body></foreignObject></svg>'
    const out = sanitizeSvg(evil)
    expect(out).not.toBeNull()
    expect(out).not.toMatch(/foreignObject/i)
  })
  it('rejects a file with a DOCTYPE/ENTITY (XXE vector)', () => {
    const evil = '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>'
    expect(sanitizeSvg(evil)).toBeNull()
  })
  it('rejects something that is not actually an SVG root', () => {
    expect(sanitizeSvg('<html><body>not svg</body></html>')).toBeNull()
  })
})

describe('validateLogoUpload', () => {
  it('accepts a valid small PNG with matching declared MIME type', () => {
    const r = validateLogoUpload(PNG_HEADER, 'image/png')
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('png')
  })
  it('rejects a file over the 2MB size limit', () => {
    const big = Buffer.concat([PNG_HEADER, Buffer.alloc(MAX_LOGO_BYTES)])
    const r = validateLogoUpload(big, 'image/png')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/2MB/)
  })
  it('rejects an empty file', () => {
    expect(validateLogoUpload(Buffer.alloc(0), 'image/png').ok).toBe(false)
  })
  it('rejects when the declared MIME type does not match the real content', () => {
    // PNG bytes but claiming to be an SVG — a spoofed Content-Type.
    const r = validateLogoUpload(PNG_HEADER, 'image/svg+xml')
    expect(r.ok).toBe(false)
  })
  it('rejects an unrecognized binary blob outright', () => {
    const r = validateLogoUpload(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]), 'image/png')
    expect(r.ok).toBe(false)
  })
  it('accepts an SVG with a stripped attack payload — sanitized, not rejected', () => {
    // onload= is neutralized by sanitizeSvg, so the upload succeeds with the
    // dangerous part removed (the file actually written to disk is clean).
    const svgWithOnload = Buffer.from('<svg onload="alert(1)"><rect/></svg>')
    const r = validateLogoUpload(svgWithOnload, 'image/svg+xml')
    expect(r.ok).toBe(true)
  })
  it('rejects an SVG that cannot be sanitized at all (XXE/DOCTYPE — unsalvageable)', () => {
    const unsalvageable = Buffer.from('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>')
    const r = validateLogoUpload(unsalvageable, 'image/svg+xml')
    expect(r.ok).toBe(false)
  })
  it('accepts a clean SVG', () => {
    const okSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')
    const r = validateLogoUpload(okSvg, 'image/svg+xml')
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('svg')
  })
})

describe('extensionFor', () => {
  it('maps ico → ico, others → their own name', () => {
    expect(extensionFor('png')).toBe('png')
    expect(extensionFor('webp')).toBe('webp')
    expect(extensionFor('svg')).toBe('svg')
    expect(extensionFor('ico')).toBe('ico')
  })
})
