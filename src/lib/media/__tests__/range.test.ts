import { describe, it, expect } from 'vitest'
import { parseRange } from '../range'

describe('parseRange — HTTP Range header parsing for video seeking', () => {
  const SIZE = 1000

  it('returns null when there is no Range header (plain full-file request)', () => {
    expect(parseRange(null, SIZE)).toBeNull()
  })

  it('parses a normal "bytes=start-end" range', () => {
    expect(parseRange('bytes=100-199', SIZE)).toEqual({ start: 100, end: 199 })
  })

  it('parses an open-ended range ("bytes=500-") as start..end-of-file', () => {
    expect(parseRange('bytes=500-', SIZE)).toEqual({ start: 500, end: 999 })
  })

  it('parses a suffix range ("bytes=-500") as the last N bytes', () => {
    expect(parseRange('bytes=-500', SIZE)).toEqual({ start: 500, end: 999 })
  })

  it('clamps an end beyond the file size down to the last byte', () => {
    expect(parseRange('bytes=900-5000', SIZE)).toEqual({ start: 900, end: 999 })
  })

  it('rejects a start at or past the file size', () => {
    expect(parseRange('bytes=1000-', SIZE)).toBeNull()
    expect(parseRange('bytes=2000-3000', SIZE)).toBeNull()
  })

  it('rejects an inverted range (start > end)', () => {
    expect(parseRange('bytes=500-100', SIZE)).toBeNull()
  })

  it('ignores a non-"bytes=" unit', () => {
    expect(parseRange('items=0-5', SIZE)).toBeNull()
  })

  it('handles the exact first-byte and last-byte edge cases', () => {
    expect(parseRange('bytes=0-0', SIZE)).toEqual({ start: 0, end: 0 })
    expect(parseRange('bytes=999-999', SIZE)).toEqual({ start: 999, end: 999 })
  })
})
