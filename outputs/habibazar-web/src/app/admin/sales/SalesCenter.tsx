'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Tab = 'dashboard' | 'customers' | 'quote' | 'order' | 'invoice' | 'payments'
type DocType = 'quote' | 'order' | 'invoice' | 'credit_note'

interface Customer { id?: number; code: string; name: string; email: string | null; phone: string | null; company: string | null; taxId: string | null; kind?: string; nationalId?: string | null; regNo?: string | null; economicCode?: string | null; creditLimit: number; address?: string | null; notes?: string | null; active: number | boolean; invoiced?: number; paid?: number; outstanding?: number; available?: number; overLimit?: boolean; utilizationPct?: number }
interface DocRow { id: number; docType: DocType; docNo: string; date: string; dueDate: string | null; status: string; total: number; customerName: string; paid: number }
interface Line { description: string; qty: number; unitPrice: number; discountPct: number; taxPct: number }
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
      {(tab === 'quote' || tab === 'order' || tab === 'invoice') && <Documents key={tab} t={t} toast={toast} docType={tab} />}
      {tab === 'payments' && <Payments t={t} toast={toast} />}
    </>
  )
}
type T = ReturnType<typeof useT>
type Toast = ReturnType<typeof useToast>['toast']

function Dashboard({ t }: { t: T }) {
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t('sales_kCustomers')} value={String(k.customers)} icon="👥" />
        <Kpi label={t('sales_kQuotes')} value={String(k.quotes)} icon="📄" />
        <Kpi label={t('sales_kOrders')} value={String(k.orders)} icon="🧾" />
        <Kpi label={t('sales_kWon')} value={money(k.wonValue)} icon="🏆" tone="ok" />
        <Kpi label={t('sales_kInvoiced')} value={money(k.invoiced)} icon="💳" />
        <Kpi label={t('sales_kCollected')} value={money(k.collected)} icon="💰" tone="ok" />
        <Kpi label={t('sales_kOutstanding')} value={money(k.outstanding)} icon="⏳" tone={k.outstanding > 0 ? 'warn' : undefined} />
        <Kpi label={t('sales_kTax')} value={money(k.taxCollected)} icon="🧮" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('sales_topCustomers')}</h3>
          {d.topCustomers.length === 0 ? <p className="text-xs text-text-tertiary">{t('sales_empty')}</p> : (
            <div className="space-y-3">{d.topCustomers.map(c => (
              <div key={c.name}><div className="flex justify-between text-xs mb-1"><span className="text-text-secondary">{c.name}</span><span className="text-text-tertiary">{money(c.invoiced)}</span></div><div className="h-2 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(c.invoiced / maxTop) * 100}%` }} /></div></div>
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
    </div>
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
  const rowActions: RowAction<Customer>[] = [{ id: 'edit', labelEn: 'Edit', labelFa: t('sales_edit'), icon: '✎', onClick: c => { setEditing({ ...c, active: !!c.active }); setModal(true) } }]
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
    </>
  )
}

// ── Documents (quote / order / invoice) ──────────────────────────────────────
function Documents({ t, toast, docType }: { t: T; toast: Toast; docType: 'quote' | 'order' | 'invoice' }) {
  const locale = useAdminLocale()
  const [rows, setRows] = useState<DocRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [customerId, setCustomerId] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 0 }])
  const [saving, setSaving] = useState(false)
  const [payFor, setPayFor] = useState<DocRow | null>(null)
  const [payAmount, setPayAmount] = useState(0)

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
      const r = await fetch('/api/admin/erp/sales/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docType, customerId, date, notes, lines: clean }) })
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
    { key: 'total', labelEn: 'Total', labelFa: t('sales_cTotal'), type: 'number', numeric: true, render: r => <span className="text-text-secondary text-xs">{money(r.total)}{docType === 'invoice' && r.paid > 0 && <span className="text-text-tertiary"> ({money(r.paid)})</span>}</span> },
  ]
  const rowActions: RowAction<DocRow>[] = [
    { id: 'send', labelEn: 'Send', labelFa: t('sales_send'), icon: '➤', hidden: r => r.status !== 'draft', onClick: r => op(r.id, 'send') },
    { id: 'toOrder', labelEn: 'To Order', labelFa: t('sales_toOrder'), icon: '→', hidden: r => !(docType === 'quote' && r.status !== 'void'), onClick: r => op(r.id, 'convert', 'order') },
    { id: 'toInvoice', labelEn: 'To Invoice', labelFa: t('sales_toInvoice'), icon: '→', hidden: r => !(docType === 'order' && r.status !== 'void'), onClick: r => op(r.id, 'convert', 'invoice') },
    { id: 'pay', labelEn: 'Record Payment', labelFa: t('sales_recordPay'), icon: '💰', hidden: r => !(docType === 'invoice' && r.status !== 'paid' && r.status !== 'void'), onClick: r => { setPayFor(r); setPayAmount(r.total - r.paid) } },
    { id: 'void', labelEn: 'Void', labelFa: t('sales_void'), icon: '✕', danger: true, hidden: r => r.status === 'void', onClick: r => op(r.id, 'void') },
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
            <button onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 0 }])} className="text-xs text-brand hover:underline">{t('sales_addLine')}</button>
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
