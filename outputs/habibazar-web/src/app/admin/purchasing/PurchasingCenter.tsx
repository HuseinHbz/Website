'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Tab = 'dashboard' | 'vendors' | 'documents'
const lc = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)
const DOC_TYPES = ['request', 'rfq', 'quotation', 'order', 'receipt', 'invoice', 'return', 'credit_note'] as const
type DocType = typeof DOC_TYPES[number]
const money = (n: number) => (n ?? 0).toLocaleString()
type Toast = ReturnType<typeof useToast>['toast']

const STATUS_COLOR: Record<string, string> = { draft: 'slate', submitted: 'yellow', approved: 'blue', rejected: 'red', confirmed: 'blue', partial: 'yellow', paid: 'green', received: 'green', void: 'slate' }

export function PurchasingCenter() {
  const rtl = useAdminLocale() === 'fa'
  const locale = useAdminLocale()
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('dashboard')
  const TABS: { id: Tab; en: string; fa: string }[] = [
    { id: 'dashboard', en: 'Dashboard', fa: 'داشبورد' },
    { id: 'vendors', en: 'Vendors', fa: 'تأمین‌کنندگان' },
    { id: 'documents', en: 'Documents', fa: 'اسناد خرید' },
  ]
  return (
    <>
      <ToastContainer />
      <PageHeader title={lc(rtl, 'Purchasing Center', 'مرکز خرید')} subtitle={lc(rtl, 'Procure-to-pay: vendors, requests, orders, receipts, invoices, approvals', 'خرید تا پرداخت: تأمین‌کننده، درخواست، سفارش، رسید، فاکتور، تأیید')} />
      <div className="flex gap-1 mb-6 border-b border-subtle flex-wrap">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tb.id ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{lc(rtl, tb.en, tb.fa)}</button>
        ))}
      </div>
      {tab === 'dashboard' && <Dashboard rtl={rtl} />}
      {tab === 'vendors' && <Vendors rtl={rtl} locale={locale} toast={toast} />}
      {tab === 'documents' && <Documents rtl={rtl} locale={locale} toast={toast} />}
    </>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : 'border-subtle'
  return <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}><p className="text-xs text-text-tertiary mb-1">{label}</p><p className="text-2xl font-bold text-text-primary">{value}</p></div>
}

function Dashboard({ rtl }: { rtl: boolean }) {
  const [d, setD] = useState<{ kpis: { openOrders: number; ordersValue: number; pendingApproval: number; payables: number; vendors: number }; topVendors: { name: string; score: number; grade: string }[] } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/purchasing?view=overview').then(r => r.json()).then(setD).catch(() => {}) }, [])
  const k = d?.kpis
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi label={lc(rtl, 'Open orders', 'سفارش باز')} value={k?.openOrders ?? 0} />
        <Kpi label={lc(rtl, 'Orders value', 'ارزش سفارش')} value={money(k?.ordersValue ?? 0)} />
        <Kpi label={lc(rtl, 'Pending approval', 'در انتظار تأیید')} value={k?.pendingApproval ?? 0} tone="warn" />
        <Kpi label={lc(rtl, 'Payables', 'بدهی')} value={money(k?.payables ?? 0)} tone="warn" />
        <Kpi label={lc(rtl, 'Active vendors', 'تأمین‌کننده فعال')} value={k?.vendors ?? 0} tone="ok" />
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{lc(rtl, 'Top-rated vendors', 'تأمین‌کنندگان برتر')}</h3>
        <div className="space-y-2">
          {(d?.topVendors ?? []).map((v, i) => (
            <div key={i} className="flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2">
              <span className="text-text-primary">{v.name}</span>
              <span className="flex items-center gap-2"><Badge color={v.grade === 'A' ? 'green' : v.grade === 'B' ? 'blue' : v.grade === 'C' ? 'yellow' : 'red'}>{v.grade}</Badge><span className="text-text-tertiary">{v.score}</span></span>
            </div>
          ))}
          {(d?.topVendors ?? []).length === 0 && <p className="text-sm text-text-tertiary">{lc(rtl, 'No vendors yet.', 'هنوز تأمین‌کننده‌ای نیست.')}</p>}
        </div>
      </Card>
    </div>
  )
}

interface Vendor { id: number; code: string; name: string; kind: string; email: string | null; currency: string; score: number; grade: string; active: boolean }
function Vendors({ rtl, locale, toast }: { rtl: boolean; locale: 'fa' | 'en'; toast: Toast }) {
  const [rows, setRows] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [evalFor, setEvalFor] = useState<Vendor | null>(null)
  const [form, setForm] = useState({ name: '', kind: 'company', email: '', currency: 'IRR' })
  const load = useCallback(async () => { setLoading(true); try { const d = await fetch('/api/admin/erp/purchasing?view=vendors').then(r => r.json()); setRows(d.vendors ?? []) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    if (!form.name) return
    const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vendor.create', ...form }) })
    if (r.ok) { toast(lc(rtl, 'Vendor created', 'تأمین‌کننده ساخته شد'), 'success'); setShowAdd(false); setForm({ name: '', kind: 'company', email: '', currency: 'IRR' }); load() } else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  const columns: Column<Vendor>[] = [
    { key: 'name', labelEn: 'Vendor', labelFa: 'تأمین‌کننده', render: v => <div><div className="font-medium text-text-primary">{v.name}</div><div className="text-3xs text-text-tertiary font-mono">{v.code}</div></div> },
    { key: 'kind', labelEn: 'Type', labelFa: 'نوع', type: 'enum' },
    { key: 'currency', labelEn: 'Currency', labelFa: 'ارز' },
    { key: 'score', labelEn: 'Score', labelFa: 'امتیاز', type: 'number', numeric: true },
    { key: 'grade', labelEn: 'Grade', labelFa: 'درجه', render: v => <Badge color={v.grade === 'A' ? 'green' : v.grade === 'B' ? 'blue' : v.grade === 'C' ? 'yellow' : 'red'}>{v.grade}</Badge> },
  ]
  const rowActions: RowAction<Vendor>[] = [{ id: 'eval', labelEn: 'Evaluate', labelFa: 'ارزیابی', icon: '★', onClick: v => setEvalFor(v) }]
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={() => setShowAdd(true)}>+ {lc(rtl, 'New vendor', 'تأمین‌کننده جدید')}</Btn></div>
      <Card className="p-4"><DataTable tableId="pur-vendors" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={v => String(v.id)} rowActions={rowActions} exportName="vendors" onRefresh={load} emptyLabel={lc(rtl, 'No vendors.', 'تأمین‌کننده‌ای نیست.')} /></Card>
      {showAdd && (
        <Modal open onClose={() => setShowAdd(false)} title={lc(rtl, 'New vendor', 'تأمین‌کننده جدید')}>
          <div className="space-y-3">
            <Input label={lc(rtl, 'Name', 'نام')} value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
            <Select label={lc(rtl, 'Type', 'نوع')} value={form.kind} onChange={v => setForm(f => ({ ...f, kind: v }))} options={[{ value: 'company', label: lc(rtl, 'Company', 'شرکت') }, { value: 'individual', label: lc(rtl, 'Individual', 'شخص') }, { value: 'international', label: lc(rtl, 'International', 'بین‌المللی') }]} />
            <Input label={lc(rtl, 'Email', 'ایمیل')} value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
            <Select label={lc(rtl, 'Currency', 'ارز')} value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={['IRR', 'IRT', 'USD', 'EUR', 'AED'].map(c => ({ value: c, label: c }))} />
            <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setShowAdd(false)}>{lc(rtl, 'Cancel', 'انصراف')}</Btn><Btn onClick={add}>{lc(rtl, 'Create', 'ساخت')}</Btn></div>
          </div>
        </Modal>
      )}
      {evalFor && <EvaluateModal rtl={rtl} vendor={evalFor} onClose={() => setEvalFor(null)} onDone={() => { setEvalFor(null); load() }} toast={toast} />}
    </div>
  )
}

function EvaluateModal({ rtl, vendor, onClose, onDone, toast }: { rtl: boolean; vendor: Vendor; onClose: () => void; onDone: () => void; toast: Toast }) {
  const [s, setS] = useState({ quality: 3, delivery: 3, price: 3, service: 3, compliance: 3 })
  async function submit() {
    const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vendor.evaluate', vendorId: vendor.id, ...s }) })
    if (r.ok) { const d = await r.json(); toast(lc(rtl, `Scored ${d.score} (${d.grade})`, `امتیاز ${d.score} (${d.grade})`), 'success'); onDone() } else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  const fields: [keyof typeof s, string, string][] = [['quality', 'Quality', 'کیفیت'], ['delivery', 'Delivery', 'تحویل'], ['price', 'Price', 'قیمت'], ['service', 'Service', 'خدمات'], ['compliance', 'Compliance', 'انطباق']]
  return (
    <Modal open onClose={onClose} title={lc(rtl, `Evaluate ${vendor.name}`, `ارزیابی ${vendor.name}`)}>
      <div className="space-y-3">
        {fields.map(([k, en, fa]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <span className="text-sm text-text-secondary">{lc(rtl, en, fa)}</span>
            <input type="range" min={0} max={5} step={1} value={s[k]} onChange={e => setS(v => ({ ...v, [k]: Number(e.target.value) }))} className="flex-1" />
            <span className="text-sm font-semibold w-6 text-center">{s[k]}</span>
          </div>
        ))}
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>{lc(rtl, 'Cancel', 'انصراف')}</Btn><Btn onClick={submit}>{lc(rtl, 'Save evaluation', 'ثبت ارزیابی')}</Btn></div>
      </div>
    </Modal>
  )
}

interface PurDoc { id: number; docNo: string | null; docType: string; vendorName: string | null; status: string; date: string; total: number; approvalLevels: number; glEntryId: number | null }
function Documents({ rtl, locale, toast }: { rtl: boolean; locale: 'fa' | 'en'; toast: Toast }) {
  const [rows, setRows] = useState<PurDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<DocType | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const load = useCallback(async () => { setLoading(true); try { const q = type === 'all' ? '' : `?type=${type}`; const d = await fetch(`/api/admin/erp/purchasing${q}`).then(r => r.json()); setRows(d.documents ?? []) } finally { setLoading(false) } }, [type])
  useEffect(() => { load() }, [load])

  async function op(action: string, extra: Record<string, unknown>) {
    const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(lc(rtl, 'Done', 'انجام شد'), 'success'); load() } else toast(d.error || lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  const columns: Column<PurDoc>[] = [
    { key: 'docNo', labelEn: 'No.', labelFa: 'شماره', render: d => <span className="font-mono text-xs">{d.docNo || '—'}</span> },
    { key: 'docType', labelEn: 'Type', labelFa: 'نوع', type: 'enum' },
    { key: 'vendorName', labelEn: 'Vendor', labelFa: 'تأمین‌کننده', render: d => <span>{d.vendorName || '—'}</span> },
    { key: 'date', labelEn: 'Date', labelFa: 'تاریخ' },
    { key: 'total', labelEn: 'Total', labelFa: 'مبلغ', type: 'number', numeric: true, render: d => <span>{money(d.total)}</span> },
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum', render: d => <span className="flex items-center gap-1"><Badge color={STATUS_COLOR[d.status] || 'slate'}>{d.status}</Badge>{d.glEntryId && <Badge color="indigo">{lc(rtl, 'GL', 'دفتر')}</Badge>}</span> },
  ]
  const rowActions: RowAction<PurDoc>[] = [
    { id: 'submit', labelEn: 'Submit', labelFa: 'ارسال', icon: '➤', hidden: d => d.status !== 'draft', onClick: d => op('doc.submit', { id: d.id }) },
    { id: 'approve1', labelEn: 'Approve L1', labelFa: 'تأیید سطح ۱', icon: '✓', hidden: d => d.status !== 'submitted', onClick: d => op('doc.approve', { id: d.id, level: 1, decision: 'approved' }) },
    { id: 'approve2', labelEn: 'Approve L2', labelFa: 'تأیید سطح ۲', icon: '✓✓', hidden: d => d.status !== 'submitted' || d.approvalLevels < 2, onClick: d => op('doc.approve', { id: d.id, level: 2, decision: 'approved' }) },
    { id: 'reject', labelEn: 'Reject', labelFa: 'رد', icon: '✕', hidden: d => d.status !== 'submitted', onClick: d => op('doc.approve', { id: d.id, level: 1, decision: 'rejected' }) },
    { id: 'po', labelEn: 'Convert to Order', labelFa: 'تبدیل به سفارش', icon: '↪', hidden: d => !(d.docType === 'request' || d.docType === 'quotation') || d.status !== 'approved', onClick: d => op('doc.convert', { sourceId: d.id, toType: 'order' }) },
    { id: 'post', labelEn: 'Post to GL', labelFa: 'ثبت در دفتر کل', icon: '📒', hidden: d => d.docType !== 'invoice' || !!d.glEntryId || ['draft', 'void'].includes(d.status), onClick: d => op('doc.post', { id: d.id }) },
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select label="" value={type} onChange={v => setType(v as DocType | 'all')} options={[{ value: 'all', label: lc(rtl, 'All types', 'همه') }, ...DOC_TYPES.map(t => ({ value: t, label: t }))]} />
        <Btn onClick={() => setShowNew(true)}>+ {lc(rtl, 'New document', 'سند جدید')}</Btn>
      </div>
      <Card className="p-4"><DataTable tableId="pur-docs" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={d => String(d.id)} rowActions={rowActions} exportName="purchase-documents" onRefresh={load} emptyLabel={lc(rtl, 'No documents.', 'سندی نیست.')} /></Card>
      {showNew && <NewDocModal rtl={rtl} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); load() }} toast={toast} />}
    </div>
  )
}

function NewDocModal({ rtl, onClose, onDone, toast }: { rtl: boolean; onClose: () => void; onDone: () => void; toast: Toast }) {
  const [vendors, setVendors] = useState<{ id: number; name: string }[]>([])
  const [docType, setDocType] = useState<DocType>('request')
  const [vendorId, setVendorId] = useState('')
  const [lines, setLines] = useState([{ description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 9 }])
  useEffect(() => { fetch('/api/admin/erp/purchasing?view=vendors').then(r => r.json()).then(d => setVendors(d.vendors ?? [])).catch(() => {}) }, [])
  async function save() {
    const clean = lines.filter(l => l.description.trim())
    if (!clean.length) { toast(lc(rtl, 'Add at least one line', 'حداقل یک ردیف'), 'error'); return }
    const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'doc.save', docType, vendorId: vendorId ? Number(vendorId) : undefined, date: new Date().toISOString().slice(0, 10), lines: clean }) })
    if (r.ok) { toast(lc(rtl, 'Document created', 'سند ساخته شد'), 'success'); onDone() } else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <Modal open onClose={onClose} title={lc(rtl, 'New purchase document', 'سند خرید جدید')} size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label={lc(rtl, 'Type', 'نوع')} value={docType} onChange={v => setDocType(v as DocType)} options={DOC_TYPES.map(t => ({ value: t, label: t }))} />
          <Select label={lc(rtl, 'Vendor', 'تأمین‌کننده')} value={vendorId} onChange={setVendorId} options={[{ value: '', label: '—' }, ...vendors.map(v => ({ value: String(v.id), label: v.name }))]} />
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5"><Input label={i === 0 ? lc(rtl, 'Description', 'شرح') : ''} value={l.description} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, description: v } : x))} /></div>
              <div className="col-span-2"><Input label={i === 0 ? lc(rtl, 'Qty', 'تعداد') : ''} value={String(l.qty)} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, qty: Number(v) || 0 } : x))} /></div>
              <div className="col-span-2"><Input label={i === 0 ? lc(rtl, 'Price', 'قیمت') : ''} value={String(l.unitPrice)} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, unitPrice: Number(v) || 0 } : x))} /></div>
              <div className="col-span-2"><Input label={i === 0 ? lc(rtl, 'Tax %', 'مالیات') : ''} value={String(l.taxPct)} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, taxPct: Number(v) || 0 } : x))} /></div>
              <div className="col-span-1"><Btn size="sm" variant="ghost" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>✕</Btn></div>
            </div>
          ))}
          <Btn size="sm" variant="secondary" onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 9 }])}>+ {lc(rtl, 'Add line', 'افزودن ردیف')}</Btn>
        </div>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>{lc(rtl, 'Cancel', 'انصراف')}</Btn><Btn onClick={save}>{lc(rtl, 'Create', 'ساخت')}</Btn></div>
      </div>
    </Modal>
  )
}
