/**
 * Phase 28.3-الف — payroll API.
 *
 * R8/بند ۷: payroll is the most sensitive data the system holds, so four
 * separate authorities are enforced here rather than folded into `write` —
 * calculating a run, approving it, paying it, and editing the statutory
 * parameters are four different people's jobs in an auditable organisation.
 *
 * Amounts never reach the audit log. A payroll audit entry records WHICH slip
 * and WHAT happened, never what anyone earns.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, readJson, badRequest, guardJson, requirePermission, requireOp, notFound } from '@/lib/api/respond'
import { runOnce } from '@/lib/api/idempotency'
import { logAction } from '@/lib/admin/audit'
import { sensitiveFieldVisible, stripFields } from '@/lib/rbac/data'
import { SENSITIVE_FIELDS } from '@/lib/rbac/registry'
import { validateBrackets, exemptionMismatch, taxBreakdown } from '@/lib/hr/payroll'
import {
  listRulesets, rulesetById, copyRuleset, approveRuleset, rulesetEditable,
  parametersOf, bracketsOf, earningTypesOf, policyHistory,
  setParameter, addParameter, saveBrackets, saveEarningType, deleteEarningType,
  listPeriods, periodById, openPeriod, calculatePeriod, approvePeriod,
  postPeriodToGl, payPeriod, lockPeriod, correctSlip, reversePeriodGl,
  listSlips, slipDetail, periodTotals, listLoans, createLoan, payrollOverview,
} from '@/lib/hr/payrollData'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── schemas ─────────────────────────────────────────────────────────────────

const bracketRow = z.object({
  seq: z.number().int().min(0).max(50),
  fromAmount: z.number().min(0),
  toAmount: z.number().min(0).nullable(),
  ratePercent: z.number().min(0).max(100),
})

const schemas = {
  copyRuleset: z.object({
    action: z.literal('ruleset.copy'),
    sourceId: z.number().int().positive(),
    year: z.number().int().min(1300).max(1500),
    version: z.number().int().min(1).max(99),
    title: z.string().trim().max(200).optional().nullable(),
    effectiveFrom: z.string().trim().min(8).max(24),
    effectiveTo: z.string().trim().max(24).optional().nullable(),
    source: z.string().trim().max(300).optional().nullable(),
  }),
  approveRuleset: z.object({ action: z.literal('ruleset.approve'), id: z.number().int().positive() }),
  setParam: z.object({
    action: z.literal('parameter.set'),
    rulesetId: z.number().int().positive(),
    key: z.string().trim().min(1).max(64),
    value: z.number(),
  }),
  addParam: z.object({
    action: z.literal('parameter.add'),
    rulesetId: z.number().int().positive(),
    group: z.enum(['tax', 'insurance', 'labor', 'company']),
    key: z.string().trim().min(1).max(64).regex(/^[a-z0-9_]+$/, 'lowercase letters, digits and underscore only'),
    labelFa: z.string().trim().min(1).max(160),
    labelEn: z.string().trim().min(1).max(160),
    valueType: z.enum(['amount', 'percent', 'factor', 'boolean', 'integer']),
    value: z.number(),
    unit: z.string().trim().max(40).optional().nullable(),
    description: z.string().trim().max(400).optional().nullable(),
  }),
  saveBrackets: z.object({
    action: z.literal('brackets.save'),
    rulesetId: z.number().int().positive(),
    rows: z.array(bracketRow).min(1).max(50),
  }),
  saveEarning: z.object({
    action: z.literal('earning.save'),
    rulesetId: z.number().int().positive(),
    id: z.number().int().positive().optional(),
    key: z.string().trim().min(1).max(64).regex(/^[a-z0-9_]+$/),
    labelFa: z.string().trim().min(1).max(160),
    labelEn: z.string().trim().min(1).max(160),
    earningGroup: z.string().trim().max(40).optional(),
    recurring: z.boolean().optional(),
    insurable: z.enum(['yes', 'no', 'capped']).optional(),
    insurableCap: z.number().min(0).nullable().optional(),
    taxable: z.enum(['yes', 'no', 'capped']).optional(),
    taxableCap: z.number().min(0).nullable().optional(),
    inEidBase: z.boolean().optional(),
    inSeveranceBase: z.boolean().optional(),
    inOvertimeBase: z.boolean().optional(),
    calcMethod: z.enum(['fixed', 'percent_of_base', 'daily_prorated', 'per_child', 'manual']).optional(),
    calcValue: z.number().optional(),
    paramKey: z.string().trim().max(64).nullable().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  }),
  openPeriod: z.object({
    action: z.literal('period.open'),
    jalaliYear: z.number().int().min(1300).max(1500),
    jalaliMonth: z.number().int().min(1).max(12),
  }),
  periodOp: z.object({
    action: z.enum(['period.calculate', 'period.approve', 'period.post', 'period.pay', 'period.lock', 'period.reverseGl']),
    id: z.number().int().positive(),
  }),
  correct: z.object({
    action: z.literal('slip.correct'),
    slipId: z.number().int().positive(),
    manual: z.record(z.string(), z.number()).optional(),
  }),
  loan: z.object({
    action: z.literal('loan.create'),
    employeeId: z.number().int().positive(),
    totalAmount: z.number().min(0).max(1_000_000_000_000),
    installments: z.number().int().min(1).max(240),
    startDate: z.string().trim().max(24).optional().nullable(),
    note: z.string().trim().max(300).optional().nullable(),
  }),
}

async function scopeFor(userId: string, alias = 'e.user_id') {
  const { rowScopeSql } = await import('@/lib/rbac/data')
  return await rowScopeSql(userId, 'hr.payroll', alias, 1)
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.payroll', 'read')
    if ('error' in auth) return auth.error
    const sp = req.nextUrl.searchParams
    const view = sp.get('view') ?? 'periods'
    const canSeeAmounts = await sensitiveFieldVisible(auth.user.id, 'hr.payroll:amounts_view')

    if (view === 'rulesets') {
      return NextResponse.json({ rulesets: await listRulesets() })
    }

    if (view === 'ruleset') {
      const id = Number(sp.get('id'))
      const rs = await rulesetById(id)
      if (!rs) return notFound()
      const brackets = await bracketsOf(id)
      const params = await parametersOf(id)
      return NextResponse.json({
        ruleset: rs,
        parameters: params,
        brackets,
        earningTypes: await earningTypesOf(id),
        history: await policyHistory(id),
        editable: (await rulesetEditable(id)).ok,
        // Surfaced so the operator sees a stale exemption parameter instead of
        // trusting a number the calculation does not actually use.
        exemptionMismatch: exemptionMismatch(brackets, params),
      })
    }

    // Live preview: "with these parameters, what tax does X pay?" — answered
    // before the ruleset is approved, so a mistake is caught while it is cheap.
    if (view === 'preview') {
      const id = Number(sp.get('rulesetId'))
      const income = Number(sp.get('income') ?? 0)
      const brackets = await bracketsOf(id)
      if (!brackets.length) return badRequest('no brackets configured')
      return NextResponse.json({ breakdown: taxBreakdown(income, brackets) })
    }

    if (view === 'loans') {
      return NextResponse.json({ loans: await listLoans(sp.get('employeeId') ? Number(sp.get('employeeId')) : undefined) })
    }

    if (view === 'slips') {
      const periodId = Number(sp.get('periodId'))
      const sc = await scopeFor(auth.user.id)
      const slips = await listSlips(periodId, { scopeClause: sc.clause, scopeParams: sc.params })
      return NextResponse.json({
        slips: canSeeAmounts ? slips
          : stripFields(slips as unknown as Record<string, unknown>[],
              SENSITIVE_FIELDS['hr.payroll:amounts_view'].fields),
        totals: canSeeAmounts ? await periodTotals(periodId) : null,
        canSeeAmounts,
      })
    }

    if (view === 'slip') {
      const slipId = Number(sp.get('id'))
      const detail = await slipDetail(slipId)
      if (!detail) return notFound()
      // An out-of-scope payslip must be indistinguishable from a missing one.
      const owner = (await pgQuery<{ user_id: string | null }>(
        `SELECT user_id FROM hr_employees WHERE id=$1`, [detail.employeeId]))[0]
      const { rowInScope } = await import('@/lib/rbac/data')
      if (!owner || !(await rowInScope(auth.user.id, 'hr.payroll', owner.user_id))) return notFound()
      // Opening someone's payslip is itself recorded — never the amounts.
      await logAction(auth.user, 'VIEW', 'payroll_slips', slipId, null, { employeeId: detail.employeeId })
      return NextResponse.json({ slip: detail, canSeeAmounts })
    }

    return NextResponse.json({
      periods: await listPeriods(),
      rulesets: await listRulesets(),
      overview: await payrollOverview(),
      canSeeAmounts,
    })
  } catch (e: unknown) {
    return apiError(e)
  }
}

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.payroll', 'write', 'edit')
    if ('error' in auth) return auth.error
    const raw = await req.clone().json().catch(() => ({})) as { action?: string }

    // Editing statutory parameters is its own authority: these numbers decide
    // what the company owes the state.
    const settingsActions = ['ruleset.copy', 'ruleset.approve', 'parameter.set', 'parameter.add', 'brackets.save', 'earning.save']
    if (settingsActions.includes(raw.action ?? '')) {
      const denied = await requireOp(auth.user, 'hr.payroll:settings_write', 'manage_settings')
      if (denied) return denied
    }

    switch (raw.action) {
      case 'ruleset.copy': {
        const parsed = await readJson(req, schemas.copyRuleset)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/payroll/ruleset', d,
          () => copyRuleset(d.sourceId, d, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_rulesets', r.id!, null,
          { year: d.year, version: d.version, copiedFrom: d.sourceId })
        return NextResponse.json(r, { status: 201 })
      }

      case 'ruleset.approve': {
        const parsed = await readJson(req, schemas.approveRuleset)
        if ('error' in parsed) return parsed.error
        await approveRuleset(parsed.data.id, auth.user.id)
        await logAction(auth.user, 'UPDATE', 'payroll_rulesets', parsed.data.id, null, { approved: true })
        return NextResponse.json({ ok: true })
      }

      case 'parameter.set': {
        const parsed = await readJson(req, schemas.setParam)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const r = await setParameter(d.rulesetId, d.key, d.value, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_parameters', d.rulesetId, null, { key: d.key })
        return NextResponse.json(r)
      }

      case 'parameter.add': {
        const parsed = await readJson(req, schemas.addParam)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/payroll/param', d, () => addParameter(d.rulesetId, d, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_parameters', r.id!, null, { key: d.key, group: d.group })
        return NextResponse.json(r, { status: 201 })
      }

      case 'brackets.save': {
        const parsed = await readJson(req, schemas.saveBrackets)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        // Validate before touching the database: a gap or an overlap would not
        // throw at calculation time, it would silently tax someone wrongly.
        const issues = validateBrackets(d.rows)
        if (issues.length) return badRequest(`پلهٔ ${issues[0].seq}: ${issues[0].fa}`)
        const r = await saveBrackets(d.rulesetId, d.rows, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_tax_brackets', d.rulesetId, null, { rows: d.rows.length })
        return NextResponse.json(r)
      }

      case 'earning.save': {
        const parsed = await readJson(req, schemas.saveEarning)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const r = await saveEarningType(d.rulesetId, d, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, d.id ? 'UPDATE' : 'CREATE', 'payroll_earning_types', r.id!, null,
          { key: d.key, insurable: d.insurable, taxable: d.taxable })
        return NextResponse.json(r, { status: d.id ? 200 : 201 })
      }

      case 'period.open': {
        const parsed = await readJson(req, schemas.openPeriod)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/payroll/period', d,
          () => openPeriod(d.jalaliYear, d.jalaliMonth, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_periods', r.id!, null,
          { jalaliYear: d.jalaliYear, jalaliMonth: d.jalaliMonth })
        return NextResponse.json(r, { status: 201 })
      }

      case 'period.calculate':
      case 'period.approve':
      case 'period.post':
      case 'period.pay':
      case 'period.lock':
      case 'period.reverseGl': {
        const parsed = await readJson(req, schemas.periodOp)
        if ('error' in parsed) return parsed.error
        const { id, action } = parsed.data
        if (!(await periodById(id))) return notFound()

        // 🔴 Each step is its own grant. Approving and paying additionally sit
        // under the mandatory-2FA policy (26.28) via requireOp.
        const opFor: Record<string, { op: string; legacy: 'edit' | 'manage_settings' }> = {
          'period.calculate': { op: 'hr.payroll:calculate', legacy: 'edit' },
          'period.approve': { op: 'hr.payroll:approve', legacy: 'manage_settings' },
          'period.post': { op: 'hr.payroll:approve', legacy: 'manage_settings' },
          'period.pay': { op: 'hr.payroll:pay', legacy: 'manage_settings' },
          'period.lock': { op: 'hr.payroll:pay', legacy: 'manage_settings' },
          'period.reverseGl': { op: 'hr.payroll:approve', legacy: 'manage_settings' },
        }
        const gate = opFor[action]
        const denied = await requireOp(auth.user, gate.op, gate.legacy)
        if (denied) return denied

        const result =
          action === 'period.calculate' ? await calculatePeriod(id, auth.user.id)
            : action === 'period.approve' ? await approvePeriod(id, auth.user.id)
              : action === 'period.post' ? await postPeriodToGl(id, auth.user.id)
                : action === 'period.pay' ? await payPeriod(id, auth.user.id)
                  : action === 'period.lock' ? await lockPeriod(id)
                    : await reversePeriodGl(id, auth.user.id)

        if (!result.ok) return badRequest(result.error ?? 'Failed')
        // No amounts in the audit payload — only what happened, to which period.
        await logAction(auth.user, 'UPDATE', 'payroll_periods', id, null, { action })
        return NextResponse.json(result)
      }

      case 'slip.correct': {
        const parsed = await readJson(req, schemas.correct)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:approve', 'manage_settings')
        if (denied) return denied
        const d = parsed.data
        const r = await correctSlip(d.slipId, d.manual ?? {}, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_slips', d.slipId, null,
          { corrected: true, reversalId: r.reversalId, correctionId: r.correctionId })
        return NextResponse.json(r)
      }

      case 'loan.create': {
        const parsed = await readJson(req, schemas.loan)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const id = await runOnce(auth.user.id, 'hr/payroll/loan', d, () => createLoan(d, auth.user.id))
        // The amount is deliberately absent from the audit payload.
        await logAction(auth.user, 'CREATE', 'payroll_loans', id, null,
          { employeeId: d.employeeId, installments: d.installments })
        return NextResponse.json({ id }, { status: 201 })
      }

      default:
        return badRequest('Unknown action')
    }
  } catch (e: unknown) {
    return apiError(e)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission('hr.payroll', 'write', 'delete')
    if ('error' in auth) return auth.error
    const denied = await requireOp(auth.user, 'hr.payroll:settings_write', 'manage_settings')
    if (denied) return denied
    const body = await guardJson(req).catch(() => ({})) as { id?: number; rulesetId?: number; kind?: string }
    if (!body.id || !body.rulesetId) return badRequest('id and rulesetId required')
    // 🔴 Only configuration is deletable. A slip is never erased — it is
    // reversed and superseded by a correction slip, so the history survives.
    if (body.kind !== 'earning') {
      return badRequest('فقط اقلام حقوقی حذف می‌شوند؛ فیش حذف نمی‌شود — با فیش اصلاحی برگشت می‌خورد')
    }
    const r = await deleteEarningType(body.rulesetId, body.id)
    if (!r.ok) return badRequest(r.error ?? 'Failed')
    await logAction(auth.user, 'DELETE', 'payroll_earning_types', body.id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return apiError(e)
  }
}
