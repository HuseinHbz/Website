/**
 * Operational Health Center assembly (Phase 26.20, PART 11). Composes the
 * platform's ALREADY-VERIFIED diagnostics — self-heal findings, the accounting
 * validation engine, master-data quality (26.16), open financial/business
 * alerts (26.11/26.13), the Operations snapshot, workflow + integration state —
 * into one consolidated ERP health + risk view. Read-only; no new detectors.
 */
import { pgQuery } from '@/lib/db'
import { opsSnapshot } from '@/lib/ops/snapshot'
import { scanLedgerIntegrity } from '@/lib/erp/accountingValidationData'
import { masterDataOverview } from '@/lib/masterdata/masterDataData'
import { overallHealth, healthGrade, type HealthComponent } from './selfheal'
import { lastRun } from './selfhealData'

async function count(sql: string): Promise<number> {
  try { return Number((await pgQuery<{ n: number }>(sql))[0]?.n ?? 0) } catch { return 0 }
}

export interface HealthOverview {
  overall: number
  grade: ReturnType<typeof healthGrade>
  risk: number
  components: (HealthComponent & { grade: ReturnType<typeof healthGrade>; detailEn: string; detailFa: string })[]
  selfheal: Awaited<ReturnType<typeof lastRun>>
  alerts: { financialOpen: number; businessOpen: number }
  automation: { workflows24h: number; failed24h: number; waiting: number }
  integrations: { dispatches24h: number; deadLetter: number }
  generatedAt: string
}

/** Assemble the consolidated health view. Every subsystem degrades gracefully. */
export async function healthOverview(): Promise<HealthOverview> {
  const [heal, ledger, md, ops] = await Promise.all([
    lastRun(),
    scanLedgerIntegrity({ status: 'posted' }),
    masterDataOverview(),
    opsSnapshot(),
  ])

  // Alerts + automation + integration counts (each guarded).
  const [finOpen, bizOpen, wf24, wfFail24, wfWaiting, disp24, dlq, sec24] = await Promise.all([
    count(`SELECT COUNT(*)::int AS n FROM erp_financial_alerts WHERE status='open'`),
    count(`SELECT COUNT(*)::int AS n FROM business_alerts WHERE status='open'`),
    count(`SELECT COUNT(*)::int AS n FROM workflow_runs WHERE started_at::timestamp > now() - interval '24 hours'`),
    count(`SELECT COUNT(*)::int AS n FROM workflow_runs WHERE status='failed' AND started_at::timestamp > now() - interval '24 hours'`),
    count(`SELECT COUNT(*)::int AS n FROM workflow_runs WHERE status='waiting'`),
    count(`SELECT COUNT(*)::int AS n FROM integration_dispatches WHERE created_at::timestamp > now() - interval '24 hours'`),
    count(`SELECT COUNT(*)::int AS n FROM integration_dispatches WHERE status='dead' AND resolved=0`),
    count(`SELECT COUNT(*)::int AS n FROM system_logs WHERE source='security' AND ts::timestamp > now() - interval '24 hours'`),
  ])

  const healRisk = heal.run ? heal.run.risk : 0
  const erpScore = Math.max(0, 100 - healRisk)
  const businessScore = Math.max(0, 100 - Math.min(100, finOpen * 6 + bizOpen * 6))
  const financialScore = ledger.entriesChecked === 0 ? 100 : ledger.score
  const securityScore = Math.max(0, 100 - Math.min(100, sec24 * 4))
  const perfScore = Math.round(
    (ops.sre.availabilityPct >= ops.sre.sloTarget ? 60 : 60 * (ops.sre.availabilityPct / Math.max(1, ops.sre.sloTarget)))
    + (ops.metrics.memPct < 90 ? 20 : 5)
    + (ops.metrics.dbLatencyMs !== null && ops.metrics.dbLatencyMs < 100 ? 20 : 5))
  const workflowScore = Math.max(0, 100 - Math.min(100, wfFail24 * 10))
  const dataQualityScore = md.overall
  const integrationScore = Math.max(0, 100 - Math.min(100, dlq * 10))

  const components: HealthOverview['components'] = [
    { key: 'erp', en: 'ERP Health', fa: 'سلامت ERP', score: erpScore, weight: 3, grade: healthGrade(erpScore), detailEn: heal.run ? `self-heal risk ${healRisk}` : 'no self-heal run yet', detailFa: heal.run ? `ریسک خودترمیمی ${healRisk}` : 'هنوز اجرا نشده' },
    { key: 'business', en: 'Business Health', fa: 'سلامت کسب‌وکار', score: businessScore, weight: 2, grade: healthGrade(businessScore), detailEn: `${finOpen + bizOpen} open alert(s)`, detailFa: `${finOpen + bizOpen} هشدار باز` },
    { key: 'financial', en: 'Financial Health', fa: 'سلامت مالی', score: financialScore, weight: 3, grade: healthGrade(financialScore), detailEn: `${ledger.withIssues}/${ledger.entriesChecked} posted entries with issues`, detailFa: `${ledger.withIssues} سند قطعی دارای اشکال از ${ledger.entriesChecked}` },
    { key: 'security', en: 'Security Health', fa: 'سلامت امنیتی', score: securityScore, weight: 2, grade: healthGrade(securityScore), detailEn: `${sec24} security events (24h)`, detailFa: `${sec24} رخداد امنیتی (۲۴ ساعت)` },
    { key: 'performance', en: 'Performance Health', fa: 'سلامت کارایی', score: perfScore, weight: 1, grade: healthGrade(perfScore), detailEn: `availability ${ops.sre.availabilityPct}% · db ${ops.metrics.dbLatencyMs ?? '—'}ms`, detailFa: `دسترس‌پذیری ${ops.sre.availabilityPct}٪ · دیتابیس ${ops.metrics.dbLatencyMs ?? '—'}ms` },
    { key: 'workflow', en: 'Workflow Health', fa: 'سلامت گردش‌کار', score: workflowScore, weight: 1, grade: healthGrade(workflowScore), detailEn: `${wfFail24} failed / ${wf24} runs (24h), ${wfWaiting} waiting`, detailFa: `${wfFail24} ناموفق از ${wf24} اجرا (۲۴ ساعت)، ${wfWaiting} در انتظار` },
    { key: 'data_quality', en: 'Data Quality', fa: 'کیفیت داده', score: dataQualityScore, weight: 2, grade: healthGrade(dataQualityScore), detailEn: `${md.duplicates.total} duplicate group(s), integrity ${md.integrity.score}`, detailFa: `${md.duplicates.total} گروه تکراری، یکپارچگی ${md.integrity.score}` },
    { key: 'integration', en: 'Integration Status', fa: 'وضعیت یکپارچه‌سازی', score: integrationScore, weight: 1, grade: healthGrade(integrationScore), detailEn: `${dlq} dead-letter, ${disp24} dispatches (24h)`, detailFa: `${dlq} پیام مرده، ${disp24} ارسال (۲۴ ساعت)` },
  ]

  const overall = overallHealth(components)
  return {
    overall,
    grade: healthGrade(overall),
    risk: healRisk,
    components,
    selfheal: heal,
    alerts: { financialOpen: finOpen, businessOpen: bizOpen },
    automation: { workflows24h: wf24, failed24h: wfFail24, waiting: wfWaiting },
    integrations: { dispatches24h: disp24, deadLetter: dlq },
    generatedAt: new Date().toISOString(),
  }
}
