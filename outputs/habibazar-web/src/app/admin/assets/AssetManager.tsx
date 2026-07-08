'use client'

import { useCallback, useEffect, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Tab = 'dashboard' | 'assets'
type WState = 'ok' | 'expiring' | 'expired' | 'none'

interface Asset {
  id?: number; name: string; type: string; category: string | null; model: string | null; manufacturer: string | null
  serial: string | null; barcode: string | null; vendor: string | null; status: string
  location: string | null; department: string | null; employee: string | null; costCenter: string | null; project: string | null
  assignedTo: string | null; purchaseDate: string | null; purchasePrice: number; residualValue: number
  usefulLifeYears: number; depreciationMethod: string; warrantyExpiry: string | null
  insurancePolicy: string | null; insuranceExpiry: string | null; contractRef: string | null; calibrationDue: string | null
  gpsLat: number | null; gpsLng: number | null; notes: string | null
  bookValue?: number; accumulatedDepreciation?: number; lifeUsedPct?: number
  warranty?: { state: WState; days: number | null }; insurance?: { state: WState; days: number | null }
  calibration?: { state: WState; days: number | null }; openMaintenance?: number
}
interface Kpis { total: number; active: number; maintenance: number; retired: number; totalCost: number; totalBookValue: number; totalDepreciation: number; warrantyExpiring: number; warrantyExpired: number; insuranceExpiring: number; calibrationDue: number; openMaintenance: number }
interface Overview { kpis: Kpis; byType: { key: string; count: number }[]; byStatus: { key: string; count: number }[]; attention: Asset[]; upcomingMaintenance: { id: number; type: string; status: string; scheduledDate: string | null; vendor: string | null; assetName: string; assetId: number }[] }
interface Assignment { id: number; assignee: string; department: string | null; location: string | null; fromDate: string | null; toDate: string | null; note: string | null; createdAt: string }
interface Maintenance { id: number; type: string; status: string; scheduledDate: string | null; doneDate: string | null; cost: number; vendor: string | null; note: string | null; createdAt: string }
interface Activity { id: number; action: string; detail: string | null; createdAt: string }

const TYPES = ['server', 'network', 'firewall', 'switch', 'router', 'access_point', 'storage', 'vm', 'cloud', 'laptop', 'license', 'other']
const STATUSES = ['active', 'maintenance', 'retired', 'spare']
const DEP_METHODS = ['none', 'straight_line', 'declining_balance', 'sum_of_years_digits']
const WCOLOR: Record<WState, 'green' | 'yellow' | 'red' | 'slate'> = { ok: 'green', expiring: 'yellow', expired: 'red', none: 'slate' }
const EMPTY: Asset = {
  name: '', type: 'server', category: '', model: '', manufacturer: '', serial: '', barcode: '', vendor: '', status: 'active',
  location: '', department: '', employee: '', costCenter: '', project: '', assignedTo: '', purchaseDate: '',
  purchasePrice: 0, residualValue: 0, usefulLifeYears: 0, depreciationMethod: 'none', warrantyExpiry: '',
  insurancePolicy: '', insuranceExpiry: '', contractRef: '', calibrationDue: '', gpsLat: null, gpsLng: null, notes: '',
}
const money = (n: number | null | undefined) => fmtMoney(n, { max: 0 })

export function AssetManager() {
  const t = useT()
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('dashboard')
  return (
    <>
      <ToastContainer />
      <PageHeader title={t('am_title')} subtitle={t('am_subtitle')} />
      <div className="flex gap-1 mb-6 border-b border-subtle">
        {(['dashboard', 'assets'] as Tab[]).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tb ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {t(`am_tab_${tb}` as 'am_tab_dashboard')}
          </button>
        ))}
      </div>
      {tab === 'dashboard' ? <Dashboard t={t} /> : <Assets t={t} toast={toast} />}
    </>
  )
}
type T = ReturnType<typeof useT>
type Toast = ReturnType<typeof useToast>['toast']

function Dashboard({ t }: { t: T }) {
  const [d, setD] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/assets/overview'); if (r.ok) setD(await r.json()) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  if (loading && !d) return <p className="text-sm text-text-tertiary">{t('am_loading')}</p>
  if (!d) return <Card className="p-5"><p className="text-sm text-text-tertiary">{t('am_empty')}</p></Card>
  const k = d.kpis
  const maxType = Math.max(1, ...d.byType.map(x => x.count))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label={t('am_kTotal')} value={String(k.total)} icon="🖥️" />
        <Kpi label={t('am_kActive')} value={String(k.active)} icon="✅" tone="ok" />
        <Kpi label={t('am_kCost')} value={money(k.totalCost)} icon="💵" />
        <Kpi label={t('am_kBook')} value={money(k.totalBookValue)} icon="📉" tone="ok" />
        <Kpi label={t('am_kDep')} value={money(k.totalDepreciation)} icon="➖" />
        <Kpi label={t('am_kOpenMaint')} value={String(k.openMaintenance)} icon="🔧" tone={k.openMaintenance ? 'warn' : undefined} />
        <Kpi label={t('am_kWarrantyExp')} value={String(k.warrantyExpiring)} icon="⏳" tone={k.warrantyExpiring ? 'warn' : undefined} />
        <Kpi label={t('am_kWarrantyExpired')} value={String(k.warrantyExpired)} icon="⛔" tone={k.warrantyExpired ? 'bad' : undefined} />
        <Kpi label={t('am_kInsurance')} value={String(k.insuranceExpiring)} icon="🛡️" tone={k.insuranceExpiring ? 'warn' : undefined} />
        <Kpi label={t('am_kCalibration')} value={String(k.calibrationDue)} icon="🎯" tone={k.calibrationDue ? 'warn' : undefined} />
        <Kpi label={t('am_kMaintenance')} value={String(k.maintenance)} icon="🛠️" />
        <Kpi label={t('am_kRetired')} value={String(k.retired)} icon="🗄️" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('am_byType')}</h3>
          <div className="space-y-2">
            {d.byType.map(x => (
              <div key={x.key}>
                <div className="flex justify-between text-xs mb-0.5"><span className="text-text-secondary capitalize">{x.key}</span><span className="text-text-tertiary">{x.count}</span></div>
                <div className="h-1.5 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(x.count / maxType) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('am_upcomingMaint')}</h3>
          {d.upcomingMaintenance.length === 0 ? <p className="text-xs text-text-tertiary">{t('am_noMaint')}</p> : (
            <div className="space-y-2">
              {d.upcomingMaintenance.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary truncate">{m.assetName} <span className="text-text-tertiary text-xs">· {t(`am_mt_${m.type}` as 'am_mt_maintenance')}</span></span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-text-tertiary">{m.scheduledDate || '—'}</span>
                    <Badge color={m.status === 'overdue' ? 'red' : 'yellow'}>{t(`am_ms_${m.status}` as 'am_ms_scheduled')}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('am_attention')}</h3>
        {d.attention.length === 0 ? <p className="text-xs text-text-tertiary">{t('am_allGood')}</p> : (
          <div className="flex flex-wrap gap-2">
            {d.attention.map(a => (
              <div key={a.id} className="rounded-lg border border-subtle px-3 py-2 text-xs">
                <div className="font-medium text-text-secondary">{a.name}</div>
                <div className="flex gap-1 mt-1">
                  {a.warranty && a.warranty.state !== 'ok' && a.warranty.state !== 'none' && <Badge color={WCOLOR[a.warranty.state]}>{t('am_warranty')}</Badge>}
                  {a.calibration && (a.calibration.state === 'expiring' || a.calibration.state === 'expired') && <Badge color={WCOLOR[a.calibration.state]}>{t('am_calibration')}</Badge>}
                  {!!a.openMaintenance && <Badge color="yellow">{a.openMaintenance} {t('am_maint')}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return (
    <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}>
      <div className="flex items-center justify-between mb-1"><p className="text-xs text-text-tertiary">{label}</p><span aria-hidden>{icon}</span></div>
      <p className="text-xl font-bold text-text-primary">{value}</p>
    </div>
  )
}

function Assets({ t, toast }: { t: T; toast: Toast }) {
  const locale = useAdminLocale()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Asset>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/assets'); if (r.ok) { const d = await r.json(); setAssets(d.assets ?? []) } }
    catch { toast(t('am_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  function set<K extends keyof Asset>(k: K, v: Asset[K]) { setEditing(e => ({ ...e, [k]: v })) }
  async function save() {
    if (!editing.name.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/assets', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(t('am_saved'), 'success'); setModal(false); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('am_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function del(id: number) {
    if (!confirm(t('am_confirmDel'))) return
    try { const r = await fetch('/api/admin/erp/assets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (!r.ok) throw new Error(); toast(t('am_deleted'), 'success'); load() }
    catch { toast(t('am_saveFail'), 'error') }
  }

  const columns: Column<Asset>[] = [
    { key: 'name', labelEn: 'Name', labelFa: t('am_cName'), render: a => <div><div className="font-medium text-text-primary">{a.name}</div><div className="text-xs text-text-tertiary">{a.manufacturer || ''} {a.model || ''} {a.serial ? `· ${a.serial}` : ''}</div></div> },
    { key: 'category', labelEn: 'Category', labelFa: t('am_cCategory'), render: a => <span className="text-text-secondary text-xs">{a.category || '—'}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('am_cStatus'), type: 'enum', options: STATUSES.map(x => ({ value: x, labelEn: x, labelFa: x })), render: a => <Badge color={a.status === 'active' ? 'green' : a.status === 'retired' ? 'slate' : 'yellow'}>{t(`am_s_${a.status}` as 'am_s_active')}</Badge> },
    { key: 'bookValue', labelEn: 'Book', labelFa: t('am_cBook'), type: 'number', numeric: true, render: a => <span className="text-text-secondary text-xs">{money(a.bookValue)}</span> },
    { key: 'warranty', labelEn: 'Warranty', labelFa: t('am_cWarranty'), sortable: false, value: a => a.warranty?.state ?? 'none', render: a => a.warranty && a.warranty.state !== 'none' ? <Badge color={WCOLOR[a.warranty.state]}>{t(`am_w_${a.warranty.state}` as 'am_w_ok')}</Badge> : <span className="text-text-tertiary text-xs">—</span> },
    { key: 'employee', labelEn: 'Assigned', labelFa: t('am_cAssigned'), value: a => a.employee || a.assignedTo || '', render: a => <span className="text-text-secondary text-xs">{a.employee || a.assignedTo || '—'}</span> },
  ]
  const rowActions: RowAction<Asset>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('am_edit'), icon: '✎', onClick: a => { setEditing({ ...a }); setModal(true) } },
    { id: 'del', labelEn: 'Delete', labelFa: t('am_del'), icon: '🗑', danger: true, onClick: a => del(a.id!) },
  ]

  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('am_new')}</Btn></div>
      <Card className="p-4">
        <DataTable
          tableId="erp-assets"
          columns={columns}
          rows={assets}
          locale={locale}
          loading={loading}
          rowKey={a => String(a.id)}
          onRowClick={a => setDetailId(a.id!)}
          rowActions={rowActions}
          exportName="assets"
          emptyLabel={t('am_noAssets')}
        />
      </Card>

      <AssetForm t={t} open={modal} editing={editing} set={set} onClose={() => setModal(false)} onSave={save} saving={saving} />
      {detailId && <AssetDetail t={t} id={detailId} onClose={() => setDetailId(null)} toast={toast} onChange={load} />}
    </>
  )
}

function AssetForm({ t, open, editing, set, onClose, onSave, saving }: { t: T; open: boolean; editing: Asset; set: <K extends keyof Asset>(k: K, v: Asset[K]) => void; onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={editing.id ? t('am_editAsset') : t('am_new')} size="xl">
      <div className="space-y-5">
        <Section title={t('am_secIdentity')}>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('am_fName')} value={editing.name} onChange={v => set('name', v)} />
            <Select label={t('am_fType')} value={editing.type} onChange={v => set('type', v)} options={TYPES.map(x => ({ value: x, label: x }))} />
            <Input label={t('am_fCategory')} value={editing.category || ''} onChange={v => set('category', v)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('am_fManufacturer')} value={editing.manufacturer || ''} onChange={v => set('manufacturer', v)} />
            <Input label={t('am_fModel')} value={editing.model || ''} onChange={v => set('model', v)} />
            <Select label={t('am_fStatus')} value={editing.status} onChange={v => set('status', v)} options={STATUSES.map(x => ({ value: x, label: t(`am_s_${x}` as 'am_s_active') }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('am_fSerial')} value={editing.serial || ''} onChange={v => set('serial', v)} />
            <Input label={t('am_fBarcode')} value={editing.barcode || ''} onChange={v => set('barcode', v)} />
            <Input label={t('am_fVendor')} value={editing.vendor || ''} onChange={v => set('vendor', v)} />
          </div>
        </Section>
        <Section title={t('am_secFinancial')}>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('am_fPurchaseDate')} type="date" value={editing.purchaseDate || ''} onChange={v => set('purchaseDate', v)} />
            <Input label={t('am_fPurchasePrice')} type="number" value={String(editing.purchasePrice)} onChange={v => set('purchasePrice', Number(v) || 0)} />
            <Input label={t('am_fResidual')} type="number" value={String(editing.residualValue)} onChange={v => set('residualValue', Number(v) || 0)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('am_fLife')} type="number" value={String(editing.usefulLifeYears)} onChange={v => set('usefulLifeYears', Number(v) || 0)} />
            <Select label={t('am_fDepMethod')} value={editing.depreciationMethod} onChange={v => set('depreciationMethod', v)} options={DEP_METHODS.map(x => ({ value: x, label: t(`am_dm_${x}` as 'am_dm_none') }))} />
          </div>
        </Section>
        <Section title={t('am_secCoverage')}>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('am_fWarranty')} type="date" value={editing.warrantyExpiry || ''} onChange={v => set('warrantyExpiry', v)} />
            <Input label={t('am_fInsurancePolicy')} value={editing.insurancePolicy || ''} onChange={v => set('insurancePolicy', v)} />
            <Input label={t('am_fInsuranceExpiry')} type="date" value={editing.insuranceExpiry || ''} onChange={v => set('insuranceExpiry', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('am_fContract')} value={editing.contractRef || ''} onChange={v => set('contractRef', v)} />
            <Input label={t('am_fCalibration')} type="date" value={editing.calibrationDue || ''} onChange={v => set('calibrationDue', v)} />
          </div>
        </Section>
        <Section title={t('am_secAssignment')}>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('am_fLocation')} value={editing.location || ''} onChange={v => set('location', v)} />
            <Input label={t('am_fDepartment')} value={editing.department || ''} onChange={v => set('department', v)} />
            <Input label={t('am_fEmployee')} value={editing.employee || ''} onChange={v => set('employee', v)} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input label={t('am_fCostCenter')} value={editing.costCenter || ''} onChange={v => set('costCenter', v)} />
            <Input label={t('am_fProject')} value={editing.project || ''} onChange={v => set('project', v)} />
            <Input label={t('am_fGpsLat')} type="number" value={editing.gpsLat != null ? String(editing.gpsLat) : ''} onChange={v => set('gpsLat', v === '' ? null : Number(v))} />
            <Input label={t('am_fGpsLng')} type="number" value={editing.gpsLng != null ? String(editing.gpsLng) : ''} onChange={v => set('gpsLng', v === '' ? null : Number(v))} />
          </div>
        </Section>
        <Input label={t('am_fNotes')} value={editing.notes || ''} onChange={v => set('notes', v)} multiline rows={2} />
        <div className="flex gap-3">
          <Btn onClick={onSave} disabled={saving}>{saving ? t('am_saving') : t('am_save')}</Btn>
          <Btn variant="secondary" onClick={onClose}>{t('am_cancel')}</Btn>
        </div>
      </div>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function AssetDetail({ t, id, onClose, toast, onChange }: { t: T; id: number; onClose: () => void; toast: Toast; onChange: () => void }) {
  const [data, setData] = useState<{ asset: Asset; assignments: Assignment[]; maintenance: Maintenance[]; activity: Activity[] } | null>(null)
  const [assignForm, setAssignForm] = useState({ assignee: '', department: '', location: '', fromDate: '', note: '' })
  const [maintForm, setMaintForm] = useState({ type: 'maintenance', scheduledDate: '', vendor: '', cost: 0, note: '' })

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/erp/assets/lifecycle?id=${id}`); if (r.ok) setData(await r.json())
  }, [id])
  useEffect(() => { load() }, [load])

  async function addAssignment() {
    if (!assignForm.assignee.trim()) return
    const r = await fetch('/api/admin/erp/assets/lifecycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'assignment', assetId: id, ...assignForm }) })
    if (r.ok) { toast(t('am_saved'), 'success'); setAssignForm({ assignee: '', department: '', location: '', fromDate: '', note: '' }); load(); onChange() } else toast(t('am_saveFail'), 'error')
  }
  async function addMaint() {
    const r = await fetch('/api/admin/erp/assets/lifecycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'maintenance', assetId: id, status: 'scheduled', ...maintForm }) })
    if (r.ok) { toast(t('am_saved'), 'success'); setMaintForm({ type: 'maintenance', scheduledDate: '', vendor: '', cost: 0, note: '' }); load(); onChange() } else toast(t('am_saveFail'), 'error')
  }
  async function markDone(mid: number) {
    const r = await fetch('/api/admin/erp/assets/lifecycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'maintenance-done', id: mid, assetId: id }) })
    if (r.ok) { load(); onChange() }
  }

  const a = data?.asset
  return (
    <Modal open onClose={onClose} title={a ? a.name : t('am_loading')} size="xl">
      {!a ? <p className="text-sm text-text-tertiary">{t('am_loading')}</p> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Mini label={t('am_dPrice')} value={money(a.purchasePrice)} />
            <Mini label={t('am_dBook')} value={money(a.bookValue)} />
            <Mini label={t('am_dDep')} value={money(a.accumulatedDepreciation)} />
            <Mini label={t('am_dLife')} value={`${a.lifeUsedPct ?? 0}%`} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {a.warranty && a.warranty.state !== 'none' && <Badge color={WCOLOR[a.warranty.state]}>{t('am_warranty')}: {t(`am_w_${a.warranty.state}` as 'am_w_ok')}{a.warranty.days != null ? ` (${a.warranty.days}d)` : ''}</Badge>}
            {a.insurance && a.insurance.state !== 'none' && <Badge color={WCOLOR[a.insurance.state]}>{t('am_insurance')}: {t(`am_w_${a.insurance.state}` as 'am_w_ok')}</Badge>}
            {a.calibration && a.calibration.state !== 'none' && <Badge color={WCOLOR[a.calibration.state]}>{t('am_calibration')}: {t(`am_w_${a.calibration.state}` as 'am_w_ok')}</Badge>}
            {a.contractRef && <Badge color="slate">{t('am_contract')}: {a.contractRef}</Badge>}
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">{t('am_assignHistory')}</h4>
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {(data?.assignments ?? []).length === 0 ? <p className="text-xs text-text-tertiary">{t('am_noAssign')}</p> : data!.assignments.map(x => (
                  <div key={x.id} className="text-xs border border-subtle rounded p-2"><span className="text-text-secondary font-medium">{x.assignee}</span> <span className="text-text-tertiary">{x.department || ''} {x.fromDate || x.createdAt}</span></div>
                ))}
              </div>
              <div className="space-y-2 rounded-lg border border-subtle p-3">
                <Input label={t('am_fAssignee')} value={assignForm.assignee} onChange={v => setAssignForm(f => ({ ...f, assignee: v }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label={t('am_fDepartment')} value={assignForm.department} onChange={v => setAssignForm(f => ({ ...f, department: v }))} />
                  <Input label={t('am_fFromDate')} type="date" value={assignForm.fromDate} onChange={v => setAssignForm(f => ({ ...f, fromDate: v }))} />
                </div>
                <Btn size="sm" onClick={addAssignment}>{t('am_addAssignment')}</Btn>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">{t('am_maintHistory')}</h4>
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {(data?.maintenance ?? []).length === 0 ? <p className="text-xs text-text-tertiary">{t('am_noMaint')}</p> : data!.maintenance.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-xs border border-subtle rounded p-2">
                    <span className="text-text-secondary">{t(`am_mt_${m.type}` as 'am_mt_maintenance')} · {m.scheduledDate || m.createdAt}</span>
                    <div className="flex items-center gap-2">
                      <Badge color={m.status === 'done' ? 'green' : m.status === 'overdue' ? 'red' : 'yellow'}>{t(`am_ms_${m.status}` as 'am_ms_scheduled')}</Badge>
                      {m.status !== 'done' && <button onClick={() => markDone(m.id)} className="text-brand hover:underline">{t('am_markDone')}</button>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 rounded-lg border border-subtle p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select label={t('am_fMaintType')} value={maintForm.type} onChange={v => setMaintForm(f => ({ ...f, type: v }))} options={['maintenance', 'calibration', 'repair', 'inspection'].map(x => ({ value: x, label: t(`am_mt_${x}` as 'am_mt_maintenance') }))} />
                  <Input label={t('am_fScheduled')} type="date" value={maintForm.scheduledDate} onChange={v => setMaintForm(f => ({ ...f, scheduledDate: v }))} />
                </div>
                <Input label={t('am_fMaintVendor')} value={maintForm.vendor} onChange={v => setMaintForm(f => ({ ...f, vendor: v }))} />
                <Btn size="sm" onClick={addMaint}>{t('am_addMaint')}</Btn>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-2">{t('am_activity')}</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(data?.activity ?? []).length === 0 ? <p className="text-xs text-text-tertiary">{t('am_noActivity')}</p> : data!.activity.map(x => (
                <div key={x.id} className="flex items-start gap-2 text-xs">
                  <span className="text-text-disabled shrink-0 w-32 font-mono">{x.createdAt}</span>
                  <Badge color="slate">{x.action}</Badge>
                  <span className="text-text-secondary flex-1">{x.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-surface-2 border border-subtle p-3"><p className="text-2xs text-text-tertiary">{label}</p><p className="text-base font-bold text-text-primary">{value}</p></div>
}
