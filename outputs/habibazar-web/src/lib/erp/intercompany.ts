/**
 * Intercompany accounting (Phase 26.5) — pure paired-entry builder.
 *
 * A transfer between group companies books TWO mirrored, balanced journal
 * entries against the intercompany clearing accounts seeded in migrate.ts:
 *   1150 Due From Affiliates (asset) · 2150 Due To Affiliates (liability)
 * with 1010 Bank as the cash leg.
 *
 *   transfer (A pays B):  A: Dr 1150 / Cr 1010   B: Dr 1010 / Cr 2150
 *   settle   (B repays A): A: Dr 1010 / Cr 1150  B: Dr 2150 / Cr 1010
 *
 * In consolidation 1150 and 2150 offset, so group statements stay clean.
 * The data layer resolves account codes → ids and posts both entries.
 */

export const IC_ACCOUNTS = { dueFrom: '1150', dueTo: '2150', bank: '1010' } as const

export interface IcLine { accountCode: string; debit: number; credit: number; memo: string }
export interface IcEntry { companyId: number; memo: string; lines: IcLine[] }

export interface IcTransferInput {
  kind: 'transfer' | 'settle'
  fromCompanyId: number
  toCompanyId: number
  amount: number
  memo?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** True when every entry's debits equal its credits (to the cent). */
export function icBalanced(entries: IcEntry[]): boolean {
  return entries.every(e => {
    const d = round2(e.lines.reduce((s, l) => s + l.debit, 0))
    const c = round2(e.lines.reduce((s, l) => s + l.credit, 0))
    return d === c && d > 0
  })
}

/**
 * Build the mirrored entry pair. Throws on invalid input (same company,
 * non-positive amount) — the caller validates user input first.
 */
export function intercompanyEntries(i: IcTransferInput): [IcEntry, IcEntry] {
  if (i.fromCompanyId === i.toCompanyId) throw new Error('Transfer requires two different companies')
  if (!(i.amount > 0)) throw new Error('Amount must be positive')
  const amt = round2(i.amount)
  const tag = i.memo?.trim() || (i.kind === 'transfer' ? 'Intercompany transfer' : 'Intercompany settlement')

  if (i.kind === 'transfer') {
    return [
      {
        companyId: i.fromCompanyId, memo: `${tag} → co#${i.toCompanyId}`,
        lines: [
          { accountCode: IC_ACCOUNTS.dueFrom, debit: amt, credit: 0, memo: `Due from co#${i.toCompanyId}` },
          { accountCode: IC_ACCOUNTS.bank, debit: 0, credit: amt, memo: 'Cash out' },
        ],
      },
      {
        companyId: i.toCompanyId, memo: `${tag} ← co#${i.fromCompanyId}`,
        lines: [
          { accountCode: IC_ACCOUNTS.bank, debit: amt, credit: 0, memo: 'Cash in' },
          { accountCode: IC_ACCOUNTS.dueTo, debit: 0, credit: amt, memo: `Due to co#${i.fromCompanyId}` },
        ],
      },
    ]
  }
  // settle: the borrower (from) repays the lender (to)
  return [
    {
      companyId: i.fromCompanyId, memo: `${tag} → co#${i.toCompanyId}`,
      lines: [
        { accountCode: IC_ACCOUNTS.dueTo, debit: amt, credit: 0, memo: `Settle due to co#${i.toCompanyId}` },
        { accountCode: IC_ACCOUNTS.bank, debit: 0, credit: amt, memo: 'Cash out' },
      ],
    },
    {
      companyId: i.toCompanyId, memo: `${tag} ← co#${i.fromCompanyId}`,
      lines: [
        { accountCode: IC_ACCOUNTS.bank, debit: amt, credit: 0, memo: 'Cash in' },
        { accountCode: IC_ACCOUNTS.dueFrom, debit: 0, credit: amt, memo: `Settle due from co#${i.fromCompanyId}` },
      ],
    },
  ]
}
