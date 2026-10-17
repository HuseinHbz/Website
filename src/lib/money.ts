/**
 * Exact decimal money arithmetic (ERPFIX-8, BUG-ERP-23) — zero external
 * dependency (audit:deps), BigInt-based, no float rounding error.
 *
 * `0.1 + 0.2 !== 0.3` in IEEE-754 float, and a chain of ×rate/×qty/discount%
 * conversions over real Rial amounts compounds that error — the ONLY reason
 * `entryBalanced` (ledger.ts) needed an EPS=0.005 tolerance at all. This
 * module does the posting-line SUM/balance check in integer "minor units"
 * (cents, i.e. amount × 100, rounded to the nearest minor unit ONCE per
 * line) so Σdebit and Σcredit are compared as exact integers — no tolerance
 * needed, no epsilon to hide a real one-cent imbalance behind.
 *
 * Scope (per this phase's own `do_not`): this is NOT a rewrite of the ERP's
 * money handling to decimal — every existing float computation (line
 * totals, tax, discounts, UI display) is untouched. Only the posting-line
 * SUM/balance check and the GL aggregation path use this.
 */

// BigInt() calls, not `0n` literals: the project's tsconfig targets ES2017
// (lower than ES2020), where BigInt literal syntax is a type error even
// though the runtime BigInt type itself is available.
const MINOR_UNITS_PER_RIAL = BigInt(100)

/** Round a float Rial amount to the nearest minor unit (cent) and return it
 * as a BigInt — the one place a float enters this module. */
export function toMinorUnits(amount: number): bigint {
  if (!Number.isFinite(amount)) return BigInt(0)
  // Round half-away-from-zero at the cent, matching roundTo's round-half-up
  // policy (erp/money.ts) — keeps this module's rounding consistent with
  // the rest of the codebase's money.
  const cents = Math.round((amount < 0 ? -amount : amount) * Number(MINOR_UNITS_PER_RIAL))
  const signed = amount < 0 ? -cents : cents
  return BigInt(signed)
}

export function fromMinorUnits(units: bigint): number {
  return Number(units) / Number(MINOR_UNITS_PER_RIAL)
}

export function sumMinorUnits(amounts: number[]): bigint {
  return amounts.reduce((s, a) => s + toMinorUnits(a), BigInt(0))
}

export interface ExactBalanceResult {
  ok: boolean
  totalDebitUnits: bigint
  totalCreditUnits: bigint
  /** totalDebitUnits − totalCreditUnits, in minor units. Zero means exactly
   * balanced; any nonzero value is the REAL discrepancy, in cents, never
   * rounded away. */
  diffUnits: bigint
}

/** EXACT balance check for a set of debit/credit lines — Σdebit must equal
 * Σcredit to the cent, with NO tolerance. Unlike `entryBalanced` in
 * ledger.ts (which keeps its historical EPS=0.005 for backward
 * compatibility with existing callers — see contract-changes.md), this is
 * the strict check new/hardened posting paths use. */
export function exactlyBalanced(lines: { debit: number; credit: number }[]): ExactBalanceResult {
  const totalDebitUnits = sumMinorUnits(lines.map(l => l.debit || 0))
  const totalCreditUnits = sumMinorUnits(lines.map(l => l.credit || 0))
  const diffUnits = totalDebitUnits - totalCreditUnits
  return { ok: diffUnits === BigInt(0), totalDebitUnits, totalCreditUnits, diffUnits }
}
