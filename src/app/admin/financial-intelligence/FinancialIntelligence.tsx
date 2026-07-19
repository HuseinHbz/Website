'use client'

/**
 * Financial Intelligence Center (Phase 26.11) — one console over the whole
 * Enterprise Financial Intelligence backend: CFO dashboard, budgets + variance,
 * cost/profit centers, forecasting, alerts and the AI Financial Analyst. Every
 * figure is a Rial-base aggregate rendered through the display-currency engine
 * (M13), so the whole console reprices instantly via the currency picker.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, Badge, PageHeader, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'

const L = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)
type Tab = 'dashboard' | 'budgets' | 'centers' | 'forecast' | 'alerts' | 'analyst'

export function FinancialIntelligence() {
  const rtl = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('dashboard')
  const TABS: [Tab, string, string][] = [
    ['dashboard', 'CFO Dashboard', 'داشبورد مدیر مالی'], ['budgets', 'Budgets', 'بودجه‌ها'],
    ['centers', 'Cost / Profit Centers', 'مراکز هزینه/سود'], ['forecast', 'Forecasting', 'پیش‌بینی'],
    ['alerts', 'Alerts', 'هشدارها'], ['analyst', 'AI Analyst', 'تحلیل‌گر هوشمند'],
  ]
  return (
    <>
      <ToastContainer />
      <PageHeader title={L(rtl, 'Financial Intelligence', 'هوش مالی')}
        subtitle={L(rtl, 'Budgets, cost centers, forecasting, KPIs, alerts and AI analysis over the live books', 'بودجه، مراکز هزینه، پیش‌بینی، شاخص‌ها، هشدار و تحلیل هوشمند روی دفاتر زنده')}
        action={<CurrencyPicker fa={rtl} />} />
      <div className="flex gap-1 mb-6 border-b border-subtle flex-wrap">
        {TABS.map(([id, en, fa]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {L(rtl, en, fa)}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <CfoDashboard rtl={rtl} />}
      {tab === 'budgets' && <Budgets rtl={rtl} toast={toast} />}
      {tab === 'centers' && <Centers rtl={rtl} toast={toast} />}
      {tab === 'forecast' && <Forecasting rtl={rtl} toast={toast} />}
      {tab === 'alerts' && <Alerts rtl={rtl} toast={toast} />}
      {tab === 'analyst' && <Analyst rtl={rtl} toast={toast} />}
    </>
  )
}
type Toast = ReturnType<typeof useToast>['toast']

// Simple vertical-bar trend chart (dependency-free; brand-token colored).
function Trend({ data, rtl, label }: { data: { period: string; value: number }[]; rtl: boolean; label: string }) {
  const max = Math.max(1, ...data.map(d => Math.abs(d.value)))
  return (
    <div>
      <p className="text-2xs text-text-tertiary mb-2">{label}</p>
      <div className="flex items-end gap-1 h-24" dir="ltr">
        {data.slice(-12).map((d, i) => (
          <div key={i} className="flex-1 rounded-t bg-brand" style={{ height: `${Math.max(3, Math.abs(d.value) / max * 100)}%`, opacity: d.value < 0 ? 0.4 : 1 }} title={`${d.period}: ${d.value.toLocaleString()}`} />
        ))}
      </div>
      {!data.length && <p className="text-2xs text-text-tertiary">{L(rtl, 'No data yet', 'داده‌ای نیست')}</p>}
    </div>
  )
}

// ── CFO Dashboard (M6/M7/M8) ─────────────────────────────────────────────────
interface CfoData {
  overview: { revenue: number; expense: number; profit: number; cash: number }
  kpis: { revenue: { monthly: number; annual: number; growthRatePct: number }; profit: { gross: number; net: number; grossMarginPct: number; netMarginPct: number }; cash: { position: number; burnRate: number; runwayMonths: number | null }; receivable: { outstanding: number; collectionDays: number | null }; payable: { outstanding: number }; inventory: { value: number; turnover: number | null } }
  workingCapital: { ar: number; ap: number; inventory: number }
  risk: { currencyExposure: { code: string; sharePct: number }[]; taxLiability: number; overBudget: { name: string; consumptionPct: number }[] }
  charts: { revenueTrend: { period: string; value: number }[]; expenseTrend: { period: string; value: number }[]; profitTrend: { period: string; value: number }[]; cashTrend: { period: string; value: number }[] }
}

function CfoDashboard({ rtl }: { rtl: boolean }) {
  const { money } = useDisplayCurrency()
  const [d, setD] = useState<CfoData | null>(null)
  const [dept, setDept] = useState<{ centers: { code: string; nameEn: string; nameFa: string | null; cost: number; revenue: number; profit: number }[]; totals: { revenue: number; cost: number; profit: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    (async () => {
      const r = await fetch('/api/admin/erp/finance/intelligence?view=cfo')
      if (r.ok) setD(await r.json())
      else { const dr = await fetch('/api/admin/erp/finance/intelligence?view=department'); if (dr.ok) setDept(await dr.json()) }
      setLoading(false)
    })()
  }, [])
  if (loading) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Loading…', 'بارگذاری…')}</Card>
  if (!d && dept) return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{L(rtl, 'Department Dashboard (scoped to your cost centers)', 'داشبورد بخش (محدود به مراکز شما)')}</h3>
      <table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Center', 'مرکز')}</th><th className="text-end">{L(rtl, 'Revenue', 'درآمد')}</th><th className="text-end">{L(rtl, 'Cost', 'هزینه')}</th><th className="text-end">{L(rtl, 'Profit', 'سود')}</th></tr></thead>
        <tbody>{dept.centers.map(c => <tr key={c.code} className="border-t border-subtle"><td className="py-1.5 text-text-secondary">{rtl ? (c.nameFa ?? c.nameEn) : c.nameEn}</td><td className="text-end">{money(c.revenue)}</td><td className="text-end">{money(c.cost)}</td><td className="text-end text-text-primary">{money(c.profit)}</td></tr>)}</tbody></table>
    </Card>
  )
  if (!d) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'No data', 'داده‌ای نیست')}</Card>
  const kc = (label: string, value: string, sub?: string) => (
    <div className="metric-card"><p className="text-overline">{label}</p><p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>{sub && <p className="text-2xs text-text-tertiary mt-1">{sub}</p>}</div>
  )
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kc(L(rtl, 'Revenue (monthly)', 'درآمد (ماهانه)'), money(d.overview.revenue), `${L(rtl, 'Growth', 'رشد')} ${d.kpis.revenue.growthRatePct}%`)}
        {kc(L(rtl, 'Net Profit', 'سود خالص'), money(d.overview.profit), `${L(rtl, 'Margin', 'حاشیه')} ${d.kpis.profit.netMarginPct}%`)}
        {kc(L(rtl, 'Cash Position', 'وضعیت نقدی'), money(d.overview.cash), d.kpis.cash.runwayMonths != null ? `${L(rtl, 'Runway', 'دوام')} ${d.kpis.cash.runwayMonths}mo` : undefined)}
        {kc(L(rtl, 'Gross Profit', 'سود ناخالص'), money(d.kpis.profit.gross), `${L(rtl, 'Margin', 'حاشیه')} ${d.kpis.profit.grossMarginPct}%`)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{L(rtl, 'Working Capital', 'سرمایه در گردش')}</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xs text-text-tertiary">{L(rtl, 'Receivables', 'دریافتنی')}</p><p className="text-lg font-bold text-text-primary">{money(d.workingCapital.ar)}</p></div>
            <div><p className="text-2xs text-text-tertiary">{L(rtl, 'Payables', 'پرداختنی')}</p><p className="text-lg font-bold text-text-primary">{money(d.workingCapital.ap)}</p></div>
            <div><p className="text-2xs text-text-tertiary">{L(rtl, 'Inventory', 'موجودی')}</p><p className="text-lg font-bold text-text-primary">{money(d.workingCapital.inventory)}</p></div>
          </div>
          <p className="text-2xs text-text-tertiary mt-4">{L(rtl, 'Collection days', 'دوره وصول')}: {d.kpis.receivable.collectionDays ?? '—'}</p>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{L(rtl, 'Risk', 'ریسک')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-secondary">{L(rtl, 'Tax liability', 'بدهی مالیاتی')}</span><span className="text-text-primary">{money(d.risk.taxLiability)}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">{L(rtl, 'Currency exposure', 'پوشش ارزی')}</span><span className="text-text-primary">{d.risk.currencyExposure.map(e => `${e.code} ${e.sharePct}%`).join(' · ') || '—'}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">{L(rtl, 'Over-budget', 'فراتر از بودجه')}</span><span>{d.risk.overBudget.length ? <Badge color="red">{d.risk.overBudget.length}</Badge> : <Badge color="green">0</Badge>}</span></div>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Trend data={d.charts.revenueTrend} rtl={rtl} label={L(rtl, 'Revenue trend', 'روند درآمد')} />
          <Trend data={d.charts.expenseTrend} rtl={rtl} label={L(rtl, 'Expense trend', 'روند هزینه')} />
          <Trend data={d.charts.profitTrend} rtl={rtl} label={L(rtl, 'Profit trend', 'روند سود')} />
          <Trend data={d.charts.cashTrend} rtl={rtl} label={L(rtl, 'Cash flow', 'جریان نقدی')} />
        </div>
      </Card>
    </div>
  )
}

// ── Budgets (M1/M2) ──────────────────────────────────────────────────────────
interface BudgetRow { id: number; nameEn: string; nameFa: string | null; budgetType: string; fiscalYear: number; status: string; total: number; version: number }
const BTYPES = ['annual', 'monthly', 'department', 'project', 'branch', 'company', 'cost_center']
function statusColor(s: string) { return s === 'locked' ? 'blue' : s === 'approved' ? 'green' : s === 'review' ? 'amber' : 'slate' }

function Budgets({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const { money } = useDisplayCurrency()
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [modal, setModal] = useState(false)
  const [analysis, setAnalysis] = useState<BudgetAnalysisData | null>(null)
  const [form, setForm] = useState({ nameEn: '', budgetType: 'annual', fiscalYear: 1405, lines: [{ category: '', amount: 0 }] })
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/finance/budgets'); if (r.ok) setRows((await r.json()).budgets ?? []) }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    const r = await fetch('/api/admin/erp/finance/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', nameEn: form.nameEn, budgetType: form.budgetType, fiscalYear: Number(form.fiscalYear), lines: form.lines.filter(l => l.category.trim()).map(l => ({ category: l.category, amount: Number(l.amount) || 0 })) }) })
    if (r.ok) { toast(L(rtl, 'Budget created', 'بودجه ساخته شد'), 'success'); setModal(false); setForm({ nameEn: '', budgetType: 'annual', fiscalYear: 1405, lines: [{ category: '', amount: 0 }] }); load() }
    else toast((await r.json().catch(() => ({}))).error || L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  async function transition(id: number, to: string) {
    const r = await fetch('/api/admin/erp/finance/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'transition', id, to }) })
    if (r.ok) { toast(L(rtl, 'Updated', 'به‌روزرسانی شد'), 'success'); load() } else toast((await r.json().catch(() => ({}))).error || L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  async function openAnalysis(id: number) { const r = await fetch(`/api/admin/erp/finance/budgets?analysis=${id}`); if (r.ok) setAnalysis(await r.json()) }
  const NEXT: Record<string, string | null> = { draft: 'review', review: 'approved', approved: 'locked', locked: null }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={() => setModal(true)}>{L(rtl, '+ New budget', '+ بودجه جدید')}</Btn></div>
      <Card className="p-4">
        <table className="w-full text-sm">
          <thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Budget', 'بودجه')}</th><th>{L(rtl, 'Type', 'نوع')}</th><th>{L(rtl, 'FY', 'سال')}</th><th className="text-end">{L(rtl, 'Total', 'جمع')}</th><th>{L(rtl, 'Status', 'وضعیت')}</th><th></th></tr></thead>
          <tbody>{rows.map(b => (
            <tr key={b.id} className="border-t border-subtle">
              <td className="py-2 text-text-primary">{rtl ? (b.nameFa ?? b.nameEn) : b.nameEn}</td>
              <td className="text-center text-text-secondary text-2xs">{b.budgetType}</td>
              <td className="text-center text-text-secondary">{b.fiscalYear}</td>
              <td className="text-end text-text-secondary">{money(b.total)}</td>
              <td className="text-center"><Badge color={statusColor(b.status)}>{b.status}</Badge></td>
              <td className="text-end whitespace-nowrap">
                <button onClick={() => openAnalysis(b.id)} className="text-2xs text-brand hover:underline mx-1">{L(rtl, 'Analysis', 'تحلیل')}</button>
                {NEXT[b.status] && <button onClick={() => transition(b.id, NEXT[b.status]!)} className="text-2xs text-text-secondary hover:text-text-primary mx-1">→ {NEXT[b.status]}</button>}
              </td>
            </tr>
          ))}{!rows.length && <tr><td colSpan={6} className="text-center text-text-tertiary py-6">{L(rtl, 'No budgets yet', 'بودجه‌ای ثبت نشده')}</td></tr>}</tbody>
        </table>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={L(rtl, 'New budget', 'بودجه جدید')} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Input label={L(rtl, 'Name', 'نام')} value={form.nameEn} onChange={v => setForm(f => ({ ...f, nameEn: v }))} />
            <Select label={L(rtl, 'Type', 'نوع')} value={form.budgetType} onChange={v => setForm(f => ({ ...f, budgetType: v }))} options={BTYPES.map(t => ({ value: t, label: t }))} />
            <Input label={L(rtl, 'Fiscal year', 'سال مالی')} type="number" value={String(form.fiscalYear)} onChange={v => setForm(f => ({ ...f, fiscalYear: Number(v) }))} />
          </div>
          <p className="text-2xs text-text-tertiary">{L(rtl, 'Budget lines (category + amount)', 'ردیف‌های بودجه (دسته + مبلغ)')}</p>
          {form.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input value={l.category} onChange={e => setForm(f => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, category: e.target.value } : x) }))} className="form-input col-span-7 !py-2" placeholder={L(rtl, 'e.g. Hardware', 'مثلاً سخت‌افزار')} />
              <input type="number" value={l.amount || ''} onChange={e => setForm(f => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x) }))} className="form-input col-span-4 text-end !py-2" />
              <button onClick={() => setForm(f => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, j) => j !== i) : f.lines }))} className="col-span-1 text-danger">✕</button>
            </div>
          ))}
          <button onClick={() => setForm(f => ({ ...f, lines: [...f.lines, { category: '', amount: 0 }] }))} className="text-2xs text-brand hover:underline">{L(rtl, '+ Add line', '+ افزودن ردیف')}</button>
          <div className="flex gap-2"><Btn onClick={create} disabled={!form.nameEn.trim()}>{L(rtl, 'Create', 'ایجاد')}</Btn><Btn variant="secondary" onClick={() => setModal(false)}>{L(rtl, 'Cancel', 'انصراف')}</Btn></div>
        </div>
      </Modal>

      {analysis && <BudgetAnalysisModal rtl={rtl} data={analysis} onClose={() => setAnalysis(null)} />}
    </div>
  )
}

interface BudgetAnalysisData { header: { nameEn: string; nameFa: string | null }; summary: { budget: number; actual: number; variance: number; variancePct: number; consumptionPct: number; remaining: number; status: string; overBudget: { key: string }[] }; byAccount: { key: string; budget: number; actual: number; variance: number; consumptionPct: number; status: string }[]; forecast: { projected: number; remaining: number; forecastVariance: number } }
function BudgetAnalysisModal({ rtl, data, onClose }: { rtl: boolean; data: BudgetAnalysisData; onClose: () => void }) {
  const { money } = useDisplayCurrency()
  const s = data.summary
  return (
    <Modal open onClose={onClose} title={L(rtl, 'Budget vs Actual', 'بودجه در برابر عملکرد')} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div><p className="text-2xs text-text-tertiary">{L(rtl, 'Budget', 'بودجه')}</p><p className="text-lg font-bold text-text-primary">{money(s.budget)}</p></div>
          <div><p className="text-2xs text-text-tertiary">{L(rtl, 'Actual', 'عملکرد')}</p><p className="text-lg font-bold text-text-primary">{money(s.actual)}</p></div>
          <div><p className="text-2xs text-text-tertiary">{L(rtl, 'Variance', 'مغایرت')}</p><p className="text-lg font-bold text-text-primary">{s.variancePct}%</p></div>
          <div><p className="text-2xs text-text-tertiary">{L(rtl, 'Consumption', 'مصرف')}</p><p className="text-lg font-bold text-text-primary">{s.consumptionPct}%</p></div>
        </div>
        <p className="text-2xs text-text-tertiary">{L(rtl, 'Forecast full-period', 'پیش‌بینی کل دوره')}: {money(data.forecast.projected)} · {L(rtl, 'remaining', 'باقی‌مانده')} {money(s.remaining)}</p>
        <table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start">{L(rtl, 'Account', 'حساب')}</th><th className="text-end">{L(rtl, 'Budget', 'بودجه')}</th><th className="text-end">{L(rtl, 'Actual', 'عملکرد')}</th><th className="text-end">{L(rtl, 'Consumption', 'مصرف')}</th></tr></thead>
          <tbody>{data.byAccount.map((r, i) => <tr key={i} className="border-t border-subtle"><td className="py-1.5 text-text-secondary">{r.key}</td><td className="text-end">{money(r.budget)}</td><td className="text-end">{money(r.actual)}</td><td className="text-end"><Badge color={r.status === 'over' ? 'red' : r.status === 'warning' ? 'amber' : 'green'}>{r.consumptionPct}%</Badge></td></tr>)}</tbody></table>
      </div>
    </Modal>
  )
}

// ── Cost / Profit Centers (M3/M4) ────────────────────────────────────────────
function Centers({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const { money } = useDisplayCurrency()
  const [data, setData] = useState<{ centers: { id: number; code: string; nameEn: string; nameFa: string | null; kind: string; revenue: number; cost: number; profit: number; marginPct: number }[]; totals: { revenue: number; cost: number; profit: number } } | null>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ code: '', nameEn: '', kind: 'department' })
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/finance/cost-centers?view=overview'); if (r.ok) setData(await r.json()) }, [])
  useEffect(() => { load() }, [load])
  async function create() {
    const r = await fetch('/api/admin/erp/finance/cost-centers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', code: form.code, nameEn: form.nameEn, kind: form.kind }) })
    if (r.ok) { toast(L(rtl, 'Center created', 'مرکز ساخته شد'), 'success'); setModal(false); setForm({ code: '', nameEn: '', kind: 'department' }); load() }
    else toast((await r.json().catch(() => ({}))).error || L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={() => setModal(true)}>{L(rtl, '+ New center', '+ مرکز جدید')}</Btn></div>
      <Card className="p-4">
        <table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Center', 'مرکز')}</th><th>{L(rtl, 'Kind', 'نوع')}</th><th className="text-end">{L(rtl, 'Revenue', 'درآمد')}</th><th className="text-end">{L(rtl, 'Cost', 'هزینه')}</th><th className="text-end">{L(rtl, 'Profit', 'سود')}</th><th className="text-end">{L(rtl, 'Margin', 'حاشیه')}</th></tr></thead>
          <tbody>{(data?.centers ?? []).map(c => <tr key={c.id} className="border-t border-subtle"><td className="py-2 text-text-primary">{c.code} — {rtl ? (c.nameFa ?? c.nameEn) : c.nameEn}</td><td className="text-center"><Badge color={c.kind === 'profit' ? 'green' : 'slate'}>{c.kind}</Badge></td><td className="text-end">{money(c.revenue)}</td><td className="text-end">{money(c.cost)}</td><td className="text-end text-text-primary">{money(c.profit)}</td><td className="text-end text-text-secondary">{c.marginPct}%</td></tr>)}
            {!data?.centers.length && <tr><td colSpan={6} className="text-center text-text-tertiary py-6">{L(rtl, 'No cost centers', 'مرکزی ثبت نشده')}</td></tr>}</tbody></table>
        {data && <p className="text-2xs text-text-tertiary mt-3">{L(rtl, 'Totals', 'جمع کل')}: {L(rtl, 'revenue', 'درآمد')} {money(data.totals.revenue)} · {L(rtl, 'cost', 'هزینه')} {money(data.totals.cost)} · {L(rtl, 'profit', 'سود')} {money(data.totals.profit)}</p>}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title={L(rtl, 'New cost/profit center', 'مرکز هزینه/سود جدید')}>
        <div className="space-y-3">
          <Input label={L(rtl, 'Code', 'کد')} value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="CC-OPS" />
          <Input label={L(rtl, 'Name', 'نام')} value={form.nameEn} onChange={v => setForm(f => ({ ...f, nameEn: v }))} />
          <Select label={L(rtl, 'Kind', 'نوع')} value={form.kind} onChange={v => setForm(f => ({ ...f, kind: v }))} options={['department', 'branch', 'project', 'business_unit', 'profit'].map(k => ({ value: k, label: k }))} />
          <div className="flex gap-2"><Btn onClick={create} disabled={!form.code.trim() || !form.nameEn.trim()}>{L(rtl, 'Create', 'ایجاد')}</Btn><Btn variant="secondary" onClick={() => setModal(false)}>{L(rtl, 'Cancel', 'انصراف')}</Btn></div>
        </div>
      </Modal>
    </div>
  )
}

// ── Forecasting (M5) ─────────────────────────────────────────────────────────
function Forecasting({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [metric, setMetric] = useState('revenue')
  const [method, setMethod] = useState('trend')
  const [result, setResult] = useState<{ history: { period: string; value: number }[]; forecast: { period: string; value: number }[]; nextValue: number } | null>(null)
  const run = useCallback(async () => { const r = await fetch(`/api/admin/erp/finance/forecast?run=1&metric=${metric}&method=${method}&horizon=3`); if (r.ok) setResult(await r.json()) }, [metric, method])
  useEffect(() => { run() }, [run])
  const combined = result ? [...result.history.map(h => ({ ...h, forecast: false })), ...result.forecast.map(f => ({ ...f, forecast: true }))] : []
  const max = Math.max(1, ...combined.map(c => Math.abs(c.value)))
  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <Select label={L(rtl, 'Metric', 'شاخص')} value={metric} onChange={setMetric} options={[['revenue', L(rtl, 'Revenue', 'درآمد')], ['expense', L(rtl, 'Expense', 'هزینه')], ['cash_flow', L(rtl, 'Cash flow', 'جریان نقدی')], ['profit', L(rtl, 'Profit', 'سود')]].map(([v, l]) => ({ value: v, label: l }))} />
        <Select label={L(rtl, 'Method', 'روش')} value={method} onChange={setMethod} options={[['trend', L(rtl, 'Historical trend', 'روند تاریخی')], ['moving_average', L(rtl, 'Moving average', 'میانگین متحرک')], ['growth', L(rtl, 'Growth %', 'درصد رشد')], ['seasonal', L(rtl, 'Seasonal', 'فصلی')]].map(([v, l]) => ({ value: v, label: l }))} />
      </div>
      <Card className="p-5">
        <div className="flex items-end gap-1 h-40" dir="ltr">
          {combined.slice(-15).map((c, i) => (
            <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(3, Math.abs(c.value) / max * 100)}%`, background: c.forecast ? 'var(--color-accent)' : 'var(--color-brand)', opacity: c.value < 0 ? 0.4 : 1 }} title={`${c.period}: ${c.value.toLocaleString()}${c.forecast ? ' (forecast)' : ''}`} />
          ))}
        </div>
        <p className="text-2xs text-text-tertiary mt-3">{L(rtl, 'Blue = actual · Cyan = forecast. Next period', 'آبی = واقعی · فیروزه‌ای = پیش‌بینی. دوره بعد')}: <strong className="text-text-primary">{(result?.nextValue ?? 0).toLocaleString()}</strong></p>
      </Card>
      <Btn onClick={async () => { const r = await fetch('/api/admin/erp/finance/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', nameEn: `${metric} ${method}`, metric, method, horizon: 3 }) }); if (r.ok) toast(L(rtl, 'Forecast saved', 'پیش‌بینی ذخیره شد'), 'success') }}>{L(rtl, 'Save forecast', 'ذخیره پیش‌بینی')}</Btn>
    </div>
  )
}

// ── Alerts (M9) ──────────────────────────────────────────────────────────────
function Alerts({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [alerts, setAlerts] = useState<{ id: number; kind: string; severity: string; titleEn: string; titleFa: string | null; detail: string; status: string }[]>([])
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/finance/alerts'); if (r.ok) setAlerts((await r.json()).alerts ?? []) }, [])
  useEffect(() => { load() }, [load])
  async function scan() { setBusy(true); const r = await fetch('/api/admin/erp/finance/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) }); setBusy(false); if (r.ok) { const d = await r.json(); toast(L(rtl, `Scan done — ${d.upserted} alerts`, `اسکن انجام شد — ${d.upserted} هشدار`), 'success'); load() } }
  async function setStatus(id: number, status: string) { const r = await fetch('/api/admin/erp/finance/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id, status }) }); if (r.ok) load() }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={scan} disabled={busy}>{busy ? L(rtl, 'Scanning…', 'در حال اسکن…') : L(rtl, 'Scan now', 'اسکن اکنون')}</Btn></div>
      <div className="space-y-2">
        {alerts.map(a => (
          <Card key={a.id} className="p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Badge color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'amber' : 'slate'}>{a.severity}</Badge>
              <div><p className="text-sm font-medium text-text-primary">{rtl ? (a.titleFa ?? a.titleEn) : a.titleEn}</p><p className="text-2xs text-text-tertiary">{a.detail}</p></div>
            </div>
            <div className="flex gap-2 whitespace-nowrap">
              {a.status === 'open' && <button onClick={() => setStatus(a.id, 'acknowledged')} className="text-2xs text-text-secondary hover:text-text-primary">{L(rtl, 'Ack', 'تأیید')}</button>}
              {a.status !== 'resolved' && <button onClick={() => setStatus(a.id, 'resolved')} className="text-2xs text-brand hover:underline">{L(rtl, 'Resolve', 'رفع')}</button>}
              {a.status !== 'open' && <Badge color="green">{a.status}</Badge>}
            </div>
          </Card>
        ))}
        {!alerts.length && <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'No alerts — run a scan.', 'هشداری نیست — اسکن کنید.')}</Card>}
      </div>
    </div>
  )
}

// ── AI Financial Analyst (M10) ───────────────────────────────────────────────
function Analyst({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [q, setQ] = useState(rtl ? 'چرا سود این ماه کاهش یافت؟' : 'Why did profit decrease this month?')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  async function ask() {
    setBusy(true); setAnswer('')
    try {
      const r = await fetch('/api/admin/erp/finance/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'diagnose', question: q, locale: rtl ? 'fa' : 'en' }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) setAnswer(d.text || ''); else toast(d.error || L(rtl, 'Failed', 'ناموفق'), 'error')
    } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <p className="text-sm text-text-secondary">{L(rtl, 'Ask the Financial Analyst — it reasons over live sales, purchases, expenses, currency and inventory (grounded, no invented numbers).', 'از تحلیل‌گر مالی بپرسید — روی فروش، خرید، هزینه، ارز و موجودی زنده استدلال می‌کند (مستند، بدون عدد ساختگی).')}</p>
        <Input label={L(rtl, 'Question', 'پرسش')} value={q} onChange={setQ} multiline rows={2} />
        <Btn onClick={ask} disabled={busy}>{busy ? L(rtl, 'Analyzing…', 'در حال تحلیل…') : L(rtl, 'Analyze', 'تحلیل کن')}</Btn>
      </Card>
      {answer && <Card className="p-5"><pre className="whitespace-pre-wrap text-sm text-text-secondary leading-7" style={{ fontFamily: 'inherit' }}>{answer}</pre></Card>}
    </div>
  )
}
