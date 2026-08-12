import { describe, it, expect } from 'vitest'
import { validateMediaUpload, validateLottieSchema, MEDIA_LIMITS_MB } from '../validate'

function mp4Buffer(): Buffer {
  // A minimal ISO-BMFF "ftyp" box: 4-byte size, "ftyp", then padding.
  const payload = Buffer.from('isommp42\0\0\0\0')
  const size = Buffer.alloc(4)
  size.writeUInt32BE(8 + payload.length)
  return Buffer.concat([size, Buffer.from('ftyp'), payload])
}

function webmBuffer(): Buffer {
  return Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])
}

function pngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
}

describe('validateMediaUpload — real content detection', () => {
  it('accepts a real MP4 for hero-background-video', () => {
    const r = validateMediaUpload(mp4Buffer(), 'hero-background-video', 'video/mp4')
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('video')
  })
  it('accepts a real WebM for hero-animation-video', () => {
    const r = validateMediaUpload(webmBuffer(), 'hero-animation-video', 'video/webm')
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('webm-alpha')
  })
  it('accepts a real WebM for hero-background-video (26.34 — the UI advertises WebM here; a real bug rejected it)', () => {
    const r = validateMediaUpload(webmBuffer(), 'hero-background-video', 'video/webm')
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('webm-alpha')
  })
  it('rejects a PNG renamed to look like a video (content, not extension, decides)', () => {
    const r = validateMediaUpload(pngBuffer(), 'hero-background-video', 'video/mp4')
    expect(r.ok).toBe(false)
  })
  it('rejects an executable/garbage blob outright', () => {
    const r = validateMediaUpload(Buffer.from([0x4d, 0x5a, 1, 2, 3, 4, 5, 6]), 'hero-background-video', 'video/mp4')
    expect(r.ok).toBe(false)
  })
  it('accepts a clean SVG for hero-animation-vector', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')
    const r = validateMediaUpload(svg, 'hero-animation-vector', 'image/svg+xml')
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('svg')
  })
  it('rejects an SVG that cannot be sanitized (XXE) for hero-animation-vector', () => {
    const svg = Buffer.from('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>')
    const r = validateMediaUpload(svg, 'hero-animation-vector', 'image/svg+xml')
    expect(r.ok).toBe(false)
  })
  it('rejects a video uploaded against the poster (image-only) category', () => {
    const r = validateMediaUpload(mp4Buffer(), 'hero-poster', 'video/mp4')
    expect(r.ok).toBe(false)
  })
  it('rejects a file over the category size limit', () => {
    const big = Buffer.concat([mp4Buffer(), Buffer.alloc(MEDIA_LIMITS_MB['hero-animation-video'] * 1024 * 1024)])
    const r = validateMediaUpload(big, 'hero-animation-video', 'video/mp4')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/MB limit/)
  })
  it('rejects an empty file', () => {
    expect(validateMediaUpload(Buffer.alloc(0), 'hero-poster', 'image/png').ok).toBe(false)
  })
})

describe('validateLottieSchema', () => {
  it('accepts a minimal valid Lottie/Bodymovin export shape', () => {
    const json = { v: '5.9.0', fr: 30, ip: 0, op: 60, w: 200, h: 200, layers: [] }
    expect(validateLottieSchema(json).ok).toBe(true)
  })
  it('rejects a JSON object missing required Lottie fields', () => {
    expect(validateLottieSchema({ foo: 'bar' }).ok).toBe(false)
  })
  it('rejects when layers is not an array', () => {
    const json = { v: '5.9.0', fr: 30, ip: 0, op: 60, w: 200, h: 200, layers: 'nope' }
    expect(validateLottieSchema(json).ok).toBe(false)
  })
  it('rejects a non-object payload', () => {
    expect(validateLottieSchema('just a string').ok).toBe(false)
    expect(validateLottieSchema(null).ok).toBe(false)
  })
})
