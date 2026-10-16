/**
 * ERPFIX-1 — pure regressions: posting-date validation, the strict period
 * rule, closed-vs-locked for year-end, contra-balance closing lines, and the
 * two CI gate scanners (gl-writes, coa) on positive AND negative samples.
 */
import { describe, it, expect } from 'vitest'
import { isValidPostingDate, canPostDate, yearEndClosingLines, type FiscalPeriod } from '../accountingCore'
import { entryBalanced, type AccountTally } from '../ledger'
import { scanGlWrites } from '../../governance/glWritesAudit'
import { parseGlAccountSeeds, seedConflicts, findAccountLiterals, contractProblems } from '../coaAudit'
import { COA, COA_CONTRACT } from '../coaContract'
import { payrollPostingLines } from '../../hr/payroll'
import { paymentGlLines } from '../../treasury/payments'

const periods: FiscalPeriod[] = [
  { id: 1, name: 'FY2025', startDate: '2025-01-01', endDate: '2025-12-31', status: 'closed', kind: 'year' },
  { id: 2, name: 'FY2024', startDate: '2024-01-01', endDate: '2024-12-31', status: 'locked', kind: 'year' },
  { id: 3, name: 'FY2026', startDate: '2026-01-01', endDate: '2026-12-31', status: 'open', kind: 'year' },
]

describe('posting date (BUG-ERP-08)', () => {
  it('accepts only a real YYYY-MM-DD calendar date', () => {
    expect(isValidPostingDate('2026-02-28')).toBe(true)
    expect(isValidPostingDate('2024-02-29')).toBe(true)
    for (const bad of ['abc', '2025-02-30', '2026-13-01', '2026-1-1', '', '2026-01-01T00:00']) expect(isValidPostingDate(bad)).toBe(false)
  })
  it("rejects 'abc' with block=invalid_date", () => {
    expect(canPostDate('abc', periods)).toMatchObject({ ok: false, block: 'invalid_date' })
  })
  it('strict: a date outside every defined period is refused; legacy mode allows it', () => {
    expect(canPostDate('2030-05-01', periods, { requirePeriod: true })).toMatchObject({ ok: false, block: 'outside_periods' })
    expect(canPostDate('2030-05-01', periods, { requirePeriod: false }).ok).toBe(true)
  })
  it('a fresh install with NO period still posts under strict', () => {
    expect(canPostDate('2030-05-01', [], { requirePeriod: true }).ok).toBe(true)
  })
  it('allowClosedPeriod opens a CLOSED period but never a LOCKED one', () => {
    expect(canPostDate('2025-12-31', periods).ok).toBe(false)
    expect(canPostDate('2025-12-31', periods, { allowClosedPeriod: true }).ok).toBe(true)
    expect(canPostDate('2024-12-31', periods, { allowClosedPeriod: true })).toMatchObject({ ok: false, block: 'period_closed' })
  })
})

describe('year-end closing lines (contra balances)', () => {
  it('a net-debited revenue account closes on the CREDIT side — never a negative amount', () => {
    const tallies: AccountTally[] = [
      { id: 10, code: '4000', nameEn: 'Sales', type: 'revenue', debit: 0, credit: 1000 },
      { id: 11, code: '4010', nameEn: 'Returns', type: 'revenue', debit: 200, credit: 0 },
      { id: 12, code: '6000', nameEn: 'Salaries', type: 'expense', debit: 300, credit: 0 },
      { id: 13, code: '6200', nameEn: 'Refunded', type: 'expense', debit: 0, credit: 50 },
    ]
    const r = yearEndClosingLines(tallies, 99)
    expect(r.lines.every(l => l.debit >= 0 && l.credit >= 0 && !(l.debit > 0 && l.credit > 0))).toBe(true)
    expect(entryBalanced(r.lines).ok).toBe(true)
    expect(r.netIncome).toBe(1000 - 200 - 300 + 50)
    expect(r.lines.find(l => l.accountId === 11)).toEqual({ accountId: 11, debit: 0, credit: 200 })
  })
})

describe('salaries post to the payroll-expense role, not rent (BUG-ERP-10)', () => {
  it('payroll + treasury salary payment use COA.payrollExpense (6000)', () => {
    expect(COA.payrollExpense).toBe('6000')
    expect(COA_CONTRACT['6000']).toEqual({ type: 'expense', nameEn: 'Salaries Expense' })
    const p = payrollPostingLines({ gross: 100, employeeInsurance: 7, employerInsurance: 20, unemploymentInsurance: 3, tax: 5, loanRepayment: 0, otherDeductions: 0, net: 88 })
    expect(p.find(l => l.accountCode === '6000')?.debit).toBe(100)
    expect(paymentGlLines('salary_payment', 50)[0].accountCode).toBe('6000')
    expect(p.concat(paymentGlLines('salary_payment', 50) as never[]).some(l => l.accountCode === '6100')).toBe(false)
  })
})

describe('audit:gl-writes scanner', () => {
  it('passes the core, flags a direct insert anywhere else', () => {
    const files = [
      { path: 'src/lib/erp/glPosting.ts', text: 'pgQuery(`INSERT INTO gl_journal_entries (x) VALUES (1)`)' },
      { path: 'src/lib/erp/rogue.ts', text: 'const a = 1\nawait q(`INSERT INTO gl_journal_entries (entry_no,status) VALUES ($1,\'posted\')`)' },
      { path: 'src/lib/erp/rogue2.ts', text: 'await q(`insert into gl_journal_lines (entry_id) values ($1)`)' },
      { path: 'deploy/x.ts', text: "await q(`UPDATE gl_journal_entries SET status='posted' WHERE id=$1`)" },
    ]
    const v = scanGlWrites(files)
    expect(v.map(x => `${x.path}:${x.kind}`).sort()).toEqual(['deploy/x.ts:status_posted', 'src/lib/erp/rogue.ts:entry_insert', 'src/lib/erp/rogue2.ts:line_insert'])
    expect(v.find(x => x.path === 'src/lib/erp/rogue.ts')?.line).toBe(2)
  })
  it('the journal-route allowlist covers DRAFT inserts only', () => {
    const p = 'src/app/api/admin/erp/finance/journal/route.ts'
    expect(scanGlWrites([{ path: p, text: "q(`INSERT INTO gl_journal_entries (a,status) VALUES ($1,'draft',2)`)" }])).toHaveLength(0)
    expect(scanGlWrites([{ path: p, text: "q(`INSERT INTO gl_journal_entries (a,status) VALUES ($1,'posted',2)`)" }])).toHaveLength(1)
  })
})

describe('audit:coa', () => {
  const sql = `
    INSERT INTO gl_accounts (code, name_en, name_fa, type) VALUES
      ('6000','Salaries Expense','هزینهٔ حقوق','expense'),
      ('6100','Rent Expense','هزینهٔ اجاره','expense')
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO gl_accounts (code, name_en, name_fa, type, active)
      SELECT '1150', 'Due From Affiliates', 'دریافتنی', 'asset', 1 WHERE NOT EXISTS (SELECT 1);
  `
  it('parses VALUES tuples and SELECT seeds', () => {
    expect(parseGlAccountSeeds(sql).map(r => r.code)).toEqual(['6000', '6100', '1150'])
  })
  it('(a) a deliberately colliding seed FAILS', () => {
    const colliding = sql + "\nINSERT INTO gl_accounts (code, name_en, name_fa, type) VALUES ('6100','Salaries','حقوق و دستمزد','expense') ON CONFLICT (code) DO NOTHING;"
    expect(seedConflicts(parseGlAccountSeeds(sql))).toHaveLength(0)
    const c = seedConflicts(parseGlAccountSeeds(colliding))
    expect(c.map(x => x.code)).toEqual(['6100'])
  })
  it('(b) an unregistered literal and a contract/seed mismatch both fail', () => {
    const hits = findAccountLiterals('x.ts', "const l = { accountCode: '7777', debit: 1 }\nconst m = { accountCode: '6000' }\nconst A_ACCOUNTS = { a: '1150' } as const")
    expect(hits.map(h => h.code).sort()).toEqual(['1150', '6000', '7777'])
    const seeds = parseGlAccountSeeds(sql)
    const contract = { '6000': { type: 'expense' as const, nameEn: 'Salaries Expense' }, '1150': { type: 'asset' as const, nameEn: 'Due From Affiliates' } }
    expect(contractProblems(hits, contract, seeds).map(p => p.code)).toEqual(['7777'])
    const wrong = { ...contract, '6100': { type: 'expense' as const, nameEn: 'Salaries' } }
    expect(contractProblems([], wrong, seeds).map(p => p.code)).toEqual(['6100'])
  })
  it('a phone prefix `?? \'0098\'` is not an account literal', () => {
    expect(findAccountLiterals('y.ts', "const p = x ?? '0098'")).toHaveLength(0)
  })
})
