'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'
import { MediaPicker, GalleryPicker } from '@/components/admin/MediaPicker'
import { useT } from '@/lib/admin/locale'

type Project = {
  id?: number; slug: string; nameEn: string; nameFa: string; industryEn: string; industryFa: string
  clientEn: string; clientFa: string; challengeEn: string; challengeFa: string
  solutionEn: string; solutionFa: string; resultsEn: string; resultsFa: string
  tagsEn: string; tagsFa: string; coverImage: string; gallery: string; color: string
  year: string; featured: boolean; sortOrder: number; active: boolean
}
const EMPTY: Project = { slug: '', nameEn: '', nameFa: '', industryEn: '', industryFa: '', clientEn: '', clientFa: '', challengeEn: '', challengeFa: '', solutionEn: '', solutionFa: '', resultsEn: '[]', resultsFa: '[]', tagsEn: '[]', tagsFa: '[]', coverImage: '', gallery: '[]', color: '#6366f1', year: '', featured: false, sortOrder: 0, active: true }

function parseGallery(v: string | null | undefined): string[] {
  if (!v) return []
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
}

export function ProjectsManager() {
  const t = useT()
  const [projects, setProjects] = useState<Project[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Project>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/projects')
    const d = await r.json(); setProjects(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/projects', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(t('failed'), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/projects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
  }

  function set<K extends keyof Project>(k: K, v: Project[K]) { setEditing((e) => ({ ...e, [k]: v })) }
  const galleryUrls = parseGallery(editing.gallery)
  function setGallery(urls: string[]) { set('gallery', JSON.stringify(urls)) }

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('projectsTitle')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('projectNew')}</Btn>} />

      <Card>
        <Table headers={[t('name'), t('industryEn'), t('year'), 'Cover', t('featured'), t('status'), t('actions')]}>
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
              <TD>
                {p.coverImage
                  ? <img src={p.coverImage} alt="" className="w-10 h-10 object-cover rounded-lg border border-[#2a2a3e]" />
                  : <span className="text-slate-600 text-xs">—</span>}
              </TD>
              <TD><Badge color={p.featured ? 'indigo' : 'slate'}>{p.featured ? `★ ${t('featured')}` : t('regular')}</Badge></TD>
              <TD><Badge color={p.active ? 'green' : 'slate'}>{p.active ? t('active') : t('hidden')}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing(p); setModal(true) }}>{t('edit')}</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(p.id!)}>{t('delete')}</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('projectEdit') : t('projectNew')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={`${t('slug')} *`} value={editing.slug} onChange={(v) => set('slug', v)} placeholder="kenzo-restaurant" />
            <Input label={t('year')} value={editing.year} onChange={(v) => set('year', v)} placeholder="2024" />
            <Input label={t('color')} type="color" value={editing.color} onChange={(v) => set('color', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('nameEn')} value={editing.nameEn} onChange={(v) => set('nameEn', v)} />
            <Input label={t('nameFa')} value={editing.nameFa} onChange={(v) => set('nameFa', v)} />
            <Input label={t('industryEn')} value={editing.industryEn} onChange={(v) => set('industryEn', v)} />
            <Input label={t('industryFa')} value={editing.industryFa} onChange={(v) => set('industryFa', v)} />
            <Input label={t('challengeEn')} value={editing.challengeEn} onChange={(v) => set('challengeEn', v)} multiline rows={2} />
            <Input label={t('challengeFa')} value={editing.challengeFa} onChange={(v) => set('challengeFa', v)} multiline rows={2} />
            <Input label={t('solutionEn')} value={editing.solutionEn} onChange={(v) => set('solutionEn', v)} multiline rows={2} />
            <Input label={t('solutionFa')} value={editing.solutionFa} onChange={(v) => set('solutionFa', v)} multiline rows={2} />
            <Input label={t('resultsEn')} value={editing.resultsEn} onChange={(v) => set('resultsEn', v)} multiline rows={3} />
            <Input label={t('resultsFa')} value={editing.resultsFa} onChange={(v) => set('resultsFa', v)} multiline rows={3} />
            <Input label={t('tagsEn')} value={editing.tagsEn} onChange={(v) => set('tagsEn', v)} />
            <Input label={t('tagsFa')} value={editing.tagsFa} onChange={(v) => set('tagsFa', v)} />
          </div>

          {/* Cover image */}
          <MediaPicker
            label="Cover Image"
            value={editing.coverImage}
            onChange={(v) => set('coverImage', v)}
            folder="projects"
            placeholder="No cover image — click Browse to select from media library"
          />

          {/* Gallery */}
          <GalleryPicker
            label={`Project Gallery (${galleryUrls.length} images)`}
            value={galleryUrls}
            onChange={setGallery}
            folder="projects"
          />

          <div className="grid grid-cols-3 gap-4">
            <Select label={t('featured')} value={editing.featured ? 'true' : 'false'} onChange={(v) => set('featured', v === 'true')} options={[{ value: 'true', label: t('featured') }, { value: 'false', label: t('regular') }]} />
            <Select label={t('status')} value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('hidden') }]} />
            <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
          </div>
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
