'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, Badge, StatCard, Modal, PageHeader, useToast } from '@/components/admin/ui'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { renderNumber, PLACEHOLDERS, type NumberFormat } from '@/lib/numbering/format'
import { NUMBERING_TEMPLATES } from '@/lib/numbering/templates'

type Tab = 'dashboard' | 'formats' | 'scopes' | 'templates' | 'counters' | 'history' | 'settings'
const TABS: Tab[] = ['dashboard', 'formats', 'scopes', 'templates', 'counters', 'history', 'settings']
const SCOPE_KINDS = ['company', 'branch', 'warehouse', 'department'] as const

interface FormatRow {
  id: number; docType: string; nameEn: string; nameFa: string | null; pattern: string
  prefix: string; suffix: string; resetPolicy: string; padding: number; increment: number
  startNumber: number; minNumber: number; maxNumber: number | null; alphabet: string
  fiscalStartMonth: number; randomLength: number; active: number; nextNumber?: string | null
}
interface CounterRow { id: number; docType: string; scopeKey: string; periodKey: string; currentValue: number; lastNumber: string | null; updatedAt: string }
interface AuditRow { id: number; docType: string; number: string; scopeKey: string; periodKey: string; module: string | null; source: string; status: string; createdAt: string }
interface Dash {
  formats: number; activeFormats: number; counters: number; generated: number; reserved: number; failed: number
  recent: AuditRow[]; lastByType: { docType: string; number: string; createdAt: string }[]; byModule: { module: string; count: number }[]
}

const RESET_POLICIES = ['never', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'fiscal']
const STATUS_COLOR: Record<string, string> = { generated: 'green', reserved: 'yellow', released: 'slate', failed: 'red' }

const emptyForm = {
  docType: '', nameEn: '', nameFa: '', pattern: '{PREFIX}-{YEAR}-{COUNTER}', prefix: '', suffix: '',
  resetPolicy: 'yearly', padding: 6, increment: 1, startNumber: 1, minNumber: 1, maxNumber: '', alphabet: 'numeric', fiscalStartMonth: 1, randomLength: 4, active: 1,
}
type FormState = typeof emptyForm

export function NumberingCenter() {
  const t = useT()
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="space-y-6">
      <ToastContainer />
      <PageHeader title={t('num_title')} subtitle={t('num_subtitle')} />
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === tb ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {t(`num_tab_${tb}`)}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <Dashboard t={t} />}
      {tab === 'formats' && <Formats t={t} toast={toast} />}
      {tab === 'scopes' && <Scopes t={t} toast={toast} />}
      {tab === 'templates' && <Templates t={t} />}
      {tab === 'counters' && <Counters t={t} toast={toast} />}
      {tab === 'history' && <History t={t} />}
      {tab === 'settings' && <Settings t={t} />}
      <p className="text-xs text-text-tertiary">{t('num_footnote')}</p>
    </div>
  )
}

function Dashboard({ t }: { t: (k: string) => string }) {
  const locale = useAdminLocale()
  const [d, setD] = useState<Dash | null>(null)
  useEffect(() => { fetch('/api/admin/erp/numbering?view=dashboard').then(r => r.json()).then(setD).catch(() => {}) }, [])
  if (!d) return <p className="text-sm text-text-tertiary">{t('num_loading')}</p>
  const maxMod = d.byModule.reduce((m, x) => Math.max(m, x.count), 0) || 1
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label={t('num_kpi_formats')} value={d.formats} icon="🧬" />
        <StatCard label={t('num_kpi_active')} value={d.activeFormats} icon="✅" />
        <StatCard label={t('num_kpi_counters')} value={d.counters} icon="🔢" />
        <StatCard label={t('num_kpi_generated')} value={d.generated} icon="📄" />
        <StatCard label={t('num_kpi_reserved')} value={d.reserved} icon="🔖" />
        <StatCard label={t('num_kpi_failed')} value={d.failed} icon="⚠️" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('num_lastByType')}</h3>
          {d.lastByType.length === 0 ? <p className="text-sm text-text-tertiary">{t('num_none')}</p> : (
            <div className="space-y-2">
              {d.lastByType.map(x => (
                <div key={x.docType} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{x.docType}</span>
                  <span className="font-mono text-text-primary">{x.number}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('num_byModule')}</h3>
          {d.byModule.length === 0 ? <p className="text-sm text-text-tertiary">{t('num_none')}</p> : (
            <div className="space-y-2">
              {d.byModule.map(x => (
                <div key={x.module} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-text-secondary">{x.module}</span>
                  <div className="flex-1 h-2.5 rounded bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded bg-accent" style={{ width: `${(x.count / maxMod) * 100}%` }} />
                  </div>
                  <span className="w-12 text-end text-sm tabular-nums text-text-primary">{x.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-semibold text-text-primary">{t('num_recent')}</h3></div>
        <div className="p-4">
          <DataTable
            tableId="numbering-recent"
            columns={[
              { key: 'number', labelEn: 'Number', labelFa: t('num_col_number'), render: a => <span className="font-mono text-text-primary">{a.number || '—'}</span> },
              { key: 'docType', labelEn: 'Type', labelFa: t('num_col_type'), type: 'enum', render: a => <span>{a.docType}</span> },
              { key: 'module', labelEn: 'Module', labelFa: t('num_col_module'), type: 'enum', render: a => <span>{a.module ?? '—'}</span> },
              { key: 'status', labelEn: 'Status', labelFa: t('num_col_status'), type: 'enum', render: a => <Badge color={STATUS_COLOR[a.status] ?? 'slate'}>{t(`num_st_${a.status}`)}</Badge> },
              { key: 'createdAt', labelEn: 'Time', labelFa: t('num_col_time'), type: 'date', render: a => <span className="text-text-tertiary text-xs">{a.createdAt}</span> },
            ] as Column<AuditRow>[]}
            rows={d.recent}
            locale={locale}
            rowKey={a => String(a.id)}
            exportName="numbering-recent"
            emptyLabel={t('num_none')}
          />
        </div>
      </Card>
    </div>
  )
}

function Formats({ t, toast }: { t: (k: string) => string; toast: (m: string, k?: 'success' | 'error') => void }) {
  const locale = useAdminLocale()
  const [rows, setRows] = useState<FormatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/numbering?view=formats'); const d = await r.json(); setRows(d.formats ?? []) }
    catch { toast(t('num_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditId(null); setForm(emptyForm); setModal(true) }
  const openEdit = (r: FormatRow) => {
    setEditId(r.id)
    setForm({ docType: r.docType, nameEn: r.nameEn, nameFa: r.nameFa ?? '', pattern: r.pattern, prefix: r.prefix, suffix: r.suffix, resetPolicy: r.resetPolicy, padding: r.padding, increment: r.increment, startNumber: r.startNumber, minNumber: r.minNumber, maxNumber: r.maxNumber == null ? '' : String(r.maxNumber), alphabet: r.alphabet, fiscalStartMonth: r.fiscalStartMonth, randomLength: r.randomLength, active: r.active })
    setModal(true)
  }

  const preview = useMemo(() => {
    try {
      const fmt: NumberFormat = { docType: form.docType || 'doc', pattern: form.pattern, prefix: form.prefix, suffix: form.suffix, resetPolicy: form.resetPolicy as NumberFormat['resetPolicy'], padding: Number(form.padding), increment: Number(form.increment), startNumber: Number(form.startNumber), minNumber: Number(form.minNumber), maxNumber: form.maxNumber ? Number(form.maxNumber) : null, alphabet: form.alphabet as NumberFormat['alphabet'], fiscalStartMonth: Number(form.fiscalStartMonth), randomLength: Number(form.randomLength) }
      return renderNumber(fmt, Number(form.startNumber) || 1, new Date(), { company: 'C1', branch: 'TEH', warehouse: 'WH1', department: 'IT', project: 'P1', customField: 'X', random: 'R'.repeat(Math.max(1, Number(form.randomLength) || 4)), uuid: '00000000-0000-4000-8000-000000000000' })
    } catch { return '—' }
  }, [form])

  const insertToken = (tok: string) => setForm(f => ({ ...f, pattern: `${f.pattern}{${tok}}` }))

  async function save() {
    setSaving(true)
    try {
      const body = { ...form, nameFa: form.nameFa || undefined, padding: Number(form.padding), increment: Number(form.increment), startNumber: Number(form.startNumber), minNumber: Number(form.minNumber), maxNumber: form.maxNumber ? Number(form.maxNumber) : null, fiscalStartMonth: Number(form.fiscalStartMonth), randomLength: Number(form.randomLength), active: Number(form.active) }
      const r = editId
        ? await fetch('/api/admin/erp/numbering', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...body }) })
        : await fetch('/api/admin/erp/numbering', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(t('num_saved'), 'success'); setModal(false); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('num_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function remove(id: number) {
    if (!confirm(t('num_confirmDelete'))) return
    const r = await fetch(`/api/admin/erp/numbering?id=${id}`, { method: 'DELETE' })
    if (r.ok) { toast(t('num_deleted'), 'success'); load() } else toast(t('num_saveFail'), 'error')
  }
  async function generate(docType: string) {
    const r = await fetch('/api/admin/erp/numbering/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate', docType }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(`${t('num_generated')}: ${d.number}`, 'success'); load() } else toast(d.error || t('num_saveFail'), 'error')
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const formats = Array.isArray(parsed) ? parsed : parsed.formats
      if (!Array.isArray(formats)) throw new Error('bad file')
      const r = await fetch('/api/admin/erp/numbering/io', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formats }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(`${t('num_importDone')}: +${d.imported} / ~${d.updated}${d.skipped?.length ? ` / !${d.skipped.length}` : ''}`, 'success')
      load()
    } catch { toast(t('num_importFail'), 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <a href="/api/admin/erp/numbering/io?format=json" download className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-4 py-2 text-sm bg-surface-2 hover:bg-surface text-text-primary border border-border hover:border-border-strong transition-all duration-fast">{t('num_exportJson')}</a>
        <a href="/api/admin/erp/numbering/io?format=csv" download className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-4 py-2 text-sm bg-surface-2 hover:bg-surface text-text-primary border border-border hover:border-border-strong transition-all duration-fast">{t('num_exportCsv')}</a>
        <label className="inline-flex items-center gap-2 rounded-lg font-semibold h-9 px-4 py-2 text-sm bg-surface-2 hover:bg-surface text-text-primary border border-border hover:border-border-strong transition-all duration-fast cursor-pointer">
          {t('num_import')}
          <input type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
        </label>
        <Btn onClick={openNew}>{t('num_newFormat')}</Btn>
      </div>
      {loading ? <p className="text-sm text-text-tertiary">{t('num_loading')}</p> : rows.length === 0 ? (
        <Card className="p-8 text-center"><p className="text-sm text-text-tertiary">{t('num_noFormats')}</p></Card>
      ) : (
        <Card className="p-4">
          <DataTable
            tableId="numbering-formats"
            columns={[
              { key: 'docType', labelEn: 'Type', labelFa: t('num_col_type'), render: r => <span className="text-text-primary font-medium">{r.docType}<span className="block text-xs text-text-tertiary">{r.nameEn}</span></span> },
              { key: 'pattern', labelEn: 'Pattern', labelFa: t('num_col_pattern'), render: r => <span className="font-mono text-xs">{r.pattern}</span> },
              { key: 'resetPolicy', labelEn: 'Reset', labelFa: t('num_col_reset'), type: 'enum', render: r => <span>{t(`num_reset_${r.resetPolicy}`)}</span> },
              { key: 'nextNumber', labelEn: 'Next', labelFa: t('num_col_next'), render: r => <span className="font-mono text-text-primary">{r.nextNumber ?? '—'}</span> },
              { key: 'active', labelEn: 'Active', labelFa: t('num_col_active'), type: 'boolean', value: r => !!r.active, render: r => r.active ? <Badge color="green">{t('num_on')}</Badge> : <Badge color="slate">{t('num_off')}</Badge> },
            ] as Column<FormatRow>[]}
            rows={rows}
            locale={locale}
            rowKey={r => String(r.id)}
            rowActions={[
              { id: 'generate', labelEn: 'Generate', labelFa: t('num_generate'), icon: '＋', onClick: r => generate(r.docType) },
              { id: 'edit', labelEn: 'Edit', labelFa: t('num_edit'), icon: '✎', onClick: r => openEdit(r) },
              { id: 'del', labelEn: 'Delete', labelFa: t('num_delete'), icon: '🗑', danger: true, onClick: r => remove(r.id) },
            ] as RowAction<FormatRow>[]}
            exportName="numbering-formats"
          />
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('num_editFormat') : t('num_newFormat')} size="lg">
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Input label={t('num_f_docType')} value={form.docType} onChange={v => setForm(f => ({ ...f, docType: v }))} placeholder="invoice" />
            <Input label={t('num_f_nameEn')} value={form.nameEn} onChange={v => setForm(f => ({ ...f, nameEn: v }))} placeholder="Invoice" />
            <Input label={t('num_f_nameFa')} value={form.nameFa} onChange={v => setForm(f => ({ ...f, nameFa: v }))} placeholder="فاکتور" />
            <Input label={t('num_f_pattern')} value={form.pattern} onChange={v => setForm(f => ({ ...f, pattern: v }))} placeholder="{PREFIX}-{YEAR}-{COUNTER}" />
          </div>
          <div>
            <label className="form-label">{t('num_f_placeholders')}</label>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map(p => (
                <button key={p} onClick={() => insertToken(p)} className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-mono text-text-secondary hover:border-border-strong hover:text-text-primary">{`{${p}}`}</button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 flex items-center justify-between">
            <span className="text-overline text-text-tertiary">{t('num_preview')}</span>
            <span className="font-mono text-lg text-text-primary">{preview}</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Input label={t('num_f_prefix')} value={form.prefix} onChange={v => setForm(f => ({ ...f, prefix: v }))} placeholder="INV" />
            <Input label={t('num_f_suffix')} value={form.suffix} onChange={v => setForm(f => ({ ...f, suffix: v }))} />
            <Select label={t('num_f_reset')} value={form.resetPolicy} onChange={v => setForm(f => ({ ...f, resetPolicy: v }))} options={RESET_POLICIES.map(p => ({ value: p, label: t(`num_reset_${p}`) }))} />
            <Input label={t('num_f_padding')} type="number" value={String(form.padding)} onChange={v => setForm(f => ({ ...f, padding: Number(v) }))} />
            <Input label={t('num_f_increment')} type="number" value={String(form.increment)} onChange={v => setForm(f => ({ ...f, increment: Number(v) }))} />
            <Input label={t('num_f_start')} type="number" value={String(form.startNumber)} onChange={v => setForm(f => ({ ...f, startNumber: Number(v) }))} />
            <Input label={t('num_f_max')} type="number" value={form.maxNumber} onChange={v => setForm(f => ({ ...f, maxNumber: v }))} placeholder="∞" />
            <Select label={t('num_f_alphabet')} value={form.alphabet} onChange={v => setForm(f => ({ ...f, alphabet: v }))} options={[{ value: 'numeric', label: t('num_alpha_numeric') }, { value: 'hex', label: t('num_alpha_hex') }]} />
            <Input label={t('num_f_randomLen')} type="number" value={String(form.randomLength)} onChange={v => setForm(f => ({ ...f, randomLength: Number(v) }))} />
            <Select label={t('num_f_fiscalMonth')} value={String(form.fiscalStartMonth)} onChange={v => setForm(f => ({ ...f, fiscalStartMonth: Number(v) }))} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
            <Select label={t('num_f_active')} value={String(form.active)} onChange={v => setForm(f => ({ ...f, active: Number(v) }))} options={[{ value: '1', label: t('num_on') }, { value: '0', label: t('num_off') }]} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('num_cancel')}</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? t('num_saving') : t('num_save')}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Counters({ t, toast }: { t: (k: string) => string; toast: (m: string, k?: 'success' | 'error') => void }) {
  const locale = useAdminLocale()
  const [rows, setRows] = useState<CounterRow[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/numbering?view=counters'); const d = await r.json(); setRows(d.counters ?? []) }
    catch { toast(t('num_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  async function reset(r: CounterRow) {
    if (!confirm(t('num_confirmReset'))) return
    const res = await fetch('/api/admin/erp/numbering/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset', docType: r.docType, scopeKey: r.scopeKey, periodKey: r.periodKey }) })
    if (res.ok) { toast(t('num_resetDone'), 'success'); load() } else toast(t('num_saveFail'), 'error')
  }

  if (loading) return <p className="text-sm text-text-tertiary">{t('num_loading')}</p>
  if (rows.length === 0) return <Card className="p-8 text-center"><p className="text-sm text-text-tertiary">{t('num_noCounters')}</p></Card>
  return (
    <Card className="p-4">
      <DataTable
        tableId="numbering-counters"
        columns={[
          { key: 'docType', labelEn: 'Type', labelFa: t('num_col_type'), type: 'enum', render: r => <span className="text-text-primary">{r.docType}</span> },
          { key: 'scopeKey', labelEn: 'Scope', labelFa: t('num_col_scope'), type: 'enum', render: r => <span className="text-xs">{r.scopeKey || '—'}</span> },
          { key: 'periodKey', labelEn: 'Period', labelFa: t('num_col_period'), type: 'enum', render: r => <span className="text-xs">{r.periodKey || '—'}</span> },
          { key: 'currentValue', labelEn: 'Current', labelFa: t('num_col_current'), type: 'number', numeric: true, render: r => <span className="font-mono text-text-primary tabular-nums">{r.currentValue}</span> },
          { key: 'lastNumber', labelEn: 'Last', labelFa: t('num_col_last'), render: r => <span className="font-mono text-xs">{r.lastNumber ?? '—'}</span> },
        ] as Column<CounterRow>[]}
        rows={rows}
        locale={locale}
        rowKey={r => String(r.id)}
        rowActions={[{ id: 'reset', labelEn: 'Reset', labelFa: t('num_reset'), icon: '↺', danger: true, onClick: r => reset(r) }] as RowAction<CounterRow>[]}
        exportName="numbering-counters"
      />
    </Card>
  )
}

interface ScopeRow { id: number; kind: string; code: string; nameEn: string; nameFa: string | null; active: number }
function Scopes({ t, toast }: { t: (k: string) => string; toast: (m: string, k?: 'success' | 'error') => void }) {
  const locale = useAdminLocale()
  const [rows, setRows] = useState<ScopeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ id: 0, kind: 'company', code: '', nameEn: '', nameFa: '', active: 1 })
  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/numbering/scopes'); const d = await r.json(); setRows(d.scopes ?? []) }
    catch { toast(t('num_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  async function save() {
    const body = { ...form, id: form.id || undefined, nameFa: form.nameFa || undefined }
    const r = await fetch('/api/admin/erp/numbering/scopes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(t('num_saved'), 'success'); setModal(false); load() } else toast(d.error || t('num_saveFail'), 'error')
  }
  async function remove(id: number) {
    if (!confirm(t('num_confirmDelete'))) return
    const r = await fetch(`/api/admin/erp/numbering/scopes?id=${id}`, { method: 'DELETE' })
    if (r.ok) { toast(t('num_deleted'), 'success'); load() } else toast(t('num_saveFail'), 'error')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-text-secondary">{t('num_scopesHint')}</p>
        <Btn onClick={() => { setForm({ id: 0, kind: 'company', code: '', nameEn: '', nameFa: '', active: 1 }); setModal(true) }}>{t('num_addScope')}</Btn>
      </div>
      {loading ? <p className="text-sm text-text-tertiary">{t('num_loading')}</p> : rows.length === 0 ? (
        <Card className="p-8 text-center"><p className="text-sm text-text-tertiary">{t('num_noScopes')}</p></Card>
      ) : (
        <Card className="p-4">
          <DataTable
            tableId="numbering-scopes"
            columns={[
              { key: 'kind', labelEn: 'Kind', labelFa: t('num_col_kind'), type: 'enum', render: r => <Badge color="indigo">{t(`num_kind_${r.kind}`)}</Badge> },
              { key: 'code', labelEn: 'Code', labelFa: t('num_col_code'), render: r => <span className="font-mono text-text-primary">{r.code}</span> },
              { key: 'nameEn', labelEn: 'Name', labelFa: t('num_col_name'), render: r => <span>{r.nameEn}{r.nameFa ? <span className="block text-xs text-text-tertiary">{r.nameFa}</span> : null}</span> },
              { key: 'active', labelEn: 'Active', labelFa: t('num_col_active'), type: 'boolean', value: r => !!r.active, render: r => r.active ? <Badge color="green">{t('num_on')}</Badge> : <Badge color="slate">{t('num_off')}</Badge> },
            ] as Column<ScopeRow>[]}
            rows={rows}
            locale={locale}
            rowKey={r => String(r.id)}
            rowActions={[
              { id: 'edit', labelEn: 'Edit', labelFa: t('num_edit'), icon: '✎', onClick: r => { setForm({ id: r.id, kind: r.kind, code: r.code, nameEn: r.nameEn, nameFa: r.nameFa ?? '', active: r.active }); setModal(true) } },
              { id: 'del', labelEn: 'Delete', labelFa: t('num_delete'), icon: '🗑', danger: true, onClick: r => remove(r.id) },
            ] as RowAction<ScopeRow>[]}
            exportName="numbering-scopes"
          />
        </Card>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? t('num_editScope') : t('num_addScope')} size="md">
        <div className="space-y-3">
          <Select label={t('num_col_kind')} value={form.kind} onChange={v => setForm(f => ({ ...f, kind: v }))} options={SCOPE_KINDS.map(k => ({ value: k, label: t(`num_kind_${k}`) }))} />
          <Input label={t('num_col_code')} value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="TEH" />
          <Input label={t('num_f_nameEn')} value={form.nameEn} onChange={v => setForm(f => ({ ...f, nameEn: v }))} placeholder="Tehran" />
          <Input label={t('num_f_nameFa')} value={form.nameFa} onChange={v => setForm(f => ({ ...f, nameFa: v }))} placeholder="تهران" />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('num_cancel')}</Btn>
            <Btn onClick={save}>{t('num_save')}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Templates({ t }: { t: (k: string) => string }) {
  const locale = useAdminLocale()
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {NUMBERING_TEMPLATES.map(tpl => (
        <Card key={tpl.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-text-primary">{locale === 'fa' ? tpl.nameFa : tpl.nameEn}</h4>
            <Badge color="slate">{t(`num_reset_${tpl.resetPolicy}`)}</Badge>
          </div>
          <p className="font-mono text-xs text-text-secondary">{tpl.pattern}</p>
          <p className="mt-2 text-lg font-mono text-text-primary">{tpl.example}</p>
        </Card>
      ))}
    </div>
  )
}

function Settings({ t }: { t: (k: string) => string }) {
  const locale = useAdminLocale()
  const [formats, setFormats] = useState<FormatRow[]>([])
  useEffect(() => { fetch('/api/admin/erp/numbering?view=formats').then(r => r.json()).then(d => setFormats(d.formats ?? [])).catch(() => {}) }, [])
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-1">{t('num_resetSchedule')}</h3>
        <p className="text-xs text-text-tertiary mb-3">{t('num_resetScheduleHint')}</p>
        <DataTable
          tableId="numbering-schedule"
          columns={[
            { key: 'docType', labelEn: 'Type', labelFa: t('num_col_type'), type: 'enum', render: f => <span className="text-text-primary">{f.docType}</span> },
            { key: 'resetPolicy', labelEn: 'Reset', labelFa: t('num_col_reset'), type: 'enum', render: f => <Badge color="indigo">{t(`num_reset_${f.resetPolicy}`)}</Badge> },
            { key: 'nextNumber', labelEn: 'Next', labelFa: t('num_col_next'), render: f => <span className="font-mono">{f.nextNumber ?? '—'}</span> },
          ] as Column<FormatRow>[]}
          rows={formats}
          locale={locale}
          rowKey={f => String(f.id)}
          exportName="numbering-schedule"
        />
      </Card>
      <Card className="p-5 space-y-2 text-sm text-text-secondary">
        <h3 className="text-sm font-semibold text-text-primary">{t('num_engineInfo')}</h3>
        <p>{t('num_engineInfoBody')}</p>
      </Card>
    </div>
  )
}

function History({ t }: { t: (k: string) => string }) {
  const locale = useAdminLocale()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AuditRow[]>([])
  useEffect(() => {
    const id = setTimeout(() => {
      fetch(`/api/admin/erp/numbering?view=audit${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(r => r.json()).then(d => setRows(d.audit ?? [])).catch(() => {})
    }, 250)
    return () => clearTimeout(id)
  }, [q])
  return (
    <div className="space-y-4">
      <Input value={q} onChange={setQ} placeholder={t('num_searchPlaceholder')} />
      <Card className="p-0 overflow-hidden">
        <div className="p-4">
          <DataTable
            tableId="numbering-audit"
            columns={[
              { key: 'number', labelEn: 'Number', labelFa: t('num_col_number'), render: a => <span className="font-mono text-text-primary">{a.number || '—'}</span> },
              { key: 'docType', labelEn: 'Type', labelFa: t('num_col_type'), type: 'enum', render: a => <span>{a.docType}</span> },
              { key: 'scopeKey', labelEn: 'Scope', labelFa: t('num_col_scope'), type: 'enum', render: a => <span className="text-xs">{a.scopeKey || '—'}</span> },
              { key: 'module', labelEn: 'Module', labelFa: t('num_col_module'), type: 'enum', render: a => <span>{a.module ?? '—'}</span> },
              { key: 'source', labelEn: 'Source', labelFa: t('num_col_source'), type: 'enum', render: a => <span className="text-xs">{a.source}</span> },
              { key: 'status', labelEn: 'Status', labelFa: t('num_col_status'), type: 'enum', render: a => <Badge color={STATUS_COLOR[a.status] ?? 'slate'}>{t(`num_st_${a.status}`)}</Badge> },
              { key: 'createdAt', labelEn: 'Time', labelFa: t('num_col_time'), type: 'date', render: a => <span className="text-text-tertiary text-xs">{a.createdAt}</span> },
            ] as Column<AuditRow>[]}
            rows={rows}
            locale={locale}
            rowKey={a => String(a.id)}
            exportName="numbering-audit"
            emptyLabel={t('num_none')}
          />
        </div>
      </Card>
    </div>
  )
}
