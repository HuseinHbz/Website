'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'

type Skill = { id?: number; nameEn: string; nameFa: string; categoryEn: string; categoryFa: string; level: number; color: string; sortOrder: number; active: boolean }
type Cert = { id?: number; nameEn: string; nameFa: string; issuer: string; issueDate: string; credentialUrl: string; color: string; sortOrder: number; active: boolean }

const EMPTY_SKILL: Skill = { nameEn: '', nameFa: '', categoryEn: '', categoryFa: '', level: 80, color: '#6366f1', sortOrder: 0, active: true }
const EMPTY_CERT: Cert = { nameEn: '', nameFa: '', issuer: '', issueDate: '', credentialUrl: '', color: '#6366f1', sortOrder: 0, active: true }

export function SkillsManager() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [certs, setCerts] = useState<Cert[]>([])
  const [tab, setTab] = useState<'skills' | 'certs'>('skills')
  const [modal, setModal] = useState(false)
  const [editS, setEditS] = useState<Skill>(EMPTY_SKILL)
  const [editC, setEditC] = useState<Cert>(EMPTY_CERT)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function loadSkills() { const r = await fetch('/api/admin/skills'); setSkills(await r.json()) }
  async function loadCerts() { const r = await fetch('/api/admin/certifications'); setCerts(await r.json()) }
  useEffect(() => { loadSkills(); loadCerts() }, [])

  async function saveSkill() {
    setSaving(true)
    const res = await fetch('/api/admin/skills', { method: editS.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editS) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); loadSkills() } else toast('Failed', 'error')
  }

  async function saveCert() {
    setSaving(true)
    const res = await fetch('/api/admin/certifications', { method: editC.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editC) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); loadCerts() } else toast('Failed', 'error')
  }

  async function delSkill(id: number) {
    if (!confirm('Delete?')) return
    await fetch('/api/admin/skills', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); loadSkills()
  }

  async function delCert(id: number) {
    if (!confirm('Delete?')) return
    await fetch('/api/admin/certifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); loadCerts()
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title="Skills & Certifications"
        action={
          <div className="flex gap-2">
            <div className="flex rounded-lg bg-[#0c0c14] border border-[#2a2a3e] overflow-hidden">
              <button onClick={() => setTab('skills')} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tab === 'skills' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Skills</button>
              <button onClick={() => setTab('certs')} className={`px-4 py-1.5 text-xs font-medium transition-colors ${tab === 'certs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Certifications</button>
            </div>
            <Btn onClick={() => { if (tab === 'skills') { setEditS(EMPTY_SKILL) } else { setEditC(EMPTY_CERT) }; setModal(true) }}>+ Add</Btn>
          </div>
        }
      />

      {tab === 'skills' ? (
        <Card>
          <Table headers={['Skill', 'Category', 'Level', 'Color', 'Active', 'Actions']}>
            {skills.map((s) => (
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
                <TD><Badge color={s.active ? 'green' : 'slate'}>{s.active ? 'Active' : 'Hidden'}</Badge></TD>
                <TD>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => { setEditS(s); setModal(true) }}>Edit</Btn>
                    <Btn size="sm" variant="danger" onClick={() => delSkill(s.id!)}>Del</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        </Card>
      ) : (
        <Card>
          <Table headers={['Certification', 'Issuer', 'Date', 'Color', 'Actions']}>
            {certs.map((c) => (
              <TR key={c.id}>
                <TD><div className="font-medium text-white">{c.nameEn}</div><div className="text-xs text-slate-500">{c.nameFa}</div></TD>
                <TD className="text-slate-400">{c.issuer}</TD>
                <TD className="text-slate-500 text-xs">{c.issueDate}</TD>
                <TD><ColorDot color={c.color} /></TD>
                <TD>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => { setEditC(c); setModal(true) }}>Edit</Btn>
                    <Btn size="sm" variant="danger" onClick={() => delCert(c.id!)}>Del</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        </Card>
      )}

      {/* Skill Modal */}
      {tab === 'skills' && (
        <Modal open={modal} onClose={() => setModal(false)} title={editS.id ? 'Edit Skill' : 'New Skill'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name (English)" value={editS.nameEn} onChange={(v) => setEditS({ ...editS, nameEn: v })} />
              <Input label="Name (Persian)" value={editS.nameFa} onChange={(v) => setEditS({ ...editS, nameFa: v })} />
              <Input label="Category (English)" value={editS.categoryEn} onChange={(v) => setEditS({ ...editS, categoryEn: v })} />
              <Input label="Category (Persian)" value={editS.categoryFa} onChange={(v) => setEditS({ ...editS, categoryFa: v })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Level (0-100)" type="number" value={String(editS.level)} onChange={(v) => setEditS({ ...editS, level: Number(v) })} />
              <Input label="Color" type="color" value={editS.color} onChange={(v) => setEditS({ ...editS, color: v })} />
              <Input label="Sort Order" type="number" value={String(editS.sortOrder)} onChange={(v) => setEditS({ ...editS, sortOrder: Number(v) })} />
            </div>
            <Select label="Status" value={editS.active ? 'true' : 'false'} onChange={(v) => setEditS({ ...editS, active: v === 'true' })} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Hidden' }]} />
            <div className="flex gap-3">
              <Btn onClick={saveSkill} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
              <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Cert Modal */}
      {tab === 'certs' && (
        <Modal open={modal} onClose={() => setModal(false)} title={editC.id ? 'Edit Certification' : 'New Certification'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name (English)" value={editC.nameEn} onChange={(v) => setEditC({ ...editC, nameEn: v })} />
              <Input label="Name (Persian)" value={editC.nameFa} onChange={(v) => setEditC({ ...editC, nameFa: v })} />
              <Input label="Issuer" value={editC.issuer} onChange={(v) => setEditC({ ...editC, issuer: v })} />
              <Input label="Issue Date" value={editC.issueDate} onChange={(v) => setEditC({ ...editC, issueDate: v })} placeholder="2023-01" />
              <Input label="Credential URL" value={editC.credentialUrl} onChange={(v) => setEditC({ ...editC, credentialUrl: v })} />
              <Input label="Color" type="color" value={editC.color} onChange={(v) => setEditC({ ...editC, color: v })} />
            </div>
            <div className="flex gap-3">
              <Btn onClick={saveCert} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
              <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
