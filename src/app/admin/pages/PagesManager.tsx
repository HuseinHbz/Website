'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { SECTION_TYPE_MAP, type SectionTypeId } from '@/lib/sectionTypes'

type PageRow = {
  id: string
  slug: string
  titleEn: string
  titleFa: string
  descriptionEn: string | null
  layout: string
  status: 'draft' | 'published' | 'archived'
  publishedAt: string | null
  updatedAt: string
}

type PageDetail = PageRow & {
  seoTitle: string | null
  seoDescription: string | null
  ogImage: string | null
  sections: SectionLink[]
}

type SectionLink = {
  id: number
  sortOrder: number
  active: boolean
  sectionId: string
  sectionType: string | null
  titleEn: string | null
  variant: string | null
  status: string | null
  theme: string | null
}

type AvailableSection = { id: string; sectionType: string; titleEn: string | null; variant: string; status: string }

const STATUS_COLOR: Record<string, string> = { draft: 'slate', published: 'green', archived: 'red' }

const EMPTY_PAGE = {
  slug: '',
  titleEn: '',
  titleFa: '',
  descriptionEn: '',
  descriptionFa: '',
  seoTitle: '',
  seoDescription: '',
  ogImage: '',
  layout: 'default',
  status: 'draft' as const,
}

export function PagesManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [pages, setPages] = useState<PageRow[]>([])
  const [modal, setModal] = useState(false)
  const [builderModal, setBuilderModal] = useState(false)
  const [editing, setEditing] = useState<Partial<PageDetail>>(EMPTY_PAGE)
  const [builderPage, setBuilderPage] = useState<PageDetail | null>(null)
  const [availableSections, setAvailableSections] = useState<AvailableSection[]>([])
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/pages')
    const d = await r.json()
    setPages(Array.isArray(d) ? d : [])
  }, [])

  useEffect(() => { load() }, [load])

  async function loadSections() {
    const r = await fetch('/api/admin/sections')
    const d = await r.json()
    setAvailableSections(Array.isArray(d) ? d : [])
  }

  async function save() {
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/pages', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)
    if (res.ok) {
      toast(editing.id ? t('updated') : t('created'), 'success')
      setModal(false)
      load()
    } else {
      const d = await res.json()
      toast(d.error || t('failed'), 'error')
    }
  }

  async function del(id: string) {
    if (!confirm(t('confirmDel'))) return
    const res = await fetch('/api/admin/pages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { toast(t('deleted'), 'success'); load() }
    else { const d = await res.json(); toast(d.error || t('failed'), 'error') }
  }

  async function openBuilder(page: PageRow) {
    const r = await fetch(`/api/admin/pages?id=${page.id}`)
    const d = await r.json()
    setBuilderPage(d)
    await loadSections()
    setBuilderModal(true)
  }

  async function saveBuilder() {
    if (!builderPage) return
    setSaving(true)
    const res = await fetch('/api/admin/pages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: builderPage.id,
        sections: builderPage.sections.map((s) => ({ sectionId: s.sectionId, active: s.active })),
      }),
    })
    setSaving(false)
    if (res.ok) { toast(t('pageLayoutSaved'), 'success'); setBuilderModal(false); load() }
    else { const d = await res.json(); toast(d.error || t('failed'), 'error') }
  }

  function moveSection(idx: number, dir: -1 | 1) {
    if (!builderPage) return
    const arr = [...builderPage.sections]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    setBuilderPage({ ...builderPage, sections: arr })
  }

  function toggleSectionActive(idx: number) {
    if (!builderPage) return
    const arr = [...builderPage.sections]
    arr[idx] = { ...arr[idx], active: !arr[idx].active }
    setBuilderPage({ ...builderPage, sections: arr })
  }

  function removeSection(idx: number) {
    if (!builderPage) return
    const arr = builderPage.sections.filter((_, i) => i !== idx)
    setBuilderPage({ ...builderPage, sections: arr })
  }

  function addSection(section: AvailableSection) {
    if (!builderPage) return
    if (builderPage.sections.find((s) => s.sectionId === section.id)) {
      toast(t('sectionAlreadyIn'), 'error')
      return
    }
    const newLink: SectionLink = {
      id: Date.now(),
      sortOrder: builderPage.sections.length,
      active: true,
      sectionId: section.id,
      sectionType: section.sectionType,
      titleEn: section.titleEn,
      variant: section.variant,
      status: section.status,
      theme: null,
    }
    setBuilderPage({ ...builderPage, sections: [...builderPage.sections, newLink] })
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('pagesTitle')}
        subtitle={t('pagesSub')}
        action={<Btn onClick={() => { setEditing(EMPTY_PAGE); setModal(true) }}>{t('addPage')}</Btn>}
      />

      <Card>
        <DataTable
          tableId="pages"
          columns={[
            { key: 'titleEn', labelEn: 'Page', labelFa: 'صفحه', render: p => <div><div className="font-medium text-text-primary text-sm">{p.titleEn}</div>{p.titleFa && <div className="text-xs text-text-tertiary mt-0.5" dir="rtl">{p.titleFa}</div>}</div> },
            { key: 'slug', labelEn: 'Slug', labelFa: 'اسلاگ', render: p => <span className="text-xs text-brand font-mono">/{p.slug}</span> },
            { key: 'layout', labelEn: 'Layout', labelFa: 'چیدمان', type: 'enum', render: p => <span className="text-xs text-text-secondary">{p.layout}</span> },
            { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum', options: ['draft', 'published', 'archived'].map(s => ({ value: s, labelEn: s, labelFa: s })), render: p => <Badge color={STATUS_COLOR[p.status] || 'slate'}>{p.status}</Badge> },
            { key: 'publishedAt', labelEn: 'Published', labelFa: 'انتشار', type: 'date', render: p => <span className="text-xs text-text-tertiary">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : '—'}</span> },
            { key: 'updatedAt', labelEn: 'Updated', labelFa: 'به‌روزرسانی', type: 'date', render: p => <span className="text-xs text-text-tertiary">{new Date(p.updatedAt).toLocaleDateString()}</span> },
          ] as Column<PageRow>[]}
          rows={pages}
          locale={locale}
          rowKey={p => String(p.id)}
          rowActions={[
            { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: p => { setEditing(p); setModal(true) } },
            { id: 'builder', labelEn: 'Builder', labelFa: 'سازنده', icon: '🧩', onClick: p => openBuilder(p) },
            { id: 'del', labelEn: 'Delete', labelFa: t('del'), icon: '🗑', danger: true, onClick: p => del(p.id) },
          ] as RowAction<PageRow>[]}
          exportName="pages"
          emptyLabel="No pages yet."
        />
      </Card>

      {/* Page create/edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('editPage') : t('createPage')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('titleEn')} value={editing.titleEn || ''} onChange={(v) => setEditing({ ...editing, titleEn: v })} />
            <Input label={t('titleFa')} value={editing.titleFa || ''} onChange={(v) => setEditing({ ...editing, titleFa: v })} />
          </div>
          <Input label="Slug *" value={editing.slug || ''} onChange={(v) => setEditing({ ...editing, slug: v.toLowerCase().replace(/\s+/g, '-') })} placeholder="about-us" />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Layout"
              value={editing.layout || 'default'}
              onChange={(v) => setEditing({ ...editing, layout: v })}
              options={[
                { value: 'default', label: 'Default' },
                { value: 'full_width', label: 'Full Width' },
                { value: 'sidebar', label: 'With Sidebar' },
                { value: 'landing', label: 'Landing Page' },
              ]}
            />
            <Select
              label="Status"
              value={editing.status || 'draft'}
              onChange={(v) => setEditing({ ...editing, status: v as 'draft' | 'published' | 'archived' })}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </div>
          <Input label="Description (EN)" value={editing.descriptionEn || ''} onChange={(v) => setEditing({ ...editing, descriptionEn: v })} />
          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-tertiary mb-3 uppercase tracking-wider font-medium">SEO</p>
            <Input label="SEO Title" value={editing.seoTitle || ''} onChange={(v) => setEditing({ ...editing, seoTitle: v })} />
            <div className="mt-3">
              <Input label="SEO Description" value={editing.seoDescription || ''} onChange={(v) => setEditing({ ...editing, seoDescription: v })} />
            </div>
            <div className="mt-3">
              <Input label="OG Image URL" value={editing.ogImage || ''} onChange={(v) => setEditing({ ...editing, ogImage: v })} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : editing.id ? t('editPage') : t('createPage')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>

      {/* Page Builder Modal */}
      {builderPage && (
        <Modal open={builderModal} onClose={() => setBuilderModal(false)} title={`Page Builder — ${builderPage.titleEn}`} size="lg">
          <div className="grid grid-cols-5 gap-4 max-h-[70vh]">
            {/* Canvas */}
            <div className="col-span-3 overflow-y-auto">
              <p className="text-xs text-text-tertiary mb-3 font-medium uppercase tracking-wider">Page Sections (drag to reorder)</p>
              {builderPage.sections.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-text-tertiary text-sm">
                  No sections yet. Add sections from the panel →
                </div>
              ) : (
                <div className="space-y-2">
                  {builderPage.sections.map((s, idx) => {
                    const typeInfo = s.sectionType ? SECTION_TYPE_MAP[s.sectionType as SectionTypeId] : null
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
                          s.active ? 'bg-surface border-border' : 'bg-background border-border opacity-50'
                        }`}
                      >
                        <span className="text-text-disabled text-sm font-mono w-5 text-center">{idx + 1}</span>
                        <span className="text-base">{typeInfo?.icon || '📦'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary truncate">{s.titleEn || 'Untitled'}</div>
                          <div className="text-xs text-text-tertiary">{typeInfo?.labelEn || s.sectionType} · {s.variant}</div>
                        </div>
                        <Badge color={s.status === 'published' ? 'green' : 'slate'}>{s.status || 'draft'}</Badge>
                        <div className="flex gap-1">
                          <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="px-1.5 py-0.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-20">↑</button>
                          <button onClick={() => moveSection(idx, 1)} disabled={idx === builderPage.sections.length - 1} className="px-1.5 py-0.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-20">↓</button>
                          <button onClick={() => toggleSectionActive(idx)} className="px-1.5 py-0.5 text-xs text-text-secondary hover:text-yellow-400">{s.active ? '👁' : '🙈'}</button>
                          <button onClick={() => removeSection(idx)} className="px-1.5 py-0.5 text-xs text-text-secondary hover:text-red-400">✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Section Picker */}
            <div className="col-span-2 overflow-y-auto border-l border-border pl-4">
              <p className="text-xs text-text-tertiary mb-3 font-medium uppercase tracking-wider">Available Sections</p>
              <div className="space-y-1.5">
                {availableSections.map((s) => {
                  const typeInfo = SECTION_TYPE_MAP[s.sectionType as SectionTypeId]
                  const already = builderPage.sections.some((ps) => ps.sectionId === s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => addSection(s)}
                      disabled={already}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                        already
                          ? 'bg-background border-border opacity-40 cursor-not-allowed'
                          : 'bg-surface border-border hover:border-brand/50 hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{typeInfo?.icon || '📦'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-text-primary truncate">{s.titleEn || 'Untitled'}</div>
                          <div className="text-xs text-text-tertiary">{typeInfo?.labelEn || s.sectionType}</div>
                        </div>
                        {already && <span className="text-xs text-green-400">✓</span>}
                      </div>
                    </button>
                  )
                })}
                {availableSections.length === 0 && (
                  <p className="text-xs text-text-disabled text-center py-4">No sections available. Create sections first.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4 pt-4 border-t border-border">
            <Btn onClick={saveBuilder} disabled={saving}>{saving ? t('saving') : t('saveLayout')}</Btn>
            <Btn variant="secondary" onClick={() => setBuilderModal(false)}>{t('cancel')}</Btn>
            <span className="text-xs text-text-tertiary self-center ml-auto">{builderPage.sections.length} section{builderPage.sections.length !== 1 ? 's' : ''}</span>
          </div>
        </Modal>
      )}
    </>
  )
}
