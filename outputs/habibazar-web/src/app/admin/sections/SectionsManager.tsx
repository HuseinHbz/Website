'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'
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
      toast(editing.id ? 'Section updated' : 'Section created', 'success')
      setModal(false)
      load()
    } else {
      const d = await res.json()
      toast(d.error || 'Failed', 'error')
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this section? This cannot be undone.')) return
    const res = await fetch('/api/admin/sections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { toast('Deleted', 'success'); load() }
    else { const d = await res.json(); toast(d.error || 'Failed', 'error') }
  }

  async function changeStatus(section: Section, status: 'draft' | 'published' | 'archived') {
    await fetch('/api/admin/sections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: section.id, status }),
    })
    toast(`Status → ${status}`, 'success')
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
        title="Section Builder"
        subtitle="Create and manage reusable content sections"
        action={<Btn onClick={openNew}>+ New Section</Btn>}
      />

      {/* Filters */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <Input label="" value={search} onChange={setSearch} placeholder="Search sections..." />
          </div>
          <Select
            label=""
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: '', label: 'All Categories' }, ...SECTION_CATEGORIES.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))]}
          />
          <Select
            label=""
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ value: '', label: 'All Types' }, ...SECTION_TYPES.map((t) => ({ value: t.id, label: `${t.icon} ${t.labelEn}` }))]}
          />
          <Select
            label=""
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'All Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total', count: sections.length, color: 'text-white' },
          { label: 'Published', count: sections.filter((s) => s.status === 'published').length, color: 'text-green-400' },
          { label: 'Draft', count: sections.filter((s) => s.status === 'draft').length, color: 'text-slate-400' },
          { label: 'Archived', count: sections.filter((s) => s.status === 'archived').length, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#111122] border border-[#1e1e2e] rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card>
        <Table headers={['Section', 'Type', 'Variant', 'Theme', 'Status', 'Version', 'Updated', 'Actions']}>
          {filtered.map((s) => {
            const typeInfo = SECTION_TYPE_MAP[s.sectionType as SectionTypeId]
            return (
              <TR key={s.id}>
                <TD>
                  <div>
                    <div className="font-medium text-white text-sm">{s.titleEn || <span className="text-slate-500 italic">Untitled</span>}</div>
                    {s.titleFa && <div className="text-xs text-slate-500 mt-0.5" dir="rtl">{s.titleFa}</div>}
                  </div>
                </TD>
                <TD>
                  <span className="text-xs text-indigo-300">
                    {typeInfo ? `${typeInfo.icon} ${typeInfo.labelEn}` : s.sectionType}
                  </span>
                </TD>
                <TD><span className="text-xs text-slate-400">{s.variant}</span></TD>
                <TD><span className="text-xs text-slate-400">{s.theme}</span></TD>
                <TD>
                  <div className="relative group">
                    <Badge color={STATUS_COLOR[s.status] || 'slate'}>{s.status}</Badge>
                    <div className="absolute left-0 top-6 hidden group-hover:flex flex-col gap-1 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg p-2 z-10 shadow-xl">
                      {(['draft', 'published', 'archived'] as const).filter((st) => st !== s.status).map((st) => (
                        <button key={st} onClick={() => changeStatus(s, st)} className="text-xs text-left px-2 py-1 rounded hover:bg-[#2a2a3e] text-slate-300 whitespace-nowrap">
                          → {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </TD>
                <TD><span className="text-xs text-slate-500">v{s.version}</span></TD>
                <TD className="text-xs text-slate-500">{new Date(s.updatedAt).toLocaleDateString()}</TD>
                <TD>
                  <div className="flex gap-1 flex-wrap">
                    <Btn size="sm" variant="secondary" onClick={() => openEdit(s)}>Edit</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => openHistory(s)}>History</Btn>
                    <Btn size="sm" variant="danger" onClick={() => del(s.id)}>Del</Btn>
                  </div>
                </TD>
              </TR>
            )
          })}
        </Table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            {sections.length === 0 ? 'No sections yet. Create your first section!' : 'No sections match your filters.'}
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Section' : 'Create New Section'} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Type & Variant */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Section Type *"
              value={editing.sectionType || ''}
              onChange={(v) => setEditing({ ...editing, sectionType: v, variant: 'default' })}
              options={SECTION_TYPES.map((t) => ({ value: t.id, label: `${t.icon} ${t.labelEn}` }))}
            />
            <Select
              label="Variant"
              value={editing.variant || 'default'}
              onChange={(v) => setEditing({ ...editing, variant: v })}
              options={variantOptions}
            />
          </div>

          {/* Titles */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Title (EN)" value={editing.titleEn || ''} onChange={(v) => setEditing({ ...editing, titleEn: v })} />
            <Input label="Title (FA)" value={editing.titleFa || ''} onChange={(v) => setEditing({ ...editing, titleFa: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Subtitle (EN)" value={editing.subtitleEn || ''} onChange={(v) => setEditing({ ...editing, subtitleEn: v })} />
            <Input label="Subtitle (FA)" value={editing.subtitleFa || ''} onChange={(v) => setEditing({ ...editing, subtitleFa: v })} />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Content (EN)</label>
            <textarea
              value={editing.contentEn || ''}
              onChange={(e) => setEditing({ ...editing, contentEn: e.target.value })}
              rows={3}
              className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-y"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Content (FA)</label>
            <textarea
              value={editing.contentFa || ''}
              onChange={(e) => setEditing({ ...editing, contentFa: e.target.value })}
              rows={3}
              dir="rtl"
              className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-y"
            />
          </div>

          {/* Theme & Animation */}
          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Theme"
              value={editing.theme || 'dark'}
              onChange={(v) => setEditing({ ...editing, theme: v })}
              options={themeOptions}
            />
            <Select
              label="Animation"
              value={editing.animationIn || 'fade'}
              onChange={(v) => setEditing({ ...editing, animationIn: v })}
              options={animOptions}
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

          {/* Background */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="BG Color (hex / CSS)" value={editing.bgColor || ''} onChange={(v) => setEditing({ ...editing, bgColor: v })} placeholder="#0a0a14" />
            <Input label="BG Image URL" value={editing.bgImage || ''} onChange={(v) => setEditing({ ...editing, bgImage: v })} placeholder="/uploads/..." />
          </div>

          {/* SEO */}
          <div className="border-t border-[#1e1e2e] pt-4">
            <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">SEO / Meta</p>
            <div className="grid grid-cols-1 gap-3">
              <Input label="SEO Title" value={editing.seoTitle || ''} onChange={(v) => setEditing({ ...editing, seoTitle: v })} />
              <Input label="SEO Description" value={editing.seoDescription || ''} onChange={(v) => setEditing({ ...editing, seoDescription: v })} />
            </div>
          </div>

          {/* Extra Data (JSON) */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Extra Data (JSON)</label>
            <textarea
              value={editing.extraData || ''}
              onChange={(e) => setEditing({ ...editing, extraData: e.target.value })}
              rows={3}
              placeholder='{"items": [], "settings": {}}'
              className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500 transition-colors resize-y"
            />
            <p className="text-xs text-slate-600 mt-1">Section-specific structured data in JSON format</p>
          </div>

          {/* Scheduling */}
          <div>
            <Input
              label="Schedule Publish At (optional)"
              type="datetime-local"
              value={editing.scheduledAt || ''}
              onChange={(v) => setEditing({ ...editing, scheduledAt: v })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : editing.id ? 'Update Section' : 'Create Section'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* Version History Modal */}
      {historyModal && (
        <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title="Version History" size="md">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {historyModal.versions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No version history yet. Versions are saved when you edit a section.</p>
            ) : (
              historyModal.versions.map((v) => {
                const snap = JSON.parse(v.snapshot || '{}')
                return (
                  <div key={v.version} className="bg-[#0c0c14] border border-[#2a2a3e] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">Version {v.version}</span>
                      <span className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      <span className="text-indigo-300">{snap.titleEn || 'Untitled'}</span>
                      <span className="ml-2 text-slate-600">({snap.status})</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="mt-4">
            <Btn variant="secondary" onClick={() => setHistoryModal(null)}>Close</Btn>
          </div>
        </Modal>
      )}
    </>
  )
}
