'use client'

/**
 * Business Intelligence workspace (Phase 26.13) — the operational-intelligence
 * layer above ERP: Executive Cockpit, KPI Center, OKR, Process Intelligence, SLA
 * Center, Alert Center, Data Governance and the AI Business Advisor. Reuses the
 * display-currency engine, the shared AI engine and every verified module data
 * layer. All figures are Rial-base aggregates repriced live via the currency
 * picker; RTL/EN throughout.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, Badge, PageHeader, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'

const L = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)
type Tab = 'cockpit' | 'kpi' | 'okr' | 'process' | 'sla' | 'alerts' | 'quality' | 'advisor'
type Toast = ReturnType<typeof useToast>['toast']

export function BusinessIntelligence() {
  const rtl = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('cockpit')
  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab') as Tab | null; if (t) setTab(t) }, [])
  const TABS: [Tab, string, string][] = [
    ['cockpit', 'Executive Cockpit', 'کاکپیت اجرایی'], ['kpi', 'KPI Center', 'مرکز KPI'], ['okr', 'OKR', 'اهداف OKR'],
    ['process', 'Process Intelligence', 'هوش فرایند'], ['sla', 'SLA Center', 'مرکز SLA'], ['alerts', 'Alert Center', 'مرکز هشدار'],
    ['quality', 'Data Governance', 'حاکمیت داده'], ['advisor', 'AI Advisor', 'مشاور هوشمند'],
  ]
  return (
    <>
      <ToastContainer />
      <PageHeader title={L(rtl, 'Business Intelligence', 'هوش تجاری')} subtitle={L(rtl, 'Executive cockpit, KPIs, OKRs, process mining, SLA, alerts and AI advisory over live ERP data', 'کاکپیت اجرایی، KPI، OKR، هوش فرایند، SLA، هشدار و مشاوره هوشمند روی داده زنده')} action={<CurrencyPicker fa={rtl} />} />
      <div className="flex gap-1 mb-6 border-b border-subtle flex-wrap">
        {TABS.map(([id, en, fa]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{L(rtl, en, fa)}</button>)}
      </div>
      {tab === 'cockpit' && <Cockpit rtl={rtl} />}
      {tab === 'kpi' && <KpiCenter rtl={rtl} toast={toast} />}
      {tab === 'okr' && <OkrCenter rtl={rtl} toast={toast} />}
      {tab === 'process' && <ProcessCenter rtl={rtl} />}
      {tab === 'sla' && <SlaCenter rtl={rtl} toast={toast} />}
      {tab === 'alerts' && <AlertCenter rtl={rtl} toast={toast} />}
      {tab === 'quality' && <DataQuality rtl={rtl} />}
      {tab === 'advisor' && <Advisor rtl={rtl} toast={toast} />}
    </>
  )
}

function metricCard(label: string, value: string | number, sub?: string) {
  return <div className="metric-card"><p className="text-overline">{label}</p><p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>{sub && <p className="text-2xs text-text-tertiary mt-1">{sub}</p>}</div>
}

// ── Executive Cockpit (M1) ───────────────────────────────────────────────────
function Cockpit({ rtl }: { rtl: boolean }) {
  const { money } = useDisplayCurrency()
  const [d, setD] = useState<Record<string, unknown> | null>(null)
  useEffect(() => { fetch('/api/admin/erp/bi/cockpit').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}) }, [])
  if (!d) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Loading…', 'بارگذاری…')}</Card>
  const fin = d.financial as { overview: { revenue: number; profit: number; cash: number }; workingCapital: { ar: number; ap: number; inventory: number } } | null
  const op = d.operational as { salesInvoiced: number; purchaseSpend: number; openProjects: number; activeTasks: number }
  const risk = d.risk as { approvalDelays: number; budgetOverruns: number; lowStock: number; openAlerts: number; criticalAlerts: number }
  const sc = d.scorecard as { score: number }
  const appr = d.approvals as { pending: number; avgHours: number } | null
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(rtl, 'Financial Overview', 'نمای مالی')}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCard(L(rtl, 'Revenue', 'درآمد'), money(fin?.overview.revenue ?? 0))}
          {metricCard(L(rtl, 'Net Profit', 'سود خالص'), money(fin?.overview.profit ?? 0))}
          {metricCard(L(rtl, 'Cash', 'نقد'), money(fin?.overview.cash ?? 0))}
          {metricCard(L(rtl, 'KPI Score', 'امتیاز KPI'), sc?.score ?? 0)}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(rtl, 'Operational Overview', 'نمای عملیاتی')}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCard(L(rtl, 'Sales invoiced', 'فروش'), money(op.salesInvoiced))}
          {metricCard(L(rtl, 'Purchase spend', 'خرید'), money(op.purchaseSpend))}
          {metricCard(L(rtl, 'Working capital (AR/AP)', 'سرمایه در گردش'), `${money(fin?.workingCapital.ar ?? 0)} / ${money(fin?.workingCapital.ap ?? 0)}`)}
          {metricCard(L(rtl, 'Open projects / tasks', 'پروژه/وظیفه باز'), `${op.openProjects} / ${op.activeTasks}`)}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(rtl, 'Risk Overview', 'نمای ریسک')}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {metricCard(L(rtl, 'Approval delays', 'تأخیر تأیید'), risk.approvalDelays)}
          {metricCard(L(rtl, 'Budget overruns', 'فراتر بودجه'), risk.budgetOverruns)}
          {metricCard(L(rtl, 'Low stock', 'کسری موجودی'), risk.lowStock)}
          {metricCard(L(rtl, 'Open alerts', 'هشدار باز'), risk.openAlerts)}
          {metricCard(L(rtl, 'Critical', 'بحرانی'), risk.criticalAlerts)}
        </div>
      </div>
      {appr && <p className="text-2xs text-text-tertiary">{L(rtl, 'Approvals pending', 'تأیید در انتظار')}: {appr.pending} · {L(rtl, 'avg', 'میانگین')} {appr.avgHours}h</p>}
    </div>
  )
}

// ── KPI Center (M2) ──────────────────────────────────────────────────────────
function KpiCenter({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [data, setData] = useState<{ kpis: { id: number; code: string; nameEn: string; nameFa: string | null; category: string; unit: string | null; actual: number; target: number | null; attainmentPct: number; status: string }[]; scorecard: { score: number } } | null>(null)
  const [form, setForm] = useState({ code: '', nameEn: '', category: 'financial', formula: '', unit: '%', direction: 'higher_better', target: '' })
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/bi/kpi'); if (r.ok) setData(await r.json()) }, [])
  useEffect(() => { load() }, [load])
  async function save() {
    const r = await fetch('/api/admin/erp/bi/kpi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', ...form, target: form.target ? Number(form.target) : null }) })
    if (r.ok) { toast(L(rtl, 'KPI saved', 'KPI ذخیره شد'), 'success'); setForm({ code: '', nameEn: '', category: 'financial', formula: '', unit: '%', direction: 'higher_better', target: '' }); load() }
    else toast((await r.json().catch(() => ({}))).error || L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  async function snapshot() { const p = new Date().toISOString().slice(0, 7); const r = await fetch('/api/admin/erp/bi/kpi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'snapshot', period: p }) }); if (r.ok) toast(L(rtl, 'History snapshot saved', 'اسنپ‌شات تاریخچه ذخیره شد'), 'success') }
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><p className="text-sm text-text-secondary">{L(rtl, 'Scorecard', 'کارت امتیاز')}: <strong className="text-text-primary">{data?.scorecard.score ?? 0}</strong></p><Btn size="sm" variant="secondary" onClick={snapshot}>{L(rtl, 'Snapshot history', 'ثبت تاریخچه')}</Btn></div>
      <Card className="p-4">
        <table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'KPI', 'شاخص')}</th><th>{L(rtl, 'Category', 'دسته')}</th><th className="text-end">{L(rtl, 'Actual', 'مقدار')}</th><th className="text-end">{L(rtl, 'Target', 'هدف')}</th><th className="text-end">{L(rtl, 'Attainment', 'تحقق')}</th></tr></thead>
          <tbody>{(data?.kpis ?? []).map(k => <tr key={k.id} className="border-t border-subtle"><td className="py-2 text-text-primary">{rtl ? (k.nameFa ?? k.nameEn) : k.nameEn}</td><td className="text-center text-2xs text-text-secondary">{k.category}</td><td className="text-end text-text-secondary">{k.actual}{k.unit === '%' ? '%' : ''}</td><td className="text-end text-text-tertiary">{k.target ?? '—'}</td><td className="text-end"><Badge color={k.status === 'on_target' ? 'green' : k.status === 'at_risk' ? 'amber' : k.status === 'off_target' ? 'red' : 'slate'}>{k.attainmentPct}%</Badge></td></tr>)}
            {!data?.kpis.length && <tr><td colSpan={5} className="text-center text-text-tertiary py-6">{L(rtl, 'No KPIs', 'شاخصی نیست')}</td></tr>}</tbody></table>
      </Card>
      <Card className="p-4 grid md:grid-cols-6 gap-2 items-end">
        <Input label={L(rtl, 'Code', 'کد')} value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} />
        <Input label={L(rtl, 'Name', 'نام')} value={form.nameEn} onChange={v => setForm(f => ({ ...f, nameEn: v }))} />
        <Input label={L(rtl, 'Formula', 'فرمول')} value={form.formula} onChange={v => setForm(f => ({ ...f, formula: v }))} placeholder="(revenue - cogs)/revenue*100" />
        <Select label={L(rtl, 'Category', 'دسته')} value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={['financial', 'sales', 'inventory', 'project', 'company', 'department', 'employee'].map(c => ({ value: c, label: c }))} />
        <Input label={L(rtl, 'Target', 'هدف')} type="number" value={form.target} onChange={v => setForm(f => ({ ...f, target: v }))} />
        <Btn onClick={save} disabled={!form.code || !form.nameEn}>{L(rtl, 'Add KPI', 'افزودن')}</Btn>
      </Card>
      <p className="text-3xs text-text-tertiary">{L(rtl, 'Formulas evaluate over live metrics: revenue, cogs, net_income, cash, ar, ap, inventory_value, gross_profit.', 'فرمول‌ها روی متریک‌های زنده محاسبه می‌شوند: revenue, cogs, net_income, cash, ar, ap, inventory_value, gross_profit.')}</p>
    </div>
  )
}

// ── OKR (M3) ─────────────────────────────────────────────────────────────────
function OkrCenter({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [rows, setRows] = useState<{ id: number; title: string; level: string; period: string; progressPct: number; confidence: number | null; status: string; status2: string; krCount: number }[]>([])
  const [form, setForm] = useState({ title: '', level: 'company', period: '1405-Q1' })
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/bi/okr'); if (r.ok) setRows((await r.json()).objectives ?? []) }, [])
  useEffect(() => { load() }, [load])
  async function create() {
    const r = await fetch('/api/admin/erp/bi/okr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...form, keyResults: [{ title: 'Key result 1', startValue: 0, targetValue: 100, currentValue: 0 }] }) })
    if (r.ok) { toast(L(rtl, 'Objective created', 'هدف ساخته شد'), 'success'); setForm({ title: '', level: 'company', period: '1405-Q1' }); load() } else toast(L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <div className="space-y-4">
      <Card className="p-4 grid md:grid-cols-4 gap-2 items-end">
        <Input label={L(rtl, 'Objective', 'هدف')} value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} />
        <Select label={L(rtl, 'Level', 'سطح')} value={form.level} onChange={v => setForm(f => ({ ...f, level: v }))} options={['company', 'department', 'employee'].map(x => ({ value: x, label: x }))} />
        <Input label={L(rtl, 'Period', 'دوره')} value={form.period} onChange={v => setForm(f => ({ ...f, period: v }))} />
        <Btn onClick={create} disabled={!form.title}>{L(rtl, 'Create OKR', 'ایجاد')}</Btn>
      </Card>
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Objective', 'هدف')}</th><th>{L(rtl, 'Level', 'سطح')}</th><th>{L(rtl, 'Period', 'دوره')}</th><th className="text-end">{L(rtl, 'Progress', 'پیشرفت')}</th><th>{L(rtl, 'Status', 'وضعیت')}</th></tr></thead>
        <tbody>{rows.map(o => <tr key={o.id} className="border-t border-subtle"><td className="py-2 text-text-primary">{o.title} <span className="text-3xs text-text-tertiary">({o.krCount} KR)</span></td><td className="text-center text-2xs text-text-secondary">{o.level}</td><td className="text-center text-2xs text-text-secondary">{o.period}</td><td className="text-end text-text-secondary">{o.progressPct}%</td><td className="text-center"><Badge color={o.status2 === 'on_track' ? 'green' : o.status2 === 'at_risk' ? 'amber' : o.status2 === 'behind' ? 'red' : 'slate'}>{o.status2}</Badge></td></tr>)}
          {!rows.length && <tr><td colSpan={5} className="text-center text-text-tertiary py-6">{L(rtl, 'No objectives', 'هدفی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

// ── Process Intelligence (M4) ────────────────────────────────────────────────
function ProcessCenter({ rtl }: { rtl: boolean }) {
  const [d, setD] = useState<{ process: string; caseCount: number; avgCycleHours: number; bottleneck: { transition: string; avgHours: number } | null; transitions: { transition: string; avgHours: number; count: number }[]; failureRatePct: number; performanceScore: number; delayVsBaselinePct: number | null } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/bi/process?process=approval').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}) }, [])
  if (!d) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Loading…', 'بارگذاری…')}</Card>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCard(L(rtl, 'Cases', 'موارد'), d.caseCount)}
        {metricCard(L(rtl, 'Avg cycle (h)', 'میانگین چرخه'), d.avgCycleHours)}
        {metricCard(L(rtl, 'Performance', 'کارایی'), d.performanceScore)}
        {metricCard(L(rtl, 'Failure rate', 'نرخ شکست'), `${d.failureRatePct}%`)}
      </div>
      {d.delayVsBaselinePct != null && <Card className="p-4"><p className="text-sm text-text-secondary">{L(rtl, 'Approval average time changed', 'میانگین زمان تأیید تغییر کرد')} <strong className={d.delayVsBaselinePct > 0 ? 'text-danger' : 'text-success-text'}>{d.delayVsBaselinePct > 0 ? '+' : ''}{d.delayVsBaselinePct}%</strong> {L(rtl, 'vs previous month', 'نسبت به ماه قبل')}</p></Card>}
      <Card className="p-4"><h3 className="text-sm font-semibold text-text-primary mb-2">{L(rtl, 'Bottlenecks (slowest transitions)', 'گلوگاه‌ها')}</h3>
        <table className="w-full text-sm"><tbody>{d.transitions.map((t, i) => <tr key={i} className="border-t border-subtle"><td className="py-1.5 text-text-secondary">{t.transition}{i === 0 && d.bottleneck ? <Badge color="red">{L(rtl, 'bottleneck', 'گلوگاه')}</Badge> : null}</td><td className="text-end text-text-tertiary text-2xs">{t.avgHours}h · {t.count}×</td></tr>)}
          {!d.transitions.length && <tr><td className="text-text-tertiary text-2xs py-3">{L(rtl, 'No completed approval cases yet', 'موردی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

// ── SLA Center (M5) ──────────────────────────────────────────────────────────
function SlaCenter({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [defs, setDefs] = useState<{ id: number; code: string; nameEn: string; slaType: string; targetHours: number }[]>([])
  const [events, setEvents] = useState<{ id: number; slaName: string; state: string; elapsedHours: number | null }[]>([])
  const load = useCallback(async () => {
    const a = await fetch('/api/admin/erp/bi/sla'); if (a.ok) setDefs((await a.json()).defs ?? [])
    const b = await fetch('/api/admin/erp/bi/sla?view=events'); if (b.ok) setEvents((await b.json()).events ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  async function scan() { const r = await fetch('/api/admin/erp/bi/sla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) }); if (r.ok) { const d = await r.json(); toast(L(rtl, `Scan: ${d.breached} breached, ${d.escalated} escalated`, `اسکن: ${d.breached} نقض، ${d.escalated} تشدید`), 'success'); load() } }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={scan}>{L(rtl, 'Scan SLA', 'اسکن SLA')}</Btn></div>
      <Card className="p-4"><h3 className="text-sm font-semibold text-text-primary mb-2">{L(rtl, 'SLA definitions', 'تعاریف SLA')}</h3>
        <table className="w-full text-sm"><tbody>{defs.map(s => <tr key={s.id} className="border-t border-subtle"><td className="py-1.5 text-text-primary">{s.code} — {s.nameEn}</td><td className="text-center text-2xs text-text-secondary">{s.slaType}</td><td className="text-end text-text-tertiary text-2xs">{s.targetHours}h</td></tr>)}
          {!defs.length && <tr><td className="text-text-tertiary text-2xs py-3">{L(rtl, 'No SLA definitions — create via API/admin.', 'تعریفی نیست.')}</td></tr>}</tbody></table></Card>
      <Card className="p-4"><h3 className="text-sm font-semibold text-text-primary mb-2">{L(rtl, 'Open SLA events', 'رویدادهای باز')}</h3>
        <table className="w-full text-sm"><tbody>{events.map(e => <tr key={e.id} className="border-t border-subtle"><td className="py-1.5 text-text-secondary">{e.slaName}</td><td className="text-end"><Badge color={e.state === 'breached' ? 'red' : e.state === 'due_soon' ? 'amber' : 'green'}>{e.state} {e.elapsedHours ?? 0}h</Badge></td></tr>)}
          {!events.length && <tr><td className="text-text-tertiary text-2xs py-3">{L(rtl, 'No open events', 'رویدادی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

// ── Alert Center (M6) ────────────────────────────────────────────────────────
function AlertCenter({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [alerts, setAlerts] = useState<{ id: number; kind: string; domain: string; severity: string; titleEn: string; titleFa: string | null; detail: string | null; status: string }[]>([])
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/bi/alerts'); if (r.ok) setAlerts((await r.json()).alerts ?? []) }, [])
  useEffect(() => { load() }, [load])
  async function scan() { setBusy(true); const r = await fetch('/api/admin/erp/bi/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) }); setBusy(false); if (r.ok) { const d = await r.json(); toast(L(rtl, `${d.upserted} alerts`, `${d.upserted} هشدار`), 'success'); load() } }
  async function setStatus(id: number, status: string) { const r = await fetch('/api/admin/erp/bi/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id, status }) }); if (r.ok) load() }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={scan} disabled={busy}>{busy ? L(rtl, 'Scanning…', 'اسکن…') : L(rtl, 'Scan all domains', 'اسکن همه')}</Btn></div>
      {alerts.map(a => (
        <Card key={a.id} className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Badge color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'amber' : 'slate'}>{a.severity}</Badge>
            <Badge color="slate">{a.domain}</Badge>
            <div><p className="text-sm font-medium text-text-primary">{rtl ? (a.titleFa ?? a.titleEn) : a.titleEn}</p>{a.detail && <p className="text-2xs text-text-tertiary">{a.detail}</p>}</div>
          </div>
          <div className="flex gap-2 whitespace-nowrap">{a.status === 'open' && <button onClick={() => setStatus(a.id, 'acknowledged')} className="text-2xs text-text-secondary hover:text-text-primary">{L(rtl, 'Ack', 'تأیید')}</button>}<button onClick={() => setStatus(a.id, 'resolved')} className="text-2xs text-brand hover:underline">{L(rtl, 'Resolve', 'رفع')}</button></div>
        </Card>
      ))}
      {!alerts.length && <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'No open alerts — run a scan.', 'هشداری نیست — اسکن کنید.')}</Card>}
    </div>
  )
}

// ── Data Governance (M9) ─────────────────────────────────────────────────────
function DataQuality({ rtl }: { rtl: boolean }) {
  const [d, setD] = useState<{ score: number; grade: string; totalAffected: number; issues: { key: string; labelEn: string; labelFa: string; affected: number; failRatePct: number; severity: string; suggestionEn: string; suggestionFa: string }[] } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/bi/data-quality').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}) }, [])
  if (!d) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Running checks…', 'در حال بررسی…')}</Card>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">{metricCard(L(rtl, 'Quality Score', 'امتیاز کیفیت'), d.score)}{metricCard(L(rtl, 'Grade', 'رتبه'), d.grade)}{metricCard(L(rtl, 'Affected rows', 'ردیف مشکل‌دار'), d.totalAffected)}</div>
      <Card className="p-4"><h3 className="text-sm font-semibold text-text-primary mb-2">{L(rtl, 'Issues', 'مسائل')}</h3>
        <table className="w-full text-sm"><tbody>{d.issues.map(i => <tr key={i.key} className="border-t border-subtle"><td className="py-2"><p className="text-text-primary">{rtl ? i.labelFa : i.labelEn}</p><p className="text-3xs text-text-tertiary">{rtl ? i.suggestionFa : i.suggestionEn}</p></td><td className="text-center"><Badge color={i.severity === 'high' ? 'red' : i.severity === 'medium' ? 'amber' : 'slate'}>{i.severity}</Badge></td><td className="text-end text-text-secondary text-2xs">{i.affected} ({i.failRatePct}%)</td></tr>)}
          {!d.issues.length && <tr><td colSpan={3} className="text-center text-success-text py-6">{L(rtl, 'No data quality issues 🎉', 'مشکلی نیست 🎉')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

// ── AI Business Advisor (M8) ─────────────────────────────────────────────────
function Advisor({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [q, setQ] = useState(rtl ? 'چرا سود کاهش یافت؟' : 'Why did profit decrease?')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  async function ask() {
    setBusy(true); setAnswer('')
    try { const r = await fetch('/api/admin/erp/bi/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, locale: rtl ? 'fa' : 'en' }) }); const d = await r.json().catch(() => ({})); if (r.ok) setAnswer(d.text || ''); else toast(d.error || L(rtl, 'AI unavailable', 'در دسترس نیست'), 'error') } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <p className="text-sm text-text-secondary">{L(rtl, 'Ask about the whole business — the advisor reasons over GL, sales, purchases, inventory and receivables (grounded, never modifies data).', 'دربارهٔ کل کسب‌وکار بپرسید — مشاور روی دفتر کل، فروش، خرید، موجودی و دریافتنی استدلال می‌کند (مستند، بدون تغییر داده).')}</p>
        <Input label={L(rtl, 'Question', 'پرسش')} value={q} onChange={setQ} multiline rows={2} />
        <Btn onClick={ask} disabled={busy}>{busy ? L(rtl, 'Analyzing…', 'در حال تحلیل…') : L(rtl, 'Ask advisor', 'بپرس')}</Btn>
      </Card>
      {answer && <Card className="p-5"><pre className="whitespace-pre-wrap text-sm text-text-secondary leading-7" style={{ fontFamily: 'inherit' }}>{answer}</pre></Card>}
    </div>
  )
}
