'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, Badge, StatCard, Table, TR, TD, Modal, PageHeader, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'
import { renderNumber, PLACEHOLDERS, type NumberFormat } from '@/lib/numbering/format'

type Tab = 'dashboard' | 'formats' | 'counters' | 'history'
const TABS: Tab[] = ['dashboard', 'formats', 'counters', 'history']

interface FormatRow {
  id: number; docType: string; nameEn: string; nameFa: string | null; pattern: string
  prefix: string; suffix: string; resetPolicy: string; padding: number; increment: number
  startNumber: number; minNumber: number; maxNumber: number | null; alphabet: string
  fiscalStartMonth: number; active: number; nextNumber?: string | null
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
  resetPolicy: 'yearly', padding: 6, increment: 1, startNumber: 1, minNumber: 1, maxNumber: '', alphabet: 'numeric', fiscalStartMonth: 1, active: 1,
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
      {tab === 'counters' && <Counters t={t} toast={toast} />}
      {tab === 'history' && <History t={t} />}
      <p className="text-xs text-text-tertiary">{t('num_footnote')}</p>
    </div>
  )
}

function Dashboard({ t }: { t: (k: string) => string }) {
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
        {d.recent.length === 0 ? <p className="p-6 text-center text-sm text-text-tertiary">{t('num_none')}</p> : (
          <Table headers={[t('num_col_number'), t('num_col_type'), t('num_col_module'), t('num_col_status'), t('num_col_time')]}>
            {d.recent.map(a => (
              <TR key={a.id}>
                <TD className="font-mono text-text-primary">{a.number || '—'}</TD>
                <TD>{a.docType}</TD>
                <TD>{a.module ?? '—'}</TD>
                <TD><Badge color={STATUS_COLOR[a.status] ?? 'slate'}>{t(`num_st_${a.status}`)}</Badge></TD>
                <TD className="text-text-tertiary text-xs">{a.createdAt}</TD>
              </TR>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}

function Formats({ t, toast }: { t: (k: string) => string; toast: (m: string, k?: 'success' | 'error') => void }) {
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
    setForm({ docType: r.docType, nameEn: r.nameEn, nameFa: r.nameFa ?? '', pattern: r.pattern, prefix: r.prefix, suffix: r.suffix, resetPolicy: r.resetPolicy, padding: r.padding, increment: r.increment, startNumber: r.startNumber, minNumber: r.minNumber, maxNumber: r.maxNumber == null ? '' : String(r.maxNumber), alphabet: r.alphabet, fiscalStartMonth: r.fiscalStartMonth, active: r.active })
    setModal(true)
  }

  const preview = useMemo(() => {
    try {
      const fmt: NumberFormat = { docType: form.docType || 'doc', pattern: form.pattern, prefix: form.prefix, suffix: form.suffix, resetPolicy: form.resetPolicy as NumberFormat['resetPolicy'], padding: Number(form.padding), increment: Number(form.increment), startNumber: Number(form.startNumber), minNumber: Number(form.minNumber), maxNumber: form.maxNumber ? Number(form.maxNumber) : null, alphabet: form.alphabet as NumberFormat['alphabet'], fiscalStartMonth: Number(form.fiscalStartMonth) }
      return renderNumber(fmt, Number(form.startNumber) || 1, new Date(), { company: 'C1', branch: 'TEH', warehouse: 'WH1', department: 'IT', project: 'P1', customField: 'X', random: '7Q' })
    } catch { return '—' }
  }, [form])

  const insertToken = (tok: string) => setForm(f => ({ ...f, pattern: `${f.pattern}{${tok}}` }))

  async function save() {
    setSaving(true)
    try {
      const body = { ...form, nameFa: form.nameFa || undefined, padding: Number(form.padding), increment: Number(form.increment), startNumber: Number(form.startNumber), minNumber: Number(form.minNumber), maxNumber: form.maxNumber ? Number(form.maxNumber) : null, fiscalStartMonth: Number(form.fiscalStartMonth), active: Number(form.active) }
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Btn onClick={openNew}>{t('num_newFormat')}</Btn></div>
      {loading ? <p className="text-sm text-text-tertiary">{t('num_loading')}</p> : rows.length === 0 ? (
        <Card className="p-8 text-center"><p className="text-sm text-text-tertiary">{t('num_noFormats')}</p></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table headers={[t('num_col_type'), t('num_col_pattern'), t('num_col_reset'), t('num_col_next'), t('num_col_active'), '']}>
            {rows.map(r => (
              <TR key={r.id}>
                <TD className="text-text-primary font-medium">{r.docType}<span className="block text-xs text-text-tertiary">{r.nameEn}</span></TD>
                <TD className="font-mono text-xs">{r.pattern}</TD>
                <TD>{t(`num_reset_${r.resetPolicy}`)}</TD>
                <TD className="font-mono text-text-primary">{r.nextNumber ?? '—'}</TD>
                <TD>{r.active ? <Badge color="green">{t('num_on')}</Badge> : <Badge color="slate">{t('num_off')}</Badge>}</TD>
                <TD>
                  <div className="flex gap-1 justify-end">
                    <Btn size="sm" variant="ghost" onClick={() => generate(r.docType)}>{t('num_generate')}</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => openEdit(r)}>{t('num_edit')}</Btn>
                    <Btn size="sm" variant="danger" onClick={() => remove(r.id)}>{t('num_delete')}</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
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
    <Card className="p-0 overflow-hidden">
      <Table headers={[t('num_col_type'), t('num_col_scope'), t('num_col_period'), t('num_col_current'), t('num_col_last'), '']}>
        {rows.map(r => (
          <TR key={r.id}>
            <TD className="text-text-primary">{r.docType}</TD>
            <TD className="text-xs">{r.scopeKey || '—'}</TD>
            <TD className="text-xs">{r.periodKey || '—'}</TD>
            <TD className="font-mono text-text-primary tabular-nums">{r.currentValue}</TD>
            <TD className="font-mono text-xs">{r.lastNumber ?? '—'}</TD>
            <TD><div className="flex justify-end"><Btn size="sm" variant="danger" onClick={() => reset(r)}>{t('num_reset')}</Btn></div></TD>
          </TR>
        ))}
      </Table>
    </Card>
  )
}

function History({ t }: { t: (k: string) => string }) {
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
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-text-tertiary">{t('num_none')}</p> : (
          <Table headers={[t('num_col_number'), t('num_col_type'), t('num_col_scope'), t('num_col_module'), t('num_col_source'), t('num_col_status'), t('num_col_time')]}>
            {rows.map(a => (
              <TR key={a.id}>
                <TD className="font-mono text-text-primary">{a.number || '—'}</TD>
                <TD>{a.docType}</TD>
                <TD className="text-xs">{a.scopeKey || '—'}</TD>
                <TD>{a.module ?? '—'}</TD>
                <TD className="text-xs">{a.source}</TD>
                <TD><Badge color={STATUS_COLOR[a.status] ?? 'slate'}>{t(`num_st_${a.status}`)}</Badge></TD>
                <TD className="text-text-tertiary text-xs">{a.createdAt}</TD>
              </TR>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
