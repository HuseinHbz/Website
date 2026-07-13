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

// ── EAN-13 / EAN-8 (Phase 26.19, PART 7 — retail barcodes) ───────────────────
// L/G/R encodings per GS1. Pure: digits in → SVG out; check digit validated
// (12 digits → computed and appended; 13 digits → verified).
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const EAN_R = EAN_L.map(p => [...p].map(b => (b === '0' ? '1' : '0')).join(''))
// First-digit parity pattern for the left half (L = 0, G = 1).
const EAN13_PARITY = ['000000', '001011', '001101', '001110', '010011', '011001', '011100', '010101', '010110', '011010']

/** GS1 check digit for the first 12 (EAN-13) or 7 (EAN-8) digits. */
export function eanCheckDigit(digits: string): number {
  const n = digits.length
  let sum = 0
  for (let i = 0; i < n; i++) {
    const weight = (n - i) % 2 === 0 ? 1 : 3 // rightmost payload digit weighs 3
    sum += Number(digits[i]) * weight
  }
  return (10 - (sum % 10)) % 10
}

/** True for a syntactically valid EAN-13 (13 digits incl. correct check digit). */
export function isValidEan13(v: string | null | undefined): boolean {
  if (!v) return false
  const s = v.trim()
  if (!/^\d{13}$/.test(s)) return false
  return eanCheckDigit(s.slice(0, 12)) === Number(s[12])
}

/** Normalise input: 12 digits → append check digit; 13 → validate. Null if bad. */
export function ean13Normalize(input: string): string | null {
  const s = input.trim()
  if (/^\d{12}$/.test(s)) return s + String(eanCheckDigit(s))
  if (/^\d{13}$/.test(s)) return isValidEan13(s) ? s : null
  return null
}

/** Render an EAN-13 SVG (guards + check digit handled), or null when invalid. */
export function ean13Svg(input: string, opts: BarcodeOptions = {}): string | null {
  const code = ean13Normalize(input)
  if (!code) return null
  const mw = Math.max(1, opts.moduleWidth ?? 2)
  const height = Math.max(10, opts.height ?? 50)
  const showText = opts.showText !== false
  const parity = EAN13_PARITY[Number(code[0])]
  let bits = '101' // start guard
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === '0' ? EAN_L : EAN_G)[Number(code[i])]
  bits += '01010' // centre guard
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(code[i])]
  bits += '101' // end guard
  const bars: string[] = []
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') bars.push(`<rect x="${i * mw}" y="0" width="${mw}" height="${height}" />`)
  }
  const width = bits.length * mw
  const textY = height + 12
  const total = showText ? height + 16 : height
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}" viewBox="0 0 ${width} ${total}" role="img" aria-label="EAN-13 ${code}"><g fill="#000">${bars.join('')}</g>${showText ? `<text x="${width / 2}" y="${textY}" text-anchor="middle" font-family="monospace" font-size="11" fill="#000">${code}</text>` : ''}</svg>`
}
