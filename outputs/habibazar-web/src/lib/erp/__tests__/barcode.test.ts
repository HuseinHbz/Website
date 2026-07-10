import { describe, it, expect } from 'vitest'
import { isCode39, code39Svg } from '../barcode'

describe('isCode39', () => {
  it('accepts document-number charset (letters, digits, dash, slash)', () => {
    expect(isCode39('INV-2026/0042')).toBe(true)
    expect(isCode39('abc123')).toBe(true) // uppercased internally
  })
  it('rejects unencodable characters, star, empty and over-long input', () => {
    expect(isCode39('فاکتور')).toBe(false)
    expect(isCode39('A*B')).toBe(false)
    expect(isCode39('')).toBe(false)
    expect(isCode39('X'.repeat(49))).toBe(false)
  })
})

describe('code39Svg', () => {
  it('renders a self-contained SVG with start/stop framing', () => {
    const svg = code39Svg('INV-42')!
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('<rect')
    expect(svg).toContain('INV-42') // human-readable label
    // *INV-42* = 8 chars × 5 bars each = 40 rects
    expect(svg.match(/<rect /g)!.length).toBe(40)
  })
  it('bar geometry: widths are narrow or wide only, x advances monotonically', () => {
    const svg = code39Svg('A1', { moduleWidth: 2 })!
    const rects = [...svg.matchAll(/x="(\d+)" y="0" width="(\d+)"/g)].map(m => ({ x: +m[1], w: +m[2] }))
    expect(rects.every(r => r.w === 2 || r.w === 6)).toBe(true)
    for (let i = 1; i < rects.length; i++) expect(rects[i].x).toBeGreaterThan(rects[i - 1].x)
  })
  it('returns null for unencodable text and omits label when showText=false', () => {
    expect(code39Svg('نامعتبر')).toBeNull()
    expect(code39Svg('OK-1', { showText: false })).not.toContain('<text')
  })
})
