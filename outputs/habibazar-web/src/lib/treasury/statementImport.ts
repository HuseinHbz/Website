/**
 * Bank statement import engine (Phase 26.14, M2) — pure, unit-tested.
 * Parses CSV, SWIFT MT940 and ISO-20022 CAMT.053 statements into normalized
 * signed-amount lines, with column mapping and duplicate detection. No I/O, no
 * XML dependency (regex extraction) → fully testable.
 */

export interface ImportedLine {
  date: string          // 'YYYY-MM-DD'
  amount: number        // signed: + inflow (credit), − outflow (debit)
  description: string
  reference: string
}

function n(v: string): number { const x = Number(String(v).replace(/[, ]/g, '').replace(/[^0-9.\-]/g, '')); return isNaN(x) ? 0 : x }
function isoDate(s: string): string {
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  const m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/)  // dd/mm/yyyy
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  return t.slice(0, 10)
}

// ── CSV ──────────────────────────────────────────────────────────────────────
export interface CsvMapping { date: string; amount?: string; debit?: string; credit?: string; description?: string; reference?: string }

/** RFC-4180-ish CSV split (handles quoted fields). */
export function splitCsvRow(row: string): string[] {
  const out: string[] = []; let cur = '', q = false
  for (let i = 0; i < row.length; i++) {
    const c = row[i]
    if (q) { if (c === '"') { if (row[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map(s => s.trim())
}

export function parseCsv(text: string, mapping: CsvMapping): ImportedLine[] {
  const rows = text.split(/\r?\n/).filter(r => r.trim())
  if (!rows.length) return []
  const header = splitCsvRow(rows[0]).map(h => h.toLowerCase())
  const idx = (name?: string) => (name ? header.indexOf(name.toLowerCase()) : -1)
  const di = idx(mapping.date), ai = idx(mapping.amount), dbi = idx(mapping.debit), ci = idx(mapping.credit), desci = idx(mapping.description), refi = idx(mapping.reference)
  const out: ImportedLine[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = splitCsvRow(rows[r])
    if (di < 0 || !cells[di]) continue
    let amount = 0
    if (ai >= 0) amount = n(cells[ai])
    else { const cr = ci >= 0 ? n(cells[ci]) : 0; const db = dbi >= 0 ? n(cells[dbi]) : 0; amount = cr - db }
    out.push({ date: isoDate(cells[di]), amount, description: desci >= 0 ? cells[desci] ?? '' : '', reference: refi >= 0 ? cells[refi] ?? '' : '' })
  }
  return out
}

// ── MT940 (SWIFT) ────────────────────────────────────────────────────────────
/** Parse the :61:/:86: statement lines of an MT940 message. */
export function parseMt940(text: string): ImportedLine[] {
  const out: ImportedLine[] = []
  const lines = text.split(/\r?\n/)
  let cur: ImportedLine | null = null
  for (const raw of lines) {
    const l = raw.trim()
    if (l.startsWith(':61:')) {
      if (cur) out.push(cur)
      // :61:YYMMDD[MMDD]D/C amount... e.g. :61:2601150115D1000,00NTRFref
      const body = l.slice(4)
      const m = body.match(/^(\d{6})(\d{4})?(R?[DC])([0-9.,]+)/)
      if (m) {
        const yy = m[1].slice(0, 2), mm = m[1].slice(2, 4), dd = m[1].slice(4, 6)
        const sign = m[3].includes('D') ? -1 : 1
        const amt = n(m[4].replace(',', '.'))
        const refM = body.match(/N\w{3}(.+)$/)
        cur = { date: `20${yy}-${mm}-${dd}`, amount: sign * amt, description: '', reference: (refM?.[1] ?? '').trim() }
      } else cur = null
    } else if (l.startsWith(':86:') && cur) {
      cur.description = l.slice(4).trim()
    }
  }
  if (cur) out.push(cur)
  return out
}

// ── CAMT.053 (ISO 20022) ─────────────────────────────────────────────────────
/** Parse <Ntry> entries from a CAMT.053 XML statement (regex, no XML dep). */
export function parseCamt053(xml: string): ImportedLine[] {
  const out: ImportedLine[] = []
  const entries = xml.match(/<Ntry>[\s\S]*?<\/Ntry>/g) ?? []
  for (const e of entries) {
    const amt = n((e.match(/<Amt[^>]*>([^<]+)<\/Amt>/) ?? [])[1] ?? '0')
    const cd = (e.match(/<CdtDbtInd>([^<]+)<\/CdtDbtInd>/) ?? [])[1] ?? 'CRDT'
    const dt = (e.match(/<BookgDt>[\s\S]*?<Dt>([^<]+)<\/Dt>/) ?? e.match(/<Dt>([^<]+)<\/Dt>/) ?? [])[1] ?? ''
    const info = (e.match(/<AddtlNtryInf>([^<]+)<\/AddtlNtryInf>/) ?? [])[1] ?? ''
    const ref = (e.match(/<AcctSvcrRef>([^<]+)<\/AcctSvcrRef>/) ?? [])[1] ?? ''
    out.push({ date: isoDate(dt), amount: (cd === 'DBIT' ? -1 : 1) * amt, description: info.trim(), reference: ref.trim() })
  }
  return out
}

// ── Duplicate detection + ERP mapping ────────────────────────────────────────
export function lineFingerprint(l: { date: string; amount: number; reference?: string }): string {
  return `${l.date}|${Math.round(l.amount * 100)}|${(l.reference ?? '').trim().toLowerCase()}`
}

/** Split incoming lines into new vs duplicates (against existing fingerprints). */
export function detectDuplicates(existing: { date: string; amount: number; reference?: string }[], incoming: ImportedLine[]): { fresh: ImportedLine[]; duplicates: ImportedLine[] } {
  const seen = new Set(existing.map(lineFingerprint))
  const fresh: ImportedLine[] = [], duplicates: ImportedLine[] = []
  for (const l of incoming) {
    const fp = lineFingerprint(l)
    if (seen.has(fp)) duplicates.push(l)
    else { seen.add(fp); fresh.push(l) }
  }
  return { fresh, duplicates }
}

export type ErpTxnType = 'receipt' | 'payment' | 'transfer' | 'expense'
/** Heuristic ERP classification of a statement line. */
export function mapErpType(l: ImportedLine): ErpTxnType {
  const d = l.description.toLowerCase()
  if (/transfer|intercompany|internal/.test(d)) return 'transfer'
  if (l.amount >= 0) return 'receipt'
  if (/fee|charge|tax|utility|expense/.test(d)) return 'expense'
  return 'payment'
}
