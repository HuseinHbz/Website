'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Product = { id: number; slug: string; nameEn: string; nameFa: string; type: string; icon: string; color: string; currentVersion: string | null; status: string; featured: boolean; active: boolean; sortOrder: number; taglineEn: string | null }

const TYPES = ['software', 'service', 'subscription', 'license', 'hardware', 'saas']
const STATUSES = ['active', 'beta', 'coming_soon', 'deprecated', 'archived']
const STATUS_COLORS: Record<string, string> = { active: 'green', beta: 'blue', coming_soon: 'yellow', deprecated: 'slate', archived: 'slate' }

export function ProductsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/products'); setProducts(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/products', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(t('failed'), 'error')
    setSaving(false)
  }

  const columns: Column<Product>[] = [
    { key: 'nameEn', labelEn: 'Product', labelFa: t('product'), render: p => <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${p.color}20`, border: `1px solid ${p.color}30` }}>{p.icon}</div><div><div className="font-medium text-text-primary">{p.nameEn}</div><div className="text-xs text-text-tertiary">{p.taglineEn}</div></div></div> },
    { key: 'type', labelEn: 'Type', labelFa: t('type'), type: 'enum', options: TYPES.map(tp => ({ value: tp, labelEn: tp, labelFa: tp })), render: p => <span className="text-text-secondary">{p.type}</span> },
    { key: 'currentVersion', labelEn: 'Version', labelFa: t('version'), render: p => <span className="text-text-secondary font-mono text-xs">{p.currentVersion || '—'}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('status'), type: 'enum', options: STATUSES.map(st => ({ value: st, labelEn: st, labelFa: st })), render: p => <Badge color={STATUS_COLORS[p.status] || 'slate'}>{p.status}</Badge> },
  ]
  const rowActions: RowAction<Product>[] = [{ id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: p => setEditing(p) }]

  return (
    <div>
      <ToastContainer />
      <PageHeader title={t('productsTitle')} subtitle={`${products.length} products & services`}
        action={<Btn onClick={() => setEditing({ type: 'service', icon: '📦', color: '#6366f1', status: 'active', active: true, featured: false, sortOrder: products.length + 1 })}>{t('addProduct')}</Btn>} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text-primary mb-4">{editing.id ? t('editProduct') : t('newProduct')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <Input label={t('nameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
              <Input label={t('nameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
              <div className="col-span-2"><Input label={t('taglineEn')} value={editing.taglineEn || ''} onChange={v => setEditing(e => ({ ...e, taglineEn: v }))} /></div>
              <Select label={t('type')} value={editing.type || 'service'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(tp => ({ value: tp, label: tp }))} />
              <Select label={t('status')} value={editing.status || 'active'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(st => ({ value: st, label: st }))} />
              <Input label="Icon" value={editing.icon || ''} onChange={v => setEditing(e => ({ ...e, icon: v }))} />
              <Input label={t('color')} value={editing.color || ''} onChange={v => setEditing(e => ({ ...e, color: v }))} />
              <Input label={t('currentVersion')} value={editing.currentVersion || ''} onChange={v => setEditing(e => ({ ...e, currentVersion: v }))} />
              <Input label="Sort Order" type="number" value={String(editing.sortOrder || 0)} onChange={v => setEditing(e => ({ ...e, sortOrder: parseInt(v) || 0 }))} />
              <div className="flex items-center gap-4 col-span-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"><input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} /> {t('activeLabel')}</label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"><input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} /> {t('featuredLabel')}</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6"><Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn></div>
          </div>
        </div>
      )}

      <Card>
        <DataTable
          tableId="products"
          columns={columns}
          rows={products}
          locale={locale}
          loading={loading}
          rowKey={p => String(p.id)}
          rowActions={rowActions}
          exportName="products"
          quickCreate={{ labelEn: 'Add Product', labelFa: t('addProduct'), onClick: () => setEditing({ type: 'service', icon: '📦', color: '#6366f1', status: 'active', active: true, featured: false, sortOrder: products.length + 1 }) }}
        />
      </Card>
    </div>
  )
}
