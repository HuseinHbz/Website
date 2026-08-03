'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { deleteRowAction } from '@/lib/admin/rowDelete'

type Testimonial = {
  id: number
  clientName: string
  clientTitle: string | null
  clientCompany: string | null
  quoteEn: string
  quoteFa: string | null
  rating: number
  solutionSlug: string | null
  featured: boolean
  active: boolean
  sortOrder: number
}

export function TestimonialsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Testimonial> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/testimonials')
    setTestimonials(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/testimonials', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) {
      toast(editing.id ? t('updated') : t('created'), 'success')
      setEditing(null)
      load()
    } else {
      toast(t('saveFailed'), 'error')
    }
    setSaving(false)
  }

  async function toggle(t: Testimonial) {
    await fetch('/api/admin/testimonials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, active: !t.active }) })
    load()
  }

  const columns: Column<Testimonial>[] = [
    { key: 'clientName', labelEn: 'Client', labelFa: t('client'), render: t2 => <div><div className="font-medium text-text-primary">{t2.clientName}</div><div className="text-xs text-text-tertiary">{t2.clientTitle} · {t2.clientCompany}</div></div> },
    { key: 'quoteEn', labelEn: 'Quote', labelFa: t('quote'), render: t2 => <span className="text-text-secondary">{t2.quoteEn}</span> },
    { key: 'rating', labelEn: 'Rating', labelFa: t('rating'), type: 'number', numeric: true, render: t2 => <span className="text-yellow-400">{'★'.repeat(t2.rating)}</span> },
    { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: t2 => t2.active, render: t2 => <><Badge color={t2.active ? 'green' : 'slate'}>{t2.active ? t('active') : t('inactive')}</Badge>{t2.featured && <> <Badge color="yellow">{t('featuredLabel')}</Badge></>}</> },
  ]
  const rowActions: RowAction<Testimonial>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: t2 => setEditing(t2) },
    { id: 'toggle', labelEn: 'Toggle', labelFa: t('disable'), icon: '⇄', onClick: t2 => toggle(t2) },
    // 26.33 BUG-205: the DELETE API always worked; this manager simply
    // never rendered a Delete affordance, so there was nothing to click.
    deleteRowAction<Testimonial>({ path: '/api/admin/testimonials', fa: locale === 'fa', toast, reload: load, labelOf: r => String(r.clientName ?? '') }),
  ]

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t('testimonialsTitle')}
        subtitle={`${testimonials.length} testimonials`}
        action={<Btn onClick={() => setEditing({ rating: 5, active: true, featured: false, sortOrder: testimonials.length + 1 })}>{t('addTestimonial')}</Btn>}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text-primary mb-4">{editing.id ? t('editTestimonial') : t('newTestimonial')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('clientName')} value={editing.clientName || ''} onChange={v => setEditing(e => ({ ...e, clientName: v }))} />
              <Input label={t('clientTitle')} value={editing.clientTitle || ''} onChange={v => setEditing(e => ({ ...e, clientTitle: v }))} />
              <div className="col-span-2"><Input label={t('company')} value={editing.clientCompany || ''} onChange={v => setEditing(e => ({ ...e, clientCompany: v }))} /></div>
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('quoteEn')}</label>
                <textarea value={editing.quoteEn || ''} onChange={e2 => setEditing(e => ({ ...e, quoteEn: e2.target.value }))} rows={3}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('quoteFa')}</label>
                <textarea value={editing.quoteFa || ''} onChange={e2 => setEditing(e => ({ ...e, quoteFa: e2.target.value }))} rows={3}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none" dir="rtl" />
              </div>
              <Input label={t('rating')} type="number" value={String(editing.rating || 5)} onChange={v => setEditing(e => ({ ...e, rating: Math.min(5, Math.max(1, parseInt(v) || 5)) }))} />
              <Input label={t('solutionSlug')} value={editing.solutionSlug || ''} onChange={v => setEditing(e => ({ ...e, solutionSlug: v }))} />
              <div className="flex items-center gap-4 col-span-2 pt-2">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.active} onChange={e2 => setEditing(e => ({ ...e, active: e2.target.checked }))} />
                  {t('activeLabel')}
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} />
                  Featured
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
              <Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn>
            </div>
          </div>
        </div>
      )}

      <Card>
        <DataTable
          tableId="testimonials"
          columns={columns}
          rows={testimonials}
          locale={locale}
          loading={loading}
          rowKey={t2 => String(t2.id)}
          rowActions={rowActions}
          exportName="testimonials"
          quickCreate={{ labelEn: 'Add Testimonial', labelFa: t('addTestimonial'), onClick: () => setEditing({ rating: 5, active: true, featured: false, sortOrder: testimonials.length + 1 }) }}
        />
      </Card>
    </div>
  )
}
