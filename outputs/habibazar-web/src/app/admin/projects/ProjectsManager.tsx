'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'

type Project = {
  id?: number; slug: string; nameEn: string; nameFa: string; industryEn: string; industryFa: string
  clientEn: string; clientFa: string; challengeEn: string; challengeFa: string
  solutionEn: string; solutionFa: string; resultsEn: string; resultsFa: string
  tagsEn: string; tagsFa: string; coverImage: string; color: string
  year: string; featured: boolean; sortOrder: number; active: boolean
}
const EMPTY: Project = { slug: '', nameEn: '', nameFa: '', industryEn: '', industryFa: '', clientEn: '', clientFa: '', challengeEn: '', challengeFa: '', solutionEn: '', solutionFa: '', resultsEn: '[]', resultsFa: '[]', tagsEn: '[]', tagsFa: '[]', coverImage: '', color: '#6366f1', year: '', featured: false, sortOrder: 0, active: true }

export function ProjectsManager() {
  const [projects, setProjects] = useState<Project[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Project>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { const r = await fetch('/api/admin/projects'); setProjects(await r.json()) }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/projects', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); load() } else toast('Failed', 'error')
  }

  async function del(id: number) {
    if (!confirm('Delete?')) return
    await fetch('/api/admin/projects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  function set<K extends keyof Project>(k: K, v: Project[K]) { setEditing((e) => ({ ...e, [k]: v })) }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Projects & Case Studies" subtitle="Manage infrastructure project case studies" action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>+ New Project</Btn>} />

      <Card>
        <Table headers={['Project', 'Industry', 'Year', 'Featured', 'Status', 'Actions']}>
          {projects.map((p) => (
            <TR key={p.id}>
              <TD>
                <div className="flex items-center gap-2">
                  <ColorDot color={p.color} />
                  <div>
                    <div className="font-medium text-white">{p.nameEn}</div>
                    <div className="text-xs text-slate-500">{p.nameFa}</div>
                  </div>
                </div>
              </TD>
              <TD className="text-slate-400">{p.industryEn}</TD>
              <TD className="text-slate-400">{p.year}</TD>
              <TD><Badge color={p.featured ? 'indigo' : 'slate'}>{p.featured ? '★ Featured' : 'Regular'}</Badge></TD>
              <TD><Badge color={p.active ? 'green' : 'slate'}>{p.active ? 'Active' : 'Hidden'}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing(p); setModal(true) }}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(p.id!)}>Del</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Project' : 'New Project'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="Slug *" value={editing.slug} onChange={(v) => set('slug', v)} placeholder="kenzo-restaurant" />
            <Input label="Year" value={editing.year} onChange={(v) => set('year', v)} placeholder="2024" />
            <Input label="Color" type="color" value={editing.color} onChange={(v) => set('color', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name (EN)" value={editing.nameEn} onChange={(v) => set('nameEn', v)} />
            <Input label="Name (FA)" value={editing.nameFa} onChange={(v) => set('nameFa', v)} />
            <Input label="Industry (EN)" value={editing.industryEn} onChange={(v) => set('industryEn', v)} />
            <Input label="Industry (FA)" value={editing.industryFa} onChange={(v) => set('industryFa', v)} />
            <Input label="Challenge (EN)" value={editing.challengeEn} onChange={(v) => set('challengeEn', v)} multiline rows={2} />
            <Input label="Challenge (FA)" value={editing.challengeFa} onChange={(v) => set('challengeFa', v)} multiline rows={2} />
            <Input label="Solution (EN)" value={editing.solutionEn} onChange={(v) => set('solutionEn', v)} multiline rows={2} />
            <Input label="Solution (FA)" value={editing.solutionFa} onChange={(v) => set('solutionFa', v)} multiline rows={2} />
            <Input label='Results (EN) — JSON ["r1","r2"]' value={editing.resultsEn} onChange={(v) => set('resultsEn', v)} multiline rows={3} />
            <Input label='Results (FA) — JSON ["r1","r2"]' value={editing.resultsFa} onChange={(v) => set('resultsFa', v)} multiline rows={3} />
            <Input label='Tags (EN) — JSON ["MikroTik","VLAN"]' value={editing.tagsEn} onChange={(v) => set('tagsEn', v)} />
            <Input label='Tags (FA) — JSON ["میکروتیک","VLAN"]' value={editing.tagsFa} onChange={(v) => set('tagsFa', v)} />
          </div>
          <Input label="Cover Image URL" value={editing.coverImage} onChange={(v) => set('coverImage', v)} />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Featured" value={editing.featured ? 'true' : 'false'} onChange={(v) => set('featured', v === 'true')} options={[{ value: 'true', label: 'Featured' }, { value: 'false', label: 'Regular' }]} />
            <Select label="Status" value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Hidden' }]} />
            <Input label="Sort Order" type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
          </div>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Project'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
