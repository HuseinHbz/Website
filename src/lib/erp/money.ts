/**
 * ERPFIX-2 (BUG-ERP-03) — THE place a transaction-currency amount becomes a
 * base-currency (Rial) amount for the general ledger. Pure, unit-tested.
 *
 * Rounding policy (documented, deliberate):
 *  - A CONVERSION (rate ≠ 1) is rounded half-away-from-zero to
 *    `precision` decimals (erp_settings.decimal_precision, default 0 — the
 *    Rial has no meaningful fraction).
 *  - A base amount (rate = 1, e.g. IRR) is NOT re-rounded beyond the 2
 *    decimals every document line already carries: re-rounding would make the
 *    GL disagree with the sub-ledger document it posts.
 *  - Converting each line separately can leave a rounding residue. It lands on
 *    the CONTROL line (AR / AP), so every entry balances exactly (Dr = Cr to
 *    the last unit), never "within EPS".
 *  - Settling part of a foreign document relieves the control account
 *    PROPORTIONALLY to the share settled, rounded on the CUMULATIVE share, so a
 *    document settled in any number of payments relieves exactly the base
 *    amount it posted. The difference between that relief and the bank leg
 *    (at the payment-day rate) is the REALIZED exchange gain/loss.
 */

export const BASE_CURRENCY = 'IRR'

/** Round half away from zero to `precision` decimals (0–4). */
export function roundTo(n: number, precision = 0): number {
  const p = Math.max(0, Math.min(4, Math.floor(precision)))
  const f = 10 ** p
  const v = Math.round((Math.abs(n) * f) + 1e-9) / f
  return n < 0 ? -v : v
}

const round2 = (n: number) => roundTo(n, 2)

/** One amount → base. rate = Rial per 1 unit of the transaction currency. */
export function toBase(amount: number, rate: number, precision = 0): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Invalid exchange rate ${rate}`)
  if (rate === 1) return round2(amount)
  return roundTo(amount * rate, precision)
}

export interface FxLineIn { accountCode: string; debit: number; credit: number; memo?: string | null }
export interface FxLineOut extends FxLineIn { fxAmount: number | null; fxCurrency: string | null }

/**
 * Convert a balanced set of transaction-currency posting lines to base.
 * Every line except the control line is converted independently; the control
 * line takes the balancing figure (it absorbs the rounding residue). Each
 * converted line keeps its original amount in fxAmount/fxCurrency when the
 * currency is not the base currency.
 */
export function linesToBase(lines: FxLineIn[], rate: number, currency: string, controlCode: string, precision = 0): FxLineOut[] {
  const isFx = currency !== BASE_CURRENCY
  const ctrlIdx = lines.findIndex(l => l.accountCode === controlCode)
  if (ctrlIdx < 0) throw new Error(`Control account ${controlCode} is not on the entry`)
  const out: FxLineOut[] = lines.map(l => ({
    ...l,
    debit: l.debit > 0 ? toBase(l.debit, rate, precision) : 0,
    credit: l.credit > 0 ? toBase(l.credit, rate, precision) : 0,
    fxAmount: isFx ? round2(l.debit > 0 ? l.debit : l.credit) : null,
    fxCurrency: isFx ? currency : null,
  }))
  // Balancing figure on the control line.
  const ctrl = out[ctrlIdx]
  const otherDr = out.reduce((s, l, i) => i === ctrlIdx ? s : s + l.debit, 0)
  const otherCr = out.reduce((s, l, i) => i === ctrlIdx ? s : s + l.credit, 0)
  if (lines[ctrlIdx].debit > 0) ctrl.debit = round2(otherCr - otherDr)
  else ctrl.credit = round2(otherDr - otherCr)
  if (ctrl.debit < 0 || ctrl.credit < 0) throw new Error('Control line went negative while balancing')
  return out
}

/**
 * Base amount of the control line a foreign document posted: net and tax
 * converted separately (exactly as linesToBase does), summed.
 */
export function documentControlBase(net: number, tax: number, rate: number, precision = 0): number {
  return round2(toBase(net, rate, precision) + (tax > 0 ? toBase(tax, rate, precision) : 0))
}

/**
 * Proportional control-account relief for settling `amount` of a document
 * whose total is `docTotal` (transaction currency) and whose control line
 * posted `controlBase`, after `paidBefore` was already settled. Rounded on the
 * cumulative share so the reliefs of a fully settled document sum to exactly
 * controlBase.
 */
export function proportionalRelief(controlBase: number, docTotal: number, paidBefore: number, amount: number, precision = 0): number {
  if (docTotal <= 0) return 0
  const share = (x: number) => roundTo(controlBase * Math.min(Math.max(x, 0), docTotal) / docTotal, precision)
  return round2(share(paidBefore + amount) - share(paidBefore))
}

export interface SettlementInput {
  /** 'receivable': customer pays us (Dr bank / Cr AR). 'payable': we pay a vendor (Dr AP / Cr bank). */
  kind: 'receivable' | 'payable'
  currency: string
  /** Rial rate of the payment currency on the payment day. */
  paymentRate: number
  /** Settled amount, in the document's currency (= the payment currency). */
  amount: number
  /** Control-account relief at the document's BOOKED rate (proportionalRelief); null → no document (relieve at the payment rate). */
  relief: number | null
  accounts: { bank: string; control: string; gain: string; loss: string }
  precision?: number
}
export interface SettlementResult { lines: FxLineOut[]; bankBase: number; relief: number; fxGain: number; fxLoss: number }

/**
 * Balanced settlement entry: bank at the payment-day rate, control account at
 * the booked rate, the difference to realized FX gain (4900) / loss (6980).
 */
export function settlementLines(s: SettlementInput): SettlementResult {
  const precision = s.precision ?? 0
  const isFx = s.currency !== BASE_CURRENCY
  const fx = (amt: number) => ({ fxAmount: isFx ? round2(amt) : null, fxCurrency: isFx ? s.currency : null })
  const bankBase = toBase(s.amount, s.paymentRate, precision)
  const relief = s.relief ?? bankBase
  const diff = round2(bankBase - relief)
  const lines: FxLineOut[] = []
  let fxGain = 0, fxLoss = 0
  if (s.kind === 'receivable') {
    lines.push({ accountCode: s.accounts.bank, debit: bankBase, credit: 0, memo: 'Bank in', ...fx(s.amount) })
    lines.push({ accountCode: s.accounts.control, debit: 0, credit: relief, memo: 'Receivable settled', ...fx(s.amount) })
    if (diff > 0) { fxGain = diff; lines.push({ accountCode: s.accounts.gain, debit: 0, credit: diff, memo: 'Realized exchange gain', fxAmount: null, fxCurrency: null }) }
    if (diff < 0) { fxLoss = -diff; lines.push({ accountCode: s.accounts.loss, debit: -diff, credit: 0, memo: 'Realized exchange loss', fxAmount: null, fxCurrency: null }) }
  } else {
    lines.push({ accountCode: s.accounts.control, debit: relief, credit: 0, memo: 'Payable settled', ...fx(s.amount) })
    lines.push({ accountCode: s.accounts.bank, debit: 0, credit: bankBase, memo: 'Bank out', ...fx(s.amount) })
    // Paying more base than the liability was booked at is a LOSS.
    if (diff > 0) { fxLoss = diff; lines.push({ accountCode: s.accounts.loss, debit: diff, credit: 0, memo: 'Realized exchange loss', fxAmount: null, fxCurrency: null }) }
    if (diff < 0) { fxGain = -diff; lines.push({ accountCode: s.accounts.gain, debit: 0, credit: -diff, memo: 'Realized exchange gain', fxAmount: null, fxCurrency: null }) }
  }
  return { lines: lines.filter(l => l.debit > 0 || l.credit > 0), bankBase, relief, fxGain, fxLoss }
}

/**
 * FX true-up for a settlement whose main entry relieved the control account
 * at the PAYMENT rate (Treasury posts the cash movement first, allocates
 * after): moves the control account from payment-rate relief to booked-rate
 * relief, the difference to realized gain/loss. Empty when there is no
 * difference (every IRR settlement).
 */
export function fxTrueUpLines(kind: 'receivable' | 'payable', reliefAtPaymentRate: number, reliefAtBookedRate: number, accounts: { control: string; gain: string; loss: string }): FxLineOut[] {
  const diff = round2(reliefAtPaymentRate - reliefAtBookedRate)
  if (Math.abs(diff) < 0.005) return []
  const n = { fxAmount: null, fxCurrency: null }
  const amt = Math.abs(diff)
  if (kind === 'receivable') {
    // Main entry credited AR with the payment-rate amount; booked relief differs.
    return diff > 0
      ? [{ accountCode: accounts.control, debit: amt, credit: 0, memo: 'AR to booked rate', ...n }, { accountCode: accounts.gain, debit: 0, credit: amt, memo: 'Realized exchange gain', ...n }]
      : [{ accountCode: accounts.loss, debit: amt, credit: 0, memo: 'Realized exchange loss', ...n }, { accountCode: accounts.control, debit: 0, credit: amt, memo: 'AR to booked rate', ...n }]
  }
  // Payable: main entry debited AP with the payment-rate amount.
  return diff > 0
    ? [{ accountCode: accounts.loss, debit: amt, credit: 0, memo: 'Realized exchange loss', ...n }, { accountCode: accounts.control, debit: 0, credit: amt, memo: 'AP to booked rate', ...n }]
    : [{ accountCode: accounts.control, debit: amt, credit: 0, memo: 'AP to booked rate', ...n }, { accountCode: accounts.gain, debit: 0, credit: amt, memo: 'Realized exchange gain', ...n }]
}

/** Base amount of a document for threshold comparisons (approval, budget, credit). */
export function documentBase(doc: { total: number; exchangeRate?: number | null; baseTotal?: number | null }): number {
  const bt = Number(doc.baseTotal ?? 0)
  if (bt > 0) return round2(bt)
  const r = Number(doc.exchangeRate ?? 1) || 1
  return round2(Number(doc.total) * r)
}

/** SQL expression for a document's base amount (same rule as documentBase), table alias optional. */
export const BASE_TOTAL_SQL = `(CASE WHEN base_total > 0 THEN base_total ELSE total * COALESCE(NULLIF(exchange_rate, 0), 1) END)`

export type NormalizedPayment =
  | { ok: true; amount: number; currency: string; rate: number; converted: boolean }
  | { ok: false; error: 'currency_mismatch' | 'invalid_rate' }

/**
 * ERPFIX-2: a payment applied to a document is STORED in the document's
 * currency, so every per-document sum (paid, open, overpayment guard,
 * revaluation positions) stays in one currency.
 *  - same currency (or no document) → stored as given, at the payment-day rate
 *  - different currency → refused, unless an explicit `conversionRate`
 *    (document-currency units per 1 payment-currency unit) is given; then the
 *    amount is restated in the document currency and the stored Rial rate is
 *    paymentRate / conversionRate, so amount × rate (the bank's base amount)
 *    is unchanged.
 */
export function normalizePayment(i: { docCurrency: string | null; currency: string; amount: number; paymentRate: number; conversionRate?: number | null }): NormalizedPayment {
  if (!Number.isFinite(i.paymentRate) || i.paymentRate <= 0) return { ok: false, error: 'invalid_rate' }
  if (!i.docCurrency || i.docCurrency === i.currency) return { ok: true, amount: i.amount, currency: i.currency, rate: i.paymentRate, converted: false }
  const c = Number(i.conversionRate)
  if (!i.conversionRate || !Number.isFinite(c) || c <= 0) return { ok: false, error: 'currency_mismatch' }
  return { ok: true, amount: round2(i.amount * c), currency: i.docCurrency, rate: i.paymentRate / c, converted: true }
}
