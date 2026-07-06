'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'

type Tab = 'dashboard' | 'products' | 'warehouses' | 'moves'
type StockStatus = 'out' | 'below_safety' | 'reorder' | 'ok' | 'overstock'

interface Product {
  id?: number; sku: string; barcode: string | null; nameEn: string; nameFa: string | null
  category: string; unit: string; cost?: number; price: number; valuationMethod: 'fifo' | 'lifo' | 'wavg'
  trackLot?: boolean; trackSerial?: boolean
  reorderPoint: number; minStock: number; maxStock: number; safetyStock: number; active: number | boolean
  onHand?: number; value?: number; avgCost?: number; status?: StockStatus
}
interface Warehouse { id?: number; code: string; nameEn: string; nameFa: string | null; branch: string | null; address: string | null; active: number | boolean; locationCount?: number }
interface Move { id: number; type: string; qty: number; unitCost: number; lot: string | null; serial: string | null; ref: string | null; note: string | null; createdAt: string; sku: string; productEn: string; productFa: string | null; warehouse: string }
interface Kpis { totalProducts: number; totalOnHand: number; totalValue: number; outOfStock: number; needReorder: number; overstock: number }
interface Overview { kpis: Kpis; lowStock: Product[]; recentMoves: Move[]; byWarehouse: { warehouse: string; nameEn: string; nameFa: string | null; onHand: number }[]; topValue: Product[] }

const STATUS_COLOR: Record<StockStatus, 'red' | 'yellow' | 'green' | 'blue' | 'slate'> = {
  out: 'red', below_safety: 'red', reorder: 'yellow', ok: 'green', overstock: 'blue',
}
const EMPTY_PRODUCT: Product = {
  sku: '', barcode: '', nameEn: '', nameFa: '', category: 'general', unit: 'pcs', cost: 0, price: 0,
  valuationMethod: 'wavg', trackLot: false, trackSerial: false, reorderPoint: 0, minStock: 0, maxStock: 0, safetyStock: 0, active: true,
}
const EMPTY_WH: Warehouse = { code: '', nameEn: '', nameFa: '', branch: '', address: '', active: true }
const MOVE_TYPES = ['receipt', 'issue', 'transfer', 'adjustment', 'return', 'count'] as const

function money(n: number | undefined): string { return n ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '$0' }

export function InventoryCenter() {
  const t = useT()
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('inv_title')} subtitle={t('inv_subtitle')} />
      <div className="flex gap-1 mb-6 border-b border-subtle overflow-x-auto">
        {(['dashboard', 'products', 'warehouses', 'moves'] as Tab[]).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === tb ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {t(`inv_tab_${tb}` as 'inv_tab_dashboard')}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard t={t} fa={fa} />}
      {tab === 'products' && <Products t={t} fa={fa} toast={toast} />}
      {tab === 'warehouses' && <Warehouses t={t} fa={fa} toast={toast} />}
      {tab === 'moves' && <Moves t={t} fa={fa} toast={toast} />}
    </>
  )
}

type T = ReturnType<typeof useT>
type Toast = ReturnType<typeof useToast>['toast']

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ t, fa }: { t: T; fa: boolean }) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/inventory/overview'); if (r.ok) setData(await r.json()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading && !data) return <p className="text-sm text-text-tertiary">{t('inv_loading')}</p>
  if (!data) return <Card className="p-5"><p className="text-sm text-text-tertiary">{t('inv_empty')}</p></Card>
  const k = data.kpis
  const maxWh = Math.max(1, ...data.byWarehouse.map(w => w.onHand))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label={t('inv_kpiProducts')} value={k.totalProducts.toLocaleString()} icon="📦" />
        <Kpi label={t('inv_kpiOnHand')} value={k.totalOnHand.toLocaleString()} icon="🔢" />
        <Kpi label={t('inv_kpiValue')} value={money(k.totalValue)} icon="💰" tone="ok" />
        <Kpi label={t('inv_kpiOut')} value={String(k.outOfStock)} icon="⛔" tone={k.outOfStock ? 'bad' : undefined} />
        <Kpi label={t('inv_kpiReorder')} value={String(k.needReorder)} icon="🔻" tone={k.needReorder ? 'warn' : undefined} />
        <Kpi label={t('inv_kpiOverstock')} value={String(k.overstock)} icon="🔺" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('inv_lowStock')}</h3>
          {data.lowStock.length === 0 ? <p className="text-xs text-text-tertiary">{t('inv_allHealthy')}</p> : (
            <div className="space-y-2">
              {data.lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary truncate">{fa ? (p.nameFa || p.nameEn) : p.nameEn} <span className="text-text-tertiary text-xs font-mono">{p.sku}</span></span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-text-tertiary">{p.onHand} {p.unit}</span>
                    <Badge color={STATUS_COLOR[p.status ?? 'ok']}>{t(`inv_st_${p.status}` as 'inv_st_ok')}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('inv_byWarehouse')}</h3>
          {data.byWarehouse.length === 0 ? <p className="text-xs text-text-tertiary">{t('inv_empty')}</p> : (
            <div className="space-y-3">
              {data.byWarehouse.map(w => (
                <div key={w.warehouse}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-text-secondary">{fa ? (w.nameFa || w.nameEn) : w.nameEn}</span><span className="text-text-tertiary">{w.onHand.toLocaleString()}</span></div>
                  <div className="h-2 rounded-full bg-sunken overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${(w.onHand / maxWh) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('inv_recentMoves')}</h3>
        {data.recentMoves.length === 0 ? <p className="text-xs text-text-tertiary">{t('inv_noMoves')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {[t('inv_colDate'), t('inv_colProduct'), t('inv_colType'), t('inv_colWarehouse'), t('inv_colQty')].map(h => <th key={h} className="px-3 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {data.recentMoves.map(m => (
                  <tr key={m.id} className="border-b border-subtle/50">
                    <td className="px-3 py-2 text-text-tertiary text-xs font-mono">{m.createdAt}</td>
                    <td className="px-3 py-2 text-text-secondary">{fa ? (m.productFa || m.productEn) : m.productEn}</td>
                    <td className="px-3 py-2"><Badge color="slate">{t(`inv_mt_${m.type}` as 'inv_mt_receipt')}</Badge></td>
                    <td className="px-3 py-2 text-text-tertiary text-xs">{m.warehouse}</td>
                    <td className={`px-3 py-2 text-xs font-medium ${m.qty < 0 ? 'text-danger' : 'text-success'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )
}

// ── Products ─────────────────────────────────────────────────────────────────
function Products({ t, fa, toast }: { t: T; fa: boolean; toast: Toast }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product>(EMPTY_PRODUCT)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/inventory/products'); if (r.ok) { const d = await r.json(); setProducts(d.products ?? []) } }
    catch { toast(t('inv_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  function set<K extends keyof Product>(k: K, v: Product[K]) { setEditing(e => ({ ...e, [k]: v })) }

  async function save() {
    if (!editing.sku.trim() || !editing.nameEn.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/inventory/products', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editing, active: !!editing.active }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(t('inv_saved'), 'success'); setModal(false); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('inv_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function del(id: number) {
    if (!confirm(t('inv_confirmDelProduct'))) return
    try { const r = await fetch('/api/admin/erp/inventory/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (!r.ok) throw new Error(); toast(t('inv_deleted'), 'success'); load() }
    catch { toast(t('inv_saveFail'), 'error') }
  }

  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { setEditing(EMPTY_PRODUCT); setModal(true) }}>{t('inv_newProduct')}</Btn></div>
      <Card className="p-0 overflow-hidden">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('inv_loading')}</p>
          : products.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('inv_noProducts')}</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {[t('inv_colProduct'), t('inv_colSku'), t('inv_colCategory'), t('inv_colOnHand'), t('inv_colAvgCost'), t('inv_colValue'), t('inv_colStatus'), t('inv_colActions')].map(h => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-subtle/50">
                    <td className="px-4 py-2.5"><div className="font-medium text-text-primary">{fa ? (p.nameFa || p.nameEn) : p.nameEn}</div><div className="text-xs text-text-tertiary">{p.barcode || '—'}</div></td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs font-mono">{p.sku}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{p.category}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{p.onHand} {p.unit}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{money(p.avgCost)}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{money(p.value)}</td>
                    <td className="px-4 py-2.5"><Badge color={STATUS_COLOR[p.status ?? 'ok']}>{t(`inv_st_${p.status}` as 'inv_st_ok')}</Badge></td>
                    <td className="px-4 py-2.5"><div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => { setEditing({ ...p, trackLot: !!p.trackLot, trackSerial: !!p.trackSerial, active: !!p.active }); setModal(true) }}>{t('inv_edit')}</Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(p.id!)}>{t('inv_del')}</Btn>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('inv_editProduct') : t('inv_newProduct')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('inv_fSku')} value={editing.sku} onChange={v => set('sku', v)} />
            <Input label={t('inv_fBarcode')} value={editing.barcode || ''} onChange={v => set('barcode', v)} />
            <Input label={t('inv_fCategory')} value={editing.category} onChange={v => set('category', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inv_fNameEn')} value={editing.nameEn} onChange={v => set('nameEn', v)} />
            <Input label={t('inv_fNameFa')} value={editing.nameFa || ''} onChange={v => set('nameFa', v)} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input label={t('inv_fUnit')} value={editing.unit} onChange={v => set('unit', v)} />
            <Input label={t('inv_fCost')} type="number" value={String(editing.cost ?? 0)} onChange={v => set('cost', Number(v) || 0)} />
            <Input label={t('inv_fPrice')} type="number" value={String(editing.price)} onChange={v => set('price', Number(v) || 0)} />
            <Select label={t('inv_fValuation')} value={editing.valuationMethod} onChange={v => set('valuationMethod', v as Product['valuationMethod'])} options={[{ value: 'wavg', label: t('inv_wavg') }, { value: 'fifo', label: 'FIFO' }, { value: 'lifo', label: 'LIFO' }]} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input label={t('inv_fReorder')} type="number" value={String(editing.reorderPoint)} onChange={v => set('reorderPoint', Number(v) || 0)} />
            <Input label={t('inv_fMin')} type="number" value={String(editing.minStock)} onChange={v => set('minStock', Number(v) || 0)} />
            <Input label={t('inv_fMax')} type="number" value={String(editing.maxStock)} onChange={v => set('maxStock', Number(v) || 0)} />
            <Input label={t('inv_fSafety')} type="number" value={String(editing.safetyStock)} onChange={v => set('safetyStock', Number(v) || 0)} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={!!editing.trackLot} onChange={e => set('trackLot', e.target.checked)} /> {t('inv_fTrackLot')}</label>
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={!!editing.trackSerial} onChange={e => set('trackSerial', e.target.checked)} /> {t('inv_fTrackSerial')}</label>
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={!!editing.active} onChange={e => set('active', e.target.checked)} /> {t('inv_fActive')}</label>
          </div>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('inv_saving') : t('inv_save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('inv_cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Warehouses ───────────────────────────────────────────────────────────────
function Warehouses({ t, fa, toast }: { t: T; fa: boolean; toast: Toast }) {
  const [items, setItems] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Warehouse>(EMPTY_WH)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/inventory/warehouses'); if (r.ok) { const d = await r.json(); setItems(d.warehouses ?? []) } }
    catch { toast(t('inv_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  function set<K extends keyof Warehouse>(k: K, v: Warehouse[K]) { setEditing(e => ({ ...e, [k]: v })) }
  async function save() {
    if (!editing.code.trim() || !editing.nameEn.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/inventory/warehouses', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editing, active: !!editing.active }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(t('inv_saved'), 'success'); setModal(false); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('inv_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function del(id: number) {
    if (!confirm(t('inv_confirmDelWh'))) return
    try { const r = await fetch('/api/admin/erp/inventory/warehouses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error); toast(t('inv_deleted'), 'success'); load() }
    catch (e) { toast(e instanceof Error ? e.message : t('inv_saveFail'), 'error') }
  }

  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { setEditing(EMPTY_WH); setModal(true) }}>{t('inv_newWarehouse')}</Btn></div>
      <Card className="p-0 overflow-hidden">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('inv_loading')}</p>
          : items.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('inv_noWarehouses')}</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {[t('inv_colWhCode'), t('inv_colWhName'), t('inv_colBranch'), t('inv_colLocations'), t('inv_colStatus'), t('inv_colActions')].map(h => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {items.map(w => (
                  <tr key={w.id} className="border-b border-subtle/50">
                    <td className="px-4 py-2.5 font-mono text-text-primary text-xs">{w.code}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{fa ? (w.nameFa || w.nameEn) : w.nameEn}</td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs">{w.branch || '—'}</td>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs">{w.locationCount ?? 0}</td>
                    <td className="px-4 py-2.5"><Badge color={w.active ? 'green' : 'slate'}>{w.active ? t('inv_active') : t('inv_inactive')}</Badge></td>
                    <td className="px-4 py-2.5"><div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => { setEditing({ ...w, active: !!w.active }); setModal(true) }}>{t('inv_edit')}</Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(w.id!)}>{t('inv_del')}</Btn>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('inv_editWarehouse') : t('inv_newWarehouse')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inv_fWhCode')} value={editing.code} onChange={v => set('code', v)} />
            <Input label={t('inv_fBranch')} value={editing.branch || ''} onChange={v => set('branch', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inv_fNameEn')} value={editing.nameEn} onChange={v => set('nameEn', v)} />
            <Input label={t('inv_fNameFa')} value={editing.nameFa || ''} onChange={v => set('nameFa', v)} />
          </div>
          <Input label={t('inv_fAddress')} value={editing.address || ''} onChange={v => set('address', v)} multiline rows={2} />
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={!!editing.active} onChange={e => set('active', e.target.checked)} /> {t('inv_fActive')}</label>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('inv_saving') : t('inv_save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('inv_cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Stock Moves ──────────────────────────────────────────────────────────────
function Moves({ t, fa, toast }: { t: T; fa: boolean; toast: Toast }) {
  const [moves, setMoves] = useState<Move[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ productId: 0, type: 'receipt' as string, warehouseId: 0, toWarehouseId: 0, qty: 0, unitCost: 0, lot: '', serial: '', ref: '', note: '' })
  const [posting, setPosting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, p, w] = await Promise.all([
        fetch('/api/admin/erp/inventory/moves').then(r => r.json()),
        fetch('/api/admin/erp/inventory/products').then(r => r.json()),
        fetch('/api/admin/erp/inventory/warehouses').then(r => r.json()),
      ])
      setMoves(m.moves ?? []); setProducts(p.products ?? []); setWarehouses(w.warehouses ?? [])
    } catch { toast(t('inv_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  async function post() {
    if (!form.productId || !form.warehouseId || form.qty <= 0) { toast(t('inv_moveInvalid'), 'error'); return }
    setPosting(true)
    try {
      const body: Record<string, unknown> = { productId: form.productId, type: form.type, warehouseId: form.warehouseId, qty: form.qty, unitCost: form.unitCost, lot: form.lot || undefined, serial: form.serial || undefined, ref: form.ref || undefined, note: form.note || undefined }
      if (form.type === 'transfer') body.toWarehouseId = form.toWarehouseId
      const r = await fetch('/api/admin/erp/inventory/moves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      toast(t('inv_movePosted'), 'success')
      setForm(f => ({ ...f, qty: 0, unitCost: 0, lot: '', serial: '', ref: '', note: '' })); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('inv_saveFail'), 'error') } finally { setPosting(false) }
  }

  const pOpts = products.map(p => ({ value: String(p.id), label: `${p.sku} — ${fa ? (p.nameFa || p.nameEn) : p.nameEn}` }))
  const wOpts = warehouses.map(w => ({ value: String(w.id), label: `${w.code} — ${fa ? (w.nameFa || w.nameEn) : w.nameEn}` }))

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="p-5 lg:col-span-1 h-fit">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('inv_postMove')}</h3>
        <div className="space-y-3">
          <Select label={t('inv_fProduct')} value={String(form.productId)} onChange={v => setForm(f => ({ ...f, productId: Number(v) }))} options={[{ value: '0', label: t('inv_selectProduct') }, ...pOpts]} />
          <Select label={t('inv_fType')} value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} options={MOVE_TYPES.map(mt => ({ value: mt, label: t(`inv_mt_${mt}` as 'inv_mt_receipt') }))} />
          <Select label={form.type === 'transfer' ? t('inv_fFromWarehouse') : t('inv_fWarehouse')} value={String(form.warehouseId)} onChange={v => setForm(f => ({ ...f, warehouseId: Number(v) }))} options={[{ value: '0', label: t('inv_selectWarehouse') }, ...wOpts]} />
          {form.type === 'transfer' && <Select label={t('inv_fToWarehouse')} value={String(form.toWarehouseId)} onChange={v => setForm(f => ({ ...f, toWarehouseId: Number(v) }))} options={[{ value: '0', label: t('inv_selectWarehouse') }, ...wOpts]} />}
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('inv_fQty')} type="number" value={String(form.qty)} onChange={v => setForm(f => ({ ...f, qty: Number(v) || 0 }))} />
            <Input label={t('inv_fUnitCost')} type="number" value={String(form.unitCost)} onChange={v => setForm(f => ({ ...f, unitCost: Number(v) || 0 }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('inv_fLot')} value={form.lot} onChange={v => setForm(f => ({ ...f, lot: v }))} />
            <Input label={t('inv_fSerial')} value={form.serial} onChange={v => setForm(f => ({ ...f, serial: v }))} />
          </div>
          <Input label={t('inv_fRef')} value={form.ref} onChange={v => setForm(f => ({ ...f, ref: v }))} />
          <Input label={t('inv_fNote')} value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} multiline rows={2} />
          <Btn onClick={post} disabled={posting}>{posting ? t('inv_posting') : t('inv_postMove')}</Btn>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden lg:col-span-2">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('inv_loading')}</p>
          : moves.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('inv_noMoves')}</p>
          : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-text-tertiary text-left border-b border-subtle">
                {[t('inv_colDate'), t('inv_colProduct'), t('inv_colType'), t('inv_colWarehouse'), t('inv_colQty'), t('inv_colUnitCost'), t('inv_colRef')].map(h => <th key={h} className="px-3 py-2 text-xs font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {moves.map(m => (
                  <tr key={m.id} className="border-b border-subtle/50">
                    <td className="px-3 py-2 text-text-tertiary text-xs font-mono">{m.createdAt}</td>
                    <td className="px-3 py-2 text-text-secondary text-xs">{fa ? (m.productFa || m.productEn) : m.productEn}</td>
                    <td className="px-3 py-2"><Badge color="slate">{t(`inv_mt_${m.type}` as 'inv_mt_receipt')}</Badge></td>
                    <td className="px-3 py-2 text-text-tertiary text-xs">{m.warehouse}</td>
                    <td className={`px-3 py-2 text-xs font-medium ${m.qty < 0 ? 'text-danger' : 'text-success'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
                    <td className="px-3 py-2 text-text-tertiary text-xs">{money(m.unitCost)}</td>
                    <td className="px-3 py-2 text-text-tertiary text-xs">{m.ref || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
