'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { formatDateTime } from '@/lib/admin/datetime'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { SECTION_TYPES, SECTION_CATEGORIES, SECTION_TYPE_MAP, type SectionTypeId } from '@/lib/sectionTypes'

type Section = {
  id: string
  sectionType: string
  variant: string
  titleEn: string | null
  titleFa: string | null
  subtitleEn: string | null
  subtitleFa: string | null
  contentEn: string | null
  contentFa: string | null
  theme: string
  bgColor: string | null
  bgImage: string | null
  animationIn: string | null
  status: 'draft' | 'published' | 'archived'
  scheduledAt: string | null
  version: number
  updatedAt: string
  seoTitle: string | null
  seoDescription: string | null
  extraData: string | null
  visibilityRules: string | null
}

const STATUS_COLOR: Record<string, string> = { draft: 'slate', published: 'green', archived: 'red' }

const EMPTY: Partial<Section> = {
  sectionType: 'hero',
  variant: 'default',
  titleEn: '',
  titleFa: '',
  subtitleEn: '',
  subtitleFa: '',
  contentEn: '',
  contentFa: '',
  theme: 'dark',
  bgColor: '',
  animationIn: 'fade',
  status: 'draft',
  seoTitle: '',
  seoDescription: '',
  extraData: '',
}

export function SectionsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const [sections, setSections] = useState<Section[]>([])
  const [filtered, setFiltered] = useState<Section[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Section>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [historyModal, setHistoryModal] = useState<{ sectionId: string; versions: { version: number; snapshot: string; createdAt: string }[] } | null>(null)
  const { toast, ToastContainer } = useToast()

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/sections')
    const d = await r.json()
    setSections(Array.isArray(d) ? d : [])
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let list = sections
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((s) =>
        (s.titleEn || '').toLowerCase().includes(q) ||
        (s.titleFa || '').toLowerCase().includes(q) ||
        s.sectionType.includes(q)
      )
    }
    if (typeFilter) list = list.filter((s) => s.sectionType === typeFilter)
    if (statusFilter) list = list.filter((s) => s.status === statusFilter)
    if (categoryFilter) {
      list = list.filter((s) => {
        const t = SECTION_TYPE_MAP[s.sectionType as SectionTypeId]
        return t?.category === categoryFilter
      })
    }
    setFiltered(list)
  }, [sections, search, typeFilter, statusFilter, categoryFilter])

  async function save() {
    setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/sections', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)
    if (res.ok) {
      toast(editing.id ? t('updateSection') : t('createSection'), 'success')
      setModal(false)
      load()
    } else {
      const d = await res.json()
      toast(d.error || t('failed'), 'error')
    }
  }

  async function del(id: string) {
    if (!confirm(t('confirmDelSection'))) return
    const res = await fetch('/api/admin/sections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { toast(t('deleted'), 'success'); load() }
    else { const d = await res.json(); toast(d.error || t('failed'), 'error') }
  }

  async function changeStatus(section: Section, status: 'draft' | 'published' | 'archived') {
    await fetch('/api/admin/sections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: section.id, status }),
    })
    toast(`${t('status')} → ${status}`, 'success')
    load()
  }

  async function openHistory(section: Section) {
    const r = await fetch(`/api/admin/sections?id=${section.id}`)
    const d = await r.json()
    setHistoryModal({ sectionId: section.id, versions: d.versions || [] })
  }

  function openEdit(section: Section) {
    setEditing({ ...section })
    setModal(true)
  }

  function openNew() {
    setEditing({ ...EMPTY })
    setModal(true)
  }

  const selectedType = editing.sectionType ? SECTION_TYPE_MAP[editing.sectionType as SectionTypeId] : null
  const variantOptions = selectedType?.variants || [{ value: 'default', label: 'Default' }]
  const themeOptions = (selectedType?.themes || ['dark', 'light']).map((t) => ({ value: t, label: t }))
  const animOptions = (selectedType?.animations || ['fade', 'none']).map((a) => ({ value: a, label: a }))

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('sectionsTitle')}
        subtitle={t('sectionsSub')}
        action={<Btn onClick={openNew}>{t('createSection')}</Btn>}
      />

      {/* Filters */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <Input label="" value={search} onChange={setSearch} placeholder={t('search')} />
          </div>
          <Select
            label=""
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: '', label: t('allCategories') }, ...SECTION_CATEGORIES.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))]}
          />
          <Select
            label=""
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ value: '', label: t('allTypes') }, ...SECTION_TYPES.map((t) => ({ value: t.id, label: `${t.icon} ${t.labelEn}` }))]}
          />
          <Select
            label=""
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: t('allStatus') },
              { value: 'draft', label: t('draft') },
              { value: 'published', label: t('published') },
              { value: 'archived', label: t('archived') },
            ]}
          />
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {[
          { label: t('total'), count: sections.length, color: 'text-text-primary' },
          { label: t('published'), count: sections.filter((s) => s.status === 'published').length, color: 'text-green-400' },
          { label: t('draft'), count: sections.filter((s) => s.status === 'draft').length, color: 'text-text-secondary' },
          { label: t('archived'), count: sections.filter((s) => s.status === 'archived').length, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="text-xs text-text-tertiary mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card>
        <DataTable
          tableId="sections"
          columns={[
            { key: 'titleEn', labelEn: 'Section', labelFa: t('section'), render: s => <div><div className="font-medium text-text-primary text-sm">{s.titleEn || <span className="text-text-tertiary italic">Untitled</span>}</div>{s.titleFa && <div className="text-xs text-text-tertiary mt-0.5" dir="rtl">{s.titleFa}</div>}</div> },
            { key: 'sectionType', labelEn: 'Type', labelFa: t('type'), type: 'enum', value: s => { const ti = SECTION_TYPE_MAP[s.sectionType as SectionTypeId]; return ti ? ti.labelEn : s.sectionType }, render: s => { const typeInfo = SECTION_TYPE_MAP[s.sectionType as SectionTypeId]; return <span className="text-xs text-brand">{typeInfo ? `${typeInfo.icon} ${typeInfo.labelEn}` : s.sectionType}</span> } },
            { key: 'variant', labelEn: 'Variant', labelFa: t('variant'), type: 'enum', render: s => <span className="text-xs text-text-secondary">{s.variant}</span> },
            { key: 'theme', labelEn: 'Theme', labelFa: t('theme'), type: 'enum', render: s => <span className="text-xs text-text-secondary">{s.theme}</span> },
            { key: 'status', labelEn: 'Status', labelFa: t('status'), type: 'enum', options: ['draft', 'published', 'archived'].map(x => ({ value: x, labelEn: x, labelFa: x })), render: s => <div className="relative group"><Badge color={STATUS_COLOR[s.status] || 'slate'}>{s.status}</Badge><div className="absolute left-0 top-6 hidden group-hover:flex flex-col gap-1 bg-surface-2 border border-border rounded-lg p-2 z-10 shadow-xl">{(['draft', 'published', 'archived'] as const).filter((st) => st !== s.status).map((st) => (<button key={st} onClick={() => changeStatus(s, st)} className="text-xs text-left px-2 py-1 rounded hover:bg-surface-2 text-text-primary whitespace-nowrap">→ {st}</button>))}</div></div> },
            { key: 'version', labelEn: 'Version', labelFa: t('version'), type: 'number', numeric: true, render: s => <span className="text-xs text-text-tertiary">v{s.version}</span> },
            { key: 'updatedAt', labelEn: 'Updated', labelFa: t('updated'), type: 'date', render: s => <span className="text-xs text-text-tertiary">{formatDateTime(s.updatedAt, locale)}</span> },
          ] as Column<Section>[]}
          rows={filtered}
          locale={locale}
          rowKey={s => String(s.id)}
          rowActions={[
            { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: s => openEdit(s) },
            { id: 'history', labelEn: 'History', labelFa: t('history'), icon: '🕓', onClick: s => openHistory(s) },
            { id: 'del', labelEn: 'Delete', labelFa: t('del'), icon: '🗑', danger: true, onClick: s => del(s.id) },
          ] as RowAction<Section>[]}
          exportName="sections"
          emptyLabel={sections.length === 0 ? t('noSections') : t('noSectionsFilter')}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('editSection') : t('createSection')} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Type & Variant */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('sectionType')}
              value={editing.sectionType || ''}
              onChange={(v) => setEditing({ ...editing, sectionType: v, variant: 'default' })}
              options={SECTION_TYPES.map((t) => ({ value: t.id, label: `${t.icon} ${t.labelEn}` }))}
            />
            <Select
              label={t('variant')}
              value={editing.variant || 'default'}
              onChange={(v) => setEditing({ ...editing, variant: v })}
              options={variantOptions}
            />
          </div>

          {/* Titles */}
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('titleEn')} value={editing.titleEn || ''} onChange={(v) => setEditing({ ...editing, titleEn: v })} />
            <Input label={t('titleFa')} value={editing.titleFa || ''} onChange={(v) => setEditing({ ...editing, titleFa: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('subtitleEn')} value={editing.subtitleEn || ''} onChange={(v) => setEditing({ ...editing, subtitleEn: v })} />
            <Input label={t('subtitleFa')} value={editing.subtitleFa || ''} onChange={(v) => setEditing({ ...editing, subtitleFa: v })} />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">{t('contentEn')}</label>
            <textarea
              value={editing.contentEn || ''}
              onChange={(e) => setEditing({ ...editing, contentEn: e.target.value })}
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-y"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">{t('contentFa')}</label>
            <textarea
              value={editing.contentFa || ''}
              onChange={(e) => setEditing({ ...editing, contentFa: e.target.value })}
              rows={3}
              dir="rtl"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand transition-colors resize-y"
            />
          </div>

          {/* Theme & Animation */}
          <div className="grid grid-cols-3 gap-3">
            <Select
              label={t('theme')}
              value={editing.theme || 'dark'}
              onChange={(v) => setEditing({ ...editing, theme: v })}
              options={themeOptions}
            />
            <Select
              label={t('animation')}
              value={editing.animationIn || 'fade'}
              onChange={(v) => setEditing({ ...editing, animationIn: v })}
              options={animOptions}
            />
            <Select
              label={t('status')}
              value={editing.status || 'draft'}
              onChange={(v) => setEditing({ ...editing, status: v as 'draft' | 'published' | 'archived' })}
              options={[
                { value: 'draft', label: t('draft') },
                { value: 'published', label: t('published') },
                { value: 'archived', label: t('archived') },
              ]}
            />
          </div>

          {/* Background */}
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('bgColor')} value={editing.bgColor || ''} onChange={(v) => setEditing({ ...editing, bgColor: v })} placeholder="#0a0a14" />
            <Input label={t('bgImageUrl')} value={editing.bgImage || ''} onChange={(v) => setEditing({ ...editing, bgImage: v })} placeholder="/uploads/..." />
          </div>

          {/* SEO */}
          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-tertiary mb-3 font-medium uppercase tracking-wider">{t('seoMeta')}</p>
            <div className="grid grid-cols-1 gap-3">
              <Input label={t('seoTitle')} value={editing.seoTitle || ''} onChange={(v) => setEditing({ ...editing, seoTitle: v })} />
              <Input label={t('seoDescription')} value={editing.seoDescription || ''} onChange={(v) => setEditing({ ...editing, seoDescription: v })} />
            </div>
          </div>

          {/* Extra Data (JSON) */}
          <div>
            <label className="block text-xs text-text-secondary mb-1">{t('extraDataJson')}</label>
            <textarea
              value={editing.extraData || ''}
              onChange={(e) => setEditing({ ...editing, extraData: e.target.value })}
              rows={3}
              placeholder='{"items": [], "settings": {}}'
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-brand font-mono focus:outline-none focus:border-brand transition-colors resize-y"
            />
            <p className="text-xs text-text-disabled mt-1">Section-specific structured data in JSON format</p>
          </div>

          {/* Scheduling */}
          <div>
            <Input
              label={t('schedulePublish')}
              type="datetime-local"
              value={editing.scheduledAt || ''}
              onChange={(v) => setEditing({ ...editing, scheduledAt: v })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : editing.id ? t('updateSection') : t('createSection')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>

      {/* Version History Modal */}
      {historyModal && (
        <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title={t('versionHistory')} size="md">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {historyModal.versions.length === 0 ? (
              <p className="text-text-tertiary text-sm text-center py-8">No version history yet. Versions are saved when you edit a section.</p>
            ) : (
              historyModal.versions.map((v) => {
                const snap = JSON.parse(v.snapshot || '{}')
                return (
                  <div key={v.version} className="bg-background border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-primary">Version {v.version}</span>
                      <span className="text-xs text-text-tertiary">{formatDateTime(v.createdAt, locale)}</span>
                    </div>
                    <div className="text-xs text-text-secondary">
                      <span className="text-brand">{snap.titleEn || 'Untitled'}</span>
                      <span className="ml-2 text-text-disabled">({snap.status})</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="mt-4">
            <Btn variant="secondary" onClick={() => setHistoryModal(null)}>{t('close')}</Btn>
          </div>
        </Modal>
      )}
    </>
  )
}
