/**
 * Periodic VAT settlement (ERPFIX-7, BUG-ERP-20) — nets output VAT (collected
 * on sales) against input VAT (recoverable on purchases) for one period and
 * posts the balance due/recoverable. Reuses the single posting entry point
 * (`insertPostedEntry`) and the configured `gl_map_vat_output`/`gl_map_
 * vat_input` accounts — no second accounting engine.
 */
import { pgQuery, withTransaction } from '@/lib/db'
import { loadGlMap, accountIdByCode, insertPostedEntry } from './glPosting'
import { loadTallies } from './ledgerData'

const round2 = (n: number) => Math.round(n * 100) / 100

export interface VatSettlementResult {
  entryId: number | null
  outputVat: number
  inputVat: number
  netPayable: number
  alreadySettled: boolean
}

/**
 * Settle VAT for [from, to]. Idempotent per (from, to, companyId) via the
 * `vat_settlements` UNIQUE constraint — a retried call returns the existing
 * settlement instead of posting twice. `netPayable > 0` means the company
 * owes the tax authority (net output); `< 0` means a recoverable credit.
 */
export async function runVatSettlement(from: string, to: string, companyId: number | undefined, userId?: string): Promise<VatSettlementResult> {
  const existing = (await pgQuery<{ id: number; entry_id: number | null; output_vat: number; input_vat: number; net_payable: number }>(
    `SELECT id, entry_id, output_vat::float AS output_vat, input_vat::float AS input_vat, net_payable::float AS net_payable
     FROM vat_settlements WHERE period_from=$1 AND period_to=$2 AND company_id IS NOT DISTINCT FROM $3`,
    [from, to, companyId ?? null]))[0]
  if (existing) {
    return { entryId: existing.entry_id, outputVat: existing.output_vat, inputVat: existing.input_vat, netPayable: existing.net_payable, alreadySettled: true }
  }

  const map = await loadGlMap()
  const periodTallies = await loadTallies(companyId, { from, to })
  const outAcc = periodTallies.find(t => t.code === map.vatOutput)
  const inAcc = periodTallies.find(t => t.code === map.vatInput)
  // VAT payable (output) is a liability — credit-normal; VAT input is posted
  // as a debit (recoverable asset side of the same posting-line convention
  // used in sales.ts/purchasing.ts), so period activity nets straight off
  // debit/credit rather than through accountBalance's normal-side sign.
  const outputVat = round2(outAcc ? outAcc.credit - outAcc.debit : 0)
  const inputVat = round2(inAcc ? inAcc.debit - inAcc.credit : 0)
  const netPayable = round2(outputVat - inputVat)

  let entryId: number | null = null
  if ((Math.abs(outputVat) > 0.004 || Math.abs(inputVat) > 0.004) && map.vatOutput !== map.vatInput) {
    // Only a real transfer entry is needed when output/input are configured
    // to DIFFERENT accounts (the common historical default posts both to the
    // SAME account, where the balance already nets to the right figure with
    // no entry required — posting one anyway would double-count it).
    //
    // The entry fully CLEARS both VAT accounts for the period (Dr output
    // liability by its own full balance, Cr input asset by its own full
    // balance) and books the residual to the dedicated VAT-settlement-
    // payable account (2160) — never a partial clear that leaves one of the
    // two accounts still carrying the other's share of the balance.
    const outId = await accountIdByCode(map.vatOutput)
    const inId = await accountIdByCode(map.vatInput)
    const payableId = await accountIdByCode('2160')
    const lines = [
      ...(outputVat > 0.004 ? [{ accountId: outId, debit: round2(outputVat), credit: 0 }] : []),
      ...(inputVat > 0.004 ? [{ accountId: inId, debit: 0, credit: round2(inputVat) }] : []),
      netPayable > 0
        ? { accountId: payableId, debit: 0, credit: round2(netPayable) }
        : { accountId: payableId, debit: round2(-netPayable), credit: 0 },
    ].filter(l => l.debit > 0 || l.credit > 0)
    const total = lines.reduce((s, l) => s + l.debit, 0)
    entryId = await withTransaction(async query => {
      const posted = await insertPostedEntry(query, to, `VAT settlement ${from}..${to}`, `vat-settle:${from}:${to}`, total, userId, lines, { docType: 'vat_settlement', companyId })
      return posted.id
    })
  }

  await pgQuery(
    `INSERT INTO vat_settlements (period_from, period_to, company_id, output_vat, input_vat, net_payable, entry_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [from, to, companyId ?? null, outputVat, inputVat, netPayable, entryId, userId ?? null])

  return { entryId, outputVat, inputVat, netPayable, alreadySettled: false }
}
