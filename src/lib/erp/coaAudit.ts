/**
 * ERPFIX-1 (BUG-ERP-10) — pure checks behind `npm run audit:coa`.
 *
 *  (a) seedConflicts: no account code is seeded into gl_accounts twice with a
 *      different English name or type (6100 was «Rent Expense» in one INSERT
 *      and «Salaries» in another; ON CONFLICT DO NOTHING hid it).
 *  (b) literalViolations: every account-code literal in an account context
 *      (accountCode: '…', accountIdByCode('…'), WHERE code='…', gl_map
 *      defaults, *_ACCOUNTS / DEFAULT_MAP objects, …Code = '…') is listed in
 *      COA_CONTRACT, and each contract entry agrees with the seed.
 */
import type { CoaContractEntry } from './coaContract'

export interface SeedRow { code: string; nameEn: string; nameFa: string; type: string; line: number }
export interface SeedConflict { code: string; rows: SeedRow[] }

const TYPES = '(asset|liability|equity|revenue|expense|memo)'
const TUPLE = new RegExp(`\\(\\s*'(\\d{1,6})'\\s*,\\s*'([^']*)'\\s*,\\s*'([^']*)'\\s*,\\s*'${TYPES}'`, 'g')
const SELECT_ROW = new RegExp(`SELECT\\s+'(\\d{1,6})'\\s*,\\s*'([^']*)'\\s*,\\s*'([^']*)'\\s*,\\s*'${TYPES}'`, 'g')

/** Every (code, name_en, name_fa, type) a migration seeds into gl_accounts. */
export function parseGlAccountSeeds(sql: string): SeedRow[] {
  const rows: SeedRow[] = []
  const re = /INSERT\s+INTO\s+gl_accounts\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql))) {
    const end = sql.indexOf(';', m.index)
    const stmt = sql.slice(m.index, end < 0 ? undefined : end)
    if (/VALUES\s*\(\s*\$1/.test(stmt)) continue // parametrised runtime insert, not a seed
    for (const r of [TUPLE, SELECT_ROW]) {
      r.lastIndex = 0
      let t: RegExpExecArray | null
      while ((t = r.exec(stmt))) {
        rows.push({ code: t[1], nameEn: t[2], nameFa: t[3], type: t[4], line: sql.slice(0, m.index + t.index).split('\n').length })
      }
    }
  }
  return rows
}

export function seedConflicts(rows: SeedRow[]): SeedConflict[] {
  const by = new Map<string, SeedRow[]>()
  for (const r of rows) by.set(r.code, [...(by.get(r.code) ?? []), r])
  const out: SeedConflict[] = []
  for (const [code, rs] of by) {
    const keys = new Set(rs.map(r => `${r.nameEn.toLowerCase()}|${r.type}`))
    if (keys.size > 1) out.push({ code, rows: rs })
  }
  return out
}

export interface LiteralHit { path: string; line: number; code: string; snippet: string }

const LITERAL_CONTEXTS: RegExp[] = [
  /accountCode:\s*'(\d{3,6})'/g,
  /accountIdByCode\(\s*'(\d{3,6})'/g,
  /\bcode\s*=\s*'(\d{3,6})'/g,
  /\bmap\[\s*'(\d{3,6})'\s*\]/g,
  /'(\d{3,6})'\s*\]?\s*:\s*m(?:\[|\.get\()/g,
  /gl_map_\w+'\s*\)?\]?\s*\?\?\s*'(\d{3,6})'/g,
  /\?\?\s*'(\d{3,6})'/g,
  /\b\w*Code\s*=\s*'(\d{3,6})'/g,
]
/** One-line object constants that name accounts: `X_ACCOUNTS = { a: '1150', … }`. */
const ACCOUNT_OBJECT = /\b(?:[A-Z_]*ACCOUNTS|DEFAULT_MAP)\b[^=\n]*=\s*\{([^}\n]*)\}/g

/** Find account-code literals in one source file. */
export function findAccountLiterals(path: string, text: string): LiteralHit[] {
  const hits: LiteralHit[] = []
  const lines = text.split('\n')
  const push = (idx: number, code: string) => {
    const line = text.slice(0, idx).split('\n').length
    hits.push({ path, line, code, snippet: lines[line - 1].trim().slice(0, 160) })
  }
  for (const re of LITERAL_CONTEXTS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      // `?? '…'` only counts on an account-map line, not e.g. a phone prefix.
      if (re.source.startsWith('\\?\\?') && !/gl_map|map\[|Code\b|code\b/.test(lines[text.slice(0, m.index).split('\n').length - 1])) continue
      push(m.index, m[1])
    }
  }
  ACCOUNT_OBJECT.lastIndex = 0
  let o: RegExpExecArray | null
  while ((o = ACCOUNT_OBJECT.exec(text))) {
    const body = o[1]
    const vr = /'(\d{3,6})'/g
    let v: RegExpExecArray | null
    while ((v = vr.exec(body))) push(o.index + o[0].indexOf(body) + v.index, v[1])
  }
  // dedupe (several patterns may hit one literal)
  const seen = new Set<string>()
  return hits.filter(h => { const k = `${h.line}:${h.code}`; if (seen.has(k)) return false; seen.add(k); return true })
}

export interface ContractProblem { code: string; problem: string; where?: string }

/** Literals missing from the contract + contract entries that disagree with the seed. */
export function contractProblems(hits: LiteralHit[], contract: Record<string, CoaContractEntry>, seeds: SeedRow[]): ContractProblem[] {
  const out: ContractProblem[] = []
  for (const h of hits) {
    if (!contract[h.code]) out.push({ code: h.code, problem: 'account-code literal is not in COA_CONTRACT (src/lib/erp/coaContract.ts)', where: `${h.path}:${h.line}  ${h.snippet}` })
  }
  const seedBy = new Map<string, SeedRow[]>()
  for (const s of seeds) seedBy.set(s.code, [...(seedBy.get(s.code) ?? []), s])
  for (const [code, c] of Object.entries(contract)) {
    const rs = seedBy.get(code)
    if (!rs?.length) { out.push({ code, problem: 'contract code is never seeded into gl_accounts' }); continue }
    for (const r of rs) {
      if (r.type !== c.type || r.nameEn.toLowerCase() !== c.nameEn.toLowerCase()) {
        out.push({ code, problem: `contract says ${c.type} «${c.nameEn}» but the seed (line ${r.line}) says ${r.type} «${r.nameEn}»` })
      }
    }
  }
  return out
}
