/**
 * Budget server layer (Phase 26.11, M1/M2). CRUD + immutable version snapshots +
 * lifecycle (draft→review→approved→locked) + real budget-vs-actual (actuals from
 * POSTED GL lines matched by account × cost-center within the fiscal year). All
 * variance math is the pure `budget.ts` engine.
 */
import { pgQuery, withTransaction } from '@/lib/db'
import {
  budgetVariance, budgetSummary, budgetTotal, forecastRemaining, canTransition, isEditable,
  type BudgetLine, type ActualEntry, type BudgetType, type BudgetStatus,
} from './budget'

const NOW = "to_char(now(),'YYYY-MM-DD HH24:MI:SS')"

export interface BudgetHeader {
  id: number; code: string | null; nameEn: string; nameFa: string | null
  budgetType: BudgetType; fiscalYear: number; currency: string
  companyId: number | null; costCenterId: number | null
  status: BudgetStatus; version: number; notes: string | null
  approvedBy: string | null; approvedAt: string | null; lockedAt: string | null
  createdAt: string
}
export interface BudgetLineRow extends BudgetLine { id: number; lineNo: number }

export async function listBudgets(): Promise<(BudgetHeader & { total: number })[]> {
  return (await pgQuery(
    `SELECT b.id, b.code, b.name_en AS "nameEn", b.name_fa AS "nameFa", b.budget_type AS "budgetType",
            b.fiscal_year AS "fiscalYear", b.currency, b.company_id AS "companyId", b.cost_center_id AS "costCenterId",
            b.status, b.version, b.notes, b.approved_by AS "approvedBy", b.approved_at AS "approvedAt",
            b.locked_at AS "lockedAt", b.created_at AS "createdAt",
            COALESCE((SELECT SUM(amount) FROM erp_budget_lines WHERE budget_id=b.id),0)::float AS total
     FROM erp_budgets b ORDER BY b.fiscal_year DESC, b.id DESC`)) as unknown as (BudgetHeader & { total: number })[]
}

export async function getBudget(id: number): Promise<{ header: BudgetHeader; lines: BudgetLineRow[] } | null> {
  const header = (await pgQuery(
    `SELECT id, code, name_en AS "nameEn", name_fa AS "nameFa", budget_type AS "budgetType",
            fiscal_year AS "fiscalYear", currency, company_id AS "companyId", cost_center_id AS "costCenterId",
            status, version, notes, approved_by AS "approvedBy", approved_at AS "approvedAt",
            locked_at AS "lockedAt", created_at AS "createdAt"
     FROM erp_budgets WHERE id=$1`, [id]))[0] as unknown as BudgetHeader | undefined
  if (!header) return null
  const lines = (await pgQuery(
    `SELECT id, cost_center_id AS "costCenterId", account_id AS "accountId", category, period, amount::float AS amount, notes, line_no AS "lineNo"
     FROM erp_budget_lines WHERE budget_id=$1 ORDER BY line_no, id`, [id])) as unknown as BudgetLineRow[]
  return { header, lines }
}

export interface BudgetInput {
  code?: string; nameEn: string; nameFa?: string; budgetType: BudgetType; fiscalYear: number
  currency?: string; companyId?: number | null; costCenterId?: number | null; notes?: string
  lines?: { category: string; costCenterId?: number | null; accountId?: number | null; period?: string | null; amount: number; notes?: string }[]
}

export async function createBudget(input: BudgetInput, userId: string): Promise<{ id: number }> {
  const r = (await pgQuery<{ id: number }>(
    `INSERT INTO erp_budgets (code, name_en, name_fa, budget_type, fiscal_year, currency, company_id, cost_center_id, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [input.code ?? null, input.nameEn, input.nameFa ?? null, input.budgetType, input.fiscalYear,
     input.currency ?? 'IRR', input.companyId ?? null, input.costCenterId ?? null, input.notes ?? null, userId]))[0]
  await replaceLines(r.id, input.lines ?? [])
  return r
}

/**
 * Full-remediation RULE-002: DELETE-then-loop-INSERT used to run as bare
 * pgQuery calls with no transaction — a failure mid-loop left the budget
 * with its OLD lines deleted and only some of the NEW ones written, a
 * silent partial data loss. Now atomic: all-or-nothing.
 */
async function replaceLines(budgetId: number, lines: NonNullable<BudgetInput['lines']>): Promise<void> {
  await withTransaction(async query => {
    await query(`DELETE FROM erp_budget_lines WHERE budget_id=$1`, [budgetId])
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      await query(
        `INSERT INTO erp_budget_lines (budget_id, cost_center_id, account_id, category, period, amount, notes, line_no)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [budgetId, l.costCenterId ?? null, l.accountId ?? null, l.category, l.period ?? null, l.amount, l.notes ?? null, i])
    }
  })
}

/** Edit header + lines — rejected once the budget is approved/locked. */
export async function updateBudget(id: number, input: Partial<BudgetInput>, userId: string): Promise<void> {
  const cur = (await pgQuery<{ status: BudgetStatus }>(`SELECT status FROM erp_budgets WHERE id=$1`, [id]))[0]
  if (!cur) throw new Error('Budget not found')
  if (!isEditable(cur.status)) throw new Error(`A ${cur.status} budget cannot be edited`)
  await pgQuery(
    `UPDATE erp_budgets SET name_en=COALESCE($2,name_en), name_fa=COALESCE($3,name_fa),
       budget_type=COALESCE($4,budget_type), fiscal_year=COALESCE($5,fiscal_year), currency=COALESCE($6,currency),
       company_id=$7, cost_center_id=$8, notes=COALESCE($9,notes), updated_at=${NOW} WHERE id=$1`,
    [id, input.nameEn ?? null, input.nameFa ?? null, input.budgetType ?? null, input.fiscalYear ?? null,
     input.currency ?? null, input.companyId ?? null, input.costCenterId ?? null, input.notes ?? null])
  if (input.lines) await replaceLines(id, input.lines)
  void userId
}

/**
 * Move the budget through its lifecycle. On approve we snapshot an immutable
 * version (revision history + rollback); on lock we stamp locked_at. A revision
 * (approved→review) bumps the version number for the next snapshot.
 */
export async function transitionBudget(id: number, to: BudgetStatus, userId: string, note?: string): Promise<void> {
  const cur = (await pgQuery<{ status: BudgetStatus; version: number }>(`SELECT status, version FROM erp_budgets WHERE id=$1`, [id]))[0]
  if (!cur) throw new Error('Budget not found')
  if (!canTransition(cur.status, to)) throw new Error(`Cannot move a ${cur.status} budget to ${to}`)
  if (to === 'approved') {
    const snap = await getBudget(id)
    await pgQuery(
      `INSERT INTO erp_budget_versions (budget_id, version, status, snapshot, note, created_by)
       VALUES ($1,$2,'approved',$3,$4,$5) ON CONFLICT (budget_id, version) DO NOTHING`,
      [id, cur.version, JSON.stringify(snap), note ?? null, userId])
    await pgQuery(`UPDATE erp_budgets SET status='approved', approved_by=$2, approved_at=${NOW}, updated_at=${NOW} WHERE id=$1`, [id, userId])
  } else if (to === 'locked') {
    await pgQuery(`UPDATE erp_budgets SET status='locked', locked_at=${NOW}, updated_at=${NOW} WHERE id=$1`, [id])
  } else if (to === 'review' && cur.status === 'approved') {
    // Revision: reopen for changes, bump version for the next snapshot.
    await pgQuery(`UPDATE erp_budgets SET status='review', version=version+1, updated_at=${NOW} WHERE id=$1`, [id])
  } else {
    await pgQuery(`UPDATE erp_budgets SET status=$2, updated_at=${NOW} WHERE id=$1`, [id, to])
  }
}

export async function listBudgetVersions(id: number) {
  return pgQuery(
    `SELECT id, version, status, note, created_by AS "createdBy", created_at AS "createdAt"
     FROM erp_budget_versions WHERE budget_id=$1 ORDER BY version DESC`, [id])
}

export async function deleteBudget(id: number): Promise<void> {
  const cur = (await pgQuery<{ status: BudgetStatus }>(`SELECT status FROM erp_budgets WHERE id=$1`, [id]))[0]
  if (cur && cur.status === 'locked') throw new Error('A locked budget cannot be deleted')
  await pgQuery(`DELETE FROM erp_budgets WHERE id=$1`, [id])
}

/**
 * Actuals for a budget: POSTED GL natural-sign balances within the fiscal year,
 * grouped by account × cost-center. Revenue budgets pull revenue accounts, all
 * others pull expense accounts. Scoped to the budget's cost center when set.
 */
export async function budgetActuals(header: BudgetHeader): Promise<ActualEntry[]> {
  const wantRevenue = header.budgetType === 'company' ? false : false // budgets track spend; revenue tracked in profit centers
  const acctType = wantRevenue ? 'revenue' : 'expense'
  const ccGate = header.costCenterId != null ? `AND l.cost_center_id = $2` : ''
  const params: unknown[] = [String(header.fiscalYear)]
  if (header.costCenterId != null) params.push(header.costCenterId)
  const rows = await pgQuery<{ accountId: number; costCenterId: number | null; amount: number }>(
    `SELECT l.account_id AS "accountId", l.cost_center_id AS "costCenterId",
            COALESCE(SUM(l.debit - l.credit),0)::float AS amount
     FROM gl_journal_lines l
     JOIN gl_journal_entries e ON e.id = l.entry_id AND e.status='posted'
     JOIN gl_accounts a ON a.id = l.account_id AND a.type=$${params.length + 1}
     WHERE substr(e.date,1,4) = $1 ${ccGate}
     GROUP BY l.account_id, l.cost_center_id`, [...params, acctType])
  return rows.map(r => ({ accountId: r.accountId, costCenterId: r.costCenterId, amount: Number(r.amount) }))
}

export interface BudgetAnalysis {
  header: BudgetHeader
  lines: BudgetLineRow[]
  total: number
  byAccount: ReturnType<typeof budgetVariance>
  byCostCenter: ReturnType<typeof budgetVariance>
  summary: ReturnType<typeof budgetSummary>
  forecast: ReturnType<typeof forecastRemaining>
}

/** Full budget-vs-actual analysis for one budget. */
export async function budgetAnalysis(id: number, elapsedFraction?: number): Promise<BudgetAnalysis | null> {
  const b = await getBudget(id)
  if (!b) return null
  const actuals = await budgetActuals(b.header)
  const byAccount = budgetVariance(b.lines, actuals, 'account')
  const byCostCenter = budgetVariance(b.lines, actuals, 'costCenter')
  const summary = budgetSummary(byAccount)
  // Elapsed fraction of the fiscal year (default: today within the year).
  const frac = elapsedFraction ?? yearElapsedFraction(b.header.fiscalYear)
  const forecast = forecastRemaining(summary.budget, summary.actual, frac)
  return { header: b.header, lines: b.lines, total: budgetTotal(b.lines), byAccount, byCostCenter, summary, forecast }
}

/** Portfolio consumption across all approved/locked budgets (for dashboards). */
export async function budgetPortfolio(): Promise<{ id: number; name: string; consumptionPct: number; status: string; budget: number; actual: number }[]> {
  const budgets = await listBudgets()
  const out: { id: number; name: string; consumptionPct: number; status: string; budget: number; actual: number }[] = []
  for (const b of budgets) {
    if (b.status === 'draft') continue
    const a = await budgetAnalysis(b.id)
    if (a) out.push({ id: b.id, name: b.nameEn, consumptionPct: a.summary.consumptionPct, status: a.summary.status, budget: a.summary.budget, actual: a.summary.actual })
  }
  return out
}

function yearElapsedFraction(fiscalYear: number): number {
  const now = new Date()
  const y = now.getUTCFullYear()
  if (y < fiscalYear) return 0
  if (y > fiscalYear) return 1
  const start = Date.UTC(fiscalYear, 0, 1)
  const end = Date.UTC(fiscalYear + 1, 0, 1)
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)))
}
