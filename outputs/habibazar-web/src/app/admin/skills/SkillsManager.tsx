'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Skill = { id?: number; nameEn: string; nameFa: string; categoryEn: string; categoryFa: string; level: number; color: string; sortOrder: number; active: boolean }
type Cert = { id?: number; nameEn: string; nameFa: string; issuer: string; issueDate: string; credentialUrl: string; color: string; sortOrder: number; active: boolean }

const EMPTY_SKILL: Skill = { nameEn: '', nameFa: '', categoryEn: '', categoryFa: '', level: 80, color: '#6366f1', sortOrder: 0, active: true }
const EMPTY_CERT: Cert = { nameEn: '', nameFa: '', issuer: '', issueDate: '', credentialUrl: '', color: '#6366f1', sortOrder: 0, active: true }

export function SkillsManager() {
  const t = useT()
  const [skills, setSkills] = useState<Skill[]>([])
  const [certs, setCerts] = useState<Cert[]>([])
  const [tab, setTab] = useState<'skills' | 'certs'>('skills')
  const [modal, setModal] = useState(false)
  const [editS, setEditS] = useState<Skill>(EMPTY_SKILL)
  const [editC, setEditC] = useState<Cert>(EMPTY_CERT)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'hidden'>('all')
  const { toast, ToastContainer } = useToast()

  const filteredSkills = useMemo(() => skills.filter((s) => {
    const q = search.toLowerCase()
    if (q && !s.nameEn.toLowerCase().includes(q) && !s.nameFa.includes(q) && !s.categoryEn.toLowerCase().includes(q)) return false
    if (filterActive === 'active' && !s.active) return false
    if (filterActive === 'hidden' && s.active) return false
    return true
  }), [skills, search, filterActive])

  const filteredCerts = useMemo(() => certs.filter((c) => {
    const q = search.toLowerCase()
    if (q && !c.nameEn.toLowerCase().includes(q) && !c.nameFa.includes(q) && !c.issuer.toLowerCase().includes(q)) return false
    if (filterActive === 'active' && !c.active) return false
    if (filterActive === 'hidden' && c.active) return false
    return true
  }), [certs, search, filterActive])

  async function loadSkills() {
    const r = await fetch('/api/admin/skills')
    const d = await r.json(); setSkills(Array.isArray(d) ? d : [])
  }
  async function loadCerts() {
    const r = await fetch('/api/admin/certifications')
    const d = await r.json(); setCerts(Array.isArray(d) ? d : [])
  }
  useEffect(() => { loadSkills(); loadCerts() }, [])

  async function saveSkill() {
    setSaving(true)
    const res = await fetch('/api/admin/skills', { method: editS.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editS) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); loadSkills() } else toast(t('failed'), 'error')
  }

  async function saveCert() {
    setSaving(true)
    const res = await fetch('/api/admin/certifications', { method: editC.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editC) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); loadCerts() } else toast(t('failed'), 'error')
  }

  async function delSkill(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/skills', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); loadSkills()
  }

  async function delCert(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/certifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); loadCerts()
  }

  async function toggleSkill(s: Skill) {
    await fetch('/api/admin/skills', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, active: !s.active }) })
    toast(t('saved')); loadSkills()
  }

  async function toggleCert(c: Cert) {
    await fetch('/api/admin/certifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) })
    toast(t('saved')); loadCerts()
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('skillsTitle')}
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg bg-[#0c0c14] border border-[#2a2a3e] overflow-hidden">
              <button onClick={() => setTab('skills')} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tab === 'skills' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t('skillsTab')}</button>
              <button onClick={() => setTab('certs')} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tab === 'certs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t('certsTab')}</button>
            </div>
            <Btn onClick={() => { if (tab === 'skills') setEditS(EMPTY_SKILL); else setEditC(EMPTY_CERT); setModal(true) }}>{t('add')}</Btn>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="flex-1 min-w-[200px] bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as typeof filterActive)} className="bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
        </select>
        {(search || filterActive !== 'all') && <button onClick={() => { setSearch(''); setFilterActive('all') }} className="px-3 py-2 text-xs text-slate-400 hover:text-white border border-[#2a2a3e] rounded-lg">✕ Clear</button>}
        <span className="px-3 py-2 text-xs text-slate-500">{tab === 'skills' ? filteredSkills.length : filteredCerts.length} / {tab === 'skills' ? skills.length : certs.length}</span>
      </div>

      {tab === 'skills' ? (
        <Card>
          <Table headers={[t('name'), t('category'), t('level'), t('color'), t('status'), t('actions')]}>
            {filteredSkills.map((s) => (
              <TR key={s.id}>
                <TD><div className="font-medium text-white">{s.nameEn}</div><div className="text-xs text-slate-500">{s.nameFa}</div></TD>
                <TD className="text-slate-400">{s.categoryEn}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#1e1e2e] rounded-full max-w-20">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${s.level}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{s.level}%</span>
                  </div>
                </TD>
                <TD><ColorDot color={s.color} /></TD>
                <TD><Badge color={s.active ? 'green' : 'slate'}>{s.active ? t('active') : t('hidden')}</Badge></TD>
                <TD>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => { setEditS(s); setModal(true) }}>{t('edit')}</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => toggleSkill(s)}>{s.active ? '⏸' : '▶'}</Btn>
                    <Btn size="sm" variant="danger" onClick={() => delSkill(s.id!)}>{t('delete')}</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        </Card>
      ) : (
        <Card>
          <Table headers={[t('name'), t('issuer'), t('date'), t('color'), t('actions')]}>
            {filteredCerts.map((c) => (
              <TR key={c.id}>
                <TD><div className="font-medium text-white">{c.nameEn}</div><div className="text-xs text-slate-500">{c.nameFa}</div></TD>
                <TD className="text-slate-400">{c.issuer}</TD>
                <TD className="text-slate-500 text-xs">{c.issueDate}</TD>
                <TD><ColorDot color={c.color} /></TD>
                <TD>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => { setEditC(c); setModal(true) }}>{t('edit')}</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => toggleCert(c)}>{c.active ? '⏸' : '▶'}</Btn>
                    <Btn size="sm" variant="danger" onClick={() => delCert(c.id!)}>{t('delete')}</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
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
