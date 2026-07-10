'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

const DOC_TYPES = ['invoice', 'quotation', 'purchase_order', 'contract', 'proposal', 'warranty', 'delivery_note', 'service_report', 'completion_certificate', 'financial_report'] as const
type DocType = (typeof DOC_TYPES)[number]
const SALES_TYPES: DocType[] = ['invoice', 'quotation']

interface GenDoc { id: number; type: string; number: string; title: string; partyName: string | null; date: string; status: string; createdAt: string }
interface ManualLine { description: string; qty: number; unitPrice: number }
interface SalesDoc { id: number; docNo: string; customerName: string; total: number }

interface DocTemplate { id: number; key: string; nameEn: string; nameFa: string; docType: string | null; config: Record<string, unknown>; active: boolean }

export function DocumentCenter() {
  const t = useT()
  const locale = useAdminLocale()
  const rtl = locale === 'fa'
  const { toast, ToastContainer } = useToast()
  const [view, setView] = useState<'documents' | 'designer'>('documents')
  const [docs, setDocs] = useState<GenDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [type, setType] = useState<DocType>('invoice')
  const [mode, setMode] = useState<'sales' | 'manual'>('sales')
  const [salesDocs, setSalesDocs] = useState<SalesDoc[]>([])
  const [sourceId, setSourceId] = useState(0)
  const [manual, setManual] = useState({ title: '', partyName: '', partyInfo: '', body: '', date: new Date().toISOString().slice(0, 10) })
  const [lines, setLines] = useState<ManualLine[]>([{ description: '', qty: 1, unitPrice: 0 }])
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [templateKey, setTemplateKey] = useState('')
  const [emailFor, setEmailFor] = useState<GenDoc | null>(null)

  useEffect(() => {
    fetch('/api/admin/erp/documents/templates').then(r => r.json()).then(d => setTemplates((d.templates ?? []).filter((x: DocTemplate) => x.active))).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/documents'); if (r.ok) { const d = await r.json(); setDocs(d.documents ?? []) } }
    catch { toast(t('doc_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (mode === 'sales' && salesDocs.length === 0) {
      const st = SALES_TYPES.includes(type) ? type : 'invoice'
      fetch(`/api/admin/erp/sales/documents?type=${st}`).then(r => r.json()).then(d => setSalesDocs(d.documents ?? [])).catch(() => {})
    }
  }, [mode, type, salesDocs.length])

  const supportsSales = SALES_TYPES.includes(type)

  async function generate() {
    setSaving(true)
    try {
      const tpl = templateKey ? { templateKey } : {}
      const body = supportsSales && mode === 'sales'
        ? { type, sourceType: 'sales' as const, sourceId, ...tpl }
        : { type, title: manual.title || undefined, partyName: manual.partyName, partyInfo: manual.partyInfo, body: manual.body, date: manual.date, lines: lines.filter(l => l.description.trim()), ...tpl }
      const r = await fetch('/api/admin/erp/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(t('doc_generated'), 'success'); setModal(false); load()
      window.open(`/api/admin/erp/documents/render?id=${d.id}`, '_blank')
    } catch (e) { toast(e instanceof Error ? e.message : t('doc_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function void_(id: number) {
    if (!confirm(t('doc_confirmVoid'))) return
    const r = await fetch('/api/admin/erp/documents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (r.ok) { toast(t('doc_voided'), 'success'); load() }
  }

  function openNew() {
    setType('invoice'); setMode('sales'); setSalesDocs([]); setSourceId(0)
    setManual({ title: '', partyName: '', partyInfo: '', body: '', date: new Date().toISOString().slice(0, 10) })
    setLines([{ description: '', qty: 1, unitPrice: 0 }]); setModal(true)
  }

  const columns: Column<GenDoc>[] = [
    { key: 'number', labelEn: 'No.', labelFa: t('doc_cNo'), render: d => <span className="font-mono text-xs text-text-secondary">{d.number}</span> },
    { key: 'type', labelEn: 'Type', labelFa: t('doc_cType'), type: 'enum', options: DOC_TYPES.map(x => ({ value: x, labelEn: x, labelFa: t(`doc_t_${x}` as 'doc_t_invoice') })), render: d => <span className="text-text-secondary text-xs">{t(`doc_t_${d.type}` as 'doc_t_invoice')}</span> },
    { key: 'partyName', labelEn: 'Party', labelFa: t('doc_cParty'), render: d => <span className="text-text-secondary">{d.partyName || '—'}</span> },
    { key: 'date', labelEn: 'Date', labelFa: t('doc_cDate'), type: 'date', render: d => <span className="text-text-tertiary text-xs">{d.date}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('doc_cStatus'), type: 'enum', options: ['issued', 'void'].map(x => ({ value: x, labelEn: x, labelFa: x })), render: d => <Badge color={d.status === 'issued' ? 'green' : 'red'}>{t(`doc_st_${d.status}` as 'doc_st_issued')}</Badge> },
  ]
  const rowActions: RowAction<GenDoc>[] = [
    { id: 'print', labelEn: 'Print', labelFa: t('doc_print'), icon: '🖨', onClick: d => window.open(`/api/admin/erp/documents/render?id=${d.id}`, '_blank') },
    { id: 'email', labelEn: 'Email', labelFa: rtl ? 'ارسال ایمیل' : 'Email', icon: '✉️', hidden: d => d.status !== 'issued', onClick: d => setEmailFor(d) },
    { id: 'void', labelEn: 'Void', labelFa: t('doc_void'), icon: '✕', danger: true, hidden: d => d.status !== 'issued', onClick: d => void_(d.id) },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('doc_title')} subtitle={t('doc_subtitle')} action={<Btn onClick={openNew}>{t('doc_new')}</Btn>} />

      <div className="flex gap-1 mb-6 border-b border-subtle">
        {(['documents', 'designer'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${view === v ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {v === 'documents' ? (rtl ? 'اسناد' : 'Documents') : (rtl ? 'طراح فاکتور' : 'Invoice Designer')}
          </button>
        ))}
      </div>

      {view === 'designer' && <InvoiceDesigner rtl={rtl} toast={toast} templates={templates} onTemplatesChange={setTemplates} />}

      {view === 'documents' && <>
      {/* Type palette */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {DOC_TYPES.map(dt => (
          <button key={dt} onClick={() => { openNew(); setType(dt); setMode(SALES_TYPES.includes(dt) ? 'sales' : 'manual') }}
            className="rounded-xl p-4 bg-surface-2 border border-subtle hover:border-brand/50 text-start transition-colors">
            <div className="text-lg mb-1" aria-hidden>{docIcon(dt)}</div>
            <div className="text-xs font-medium text-text-secondary">{t(`doc_t_${dt}` as 'doc_t_invoice')}</div>
          </button>
        ))}
      </div>

      <Card className="p-4">
        <DataTable
          tableId="erp-documents"
          columns={columns}
          rows={docs}
          locale={locale}
          loading={loading}
          rowKey={d => String(d.id)}
          rowActions={rowActions}
          exportName="documents"
          emptyLabel={t('doc_empty')}
        />
      </Card>
      </>}

      <Modal open={modal} onClose={() => setModal(false)} title={t('doc_new')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('doc_fType')} value={type} onChange={v => { setType(v as DocType); setSalesDocs([]); if (!SALES_TYPES.includes(v as DocType)) setMode('manual') }} options={DOC_TYPES.map(x => ({ value: x, label: t(`doc_t_${x}` as 'doc_t_invoice') }))} />
            {supportsSales && <Select label={t('doc_fSource')} value={mode} onChange={v => setMode(v as 'sales' | 'manual')} options={[{ value: 'sales', label: t('doc_fromSales') }, { value: 'manual', label: t('doc_manual') }]} />}
          </div>
          <Select label={rtl ? 'قالب طراحی (اختیاری)' : 'Design template (optional)'} value={templateKey} onChange={setTemplateKey}
            options={[{ value: '', label: '—' }, ...templates.map(x => ({ value: x.key, label: rtl ? x.nameFa : x.nameEn }))]} />

          {supportsSales && mode === 'sales' ? (
            <Select label={t('doc_fSalesDoc')} value={String(sourceId)} onChange={v => setSourceId(Number(v))} options={[{ value: '0', label: t('doc_selectSales') }, ...salesDocs.map(s => ({ value: String(s.id), label: `${s.docNo} — ${s.customerName}` }))]} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4"><Input label={t('doc_fTitle')} value={manual.title} onChange={v => setManual(m => ({ ...m, title: v }))} placeholder={t(`doc_t_${type}` as 'doc_t_invoice')} /><Input label={t('doc_fDate')} type="date" value={manual.date} onChange={v => setManual(m => ({ ...m, date: v }))} /></div>
              <div className="grid grid-cols-2 gap-4"><Input label={t('doc_fParty')} value={manual.partyName} onChange={v => setManual(m => ({ ...m, partyName: v }))} /><Input label={t('doc_fPartyInfo')} value={manual.partyInfo} onChange={v => setManual(m => ({ ...m, partyInfo: v }))} /></div>
              <Input label={t('doc_fBody')} value={manual.body} onChange={v => setManual(m => ({ ...m, body: v }))} multiline rows={4} />
              <div className="space-y-2">
                <p className="text-xs text-text-tertiary">{t('doc_lines')}</p>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <input value={l.description} onChange={e => setLines(ls => ls.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} className="form-input col-span-7 !py-2" placeholder={t('doc_lDesc')} />
                    <input type="number" value={l.qty || ''} onChange={e => setLines(ls => ls.map((x, idx) => idx === i ? { ...x, qty: Number(e.target.value) || 0 } : x))} className="form-input col-span-2 text-right !py-2" />
                    <input type="number" value={l.unitPrice || ''} onChange={e => setLines(ls => ls.map((x, idx) => idx === i ? { ...x, unitPrice: Number(e.target.value) || 0 } : x))} className="form-input col-span-2 text-right !py-2" />
                    <button onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)} className="col-span-1 text-xs text-danger">✕</button>
                  </div>
                ))}
                <button onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unitPrice: 0 }])} className="text-xs text-brand hover:underline">{t('doc_addLine')}</button>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Btn onClick={generate} disabled={saving || (supportsSales && mode === 'sales' && !sourceId)}>{saving ? t('doc_generating') : t('doc_generate')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('doc_cancel')}</Btn>
          </div>
        </div>
      </Modal>
      {emailFor && <EmailDocModal rtl={rtl} doc={emailFor} onClose={() => setEmailFor(null)} toast={toast} />}
    </>
  )
}

/** Email a generated document (HTML attachment via the CMS SMTP settings). */
function EmailDocModal({ rtl, doc, onClose, toast }: { rtl: boolean; doc: GenDoc; onClose: () => void; toast: Toast2 }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState(`${doc.title} ${doc.number}`)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  async function send() {
    if (!to.trim()) { toast(L2(rtl, 'Recipient email is required', 'ایمیل گیرنده الزامی است'), 'error'); return }
    setSending(true)
    try {
      const r = await fetch('/api/admin/erp/documents/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, to: to.trim(), subject: subject.trim() || undefined, message: message.trim() || undefined }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { toast(L2(rtl, 'Document emailed', 'سند ایمیل شد'), 'success'); onClose() }
      else toast(d.error || L2(rtl, 'Send failed', 'ارسال ناموفق'), 'error')
    } finally { setSending(false) }
  }
  return (
    <Modal open onClose={onClose} title={L2(rtl, `Email ${doc.number}`, `ارسال ${doc.number}`)}>
      <div className="space-y-3">
        <Input label={L2(rtl, 'To (email)', 'گیرنده (ایمیل)')} value={to} onChange={setTo} placeholder="client@example.com" />
        <Input label={L2(rtl, 'Subject', 'موضوع')} value={subject} onChange={setSubject} />
        <Input label={L2(rtl, 'Message (optional)', 'پیام (اختیاری)')} value={message} onChange={setMessage} multiline rows={3} />
        <p className="text-3xs text-text-tertiary">{L2(rtl, 'The print-ready document is attached as HTML; the recipient opens it and saves as PDF. Requires SMTP settings.', 'سند چاپی به‌صورت HTML پیوست می‌شود؛ گیرنده آن را باز و به PDF ذخیره می‌کند. نیازمند تنظیمات SMTP است.')}</p>
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>{L2(rtl, 'Cancel', 'انصراف')}</Btn>
          <Btn onClick={send} disabled={sending}>{sending ? L2(rtl, 'Sending…', 'در حال ارسال…') : L2(rtl, 'Send', 'ارسال')}</Btn>
        </div>
      </div>
    </Modal>
  )
}

function docIcon(t: string): string {
  const m: Record<string, string> = { invoice: '💳', quotation: '📄', purchase_order: '🛒', contract: '📜', proposal: '📝', warranty: '🛡️', delivery_note: '📦', service_report: '🔧', completion_certificate: '🏅', financial_report: '📊' }
  return m[t] ?? '📄'
}

// ── Invoice Designer (Phase 26) ──────────────────────────────────────────────
type Toast2 = ReturnType<typeof useToast>['toast']
interface TplConfig {
  variant?: string; accentColor?: string; watermarkText?: string; headerNote?: string
  terms?: string; paymentInstructions?: string; footerNote?: string
  showLogo?: boolean; showSeal?: boolean; showSignature?: boolean; showQr?: boolean; showBarcode?: boolean
  customFields?: { label: string; value: string }[]
}
const L2 = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)

function InvoiceDesigner({ rtl, toast, templates, onTemplatesChange }: { rtl: boolean; toast: Toast2; templates: DocTemplate[]; onTemplatesChange: (t: DocTemplate[]) => void }) {
  const [selKey, setSelKey] = useState('')
  const [cfg, setCfg] = useState<TplConfig>({})
  const [html, setHtml] = useState('')
  const [busy, setBusy] = useState(false)
  const sel = templates.find(x => x.key === selKey) ?? null

  const reloadTemplates = useCallback(async () => {
    const d = await fetch('/api/admin/erp/documents/templates').then(r => r.json()).catch(() => ({ templates: [] }))
    onTemplatesChange((d.templates ?? []).filter((x: DocTemplate) => x.active))
    return (d.templates ?? []) as DocTemplate[]
  }, [onTemplatesChange])

  useEffect(() => { if (sel) setCfg(sel.config as TplConfig) }, [sel])

  const preview = useCallback(async (config: TplConfig) => {
    try {
      const r = await fetch('/api/admin/erp/documents/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) })
      if (r.ok) setHtml(await r.text())
    } catch { /* preview is best-effort */ }
  }, [])
  useEffect(() => { const id = setTimeout(() => preview(cfg), 400); return () => clearTimeout(id) }, [cfg, preview])

  async function save() {
    if (!sel) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/erp/documents/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: sel.id, config: cfg }) })
      if (r.ok) { toast(L2(rtl, 'Template saved', 'قالب ذخیره شد'), 'success'); reloadTemplates() }
      else toast(L2(rtl, 'Save failed', 'ذخیره ناموفق'), 'error')
    } finally { setBusy(false) }
  }
  async function createTpl() {
    const key = window.prompt(L2(rtl, 'Template key (a-z0-9-)', 'کلید قالب')); if (!key) return
    const name = window.prompt(L2(rtl, 'Template name', 'نام قالب')) || key
    const r = await fetch('/api/admin/erp/documents/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', key, nameEn: name, nameFa: name, docType: 'invoice', config: {} }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L2(rtl, 'Template created', 'قالب ساخته شد'), 'success'); await reloadTemplates(); setSelKey(key) }
    else toast(d.error || L2(rtl, 'Failed', 'ناموفق'), 'error')
  }
  const set = (patch: Partial<TplConfig>) => setCfg(c => ({ ...c, ...patch }))
  const toggles: [keyof TplConfig, string, string, boolean][] = [
    ['showLogo', 'Logo', 'لوگو', true], ['showSeal', 'Seal', 'مهر', true], ['showSignature', 'Signature', 'امضا', true], ['showQr', 'QR verify', 'کیو‌آر', true],
    ['showBarcode', 'Barcode (doc no)', 'بارکد شماره سند', false],
  ]

  return (
    <div className="grid xl:grid-cols-[380px_1fr] gap-4">
      <div className="space-y-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">{L2(rtl, 'Templates', 'قالب‌ها')}</h3>
            <Btn size="sm" variant="secondary" onClick={createTpl}>+ {L2(rtl, 'New', 'جدید')}</Btn>
          </div>
          <Select label="" value={selKey} onChange={setSelKey} options={[{ value: '', label: L2(rtl, 'Select a template…', 'انتخاب قالب…') }, ...templates.map(x => ({ value: x.key, label: `${rtl ? x.nameFa : x.nameEn} (${x.key})` }))]} />
        </Card>
        {sel && (
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">{L2(rtl, 'Design', 'طراحی')}</h3>
            <Input label={L2(rtl, 'Variant label (e.g. Official)', 'برچسب نوع (مثلاً رسمی)')} value={cfg.variant ?? ''} onChange={v => set({ variant: v })} />
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs text-text-tertiary mb-1">{L2(rtl, 'Accent color', 'رنگ اصلی')}</label>
                <input type="color" value={cfg.accentColor ?? '#4f46e5'} onChange={e => set({ accentColor: e.target.value })} className="h-9 w-full rounded bg-transparent" />
              </div>
              <Input label={L2(rtl, 'Watermark', 'واترمارک')} value={cfg.watermarkText ?? ''} onChange={v => set({ watermarkText: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {toggles.map(([k, en, fa, defaultOn]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={defaultOn ? cfg[k] !== false : cfg[k] === true} onChange={e => set({ [k]: e.target.checked } as Partial<TplConfig>)} />
                  {L2(rtl, en, fa)}
                </label>
              ))}
            </div>
            <Input label={L2(rtl, 'Header note', 'یادداشت سربرگ')} value={cfg.headerNote ?? ''} onChange={v => set({ headerNote: v })} />
            <Input label={L2(rtl, 'Payment instructions', 'دستور پرداخت')} value={cfg.paymentInstructions ?? ''} onChange={v => set({ paymentInstructions: v })} multiline rows={2} />
            <Input label={L2(rtl, 'Terms & conditions', 'شرایط و ضوابط')} value={cfg.terms ?? ''} onChange={v => set({ terms: v })} multiline rows={3} />
            <Input label={L2(rtl, 'Footer note', 'یادداشت پاصفحه')} value={cfg.footerNote ?? ''} onChange={v => set({ footerNote: v })} />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-tertiary">{L2(rtl, 'Custom fields', 'فیلدهای سفارشی')}</p>
                <Btn size="sm" variant="ghost" onClick={() => set({ customFields: [...(cfg.customFields ?? []), { label: '', value: '' }] })}>+ {L2(rtl, 'Add', 'افزودن')}</Btn>
              </div>
              {(cfg.customFields ?? []).map((f, i) => (
                <div key={i} className="grid grid-cols-9 gap-2">
                  <input value={f.label} onChange={e => set({ customFields: (cfg.customFields ?? []).map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} className="form-input col-span-4 !py-1.5" placeholder={L2(rtl, 'Label', 'برچسب')} />
                  <input value={f.value} onChange={e => set({ customFields: (cfg.customFields ?? []).map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} className="form-input col-span-4 !py-1.5" placeholder={L2(rtl, 'Value', 'مقدار')} />
                  <button onClick={() => set({ customFields: (cfg.customFields ?? []).filter((_, j) => j !== i) })} className="col-span-1 text-xs text-danger">✕</button>
                </div>
              ))}
            </div>
            <Btn onClick={save} disabled={busy}>{busy ? L2(rtl, 'Saving…', 'در حال ذخیره…') : L2(rtl, 'Save template', 'ذخیره قالب')}</Btn>
          </Card>
        )}
      </div>
      <Card className="p-2 min-h-[480px]">
        {html
          ? <iframe title="invoice preview" srcDoc={html} className="w-full h-[75vh] rounded-lg bg-white" />
          : <div className="h-full flex items-center justify-center text-sm text-text-tertiary p-10">{L2(rtl, 'Select or create a template — the live preview renders here with your real company profile.', 'یک قالب انتخاب/ایجاد کنید — پیش‌نمایش زنده با پروفایل واقعی شرکت اینجا رندر می‌شود.')}</div>}
      </Card>
    </div>
  )
}
