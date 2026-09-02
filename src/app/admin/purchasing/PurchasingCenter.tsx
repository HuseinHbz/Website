'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import dynamic from 'next/dynamic'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { formatDateTime } from '@/lib/admin/datetime'
import type { PurchasingChartsData } from './PurchasingCharts'

// Recharts is heavy — load the chart chunk only when the Analytics tab renders.
const PurchasingCharts = dynamic(() => import('./PurchasingCharts'), { ssr: false, loading: () => <div className="h-60 rounded-xl border border-subtle bg-surface animate-pulse" /> })

type Tab = 'dashboard' | 'vendors' | 'documents' | 'analytics'
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
    { id: 'analytics', en: 'Analytics', fa: 'تحلیل‌ها' },
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
      {tab === 'analytics' && <Analytics rtl={rtl} />}
    </>
  )
}

function Analytics({ rtl }: { rtl: boolean }) {
  const [d, setD] = useState<(PurchasingChartsData & { byType: { type: string; total: number; count: number }[]; byStatus: { status: string; count: number }[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/erp/purchasing?view=analytics').then(r => r.json()).then(setD).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="h-60 rounded-xl border border-subtle bg-surface animate-pulse" />
  if (!d || (d.monthlySpend.length === 0 && d.byStatus.length === 0)) {
    return <Card className="p-8 text-center text-sm text-text-tertiary">{lc(rtl, 'No purchasing activity yet — analytics appear once documents exist.', 'هنوز فعالیتی نیست — با ایجاد اسناد، تحلیل‌ها نمایش داده می‌شوند.')}</Card>
  }
  return (
    <div className="space-y-4">
      <PurchasingCharts data={d} locale={rtl ? 'fa' : 'en'} labels={{ spend: lc(rtl, 'Committed spend by month', 'هزینه ماهانه'), vendors: lc(rtl, 'Top vendors by spend', 'تأمین‌کنندگان پرهزینه') }} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{lc(rtl, 'Spend by document type', 'هزینه بر اساس نوع سند')}</h3>
          <div className="space-y-2">
            {d.byType.map(t => (
              <div key={t.type} className="flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2">
                <span className="text-text-secondary">{t.type} <span className="text-3xs text-text-tertiary">× {t.count}</span></span>
                <span className="font-semibold text-text-primary">{money(t.total)}</span>
              </div>
            ))}
            {d.byType.length === 0 && <p className="text-xs text-text-tertiary">{lc(rtl, 'No committed documents.', 'سند تعهدشده‌ای نیست.')}</p>}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{lc(rtl, 'Documents by status', 'اسناد بر اساس وضعیت')}</h3>
          <div className="flex flex-wrap gap-2">
            {d.byStatus.map(s => (
              <span key={s.status} className="inline-flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-sm">
                <Badge color={STATUS_COLOR[s.status] || 'slate'}>{s.status}</Badge>
                <span className="text-text-primary font-semibold">{s.count}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : 'border-subtle'
  return <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}><p className="text-xs text-text-tertiary mb-1">{label}</p><p className="text-2xl font-bold text-text-primary">{value}</p></div>
}

function Dashboard({ rtl }: { rtl: boolean }) {
  const { money: dmoney } = useDisplayCurrency()
  const [d, setD] = useState<{ kpis: { openOrders: number; ordersValue: number; pendingApproval: number; payables: number; vendors: number }; topVendors: { name: string; score: number; grade: string }[] } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/purchasing?view=overview').then(r => r.json()).then(setD).catch(() => {}) }, [])
  const k = d?.kpis
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><CurrencyPicker fa={rtl} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi label={lc(rtl, 'Open orders', 'سفارش باز')} value={k?.openOrders ?? 0} />
        <Kpi label={lc(rtl, 'Orders value', 'ارزش سفارش')} value={dmoney(k?.ordersValue ?? 0)} />
        <Kpi label={lc(rtl, 'Pending approval', 'در انتظار تأیید')} value={k?.pendingApproval ?? 0} tone="warn" />
        <Kpi label={lc(rtl, 'Payables', 'بدهی')} value={dmoney(k?.payables ?? 0)} tone="warn" />
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

interface Vendor {
  id: number; code: string; name: string; kind: string; email: string | null; phone: string | null
  taxId: string | null; economicCode: string | null; nationalId: string | null; regNo: string | null
  address: string | null; iban: string | null; bankName: string | null
  contactName: string | null; contactPhone: string | null; city: string | null; postalCode: string | null
  website: string | null; category: string | null; notes: string | null
  currency: string; paymentTerms: number; score: number; grade: string; active: boolean
}
const VENDOR_EMPTY = { name: '', kind: 'company', email: '', phone: '', currency: 'IRR', taxId: '', economicCode: '', nationalId: '', regNo: '', address: '', iban: '', bankName: '', contactName: '', contactPhone: '', city: '', postalCode: '', website: '', category: '', notes: '', paymentTerms: 0 }
type VendorForm = typeof VENDOR_EMPTY
function Vendors({ rtl, locale, toast }: { rtl: boolean; locale: 'fa' | 'en'; toast: Toast }) {
  const [rows, setRows] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [evalFor, setEvalFor] = useState<Vendor | null>(null)
  const [form, setForm] = useState<VendorForm>(VENDOR_EMPTY)
  const load = useCallback(async () => { setLoading(true); try { const d = await fetch('/api/admin/erp/purchasing?view=vendors').then(r => r.json()); setRows(d.vendors ?? []) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    if (!form.name) return
    const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vendor.create', ...form }) })
    if (r.ok) { toast(lc(rtl, 'Vendor created', 'تأمین‌کننده ساخته شد'), 'success'); setShowAdd(false); setForm(VENDOR_EMPTY); load() } else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  function openEdit(v: Vendor) {
    setForm({ name: v.name, kind: v.kind, email: v.email ?? '', phone: v.phone ?? '', currency: v.currency,
      taxId: v.taxId ?? '', economicCode: v.economicCode ?? '', nationalId: v.nationalId ?? '', regNo: v.regNo ?? '',
      address: v.address ?? '', iban: v.iban ?? '', bankName: v.bankName ?? '', contactName: v.contactName ?? '',
      contactPhone: v.contactPhone ?? '', city: v.city ?? '', postalCode: v.postalCode ?? '', website: v.website ?? '',
      category: v.category ?? '', notes: v.notes ?? '', paymentTerms: v.paymentTerms ?? 0 })
    setEditing(v)
  }
  async function saveEdit() {
    if (!editing) return
    const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vendor.update', id: editing.id, ...form }) })
    if (r.ok) { toast(lc(rtl, 'Vendor updated', 'تأمین‌کننده به‌روزرسانی شد'), 'success'); setEditing(null); load() } else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  const columns: Column<Vendor>[] = [
    { key: 'name', labelEn: 'Vendor', labelFa: 'تأمین‌کننده', render: v => <div><div className="font-medium text-text-primary">{v.name}</div><div className="text-3xs text-text-tertiary font-mono">{v.code}</div></div> },
    { key: 'kind', labelEn: 'Type', labelFa: 'نوع', type: 'enum' },
    { key: 'phone', labelEn: 'Phone', labelFa: 'تلفن', render: v => <span>{v.phone || '—'}</span> },
    { key: 'contactName', labelEn: 'Contact', labelFa: 'رابط', render: v => <span>{v.contactName || '—'}</span> },
    { key: 'currency', labelEn: 'Currency', labelFa: 'ارز' },
    { key: 'score', labelEn: 'Score', labelFa: 'امتیاز', type: 'number', numeric: true },
    { key: 'grade', labelEn: 'Grade', labelFa: 'درجه', render: v => <Badge color={v.grade === 'A' ? 'green' : v.grade === 'B' ? 'blue' : v.grade === 'C' ? 'yellow' : 'red'}>{v.grade}</Badge> },
  ]
  async function portalLink(v: Vendor) {
    const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vendor.portalLink', vendorId: v.id }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.token) {
      const url = `${window.location.origin}/${rtl ? 'fa' : 'en'}/vendor/${d.token}`
      try { await navigator.clipboard.writeText(url) } catch { /* clipboard optional */ }
      toast(lc(rtl, 'Portal link copied (valid 90 days)', 'پیوند پرتال کپی شد (۹۰ روز اعتبار)'), 'success')
    } else toast(d.error || lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  async function portalRevoke(v: Vendor) {
    const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vendor.portalRevoke', vendorId: v.id }) })
    if (r.ok) toast(lc(rtl, 'Portal links revoked', 'پیوندهای پرتال باطل شد'), 'success')
  }
  const rowActions: RowAction<Vendor>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: 'ویرایش', icon: '✎', onClick: v => openEdit(v) },
    { id: 'eval', labelEn: 'Evaluate', labelFa: 'ارزیابی', icon: '★', onClick: v => setEvalFor(v) },
    { id: 'portal', labelEn: 'Portal link', labelFa: 'پیوند پرتال', icon: '🔗', onClick: v => portalLink(v) },
    { id: 'portal-revoke', labelEn: 'Revoke portal', labelFa: 'ابطال پرتال', icon: '🚫', danger: true, onClick: v => portalRevoke(v) },
  ]
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={() => { setForm(VENDOR_EMPTY); setShowAdd(true) }}>+ {lc(rtl, 'New vendor', 'تأمین‌کننده جدید')}</Btn></div>
      <Card className="p-4"><DataTable tableId="pur-vendors" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={v => String(v.id)} rowActions={rowActions} exportName="vendors" onRefresh={load} emptyLabel={lc(rtl, 'No vendors.', 'تأمین‌کننده‌ای نیست.')} /></Card>
      {showAdd && (
        <Modal open onClose={() => setShowAdd(false)} title={lc(rtl, 'New vendor', 'تأمین‌کننده جدید')}>
          <div className="space-y-3">
            <VendorFields rtl={rtl} form={form} setForm={setForm} />
            <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setShowAdd(false)}>{lc(rtl, 'Cancel', 'انصراف')}</Btn><Btn onClick={add}>{lc(rtl, 'Create', 'ساخت')}</Btn></div>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={lc(rtl, `Edit vendor — ${editing.name}`, `ویرایش تأمین‌کننده — ${editing.name}`)}>
          <div className="space-y-3">
            <VendorFields rtl={rtl} form={form} setForm={setForm} />
            <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setEditing(null)}>{lc(rtl, 'Cancel', 'انصراف')}</Btn><Btn onClick={saveEdit}>{lc(rtl, 'Save', 'ذخیره')}</Btn></div>
          </div>
        </Modal>
      )}
      {evalFor && <EvaluateModal rtl={rtl} vendor={evalFor} onClose={() => setEvalFor(null)} onDone={() => { setEvalFor(null); load() }} toast={toast} />}
    </div>
  )
}

/** Full vendor identity/contact/banking field set (item 4 — complete supplier
 * information collection), shared by the create and edit modals. */
function VendorFields({ rtl, form, setForm }: { rtl: boolean; form: VendorForm; setForm: Dispatch<SetStateAction<VendorForm>> }) {
  const set = (k: keyof VendorForm) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Input label={lc(rtl, 'Name', 'نام')} value={form.name} onChange={set('name')} /></div>
      <Select label={lc(rtl, 'Type', 'نوع')} value={form.kind} onChange={set('kind')} options={[{ value: 'company', label: lc(rtl, 'Company', 'شرکت') }, { value: 'individual', label: lc(rtl, 'Individual', 'شخص') }, { value: 'international', label: lc(rtl, 'International', 'بین‌المللی') }]} />
      <Input label={lc(rtl, 'Category', 'دسته‌بندی')} value={form.category} onChange={set('category')} />
      <Input label={lc(rtl, 'Email', 'ایمیل')} value={form.email} onChange={set('email')} />
      <Input label={lc(rtl, 'Phone', 'تلفن')} value={form.phone} onChange={set('phone')} />
      <Input label={lc(rtl, 'Contact person', 'نام رابط')} value={form.contactName} onChange={set('contactName')} />
      <Input label={lc(rtl, 'Contact phone', 'تلفن رابط')} value={form.contactPhone} onChange={set('contactPhone')} />
      {form.kind === 'individual'
        ? <Input label={lc(rtl, 'National ID', 'کد ملی')} value={form.nationalId} onChange={set('nationalId')} />
        : <Input label={lc(rtl, 'Registration No.', 'شماره ثبت')} value={form.regNo} onChange={set('regNo')} />}
      <Input label={lc(rtl, 'Tax ID', 'شناسه مالیاتی')} value={form.taxId} onChange={set('taxId')} />
      <Input label={lc(rtl, 'Economic code', 'کد اقتصادی')} value={form.economicCode} onChange={set('economicCode')} />
      <Input label={lc(rtl, 'City', 'شهر')} value={form.city} onChange={set('city')} />
      <Input label={lc(rtl, 'Postal code', 'کد پستی')} value={form.postalCode} onChange={set('postalCode')} />
      <div className="col-span-2"><Input label={lc(rtl, 'Address', 'آدرس')} value={form.address} onChange={set('address')} /></div>
      <Input label={lc(rtl, 'Website', 'وب‌سایت')} value={form.website} onChange={set('website')} />
      <Select label={lc(rtl, 'Currency', 'ارز')} value={form.currency} onChange={set('currency')} options={['IRR', 'IRT', 'USD', 'EUR', 'AED'].map(c => ({ value: c, label: c }))} />
      <Input label={lc(rtl, 'Bank name', 'نام بانک')} value={form.bankName} onChange={set('bankName')} />
      <Input label={lc(rtl, 'IBAN / Account', 'شبا / شماره حساب')} value={form.iban} onChange={set('iban')} />
      <Input label={lc(rtl, 'Payment terms (days)', 'مهلت پرداخت (روز)')} value={String(form.paymentTerms)} onChange={v => setForm(f => ({ ...f, paymentTerms: Number(v) || 0 }))} />
      <div className="col-span-2"><Input label={lc(rtl, 'Notes', 'یادداشت')} value={form.notes} onChange={set('notes')} /></div>
    </div>
  )
}

function EvaluateModal({ rtl, vendor, onClose, onDone, toast }: { rtl: boolean; vendor: Vendor; onClose: () => void; onDone: () => void; toast: Toast }) {
  const [s, setS] = useState({ quality: 3, delivery: 3, price: 3, service: 3, compliance: 3 })
  // 26.32 بند۴: `vendor_evaluations` was written on every review and read by
  // nothing — the buyer could not see whether a vendor's grade was improving.
  const [history, setHistory] = useState<{ id: number; score: number; grade: string; evaluatorName: string | null; createdAt: string }[]>([])
  useEffect(() => {
    fetch(`/api/admin/erp/purchasing?evaluations=${vendor.id}`)
      .then(r => r.ok ? r.json() : { evaluations: [] })
      .then(d => setHistory(d.evaluations ?? []))
      .catch(() => setHistory([]))
  }, [vendor.id])
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
        {history.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-sm font-semibold mb-2">{lc(rtl, 'Evaluation history', 'تاریخچهٔ ارزیابی')}</div>
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {history.map(h => (
                <li key={h.id} className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{formatDateTime(h.createdAt, rtl ? 'fa' : 'en')}</span>
                  <span>{h.evaluatorName ?? '—'}</span>
                  <span className="font-semibold text-text-primary">{h.score} ({h.grade})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>{lc(rtl, 'Cancel', 'انصراف')}</Btn><Btn onClick={submit}>{lc(rtl, 'Save evaluation', 'ثبت ارزیابی')}</Btn></div>
      </div>
    </Modal>
  )
}

interface PurDoc { id: number; docNo: string | null; docType: string; vendorName: string | null; status: string; date: string; total: number; approvalLevels: number; glEntryId: number | null; priority: string }
const PRIORITY_COLOR: Record<string, string> = { low: 'slate', normal: 'blue', high: 'yellow', urgent: 'red' }
const PRIORITY_FA: Record<string, string> = { low: 'کم', normal: 'عادی', high: 'زیاد', urgent: 'فوری' }
function Documents({ rtl, locale, toast }: { rtl: boolean; locale: 'fa' | 'en'; toast: Toast }) {
  const [rows, setRows] = useState<PurDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<DocType | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const [receiveFor, setReceiveFor] = useState<PurDoc | null>(null)
  const [compareFor, setCompareFor] = useState<PurDoc | null>(null)
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
    { key: 'priority', labelEn: 'Priority', labelFa: 'اولویت', type: 'enum', render: d => <Badge color={PRIORITY_COLOR[d.priority] || 'slate'}>{rtl ? (PRIORITY_FA[d.priority] || d.priority) : d.priority}</Badge> },
    { key: 'total', labelEn: 'Total', labelFa: 'مبلغ', type: 'number', numeric: true, render: d => <span>{money(d.total)}</span> },
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum', render: d => <span className="flex items-center gap-1"><Badge color={STATUS_COLOR[d.status] || 'slate'}>{d.status}</Badge></span> },
    { key: 'glEntryId', labelEn: 'GL entry', labelFa: 'سند حسابداری', render: d => d.glEntryId ? <Link href={`/admin/finance?tab=journal&entry=${d.glEntryId}`} className="text-xs text-brand hover:underline font-mono">#{d.glEntryId}</Link> : <span className="text-xs text-text-tertiary">—</span> },
  ]
  const rowActions: RowAction<PurDoc>[] = [
    { id: 'submit', labelEn: 'Submit', labelFa: 'ارسال', icon: '➤', hidden: d => d.status !== 'draft', onClick: d => op('doc.submit', { id: d.id }) },
    { id: 'approve1', labelEn: 'Approve L1', labelFa: 'تأیید سطح ۱', icon: '✓', hidden: d => d.status !== 'submitted', onClick: d => op('doc.approve', { id: d.id, level: 1, decision: 'approved' }) },
    { id: 'approve2', labelEn: 'Approve L2', labelFa: 'تأیید سطح ۲', icon: '✓✓', hidden: d => d.status !== 'submitted' || d.approvalLevels < 2, onClick: d => op('doc.approve', { id: d.id, level: 2, decision: 'approved' }) },
    { id: 'reject', labelEn: 'Reject', labelFa: 'رد', icon: '✕', hidden: d => d.status !== 'submitted', onClick: d => op('doc.approve', { id: d.id, level: 1, decision: 'rejected' }) },
    { id: 'po', labelEn: 'Convert to Order', labelFa: 'تبدیل به سفارش', icon: '↪', hidden: d => !(d.docType === 'request' || d.docType === 'quotation') || d.status !== 'approved', onClick: d => op('doc.convert', { sourceId: d.id, toType: 'order' }) },
    { id: 'grn', labelEn: 'Convert to GRN', labelFa: 'تبدیل به رسید', icon: '📦', hidden: d => d.docType !== 'order' || !['approved', 'confirmed'].includes(d.status), onClick: d => op('doc.convert', { sourceId: d.id, toType: 'receipt' }) },
    { id: 'receive', labelEn: 'Receive (GRN)', labelFa: 'دریافت کالا', icon: '🏭', hidden: d => d.docType !== 'receipt' || ['received', 'void', 'rejected'].includes(d.status), onClick: d => setReceiveFor(d) },
    { id: 'compare', labelEn: 'Compare quotes', labelFa: 'مقایسه استعلام‌ها', icon: '⚖', hidden: d => d.docType !== 'rfq', onClick: d => setCompareFor(d) },
    { id: 'confirm', labelEn: 'Confirm & post', labelFa: 'تأیید و ثبت', icon: '✅', hidden: d => d.docType !== 'invoice' || !!d.glEntryId || d.status !== 'draft', onClick: d => op('doc.confirm', { id: d.id }) },
    { id: 'post', labelEn: 'Post to GL', labelFa: 'ثبت در دفتر کل', icon: '📒', hidden: d => d.docType !== 'invoice' || !!d.glEntryId || ['draft', 'void'].includes(d.status), onClick: d => op('doc.post', { id: d.id }) },
    { id: 'void', labelEn: 'Void', labelFa: 'ابطال', icon: '🚫', hidden: d => d.docType !== 'invoice' || ['void', 'draft'].includes(d.status), onClick: d => op('doc.void', { id: d.id }) },
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select label="" value={type} onChange={v => setType(v as DocType | 'all')} options={[{ value: 'all', label: lc(rtl, 'All types', 'همه') }, ...DOC_TYPES.map(t => ({ value: t, label: t }))]} />
        <Btn onClick={() => setShowNew(true)}>+ {lc(rtl, 'New document', 'سند جدید')}</Btn>
      </div>
      <Card className="p-4"><DataTable tableId="pur-docs" columns={columns} rows={rows} locale={locale} loading={loading} rowKey={d => String(d.id)} rowActions={rowActions} exportName="purchase-documents" onRefresh={load} emptyLabel={lc(rtl, 'No documents.', 'سندی نیست.')} /></Card>
      {showNew && <NewDocModal rtl={rtl} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); load() }} toast={toast} />}
      {receiveFor && <ReceiveModal rtl={rtl} doc={receiveFor} onClose={() => setReceiveFor(null)} onDone={() => { setReceiveFor(null); load() }} toast={toast} />}
      {compareFor && <CompareModal rtl={rtl} doc={compareFor} onClose={() => setCompareFor(null)} />}
    </div>
  )
}

/** GRN receiving: pick a warehouse, confirm per-line quantities (partial allowed) → real inv_moves. */
function ReceiveModal({ rtl, doc, onClose, onDone, toast }: { rtl: boolean; doc: PurDoc; onClose: () => void; onDone: () => void; toast: Toast }) {
  const [warehouses, setWarehouses] = useState<{ id: number; code: string; nameEn: string; nameFa: string | null }[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [lines, setLines] = useState<{ lineId: number; description: string; qty: number; receivedQty: number; productId: number | null; take: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/erp/inventory/warehouses').then(r => r.json()),
      fetch(`/api/admin/erp/purchasing?id=${doc.id}`).then(r => r.json()),
    ]).then(([w, d]) => {
      const ws = w.warehouses ?? []
      setWarehouses(ws)
      if (ws.length) setWarehouseId(String(ws[0].id))
      type DetailLine = { id: number; description: string; qty: number; receivedQty: number; productId: number | null }
      setLines(((d.lines ?? []) as DetailLine[]).map(l => ({
        lineId: l.id, description: l.description, qty: Number(l.qty), receivedQty: Number(l.receivedQty ?? 0),
        productId: l.productId, take: String(Math.max(0, Number(l.qty) - Number(l.receivedQty ?? 0))),
      })))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [doc.id])
  const productLines = lines.filter(l => l.productId)
  async function submit() {
    if (!warehouseId) { toast(lc(rtl, 'Pick a warehouse', 'انبار را انتخاب کنید'), 'error'); return }
    setSaving(true)
    try {
      const payload = productLines.map(l => ({ lineId: l.lineId, qty: Math.max(0, Number(l.take) || 0) })).filter(l => l.qty > 0)
      const r = await fetch('/api/admin/erp/purchasing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'doc.receive', id: doc.id, warehouseId: Number(warehouseId), lines: payload }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { toast(lc(rtl, `Received — status: ${d.status}`, `دریافت شد — وضعیت: ${d.status === 'received' ? 'کامل' : 'ناقص'}`), 'success'); onDone() }
      else toast(d.error || lc(rtl, 'Failed', 'ناموفق'), 'error')
    } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={lc(rtl, `Receive goods — ${doc.docNo || doc.id}`, `دریافت کالا — ${doc.docNo || doc.id}`)} size="lg">
      {loading ? <div className="h-40 rounded-xl bg-surface-2 animate-pulse" /> : (
        <div className="space-y-3">
          <Select label={lc(rtl, 'Warehouse', 'انبار')} value={warehouseId} onChange={setWarehouseId} options={warehouses.map(w => ({ value: String(w.id), label: `${w.code} — ${rtl ? (w.nameFa || w.nameEn) : w.nameEn}` }))} />
          {productLines.length === 0 ? (
            <p className="text-sm text-text-tertiary border border-subtle rounded-lg p-3">{lc(rtl, 'No product-linked lines on this document — link lines to inventory products to receive stock.', 'هیچ ردیفی به کالای انبار متصل نیست — برای دریافت، ردیف‌ها را به کالا متصل کنید.')}</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-3xs text-text-tertiary px-1">
                <span className="col-span-6">{lc(rtl, 'Line', 'ردیف')}</span>
                <span className="col-span-3">{lc(rtl, 'Ordered / received', 'سفارش / دریافت‌شده')}</span>
                <span className="col-span-3">{lc(rtl, 'Receive now', 'دریافت فعلی')}</span>
              </div>
              {productLines.map(l => (
                <div key={l.lineId} className="grid grid-cols-12 gap-2 items-center border border-subtle rounded-lg px-2 py-1.5">
                  <span className="col-span-6 text-sm text-text-primary truncate">{l.description}</span>
                  <span className="col-span-3 text-xs text-text-tertiary font-mono">{l.qty} / {l.receivedQty}</span>
                  <div className="col-span-3"><Input label="" value={l.take} onChange={v => setLines(ls => ls.map(x => x.lineId === l.lineId ? { ...x, take: v } : x))} /></div>
                </div>
              ))}
              <p className="text-3xs text-text-tertiary">{lc(rtl, 'Partial quantities are allowed — the document stays "partial" until every line is fully received.', 'دریافت ناقص مجاز است — سند تا دریافت کامل همه ردیف‌ها «ناقص» می‌ماند.')}</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>{lc(rtl, 'Cancel', 'انصراف')}</Btn>
            <Btn onClick={submit} disabled={saving || productLines.length === 0}>{lc(rtl, 'Receive into warehouse', 'ثبت دریافت در انبار')}</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** RFQ award helper: all vendor quotations linked to this RFQ, cheapest first, with vendor rating. */
function CompareModal({ rtl, doc, onClose }: { rtl: boolean; doc: PurDoc; onClose: () => void }) {
  const [quotes, setQuotes] = useState<{ id: number; docNo: string | null; date: string; total: number; status: string; vendor: string | null; score: number; grade: string | null; lines: number }[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/admin/erp/purchasing?compare=${doc.id}`).then(r => r.json()).then(d => setQuotes(d.quotes ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [doc.id])
  const best = quotes.length ? Math.min(...quotes.map(q => q.total)) : 0
  return (
    <Modal open onClose={onClose} title={lc(rtl, `Quotation comparison — ${doc.docNo || doc.id}`, `مقایسه استعلام‌ها — ${doc.docNo || doc.id}`)} size="lg">
      {loading ? <div className="h-40 rounded-xl bg-surface-2 animate-pulse" /> : quotes.length === 0 ? (
        <p className="text-sm text-text-tertiary">{lc(rtl, 'No vendor quotations are linked to this RFQ yet. Create quotation documents with this RFQ as source.', 'هنوز استعلام قیمتی به این RFQ متصل نیست. سند استعلام با مبدأ این RFQ بسازید.')}</p>
      ) : (
        <div className="space-y-2">
          {quotes.map(q => (
            <div key={q.id} className={`flex flex-wrap items-center justify-between gap-2 border rounded-lg px-3 py-2 ${q.total === best ? 'border-success/50 bg-success/5' : 'border-subtle'}`}>
              <div>
                <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                  {q.vendor || '—'}
                  {q.grade && <Badge color={q.grade === 'A' ? 'green' : q.grade === 'B' ? 'blue' : q.grade === 'C' ? 'yellow' : 'red'}>{q.grade}</Badge>}
                  {q.total === best && <Badge color="green">{lc(rtl, 'Best price', 'بهترین قیمت')}</Badge>}
                </div>
                <div className="text-3xs text-text-tertiary font-mono">{q.docNo || q.id} · {q.date} · {q.lines} {lc(rtl, 'lines', 'ردیف')} · {lc(rtl, 'score', 'امتیاز')} {q.score}</div>
              </div>
              <div className="text-lg font-bold text-text-primary">{money(q.total)}</div>
            </div>
          ))}
          <p className="text-3xs text-text-tertiary">{lc(rtl, 'Sorted cheapest-first. Approve the winning quotation, then convert it to a purchase order.', 'مرتب‌شده از ارزان‌ترین. استعلام برنده را تأیید و سپس به سفارش خرید تبدیل کنید.')}</p>
        </div>
      )}
    </Modal>
  )
}

type NewLine = { description: string; qty: number; unitPrice: number; discountPct: number; taxPct: number; productId: number | null }
function NewDocModal({ rtl, onClose, onDone, toast }: { rtl: boolean; onClose: () => void; onDone: () => void; toast: Toast }) {
  const [vendors, setVendors] = useState<{ id: number; name: string }[]>([])
  const [products, setProducts] = useState<{ id: number; sku: string; nameEn: string; nameFa: string | null; price: number }[]>([])
  const [rfqs, setRfqs] = useState<{ id: number; docNo: string | null }[]>([])
  const [docType, setDocType] = useState<DocType>('request')
  const [vendorId, setVendorId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [priority, setPriority] = useState('normal')
  const [department, setDepartment] = useState('')
  const [budget, setBudget] = useState('')
  const [lines, setLines] = useState<NewLine[]>([{ description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 9, productId: null }])
  useEffect(() => {
    fetch('/api/admin/erp/purchasing?view=vendors').then(r => r.json()).then(d => setVendors(d.vendors ?? [])).catch(() => {})
    fetch('/api/admin/erp/inventory/products').then(r => r.json()).then(d => setProducts(d.products ?? [])).catch(() => {})
  }, [])
  useEffect(() => {
    if (docType !== 'quotation') { setSourceId(''); return }
    fetch('/api/admin/erp/purchasing?type=rfq').then(r => r.json()).then(d => setRfqs(d.documents ?? [])).catch(() => {})
  }, [docType])
  function pickProduct(i: number, val: string) {
    const p = products.find(x => String(x.id) === val)
    setLines(ls => ls.map((x, j) => j !== i ? x : {
      ...x, productId: p ? p.id : null,
      description: p && !x.description.trim() ? (rtl ? (p.nameFa || p.nameEn) : p.nameEn) : x.description,
      unitPrice: p && !x.unitPrice ? Number(p.price) || 0 : x.unitPrice,
    }))
  }
  async function save() {
    const clean = lines.filter(l => l.description.trim())
    if (!clean.length) { toast(lc(rtl, 'Add at least one line', 'حداقل یک ردیف'), 'error'); return }
    const r = await fetch('/api/admin/erp/purchasing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'doc.save', docType, vendorId: vendorId ? Number(vendorId) : undefined,
        sourceId: sourceId ? Number(sourceId) : undefined, priority,
        department: department.trim() || undefined, budget: budget ? Number(budget) : undefined,
        date: new Date().toISOString().slice(0, 10), lines: clean,
      }),
    })
    if (r.ok) { toast(lc(rtl, 'Document created', 'سند ساخته شد'), 'success'); onDone() } else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <Modal open onClose={onClose} title={lc(rtl, 'New purchase document', 'سند خرید جدید')} size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label={lc(rtl, 'Type', 'نوع')} value={docType} onChange={v => setDocType(v as DocType)} options={DOC_TYPES.map(t => ({ value: t, label: t }))} />
          <Select label={lc(rtl, 'Vendor', 'تأمین‌کننده')} value={vendorId} onChange={setVendorId} options={[{ value: '', label: '—' }, ...vendors.map(v => ({ value: String(v.id), label: v.name }))]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label={lc(rtl, 'Priority', 'اولویت')} value={priority} onChange={setPriority} options={(['low', 'normal', 'high', 'urgent'] as const).map(p => ({ value: p, label: rtl ? PRIORITY_FA[p] : p }))} />
          <Input label={lc(rtl, 'Department', 'واحد/دپارتمان')} value={department} onChange={setDepartment} placeholder={lc(rtl, 'e.g. IT', 'مثلاً فناوری')} />
          <Input label={lc(rtl, 'Budget cap (0 = none)', 'سقف بودجه (۰ = بدون)')} value={budget} onChange={setBudget} placeholder="0" />
        </div>
        {docType === 'quotation' && (
          <Select label={lc(rtl, 'Linked RFQ (for comparison)', 'RFQ مرتبط (برای مقایسه)')} value={sourceId} onChange={setSourceId} options={[{ value: '', label: '—' }, ...rfqs.map(q => ({ value: String(q.id), label: q.docNo || String(q.id) }))]} />
        )}
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3"><Select label={i === 0 ? lc(rtl, 'Product', 'کالا') : ''} value={l.productId ? String(l.productId) : ''} onChange={v => pickProduct(i, v)} options={[{ value: '', label: lc(rtl, '— service/free —', '— خدمات/آزاد —') }, ...products.map(p => ({ value: String(p.id), label: `${p.sku} · ${rtl ? (p.nameFa || p.nameEn) : p.nameEn}` }))]} /></div>
              <div className="col-span-3"><Input label={i === 0 ? lc(rtl, 'Description', 'شرح') : ''} value={l.description} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, description: v } : x))} /></div>
              <div className="col-span-2"><Input label={i === 0 ? lc(rtl, 'Qty', 'تعداد') : ''} value={String(l.qty)} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, qty: Number(v) || 0 } : x))} /></div>
              <div className="col-span-2"><Input label={i === 0 ? lc(rtl, 'Price', 'قیمت') : ''} value={String(l.unitPrice)} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, unitPrice: Number(v) || 0 } : x))} /></div>
              <div className="col-span-1"><Input label={i === 0 ? lc(rtl, 'Tax %', 'مالیات') : ''} value={String(l.taxPct)} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, taxPct: Number(v) || 0 } : x))} /></div>
              <div className="col-span-1"><Btn size="sm" variant="ghost" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>✕</Btn></div>
            </div>
          ))}
          <Btn size="sm" variant="secondary" onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unitPrice: 0, discountPct: 0, taxPct: 9, productId: null }])}>+ {lc(rtl, 'Add line', 'افزودن ردیف')}</Btn>
        </div>
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>{lc(rtl, 'Cancel', 'انصراف')}</Btn><Btn onClick={save}>{lc(rtl, 'Create', 'ساخت')}</Btn></div>
      </div>
    </Modal>
  )
}
