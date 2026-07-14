'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, SectionDivider, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Tab = 'modules' | 'knowledge' | 'analytics' | 'settings'

interface AiModule {
  id: number
  slug: string
  nameEn: string
  nameFa: string
  descriptionEn: string | null
  descriptionFa: string | null
  icon: string
  category: string
  systemPrompt: string | null
  color: string
  enabled: boolean
  sortOrder: number
  usageCount: number
}

interface KbItem {
  id?: number
  title: string
  type: 'document' | 'faq' | 'snippet' | 'url'
  content: string
  fileUrl: string
  sourceUrl: string
  tags: string
  locale: string
  active: boolean
  priority: number
}

interface Analytics {
  totalConversations: number
  totalMessages: number
  bookmarked: number
  moduleUsage: Record<string, number>
  dailyActivity: { date: string; count: number }[]
  topModules: { slug: string; nameEn: string; icon: string; usageCount: number; enabled: boolean }[]
}

const EMPTY_KB: KbItem = { title: '', type: 'snippet', content: '', fileUrl: '', sourceUrl: '', tags: '', locale: 'both', active: true, priority: 0 }

const COLOR_PRESETS = [
  { value: 'blue', label: 'Blue' }, { value: 'indigo', label: 'Indigo' }, { value: 'cyan', label: 'Cyan' },
  { value: 'red', label: 'Red' }, { value: 'purple', label: 'Purple' }, { value: 'orange', label: 'Orange' },
  { value: 'green', label: 'Green' }, { value: 'yellow', label: 'Yellow' }, { value: 'teal', label: 'Teal' },
  { value: 'amber', label: 'Amber' }, { value: 'rose', label: 'Rose' }, { value: 'slate', label: 'Slate' },
]

const COLOR_DOT: Record<string, string> = {
  blue: '#60a5fa', indigo: '#818cf8', cyan: '#22d3ee', red: '#f87171', purple: '#c084fc',
  orange: '#fb923c', green: '#4ade80', yellow: '#facc15', teal: '#2dd4bf', amber: '#fbbf24',
  rose: '#fb7185', slate: '#94a3b8',
}

export function AiControlCenter() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('modules')
  const [modules, setModules] = useState<AiModule[]>([])
  const [editingModule, setEditingModule] = useState<AiModule | null>(null)
  const [moduleModal, setModuleModal] = useState(false)
  const [kbItems, setKbItems] = useState<KbItem[]>([])
  const [kbModal, setKbModal] = useState(false)
  const [editingKb, setEditingKb] = useState<KbItem>(EMPTY_KB)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/ai-modules').then(r => r.json()).then(setModules).catch(() => {})
    fetch('/api/admin/ai-kb').then(r => r.json()).then(d => setKbItems(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/admin/ai-analytics').then(r => r.json()).then(setAnalytics).catch(() => {})
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      if (d && typeof d === 'object') setSettings(d as Record<string, string>)
    }).catch(() => {})
  }, [])

  async function toggleModule(mod: AiModule) {
    const res = await fetch('/api/admin/ai-modules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: mod.id, enabled: !mod.enabled }),
    })
    if (res.ok) {
      setModules(prev => prev.map(m => m.id === mod.id ? { ...m, enabled: !m.enabled } : m))
      toast(mod.enabled ? t('disabled') : t('enabled'))
    }
  }

  async function saveModule() {
    if (!editingModule) return
    setSaving(true)
    const res = await fetch('/api/admin/ai-modules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingModule),
    })
    setSaving(false)
    if (res.ok) {
      setModules(prev => prev.map(m => m.id === editingModule.id ? editingModule : m))
      toast(t('saved'))
      setModuleModal(false)
    } else toast(t('failed'), 'error')
  }

  async function saveKb() {
    setSaving(true)
    const res = await fetch('/api/admin/ai-kb', {
      method: (editingKb as { id?: number }).id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingKb),
    })
    setSaving(false)
    if (res.ok) {
      toast(t('saved'))
      setKbModal(false)
      fetch('/api/admin/ai-kb').then(r => r.json()).then(d => setKbItems(Array.isArray(d) ? d : []))
    } else toast(t('failed'), 'error')
  }

  async function deleteKb(id: number) {
    if (!confirm(t('confirmDel'))) return
    await fetch('/api/admin/ai-kb', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setKbItems(prev => prev.filter(k => (k as { id?: number }).id !== id))
    toast(t('deleted'))
  }

  async function saveSettings() {
    setSaving(true)
    const all = await fetch('/api/admin/settings').then(r => r.json()).catch(() => ({}))
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(all as Record<string, string>), ...settings }),
    })
    setSaving(false)
    toast(res.ok ? t('saved') : t('failed'), res.ok ? 'success' : 'error')
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'modules', label: t('tabModules') },
    { id: 'knowledge', label: t('tabKnowledge') },
    { id: 'analytics', label: t('tabAnalytics') },
    { id: 'settings', label: t('tabAiSettings') },
  ]

  const enabledCount = modules.filter(m => m.enabled).length
  const kbActiveCount = kbItems.filter(k => k.active).length

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('aiControlTitle')}
        subtitle={t('aiControlSub')}
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-tertiary">{enabledCount}/{modules.length} {t('activeModules')} · {kbActiveCount} {t('kbItemsLabel')}</span>
            <a href="/en/ai" target="_blank" className="px-3 py-1.5 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/10 transition-all">
              {t('openAiPlatform')}
            </a>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tabItem.id ? 'bg-brand text-white' : 'bg-surface text-text-secondary border border-border hover:text-text-primary'}`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── Modules Tab ─────────────────────────────────────────── */}
      {tab === 'modules' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {modules.map(mod => (
              <Card key={mod.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `rgba(${COLOR_DOT[mod.color] ? '99,102,241' : '99,102,241'},0.1)`, border: `1px solid rgba(${COLOR_DOT[mod.color] ? '99,102,241' : '99,102,241'},0.2)` }}>
                    {mod.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text-primary truncate">{mod.nameEn.replace('HBZ ', '')}</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleModule(mod)}
                          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${mod.enabled ? 'bg-brand' : 'bg-surface-2'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform ${mod.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5 truncate">{mod.descriptionEn}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-3xs px-2 py-0.5 rounded-full text-text-secondary" style={{ background: 'rgba(255,255,255,0.05)' }}>{mod.category}</span>
                      <span className="text-xs text-text-disabled">{mod.usageCount} {t('usesLabel')}</span>
                      <button onClick={() => { setEditingModule(mod); setModuleModal(true) }}
                        className="ml-auto text-xs text-text-tertiary hover:text-brand transition-colors">{t('editModule')}</button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Knowledge Base Tab ──────────────────────────────────── */}
      {tab === 'knowledge' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-text-tertiary">{kbItems.length} {t('kbItemsLabel')} · {kbActiveCount} {t('kbActiveLabel')}</p>
            <Btn onClick={() => { setEditingKb(EMPTY_KB); setKbModal(true) }}>{t('addKbItem')}</Btn>
          </div>
          <div className="grid gap-3">
            {kbItems.map((item: KbItem) => (
              <Card key={(item as { id?: number }).id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-brand">[{(item as { id?: number }).id}]</span>
                      <p className="text-sm font-medium text-text-primary">{item.title}</p>
                      <Badge color={item.type === 'document' ? 'blue' : item.type === 'faq' ? 'green' : item.type === 'snippet' ? 'yellow' : 'indigo'}>{item.type}</Badge>
                      {!item.active && <Badge color="slate">{t('disabledLabel')}</Badge>}
                    </div>
                    {item.content && <p className="text-xs text-text-tertiary line-clamp-2">{item.content}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-3xs text-text-disabled">{item.tags}</span>
                      <span className="text-3xs text-text-disabled">priority: {item.priority}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Btn size="sm" variant="secondary" onClick={() => { setEditingKb(item); setKbModal(true) }}>{t('edit')}</Btn>
                    <Btn size="sm" variant="danger" onClick={() => deleteKb((item as { id: number }).id)}>{t('del')}</Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {kbItems.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-text-disabled text-sm mb-4">{t('noKbItems')}</p>
              <Btn onClick={() => { setEditingKb(EMPTY_KB); setKbModal(true) }}>{t('addKbItem')}</Btn>
            </Card>
          )}
        </div>
      )}

      {/* ── Analytics Tab ───────────────────────────────────────── */}
      {tab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('totalConvs'), value: analytics.totalConversations, icon: '💬', color: 'indigo' },
              { label: t('totalMsgs'), value: analytics.totalMessages, icon: '📨', color: 'blue' },
              { label: t('activeModules'), value: enabledCount, icon: '🤖', color: 'green' },
              { label: t('bookmarked'), value: analytics.bookmarked, icon: '🔖', color: 'yellow' },
            ].map(stat => (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{stat.icon}</span>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                    <p className="text-xs text-text-tertiary">{stat.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Top modules */}
          <Card className="p-6">
            <SectionDivider label={t('moduleUsage')} />
            <div className="space-y-3 mt-4">
              {analytics.topModules.map(mod => {
                const maxUsage = Math.max(...analytics.topModules.map(m => m.usageCount), 1)
                return (
                  <div key={mod.slug} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{mod.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-text-primary">{mod.nameEn.replace('HBZ ', '')}</p>
                        <span className="text-xs text-text-tertiary">{mod.usageCount} {t('sessionsLabel')}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand/60" style={{ width: `${(mod.usageCount / maxUsage) * 100}%` }} />
                      </div>
                    </div>
                    <Badge color={mod.enabled ? 'green' : 'slate'}>{mod.enabled ? t('on') : t('off')}</Badge>
                  </div>
                )
              })}
              {analytics.topModules.every(m => m.usageCount === 0) && (
                <p className="text-center text-text-disabled text-sm py-4">{t('noUsageData')}</p>
              )}
            </div>
          </Card>

          {/* Daily activity */}
          {analytics.dailyActivity.length > 0 && (
            <Card className="p-6">
              <SectionDivider label={t('activityDays')} />
              <div className="flex items-end gap-1 mt-4 h-24">
                {analytics.dailyActivity.map(day => {
                  const max = Math.max(...analytics.dailyActivity.map(d => d.count), 1)
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${day.count}`}>
                      <div className="w-full rounded-t" style={{ height: `${(day.count / max) * 80}px`, minHeight: 2, background: 'rgba(99,102,241,0.5)' }} />
                      <span className="text-4xs text-text-disabled truncate w-full text-center">{day.date.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      )}
      {tab === 'analytics' && !analytics && (
        <div className="text-center py-16 text-text-disabled">{t('loadingAnalytics')}</div>
      )}

      {/* ── Settings Tab ───────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <SectionDivider label={t('aiProviderLabel')} />
            <Select label={t('aiProviderLabel')} value={settings.ai_provider || 'chatgpt'}
              onChange={v => setSettings(s => ({ ...s, ai_provider: v }))}
              options={[
                { value: 'chatgpt', label: 'OpenAI (ChatGPT)' },
                { value: 'claude', label: 'Anthropic (Claude)' },
                { value: 'gemini', label: 'Google Gemini' },
                { value: 'grok', label: 'xAI (Grok)' },
                { value: 'conduit', label: 'Conduit (Multi-model proxy)' },
                { value: 'copilot', label: 'GitHub Copilot' },
              ]} />
            <Input label={t('apiKeyLabel')} value={settings.ai_api_key || ''} onChange={v => setSettings(s => ({ ...s, ai_api_key: v }))} type="password" placeholder="sk-..." />
            <Input label={t('modelLabel')} value={settings.ai_model || ''} onChange={v => setSettings(s => ({ ...s, ai_model: v }))} placeholder="gpt-4o / claude-sonnet-4-6 / gemini-1.5-pro" />
            <Input label={t('apiBaseUrl')} value={settings.ai_api_url || ''} onChange={v => setSettings(s => ({ ...s, ai_api_url: v }))} placeholder="https://api.openai.com/v1" />
          </Card>

          <Card className="p-6 space-y-4">
            <SectionDivider label={t('defaultSysPrompt')} />
            <p className="text-xs text-text-tertiary">{t('sysPromptNote')}</p>
            <Input label={t('globalSysPrompt')} value={settings.ai_system_prompt || ''} onChange={v => setSettings(s => ({ ...s, ai_system_prompt: v }))} multiline rows={6}
              placeholder="You are HBZ AI Platform, an enterprise technology advisor..." />
          </Card>

          <Card className="p-6 space-y-4">
            <SectionDivider label={t('ragKnowledge')} />
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-success/[0.06] border border-success/15">
                <p className="text-xs font-semibold text-success mb-1">{t('ragEnabledTitle')}</p>
                <p className="text-xs text-text-tertiary">{t('ragEnabledNote')}</p>
              </div>
              <div className="p-3 rounded-lg bg-brand/[0.06] border border-brand/15">
                <p className="text-xs font-semibold text-brand mb-1">{t('archReadyTitle')}</p>
                <p className="text-xs text-text-tertiary">{t('archReadyNote')}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-warning/[0.06] border border-warning/15">
              <p className="text-xs font-semibold text-warning mb-2">{t('voiceArchTitle')}</p>
              <p className="text-xs text-text-tertiary">{t('voiceArchNote')}</p>
            </div>
          </Card>

          <div className="flex gap-3">
            <Btn onClick={saveSettings} disabled={saving}>{saving ? t('saving') : t('saveSettings')}</Btn>
          </div>
        </div>
      )}

      {/* Module edit modal */}
      <Modal open={moduleModal} onClose={() => setModuleModal(false)} title={t('editAiModule')} size="lg">
        {editingModule && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('nameEn')} value={editingModule.nameEn} onChange={v => setEditingModule(e => e ? { ...e, nameEn: v } : e)} />
              <Input label={t('nameFa')} value={editingModule.nameFa} onChange={v => setEditingModule(e => e ? { ...e, nameFa: v } : e)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('descriptionEn')} value={editingModule.descriptionEn || ''} onChange={v => setEditingModule(e => e ? { ...e, descriptionEn: v } : e)} />
              <Input label={t('descriptionFa')} value={editingModule.descriptionFa || ''} onChange={v => setEditingModule(e => e ? { ...e, descriptionFa: v } : e)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label={t('iconEmoji')} value={editingModule.icon} onChange={v => setEditingModule(e => e ? { ...e, icon: v } : e)} />
              <Select label={t('color')} value={editingModule.color} onChange={v => setEditingModule(e => e ? { ...e, color: v } : e)}
                options={COLOR_PRESETS} />
              <Input label={t('sortOrder')} type="number" value={String(editingModule.sortOrder)} onChange={v => setEditingModule(e => e ? { ...e, sortOrder: Number(v) } : e)} />
            </div>
            <Input label={t('systemPromptLabel')} value={editingModule.systemPrompt || ''} onChange={v => setEditingModule(e => e ? { ...e, systemPrompt: v } : e)} multiline rows={8} placeholder="You are HBZ [Module Name], an expert in..." />
            <div className="flex gap-3">
              <Btn onClick={saveModule} disabled={saving}>{saving ? t('saving') : t('saveModule')}</Btn>
              <Btn variant="secondary" onClick={() => setModuleModal(false)}>{t('cancel')}</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* KB edit modal */}
      <Modal open={kbModal} onClose={() => setKbModal(false)} title={(editingKb as { id?: number }).id ? t('editKbItem') : t('newKbItem')} size="lg">
        <div className="space-y-4">
          <Input label={t('kbTitleStar')} value={editingKb.title} onChange={v => setEditingKb(e => ({ ...e, title: v }))} placeholder="HBZ Professional Profile" />
          <div className="grid grid-cols-3 gap-4">
            <Select label={t('kbTypeLabel')} value={editingKb.type} onChange={v => setEditingKb(e => ({ ...e, type: v as KbItem['type'] }))}
              options={[{ value: 'snippet', label: 'Snippet' }, { value: 'document', label: 'Document' }, { value: 'faq', label: 'FAQ' }, { value: 'url', label: 'URL' }]} />
            <Select label={t('kbLocaleLabel')} value={editingKb.locale} onChange={v => setEditingKb(e => ({ ...e, locale: v }))}
              options={[{ value: 'both', label: t('both') }, { value: 'en', label: t('english') }, { value: 'fa', label: t('persian') }]} />
            <Input label={t('kbPriority')} type="number" value={String(editingKb.priority)} onChange={v => setEditingKb(e => ({ ...e, priority: Number(v) }))} />
          </div>
          {(editingKb.type === 'snippet' || editingKb.type === 'faq' || editingKb.type === 'document') && (
            <Input label={t('kbContentLabel')} value={editingKb.content} onChange={v => setEditingKb(e => ({ ...e, content: v }))} multiline rows={10}
              placeholder="Knowledge content injected as RAG context for AI responses..." />
          )}
          {editingKb.type === 'url' && (
            <Input label={t('kbSourceUrl')} value={editingKb.sourceUrl} onChange={v => setEditingKb(e => ({ ...e, sourceUrl: v }))} placeholder="https://..." />
          )}
          {editingKb.type === 'document' && (
            <Input label={t('kbFileUrl')} value={editingKb.fileUrl} onChange={v => setEditingKb(e => ({ ...e, fileUrl: v }))} placeholder="/uploads/knowledge/doc.pdf" />
          )}
          <Input label={t('kbTagsLabel')} value={editingKb.tags} onChange={v => setEditingKb(e => ({ ...e, tags: v }))} placeholder="network, cisco, mikrotik, bgp" />
          <Select label={t('kbStatusLabel')} value={editingKb.active ? 'true' : 'false'} onChange={v => setEditingKb(e => ({ ...e, active: v === 'true' }))}
            options={[{ value: 'true', label: t('kbActive') }, { value: 'false', label: t('disabledLabel') }]} />
          <div className="flex gap-3">
            <Btn onClick={saveKb} disabled={saving}>{saving ? t('saving') : t('saveItem')}</Btn>
            <Btn variant="secondary" onClick={() => setKbModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
