'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Badge, Btn, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Integration = { id: number; slug: string; nameEn: string; category: string; icon: string; color: string; enabled: boolean; status: string; lastSyncAt: string | null; errorMessage: string | null }

const CATEGORY_LABELS: Record<string, string> = { productivity: 'Productivity', cloud: 'Cloud', communication: 'Communication', devops: 'DevOps', project: 'Project Management', infrastructure: 'Infrastructure', payments: 'Payments' }
const STATUS_COLORS: Record<string, string> = { active: 'green', error: 'red', disabled: 'slate', pending: 'yellow' }

export function IntegrationsManager() {
  const t = useT()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const { toast, ToastContainer } = useToast()

  async function load() { setLoading(true); const r = await fetch('/api/admin/integrations'); setIntegrations(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function toggle(integ: Integration) {
    const newEnabled = !integ.enabled
    const res = await fetch('/api/admin/integrations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: integ.id, enabled: newEnabled, status: newEnabled ? 'pending' : 'disabled' }) })
    if (res.ok) { toast(newEnabled ? `${integ.nameEn} enabled` : `${integ.nameEn} disabled`, 'success'); load() }
  }

  const grouped = integrations.reduce<Record<string, Integration[]>>((acc, i) => { if (!acc[i.category]) acc[i.category] = []; acc[i.category].push(i); return acc }, {})

  return (
    <div>
      <ToastContainer />
      <PageHeader title={t('integrationsTitle')} subtitle={`${integrations.filter(i => i.enabled).length} active · ${integrations.length} total`} />

      {loading ? <div className="text-center py-16 text-text-tertiary">{t('loading')}</div> : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-text-disabled mb-4">{CATEGORY_LABELS[cat] || cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(integ => (
                  <div key={integ.id} className="rounded-2xl p-5 flex items-start gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${integ.enabled ? integ.color + '30' : 'rgba(255,255,255,0.08)'}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${integ.color}20`, border: `1px solid ${integ.color}30` }}>
                      {integ.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-white">{integ.nameEn}</div>
                        <Badge color={STATUS_COLORS[integ.status] || 'slate'}>{integ.status}</Badge>
                      </div>
                      <div className="text-xs text-text-tertiary mb-3">{integ.lastSyncAt ? `Last sync: ${integ.lastSyncAt.slice(0, 16)}` : 'Never synced'}</div>
                      {integ.errorMessage && <div className="text-xs text-red-400 mb-2 truncate">{integ.errorMessage}</div>}
                      <button onClick={() => toggle(integ)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${integ.enabled ? 'bg-brand' : 'bg-surface-2'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${integ.enabled ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
