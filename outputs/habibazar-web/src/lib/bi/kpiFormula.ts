/**
 * KPI formula engine (Phase 26.13, M2) — pure, unit-tested.
 *
 * A safe arithmetic evaluator (NO `eval`) for KPI formula strings over a named
 * metrics dictionary — e.g. "(revenue - cogs) / revenue * 100". Tokenizer →
 * shunting-yard → RPN, supporting + - * / ( ) and metric identifiers (dotted
 * paths). Plus target attainment / weighting / scoring for the KPI scorecard.
 */

type Token = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string } | { t: 'paren'; v: '(' | ')' }

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

export function tokenize(expr: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < expr.length) {
    const c = expr[i]
    if (c === ' ' || c === '\t') { i++; continue }
    if (c === '(' || c === ')') { out.push({ t: 'paren', v: c }); i++; continue }
    if ('+-*/'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue }
    if (/[0-9.]/.test(c)) {
      let n = ''
      while (i < expr.length && /[0-9.]/.test(expr[i])) n += expr[i++]
      out.push({ t: 'num', v: Number(n) })
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let id = ''
      while (i < expr.length && /[A-Za-z0-9_.]/.test(expr[i])) id += expr[i++]
      out.push({ t: 'id', v: id })
      continue
    }
    throw new Error(`Invalid character "${c}" in formula`)
  }
  return out
}

/** Shunting-yard → RPN. */
export function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = []
  const ops: Token[] = []
  for (let k = 0; k < tokens.length; k++) {
    const tk = tokens[k]
    if (tk.t === 'num' || tk.t === 'id') output.push(tk)
    else if (tk.t === 'op') {
      // Unary minus → treat as (0 - x).
      const prev = tokens[k - 1]
      if (tk.v === '-' && (!prev || prev.t === 'op' || (prev.t === 'paren' && prev.v === '('))) output.push({ t: 'num', v: 0 })
      while (ops.length) {
        const top = ops[ops.length - 1]
        if (top.t === 'op' && PREC[top.v] >= PREC[tk.v]) output.push(ops.pop()!)
        else break
      }
      ops.push(tk)
    } else if (tk.v === '(') ops.push(tk)
    else { // ')'
      while (ops.length && !(ops[ops.length - 1].t === 'paren' && (ops[ops.length - 1] as { v: string }).v === '(')) output.push(ops.pop()!)
      if (!ops.length) throw new Error('Mismatched parentheses')
      ops.pop()
    }
  }
  while (ops.length) {
    const top = ops.pop()!
    if (top.t === 'paren') throw new Error('Mismatched parentheses')
    output.push(top)
  }
  return output
}

/** Evaluate a formula over a metrics dict. Missing metrics default to 0. */
export function evalFormula(expr: string, metrics: Record<string, number>): number {
  if (!expr.trim()) return 0
  const rpn = toRpn(tokenize(expr))
  const stack: number[] = []
  for (const tk of rpn) {
    if (tk.t === 'num') stack.push(tk.v)
    else if (tk.t === 'id') stack.push(Number(metrics[tk.v] ?? 0))
    else {
      const b = stack.pop() ?? 0, a = stack.pop() ?? 0
      stack.push(tk.v === '+' ? a + b : tk.v === '-' ? a - b : tk.v === '*' ? a * b : b === 0 ? 0 : a / b)
    }
  }
  const r = stack.pop() ?? 0
  return Math.round(r * 10000) / 10000
}

/** Validate a formula compiles + list the metric names it references. */
export function validateFormula(expr: string): { valid: boolean; error?: string; metrics: string[] } {
  try {
    if (!expr.trim()) return { valid: false, error: 'empty formula', metrics: [] }
    const tokens = tokenize(expr)
    const rpn = toRpn(tokens)
    // Arity check: simulate the stack depth (operands +1, binary op −1).
    let depth = 0
    for (const tk of rpn) {
      if (tk.t === 'num' || tk.t === 'id') depth++
      else { depth -= 1; if (depth < 1) throw new Error('operator is missing an operand') }
    }
    if (depth !== 1) throw new Error('malformed expression')
    const metrics = [...new Set(tokens.filter(t => t.t === 'id').map(t => (t as { v: string }).v))]
    return { valid: true, metrics }
  } catch (e) { return { valid: false, error: e instanceof Error ? e.message : 'invalid', metrics: [] } }
}

// ── Scoring ──────────────────────────────────────────────────────────────────
export type KpiDirection = 'higher_better' | 'lower_better'
export type KpiStatus = 'on_target' | 'at_risk' | 'off_target' | 'no_target'

/** Attainment % of a KPI against its target, honouring the direction. */
export function attainment(actual: number, target: number | null | undefined, direction: KpiDirection): number {
  if (target == null || target === 0) return 0
  const pct = direction === 'higher_better' ? actual / target * 100 : target / (actual || Number.EPSILON) * 100
  return Math.round(pct * 10) / 10
}

export function kpiStatus(attainmentPct: number, hasTarget: boolean): KpiStatus {
  if (!hasTarget) return 'no_target'
  if (attainmentPct >= 95) return 'on_target'
  if (attainmentPct >= 80) return 'at_risk'
  return 'off_target'
}

export interface ScoreInput { actual: number; target: number | null; direction: KpiDirection; weight?: number }
export interface KpiScore { attainmentPct: number; status: KpiStatus; weightedScore: number }
export function scoreKpi(i: ScoreInput): KpiScore {
  const pct = attainment(i.actual, i.target, i.direction)
  const capped = Math.min(120, Math.max(0, pct))
  return { attainmentPct: pct, status: kpiStatus(pct, i.target != null && i.target !== 0), weightedScore: Math.round(capped * (i.weight ?? 1) * 100) / 100 }
}

/** Overall scorecard score = weighted-average attainment (capped 0..120). */
export function scorecard(items: ScoreInput[]): { score: number; totalWeight: number } {
  const totalWeight = items.reduce((s, i) => s + (i.weight ?? 1), 0)
  if (totalWeight === 0) return { score: 0, totalWeight: 0 }
  const sum = items.reduce((s, i) => s + Math.min(120, Math.max(0, attainment(i.actual, i.target, i.direction))) * (i.weight ?? 1), 0)
  return { score: Math.round(sum / totalWeight * 10) / 10, totalWeight }
}
