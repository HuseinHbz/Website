'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiModule {
  id: number
  slug: string
  nameEn: string
  nameFa: string
  descriptionEn: string | null
  descriptionFa: string | null
  icon: string
  category: string
  color: string
  enabled: boolean
}

interface KbSource {
  id: number
  title: string
  excerpt: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: KbSource[]
  suggestions?: string[]
  timestamp: string
}

interface Conversation {
  id: string
  moduleSlug: string | null
  titleEn: string | null
  locale: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

interface SearchResult {
  type: 'knowledge' | 'project' | 'blog'
  id: number
  title: string
  excerpt: string
  url?: string
  score: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTIONS_EN: Record<string, string[]> = {
  infrastructure: ['How to design a highly available data center?', 'What storage solution for 500TB capacity?', 'Best practices for server virtualization?'],
  network: ['How to implement BGP between two sites?', 'Best VLAN design for enterprise?', 'How to configure SD-WAN failover?'],
  cloud: ['Azure vs AWS for enterprise workloads?', 'How to plan a cloud migration?', 'Cost optimization strategies for cloud?'],
  security: ['How to implement Zero Trust architecture?', 'Best practices for firewall segmentation?', 'How to set up a SOC?'],
  virtualization: ['VMware vSAN vs traditional SAN?', 'How to migrate physical to virtual?', 'Kubernetes vs VMware for containers?'],
  microsoft: ['How to design Active Directory for 5000 users?', 'Exchange on-prem vs Microsoft 365?', 'Intune vs SCCM for device management?'],
  linux: ['How to harden a Linux server?', 'Bash script for automated backup?', 'Linux performance tuning tips?'],
  monitoring: ['How to set up Zabbix for 200 hosts?', 'Prometheus + Grafana architecture?', 'Best SNMP monitoring practices?'],
  career: ['CCNP vs Azure certification — which first?', 'How to transition from networking to cloud?', 'Best study resources for CCIE?'],
  documentation: ['How to write a network runbook?', 'Template for IT disaster recovery plan?', 'Best format for architecture documentation?'],
  architecture: ['How to review a three-tier architecture?', 'Key questions for architecture risk assessment?', 'Microservices vs monolith for enterprise?'],
  project: ['How to plan a data center migration?', 'IT project risk management framework?', 'Resource estimation for infrastructure project?'],
  solution: ['How to create a technical proposal?', 'What to include in a network BoM?', 'How to present ROI for IT investment?'],
  troubleshooting: ['Network packet loss troubleshooting steps?', 'How to diagnose slow server performance?', 'Systematic approach to firewall issues?'],
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa', badge: 'bg-blue-500/20 text-blue-300' },
  indigo: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', text: '#818cf8', badge: 'bg-indigo-500/20 text-indigo-300' },
  cyan: { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)', text: '#22d3ee', badge: 'bg-cyan-500/20 text-cyan-300' },
  red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#f87171', badge: 'bg-red-500/20 text-red-300' },
  purple: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)', text: '#c084fc', badge: 'bg-purple-500/20 text-purple-300' },
  orange: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', text: '#fb923c', badge: 'bg-orange-500/20 text-orange-300' },
  green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80', badge: 'bg-green-500/20 text-green-300' },
  yellow: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)', text: '#facc15', badge: 'bg-yellow-500/20 text-yellow-300' },
  slate: { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', text: '#94a3b8', badge: 'bg-slate-500/20 text-slate-300' },
  teal: { bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.3)', text: '#2dd4bf', badge: 'bg-teal-500/20 text-teal-300' },
  amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24', badge: 'bg-amber-500/20 text-amber-300' },
  rose: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)', text: '#fb7185', badge: 'bg-rose-500/20 text-rose-300' },
}
function getColor(c: string) { return COLOR_MAP[c] || COLOR_MAP.indigo }

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let codeBlock = false
  let codeLines: string[] = []
  let codeKey = 0

  const processInline = (line: string, key: number): React.ReactNode => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\[(\d+)\])/g)
    return (
      <span key={key}>
        {parts.map((p, i) => {
          if (/^\*\*.*\*\*$/.test(p)) return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>
          if (/^`[^`]+`$/.test(p)) return <code key={i} className="px-1 py-0.5 rounded text-xs font-mono text-indigo-300 bg-indigo-500/15">{p.slice(1, -1)}</code>
          if (/^\[\d+\]$/.test(p)) return <sup key={i} className="text-indigo-400 text-3xs ml-0.5 cursor-pointer">{p}</sup>
          return p
        })}
      </span>
    )
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (!codeBlock) { codeBlock = true; codeLines = []; continue }
      codeBlock = false
      const k = `code-${codeKey++}`
      nodes.push(
        <pre key={k} className="my-3 p-3 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {codeLines.join('\n')}
        </pre>
      )
      continue
    }
    if (codeBlock) { codeLines.push(line); continue }

    if (line.startsWith('### ')) nodes.push(<h3 key={i} className="text-sm font-bold text-white mt-3 mb-1">{line.slice(4)}</h3>)
    else if (line.startsWith('## ')) nodes.push(<h2 key={i} className="text-base font-bold text-white mt-4 mb-2">{line.slice(3)}</h2>)
    else if (line.startsWith('# ')) nodes.push(<h1 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>)
    else if (line.startsWith('- ') || line.startsWith('* ')) nodes.push(<li key={i} className="text-sm text-slate-300 leading-relaxed ml-4 list-disc">{processInline(line.slice(2), i)}</li>)
    else if (/^\d+\. /.test(line)) nodes.push(<li key={i} className="text-sm text-slate-300 leading-relaxed ml-4 list-decimal">{processInline(line.replace(/^\d+\. /, ''), i)}</li>)
    else if (line.trim() === '') nodes.push(<div key={i} className="h-2" />)
    else nodes.push(<p key={i} className="text-sm text-slate-300 leading-relaxed">{processInline(line, i)}</p>)
  }
  return nodes
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { locale: 'en' | 'fa' }

export function AiPlatform({ locale }: Props) {
  const isRTL = locale === 'fa'
  const [modules, setModules] = useState<AiModule[]>([])
  const [activeModule, setActiveModule] = useState<AiModule | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [contextOpen, setContextOpen] = useState(true)
  const [currentSources, setCurrentSources] = useState<KbSource[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [convId] = useState(() => `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputId = useId()

  const t = useCallback((en: string, fa: string) => isRTL ? fa : en, [isRTL])

  // Load modules
  useEffect(() => {
    fetch('/api/ai/modules').then(r => r.json()).then((rows: AiModule[]) => {
      setModules(rows)
      if (rows.length > 0) setActiveModule(rows[0])
    }).catch(() => {})
  }, [])

  // Load conversation history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hbz-ai-history')
      if (stored) setConversations(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on module change
  useEffect(() => {
    if (activeModule) inputRef.current?.focus()
  }, [activeModule])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(s => !s) }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    setSearchLoading(true)
    searchTimeout.current = setTimeout(() => {
      fetch(`/api/ai/search?q=${encodeURIComponent(searchQuery)}&locale=${locale}`)
        .then(r => r.json()).then((d: SearchResult[]) => { setSearchResults(d); setSearchLoading(false) })
        .catch(() => setSearchLoading(false))
    }, 300)
  }, [searchQuery, locale])

  function switchModule(mod: AiModule) {
    if (activeModule?.slug === mod.slug) return
    if (messages.length > 0) saveConversation()
    setActiveModule(mod)
    setMessages([])
    setCurrentSources([])
    setInput('')
  }

  function saveConversation() {
    if (messages.length === 0) return
    const conv: Conversation = {
      id: convId,
      moduleSlug: activeModule?.slug || null,
      titleEn: messages.find(m => m.role === 'user')?.content.slice(0, 60) || 'Conversation',
      locale,
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = [conv, ...conversations.filter(c => c.id !== convId)].slice(0, 50)
    setConversations(updated)
    try { localStorage.setItem('hbz-ai-history', JSON.stringify(updated)) } catch { /* ignore */ }
    // Persist to DB
    fetch('/api/ai/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: convId, moduleSlug: activeModule?.slug, titleEn: conv.titleEn, locale, messagesJson: JSON.stringify(messages), sourcesJson: JSON.stringify(currentSources) }),
    }).catch(() => {})
  }

  function exportConversation() {
    const text = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hbz-ai-${activeModule?.slug || 'conversation'}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sendMessage = useCallback(async (content?: string) => {
    const text = (content || input).trim()
    if (!text || isLoading) return
    setInput('')

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() }
    const assistantId = `a-${Date.now()}`
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() }])
    setIsLoading(true)

    try {
      const apiMessages = [...messages, userMsg]
        .filter(m => m.content)
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, locale, moduleSlug: activeModule?.slug }),
      })
      const data = await res.json() as { reply: string; sources?: KbSource[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'AI error')

      const suggestList = (SUGGESTIONS_EN[activeModule?.slug || ''] || []).filter(s => !messages.some(m => m.content.includes(s))).slice(0, 3)

      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: data.reply, sources: data.sources || [], suggestions: suggestList }
        : m
      ))
      if (data.sources?.length) setCurrentSources(data.sources)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'AI error'
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `⚠ ${errMsg}` } : m))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, locale, activeModule])

  function clearChat() {
    if (messages.length > 0) saveConversation()
    setMessages([])
    setCurrentSources([])
    setInput('')
  }

  const groupedConvs = conversations.reduce<{ today: Conversation[]; week: Conversation[]; older: Conversation[] }>((acc, c) => {
    const diff = Date.now() - new Date(c.createdAt).getTime()
    if (diff < 86400000) acc.today.push(c)
    else if (diff < 604800000) acc.week.push(c)
    else acc.older.push(c)
    return acc
  }, { today: [], week: [], older: [] })

  return (
    <div className="flex flex-col h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0" style={{ background: 'rgba(8,8,15,0.95)', backdropFilter: 'blur(12px)' }}>
        <Link href={`/${locale}`} className="flex items-center gap-2 mr-2 rtl:mr-0 rtl:ml-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-3xs font-black">HBZ</div>
          {!isRTL
            ? <span className="text-sm font-bold text-white hidden sm:block">AI Platform</span>
            : <span className="text-sm font-bold text-white hidden sm:block">پلتفرم هوش مصنوعی</span>
          }
        </Link>
        <div className="h-4 w-px bg-border-strong hidden sm:block" />
        {activeModule && (
          <div className="flex items-center gap-2">
            <span className="text-base">{activeModule.icon}</span>
            <span className="text-sm font-medium text-slate-300 hidden sm:block">
              {isRTL ? activeModule.nameFa : activeModule.nameEn}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto rtl:ml-0 rtl:mr-auto">
          {/* Search */}
          <button onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span>🔍</span>
            <span className="hidden md:block">{t('Search knowledge...', 'جستجوی دانش...')}</span>
            <kbd className="text-3xs hidden md:block opacity-50">⌘K</kbd>
          </button>
          {/* Export */}
          {messages.length > 0 && (
            <button onClick={exportConversation} title={t('Export conversation', 'خروجی گفتگو')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all text-xs">↓</button>
          )}
          {/* Clear */}
          {messages.length > 0 && (
            <button onClick={clearChat} title={t('New conversation', 'گفتگوی جدید')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all text-xs">✕</button>
          )}
          {/* Sidebar toggles */}
          <button onClick={() => setSidebarOpen(s => !s)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all" title={t('Toggle sidebar', 'تغییر نوار کناری')}>
            <span className="text-base">☰</span>
          </button>
          <button onClick={() => setContextOpen(s => !s)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all hidden xl:block" title={t('Toggle context', 'تغییر پنل زمینه')}>
            <span className="text-base">◧</span>
          </button>
          <Link href={`/${locale}`}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-strong hover:border-indigo-500/40 transition-all hidden sm:flex items-center gap-1">
            <span>↗</span> {t('Back to site', 'بازگشت به سایت')}
          </Link>
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────────── */}
        {sidebarOpen && (
          <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border overflow-hidden" style={{ background: 'rgba(10,10,20,0.8)' }}>
            {/* Modules */}
            <div className="flex-shrink-0 px-3 pt-3 pb-2">
              <p className="text-3xs font-bold uppercase tracking-widest text-slate-600 px-1 mb-2">{t('AI Advisors', 'مشاوران هوش مصنوعی')}</p>
              <div className="space-y-0.5">
                {modules.map(mod => {
                  const c = getColor(mod.color)
                  const active = activeModule?.slug === mod.slug
                  return (
                    <button key={mod.slug} onClick={() => switchModule(mod)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-start transition-all group"
                      style={active ? { background: c.bg, border: `1px solid ${c.border}` } : { border: '1px solid transparent' }}>
                      <span className="text-base w-5 text-center flex-shrink-0">{mod.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: active ? c.text : '#94a3b8' }}>
                          {isRTL ? mod.nameFa : mod.nameEn}
                        </p>
                      </div>
                      {active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.text }} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border mx-3 my-1" />

            {/* History */}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <p className="text-3xs font-bold uppercase tracking-widest text-slate-600 px-1 mb-2">{t('History', 'تاریخچه')}</p>
              {conversations.length === 0 && (
                <p className="text-xs text-slate-700 px-1">{t('No conversations yet', 'هنوز گفتگویی نیست')}</p>
              )}
              {groupedConvs.today.length > 0 && (
                <div className="mb-2">
                  <p className="text-4xs text-slate-700 uppercase font-bold px-1 mb-1">{t('Today', 'امروز')}</p>
                  {groupedConvs.today.map(c => (
                    <button key={c.id} className="w-full text-start px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-all truncate block">
                      {c.titleEn || t('Conversation', 'گفتگو')}
                    </button>
                  ))}
                </div>
              )}
              {groupedConvs.week.length > 0 && (
                <div className="mb-2">
                  <p className="text-4xs text-slate-700 uppercase font-bold px-1 mb-1">{t('This Week', 'این هفته')}</p>
                  {groupedConvs.week.map(c => (
                    <button key={c.id} className="w-full text-start px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-all truncate block">
                      {c.titleEn || t('Conversation', 'گفتگو')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom: new chat */}
            <div className="p-3 border-t border-border">
              <button onClick={clearChat}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-indigo-400 hover:text-white hover:bg-indigo-500/10 transition-all border border-indigo-500/20 hover:border-indigo-500/40">
                ✦ {t('New Conversation', 'گفتگوی جدید')}
              </button>
            </div>
          </aside>
        )}

        {/* ── Center: Chat ──────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Module header */}
          {activeModule && (
            <div className="flex-shrink-0 px-6 py-3 border-b border-border flex items-center gap-3"
              style={{ background: 'rgba(10,10,20,0.6)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: getColor(activeModule.color).bg, border: `1px solid ${getColor(activeModule.color).border}` }}>
                {activeModule.icon}
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">{isRTL ? activeModule.nameFa : activeModule.nameEn}</h1>
                <p className="text-xs text-slate-500">{isRTL ? (activeModule.descriptionFa || activeModule.descriptionEn) : activeModule.descriptionEn}</p>
              </div>
              <div className="ml-auto rtl:ml-0 rtl:mr-auto flex items-center gap-2">
                <span className="text-3xs px-2 py-0.5 rounded-full font-medium" style={{ background: getColor(activeModule.color).bg, color: getColor(activeModule.color).text, border: `1px solid ${getColor(activeModule.color).border}` }}>
                  {t('Enterprise AI', 'هوش مصنوعی سازمانی')}
                </span>
              </div>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
            {messages.length === 0 && activeModule && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
                  style={{ background: getColor(activeModule.color).bg, border: `1px solid ${getColor(activeModule.color).border}` }}>
                  {activeModule.icon}
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {isRTL ? activeModule.nameFa : activeModule.nameEn}
                </h2>
                <p className="text-sm text-slate-500 mb-8">
                  {isRTL ? (activeModule.descriptionFa || activeModule.descriptionEn) : activeModule.descriptionEn}
                </p>
                <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                  {(SUGGESTIONS_EN[activeModule.slug] || []).map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      className="text-sm text-start px-4 py-3 rounded-xl text-slate-400 hover:text-white transition-all"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="flex-shrink-0 mt-1">
                  {msg.role === 'assistant' ? (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: activeModule ? getColor(activeModule.color).bg : 'rgba(99,102,241,0.15)', border: `1px solid ${activeModule ? getColor(activeModule.color).border : 'rgba(99,102,241,0.3)'}` }}>
                      {activeModule?.icon || '🤖'}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.4)' }}>
                      U
                    </div>
                  )}
                </div>

                {/* Bubble */}
                <div className={`max-w-[78%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm text-white" style={{ background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(99,102,241,0.4)' }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {msg.content === '' ? <TypingDots /> : <div className="space-y-1">{renderMarkdown(msg.content)}</div>}
                    </div>
                  )}

                  {/* Sources */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && msg.content !== '' && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <span key={src.id} className="text-3xs px-2 py-0.5 rounded-full text-indigo-300 cursor-default" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
                          title={src.excerpt}>
                          [{i + 1}] {src.title.slice(0, 30)}{src.title.length > 30 ? '…' : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && msg.content !== '' && (
                    <div className="flex flex-col gap-1 w-full mt-1">
                      <p className="text-3xs text-slate-600 font-medium">{t('Continue exploring:', 'ادامه دهید:')}</p>
                      {msg.suggestions.map((s, i) => (
                        <button key={i} onClick={() => sendMessage(s)}
                          className="text-xs text-start px-3 py-2 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
                          style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                          ↳ {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 px-4 md:px-8 py-4 border-t border-border" style={{ background: 'rgba(10,10,20,0.8)' }}>
            <div className="max-w-4xl mx-auto">
              <div className="relative rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <textarea
                  ref={inputRef}
                  id={inputId}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder={activeModule ? t(`Ask ${isRTL ? activeModule.nameFa : activeModule.nameEn}...`, `از ${activeModule.nameFa} بپرسید...`) : t('Select a module to start...', 'یک ماژول انتخاب کنید...')}
                  disabled={!activeModule || isLoading}
                  rows={1}
                  className="w-full bg-transparent px-4 py-3.5 pr-14 text-sm text-white placeholder-slate-600 resize-none focus:outline-none"
                  style={{ maxHeight: '120px', direction: isRTL ? 'rtl' : 'ltr' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading || !activeModule}
                  className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 text-white"
                  style={{ background: isLoading ? 'rgba(99,102,241,0.3)' : 'rgb(99,102,241)' }}>
                  {isLoading ? <TypingDots /> : <span className="text-sm">↑</span>}
                </button>
              </div>
              <p className="text-3xs text-slate-700 text-center mt-2">
                {t('HBZ AI Platform · Enterprise Technology Advisor · Press Enter to send, Shift+Enter for new line', 'HBZ AI Platform · مشاور فناوری سازمانی · Enter برای ارسال، Shift+Enter برای خط جدید')}
              </p>
            </div>
          </div>
        </main>

        {/* ── Right: Context Panel ──────────────────────────────────── */}
        {contextOpen && (
          <aside className="w-72 flex-shrink-0 hidden xl:flex flex-col border-l border-border overflow-hidden" style={{ background: 'rgba(10,10,20,0.8)' }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Knowledge Sources */}
              <div>
                <p className="text-3xs font-bold uppercase tracking-widest text-slate-600 mb-2">{t('Knowledge Sources', 'منابع دانش')}</p>
                {currentSources.length === 0 ? (
                  <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                    <p className="text-xs text-slate-700">{t('Sources will appear here after AI responses', 'منابع پس از پاسخ هوش مصنوعی نمایش داده می‌شوند')}</p>
                  </div>
                ) : currentSources.map((src, i) => (
                  <div key={src.id} className="rounded-lg p-3 mb-2" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <div className="flex items-start gap-2">
                      <span className="text-3xs font-bold text-indigo-400 mt-0.5">[{i + 1}]</span>
                      <div>
                        <p className="text-xs font-medium text-slate-300">{src.title}</p>
                        <p className="text-2xs text-slate-600 mt-1 line-clamp-2">{src.excerpt}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Smart suggestions */}
              {activeModule && (
                <div>
                  <p className="text-3xs font-bold uppercase tracking-widest text-slate-600 mb-2">{t('Suggested Questions', 'سوالات پیشنهادی')}</p>
                  <div className="space-y-1.5">
                    {(SUGGESTIONS_EN[activeModule.slug] || []).map((s, i) => (
                      <button key={i} onClick={() => sendMessage(s)}
                        className="w-full text-start text-xs px-3 py-2 rounded-lg text-slate-500 hover:text-white transition-all"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All modules quick switch */}
              <div>
                <p className="text-3xs font-bold uppercase tracking-widest text-slate-600 mb-2">{t('Switch Advisor', 'تغییر مشاور')}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {modules.map(mod => {
                    const c = getColor(mod.color)
                    const active = activeModule?.slug === mod.slug
                    return (
                      <button key={mod.slug} onClick={() => switchModule(mod)}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center"
                        style={active ? { background: c.bg, border: `1px solid ${c.border}` } : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="text-lg">{mod.icon}</span>
                        <span className="text-4xs leading-tight" style={{ color: active ? c.text : '#64748b' }}>
                          {isRTL ? mod.nameFa.replace('HBZ ', '').replace('مشاور ', '').replace('دستیار ', '').replace('بازبین ', '').replace('طراح ', '') : mod.nameEn.replace('HBZ ', '').split(' ')[0]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Voice ready banner */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <p className="text-xs font-semibold text-indigo-400 mb-1">🎙 {t('Voice Ready', 'آماده صوت')}</p>
                <p className="text-2xs text-slate-600">{t('Speech-to-text and voice conversation coming soon', 'تبدیل گفتار به متن و مکالمه صوتی به زودی')}</p>
              </div>

              {/* Back to site */}
              <Link href={`/${locale}/consultation`}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-indigo-300 transition-all"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <span>📅</span>
                <div>
                  <p className="font-semibold">{t('Book a Consultation', 'رزرو مشاوره')}</p>
                  <p className="text-3xs text-slate-500">{t('Talk to a human expert', 'با متخصص انسانی صحبت کنید')}</p>
                </div>
              </Link>
            </div>
          </aside>
        )}
      </div>

      {/* ── Search Overlay ────────────────────────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#0e0e1a', border: '1px solid rgba(99,102,241,0.3)' }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
              <span className="text-slate-500">🔍</span>
              <input ref={searchRef} autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('Search knowledge base, case studies, blog...', 'جستجو در دانش‌نامه، مطالعات موردی، وبلاگ...')}
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-600" />
              <button onClick={() => setSearchOpen(false)} className="text-slate-500 hover:text-white text-xs">ESC</button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {searchLoading && <div className="text-center py-8 text-slate-600 text-sm">{t('Searching...', 'در حال جستجو...')}</div>}
              {!searchLoading && searchResults.length === 0 && searchQuery && (
                <div className="text-center py-8 text-slate-600 text-sm">{t('No results', 'نتیجه‌ای یافت نشد')}</div>
              )}
              {!searchLoading && !searchQuery && (
                <div className="text-center py-8 text-slate-700 text-xs">{t('Type to search across all knowledge...', 'برای جستجو در همه دانش‌ها تایپ کنید...')}</div>
              )}
              {searchResults.map(r => (
                <div key={`${r.type}-${r.id}`} className="px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-all"
                  onClick={() => { if (r.url) window.open(`/${locale}${r.url}`, '_blank'); else { setSearchOpen(false); sendMessage(r.title) } }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-4xs px-1.5 py-0.5 rounded font-bold uppercase" style={{
                      background: r.type === 'knowledge' ? 'rgba(99,102,241,0.15)' : r.type === 'project' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: r.type === 'knowledge' ? '#818cf8' : r.type === 'project' ? '#34d399' : '#fbbf24',
                    }}>{r.type}</span>
                    <p className="text-sm text-white font-medium">{r.title}</p>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{r.excerpt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
