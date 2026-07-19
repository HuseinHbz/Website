'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, Btn, Badge, Input, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'

const L = (fa: boolean, en: string, faT: string) => (fa ? faT : en)
const API = '/api/admin/erp/import'
const postJson = (body: Record<string, unknown>) =>
  fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const ENTITIES: [string, string, string][] = [
  ['customer', 'Customers', 'مشتریان'], ['supplier', 'Suppliers', 'تأمین‌کنندگان'], ['product', 'Products', 'کالاها'],
  ['category', 'Categories', 'دسته‌ها'], ['warehouse', 'Warehouses', 'انبارها'], ['inventory', 'Inventory (opening stock)', 'موجودی (اول دوره)'],
  ['opening_balance', 'Opening Balance (GL)', 'تراز افتتاحیه'], ['journal', 'Journal Entries', 'اسناد حسابداری'],
]
const SOURCES = ['Excel/CSV', 'SAP', 'Oracle', 'Dynamics', 'Odoo', 'Other']
const STATUS_COLOR: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'danger'> = {
  draft: 'default', mapping: 'brand', validating: 'brand', validated: 'brand', approved: 'warning',
  processing: 'warning', completed: 'success', failed: 'danger', rolled_back: 'default',
}
interface Job { id: number; entityType: string; name: string; status: string; totalRows: number; validRows: number; warningRows: number; errorRows: number; importedRows: number; approvalTier: string; fileName: string | null; createdAt: string }
interface ValErr { rowNo: number; field: string | null; code: string; severity: string; message: string }
interface FieldSpec { key: string; en: string; fa: string; required?: boolean }

export function ImportCenter({ role }: { role: string }) {
  const fa = useAdminLocale() === 'fa'
  const { toast } = useToast()
  const [tab, setTab] = useState<'dashboard' | 'wizard' | 'jobs' | 'templates'>('dashboard')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit rounded-lg bg-white/5 p-1 flex-wrap">
        {([['dashboard', 'Dashboard', 'داشبورد'], ['wizard', 'New Import', 'ورود جدید'], ['jobs', 'Migration Jobs', 'کارهای مهاجرت'], ['templates', 'Templates', 'قالب‌ها']] as const).map(([id, en, faL]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === id ? 'bg-brand text-white' : 'text-text-secondary hover:text-text-primary'}`}>{L(fa, en, faL)}</button>
        ))}
      </div>
      {tab === 'dashboard' && <Dashboard fa={fa} />}
      {tab === 'wizard' && <Wizard fa={fa} toast={toast} role={role} />}
      {tab === 'jobs' && <Jobs fa={fa} toast={toast} role={role} />}
      {tab === 'templates' && <Templates fa={fa} toast={toast} />}
    </div>
  )
}

// ── M11: Analytics dashboard ─────────────────────────────────────────────────
interface Analytics { totalJobs: number; completed: number; failed: number; rolledBack: number; recordsImported: number; errorRows: number; warningRows: number; qualityPct: number; byEntity: { entity: string; jobs: number; imported: number }[]; recent: { id: number; name: string; entityType: string; status: string; importedRows: number; createdAt: string }[] }
function Dashboard({ fa }: { fa: boolean }) {
  const [a, setA] = useState<Analytics | null>(null)
  useEffect(() => { fetch(`${API}?view=analytics`).then(r => r.json()).then(d => setA(d.analytics ?? null)).catch(() => {}) }, [])
  if (!a) return <Card><p className="text-xs text-text-tertiary">{L(fa, 'Loading…', 'در حال بارگذاری…')}</p></Card>
  const cell = (label: string, value: string | number, cls = 'text-text-primary') => (
    <Card><p className="text-2xs text-text-tertiary mb-1">{label}</p><p className={`text-2xl font-bold ${cls}`}>{value}</p></Card>
  )
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cell(L(fa, 'Total imports', 'کل ورودها'), a.totalJobs)}
        {cell(L(fa, 'Successful', 'موفق'), a.completed, 'text-success')}
        {cell(L(fa, 'Failed', 'ناموفق'), a.failed, a.failed ? 'text-danger' : 'text-text-tertiary')}
        {cell(L(fa, 'Records imported', 'رکوردهای واردشده'), a.recordsImported.toLocaleString())}
        {cell(L(fa, 'Data quality', 'کیفیت داده'), `${a.qualityPct}%`, a.qualityPct >= 90 ? 'text-success' : a.qualityPct >= 70 ? 'text-warning' : 'text-danger')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'By entity', 'به تفکیک موجودیت')}</h3>
          {a.byEntity.length === 0 ? <p className="text-2xs text-text-tertiary">{L(fa, 'No imports yet.', 'هنوز وارداتی نیست.')}</p> : a.byEntity.map(e => (
            <div key={e.entity} className="flex justify-between py-1 text-xs border-b border-subtle last:border-0">
              <span className="text-text-secondary">{e.entity}</span>
              <span className="text-text-tertiary">{e.jobs} {L(fa, 'jobs', 'کار')} · {e.imported.toLocaleString()} {L(fa, 'rows', 'ردیف')}</span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, 'Migration history', 'تاریخچهٔ مهاجرت')}</h3>
          {a.recent.length === 0 ? <p className="text-2xs text-text-tertiary">{L(fa, 'No jobs yet.', 'کاری نیست.')}</p> : a.recent.map(j => (
            <div key={j.id} className="flex justify-between items-center py-1 text-xs border-b border-subtle last:border-0">
              <span className="text-text-secondary truncate">#{j.id} {j.name}</span>
              <Badge color={STATUS_COLOR[j.status] ?? 'default'}>{j.status}</Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ── M1: step wizard ──────────────────────────────────────────────────────────
const STEPS: [string, string][] = [['Upload', 'بارگذاری'], ['Mapping', 'نگاشت'], ['Validation', 'اعتبارسنجی'], ['Approval', 'تأیید'], ['Execute', 'اجرا'], ['Report', 'گزارش']]
function Wizard({ fa, toast, role }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void; role: string }) {
  const [step, setStep] = useState(0)
  const [entity, setEntity] = useState('customer')
  const [source, setSource] = useState('Excel/CSV')
  const [jobId, setJobId] = useState<number | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [resolution, setResolution] = useState<'skip' | 'update' | 'block'>('skip')
  const [specs, setSpecs] = useState<Record<string, FieldSpec[]>>({})
  const [valRes, setValRes] = useState<{ valid: number; warnings: number; errors: number; tier: string } | null>(null)
  const [valErrors, setValErrors] = useState<ValErr[]>([])
  const [execRes, setExecRes] = useState<{ imported: number; skipped: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { fetch(`${API}?view=templates`).then(r => r.json()).then(d => setSpecs(d.specs ?? {})).catch(() => {}) }, [])
  const spec: FieldSpec[] = specs[entity] ?? []

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { toast(L(fa, 'Choose a CSV or JSON file', 'یک فایل CSV یا JSON انتخاب کنید'), 'error'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('file', file); fd.set('entityType', entity); fd.set('name', file.name); fd.set('sourceSystem', source)
      const r = await fetch(API, { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Upload failed')
      setJobId(d.id); setHeaders(d.headers ?? []); setMapping(d.suggested ?? {}); setStep(1)
      toast(L(fa, `${d.totalRows} rows detected`, `${d.totalRows} ردیف شناسایی شد`), 'success')
    } catch (e) { toast(e instanceof Error ? e.message : L(fa, 'Upload failed', 'بارگذاری ناموفق'), 'error') } finally { setBusy(false) }
  }
  async function saveMap() {
    if (!jobId) return
    setBusy(true)
    try {
      const r = await postJson({ action: 'map', id: jobId, fields: mapping, resolution })
      if (!r.ok) throw new Error((await r.json()).error)
      const v = await postJson({ action: 'validate', id: jobId })
      const d = await v.json()
      if (!v.ok) throw new Error(d.error)
      setValRes(d)
      const detail = await fetch(`${API}?view=job&id=${jobId}`).then(x => x.json())
      setValErrors(detail.errors ?? [])
      setStep(2)
    } catch (e) { toast(e instanceof Error ? e.message : L(fa, 'Validation failed', 'اعتبارسنجی ناموفق'), 'error') } finally { setBusy(false) }
  }
  async function approve() {
    if (!jobId) return
    setBusy(true)
    try {
      const r = await postJson({ action: 'approve', id: jobId })
      if (!r.ok) throw new Error((await r.json()).error)
      setStep(4)
      toast(L(fa, 'Approved', 'تأیید شد'), 'success')
    } catch (e) { toast(e instanceof Error ? e.message : L(fa, 'Approval failed', 'تأیید ناموفق'), 'error') } finally { setBusy(false) }
  }
  async function execute(dryRun = false) {
    if (!jobId) return
    setBusy(true)
    try {
      const r = await postJson({ action: 'execute', id: jobId, dryRun })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      if (dryRun) {
        toast(L(fa, `Dry run: ${d.imported} would import, ${d.skipped} would skip — nothing written`, `شبیه‌سازی: ${d.imported} وارد و ${d.skipped} رد می‌شد — چیزی نوشته نشد`), 'success')
        return
      }
      setExecRes(d); setStep(5)
      toast(L(fa, `${d.imported} rows imported`, `${d.imported} ردیف وارد شد`), 'success')
    } catch (e) { toast(e instanceof Error ? e.message : L(fa, 'Execution failed', 'اجرا ناموفق'), 'error') } finally { setBusy(false) }
  }
  const tierLabel = (t: string) => t === 'auto' ? L(fa, 'auto (any editor)', 'خودکار (هر ویرایشگر)') : t === 'manager' ? L(fa, 'manager (administrator)', 'مدیر (administrator)') : L(fa, 'admin (super admin)', 'ادمین ارشد (super admin)')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {STEPS.map(([en, faL], i) => (
          <div key={en} className={`px-3 py-1 rounded-full text-2xs font-semibold ${i === step ? 'bg-brand text-white' : i < step ? 'bg-success/20 text-success' : 'bg-white/5 text-text-tertiary'}`}>{i + 1}. {L(fa, en, faL)}</div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, '1 — Upload', '۱ — بارگذاری فایل')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">{L(fa, 'Entity', 'موجودیت')}</label>
              <select value={entity} onChange={e => setEntity(e.target.value)} className="form-input !py-1.5 text-xs w-full">
                {ENTITIES.map(([v, en, faL]) => <option key={v} value={v}>{L(fa, en, faL)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">{L(fa, 'Source system', 'سیستم مبدأ')}</label>
              <select value={source} onChange={e => setSource(e.target.value)} className="form-input !py-1.5 text-xs w-full">
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">{L(fa, 'File (CSV / JSON)', 'فایل (CSV / JSON)')}</label>
              <input ref={fileRef} type="file" accept=".csv,.json,.txt,.xlsx" className="block w-full text-xs text-text-secondary" />
            </div>
          </div>
          <p className="mt-2 text-2xs text-text-tertiary">{L(fa, 'Native Excel (.xlsx), CSV and JSON are supported — the first sheet is read (Persian sheets and text included). Legacy ERPs (SAP/Oracle/Dynamics/Odoo) export these formats.', 'اکسل (.xlsx)، CSV و JSON مستقیم پشتیبانی می‌شوند — شیت اول خوانده می‌شود (شیت و متن فارسی هم). خروجی ERPهای قدیمی همین فرمت‌هاست.')}
            {' '}<a href={`${API}?view=template-csv&entity=${entity}`} className="text-brand underline">{L(fa, 'Download template', 'دانلود قالب')}</a></p>
          <div className="mt-3"><Btn onClick={upload} disabled={busy}>{busy ? L(fa, 'Uploading…', 'در حال بارگذاری…') : L(fa, 'Upload & detect structure', 'بارگذاری و شناسایی ساختار')}</Btn></div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, '2 — Field mapping', '۲ — نگاشت فیلدها')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {spec.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-44 text-xs text-text-secondary shrink-0">{L(fa, f.en, f.fa)}{f.required && <span className="text-danger"> *</span>}</span>
                <select value={mapping[f.key] ?? ''} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))} className="form-input !py-1 text-xs flex-1">
                  <option value="">{L(fa, '— not mapped —', '— نگاشت نشده —')}</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">{L(fa, 'If a record already exists', 'اگر رکورد از قبل وجود داشت')}</label>
              <select value={resolution} onChange={e => setResolution(e.target.value as 'skip' | 'update' | 'block')} className="form-input !py-1.5 text-xs">
                <option value="skip">{L(fa, 'Skip it', 'رد شود')}</option>
                <option value="update">{L(fa, 'Update it', 'به‌روزرسانی شود')}</option>
                <option value="block">{L(fa, 'Block the import', 'ورود مسدود شود')}</option>
              </select>
            </div>
            <Btn onClick={saveMap} disabled={busy}>{busy ? L(fa, 'Validating…', 'در حال اعتبارسنجی…') : L(fa, 'Save mapping & validate', 'ذخیرهٔ نگاشت و اعتبارسنجی')}</Btn>
            <Btn variant="secondary" size="sm" onClick={async () => {
              const name = window.prompt(L(fa, 'Mapping profile name:', 'نام پروفایل نگاشت:'))
              if (!name) return
              const r = await postJson({ action: 'mapping.save', entityType: entity, name, sourceSystem: source, fields: mapping })
              toast(r.ok ? L(fa, 'Mapping profile saved', 'پروفایل ذخیره شد') : L(fa, 'Failed', 'ناموفق'), r.ok ? 'success' : 'error')
            }}>{L(fa, 'Save as profile', 'ذخیره به‌عنوان پروفایل')}</Btn>
          </div>
        </Card>
      )}

      {step === 2 && valRes && (
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, '3 — Validation result', '۳ — نتیجهٔ اعتبارسنجی')}</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="rounded-lg border border-subtle p-3"><p className="text-2xs text-text-tertiary">{L(fa, 'Valid', 'معتبر')}</p><p className="text-xl font-bold text-success">{valRes.valid}</p></div>
            <div className="rounded-lg border border-subtle p-3"><p className="text-2xs text-text-tertiary">{L(fa, 'Warnings', 'هشدار')}</p><p className="text-xl font-bold text-warning">{valRes.warnings}</p></div>
            <div className="rounded-lg border border-subtle p-3"><p className="text-2xs text-text-tertiary">{L(fa, 'Rejected', 'مردود')}</p><p className="text-xl font-bold text-danger">{valRes.errors}</p></div>
          </div>
          {valErrors.length > 0 && (
            <DataTable tableId="import-val-errors" locale={fa ? 'fa' : 'en'} rows={valErrors} rowKey={(e: ValErr) => `${e.rowNo}:${e.field}:${e.code}:${e.message}`}
              columns={[
                { key: 'rowNo', labelEn: 'Row', labelFa: 'ردیف', numeric: true, render: (e: ValErr) => <span className="font-mono text-2xs">{e.rowNo}</span> },
                { key: 'severity', labelEn: 'Severity', labelFa: 'شدت', render: (e: ValErr) => <Badge color={e.severity === 'error' ? 'danger' : 'warning'}>{e.severity}</Badge> },
                { key: 'message', labelEn: 'Issue', labelFa: 'ایراد', render: (e: ValErr) => <span className="text-xs text-text-secondary">{e.message}</span> },
              ]} exportName="import-validation-errors" emptyLabel="" />
          )}
          <div className="mt-3 flex gap-2">
            <Btn variant="secondary" onClick={() => setStep(1)}>{L(fa, '← Fix mapping', '← اصلاح نگاشت')}</Btn>
            {valRes.valid + valRes.warnings > 0 && <Btn onClick={() => setStep(3)}>{L(fa, 'Continue to approval →', 'ادامه به تأیید ←')}</Btn>}
          </div>
        </Card>
      )}

      {step === 3 && valRes && (
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, '4 — Approval', '۴ — تأیید')}</h3>
          <p className="text-xs text-text-secondary mb-1">{L(fa, `This import needs: ${tierLabel(valRes.tier)}`, `این ورود نیازمند تأیید است: ${tierLabel(valRes.tier)}`)}</p>
          <p className="text-2xs text-text-tertiary mb-3">{L(fa, `Your role: ${role}. Importable rows: ${valRes.valid + valRes.warnings}, rejected: ${valRes.errors}.`, `نقش شما: ${role}. ردیف‌های قابل ورود: ${valRes.valid + valRes.warnings}، مردود: ${valRes.errors}.`)}</p>
          <Btn onClick={approve} disabled={busy}>{busy ? '…' : L(fa, 'Approve import', 'تأیید ورود')}</Btn>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, '5 — Execute', '۵ — اجرا')}</h3>
          <p className="text-2xs text-text-tertiary mb-3">{L(fa, 'Rows are written in a single database transaction; every inserted record is logged for rollback. A dry run simulates the full import and rolls everything back.', 'ردیف‌ها در یک تراکنش واحد نوشته می‌شوند؛ هر رکورد برای بازگردانی ثبت می‌شود. «شبیه‌سازی» کل ورود را اجرا و سپس همه‌چیز را بازمی‌گرداند.')}</p>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => execute(true)} disabled={busy}>{L(fa, 'Dry run (simulate)', 'شبیه‌سازی (Dry run)')}</Btn>
            <Btn onClick={() => execute(false)} disabled={busy}>{busy ? L(fa, 'Importing…', 'در حال ورود…') : L(fa, 'Run import', 'اجرای ورود')}</Btn>
          </div>
        </Card>
      )}

      {step === 5 && execRes && (
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{L(fa, '6 — Report', '۶ — گزارش')}</h3>
          <p className="text-sm text-text-primary">✓ {L(fa, `${execRes.imported} rows imported`, `${execRes.imported} ردیف وارد شد`)}{execRes.skipped > 0 && <span className="text-text-tertiary"> · {L(fa, `${execRes.skipped} skipped (duplicates)`, `${execRes.skipped} رد شد (تکراری)`)}</span>}</p>
          <p className="text-2xs text-text-tertiary mt-1">{L(fa, `Job #${jobId} — see Migration Jobs for the full audit trail and rollback.`, `کار #${jobId} — برای رهگیری کامل و بازگردانی به «کارهای مهاجرت» مراجعه کنید.`)}</p>
          <div className="mt-3"><Btn variant="secondary" onClick={() => { setStep(0); setJobId(null); setValRes(null); setExecRes(null); setValErrors([]) }}>{L(fa, 'New import', 'ورود جدید')}</Btn></div>
        </Card>
      )}
    </div>
  )
}

// ── M7: Jobs manager ─────────────────────────────────────────────────────────
function Jobs({ fa, toast, role }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void; role: string }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => { setLoading(true); fetch(`${API}?view=jobs`).then(r => r.json()).then(d => setJobs(d.jobs ?? [])).finally(() => setLoading(false)) }, [])
  useEffect(() => { load() }, [load])
  const canRollback = ['administrator', 'super_admin'].includes(role)
  async function act(j: Job, action: string) {
    const r = await postJson({ action, id: j.id })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L(fa, `${action} ok`, `${action} انجام شد`), 'success'); load() }
    else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Migration jobs', 'کارهای مهاجرت')}</h3>
        <Btn size="sm" onClick={load}>{L(fa, 'Refresh', 'به‌روزرسانی')}</Btn>
      </div>
      <DataTable tableId="import-jobs" locale={fa ? 'fa' : 'en'} rows={jobs} loading={loading} rowKey={(j: Job) => String(j.id)}
        columns={[
          { key: 'id', labelEn: 'Job', labelFa: 'کار', render: (j: Job) => <span className="font-mono text-2xs text-text-tertiary">#{j.id}</span> },
          { key: 'name', labelEn: 'Name', labelFa: 'نام', render: (j: Job) => <span className="text-xs text-text-secondary">{j.name}</span> },
          { key: 'entityType', labelEn: 'Entity', labelFa: 'موجودیت', render: (j: Job) => <span className="text-2xs text-text-tertiary">{j.entityType}</span> },
          { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', render: (j: Job) => <Badge color={STATUS_COLOR[j.status] ?? 'default'}>{j.status}</Badge> },
          { key: 'totalRows', labelEn: 'Rows', labelFa: 'ردیف', numeric: true, render: (j: Job) => <span className="text-2xs text-text-tertiary">{j.importedRows}/{j.totalRows}{j.errorRows > 0 && <span className="text-danger"> ({j.errorRows}✗)</span>}</span> },
          { key: 'createdAt', labelEn: 'Started', labelFa: 'شروع', render: (j: Job) => <span className="text-2xs text-text-tertiary">{j.createdAt}</span> },
        ]}
        rowActions={[
          { id: 'validate', labelEn: 'Validate', labelFa: 'اعتبارسنجی', icon: '☑', hidden: (j: Job) => !['draft', 'mapping', 'failed', 'validated'].includes(j.status), onClick: (j: Job) => act(j, 'validate') },
          { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓', hidden: (j: Job) => j.status !== 'validated', onClick: (j: Job) => act(j, 'approve') },
          { id: 'execute', labelEn: 'Execute', labelFa: 'اجرا', icon: '▶', hidden: (j: Job) => j.status !== 'approved', onClick: (j: Job) => act(j, 'execute') },
          { id: 'rollback', labelEn: 'Rollback', labelFa: 'بازگردانی', icon: '↺', danger: true, hidden: (j: Job) => j.status !== 'completed' || !canRollback, onClick: (j: Job) => { if (window.confirm(L(fa, `Roll back job #${j.id}? Imported records will be removed.`, `کار #${j.id} بازگردانی شود؟ رکوردهای واردشده حذف می‌شوند.`))) act(j, 'rollback') } },
        ] as RowAction<Job>[]}
        exportName="import-jobs" emptyLabel={L(fa, 'No migration jobs yet — start with "New Import".', 'هنوز کاری نیست — از «ورود جدید» شروع کنید.')} />
    </Card>
  )
}

// ── M2: Templates ────────────────────────────────────────────────────────────
interface Template { id: number; entityType: string; name: string; fields: string[]; version: number }
function Templates({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [entity, setEntity] = useState('customer')
  const [name, setName] = useState('')
  const load = useCallback(() => { fetch(`${API}?view=templates`).then(r => r.json()).then(d => setTemplates(d.templates ?? [])).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])
  async function create() {
    if (!name.trim()) { toast(L(fa, 'Name required', 'نام الزامی است'), 'error'); return }
    const r = await postJson({ action: 'template.save', entityType: entity, name: name.trim() })
    if (r.ok) { toast(L(fa, 'Template saved', 'قالب ذخیره شد'), 'success'); setName(''); load() } else toast(L(fa, 'Failed', 'ناموفق'), 'error')
  }
  async function del(t: Template) {
    const r = await postJson({ action: 'template.delete', id: t.id })
    if (r.ok) { toast(L(fa, 'Deleted', 'حذف شد'), 'success'); load() }
  }
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'New template (from the entity standard)', 'قالب جدید (از استاندارد موجودیت)')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-2xs text-text-tertiary mb-1">{L(fa, 'Entity', 'موجودیت')}</label>
            <select value={entity} onChange={e => setEntity(e.target.value)} className="form-input !py-1.5 text-xs w-full">
              {ENTITIES.map(([v, en, faL]) => <option key={v} value={v}>{L(fa, en, faL)}</option>)}
            </select>
          </div>
          <Input label={L(fa, 'Name', 'نام')} value={name} onChange={setName} />
          <Btn size="sm" onClick={create}>{L(fa, '+ Create', '+ ایجاد')}</Btn>
          <a href={`${API}?view=template-csv&entity=${entity}`} className="text-xs text-brand underline">{L(fa, 'Download CSV header', 'دانلود سرستون CSV')}</a>
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Saved templates', 'قالب‌های ذخیره‌شده')}</h3>
        <DataTable tableId="import-templates" locale={fa ? 'fa' : 'en'} rows={templates} rowKey={(t: Template) => String(t.id)}
          columns={[
            { key: 'name', labelEn: 'Name', labelFa: 'نام', render: (t: Template) => <span className="text-xs text-text-secondary">{t.name} <span className="text-text-tertiary">v{t.version}</span></span> },
            { key: 'entityType', labelEn: 'Entity', labelFa: 'موجودیت', render: (t: Template) => <span className="text-2xs text-text-tertiary">{t.entityType}</span> },
            { key: 'fields', labelEn: 'Columns', labelFa: 'ستون‌ها', render: (t: Template) => <span className="font-mono text-2xs text-text-tertiary">{t.fields.join(', ')}</span> },
          ]}
          rowActions={[{ id: 'del', labelEn: 'Delete', labelFa: 'حذف', icon: '🗑', danger: true, onClick: del } as RowAction<Template>]}
          exportName="import-templates" emptyLabel={L(fa, 'No templates yet.', 'قالبی نیست.')} />
      </Card>
    </div>
  )
}
