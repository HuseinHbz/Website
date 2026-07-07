'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { WORKSPACES, workspaceHome, allNavItems, workspaceById } from '@/lib/admin/workspaces'

interface Cmd {
  id: string
  label: string
  labelFa: string
  icon: string
  href: string
  group: string
  groupFa: string
  external?: boolean
}

interface RecordHit { module: string; type: string; id: number | string; title: string; subtitle?: string; url: string }

// Navigation + workspace-switch commands are DERIVED from the workspace registry,
// so the palette always matches the live navigation (no stale hand-kept list).
function buildCommands(): Cmd[] {
  const cmds: Cmd[] = []
  for (const w of WORKSPACES) {
    cmds.push({
      id: `ws-${w.id}`, label: `Switch to ${w.nameEn}`, labelFa: `رفتن به ${w.nameFa}`,
      icon: w.icon, href: workspaceHome(w), group: 'Workspaces', groupFa: 'فضاهای کاری',
    })
  }
  for (const it of allNavItems()) {
    const w = workspaceById(it.workspaceId)!
    cmds.push({
      id: `nav-${it.href}`, label: it.labelEn, labelFa: it.labelFa, icon: it.icon,
      href: it.href, group: w.nameEn, groupFa: w.nameFa,
    })
  }
  cmds.push({ id: 'view-site', label: 'View Public Site', labelFa: 'مشاهده سایت عمومی', icon: '↗', href: '/', group: 'Quick Actions', groupFa: 'اقدامات سریع', external: true })
  return cmds
}

interface Props { open: boolean; onClose: () => void; locale: 'fa' | 'en' }

export function CommandPalette({ open, onClose, locale }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [records, setRecords] = useState<RecordHit[]>([])
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const isRTL = locale === 'fa'
  const COMMANDS = useMemo(buildCommands, [])

  const filteredCmds = useMemo(() => {
    if (!query) return COMMANDS
    const q = query.toLowerCase()
    return COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.labelFa.includes(q) || c.group.toLowerCase().includes(q))
  }, [query, COMMANDS])

  // Live enterprise search over real records (Module 13) when typing ≥2 chars.
  useEffect(() => {
    if (!open || query.trim().length < 2) { setRecords([]); return }
    const ctrl = new AbortController()
    const id = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then(r => r.json()).then(d => setRecords((d.hits ?? []).slice(0, 8))).catch(() => {})
    }, 200)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [query, open])

  // Flat list = commands then record hits (keyboard order).
  const flat = useMemo(() => [
    ...filteredCmds.map(c => ({ kind: 'cmd' as const, cmd: c })),
    ...records.map(r => ({ kind: 'rec' as const, rec: r })),
  ], [filteredCmds, records])

  useEffect(() => {
    if (open) { setQuery(''); setRecords([]); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  const go = useCallback((href: string, external?: boolean) => {
    onClose()
    if (external || (href.startsWith('/') && !href.startsWith('/admin'))) window.open(href, '_blank')
    else router.push(href)
  }, [onClose, router])

  const execIndex = useCallback((i: number) => {
    const row = flat[i]; if (!row) return
    if (row.kind === 'cmd') go(row.cmd.href, row.cmd.external)
    else go(row.rec.url)
  }, [flat, go])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); execIndex(selected) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, selected, execIndex, onClose])

  if (!open) return null

  // Group commands for display; records go into their own group.
  const grouped = filteredCmds.reduce<Record<string, Cmd[]>>((acc, c) => {
    const key = isRTL ? c.groupFa : c.group
    ;(acc[key] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" dir={isRTL ? 'rtl' : 'ltr'} role="dialog" aria-modal aria-label={isRTL ? 'جستجوی فرمان' : 'Command palette'}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface-2 border border-brand/30">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-brand/15">
          <span className="text-text-tertiary text-sm shrink-0">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder={isRTL ? 'جستجوی فضاها، ماژول‌ها و رکوردها...' : 'Search workspaces, modules and records...'}
            className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-disabled"
            aria-label={isRTL ? 'جستجو' : 'Search'}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded text-text-tertiary bg-white/5 border border-white/10">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {flat.length === 0 && <div className="text-center py-12 text-text-tertiary text-sm">{isRTL ? 'نتیجه‌ای یافت نشد' : 'No results found'}</div>}

          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled px-4 pt-3 pb-1">{group}</p>
              {cmds.map(c => {
                const idx = flat.findIndex(f => f.kind === 'cmd' && f.cmd.id === c.id)
                const isSel = idx === selected
                return (
                  <button key={c.id} onClick={() => execIndex(idx)} onMouseEnter={() => setSelected(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-start transition-all ${isSel ? 'bg-brand/15 text-brand' : 'text-text-secondary'}`}>
                    <span className={`text-base w-5 text-center shrink-0 ${isSel ? 'text-brand' : 'text-text-tertiary'}`}>{c.icon}</span>
                    <span className="flex-1 text-start truncate">{isRTL ? c.labelFa : c.label}</span>
                    {isSel && <kbd className="text-[10px] px-1.5 py-0.5 rounded text-text-tertiary bg-white/5 border border-white/10 shrink-0">↵</kbd>}
                  </button>
                )
              })}
            </div>
          ))}

          {records.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled px-4 pt-3 pb-1">{isRTL ? 'رکوردها' : 'Records'}</p>
              {records.map((r, i) => {
                const idx = filteredCmds.length + i
                const isSel = idx === selected
                return (
                  <button key={`${r.type}-${r.id}`} onClick={() => execIndex(idx)} onMouseEnter={() => setSelected(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-start transition-all ${isSel ? 'bg-brand/15 text-brand' : 'text-text-secondary'}`}>
                    <span className="text-base w-5 text-center shrink-0 text-text-tertiary">◦</span>
                    <span className="flex-1 text-start truncate">{r.title}{r.subtitle ? <span className="text-text-tertiary"> — {r.subtitle}</span> : null}</span>
                    <span className="text-[10px] text-text-tertiary shrink-0 uppercase">{r.module}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-text-tertiary">
          <span><kbd className="text-text-secondary">↑↓</kbd> {isRTL ? 'ناوبری' : 'navigate'}</span>
          <span><kbd className="text-text-secondary">↵</kbd> {isRTL ? 'انتخاب' : 'select'}</span>
          <span><kbd className="text-text-secondary">ESC</kbd> {isRTL ? 'بستن' : 'close'}</span>
          <span className="ms-auto">{isRTL ? `${flat.length} نتیجه` : `${flat.length} results`}</span>
        </div>
      </div>
    </div>
  )
}
