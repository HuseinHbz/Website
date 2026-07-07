'use client'

import { useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { crud, useResource } from '@/lib/admin/crud'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Skill = { id?: number; nameEn: string; nameFa: string; categoryEn: string; categoryFa: string; level: number; color: string; sortOrder: number; active: boolean }
type Cert = { id?: number; nameEn: string; nameFa: string; issuer: string; issueDate: string; credentialUrl: string; color: string; sortOrder: number; active: boolean }

const EMPTY_SKILL: Skill = { nameEn: '', nameFa: '', categoryEn: '', categoryFa: '', level: 80, color: '#6366f1', sortOrder: 0, active: true }
const EMPTY_CERT: Cert = { nameEn: '', nameFa: '', issuer: '', issueDate: '', credentialUrl: '', color: '#6366f1', sortOrder: 0, active: true }

export function SkillsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const { data: skills, reload: loadSkills } = useResource<Skill>('/api/admin/skills')
  const { data: certs, reload: loadCerts } = useResource<Cert>('/api/admin/certifications')
  const [tab, setTab] = useState<'skills' | 'certs'>('skills')
  const [modal, setModal] = useState(false)
  const [editS, setEditS] = useState<Skill>(EMPTY_SKILL)
  const [editC, setEditC] = useState<Cert>(EMPTY_CERT)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function saveSkill() {
    setSaving(true)
    const res = await crud.save('/api/admin/skills', editS)
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); loadSkills() } else toast(t('failed'), 'error')
  }

  async function saveCert() {
    setSaving(true)
    const res = await crud.save('/api/admin/certifications', editC)
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); loadCerts() } else toast(t('failed'), 'error')
  }

  async function delSkill(id: number) {
    if (!confirm(t('confirmDel'))) return
    await crud.remove('/api/admin/skills', id)
    toast(t('deleted')); loadSkills()
  }

  async function delCert(id: number) {
    if (!confirm(t('confirmDel'))) return
    await crud.remove('/api/admin/certifications', id)
    toast(t('deleted')); loadCerts()
  }

  async function toggleSkill(s: Skill) {
    await crud.patch('/api/admin/skills', { id: s.id, active: !s.active })
    toast(t('saved')); loadSkills()
  }

  async function toggleCert(c: Cert) {
    await crud.patch('/api/admin/certifications', { id: c.id, active: !c.active })
    toast(t('saved')); loadCerts()
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('skillsTitle')}
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg bg-background border border-border overflow-hidden">
              <button onClick={() => setTab('skills')} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tab === 'skills' ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>{t('skillsTab')}</button>
              <button onClick={() => setTab('certs')} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tab === 'certs' ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>{t('certsTab')}</button>
            </div>
            <Btn onClick={() => { if (tab === 'skills') setEditS(EMPTY_SKILL); else setEditC(EMPTY_CERT); setModal(true) }}>{t('add')}</Btn>
          </div>
        }
      />

      {tab === 'skills' ? (
        <Card>
          <DataTable
            tableId="skills"
            columns={[
              { key: 'nameEn', labelEn: 'Name', labelFa: t('name'), render: s => <div><div className="font-medium text-white">{s.nameEn}</div><div className="text-xs text-text-tertiary">{s.nameFa}</div></div> },
              { key: 'categoryEn', labelEn: 'Category', labelFa: t('category'), type: 'enum', render: s => <span className="text-text-secondary">{s.categoryEn}</span> },
              { key: 'level', labelEn: 'Level', labelFa: t('level'), type: 'number', numeric: true, render: s => <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-surface-2 rounded-full max-w-20"><div className="h-full rounded-full bg-brand" style={{ width: `${s.level}%` }} /></div><span className="text-xs text-text-secondary">{s.level}%</span></div> },
              { key: 'color', labelEn: 'Color', labelFa: t('color'), sortable: false, render: s => <ColorDot color={s.color} /> },
              { key: 'active', labelEn: 'Status', labelFa: t('status'), type: 'boolean', value: s => s.active, render: s => <Badge color={s.active ? 'green' : 'slate'}>{s.active ? t('active') : t('hidden')}</Badge> },
            ] as Column<Skill>[]}
            rows={skills}
            locale={locale}
            rowKey={s => String(s.id)}
            rowActions={[
              { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: s => { setEditS(s); setModal(true) } },
              { id: 'toggle', labelEn: 'Toggle', labelFa: t('status'), icon: '⇄', onClick: s => toggleSkill(s) },
              { id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: s => delSkill(s.id!) },
            ] as RowAction<Skill>[]}
            exportName="skills"
          />
        </Card>
      ) : (
        <Card>
          <DataTable
            tableId="skills-certs"
            columns={[
              { key: 'nameEn', labelEn: 'Name', labelFa: t('name'), render: c => <div><div className="font-medium text-white">{c.nameEn}</div><div className="text-xs text-text-tertiary">{c.nameFa}</div></div> },
              { key: 'issuer', labelEn: 'Issuer', labelFa: t('issuer'), type: 'enum', render: c => <span className="text-text-secondary">{c.issuer}</span> },
              { key: 'issueDate', labelEn: 'Date', labelFa: t('date'), type: 'date', render: c => <span className="text-text-tertiary text-xs">{c.issueDate}</span> },
              { key: 'color', labelEn: 'Color', labelFa: t('color'), sortable: false, render: c => <ColorDot color={c.color} /> },
            ] as Column<Cert>[]}
            rows={certs}
            locale={locale}
            rowKey={c => String(c.id)}
            rowActions={[
              { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: c => { setEditC(c); setModal(true) } },
              { id: 'toggle', labelEn: 'Toggle', labelFa: t('status'), icon: '⇄', onClick: c => toggleCert(c) },
              { id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: c => delCert(c.id!) },
            ] as RowAction<Cert>[]}
            exportName="certifications"
          />
        </Card>
      )}

      {tab === 'skills' && (
        <Modal open={modal} onClose={() => setModal(false)} title={editS.id ? t('skillEdit') : t('skillNew')}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('nameEn')} value={editS.nameEn} onChange={(v) => setEditS({ ...editS, nameEn: v })} />
              <Input label={t('nameFa')} value={editS.nameFa} onChange={(v) => setEditS({ ...editS, nameFa: v })} />
              <Input label={t('catEn')} value={editS.categoryEn} onChange={(v) => setEditS({ ...editS, categoryEn: v })} />
              <Input label={t('catFa')} value={editS.categoryFa} onChange={(v) => setEditS({ ...editS, categoryFa: v })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label={t('levelPct')} type="number" value={String(editS.level)} onChange={(v) => setEditS({ ...editS, level: Number(v) })} />
              <Input label={t('color')} type="color" value={editS.color} onChange={(v) => setEditS({ ...editS, color: v })} />
              <Input label={t('sortOrder')} type="number" value={String(editS.sortOrder)} onChange={(v) => setEditS({ ...editS, sortOrder: Number(v) })} />
            </div>
            <Select label={t('status')} value={editS.active ? 'true' : 'false'} onChange={(v) => setEditS({ ...editS, active: v === 'true' })} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('hidden') }]} />
            <div className="flex gap-3">
              <Btn onClick={saveSkill} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
              <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {tab === 'certs' && (
        <Modal open={modal} onClose={() => setModal(false)} title={editC.id ? t('certEdit') : t('certNew')}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('nameEn')} value={editC.nameEn} onChange={(v) => setEditC({ ...editC, nameEn: v })} />
              <Input label={t('nameFa')} value={editC.nameFa} onChange={(v) => setEditC({ ...editC, nameFa: v })} />
              <Input label={t('issuer')} value={editC.issuer} onChange={(v) => setEditC({ ...editC, issuer: v })} />
              <Input label={t('issueDate')} value={editC.issueDate} onChange={(v) => setEditC({ ...editC, issueDate: v })} placeholder="2023-01" />
              <Input label={t('credUrl')} value={editC.credentialUrl} onChange={(v) => setEditC({ ...editC, credentialUrl: v })} />
              <Input label={t('color')} type="color" value={editC.color} onChange={(v) => setEditC({ ...editC, color: v })} />
            </div>
            <div className="flex gap-3">
              <Btn onClick={saveCert} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
              <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
