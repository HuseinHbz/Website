/**
 * Native XLSX reader (Phase 26.19, PART 1) — ZERO dependencies.
 *
 * An .xlsx file is a ZIP archive of XML parts. This module implements just
 * enough of both formats to turn a workbook into string matrices for the
 * Import Center: a ZIP central-directory reader (STORE + DEFLATE via node's
 * built-in zlib), the shared-strings table (plain + rich-text runs), inline
 * strings, booleans, numbers and cached formula values (`<v>` — formulas are
 * not *evaluated*, their last-calculated value is read, which is what an
 * export contains). Full Unicode incl. Persian comes free (UTF-8 XML).
 * Deterministic + pure (Buffer in → matrices out) so it is fully unit-tested.
 */
import { inflateRawSync } from 'zlib'

// ── ZIP container ────────────────────────────────────────────────────────────
const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

/** True when the buffer looks like a ZIP/xlsx (PK\x03\x04). */
export function isXlsx(buf: Buffer): boolean {
  return buf.length > 4 && buf.readUInt32LE(0) === SIG_LOCAL
}

interface ZipEntry { name: string; method: number; compressedSize: number; localOffset: number }

function readCentralDirectory(buf: Buffer): ZipEntry[] {
  // EOCD is at the end (comment ≤ 64 KB); scan backwards for its signature.
  let eocd = -1
  const min = Math.max(0, buf.length - 65557)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP/XLSX file (no end-of-central-directory)')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const entries: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== SIG_CENTRAL) throw new Error('Corrupt ZIP central directory')
    const method = buf.readUInt16LE(off + 10)
    const compressedSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOffset = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    entries.push({ name, method, compressedSize, localOffset })
    off += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function readEntry(buf: Buffer, e: ZipEntry): Buffer {
  if (buf.readUInt32LE(e.localOffset) !== SIG_LOCAL) throw new Error(`Corrupt ZIP local header for ${e.name}`)
  const nameLen = buf.readUInt16LE(e.localOffset + 26)
  const extraLen = buf.readUInt16LE(e.localOffset + 28)
  const start = e.localOffset + 30 + nameLen + extraLen
  const data = buf.subarray(start, start + e.compressedSize)
  if (e.method === 0) return Buffer.from(data)
  if (e.method === 8) return inflateRawSync(data)
  throw new Error(`Unsupported ZIP compression method ${e.method}`)
}

function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  for (const e of readCentralDirectory(buf)) out.set(e.name, readEntry(buf, e))
  return out
}

// ── Minimal XML helpers (fixed OOXML shapes — not a general XML parser) ──────
export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

/** All `<t>` runs inside an `<si>`/`<is>` block, concatenated (rich text). */
function textRuns(block: string): string {
  let out = ''
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block))) out += decodeXmlEntities(m[1])
  if (out === '' && /<t(?:\s[^>]*)?\/>/.test(block)) return ''
  return out
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  const out: string[] = []
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(textRuns(m[1]))
  return out
}

/** "BC" → 54 (0-based column index). */
export function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

interface SheetRef { name: string; rid: string; target?: string }

function parseWorkbookSheets(xml: string): SheetRef[] {
  const out: SheetRef[] = []
  const re = /<sheet\s([^>]*)\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = m[1]
    const name = /name="([^"]*)"/.exec(attrs)?.[1] ?? `Sheet${out.length + 1}`
    const rid = /r:id="([^"]*)"/.exec(attrs)?.[1] ?? ''
    out.push({ name: decodeXmlEntities(name), rid })
  }
  return out
}

function parseRels(xml: string | undefined): Map<string, string> {
  const out = new Map<string, string>()
  if (!xml) return out
  const re = /<Relationship\s([^>]*)\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const id = /Id="([^"]*)"/.exec(m[1])?.[1]
    const target = /Target="([^"]*)"/.exec(m[1])?.[1]
    if (id && target) out.set(id, target.replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/'))
  }
  return out
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = []
  const rowRe = /<row\s[^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(xml))) {
    const rowNo = Number(rm[1]) - 1
    const cells: string[] = []
    const cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm: RegExpExecArray | null
    while ((cm = cellRe.exec(rm[2]))) {
      const attrs = cm[1]
      const body = cm[2] ?? ''
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]
      const type = /t="([^"]*)"/.exec(attrs)?.[1] ?? 'n'
      const col = ref ? colIndex(ref) : cells.length
      let value = ''
      if (type === 'inlineStr') {
        value = textRuns(body)
      } else {
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1]
        if (v != null) {
          const raw = decodeXmlEntities(v)
          if (type === 's') value = shared[Number(raw)] ?? ''
          else if (type === 'b') value = raw === '1' ? 'true' : 'false'
          else value = raw // n, str (cached formula result), d
        }
      }
      cells[col] = value
    }
    rows[rowNo] = cells
  }
  // Normalise: fill gaps with '' and equalise row lengths.
  const width = rows.reduce((w, r) => Math.max(w, r ? r.length : 0), 0)
  return Array.from({ length: rows.length }, (_, i) => {
    const r = rows[i] ?? []
    return Array.from({ length: width }, (_, c) => r[c] ?? '')
  })
}

// ── Public API ───────────────────────────────────────────────────────────────
export interface XlsxWorkbook { sheets: { name: string; matrix: string[][] }[] }

/** Parse a whole workbook: every sheet → a string matrix. */
export function parseXlsx(buf: Buffer): XlsxWorkbook {
  const files = unzip(buf)
  const wbXml = files.get('xl/workbook.xml')?.toString('utf8')
  if (!wbXml) throw new Error('Not an XLSX workbook (xl/workbook.xml missing)')
  const shared = parseSharedStrings(files.get('xl/sharedStrings.xml')?.toString('utf8'))
  const rels = parseRels(files.get('xl/_rels/workbook.xml.rels')?.toString('utf8'))
  const sheets = parseWorkbookSheets(wbXml)
  const out: XlsxWorkbook = { sheets: [] }
  sheets.forEach((s, i) => {
    const target = rels.get(s.rid) ?? `xl/worksheets/sheet${i + 1}.xml`
    const xml = files.get(target)?.toString('utf8')
    if (!xml) return
    out.sheets.push({ name: s.name, matrix: parseSheet(xml, shared) })
  })
  if (out.sheets.length === 0) throw new Error('Workbook has no readable sheets')
  return out
}

/** Convenience for the Import Center: one sheet (by name, else the first). */
export function xlsxToMatrix(buf: Buffer, sheetName?: string): { sheetNames: string[]; sheet: string; matrix: string[][] } {
  const wb = parseXlsx(buf)
  const names = wb.sheets.map(s => s.name)
  const pick = sheetName ? wb.sheets.find(s => s.name === sheetName) : wb.sheets[0]
  if (!pick) throw new Error(`Sheet "${sheetName}" not found (available: ${names.join(', ')})`)
  return { sheetNames: names, sheet: pick.name, matrix: pick.matrix }
}
