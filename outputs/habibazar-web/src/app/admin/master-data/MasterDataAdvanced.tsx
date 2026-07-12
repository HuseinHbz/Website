'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Badge, Input } from '@/components/admin/ui'
import { DataTable, type RowAction } from '@/components/admin/DataTable'

const L = (fa: boolean, en: string, faT: string) => (fa ? faT : en)
type Toast = (m: string, k?: 'success' | 'error') => void
const post = (module: string, action: string, payload: Record<string, unknown> = {}) =>
  fetch('/api/admin/erp/master-data/advanced', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module, action, payload }) })

const scoreColor = (s: number) => (s >= 95 ? 'text-success' : s >= 85 ? 'text-brand' : s >= 70 ? 'text-warning' : 'text-danger')

// ── M1: Category tree ────────────────────────────────────────────────────────
interface CatNode { id: number; parentId: number | null; code: string; nameEn: string; nameFa?: string | null; level: number; active: number; children: CatNode[]; productCount?: number }
interface CatFlat { id: number; nameEn: string; active: number }
export function CategoriesTab({ fa, toast, canAdmin }: { fa: boolean; toast: Toast; canAdmin: boolean }) {
  const [tree, setTree] = useState<CatNode[]>([])
  const [flat, setFlat] = useState<CatFlat[]>([])
  const [stats, setStats] = useState<{ total: number; roots: number; maxDepth: number; leaves: number } | null>(null)
  const [form, setForm] = useState({ code: '', nameEn: '', nameFa: '', parentId: '' })
  const load = useCallback(() => {
    fetch('/api/admin/erp/master-data/advanced?module=categories').then(r => r.json()).then(d => { setTree(d.tree ?? []); setFlat((d.flat ?? []).filter((c: CatFlat) => c.active === 1)); setStats(d.stats ?? null) }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    if (!form.code.trim() || !form.nameEn.trim()) { toast(L(fa, 'Code and English name are required', 'کد و نام انگلیسی الزامی است'), 'error'); return }
    const r = await post('categories', 'create', { code: form.code.trim(), nameEn: form.nameEn.trim(), nameFa: form.nameFa.trim() || undefined, parentId: form.parentId ? Number(form.parentId) : null })
    if (r.ok) { toast(L(fa, 'Category created', 'دسته ساخته شد'), 'success'); setForm({ code: '', nameEn: '', nameFa: '', parentId: '' }); load() }
    else toast((await r.json().catch(() => ({}))).error || L(fa, 'Failed', 'ناموفق'), 'error')
  }
  async function move(node: CatNode) {
    const pid = window.prompt(L(fa, `New parent category id for "${node.nameEn}" (blank = root):`, `شناسه دستهٔ والد جدید برای «${node.nameEn}» (خالی = ریشه):`))
    if (pid === null) return
    const r = await post('categories', 'move', { id: node.id, parentId: pid.trim() ? Number(pid) : null })
    if (r.ok) { toast(L(fa, 'Moved', 'منتقل شد'), 'success'); load() } else toast((await r.json().catch(() => ({}))).error || L(fa, 'Move failed', 'انتقال ناموفق'), 'error')
  }
  async function archive(node: CatNode) {
    const r = await post('categories', 'archive', { id: node.id })
    if (r.ok) { toast(L(fa, 'Archived', 'بایگانی شد'), 'success'); load() } else toast((await r.json().catch(() => ({}))).error || L(fa, 'Archive failed', 'بایگانی ناموفق'), 'error')
  }
  async function migrate() {
    const r = await post('categories', 'migrate')
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L(fa, `Migrated: ${d.created} created, ${d.linked} linked`, `انتقال: ${d.created} ساخته، ${d.linked} متصل`), 'success'); load() } else toast(d.error || L(fa, 'Migration failed', 'ناموفق'), 'error')
  }
  const rows: CatNode[] = []
  const flatten = (ns: CatNode[]) => ns.forEach(n => { rows.push(n); flatten(n.children) })
  flatten(tree)

  return (
    <div className="space-y-4">
      {stats && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Categories', 'دسته‌ها')}</p><p className="text-xl font-bold text-text-primary">{stats.total}</p></Card>
        <Card><p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Root nodes', 'گره ریشه')}</p><p className="text-xl font-bold text-text-primary">{stats.roots}</p></Card>
        <Card><p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Max depth', 'بیشترین عمق')}</p><p className="text-xl font-bold text-text-primary">{stats.maxDepth}</p></Card>
        <Card><p className="text-2xs text-text-tertiary mb-1">{L(fa, 'Leaves', 'برگ‌ها')}</p><p className="text-xl font-bold text-text-primary">{stats.leaves}</p></Card>
      </div>}
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'New category', 'دستهٔ جدید')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <Input label={L(fa, 'Code', 'کد')} value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} />
          <Input label={L(fa, 'Name (EN)', 'نام انگلیسی')} value={form.nameEn} onChange={v => setForm(f => ({ ...f, nameEn: v }))} />
          <Input label={L(fa, 'Name (FA)', 'نام فارسی')} value={form.nameFa} onChange={v => setForm(f => ({ ...f, nameFa: v }))} />
          <div>
            <label className="block text-2xs text-text-tertiary mb-1">{L(fa, 'Parent', 'والد')}</label>
            <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} className="form-input !py-1.5 text-xs w-full">
              <option value="">{L(fa, '— root —', '— ریشه —')}</option>
              {flat.map(c => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
            </select>
          </div>
          <Btn size="sm" onClick={create}>{L(fa, '+ Add', '+ افزودن')}</Btn>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Category tree', 'درخت دسته‌بندی')}</h3>
          {canAdmin && <Btn size="sm" variant="secondary" onClick={migrate}>{L(fa, 'Migrate legacy categories', 'انتقال دسته‌های قدیمی')}</Btn>}
        </div>
        <DataTable tableId="md-categories" locale={fa ? 'fa' : 'en'} rows={rows} rowKey={(n: CatNode) => String(n.id)}
          columns={[
            { key: 'nameEn', labelEn: 'Category', labelFa: 'دسته', render: (n: CatNode) => <span style={{ paddingInlineStart: `${n.level * 16}px` }} className="text-text-secondary text-xs">{n.level > 0 ? '└ ' : ''}{fa ? (n.nameFa || n.nameEn) : n.nameEn}{n.active === 0 && <span className="text-text-tertiary"> ({L(fa, 'archived', 'بایگانی')})</span>}</span> },
            { key: 'code', labelEn: 'Code', labelFa: 'کد', render: (n: CatNode) => <span className="font-mono text-2xs text-text-tertiary">{n.code}</span> },
            { key: 'productCount', labelEn: 'Products', labelFa: 'کالاها', numeric: true, render: (n: CatNode) => <span className="text-text-tertiary">{n.productCount ?? 0}</span> },
          ]}
          rowActions={[
            { id: 'move', labelEn: 'Move', labelFa: 'انتقال', icon: '⇅', onClick: move },
            { id: 'archive', labelEn: 'Archive', labelFa: 'بایگانی', icon: '📦', danger: true, hidden: (n: CatNode) => n.active === 0, onClick: archive },
          ] as RowAction<CatNode>[]}
          emptyLabel={L(fa, 'No categories yet — add one or migrate legacy categories.', 'دسته‌ای نیست — بسازید یا دسته‌های قدیمی را منتقل کنید.')} />
      </Card>
    </div>
  )
}

// ── M7: Quality dimensions ───────────────────────────────────────────────────
interface Dim { dimension: string; score: number; issues: number }
interface DomainDims { domain: string; dimensions: Dim[]; score: number }
const DOMAIN_L: Record<string, [string, string]> = { customers: ['Customers', 'مشتریان'], suppliers: ['Suppliers', 'تأمین‌کنندگان'], products: ['Products', 'کالاها'] }
export function QualityTab({ fa }: { fa: boolean }) {
  const [domains, setDomains] = useState<DomainDims[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/admin/erp/master-data/advanced?module=dimensions').then(r => r.json()).then(d => setDomains(d.domains ?? [])).finally(() => setLoading(false)) }, [])
  if (loading) return <Card><p className="text-xs text-text-tertiary">{L(fa, 'Loading…', 'در حال بارگذاری…')}</p></Card>
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {domains.map(d => (
        <Card key={d.domain}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{L(fa, DOMAIN_L[d.domain]?.[0] ?? d.domain, DOMAIN_L[d.domain]?.[1] ?? d.domain)}</h3>
            <span className={`text-lg font-bold ${scoreColor(d.score)}`}>{d.score}%</span>
          </div>
          <div className="space-y-1.5">
            {d.dimensions.map(dim => (
              <div key={dim.dimension}>
                <div className="flex justify-between text-2xs text-text-secondary mb-0.5"><span className="capitalize">{dim.dimension}</span><span>{dim.score}%{dim.issues > 0 && <span className="text-text-tertiary"> ({dim.issues})</span>}</span></div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden"><div className={`h-full ${dim.score >= 85 ? 'bg-success' : dim.score >= 70 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${dim.score}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── M5: Data-steward issue queue ─────────────────────────────────────────────
interface Issue { id: number; issueKey: string; entityType: string; titleEn: string; titleFa: string | null; severity: string; status: string; assignedTo: string | null }
export function StewardTab({ fa, toast }: { fa: boolean; toast: Toast }) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [status, setStatus] = useState('open')
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => { setLoading(true); fetch(`/api/admin/erp/master-data/advanced?module=issues&status=${status}`).then(r => r.json()).then(d => setIssues(d.issues ?? [])).finally(() => setLoading(false)) }, [status])
  useEffect(() => { load() }, [load])
  async function act(i: Issue, action: 'assign' | 'resolve' | 'ignore') {
    const value = action === 'assign' ? window.prompt(L(fa, 'Assign to (name/email):', 'واگذاری به (نام/ایمیل):')) : window.prompt(L(fa, 'Note:', 'یادداشت:'))
    if (value === null) return
    const r = await post('issues', action, { id: i.id, value })
    if (r.ok) { toast(L(fa, 'Updated', 'به‌روزرسانی شد'), 'success'); load() } else toast(L(fa, 'Failed', 'ناموفق'), 'error')
  }
  async function generate() {
    const r = await post('issues', 'generate'); const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L(fa, `${d.created} issue(s) generated`, `${d.created} مورد ایجاد شد`), 'success'); load() } else toast(L(fa, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Data steward — issue queue', 'میز داده — صف مسائل')}</h3>
        <div className="flex gap-2">
          <select value={status} onChange={e => setStatus(e.target.value)} className="form-input !py-1.5 text-xs">
            {['open', 'in_progress', 'resolved', 'ignored', 'all'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Btn size="sm" onClick={generate}>{L(fa, 'Scan & generate', 'اسکن و ایجاد')}</Btn>
        </div>
      </div>
      <DataTable tableId="md-issues" locale={fa ? 'fa' : 'en'} rows={issues} loading={loading} rowKey={(i: Issue) => String(i.id)}
        columns={[
          { key: 'severity', labelEn: 'Severity', labelFa: 'شدت', render: (i: Issue) => <Badge color={i.severity === 'error' ? 'danger' : i.severity === 'warning' ? 'warning' : 'default'}>{i.severity}</Badge> },
          { key: 'titleEn', labelEn: 'Issue', labelFa: 'مسئله', render: (i: Issue) => <span className="text-text-secondary text-xs">{fa ? (i.titleFa || i.titleEn) : i.titleEn}</span> },
          { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', render: (i: Issue) => <Badge color={i.status === 'resolved' ? 'success' : i.status === 'ignored' ? 'default' : 'brand'}>{i.status}</Badge> },
          { key: 'assignedTo', labelEn: 'Assignee', labelFa: 'مسئول', render: (i: Issue) => <span className="text-2xs text-text-tertiary">{i.assignedTo ?? '—'}</span> },
        ]}
        rowActions={[
          { id: 'assign', labelEn: 'Assign', labelFa: 'واگذاری', icon: '👤', hidden: (i: Issue) => i.status === 'resolved' || i.status === 'ignored', onClick: (i: Issue) => act(i, 'assign') },
          { id: 'resolve', labelEn: 'Resolve', labelFa: 'حل شد', icon: '✓', hidden: (i: Issue) => i.status === 'resolved', onClick: (i: Issue) => act(i, 'resolve') },
          { id: 'ignore', labelEn: 'Ignore', labelFa: 'نادیده', icon: '✕', danger: true, hidden: (i: Issue) => i.status === 'ignored', onClick: (i: Issue) => act(i, 'ignore') },
        ] as RowAction<Issue>[]}
        emptyLabel={L(fa, 'No issues — run "Scan & generate".', 'موردی نیست — «اسکن و ایجاد» را بزنید.')} />
    </Card>
  )
}

// ── M2 + M3: Product master (alternative suppliers + version history) ─────────
interface PickRow { id: number; sku: string; nameEn: string; nameFa: string | null }
interface RankedSup { id: number; supplierId: number; supplierName?: string; purchasePrice: number; leadTimeDays: number; qualityScore: number; deliveryScore: number; score: number; grade: string; rank: number; isPrimary?: number }
interface Vendor { id: number; name: string }
interface Hist { id: number; version: number; newValue: string | null; changedBy: string | null; changeReason: string | null; createdAt: string }
export function ProductMasterTab({ fa, toast, canAdmin }: { fa: boolean; toast: Toast; canAdmin: boolean }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PickRow[]>([])
  const [sel, setSel] = useState<PickRow | null>(null)
  const [sups, setSups] = useState<RankedSup[]>([])
  const [best, setBest] = useState<RankedSup | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [hist, setHist] = useState<Hist[]>([])
  const [addF, setAddF] = useState({ supplierId: '', purchasePrice: '', leadTimeDays: '', qualityScore: '', deliveryScore: '' })

  useEffect(() => { if (!q.trim()) { setResults([]); return } const t = setTimeout(() => { fetch(`/api/admin/erp/inventory/products?picker=1&q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => setResults(d.products ?? [])).catch(() => {}) }, 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { fetch('/api/admin/erp/purchasing?view=vendors').then(r => r.json()).then(d => setVendors(d.vendors ?? [])).catch(() => {}) }, [])
  const loadProduct = useCallback((p: PickRow) => {
    setSel(p); setResults([]); setQ('')
    fetch(`/api/admin/erp/master-data/advanced?module=suppliers&productId=${p.id}`).then(r => r.json()).then(d => { setSups(d.suppliers ?? []); setBest(d.best ?? null) }).catch(() => {})
    fetch(`/api/admin/erp/master-data/advanced?module=versions&entityType=product&entityId=${p.id}`).then(r => r.json()).then(d => setHist(d.history ?? [])).catch(() => {})
  }, [])
  const reload = () => sel && loadProduct(sel)

  async function addSupplier() {
    if (!sel || !addF.supplierId) { toast(L(fa, 'Pick a supplier', 'یک تأمین‌کننده انتخاب کنید'), 'error'); return }
    const r = await post('suppliers', 'add', { productId: sel.id, supplierId: Number(addF.supplierId), purchasePrice: Number(addF.purchasePrice || 0), leadTimeDays: Number(addF.leadTimeDays || 0), qualityScore: Number(addF.qualityScore || 0), deliveryScore: Number(addF.deliveryScore || 0) })
    if (r.ok) { toast(L(fa, 'Supplier linked', 'تأمین‌کننده افزوده شد'), 'success'); setAddF({ supplierId: '', purchasePrice: '', leadTimeDays: '', qualityScore: '', deliveryScore: '' }); reload() } else toast(L(fa, 'Failed', 'ناموفق'), 'error')
  }
  async function setPrimary(s: RankedSup) { const r = await post('suppliers', 'setPrimary', { productId: sel!.id, supplierId: s.supplierId }); if (r.ok) { toast(L(fa, 'Primary set', 'اصلی شد'), 'success'); reload() } }
  async function remove(s: RankedSup) { const r = await post('suppliers', 'remove', { id: s.id }); if (r.ok) { toast(L(fa, 'Removed', 'حذف شد'), 'success'); reload() } }
  async function restore(h: Hist) { const r = await post('versions', 'restore', { historyId: h.id }); if (r.ok) { toast(L(fa, 'Restored', 'بازیابی شد'), 'success'); reload() } else toast((await r.json().catch(() => ({}))).error || L(fa, 'Restore failed', 'ناموفق'), 'error') }

  return (
    <div className="space-y-4">
      <Card>
        <label className="block text-2xs text-text-tertiary mb-1">{L(fa, 'Find a product (SKU / name)', 'جستجوی کالا (SKU/نام)')}</label>
        <div className="relative max-w-md">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={L(fa, 'Search…', 'جستجو…')} className="form-input !py-1.5 text-xs w-full" />
          {results.length > 0 && <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-subtle bg-surface-2 shadow-lg">
            {results.map(p => <button key={p.id} type="button" onClick={() => loadProduct(p)} className="block w-full text-start px-3 py-1.5 text-xs text-text-secondary hover:bg-surface"><span className="font-mono text-text-tertiary">{p.sku}</span> · {fa ? (p.nameFa || p.nameEn) : p.nameEn}</button>)}
          </div>}
        </div>
        {sel && <p className="mt-2 text-sm font-semibold text-text-primary">{sel.sku} — {fa ? (sel.nameFa || sel.nameEn) : sel.nameEn}</p>}
      </Card>

      {sel && <>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Alternative suppliers', 'تأمین‌کنندگان جایگزین')}</h3>
            {best && <Badge color="success">{L(fa, 'Best', 'بهترین')}: {best.supplierName} ({best.score})</Badge>}
          </div>
          <DataTable tableId="md-prod-suppliers" locale={fa ? 'fa' : 'en'} rows={sups} rowKey={(s: RankedSup) => String(s.id)}
            columns={[
              { key: 'rank', labelEn: '#', labelFa: 'رتبه', render: (s: RankedSup) => <span className="text-text-tertiary">{s.rank}</span> },
              { key: 'supplierName', labelEn: 'Supplier', labelFa: 'تأمین‌کننده', render: (s: RankedSup) => <span className="text-text-secondary text-xs">{s.supplierName}{s.isPrimary ? ' ★' : ''}</span> },
              { key: 'purchasePrice', labelEn: 'Price', labelFa: 'قیمت', numeric: true, render: (s: RankedSup) => <span className="text-text-tertiary">{s.purchasePrice.toLocaleString()}</span> },
              { key: 'leadTimeDays', labelEn: 'Lead (d)', labelFa: 'تحویل (روز)', numeric: true, render: (s: RankedSup) => <span className="text-text-tertiary">{s.leadTimeDays}</span> },
              { key: 'score', labelEn: 'Score', labelFa: 'امتیاز', numeric: true, render: (s: RankedSup) => <Badge color={s.grade === 'A' ? 'success' : s.grade === 'B' ? 'brand' : s.grade === 'C' ? 'warning' : 'danger'}>{s.score} {s.grade}</Badge> },
            ]}
            rowActions={[
              { id: 'primary', labelEn: 'Set primary', labelFa: 'اصلی کن', icon: '★', hidden: (s: RankedSup) => !!s.isPrimary, onClick: setPrimary },
              { id: 'remove', labelEn: 'Remove', labelFa: 'حذف', icon: '✕', danger: true, onClick: remove },
            ] as RowAction<RankedSup>[]}
            emptyLabel={L(fa, 'No suppliers linked yet.', 'تأمین‌کننده‌ای متصل نیست.')} />
          <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">{L(fa, 'Supplier', 'تأمین‌کننده')}</label>
              <select value={addF.supplierId} onChange={e => setAddF(f => ({ ...f, supplierId: e.target.value }))} className="form-input !py-1.5 text-xs w-full">
                <option value="">—</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <Input label={L(fa, 'Price', 'قیمت')} value={addF.purchasePrice} onChange={v => setAddF(f => ({ ...f, purchasePrice: v }))} />
            <Input label={L(fa, 'Lead days', 'روز تحویل')} value={addF.leadTimeDays} onChange={v => setAddF(f => ({ ...f, leadTimeDays: v }))} />
            <Input label={L(fa, 'Quality', 'کیفیت')} value={addF.qualityScore} onChange={v => setAddF(f => ({ ...f, qualityScore: v }))} />
            <Input label={L(fa, 'Delivery', 'تحویل')} value={addF.deliveryScore} onChange={v => setAddF(f => ({ ...f, deliveryScore: v }))} />
            <Btn size="sm" onClick={addSupplier}>{L(fa, '+ Link', '+ افزودن')}</Btn>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Version history', 'تاریخچهٔ نسخه‌ها')}</h3>
          <DataTable tableId="md-prod-history" locale={fa ? 'fa' : 'en'} rows={hist} rowKey={(h: Hist) => String(h.id)}
            columns={[
              { key: 'version', labelEn: 'Ver', labelFa: 'نسخه', render: (h: Hist) => <span className="font-mono text-text-tertiary">v{h.version}</span> },
              { key: 'newValue', labelEn: 'Snapshot', labelFa: 'مقادیر', render: (h: Hist) => <span className="text-2xs text-text-tertiary font-mono">{(h.newValue ?? '').slice(0, 80)}</span> },
              { key: 'changedBy', labelEn: 'By', labelFa: 'توسط', render: (h: Hist) => <span className="text-2xs text-text-tertiary">{h.changedBy ?? '—'}</span> },
              { key: 'createdAt', labelEn: 'When', labelFa: 'زمان', render: (h: Hist) => <span className="text-2xs text-text-tertiary">{h.createdAt}</span> },
            ]}
            rowActions={canAdmin ? [{ id: 'restore', labelEn: 'Restore', labelFa: 'بازیابی', icon: '↺', onClick: restore } as RowAction<Hist>] : []}
            emptyLabel={L(fa, 'No changes recorded yet.', 'تغییری ثبت نشده است.')} />
        </Card>
      </>}
    </div>
  )
}
