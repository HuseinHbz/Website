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
import {
  listEid, calculateEidForYear, approveEid, postEidToGl, reverseEid,
  listSeverance, calculateSeveranceFor, approveSeverance, postSeveranceToGl,
  accrueSeveranceForPeriod, listSettlements, buildSettlement, approveSettlement,
  postSettlementToGl, listExportLayouts, saveExportLayout, renderLegalExport,
  annualOverview,
  listBankFormats, saveBankFormat, addBankFormat, listBankBatches, bankBatchLines,
  previewBankBatch, generateBankBatch, renderBankFile, markBatchSent, confirmBatch,
  listAdvances, requestAdvance, approveAdvance, payAdvance,
} from '@/lib/hr/annualData'
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
  // ── 28.3-ب ──
  eidCalc: z.object({
    action: z.literal('eid.calculate'),
    jalaliYear: z.number().int().min(1300).max(1500),
  }),
  eidOp: z.object({
    action: z.enum(['eid.approve', 'eid.post', 'eid.reverse']),
    id: z.number().int().positive(),
  }),
  severanceCalc: z.object({
    action: z.literal('severance.calculate'),
    employeeId: z.number().int().positive(),
    endDate: z.string().trim().min(8).max(24),
  }),
  severanceOp: z.object({
    action: z.enum(['severance.approve', 'severance.post']),
    id: z.number().int().positive(),
  }),
  severanceAccrue: z.object({
    action: z.literal('severance.accrue'),
    periodId: z.number().int().positive(),
  }),
  settlementBuild: z.object({
    action: z.literal('settlement.build'),
    employeeId: z.number().int().positive(),
    endDate: z.string().trim().min(8).max(24),
    reason: z.string().trim().max(300).optional().nullable(),
    otherDeductions: z.number().min(0).max(1_000_000_000_000).optional(),
  }),
  settlementOp: z.object({
    action: z.enum(['settlement.approve', 'settlement.post']),
    id: z.number().int().positive(),
  }),
  exportLayout: z.object({
    action: z.literal('export.saveLayout'),
    key: z.string().trim().min(1).max(64),
    columns: z.array(z.object({
      key: z.string().trim().min(1).max(64),
      labelFa: z.string().trim().min(1).max(120),
      labelEn: z.string().trim().max(120).optional(),
    })).min(1).max(60),
    delimiter: z.string().max(4).optional(),
    includeHeader: z.boolean().optional(),
    verified: z.boolean().optional(),
    note: z.string().trim().max(400).optional().nullable(),
  }),
  // ── 28.3-ج ──
  bankFormatSave: z.object({
    action: z.literal('bankFormat.save'),
    key: z.string().trim().min(1).max(64),
    bankName: z.string().trim().max(160).optional(),
    columns: z.array(z.object({
      key: z.string().trim().min(1).max(64),
      labelFa: z.string().trim().min(1).max(120),
      labelEn: z.string().trim().max(120).optional(),
    })).min(1).max(60).optional(),
    delimiter: z.string().max(4).optional(),
    fileType: z.enum(['csv', 'txt', 'xlsx']).optional(),
    includeHeader: z.boolean().optional(),
    verified: z.boolean().optional(),
    note: z.string().trim().max(400).optional().nullable(),
  }),
  bankFormatAdd: z.object({
    action: z.literal('bankFormat.add'),
    key: z.string().trim().min(1).max(64).regex(/^[a-z0-9_]+$/),
    bankName: z.string().trim().min(1).max(160),
    columns: z.array(z.object({
      key: z.string().trim().min(1).max(64),
      labelFa: z.string().trim().min(1).max(120),
    })).min(1).max(60),
  }),
  bankBatchGenerate: z.object({
    action: z.literal('bankBatch.generate'),
    periodId: z.number().int().positive(),
    formatId: z.number().int().positive(),
    sourceAccount: z.string().trim().max(64).optional().nullable(),
    paymentDate: z.string().trim().min(8).max(24),
  }),
  bankBatchOp: z.object({
    action: z.enum(['bankBatch.send']),
    id: z.number().int().positive(),
  }),
  bankBatchConfirm: z.object({
    action: z.literal('bankBatch.confirm'),
    id: z.number().int().positive(),
    rejectedEmployeeIds: z.array(z.number().int().positive()).optional(),
  }),
  advanceRequest: z.object({
    action: z.literal('advance.request'),
    employeeId: z.number().int().positive(),
    amount: z.number().min(0).max(1_000_000_000_000),
    deductJalaliYear: z.number().int().min(1300).max(1500),
    deductJalaliMonth: z.number().int().min(1).max(12),
    note: z.string().trim().max(300).optional().nullable(),
  }),
  advanceOp: z.object({
    action: z.enum(['advance.approve', 'advance.pay']),
    id: z.number().int().positive(),
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

    if (view === 'eid') {
      const sc = await scopeFor(auth.user.id)
      const rows = await listEid(sp.get('year') ? Number(sp.get('year')) : undefined,
        { scopeClause: sc.clause, scopeParams: sc.params })
      return NextResponse.json({
        eid: canSeeAmounts ? rows
          : stripFields(rows as unknown as Record<string, unknown>[],
              SENSITIVE_FIELDS['hr.payroll:amounts_view'].fields),
        overview: await annualOverview(), canSeeAmounts,
      })
    }

    if (view === 'severance') {
      const sc = await scopeFor(auth.user.id)
      const rows = await listSeverance({
        employeeId: sp.get('employeeId') ? Number(sp.get('employeeId')) : undefined,
        scopeClause: sc.clause, scopeParams: sc.params,
      })
      return NextResponse.json({
        severance: canSeeAmounts ? rows
          : stripFields(rows as unknown as Record<string, unknown>[],
              SENSITIVE_FIELDS['hr.payroll:amounts_view'].fields),
        overview: await annualOverview(), canSeeAmounts,
      })
    }

    if (view === 'settlements') {
      const sc = await scopeFor(auth.user.id)
      const rows = await listSettlements({ scopeClause: sc.clause, scopeParams: sc.params })
      return NextResponse.json({
        settlements: canSeeAmounts ? rows
          : stripFields(rows as unknown as Record<string, unknown>[],
              SENSITIVE_FIELDS['hr.payroll:amounts_view'].fields),
        canSeeAmounts,
      })
    }

    if (view === 'exportLayouts') {
      return NextResponse.json({ layouts: await listExportLayouts() })
    }

    // The legal export itself. Amounts are the whole point of the file, so it
    // needs the amounts grant — a coordinator without it cannot download it.
    if (view === 'export') {
      if (!canSeeAmounts) return notFound()
      const r = await renderLegalExport(Number(sp.get('periodId')), sp.get('layout') ?? '')
      if (!r.ok) return badRequest(r.error ?? 'Failed')
      await logAction(auth.user, 'VIEW', 'payroll_export_layouts', 0, null,
        { periodId: Number(sp.get('periodId')), layout: sp.get('layout') })
      return new NextResponse(r.csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${r.filename}"`,
          // Surfaced in a header too, so a script that downloads the file still
          // learns the layout was never checked against a real submission.
          'X-Layout-Verified': r.verified ? '1' : '0',
        },
      })
    }

    if (view === 'bankFormats') {
      return NextResponse.json({ formats: await listBankFormats() })
    }
    if (view === 'bankBatches') {
      return NextResponse.json({ batches: await listBankBatches() })
    }
    if (view === 'bankBatchLines') {
      return NextResponse.json({ lines: await bankBatchLines(Number(sp.get('id'))) })
    }
    if (view === 'bankBatchPreview') {
      return NextResponse.json({ checks: await previewBankBatch(Number(sp.get('periodId'))) })
    }
    if (view === 'bankFile') {
      if (!canSeeAmounts) return notFound()
      const r = await renderBankFile(Number(sp.get('id')))
      if (!r.ok) return badRequest(r.error ?? 'Failed')
      await logAction(auth.user, 'VIEW', 'payroll_bank_batches', Number(sp.get('id')))
      return new NextResponse(r.csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${r.filename}"`,
          'X-Layout-Verified': r.verified ? '1' : '0',
        },
      })
    }
    if (view === 'advances') {
      return NextResponse.json({ advances: await listAdvances(sp.get('employeeId') ? Number(sp.get('employeeId')) : undefined) })
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

      // ── 28.3-ب: annual entitlements ──
      case 'eid.calculate': {
        const parsed = await readJson(req, schemas.eidCalc)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:calculate', 'edit')
        if (denied) return denied
        const r = await runOnce(auth.user.id, 'hr/payroll/eid', parsed.data,
          () => calculateEidForYear(parsed.data.jalaliYear, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_eid_calculations', 0, null,
          { jalaliYear: parsed.data.jalaliYear, count: r.count })
        return NextResponse.json(r, { status: 201 })
      }

      case 'eid.approve':
      case 'eid.post':
      case 'eid.reverse': {
        const parsed = await readJson(req, schemas.eidOp)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:approve', 'manage_settings')
        if (denied) return denied
        const { id, action } = parsed.data
        const r = action === 'eid.approve' ? await approveEid(id, auth.user.id)
          : action === 'eid.post' ? await postEidToGl(id, auth.user.id)
            : await reverseEid(id, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_eid_calculations', id, null, { action })
        return NextResponse.json(r)
      }

      case 'severance.calculate': {
        const parsed = await readJson(req, schemas.severanceCalc)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:calculate', 'edit')
        if (denied) return denied
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/payroll/severance', d,
          () => calculateSeveranceFor(d.employeeId, d.endDate, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_severance_calculations', r.id!, null,
          { employeeId: d.employeeId, endDate: d.endDate })
        return NextResponse.json(r, { status: 201 })
      }

      case 'severance.approve':
      case 'severance.post': {
        const parsed = await readJson(req, schemas.severanceOp)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:approve', 'manage_settings')
        if (denied) return denied
        const { id, action } = parsed.data
        const r = action === 'severance.approve'
          ? await approveSeverance(id, auth.user.id)
          : await postSeveranceToGl(id, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_severance_calculations', id, null, { action })
        return NextResponse.json(r)
      }

      case 'severance.accrue': {
        const parsed = await readJson(req, schemas.severanceAccrue)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:approve', 'manage_settings')
        if (denied) return denied
        const r = await accrueSeveranceForPeriod(parsed.data.periodId, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_severance_accruals', parsed.data.periodId, null,
          { employees: r.employees })
        return NextResponse.json(r)
      }

      case 'settlement.build': {
        const parsed = await readJson(req, schemas.settlementBuild)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:calculate', 'edit')
        if (denied) return denied
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/payroll/settlement', d,
          () => buildSettlement(d.employeeId, d.endDate, d.reason ?? null, d.otherDeductions ?? 0, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_settlements', r.id!, null,
          { employeeId: d.employeeId, endDate: d.endDate })
        return NextResponse.json(r, { status: 201 })
      }

      case 'settlement.approve':
      case 'settlement.post': {
        const parsed = await readJson(req, schemas.settlementOp)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:pay', 'manage_settings')
        if (denied) return denied
        const { id, action } = parsed.data
        const r = action === 'settlement.approve'
          ? await approveSettlement(id, auth.user.id)
          : await postSettlementToGl(id, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_settlements', id, null, { action })
        return NextResponse.json(r)
      }

      case 'export.saveLayout': {
        const parsed = await readJson(req, schemas.exportLayout)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:settings_write', 'manage_settings')
        if (denied) return denied
        const d = parsed.data
        const r = await saveExportLayout(d.key, d)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_export_layouts', 0, null,
          { key: d.key, columns: d.columns.length, verified: d.verified })
        return NextResponse.json(r)
      }

      // ── 28.3-ج ──
      case 'bankFormat.save': {
        const parsed = await readJson(req, schemas.bankFormatSave)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:settings_write', 'manage_settings')
        if (denied) return denied
        const d = parsed.data
        const r = await saveBankFormat(d.key, d)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_bank_formats', 0, null, { key: d.key })
        return NextResponse.json(r)
      }

      case 'bankFormat.add': {
        const parsed = await readJson(req, schemas.bankFormatAdd)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:settings_write', 'manage_settings')
        if (denied) return denied
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/payroll/bankFormat', d,
          () => addBankFormat(d.key, d.bankName, d.columns))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_bank_formats', r.id!, null, { key: d.key })
        return NextResponse.json(r, { status: 201 })
      }

      case 'bankBatch.generate': {
        const parsed = await readJson(req, schemas.bankBatchGenerate)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:pay', 'manage_settings')
        if (denied) return denied
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/payroll/bankBatch', d,
          () => generateBankBatch(d.periodId, d.formatId, d.sourceAccount ?? null, d.paymentDate, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_bank_batches', r.id!, null, { periodId: d.periodId })
        return NextResponse.json(r, { status: r.alreadyExists ? 200 : 201 })
      }

      case 'bankBatch.send': {
        const parsed = await readJson(req, schemas.bankBatchOp)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:pay', 'manage_settings')
        if (denied) return denied
        const r = await markBatchSent(parsed.data.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_bank_batches', parsed.data.id, null, { action: 'send' })
        return NextResponse.json(r)
      }

      case 'bankBatch.confirm': {
        const parsed = await readJson(req, schemas.bankBatchConfirm)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:pay', 'manage_settings')
        if (denied) return denied
        const d = parsed.data
        const r = await confirmBatch(d.id, d.rejectedEmployeeIds ?? [], auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_bank_batches', d.id, null,
          { action: 'confirm', rejected: (d.rejectedEmployeeIds ?? []).length })
        return NextResponse.json(r)
      }

      case 'advance.request': {
        const parsed = await readJson(req, schemas.advanceRequest)
        if ('error' in parsed) return parsed.error
        const d = parsed.data
        const r = await runOnce(auth.user.id, 'hr/payroll/advance', d,
          () => requestAdvance(d.employeeId, d.amount, d.deductJalaliYear, d.deductJalaliMonth, d.note ?? null, auth.user.id))
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'CREATE', 'payroll_advances', r.id!, null,
          { employeeId: d.employeeId, deductJalaliYear: d.deductJalaliYear, deductJalaliMonth: d.deductJalaliMonth })
        return NextResponse.json(r, { status: 201 })
      }

      case 'advance.approve':
      case 'advance.pay': {
        const parsed = await readJson(req, schemas.advanceOp)
        if ('error' in parsed) return parsed.error
        const denied = await requireOp(auth.user, 'hr.payroll:pay', 'manage_settings')
        if (denied) return denied
        const { id, action } = parsed.data
        const r = action === 'advance.approve' ? await approveAdvance(id, auth.user.id) : await payAdvance(id, auth.user.id)
        if (!r.ok) return badRequest(r.error ?? 'Failed')
        await logAction(auth.user, 'UPDATE', 'payroll_advances', id, null, { action })
        return NextResponse.json(r)
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
