#!/usr/bin/env node
/**
 * SEC-FIX-1 بند۳ — permanent CI gate against raw-value SQL-text interpolation.
 *
 * Scans every `pgQuery(\`...\`)` / `query(\`...\`)` template literal under
 * src/lib and src/app/api that looks like SQL (contains SELECT/INSERT/UPDATE/
 * DELETE/WITH), and inspects every `${...}` interpolation inside it. Allowed:
 *
 *   - `${NOW}` — the project's one well-known timestamp-expression constant.
 *   - A bare identifier whose nearest preceding `const <ident> = <expr>`
 *     assigns it from a ternary/switch chain that ONLY ever picks between
 *     hardcoded literal SQL fragments — the `gate`/`stamp` pattern already
 *     used correctly in `treasury/paymentData.ts#listPayments`,
 *     `bi/slaData.ts#listSlaEvents`, `erp/accountingData.ts#transitionPeriod`.
 *     The actual value powering the WHERE/SET clause must still travel as a
 *     real bound parameter ($1, $2, …) — this gate does not (and cannot by
 *     itself) verify that part; it only closes the "raw value spliced into
 *     SQL text" class of bug.
 *
 * Anything else — a bare parameter, a request field, a template literal that
 * itself contains a nested `${…}`, a function call, string concatenation
 * with a non-literal — fails the gate, UNLESS explicitly allowlisted below
 * with a documented reason (never silently).
 *
 * Run: node scripts/sql-injection-audit.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SCAN_DIRS = ['src/lib', 'src/app/api']

// Explicit, documented exceptions. Each entry: `${file}:${line}` -> reason.
// Empty on purpose — every finding so far was a real defect and got fixed,
// not allowlisted. Add an entry here ONLY for a genuine false positive, with
// a one-line reason, never to make a real finding disappear.
const ALLOWLIST = new Map([
  ['[src/lib/ai/sync.ts:65]', 'source.table / source.where come from the closed, module-level SOURCES array literal (src/lib/ai/sync.ts) iterated via for-of — never derived from request input.'],
  ['[src/lib/erp/revaluationData.ts:85]', 'REVAL_ACCOUNTS is a closed hardcoded const object ({ adjustment, gain, loss }, erp/revaluation.ts) — never request-derived.'],
  ['[src/lib/erp/revaluationData.ts:86]', 'Same as above (REVAL_ACCOUNTS.loss).'],
  ['[src/lib/import/importData.ts:101]', '`values` is chunk.map((_,j)=>`($1,$${j*2+2},$${j*2+3})`).join(\',\') — j is a loop index over the fixed chunk size, producing only $n placeholder text; the real row data always travels through `params`.'],
  ['[src/lib/import/importData.ts:415]', 't.table_name is read from migration_transactions (our own tracked data) but is re-validated against the closed ROLLBACK_TABLES set (`if (... || !ROLLBACK_TABLES.has(t.table_name))`) immediately before being used — never spliced unchecked.'],
  ['[src/app/api/admin/crm/leads/route.ts:59]', 'sc.clause comes from the shared rowScopeSql() helper (src/lib/rbac/data.ts): its own SQL is $n-parametrized and `ownerExpr` is always a hardcoded literal column reference passed by the calling route, never request-derived.'],
  ['[src/app/api/admin/erp/sales/documents/route.ts:76]', 'Same as above — rowScopeSql() usage.'],
  ['[src/app/api/admin/database/health/route.ts:78]', '`t` is enumerated from a prior `SELECT table_name FROM information_schema.tables` query against the server\'s OWN schema catalog — never derived from request input.'],
  ['[src/app/api/admin/erp/assets/route.ts:81]', '`ph` = values(d).map((_,i)=>`$${i+1}`).join(\',\') — purely a generated $1,$2,… placeholder string from the array\'s length, never a value.'],
  ['[src/app/api/admin/erp/assets/route.ts:114]', '`cols` is generated from the module-level constant COLS string (hardcoded column names) — never request-derived.'],
  ['[src/app/api/admin/erp/numbering/route.ts:96]', '`sets` is built only from Object.entries(map) where `map` is a closed hardcoded const object (fixed column names); each pushed element pairs a hardcoded column name with a safe params.length placeholder — the actual value always travels through `params`.'],
  ['[src/app/api/admin/erp/projects/items/route.ts:93]', '`table` = TABLE[parsed.data.kind] where TABLE is a closed hardcoded const map and `kind` is zod-constrained to z.enum([\'task\',\'milestone\',\'timesheet\']) before use; also guarded by `if (!table) return badRequest(...)`.'],
  ['[src/app/api/admin/heroes/animations/route.ts:109]', 'd.field is zod-constrained to z.enum([\'favorite\',\'enabled\',\'archived\']) before use — each a fixed, SQL-metacharacter-free column name.'],
  ['[src/app/api/admin/heroes/animations/route.ts:125]', 'map[d.op] — `map` is a closed hardcoded const object and `d.op` is zod-constrained to z.enum([\'archive\',\'restore\',\'enable\',\'disable\',\'delete\',\'favorite\']) before use.'],
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue
      walk(p, out)
    } else if (extname(name) === '.ts' || extname(name) === '.tsx') {
      out.push(p)
    }
  }
  return out
}

/** Extracts a template literal starting at `src[start]` === '`'. Returns
 * { text, endIndex, exprs: [{expr, index}] } where `exprs` are the TOP-LEVEL
 * `${...}` interpolations (nested template literals are skipped over whole,
 * not descended into — a nested backtick inside an expression is itself
 * flagged unsafe by the classifier, since it will contain a literal `` ` ``). */
function extractTemplate(src, start) {
  let i = start + 1
  const exprs = []
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') { i += 2; continue }
    if (c === '`') return { text: src.slice(start, i + 1), endIndex: i, exprs }
    if (c === '$' && src[i + 1] === '{') {
      const exprStart = i + 2
      let depth = 1
      let j = exprStart
      while (j < src.length && depth > 0) {
        const cj = src[j]
        if (cj === '\\') { j += 2; continue }
        if (cj === '`') { const nested = extractTemplate(src, j); j = nested.endIndex + 1; continue }
        if (cj === '{') { depth++; j++; continue }
        if (cj === '}') { depth--; if (depth === 0) break; j++; continue }
        if (cj === "'" || cj === '"') {
          const quote = cj; j++
          while (j < src.length && src[j] !== quote) { if (src[j] === '\\') j++; j++ }
          j++; continue
        }
        j++
      }
      exprs.push({ expr: src.slice(exprStart, j), index: exprStart })
      i = j + 1
      continue
    }
    i++
  }
  return { text: src.slice(start), endIndex: src.length, exprs }
}

const LITERAL_RE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`$\\]|\\.|\$(?!\{))*`/g
const COND_RE = /[A-Za-z_$][A-Za-z0-9_$.]*\s*(===|==|!==|!=)\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|null|undefined)/g
const TERNARY_TEST_RE = /[A-Za-z_$][A-Za-z0-9_$.]*(?=\s*\?(?!\.))/g

/** Is `rhs` (an assignment's right-hand side) purely a ternary/switch choice
 * between hardcoded literal fragments — no other identifier ever supplies
 * the VALUE of a branch? */
function isLiteralOnlyChoice(rhs) {
  // `${NOW}` is itself the one approved constant, and `${arr.length}` /
  // `${arr.length + N}` is a SAFE positional placeholder index (`$3`, never
  // a value) — the one other shape this codebase's `gate`/`where`/`conds`
  // builders legitimately embed inside an otherwise-literal SQL fragment.
  const stripped0 = rhs
    .replace(/\$\{NOW\}/g, '')
    .replace(/\$\{\s*[A-Za-z_$][A-Za-z0-9_$.]*\.length(\s*[+-]\s*\d+)?\s*\}/g, '')
  if (/`[^`]*\$\{/.test(stripped0)) return false // a branch itself re-interpolates something else
  let s = stripped0
  s = s.replace(COND_RE, '')
  s = s.replace(TERNARY_TEST_RE, '')
  s = s.replace(/[\s()?:|&!]/g, '')
  const withoutLiterals = s.replace(LITERAL_RE, '')
  return withoutLiterals.length === 0
}

/** Extracts the RHS text of a statement starting right after an `=`/`+=`
 * token, up to the first top-level `;` or newline. */
function extractRhs(src, rhsStart) {
  let depth = 0
  let i = rhsStart
  while (i < src.length) {
    const c = src[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth-- }
    else if (c === '`') { const t = extractTemplate(src, i); i = t.endIndex; }
    else if ((c === "'" || c === '"') && depth === 0) {
      const quote = c; i++
      while (i < src.length && src[i] !== quote) { if (src[i] === '\\') i++; i++ }
    } else if (c === ';' && depth === 0) break
    else if (c === '\n' && depth === 0) break
    i++
  }
  return src.slice(rhsStart, i)
}

/** Finds the nearest preceding `const <name> = ...;` before `beforeIndex`. */
function findPrecedingConst(src, name, beforeIndex) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=\\s*`, 'g')
  let best = null
  let m
  while ((m = re.exec(src.slice(0, beforeIndex)))) best = m
  if (!best) return null
  return extractRhs(src, best.index + best[0].length)
}

/** Collects EVERY assignment/reassignment to `name` (declaration `let/const
 * NAME = …`, plain reassignment `NAME = …`, or accumulation `NAME += …`)
 * appearing before `beforeIndex` — the common safe shape across this
 * codebase is `let where = ''; if (cond) { params.push(x); where = '...$N' }`
 * (or `+=`), never a raw value, only ever more hardcoded literal SQL text
 * plus a safe numeric placeholder index. All collected RHS must be
 * literal-only for the identifier to be considered safe. */
function collectAllAssignments(src, name, beforeIndex) {
  const re = new RegExp(`\\b${name}\\s*(\\+=|=)(?!=)\\s*`, 'g')
  const rhsList = []
  let m
  while ((m = re.exec(src.slice(0, beforeIndex)))) {
    rhsList.push(extractRhs(src, m.index + m[0].length))
  }
  return rhsList
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length
}

/** Splits `text` on top-level commas (ignoring commas inside (), [], {},
 * strings, or template literals). */
function splitTopLevel(text) {
  const parts = []
  let depth = 0, start = 0, i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue }
    if (c === ')' || c === ']' || c === '}') { depth--; i++; continue }
    if (c === '`') { const t = extractTemplate(text, i); i = t.endIndex + 1; continue }
    if (c === "'" || c === '"') { const q = c; i++; while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; i++ }; i++; continue }
    if (c === ',' && depth === 0) { parts.push(text.slice(start, i)); i++; start = i; continue }
    i++
  }
  if (start < text.length) parts.push(text.slice(start))
  return parts.map(p => p.trim()).filter(p => p.length > 0)
}

/** Is `name` (an array variable) ONLY ever populated — at declaration and
 * via every `.push(...)` call before `beforeIndex` — with literal-only
 * entries? The `parts`/`conds`/`sets` pattern used across this codebase. */
function isArrayOfLiteralsOnly(name, src, beforeIndex) {
  const declRe = new RegExp(`\\b(?:const|let)\\s+${name}\\s*=\\s*\\[`, 'g')
  let declFound = false
  let m
  while ((m = declRe.exec(src.slice(0, beforeIndex)))) {
    declFound = true
    const bracketStart = m.index + m[0].length
    let depth = 1, i = bracketStart
    while (i < src.length && depth > 0) {
      if (src[i] === '[') depth++
      else if (src[i] === ']') depth--
      else if (src[i] === '`') { i = extractTemplate(src, i).endIndex }
      i++
    }
    const inner = src.slice(bracketStart, i - 1)
    for (const el of splitTopLevel(inner)) if (!isLiteralOnlyChoice(el)) return false
  }
  const pushRe = new RegExp(`\\b${name}\\.push\\(`, 'g')
  let pushFound = false
  while ((m = pushRe.exec(src.slice(0, beforeIndex)))) {
    pushFound = true
    const argsStart = m.index + m[0].length
    let depth = 1, i = argsStart
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') depth--
      else if (src[i] === '`') { i = extractTemplate(src, i).endIndex }
      i++
    }
    const argText = src.slice(argsStart, i - 1)
    for (const arg of splitTopLevel(argText)) if (!isLiteralOnlyChoice(arg)) return false
  }
  return declFound || pushFound
}

function classifyExpr(expr, src, exprIndex) {
  const trimmed = expr.trim()
  if (trimmed === 'NOW') return { ok: true }
  // A bare positional-placeholder index, e.g. `${params.length}` or
  // `${values(d).length + 2}` — always a number, never a value; the actual
  // value still travels through the resulting `$n`.
  if (/^[A-Za-z_$][A-Za-z0-9_$]*(\([^()]*\))?\.length(\s*[+-]\s*\d+)?$/.test(trimmed)) return { ok: true }
  // Inline literal-only ternary written directly inside ${...}, e.g.
  // `${type ? 'AND d.doc_type=$1' : ''}` — same safe shape as the gate/stamp
  // pattern, just not hoisted to a separate const first.
  if (isLiteralOnlyChoice(trimmed)) return { ok: true }
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed)) {
    const safeName = trimmed.replace(/[.$]/g, '\\$&')
    const rhs = findPrecedingConst(src, safeName, exprIndex)
    if (rhs != null && isLiteralOnlyChoice(rhs)) return { ok: true }
    // `let`-declared identifier reassigned/accumulated across an `if` chain
    // (the `where`/`dateFilter`/`conds`/`sets` pattern) — every assignment
    // touching it must independently be a literal-only choice.
    const allRhs = collectAllAssignments(src, safeName, exprIndex)
    if (allRhs.length > 0 && allRhs.every(isLiteralOnlyChoice)) return { ok: true }
    return { ok: false, reason: rhs == null && allRhs.length === 0 ? 'bare identifier with no literal-only assignment nearby' : `'${trimmed}' is not assigned only from literal-only choices` }
  }
  // `parts.join(' AND ')` / `sets.join(', ')` — the array's every element
  // (initial literal + every .push) must itself be literal-only.
  const joinMatch = /^([A-Za-z_$][A-Za-z0-9_$]*)\.join\(\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\)$/.exec(trimmed)
  if (joinMatch && isArrayOfLiteralsOnly(joinMatch[1], src, exprIndex)) return { ok: true }
  return { ok: false, reason: 'non-identifier expression spliced into SQL text' }
}

const SQL_KEYWORD_RE = /\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i
const CALL_RE = /\b(?:pgQuery|query)\s*\(\s*`/g

const findings = []
let scannedFiles = 0
let scannedCalls = 0

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = file.slice(ROOT.length)
    const src = readFileSync(file, 'utf8')
    scannedFiles++
    let m
    CALL_RE.lastIndex = 0
    while ((m = CALL_RE.exec(src))) {
      const backtickIndex = m.index + m[0].length - 1
      const { text, exprs } = extractTemplate(src, backtickIndex)
      if (!SQL_KEYWORD_RE.test(text)) continue
      scannedCalls++
      for (const { expr, index } of exprs) {
        const result = classifyExpr(expr, src, backtickIndex)
        if (!result.ok) {
          const ln = lineOf(src, index)
          const key = `[${rel}:${ln}]`
          if (ALLOWLIST.has(key)) continue
          findings.push({ file: rel, line: ln, expr: expr.trim(), reason: result.reason })
        }
      }
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ scannedFiles, scannedCalls, findings }, null, 2))
} else {
  console.log('\n  SQL Injection Audit (SEC-FIX-1 — raw-value SQL-text interpolation)')
  console.log('  ' + '─'.repeat(66))
  console.log(`  Files scanned ................ ${scannedFiles}`)
  console.log(`  SQL template calls checked ... ${scannedCalls}`)
  console.log(`  ✗ Unsafe interpolations ...... ${findings.length}  (budget 0)`)
  for (const f of findings) console.log(`      · ${f.file}:${f.line} — \${${f.expr}} — ${f.reason}`)
  console.log('')
}
process.exit(findings.length === 0 ? 0 : 1)
