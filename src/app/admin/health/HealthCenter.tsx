'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Badge, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'

const L = (fa: boolean, en: string, faT: string) => (fa ? faT : en)

interface Component { key: string; en: string; fa: string; score: number; grade: string; detailEn: string; detailFa: string }
interface Finding { code: string; severity: string; action: string; count: number; fixed: number; detail: string }
interface Overview {
  overall: number; grade: string; risk: number
  components: Component[]
  selfheal: { run: { id: number; createdAt: string; issues: number; fixed: number; risk: number } | null; findings: Finding[] }
  alerts: { financialOpen: number; businessOpen: number }
  automation: { workflows24h: number; failed24h: number; waiting: number }
  integrations: { dispatches24h: number; deadLetter: number }
}
interface CheckDef { code: string; en: string; fa: string; severity: string; autoFixable: boolean; domain: string }

const GRADE_LABEL: Record<string, [string, string]> = {
  healthy: ['Healthy', 'سالم'], degraded: ['Degraded', 'افت‌کرده'], at_risk: ['At risk', 'در معرض ریسک'], critical: ['Critical', 'بحرانی'],
}
const gradeColor = (g: string) => (g === 'healthy' ? 'text-success' : g === 'degraded' ? 'text-brand' : g === 'at_risk' ? 'text-warning' : 'text-danger')
const barColor = (s: number) => (s >= 90 ? 'bg-success' : s >= 75 ? 'bg-brand' : s >= 50 ? 'bg-warning' : 'bg-danger')
const sevBadge = (s: string) => (s === 'critical' ? 'danger' : s === 'warning' ? 'warning' : 'neutral') as 'danger' | 'warning' | 'neutral'
const ACTION_LABEL: Record<string, [string, string]> = {
  auto_fixed: ['Auto-fixed', 'خودکار رفع شد'], alert: ['Alert', 'هشدار'], recommendation: ['Recommendation', 'توصیه'],
}

export function HealthCenter({ role }: { role: string }) {
  const fa = useAdminLocale() === 'fa'
  const { toast } = useToast()
  const [ov, setOv] = useState<Overview | null>(null)
  const [checks, setChecks] = useState<CheckDef[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const canRun = ['administrator', 'super_admin'].includes(role)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/erp/health').then(r => r.json()),
      fetch('/api/admin/erp/health?view=checks').then(r => r.json()),
    ]).then(([o, c]) => { setOv(o.overview ?? null); setChecks(c.checks ?? []) }).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function runHeal() {
    setRunning(true)
    try {
      const r = await fetch('/api/admin/erp/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'selfheal' }) })
      const d = await r.json()
      if (r.ok) { toast(L(fa, `Self-heal run #${d.result.runId}: ${d.result.totalIssues} issue(s), ${d.result.totalFixed} auto-fixed.`, `اجرای خودترمیمی #${d.result.runId}: ${d.result.totalIssues} مشکل، ${d.result.totalFixed} رفع خودکار.`), 'success'); load() }
      else toast(d.error ?? L(fa, 'Self-heal failed.', 'خودترمیمی ناموفق بود.'), 'error')
    } finally { setRunning(false) }
  }

  if (loading) return <Card><p className="text-xs text-text-tertiary">{L(fa, 'Loading…', 'در حال بارگذاری…')}</p></Card>
  if (!ov) return <Card><p className="text-xs text-text-tertiary">{L(fa, 'No data.', 'داده‌ای نیست.')}</p></Card>

  const checkByCode = new Map(checks.map(c => [c.code, c]))
  const findingCols = [
    { key: 'code', labelEn: 'Check', labelFa: 'بررسی', render: (f: Finding) => { const c = checkByCode.get(f.code); return <span className="text-xs text-text-primary">{c ? L(fa, c.en, c.fa) : f.code}</span> } },
    { key: 'severity', labelEn: 'Severity', labelFa: 'شدت', render: (f: Finding) => <Badge color={sevBadge(f.severity)}>{f.severity}</Badge> },
    { key: 'action', labelEn: 'Action', labelFa: 'اقدام', render: (f: Finding) => <Badge color={f.action === 'auto_fixed' ? 'success' : f.action === 'alert' ? 'warning' : 'neutral'}>{L(fa, ...(ACTION_LABEL[f.action] ?? [f.action, f.action]))}</Badge> },
    { key: 'count', labelEn: 'Found', labelFa: 'یافته', render: (f: Finding) => <span className="text-xs">{f.count}</span> },
    { key: 'fixed', labelEn: 'Fixed', labelFa: 'رفع‌شده', render: (f: Finding) => <span className={`text-xs ${f.fixed ? 'text-success' : 'text-text-tertiary'}`}>{f.fixed}</span> },
    { key: 'detail', labelEn: 'Detail', labelFa: 'جزئیات', render: (f: Finding) => <span className="text-2xs text-text-tertiary">{f.detail}</span> },
  ]

  return (
    <div className="space-y-4">
      {/* Hero: overall + risk + alerts + automation + integrations */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <p className="text-2xs text-text-tertiary mb-1">{L(fa, 'ERP Health', 'سلامت کل ERP')}</p>
          <p className={`text-2xl font-bold ${gradeColor(ov.grade)}`}>{ov.overall}</p>
          <p className={`text-2xs font-semibold ${gradeColor(ov.grade)}`}>{L(fa, ...(GRADE_LABEL[ov.grade] ?? [ov.grade, ov.grade]))}</p>
        </Card>
        <Card>
          <p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Risk score', 'امتیاز ریسک')}</p>
          <p className={`text-2xl font-bold ${ov.risk >= 50 ? 'text-danger' : ov.risk >= 20 ? 'text-warning' : 'text-success'}`}>{ov.risk}</p>
          <p className="text-2xs text-text-tertiary">{L(fa, 'from open findings', 'از یافته‌های باز')}</p>
        </Card>
        <Card>
          <p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Open alerts', 'هشدارهای باز')}</p>
          <p className={`text-2xl font-bold ${ov.alerts.financialOpen + ov.alerts.businessOpen ? 'text-warning' : 'text-success'}`}>{ov.alerts.financialOpen + ov.alerts.businessOpen}</p>
          <p className="text-2xs text-text-tertiary">{L(fa, 'financial', 'مالی')}: {ov.alerts.financialOpen} · {L(fa, 'business', 'کسب‌وکار')}: {ov.alerts.businessOpen}</p>
        </Card>
        <Card>
          <p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Automation (24h)', 'اتوماسیون (۲۴ ساعت)')}</p>
          <p className={`text-2xl font-bold ${ov.automation.failed24h ? 'text-warning' : 'text-success'}`}>{ov.automation.workflows24h}</p>
          <p className="text-2xs text-text-tertiary">{L(fa, 'failed', 'ناموفق')}: {ov.automation.failed24h} · {L(fa, 'waiting', 'در انتظار')}: {ov.automation.waiting}</p>
        </Card>
        <Card>
          <p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Integrations', 'یکپارچه‌سازی‌ها')}</p>
          <p className={`text-2xl font-bold ${ov.integrations.deadLetter ? 'text-danger' : 'text-success'}`}>{ov.integrations.deadLetter}</p>
          <p className="text-2xs text-text-tertiary">{L(fa, 'dead-letter · dispatches', 'پیام مرده · ارسال')}: {ov.integrations.dispatches24h}</p>
        </Card>
      </div>

      {/* Component matrix */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {ov.components.map(c => (
          <Card key={c.key}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-text-primary">{L(fa, c.en, c.fa)}</h3>
              <span className={`text-lg font-bold ${gradeColor(c.grade)}`}>{c.score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1.5"><div className={`h-full ${barColor(c.score)}`} style={{ width: `${c.score}%` }} /></div>
            <p className="text-2xs text-text-tertiary">{L(fa, c.detailEn, c.detailFa)}</p>
          </Card>
        ))}
      </div>

      {/* Self-heal */}
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Self-Healing Engine', 'موتور خودترمیمی')}</h3>
            <p className="text-2xs text-text-tertiary">
              {ov.selfheal.run
                ? L(fa, `Last run #${ov.selfheal.run.id} · ${ov.selfheal.run.issues} issue(s) · ${ov.selfheal.run.fixed} auto-fixed · ${ov.selfheal.run.createdAt}`, `آخرین اجرا #${ov.selfheal.run.id} · ${ov.selfheal.run.issues} مشکل · ${ov.selfheal.run.fixed} رفع خودکار · ${ov.selfheal.run.createdAt}`)
                : L(fa, 'No run yet — run it to scan and auto-fix the ERP.', 'هنوز اجرایی ثبت نشده — برای اسکن و رفع خودکار اجرا کنید.')}
            </p>
          </div>
          {canRun && <Btn onClick={runHeal} disabled={running}>{running ? L(fa, 'Running…', 'در حال اجرا…') : L(fa, 'Run self-heal', 'اجرای خودترمیمی')}</Btn>}
        </div>
        {ov.selfheal.findings.length > 0
          ? <DataTable tableId="health-findings" columns={findingCols} rows={ov.selfheal.findings} locale={fa ? 'fa' : 'en'}
              rowKey={(f: Finding) => f.code} exportName="selfheal-findings"
              emptyLabel={L(fa, 'No findings.', 'یافته‌ای نیست.')} />
          : <p className="text-2xs text-text-tertiary">{ov.selfheal.run ? L(fa, 'The last run found no issues. ✅', 'در آخرین اجرا مشکلی یافت نشد. ✅') : ''}</p>}
      </Card>

      {/* AI Operational Advisor (shared AI engine — advisory only) */}
      <AdvisorCard fa={fa} />

      {/* Check registry */}
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'Monitored checks', 'بررسی‌های تحت پایش')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {checks.map(c => (
            <div key={c.code} className="rounded-lg bg-white/5 p-2.5 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-text-primary">{L(fa, c.en, c.fa)}</p>
                <p className="text-2xs text-text-tertiary">{c.domain}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge color={sevBadge(c.severity)}>{c.severity}</Badge>
                {c.autoFixable && <Badge color="success">{L(fa, 'auto-fix', 'رفع خودکار')}</Badge>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

const ADVISOR_KINDS: [string, string, string][] = [
  ['root_cause', 'Root cause', 'ریشه‌یابی'],
  ['recommend', 'Recommendations', 'توصیه‌ها'],
  ['risk', 'Risk analysis', 'تحلیل ریسک'],
  ['forecast', 'Forecast', 'پیش‌بینی'],
  ['optimize', 'Optimization', 'بهینه‌سازی'],
  ['workflow', 'Workflow suggestion', 'پیشنهاد گردش‌کار'],
]

function AdvisorCard({ fa }: { fa: boolean }) {
  const [kind, setKind] = useState('root_cause')
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function ask() {
    setBusy(true); setErr(''); setReply('')
    try {
      const r = await fetch('/api/admin/erp/health', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advise', kind, question: question || undefined, locale: fa ? 'fa' : 'en' }),
      })
      const d = await r.json()
      if (r.ok) setReply(d.text)
      else setErr(d.error ?? L(fa, 'Advisor failed.', 'مشاور ناموفق بود.'))
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-text-primary mb-1">{L(fa, 'AI Operational Advisor', 'مشاور عملیاتی هوش مصنوعی')}</h3>
      <p className="text-2xs text-text-tertiary mb-3">{L(fa, 'Grounded in the live health snapshot via the shared AI engine — advisory only, never mutates data.', 'مبتنی بر عکس فوری زندهٔ سلامت از طریق موتور مشترک AI — فقط مشاوره، هیچ داده‌ای تغییر نمی‌کند.')}</p>
      <div className="flex gap-1 flex-wrap mb-2">
        {ADVISOR_KINDS.map(([id, en, faL]) => (
          <button key={id} onClick={() => setKind(id)} className={`px-3 py-1 rounded-md text-2xs font-semibold transition-colors ${kind === id ? 'bg-brand text-white' : 'bg-white/5 text-text-secondary hover:text-text-primary'}`}>{L(fa, en, faL)}</button>
        ))}
      </div>
      <div className="flex gap-2 items-center mb-2">
        <input value={question} onChange={e => setQuestion(e.target.value)}
          placeholder={L(fa, 'Optional question…', 'پرسش اختیاری…')}
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand" />
        <Btn onClick={ask} disabled={busy}>{busy ? L(fa, 'Thinking…', 'در حال تحلیل…') : L(fa, 'Ask', 'بپرس')}</Btn>
      </div>
      {err && <p className="text-2xs text-danger">{err}</p>}
      {reply && <div className="rounded-lg bg-white/5 p-3 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{reply}</div>}
    </Card>
  )
}
