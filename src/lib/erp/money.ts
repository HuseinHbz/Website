/**
 * ERPFIX-2 (BUG-ERP-03) — the ONE place a transaction-currency amount is
 * converted to the Rial base for a GL line. Every poster (sales/purchase
 * invoice, payment/receipt, revaluation, intercompany, …) must go through
 * `toBase` instead of writing the raw document amount into
 * `gl_journal_lines.debit/credit` — that was the root of BUG-ERP-03 (a
 * 100 USD invoice landed in the ledger as "100", not 60,000,000 Rials).
 *
 * Rounding policy: round-half-up to the configured precision (IRR has no
 * meaningful fractional unit, so the default precision is 0). Any residual
 * cent from rounding individual lines is absorbed by the caller on its own
 * control line (AR/AP) so the entry still balances exactly — `toBase` itself
 * never tries to balance anything, it only converts one amount.
 */
const num = (v: unknown) => Number(v ?? 0)

// The rest of this codebase rounds money to 2 decimals everywhere (round2 in
// ledger.ts/sales.ts/…) — ERPFIX-2 keeps that SAME precision by default so a
// domestic (rate=1) IRR document's sub-unit amounts are unaffected by this
// conversion. `erp_settings.fx_precision` can still raise/lower it for a real
// FX policy decision; it never defaults to 0 (that would silently round every
// existing 2-decimal Rial amount down to a whole Rial).
export function roundTo(amount: number, precision = 2): number {
  const f = Math.pow(10, Math.max(0, precision))
  return Math.round((num(amount) + Number.EPSILON) * f) / f
}

/** Convert a transaction-currency amount to the Rial base using the document's own registered (or settlement) rate. */
export function toBase(amount: number, rate: number, precision = 2): number {
  const r = num(rate) || 1
  return roundTo(num(amount) * r, precision)
}

/**
 * Split a total rounding residual onto one designated "control" index so a
 * set of converted amounts still sums to the independently-converted total
 * (protects a posting entry from a few-Rial rounding break caused by
 * converting each line separately instead of the total).
 */
export function balanceResidual(parts: number[], total: number, controlIndex: number, precision = 0): number[] {
  const out = parts.map(p => roundTo(p, precision))
  const sum = out.reduce((s, p) => s + p, 0)
  const residual = roundTo(total, precision) - sum
  if (residual !== 0 && controlIndex >= 0 && controlIndex < out.length) out[controlIndex] = roundTo(out[controlIndex] + residual, precision)
  return out
}
