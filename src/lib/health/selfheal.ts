/**
 * Self-Healing Engine — pure core (Phase 26.20, PART 10). Deterministic, no DB.
 * Defines the check registry (what the ERP watches for), classifies each
 * finding into an action (auto_fixed / alert / recommendation), and computes
 * the composite health + risk scores for the Operational Health Center.
 * The data layer (selfhealData.ts) runs the checks against live PostgreSQL and
 * executes the safe auto-fixes by REUSING each module's own idempotent ops.
 */

export type HealAction = 'auto_fixed' | 'alert' | 'recommendation'
export type HealSeverity = 'critical' | 'warning' | 'info'

export interface HealCheckDef {
  code: string
  en: string
  fa: string
  severity: HealSeverity
  /** True when a provably-safe, idempotent auto-fix exists. */
  autoFixable: boolean
  domain: 'accounting' | 'inventory' | 'import' | 'workflow' | 'masterdata' | 'business'
}

/** The fixed registry — every check the engine runs, with its remedy class. */
export const HEAL_CHECKS: HealCheckDef[] = [
  { code: 'sales_invoice_unposted', en: 'Confirmed sales invoices not posted to the GL', fa: 'فاکتورهای فروش تأییدشدهٔ ثبت‌نشده در دفتر کل', severity: 'critical', autoFixable: true, domain: 'accounting' },
  { code: 'purchase_invoice_unposted', en: 'Confirmed purchase invoices not posted to the GL', fa: 'فاکتورهای خرید تأییدشدهٔ ثبت‌نشده در دفتر کل', severity: 'critical', autoFixable: true, domain: 'accounting' },
  { code: 'gl_unbalanced', en: 'Unbalanced posted journal entries', fa: 'اسناد قطعی نامتوازن', severity: 'critical', autoFixable: false, domain: 'accounting' },
  { code: 'import_job_stuck', en: 'Import jobs stuck in processing', fa: 'کارهای ورود گیرکرده در حال اجرا', severity: 'warning', autoFixable: true, domain: 'import' },
  { code: 'orphan_holds', en: 'Active reservations of finished shipments', fa: 'رزروهای فعالِ حمل‌های خاتمه‌یافته', severity: 'warning', autoFixable: true, domain: 'inventory' },
  { code: 'negative_stock', en: 'Negative on-hand stock', fa: 'موجودی منفی', severity: 'critical', autoFixable: false, domain: 'inventory' },
  { code: 'count_stuck_approved', en: 'Approved cycle counts never posted', fa: 'شمارش‌های تأییدشدهٔ ثبت‌نشده', severity: 'warning', autoFixable: false, domain: 'workflow' },
  { code: 'workflow_failed', en: 'Failed workflow runs (24h)', fa: 'اجرای ناموفق گردش‌کار (۲۴ ساعت)', severity: 'warning', autoFixable: false, domain: 'workflow' },
  { code: 'contract_expired_active', en: 'Vendor contracts past end date still active', fa: 'قراردادهای منقضیِ هنوز فعال', severity: 'warning', autoFixable: true, domain: 'business' },
  { code: 'duplicate_payments', en: 'Suspected duplicate payments', fa: 'پرداخت‌های مشکوک به تکرار', severity: 'critical', autoFixable: false, domain: 'business' },
  { code: 'duplicate_customers', en: 'Duplicate customer identities', fa: 'مشتریان با هویت تکراری', severity: 'info', autoFixable: false, domain: 'masterdata' },
  { code: 'negative_margin', en: 'Active products selling below cost', fa: 'کالاهای فعال با حاشیهٔ منفی', severity: 'info', autoFixable: false, domain: 'business' },
]

export function checkDef(code: string): HealCheckDef | undefined {
  return HEAL_CHECKS.find(c => c.code === code)
}

/** Classify a finding: safe fixes auto-fix; critical issues alert; info recommends. */
export function actionFor(def: HealCheckDef, fixed: boolean): HealAction {
  if (def.autoFixable && fixed) return 'auto_fixed'
  if (def.severity === 'info') return 'recommendation'
  return 'alert'
}

export interface HealFinding { code: string; count: number; fixed: number; action: HealAction; severity: HealSeverity }

/** Risk score 0..100 (higher = riskier) from open (non-fixed) findings. */
export function riskScore(findings: HealFinding[]): number {
  let penalty = 0
  for (const f of findings) {
    const open = Math.max(0, f.count - f.fixed)
    if (open === 0) continue
    penalty += open * (f.severity === 'critical' ? 12 : f.severity === 'warning' ? 5 : 1)
  }
  return Math.min(100, penalty)
}

// ── Composite health (PART 11) ───────────────────────────────────────────────
export interface HealthComponent { key: string; en: string; fa: string; score: number; weight: number }

/** Weighted 0..100 roll-up; missing components simply don't weigh in. */
export function overallHealth(components: HealthComponent[]): number {
  const w = components.reduce((s, c) => s + c.weight, 0)
  if (w === 0) return 100
  return Math.round(components.reduce((s, c) => s + Math.max(0, Math.min(100, c.score)) * c.weight, 0) / w)
}

export function healthGrade(score: number): 'healthy' | 'degraded' | 'at_risk' | 'critical' {
  if (score >= 90) return 'healthy'
  if (score >= 75) return 'degraded'
  if (score >= 50) return 'at_risk'
  return 'critical'
}

// ── Pure business validators (PART 13 helpers) ───────────────────────────────
export function isExpiredContract(endDate: string | null | undefined, today: string): boolean {
  if (!endDate) return false
  return new Date(endDate).getTime() < new Date(today).getTime()
}

export function hasNegativeMargin(price: number, cost: number): boolean {
  return cost > 0 && price > 0 && price < cost
}

// ── AI Operational Advisor (PART 12 — prompt builder only; the route runs it
// through the SHARED runCompletion engine, never a second AI system) ─────────
export type HealthAiAction = 'root_cause' | 'recommend' | 'risk' | 'forecast' | 'optimize' | 'workflow'

const HEALTH_AI_TASK: Record<HealthAiAction, string> = {
  root_cause: 'Perform ROOT-CAUSE analysis of the open findings in the snapshot: which underlying process failures produced them, in order of impact. Cite the finding codes and counts.',
  recommend: 'Give concrete BUSINESS and FINANCIAL recommendations to resolve the open findings and raise each low-scoring health component. Prioritize by severity; be specific and actionable.',
  risk: 'Assess the operational RISK: interpret the risk score and the critical/warning findings, state which pose financial exposure, and what could go wrong if left unresolved.',
  forecast: 'Comment on the likely near-term trajectory of ERP health if the open findings stay unresolved, reasoning only from the counts and component scores given. State assumptions.',
  optimize: 'Suggest OPTIMIZATIONS: which recurring findings indicate a process that should be automated or hardened (e.g. auto-posting, contract expiry automation), referencing the snapshot.',
  workflow: 'Suggest WORKFLOW improvements: which approval/automation/workflow gaps the findings expose and what workflow or rule should be added, referencing the snapshot.',
}

/** Grounded prompt for the AI Operational Advisor — snapshot-only, no fabrication. */
export function buildHealthPrompt(
  action: HealthAiAction,
  snapshot: string,
  opts: { question?: string; locale?: 'en' | 'fa' } = {},
): { systemPrompt: string; userMessage: string } {
  const lang = opts.locale === 'fa' ? 'Persian (فارسی)' : 'English'
  const systemPrompt = [
    'You are the AI Operational Advisor of the HBZ ERP Operational Health Center.',
    `Answer in ${lang}.`,
    'GROUNDING RULES: Use ONLY the live health snapshot below. Never invent findings, figures or modules.',
    'If the snapshot lacks the data needed, say so plainly.',
    '--- LIVE OPERATIONAL HEALTH SNAPSHOT (read-only) ---',
    snapshot,
    '--- END SNAPSHOT ---',
  ].join('\n')
  const userMessage = [HEALTH_AI_TASK[action], opts.question ? `Question: ${opts.question}` : ''].filter(Boolean).join('\n\n')
  return { systemPrompt, userMessage }
}

export interface PaymentFactLite { id: number; refId: number; amount: number; date: string }
/** Same target + same amount + same date, more than once → suspected duplicate. */
export function duplicatePaymentGroups(payments: PaymentFactLite[]): PaymentFactLite[][] {
  const byKey = new Map<string, PaymentFactLite[]>()
  for (const p of payments) {
    if (p.amount <= 0) continue
    const k = `${p.refId}|${p.amount}|${p.date}`
    const arr = byKey.get(k) ?? []
    arr.push(p)
    byKey.set(k, arr)
  }
  return [...byKey.values()].filter(g => g.length > 1)
}
