'use client'

import { useEffect, useState } from 'react'
import { Card, Btn, Input, useToast } from '@/components/admin/ui'

type Org = {
  id?: number
  legalNameEn: string
  legalNameFa: string
  brandNameEn: string
  brandNameFa: string
  taglineEn: string | null
  taglineFa: string | null
  missionEn: string | null
  website: string | null
  email: string | null
  phone: string | null
  primaryColor: string | null
  secondaryColor: string | null
  logoUrl: string | null
}

export function OrganizationManager() {
  const [org, setOrg] = useState<Partial<Org>>({ legalNameEn: 'HBZ Technology', legalNameFa: 'فناوری HBZ', brandNameEn: 'HBZ Technology', brandNameFa: 'فناوری HBZ', primaryColor: '#6366f1', secondaryColor: '#06b6d4' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'brand' | 'contact' | 'legal'>('brand')
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/organization').then(r => r.json()).then(data => { if (data?.id) setOrg(data); setLoading(false) })
  }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/organization', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(org) })
    if (res.ok) toast('Organization profile saved', 'success')
    else toast('Save failed', 'error')
    setSaving(false)
  }

  const TABS = [{ id: 'brand', label: 'Brand Identity' }, { id: 'contact', label: 'Contact & Location' }, { id: 'legal', label: 'Legal Info' }] as const

  if (loading) return <div className="text-slate-500 text-center py-16">Loading…</div>

  return (
    <div>
      <ToastContainer />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Organization Management</h1>
          <p className="text-slate-400 text-sm mt-1">Company profile, brand assets, and legal information</p>
        </div>
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Btn>
      </div>

      {/* Brand preview */}
      <div className="rounded-2xl p-6 mb-6 flex items-center gap-5" style={{ background: `linear-gradient(135deg, ${org.primaryColor || '#6366f1'}20, ${org.secondaryColor || '#06b6d4'}10)`, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white" style={{ background: org.primaryColor || '#6366f1' }}>
          {(org.brandNameEn || 'HBZ').substring(0, 3)}
        </div>
        <div>
          <div className="text-xl font-bold text-white">{org.brandNameEn}</div>
          <div className="text-slate-400 text-sm">{org.taglineEn || 'Enterprise Technology Solutions'}</div>
          <div className="text-slate-500 text-xs mt-1">{org.website}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        {activeTab === 'brand' && (
          <div className="grid grid-cols-2 gap-4 p-1">
            <Input label="Legal Name (EN)" value={org.legalNameEn || ''} onChange={v => setOrg(o => ({ ...o, legalNameEn: v }))} />
            <Input label="Legal Name (FA)" value={org.legalNameFa || ''} onChange={v => setOrg(o => ({ ...o, legalNameFa: v }))} />
            <Input label="Brand Name (EN)" value={org.brandNameEn || ''} onChange={v => setOrg(o => ({ ...o, brandNameEn: v }))} />
            <Input label="Brand Name (FA)" value={org.brandNameFa || ''} onChange={v => setOrg(o => ({ ...o, brandNameFa: v }))} />
            <div className="col-span-2"><Input label="Tagline (EN)" value={org.taglineEn || ''} onChange={v => setOrg(o => ({ ...o, taglineEn: v }))} /></div>
            <div className="col-span-2"><Input label="Tagline (FA)" value={org.taglineFa || ''} onChange={v => setOrg(o => ({ ...o, taglineFa: v }))} /></div>
            <div className="col-span-2"><Input label="Mission Statement (EN)" value={org.missionEn || ''} onChange={v => setOrg(o => ({ ...o, missionEn: v }))} /></div>
            <Input label="Primary Color" value={org.primaryColor || ''} onChange={v => setOrg(o => ({ ...o, primaryColor: v }))} />
            <Input label="Secondary Color" value={org.secondaryColor || ''} onChange={v => setOrg(o => ({ ...o, secondaryColor: v }))} />
            <div className="col-span-2"><Input label="Logo URL" value={org.logoUrl || ''} onChange={v => setOrg(o => ({ ...o, logoUrl: v }))} /></div>
          </div>
        )}
        {activeTab === 'contact' && (
          <div className="grid grid-cols-2 gap-4 p-1">
            <div className="col-span-2"><Input label="Website" value={org.website || ''} onChange={v => setOrg(o => ({ ...o, website: v }))} /></div>
            <Input label="Email" value={org.email || ''} onChange={v => setOrg(o => ({ ...o, email: v }))} />
            <Input label="Phone" value={org.phone || ''} onChange={v => setOrg(o => ({ ...o, phone: v }))} />
          </div>
        )}
        {activeTab === 'legal' && (
          <div className="py-8 text-center text-slate-500 text-sm">
            <div className="text-3xl mb-3">⚖️</div>
            <div>Legal info management coming soon.</div>
            <div className="text-xs mt-1">Tax ID, registration numbers, certificates will be managed here.</div>
          </div>
        )}
      </Card>
    </div>
  )
}
