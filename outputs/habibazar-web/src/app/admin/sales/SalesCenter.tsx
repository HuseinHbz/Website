'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Tab = 'dashboard' | 'customers' | 'quote' | 'order' | 'invoice' | 'payments'
type DocType = 'quote' | 'order' | 'invoice' | 'credit_note' | 'debit_note'

interface Customer { id?: number; code: string; name: string; email: string | null; phone: string | null; company: string | null; taxId: string | null; kind?: string; nationalId?: string | null; regNo?: string | null; economicCode?: string | null; creditLimit: number; address?: string | null; notes?: string | null; active: number | boolean; invoiced?: number; paid?: number; outstanding?: number; available?: number; overLimit?: boolean; utilizationPct?: number }
interface DocRow { id: number; docType: DocType; docNo: string; date: string; dueDate: string | null; status: string; total: number; customerName: string; paid: number; currency?: string }
interface Line { description: string; qty: number; unitPrice: number; discountPct: number; taxPct: number; productId?: number | null }
interface Payment { id: number; date: string; amount: number; method: string; reference: string | null; note: string | null; customer: string; docNo: string | null }
interface Kpis { customers: number; quotes: number; orders: number; invoiced: number; collected: number; outstanding: number; wonValue: number; taxCollected: number }
interface Overview { kpis: Kpis; recent: DocRow[]; topCustomers: { name: string; invoiced: number }[] }

const money = (n: number | null | undefined) => fmtMoney(n, { max: 2 })
const STATUS_COLOR: Record<string, 'yellow' | 'blue' | 'indigo' | 'green' | 'red' | 'slate'> = { draft: 'slate', sent: 'blue', confirmed: 'indigo', partial: 'yellow', paid: 'green', void: 'red' }
const TABS: Tab[] = ['dashboard', 'customers', 'quote', 'order', 'invoice', 'payments']

export function SalesCenter() {
  const t = useT()
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [autoNew, setAutoNew] = useState(false)
  // Quick-action deep link (?new=invoice): unique route identity for 'New Invoice'.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === 'invoice') { setTab('invoice'); setAutoNew(true) }
  }, [])
  return (
    <>
      <ToastContainer />
      <PageHeader title={t('sales_title')} subtitle={t('sales_subtitle')} />
      <div className="flex gap-1 mb-6 border-b border-subtle overflow-x-auto">
        {TABS.map(tb => (
          <button key={tb} onClick={() => setTab(tb)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === tb ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {t(`sales_tab_${tb}` as 'sales_tab_dashboard')}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <Dashboard t={t} />}
      {tab === 'customers' && <Customers t={t} toast={toast} />}
      {(tab === 'quote' || tab === 'order' || tab === 'invoice') && <Documents key={tab} t={t} toast={toast} docType={tab} autoNew={tab === 'invoice' && autoNew} onAutoNew={() => setAutoNew(false)} />}
      {tab === 'payments' && <Payments t={t} toast={toast} />}
    </>
  )
}
type T = ReturnType<typeof useT>
type Toast = ReturnType<typeof useToast>['toast']

function Dashboard({ t }: { t: T }) {
  const { money: dmoney } = useDisplayCurrency()
  const [d, setD] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/sales/overview'); if (r.ok) setD(await r.json()) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  if (loading && !d) return <p className="text-sm text-text-tertiary">{t('sales_loading')}</p>
  if (!d) return <Card className="p-5"><p className="text-sm text-text-tertiary">{t('sales_empty')}</p></Card>
  const k = d.kpis
  const maxTop = Math.max(1, ...d.topCustomers.map(c => c.invoiced))
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><CurrencyPicker /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t('sales_kCustomers')} value={String(k.customers)} icon="👥" />
        <Kpi label={t('sales_kQuotes')} value={String(k.quotes)} icon="📄" />
        <Kpi label={t('sales_kOrders')} value={String(k.orders)} icon="🧾" />
        <Kpi label={t('sales_kWon')} value={dmoney(k.wonValue)} icon="🏆" tone="ok" />
        <Kpi label={t('sales_kInvoiced')} value={dmoney(k.invoiced)} icon="💳" />
        <Kpi label={t('sales_kCollected')} value={dmoney(k.collected)} icon="💰" tone="ok" />
        <Kpi label={t('sales_kOutstanding')} value={dmoney(k.outstanding)} icon="⏳" tone={k.outstanding > 0 ? 'warn' : undefined} />
        <Kpi label={t('sales_kTax')} value={dmoney(k.taxCollected)} icon="🧮" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('sales_topCustomers')}</h3>
          {d.topCustomers.length === 0 ? <p className="text-xs text-text-tertiary">{t('sales_empty')}</p> : (
            <div className="space-y-3">{d.topCustomers.map(c => (
              <div key={c.name}><div className="flex justify-between text-xs mb-1"><span className="text-text-secondary">{c.name}</span><span className="text-text-tertiary">{dmoney(c.invoiced)}</span></div><div className="h-2 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(c.invoiced / maxTop) * 100}%` }} /></div></div>
            ))}</div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('sales_recentDocs')}</h3>
          {d.recent.length === 0 ? <p className="text-xs text-text-tertiary">{t('sales_empty')}</p> : (
            <div className="space-y-2">{d.recent.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm"><span className="text-text-secondary truncate">{r.docNo} · {r.customerName}</span><div className="flex items-center gap-2 shrink-0"><span className="text-xs text-text-tertiary">{money(r.total)}</span><Badge color={STATUS_COLOR[r.status]}>{t(`sales_st_${r.status}` as 'sales_st_draft')}</Badge></div></div>
            ))}</div>
          )}
        </Card>
      </div>
      <PerformanceSection />
    </div>
  )
}

/** Targets · commission · forecast (Phase 26.4). */
function PerformanceSection() {
  const locale = useAdminLocale()
  const fa = locale === 'fa'
  const lp = (en: string, faL: string) => (fa ? faL : en)
  interface PerfMonth { month: string; invoiced: number; target: number; commissionPct: number; attainmentPct: number; commission: number; status: string }
  interface Perf { months: PerfMonth[]; totals: { invoiced: number; target: number; attainmentPct: number; commission: number }; forecast: { month: string; invoiced: number }[] }
  const [d, setD] = useState<Perf | null>(null)
  const [form, setForm] = useState({ period: new Date().toISOString().slice(0, 7), target: '', commissionPct: '' })
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/erp/sales/performance').then(x => x.json()).catch(() => null)
    if (r?.months) setD(r)
  }, [])
  useEffect(() => { load() }, [load])
  async function save() {
    if (!/^\d{4}-\d{2}$/.test(form.period)) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/sales/performance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: form.period, target: Number(form.target) || 0, commissionPct: Number(form.commissionPct) || 0 }),
      })
      if (r.ok) { setForm(f => ({ ...f, target: '', commissionPct: '' })); load() }
    } finally { setSaving(false) }
  }
  if (!d) return null
  const STATUS_BADGE: Record<string, string> = { above: 'green', near: 'yellow', below: 'red', no_target: 'slate' }
  const peak = Math.max(1, ...d.months.map(m => Math.max(m.invoiced, m.target)), ...d.forecast.map(f => f.invoiced))
  const shown = [...d.months.slice(-6)]
  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{lp('Sales performance — targets · commission · forecast', 'عملکرد فروش — هدف · پورسانت · پیش‌بینی')}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <Input label={lp('Period', 'دوره')} value={form.period} onChange={v => setForm(f => ({ ...f, period: v }))} placeholder="2026-07" className="w-28" />
          <Input label={lp('Target', 'هدف')} value={form.target} onChange={v => setForm(f => ({ ...f, target: v }))} className="w-32" />
          <Input label={lp('Comm. %', 'پورسانت ٪')} value={form.commissionPct} onChange={v => setForm(f => ({ ...f, commissionPct: v }))} className="w-20" />
          <Btn size="sm" onClick={save} disabled={saving}>{lp('Set target', 'ثبت هدف')}</Btn>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          [lp('Invoiced (12m)', 'فاکتورشده (۱۲ ماه)'), money(d.totals.invoiced)],
          [lp('Target (12m)', 'هدف (۱۲ ماه)'), money(d.totals.target)],
          [lp('Attainment', 'تحقق هدف'), `${d.totals.attainmentPct}%`],
          [lp('Commission', 'پورسانت'), money(d.totals.commission)],
        ] as const).map(([label, v]) => (
          <div key={label} className="rounded-xl p-3 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary">{label}</p><p className="text-lg font-bold text-text-primary">{v}</p></div>
        ))}
      </div>
      <div className="space-y-1.5">
        {shown.map(m => (
          <div key={m.month} className="grid grid-cols-12 items-center gap-2 text-xs rounded-lg px-2 py-1.5">
            <span className="col-span-2 font-mono text-text-tertiary">{m.month}</span>
            <div className="col-span-4 space-y-0.5">
              <div className="h-2 rounded bg-sunken overflow-hidden"><div className="h-full bg-brand" style={{ width: `${Math.min(100, (m.invoiced / peak) * 100)}%` }} /></div>
              <div className="h-1 rounded bg-sunken overflow-hidden"><div className="h-full bg-warning" style={{ width: `${Math.min(100, (m.target / peak) * 100)}%` }} /></div>
            </div>
            <span className="col-span-2 text-end text-text-secondary">{money(m.invoiced)}</span>
            <span className="col-span-2 text-end text-text-tertiary">{m.target > 0 ? money(m.target) : '—'}</span>
            <span className="col-span-1 text-end"><Badge color={STATUS_BADGE[m.status]}>{m.target > 0 ? `${m.attainmentPct}%` : '—'}</Badge></span>
            <span className="col-span-1 text-end text-text-secondary">{m.commission > 0 ? money(m.commission) : '—'}</span>
          </div>
        ))}
        {d.forecast.map(f => (
          <div key={f.month} className="grid grid-cols-12 items-center gap-2 text-xs rounded-lg px-2 py-1.5 border border-dashed border-subtle opacity-80">
            <span className="col-span-2 font-mono text-text-tertiary">{f.month} <span className="text-4xs">{lp('(fc)', '(پیش‌بینی)')}</span></span>
            <div className="col-span-4"><div className="h-2 rounded bg-sunken overflow-hidden"><div className="h-full bg-brand/60" style={{ width: `${Math.min(100, (f.invoiced / peak) * 100)}%` }} /></div></div>
            <span className="col-span-6 text-end text-text-tertiary">{money(f.invoiced)}</span>
          </div>
        ))}
      </div>
      <p className="text-3xs text-text-tertiary">{lp('Bars: invoiced (top) vs target (thin). Commission = invoiced × rate. Forecast = linear trend of the trailing year.', 'میله‌ها: فاکتورشده (بالا) در برابر هدف (نازک). پورسانت = فاکتورشده × نرخ. پیش‌بینی = روند خطی سال اخیر.')}</p>
    </Card>
  )
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'ok' | 'warn' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : 'border-subtle'
  return <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}><div className="flex items-center justify-between mb-1"><p className="text-xs text-text-tertiary">{label}</p><span aria-hidden>{icon}</span></div><p className="text-lg font-bold text-text-primary">{value}</p></div>
}

// ── Customers ────────────────────────────────────────────────────────────────
function Customers({ t, toast }: { t: T; toast: Toast }) {
  const locale = useAdminLocale()
  const rtl = locale === 'fa'
  const lc2 = (en: string, fa: string) => (rtl ? fa : en)
  const [rows, setRows] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Customer>({ code: '', name: '', email: '', phone: '', company: '', taxId: '', kind: 'company', nationalId: '', regNo: '', economicCode: '', creditLimit: 0, address: '', notes: '', active: true })
  const [saving, setSaving] = useState(false)
  const [stmtFor, setStmtFor] = useState<Customer | null>(null)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/sales/customers'); if (r.ok) { const d = await r.json(); setRows(d.customers ?? []) } } catch { toast(t('sales_loadFail'), 'error') } finally { setLoading(false) } }, [toast, t])
  useEffect(() => { load() }, [load])
  function set<K extends keyof Customer>(k: K, v: Customer[K]) { setEditing(e => ({ ...e, [k]: v })) }
  async function save() {
    if (!editing.code.trim() || !editing.name.trim()) return
    setSaving(true)
    try { const r = await fetch('/api/admin/erp/sales/customers', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editing, active: !!editing.active }) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed'); toast(t('sales_saved'), 'success'); setModal(false); load() }
    catch (e) { toast(e instanceof Error ? e.message : t('sales_saveFail'), 'error') } finally { setSaving(false) }
  }
  const columns: Column<Customer>[] = [
    { key: 'code', labelEn: 'Code', labelFa: t('sales_cCode'), render: c => <span className="font-mono text-xs text-text-secondary">{c.code}</span> },
    { key: 'name', labelEn: 'Name', labelFa: t('sales_cName'), render: c => <div className="text-text-primary">{c.name}<div className="text-xs text-text-tertiary">{c.company || c.email || ''}</div></div> },
    { key: 'kind', labelEn: 'Kind', labelFa: lc2('Kind', 'نوع شخص'), type: 'enum', render: c => <Badge color={c.kind === 'individual' ? 'blue' : 'indigo'}>{c.kind === 'individual' ? lc2('Individual', 'حقیقی') : lc2('Company', 'حقوقی')}</Badge> },
    { key: 'creditLimit', labelEn: 'Limit', labelFa: t('sales_cLimit'), type: 'number', numeric: true, render: c => <span className="text-text-secondary text-xs">{money(c.creditLimit)}</span> },
    { key: 'outstanding', labelEn: 'Outstanding', labelFa: t('sales_cOutstanding'), type: 'number', numeric: true, value: c => c.outstanding ?? 0, render: c => <span className="text-text-secondary text-xs">{money(c.outstanding)}{c.overLimit && <Badge color="red">{t('sales_overLimit')}</Badge>}</span> },
    { key: 'available', labelEn: 'Available', labelFa: t('sales_cAvailable'), type: 'number', numeric: true, value: c => c.available ?? 0, render: c => <span className="text-text-secondary text-xs">{money(c.available)}</span> },
  ]
  const rowActions: RowAction<Customer>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('sales_edit'), icon: '✎', onClick: c => { setEditing({ ...c, active: !!c.active }); setModal(true) } },
    { id: 'statement', labelEn: 'Statement', labelFa: lc2('Statement', 'صورت‌حساب'), icon: '📑', onClick: c => setStmtFor(c) },
  ]
  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { setEditing({ code: '', name: '', email: '', phone: '', company: '', taxId: '', kind: 'company', nationalId: '', regNo: '', economicCode: '', creditLimit: 0, address: '', notes: '', active: true }); setModal(true) }}>{t('sales_newCustomer')}</Btn></div>
      <Card className="p-4">
        <DataTable tableId="sales-customers" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={c => String(c.id)} rowActions={rowActions} exportName="customers" emptyLabel={t('sales_noCustomers')} />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('sales_editCustomer') : t('sales_newCustomer')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><Input label={t('sales_fCode')} value={editing.code} onChange={v => set('code', v)} /><Input label={t('sales_fName')} value={editing.name} onChange={v => set('name', v)} /></div>
          <div className="grid grid-cols-2 gap-4"><Input label={t('sales_fEmail')} value={editing.email || ''} onChange={v => set('email', v)} /><Input label={t('sales_fPhone')} value={editing.phone || ''} onChange={v => set('phone', v)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={lc2('Party kind', 'نوع شخص')} value={editing.kind || 'company'} onChange={v => set('kind', v)} options={[{ value: 'company', label: lc2('Company (حقوقی)', 'حقوقی') }, { value: 'individual', label: lc2('Individual (حقیقی)', 'حقیقی') }]} />
            <Input label={editing.kind === 'individual' ? lc2('National ID (کد ملی)', 'کد ملی') : lc2('National ID (شناسه ملی)', 'شناسه ملی')} value={editing.nationalId || ''} onChange={v => set('nationalId', v)} />
          </div>
          {editing.kind !== 'individual' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label={lc2('Registration no', 'شماره ثبت')} value={editing.regNo || ''} onChange={v => set('regNo', v)} />
              <Input label={lc2('Economic code', 'کد اقتصادی')} value={editing.economicCode || ''} onChange={v => set('economicCode', v)} />
            </div>
          )}
          <div className="grid grid-cols-3 gap-4"><Input label={t('sales_fCompany')} value={editing.company || ''} onChange={v => set('company', v)} /><Input label={t('sales_fTaxId')} value={editing.taxId || ''} onChange={v => set('taxId', v)} /><Input label={t('sales_fLimit')} type="number" value={String(editing.creditLimit)} onChange={v => set('creditLimit', Number(v) || 0)} /></div>
          <Input label={t('sales_fAddress')} value={editing.address || ''} onChange={v => set('address', v)} multiline rows={2} />
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={!!editing.active} onChange={e => set('active', e.target.checked)} /> {t('sales_fActive')}</label>
          <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? t('sales_saving') : t('sales_save')}</Btn><Btn variant="secondary" onClick={() => setModal(false)}>{t('sales_cancel')}</Btn></div>
        </div>
      </Modal>
      {stmtFor && <StatementModal fa={rtl} customer={stmtFor} onClose={() => setStmtFor(null)} />}
      <PriceListManager fa={rtl} toast={toast} />
    </>
  )
}

/** Customer financial statement: invoices/credit notes vs payments with a running balance (Phase 26.4). */
function StatementModal({ fa, customer, onClose }: { fa: boolean; customer: Customer; onClose: () => void }) {
  const lp = (en: string, faL: string) => (fa ? faL : en)
  interface StLine { date: string; kind: string; ref: string; debit: number; credit: number; balance: number }
  interface St { lines: StLine[]; totals: { debit: number; credit: number; balance: number } }
  const [d, setD] = useState<St | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/admin/erp/sales/customers?statement=${customer.id}`).then(r => r.json()).then(setD).catch(() => {}).finally(() => setLoading(false))
  }, [customer.id])
  const KIND: Record<string, [string, string, string]> = { invoice: ['Invoice', 'فاکتور', 'blue'], credit_note: ['Credit note', 'برگشت از فروش', 'yellow'], debit_note: ['Debit note', 'اعلامیه بدهکار', 'indigo'], payment: ['Payment', 'پرداخت', 'green'] }
  return (
    <Modal open onClose={onClose} title={lp(`Statement — ${customer.name}`, `صورت‌حساب — ${customer.name}`)} size="lg">
      {loading ? <div className="h-40 rounded-xl bg-surface-2 animate-pulse" /> : !d ? (
        <p className="text-sm text-text-tertiary">{lp('Statement unavailable.', 'صورت‌حساب در دسترس نیست.')}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {([[lp('Invoiced', 'فاکتورشده'), d.totals.debit], [lp('Settled', 'تسویه‌شده'), d.totals.credit], [lp('Balance due', 'مانده بدهی'), d.totals.balance]] as const).map(([label, v]) => (
              <div key={label} className="rounded-xl p-3 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary">{label}</p><p className={`text-lg font-bold ${label === lp('Balance due', 'مانده بدهی') && v > 0 ? 'text-danger-text' : 'text-text-primary'}`}>{money(v)}</p></div>
            ))}
          </div>
          {d.lines.length === 0 ? <p className="text-sm text-text-tertiary">{lp('No transactions yet.', 'تراکنشی نیست.')}</p> : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              <div className="grid grid-cols-12 gap-2 text-3xs text-text-tertiary px-2">
                <span className="col-span-2">{lp('Date', 'تاریخ')}</span><span className="col-span-3">{lp('Ref', 'مرجع')}</span><span className="col-span-2">{lp('Type', 'نوع')}</span>
                <span className="col-span-2 text-end">{lp('Debit', 'بدهکار')}</span><span className="col-span-1 text-end">{lp('Credit', 'بستانکار')}</span><span className="col-span-2 text-end">{lp('Balance', 'مانده')}</span>
              </div>
              {d.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center text-xs border border-subtle rounded-lg px-2 py-1.5">
                  <span className="col-span-2 font-mono text-text-tertiary">{l.date}</span>
                  <span className="col-span-3 font-mono text-text-secondary truncate">{l.ref}</span>
                  <span className="col-span-2"><Badge color={KIND[l.kind]?.[2] || 'slate'}>{fa ? KIND[l.kind]?.[1] : KIND[l.kind]?.[0]}</Badge></span>
                  <span className="col-span-2 text-end text-text-secondary">{l.debit ? money(l.debit) : '—'}</span>
                  <span className="col-span-1 text-end text-success-text">{l.credit ? money(l.credit) : '—'}</span>
                  <span className={`col-span-2 text-end font-semibold ${l.balance > 0 ? 'text-text-primary' : 'text-success-text'}`}>{money(l.balance)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end"><Btn variant="ghost" onClick={onClose}>{lp('Close', 'بستن')}</Btn></div>
        </div>
      )}
    </Modal>
  )
}

// ── Documents (quote / order / invoice) ──────────────────────────────────────
function Documents({ t, toast, docType, autoNew = false, onAutoNew }: { t: T; toast: Toast; docType: 'quote' | 'order' | 'invoice'; autoNew?: boolean; onAutoNew?: () => void }) {
  const locale = useAdminLocale()
  const [rows, setRows] = useState<DocRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [customerId, setCustomerId] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [currency, setCurrency] = useState('IRR')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 0 }])
  const [saving, setSaving] = useState(false)
  const [payFor, setPayFor] = useState<DocRow | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [priceLists, setPriceLists] = useState<{ id: number; code: string; nameEn: string; nameFa: string }[]>([])
  const [plId, setPlId] = useState('')
  const [plItems, setPlItems] = useState<{ productId: number; sku: string; nameEn: string; nameFa: string | null; unitPrice: number }[]>([])
  useEffect(() => { if (autoNew) { setModal(true); onAutoNew?.() } }, [autoNew, onAutoNew])
  useEffect(() => { fetch('/api/admin/erp/sales/pricelists').then(r => r.json()).then(d => setPriceLists(d.priceLists ?? [])).catch(() => {}) }, [])
  useEffect(() => { if (!plId) { setPlItems([]); return } fetch(`/api/admin/erp/sales/pricelists?items=${plId}`).then(r => r.json()).then(d => setPlItems(d.items ?? [])).catch(() => {}) }, [plId])
  function addFromPriceList(productId: number) { const it = plItems.find(x => x.productId === productId); if (!it) return; setLines(ls => [...ls.filter(l => l.description.trim() || l.unitPrice), { description: locale === 'fa' ? (it.nameFa || it.nameEn) : it.nameEn, qty: 1, unitPrice: it.unitPrice, discountPct: 0, taxPct: 9, productId: it.productId }]) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, c] = await Promise.all([fetch(`/api/admin/erp/sales/documents?type=${docType}`).then(r => r.json()), fetch('/api/admin/erp/sales/customers').then(r => r.json())])
      setRows(d.documents ?? []); setCustomers((c.customers ?? []).filter((x: Customer) => x.active !== 0))
    } catch { toast(t('sales_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t, docType])
  useEffect(() => { load() }, [load])

  const totals = useMemo(() => {
    let sub = 0, disc = 0, tax = 0, total = 0
    for (const l of lines) { const g = l.qty * l.unitPrice; const d = g * Math.min(100, Math.max(0, l.discountPct)) / 100; const n = g - d; const tx = n * Math.min(100, Math.max(0, l.taxPct)) / 100; sub += g; disc += d; tax += tx; total += n + tx }
    return { sub, disc, tax, total }
  }, [lines])

  function setLine(i: number, patch: Partial<Line>) { setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l)) }
  function reset() { setCustomerId(0); setDate(new Date().toISOString().slice(0, 10)); setNotes(''); setLines([{ description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 0 }]) }
  async function save(sendAfter: boolean) {
    const clean = lines.filter(l => l.description.trim() && l.qty > 0)
    if (!customerId || clean.length === 0) { toast(t('sales_docInvalid'), 'error'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/sales/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docType, currency, customerId, date, notes, lines: clean.map(l => ({ description: l.description, qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, taxPct: l.taxPct, productId: l.productId ?? undefined })) }) })
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed')
      if (sendAfter && d.id) await fetch('/api/admin/erp/sales/documents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, op: 'send' }) })
      toast(t('sales_saved'), 'success'); setModal(false); reset(); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('sales_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function op(id: number, o: string, toType?: string) {
    const r = await fetch('/api/admin/erp/sales/documents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, op: o, toType }) })
    if (r.ok) { toast(t('sales_saved'), 'success'); load() } else { const d = await r.json().catch(() => ({})); toast(d.error || t('sales_saveFail'), 'error') }
  }
  async function pay() {
    if (!payFor || payAmount <= 0) return
    try {
      // Resolve the invoice's customer, then record the payment against it.
      const dd = await fetch(`/api/admin/erp/sales/documents?id=${payFor.id}`).then(x => x.json())
      const r = await fetch('/api/admin/erp/sales/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: dd.doc.customerId, documentId: payFor.id, date: new Date().toISOString().slice(0, 10), amount: payAmount, method: 'bank', reference: payFor.docNo }) })
      if (!r.ok) throw new Error()
      toast(t('sales_paymentAdded'), 'success'); setPayFor(null); setPayAmount(0); load()
    } catch { toast(t('sales_saveFail'), 'error') }
  }

  const columns: Column<DocRow>[] = [
    { key: 'docNo', labelEn: 'No.', labelFa: t('sales_cNo'), render: r => <span className="font-mono text-xs text-text-secondary">{r.docNo}</span> },
    { key: 'customerName', labelEn: 'Customer', labelFa: t('sales_cCustomer'), render: r => <span className="text-text-secondary">{r.customerName}</span> },
    { key: 'date', labelEn: 'Date', labelFa: t('sales_cDate'), type: 'date', render: r => <span className="text-text-tertiary text-xs">{r.date}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('sales_cStatus'), type: 'enum', options: ['draft', 'sent', 'confirmed', 'partial', 'paid', 'void'].map(x => ({ value: x, labelEn: x, labelFa: x })), render: r => <Badge color={STATUS_COLOR[r.status]}>{t(`sales_st_${r.status}` as 'sales_st_draft')}</Badge> },
    { key: 'total', labelEn: 'Total', labelFa: t('sales_cTotal'), type: 'number', numeric: true, render: r => <span className="text-text-secondary text-xs">{fmtMoney(r.total, { max: 2, currency: r.currency })}{docType === 'invoice' && r.paid > 0 && <span className="text-text-tertiary"> ({fmtMoney(r.paid, { max: 2, currency: r.currency })})</span>}</span> },
  ]
  // Soft delete (super_admin/administrator; the server enforces RBAC).
  async function del(r: DocRow) {
    const reason = window.prompt(locale === 'fa' ? `دلیل حذف ${r.docNo}؟` : `Reason for deleting ${r.docNo}?`)
    if (reason === null) return
    const res = await fetch('/api/admin/erp/sales/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, reason: reason.trim() || undefined }) })
    const d = await res.json().catch(() => ({}))
    if (res.ok) { toast(locale === 'fa' ? 'سند حذف شد' : 'Document deleted', 'success'); load() }
    else toast(d.error || (locale === 'fa' ? 'حذف ناموفق — نیازمند نقش مدیر' : 'Delete failed — requires an admin role'), 'error')
  }
  const rowActions: RowAction<DocRow>[] = [
    { id: 'send', labelEn: 'Send', labelFa: t('sales_send'), icon: '➤', hidden: r => r.status !== 'draft', onClick: r => op(r.id, 'send') },
    { id: 'toOrder', labelEn: 'To Order', labelFa: t('sales_toOrder'), icon: '→', hidden: r => !(docType === 'quote' && r.status !== 'void'), onClick: r => op(r.id, 'convert', 'order') },
    { id: 'toInvoice', labelEn: 'To Invoice', labelFa: t('sales_toInvoice'), icon: '→', hidden: r => !(docType === 'order' && r.status !== 'void'), onClick: r => op(r.id, 'convert', 'invoice') },
    { id: 'pay', labelEn: 'Record Payment', labelFa: t('sales_recordPay'), icon: '💰', hidden: r => !(docType === 'invoice' && r.status !== 'paid' && r.status !== 'void'), onClick: r => { setPayFor(r); setPayAmount(r.total - r.paid) } },
    { id: 'return', labelEn: 'Return (credit note)', labelFa: locale === 'fa' ? 'برگشت (اعلامیه بستانکار)' : 'Return (credit note)', icon: '↩', hidden: r => !(docType === 'invoice' && r.status !== 'void'), onClick: r => op(r.id, 'return') },
    { id: 'void', labelEn: 'Void', labelFa: t('sales_void'), icon: '✕', danger: true, hidden: r => r.status === 'void', onClick: r => op(r.id, 'void') },
    { id: 'delete', labelEn: 'Delete', labelFa: locale === 'fa' ? 'حذف' : 'Delete', icon: '🗑', danger: true, hidden: r => r.paid > 0, onClick: r => del(r) },
  ]
  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { reset(); setModal(true) }}>{t(`sales_new_${docType}` as 'sales_new_quote')}</Btn></div>
      <Card className="p-4">
        <DataTable tableId={`sales-${docType}`} columns={columns} rows={rows} locale={locale} loading={loading} rowKey={r => String(r.id)} rowActions={rowActions} exportName={`sales-${docType}`} emptyLabel={t('sales_noDocs')} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={t(`sales_new_${docType}` as 'sales_new_quote')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('sales_fCustomer')} value={String(customerId)} onChange={v => setCustomerId(Number(v))} options={[{ value: '0', label: t('sales_selectCustomer') }, ...customers.map(c => ({ value: String(c.id), label: `${c.code} — ${c.name}` }))]} />
            <Input label={t('sales_fDate')} type="date" value={date} onChange={setDate} />
            <Select label={locale === 'fa' ? 'ارز' : 'Currency'} value={currency} onChange={setCurrency} options={['IRR', 'IRT', 'USD', 'EUR'].map(c => ({ value: c, label: c }))} />
            {priceLists.length > 0 && <Select label={locale === 'fa' ? 'فهرست قیمت' : 'Price list'} value={plId} onChange={setPlId} options={[{ value: '', label: '—' }, ...priceLists.map(p => ({ value: String(p.id), label: locale === 'fa' ? p.nameFa : p.nameEn }))]} />}
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-text-tertiary px-1"><span className="col-span-5">{t('sales_lDesc')}</span><span className="col-span-1 text-right">{t('sales_lQty')}</span><span className="col-span-2 text-right">{t('sales_lPrice')}</span><span className="col-span-1 text-right">{t('sales_lDisc')}</span><span className="col-span-1 text-right">{t('sales_lTax')}</span><span className="col-span-2 text-right">{t('sales_lTotal')}</span></div>
            {lines.map((l, i) => {
              const g = l.qty * l.unitPrice; const net = g - g * l.discountPct / 100; const lt = net + net * l.taxPct / 100
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={l.description} onChange={e => setLine(i, { description: e.target.value })} className="form-input col-span-5 !py-2" placeholder={t('sales_lDesc')} />
                  <input type="number" value={l.qty || ''} onChange={e => setLine(i, { qty: Number(e.target.value) || 0 })} className="form-input col-span-1 text-right !py-2" />
                  <input type="number" value={l.unitPrice || ''} onChange={e => setLine(i, { unitPrice: Number(e.target.value) || 0 })} className="form-input col-span-2 text-right !py-2" />
                  <input type="number" value={l.discountPct || ''} onChange={e => setLine(i, { discountPct: Number(e.target.value) || 0 })} className="form-input col-span-1 text-right !py-2" />
                  <input type="number" value={l.taxPct || ''} onChange={e => setLine(i, { taxPct: Number(e.target.value) || 0 })} className="form-input col-span-1 text-right !py-2" />
                  <span className="col-span-1 text-right text-xs text-text-secondary">{money(lt)}</span>
                  <button onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)} className="col-span-1 text-xs text-danger hover:underline">✕</button>
                </div>
              )
            })}
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 0 }])} className="text-xs text-brand hover:underline">{t('sales_addLine')}</button>
              {plId && plItems.length > 0 && (
                <select onChange={e => { if (e.target.value) { addFromPriceList(Number(e.target.value)); e.target.value = '' } }} className="form-input !py-1.5 text-xs max-w-xs" defaultValue="">
                  <option value="">{locale === 'fa' ? '＋ افزودن از فهرست قیمت' : '＋ Add from price list'}</option>
                  {plItems.map(it => <option key={it.productId} value={it.productId}>{it.sku} · {locale === 'fa' ? (it.nameFa || it.nameEn) : it.nameEn} — {it.unitPrice.toLocaleString()}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-subtle p-3 grid grid-cols-4 gap-2 text-sm">
            <div><p className="text-xs text-text-tertiary">{t('sales_subtotal')}</p><p className="font-medium text-text-secondary">{money(totals.sub)}</p></div>
            <div><p className="text-xs text-text-tertiary">{t('sales_discount')}</p><p className="font-medium text-text-secondary">{money(totals.disc)}</p></div>
            <div><p className="text-xs text-text-tertiary">{t('sales_tax')}</p><p className="font-medium text-text-secondary">{money(totals.tax)}</p></div>
            <div><p className="text-xs text-text-tertiary">{t('sales_total')}</p><p className="font-bold text-text-primary">{money(totals.total)}</p></div>
          </div>
          <Input label={t('sales_fNotes')} value={notes} onChange={setNotes} multiline rows={2} />
          <div className="flex gap-3">
            <Btn onClick={() => save(true)} disabled={saving}>{t('sales_saveSend')}</Btn>
            <Btn variant="secondary" onClick={() => save(false)} disabled={saving}>{t('sales_saveDraft')}</Btn>
            <Btn variant="ghost" onClick={() => setModal(false)}>{t('sales_cancel')}</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={t('sales_recordPay')} size="sm">
        {payFor && <div className="space-y-4">
          <p className="text-sm text-text-secondary">{payFor.docNo} · {t('sales_total')}: {money(payFor.total)} · {t('sales_paid')}: {money(payFor.paid)}</p>
          <Input label={t('sales_amount')} type="number" value={String(payAmount)} onChange={v => setPayAmount(Number(v) || 0)} />
          <div className="flex gap-3"><Btn onClick={pay}>{t('sales_save')}</Btn><Btn variant="secondary" onClick={() => setPayFor(null)}>{t('sales_cancel')}</Btn></div>
        </div>}
      </Modal>
    </>
  )
}

// ── Payments ledger ──────────────────────────────────────────────────────────
function Payments({ t, toast }: { t: T; toast: Toast }) {
  const locale = useAdminLocale()
  const [rows, setRows] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/sales/payments'); if (r.ok) { const d = await r.json(); setRows(d.payments ?? []) } } catch { toast(t('sales_loadFail'), 'error') } finally { setLoading(false) } }, [toast, t])
  useEffect(() => { load() }, [load])
  const columns: Column<Payment>[] = [
    { key: 'date', labelEn: 'Date', labelFa: t('sales_cDate'), type: 'date', render: p => <span className="text-text-tertiary text-xs">{p.date}</span> },
    { key: 'customer', labelEn: 'Customer', labelFa: t('sales_cCustomer'), render: p => <span className="text-text-secondary">{p.customer}</span> },
    { key: 'docNo', labelEn: 'No.', labelFa: t('sales_cNo'), render: p => <span className="font-mono text-xs text-text-tertiary">{p.docNo || '—'}</span> },
    { key: 'method', labelEn: 'Method', labelFa: t('sales_pMethod'), type: 'enum', render: p => <Badge color="slate">{t(`sales_pm_${p.method}` as 'sales_pm_cash')}</Badge> },
    { key: 'amount', labelEn: 'Amount', labelFa: t('sales_amount'), type: 'number', numeric: true, render: p => <span className="text-success-text text-xs font-medium">{money(p.amount)}</span> },
  ]
  return (
    <Card className="p-4">
      <DataTable tableId="sales-payments" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={p => String(p.id)} exportName="payments" emptyLabel={t('sales_noPayments')} />
    </Card>
  )
}

/** Price list management (Phase 26.9): named catalogs of product prices for sales lines. */
function PriceListManager({ fa, toast }: { fa: boolean; toast: Toast }) {
  const lp = (en: string, faS: string) => (fa ? faS : en)
  interface PL { id: number; code: string; nameEn: string; nameFa: string; currency: string; itemCount: number }
  interface Prod { id: number; sku: string; nameEn: string; nameFa: string | null }
  interface Item { productId: number; sku: string; nameEn: string; nameFa: string | null; unitPrice: number }
  const [lists, setLists] = useState<PL[]>([])
  const [products, setProducts] = useState<Prod[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [nl, setNl] = useState({ code: '', nameEn: '', currency: 'IRR' })
  const [add, setAdd] = useState({ productId: '', unitPrice: '' })
  const load = useCallback(async () => {
    const [l, p] = await Promise.all([
      fetch('/api/admin/erp/sales/pricelists').then(r => r.json()),
      fetch('/api/admin/erp/inventory/products').then(r => r.json()).catch(() => ({ products: [] })),
    ])
    setLists(l.priceLists ?? []); setProducts((p.products ?? []).map((x: { id: number; sku: string; nameEn: string; nameFa: string | null }) => ({ id: x.id, sku: x.sku, nameEn: x.nameEn, nameFa: x.nameFa })))
  }, [])
  useEffect(() => { load() }, [load])
  const loadItems = useCallback(async (id: number) => { const d = await fetch(`/api/admin/erp/sales/pricelists?items=${id}`).then(r => r.json()); setItems(d.items ?? []) }, [])
  useEffect(() => { if (sel) loadItems(sel) }, [sel, loadItems])
  async function post(bodyObj: Record<string, unknown>, ok: string) {
    const r = await fetch('/api/admin/erp/sales/pricelists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(ok, 'success'); load(); if (sel) loadItems(sel) } else toast(d.error || lp('Failed', 'ناموفق'), 'error')
  }
  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">{lp('Price lists', 'فهرست‌های قیمت')}</h3>
      <div className="grid md:grid-cols-4 gap-2 items-end">
        <Input label={lp('Code', 'کد')} value={nl.code} onChange={v => setNl(f => ({ ...f, code: v }))} />
        <Input label={lp('Name', 'نام')} value={nl.nameEn} onChange={v => setNl(f => ({ ...f, nameEn: v }))} />
        <Select label={lp('Currency', 'ارز')} value={nl.currency} onChange={v => setNl(f => ({ ...f, currency: v }))} options={['IRR', 'IRT', 'USD', 'EUR'].map(c => ({ value: c, label: c }))} />
        <Btn size="sm" onClick={() => { if (!nl.code || !nl.nameEn) { toast(lp('Code and name required', 'کد و نام لازم است'), 'error'); return } post({ action: 'save', code: nl.code, nameEn: nl.nameEn, nameFa: nl.nameEn, currency: nl.currency }, lp('Price list created', 'فهرست ساخته شد')); setNl({ code: '', nameEn: '', currency: 'IRR' }) }}>{lp('Add list', 'افزودن فهرست')}</Btn>
      </div>
      <div className="flex flex-wrap gap-2">
        {lists.map(l => (
          <button key={l.id} onClick={() => setSel(l.id)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${sel === l.id ? 'border-brand bg-brand/10' : 'border-subtle'}`}>
            <span className="text-text-primary">{fa ? l.nameFa : l.nameEn}</span>
            <Badge color="slate">{l.itemCount} {lp('items', 'قلم')}</Badge>
          </button>
        ))}
        {lists.length === 0 && <p className="text-xs text-text-tertiary">{lp('No price lists yet.', 'هنوز فهرستی نیست.')}</p>}
      </div>
      {sel && (
        <div className="border border-subtle rounded-lg p-3 space-y-2">
          <div className="grid md:grid-cols-3 gap-2 items-end">
            <Select label={lp('Product', 'کالا')} value={add.productId} onChange={v => setAdd(f => ({ ...f, productId: v }))} options={[{ value: '', label: '—' }, ...products.map(p => ({ value: String(p.id), label: `${p.sku} · ${fa ? (p.nameFa || p.nameEn) : p.nameEn}` }))]} />
            <Input label={lp('Unit price', 'قیمت واحد')} value={add.unitPrice} onChange={v => setAdd(f => ({ ...f, unitPrice: v }))} />
            <Btn size="sm" onClick={() => { if (!add.productId || !add.unitPrice) return; post({ action: 'setItem', priceListId: sel, productId: Number(add.productId), unitPrice: Number(add.unitPrice) }, lp('Price set', 'قیمت ثبت شد')); setAdd({ productId: '', unitPrice: '' }) }}>{lp('Set price', 'ثبت قیمت')}</Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map(it => (
              <span key={it.productId} className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3 py-1.5 text-sm">
                <span className="text-text-secondary">{fa ? (it.nameFa || it.nameEn) : it.nameEn}</span>
                <span className="font-semibold text-text-primary">{it.unitPrice.toLocaleString()}</span>
                <button onClick={() => post({ action: 'setItem', priceListId: sel, productId: it.productId, unitPrice: null }, lp('Removed', 'حذف شد'))} className="text-danger text-xs">✕</button>
              </span>
            ))}
            {items.length === 0 && <p className="text-xs text-text-tertiary">{lp('No products priced in this list.', 'کالایی در این فهرست قیمت‌گذاری نشده.')}</p>}
          </div>
        </div>
      )}
    </Card>
  )
}
