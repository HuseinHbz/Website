/**
 * Code 39 barcode as pure inline SVG (Phase 26.2 — document designer element).
 *
 * Dependency-free by design (mirrors the QR-for-verification approach): the
 * Document Engine embeds the SVG straight into the print-ready HTML, so the
 * barcode survives "Save as PDF" with no runtime asset. Code 39 is chosen
 * because it natively encodes the platform's document numbers (A–Z, 0–9 and
 * - . / + % $ space) and scans without a checksum.
 */

/** Code 39 element patterns: 9 elements per char (bar/space alternating), w = wide, n = narrow. */
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw',
  'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn',
  'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww', 'L': 'nnwnnnnww',
  'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn',
  'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw',
  'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
}

/** True when every character is encodable in Code 39 (after uppercasing). */
export function isCode39(text: string): boolean {
  const s = text.toUpperCase()
  return s.length > 0 && s.length <= 48 && [...s].every(c => c !== '*' && CODE39[c] !== undefined)
}

export interface BarcodeOptions {
  /** Narrow module width in px (wide = 3×). */
  moduleWidth?: number
  /** Bar height in px. */
  height?: number
  /** Print the text under the bars. */
  showText?: boolean
}

/**
 * Render `text` as a Code 39 SVG string, or null when the text is not
 * encodable. The SVG is self-contained (no external refs) and print-safe.
 */
export function code39Svg(text: string, opts: BarcodeOptions = {}): string | null {
  if (!isCode39(text)) return null
  const s = `*${text.toUpperCase()}*`
  const mw = Math.max(1, opts.moduleWidth ?? 2)
  const wide = mw * 3
  const height = Math.max(10, opts.height ?? 40)
  const showText = opts.showText !== false

  let x = 0
  const bars: string[] = []
  for (const ch of s) {
    const pattern = CODE39[ch]
    for (let i = 0; i < 9; i++) {
      const w = pattern[i] === 'w' ? wide : mw
      if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="${height}" />`)
      x += w
    }
    x += mw // inter-character narrow gap
  }
  const width = x - mw
  const textH = showText ? 12 : 0
  const label = showText
    ? `<text x="${width / 2}" y="${height + 11}" text-anchor="middle" font-family="monospace" font-size="10" fill="#111">${text.toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + textH}" viewBox="0 0 ${width} ${height + textH}" role="img" aria-label="barcode ${text.toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}"><g fill="#111">${bars.join('')}</g>${label}</svg>`
}
