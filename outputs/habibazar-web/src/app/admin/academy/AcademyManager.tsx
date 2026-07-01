'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, Badge, Input, Select, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Course = { id: number; slug: string; titleEn: string; level: string; type: string; durationHours: number | null; lessonsCount: number; enrollmentsCount: number; status: string; featured: boolean; isFree: boolean; price: number; rating: number }

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert']
const TYPES = ['course', 'learning_path', 'bootcamp', 'certification']
const STATUSES = ['draft', 'published', 'archived']
const LEVEL_COLORS: Record<string, string> = { beginner: 'green', intermediate: 'blue', advanced: 'yellow', expert: 'red' }

export function AcademyManager() {
  const t = useT()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Course & { descriptionEn: string }> | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/courses'); setCourses(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return; setSaving(true)
    const method = editing.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/courses', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    if (res.ok) { toast(t('saved'), 'success'); setEditing(null); load() } else toast(t('failed'), 'error')
    setSaving(false)
  }

  const stats = { total: courses.length, published: courses.filter(c => c.status === 'published').length, enrolled: courses.reduce((s, c) => s + c.enrollmentsCount, 0) }

  return (
    <div>
      <ToastContainer />
      <PageHeader title={t('academyTitle')} subtitle="Courses, learning paths, certifications and labs"
        action={<Btn onClick={() => setEditing({ level: 'intermediate', type: 'course', status: 'draft', isFree: true, price: 0, lessonsCount: 0, enrollmentsCount: 0, rating: 0 })}>{t('addCourse')}</Btn>} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{ label: t('statTotalCourses'), value: stats.total, icon: '🎓' }, { label: t('published'), value: stats.published, icon: '✅' }, { label: t('statEnrollments'), value: stats.enrolled, icon: '👥' }].map(s => (
          <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-2xl">{s.icon}</span>
            <div><div className="text-2xl font-black text-white">{s.value}</div><div className="text-xs text-text-tertiary">{s.label}</div></div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing.id ? t('editCourse') : t('newCourse')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Input label="Slug" value={editing.slug || ''} onChange={v => setEditing(e => ({ ...e, slug: v }))} /></div>
              <div className="col-span-2"><Input label={t('titleEn')} value={editing.titleEn || ''} onChange={v => setEditing(e => ({ ...e, titleEn: v }))} /></div>
              <Select label={t('level')} value={editing.level || 'intermediate'} onChange={v => setEditing(e => ({ ...e, level: v }))} options={LEVELS.map(l => ({ value: l, label: l }))} />
              <Select label={t('type')} value={editing.type || 'course'} onChange={v => setEditing(e => ({ ...e, type: v }))} options={TYPES.map(tp => ({ value: tp, label: tp }))} />
              <Select label="Status" value={editing.status || 'draft'} onChange={v => setEditing(e => ({ ...e, status: v }))} options={STATUSES.map(s => ({ value: s, label: s }))} />
              <Input label={t('durationHours')} type="number" value={String(editing.durationHours || 0)} onChange={v => setEditing(e => ({ ...e, durationHours: parseInt(v) || 0 }))} />
              <div className="col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">{t('description')}</label>
                <textarea value={editing.descriptionEn || ''} onChange={e2 => setEditing(e => ({ ...e, descriptionEn: e2.target.value }))} rows={3}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="flex items-center gap-4 col-span-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"><input type="checkbox" checked={!!editing.isFree} onChange={e2 => setEditing(e => ({ ...e, isFree: e2.target.checked }))} /> {t('free')}</label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer"><input type="checkbox" checked={!!editing.featured} onChange={e2 => setEditing(e => ({ ...e, featured: e2.target.checked }))} /> {t('featuredLabel')}</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6"><Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn><Btn variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Btn></div>
          </div>
        </div>
      )}

      <Card>
        {loading ? <div className="text-center py-8 text-text-tertiary">{t('loading')}</div> : courses.length === 0 ? (
          <div className="text-center py-12"><div className="text-4xl mb-3">🎓</div><div className="text-white font-medium mb-1">No courses yet</div><div className="text-text-tertiary text-sm">Create your first course to launch the academy</div></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">{[t('course'), t('level'), t('type'), t('status'), t('enrolled'), t('actions')].map(h => <th key={h} className="px-4 py-3 text-text-tertiary font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><div className="font-medium text-white">{c.titleEn}</div><div className="text-xs text-text-tertiary">{c.durationHours}h · {c.lessonsCount} lessons</div></td>
                  <td className="px-4 py-3"><Badge color={LEVEL_COLORS[c.level] || 'slate'}>{c.level}</Badge></td>
                  <td className="px-4 py-3 text-text-secondary">{c.type}</td>
                  <td className="px-4 py-3"><Badge color={c.status === 'published' ? 'green' : 'yellow'}>{c.status}</Badge></td>
                  <td className="px-4 py-3 text-text-secondary">{c.enrollmentsCount}</td>
                  <td className="px-4 py-3"><Btn size="sm" variant="ghost" onClick={() => setEditing(c)}>{t('edit')}</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
