'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  visibleWorkspaces, visibleGroups, workspaceHome, workspaceById, type WsItem,
} from '@/lib/admin/workspaces'
import { visibleCommands, entityActions, COMMANDS, type Command, type EntityAction } from '@/lib/admin/commands'
import { useNavPrefs } from '@/lib/admin/navPrefs'

interface Row {
  id: string
  group: string; groupFa: string
  icon: string
  label: string; labelFa: string
  sub?: string
  entity?: EntityAction[]
  run: () => void | Promise<void>
}
interface RecordHit { module: string; type: string; id: number | string; title: string; subtitle?: string; url: string }

interface Props { open: boolean; onClose: () => void; locale: 'fa' | 'en'; role: string }

export function CommandPalette({ open, onClose, locale, role }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [records, setRecords] = useState<RecordHit[]>([])
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const isRTL = locale === 'fa'
  const { favorites, recents, searches, commands, popular, recordSearch, recordCommand } = useNavPrefs()

  const go = useCallback((href: string, external?: boolean) => {
    onClose()
    if (external || (href.startsWith('/') && !href.startsWith('/admin'))) window.open(href, '_blank')
    else router.push(href)
  }, [onClose, router])

  const runEntity = useCallback((a: EntityAction) => {
    if (a.kind === 'copy' && a.href) {
      const url = a.href.startsWith('http') ? a.href : `${window.location.origin}${a.href}`
      navigator.clipboard?.writeText(url).catch(() => {})
      setStatus({ msg: isRTL ? 'کپی شد' : 'Copied', ok: true }); setTimeout(() => setStatus(null), 900)
      return
    }
    if (a.href) go(a.href)
  }, [go, isRTL])

  const execCommand = useCallback(async (c: Command) => {
    recordCommand(c.id)
    if (c.kind === 'navigate' && c.href) { go(c.href); return }
    if (c.kind === 'execute' && c.endpoint) {
      const confirmMsg = isRTL ? c.confirmFa : c.confirmEn
      if (confirmMsg && !window.confirm(confirmMsg)) return
      setStatus({ msg: isRTL ? 'در حال اجرا…' : 'Running…', ok: true })
      try {
        const r = await fetch(c.endpoint, { method: 'POST' })
        const ok = r.ok
        setStatus({ msg: ok ? (isRTL ? 'انجام شد' : 'Done') : (isRTL ? 'ناموفق' : 'Failed'), ok })
        if (ok) setTimeout(onClose, 900)
      } catch { setStatus({ msg: isRTL ? 'ناموفق' : 'Failed', ok: false }) }
    }
  }, [go, isRTL, onClose, recordCommand])

  // RBAC-filtered navigation items (workspace groups) + workspace switches.
  const navItems = useMemo(() => {
    const seen = new Set<string>()
    const out: { item: WsItem; wsName: string; wsNameFa: string }[] = []
    for (const ws of visibleWorkspaces(role)) for (const g of visibleGroups(role, ws)) for (const it of g.items) {
      if (seen.has(it.href)) continue; seen.add(it.href)
      out.push({ item: it, wsName: ws.nameEn, wsNameFa: ws.nameFa })
    }
    return out
  }, [role])

  const itemByHref = useMemo(() => new Map(navItems.map(n => [n.item.href, n])), [navItems])

  const q = query.trim().toLowerCase()

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    if (!q) {
      // Empty state: favorites, recents, recent searches, top actions.
      for (const h of favorites) { const n = itemByHref.get(h); if (n) out.push({ id: `fav-${h}`, group: 'Favorites', groupFa: 'موارد دلخواه', icon: '★', label: n.item.labelEn, labelFa: n.item.labelFa, run: () => go(h) }) }
      for (const h of recents.slice(0, 6)) { const n = itemByHref.get(h); if (n) out.push({ id: `rec-${h}`, group: 'Recent', groupFa: 'اخیر', icon: '🕓', label: n.item.labelEn, labelFa: n.item.labelFa, run: () => go(h) }) }
      const allowed = new Set(visibleCommands(role).map(c => c.id))
      for (const id of commands) { const c = COMMANDS.find(x => x.id === id); if (c && allowed.has(id)) out.push({ id: `rcmd-${id}`, group: 'Recent commands', groupFa: 'دستورات اخیر', icon: c.icon, label: c.titleEn, labelFa: c.titleFa, run: () => execCommand(c) }) }
      for (const s of searches) out.push({ id: `srch-${s}`, group: 'Recent searches', groupFa: 'جستجوهای اخیر', icon: '🔎', label: s, labelFa: s, run: () => { setQuery(s); setSelected(0) } })
      for (const s of popular.filter(p => !searches.some(x => x.toLowerCase() === p.toLowerCase())).slice(0, 5)) out.push({ id: `pop-${s}`, group: 'Popular searches', groupFa: 'جستجوهای پرطرفدار', icon: '🔥', label: s, labelFa: s, run: () => { setQuery(s); setSelected(0) } })
      for (const c of visibleCommands(role)) out.push({ id: `cmd-${c.id}`, group: 'Commands', groupFa: 'دستورات', icon: c.icon, label: c.titleEn, labelFa: c.titleFa, run: () => execCommand(c) })
      return out
    }
    for (const c of visibleCommands(role, query)) out.push({ id: `cmd-${c.id}`, group: 'Commands', groupFa: 'دستورات', icon: c.icon, label: c.titleEn, labelFa: c.titleFa, run: () => execCommand(c) })
    for (const ws of visibleWorkspaces(role)) if (ws.nameEn.toLowerCase().includes(q) || ws.nameFa.includes(query.trim()))
      out.push({ id: `ws-${ws.id}`, group: 'Workspaces', groupFa: 'فضاهای کاری', icon: ws.icon, label: `Switch to ${ws.nameEn}`, labelFa: `رفتن به ${ws.nameFa}`, run: () => go(workspaceHome(ws)) })
    for (const n of navItems) if (n.item.labelEn.toLowerCase().includes(q) || n.item.labelFa.includes(query.trim()))
      out.push({ id: `nav-${n.item.href}`, group: isRTL ? n.wsNameFa : n.wsName, groupFa: n.wsNameFa, icon: n.item.icon, label: n.item.labelEn, labelFa: n.item.labelFa, run: () => go(n.item.href) })
    for (const r of records) out.push({ id: `rec-${r.type}-${r.id}`, group: 'Records', groupFa: 'رکوردها', icon: '◦', label: r.title, labelFa: r.title, sub: r.subtitle, entity: entityActions(r.module, r.url), run: () => go(r.url) })
    return out
  }, [q, query, role, favorites, recents, searches, commands, popular, records, navItems, itemByHref, go, execCommand, isRTL])

  // Live records search (Module 13) + record the search term.
  useEffect(() => {
    if (!open || q.length < 2) { setRecords([]); return }
    const ctrl = new AbortController()
    const id = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then(r => r.json()).then(d => { setRecords((d.hits ?? []).slice(0, 8)); if ((d.hits ?? []).length) recordSearch(query) }).catch(() => {})
    }, 220)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [query, q, open, recordSearch])

  useEffect(() => { if (open) { setQuery(''); setRecords([]); setSelected(0); setStatus(null); setTimeout(() => inputRef.current?.focus(), 50) } }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, rows.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); rows[selected]?.run() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, rows, selected, onClose])

  if (!open) return null

  // Group rows for display (preserve order).
  const groups: { label: string; rows: { row: Row; idx: number }[] }[] = []
  rows.forEach((row, idx) => {
    const label = isRTL ? row.groupFa : row.group
    let g = groups.find(x => x.label === label)
    if (!g) { g = { label, rows: [] }; groups.push(g) }
    g.rows.push({ row, idx })
  })

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" dir={isRTL ? 'rtl' : 'ltr'} role="dialog" aria-modal aria-label={isRTL ? 'جستجوی فرمان' : 'Command palette'}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface-2 border border-brand/30">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-brand/15">
          <span className="text-text-tertiary text-sm shrink-0">🔍</span>
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder={isRTL ? 'جستجوی فضاها، ماژول‌ها، دستورات و رکوردها...' : 'Search workspaces, modules, commands and records...'}
            className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-disabled" aria-label={isRTL ? 'جستجو' : 'Search'} />
          {status && <span className={`text-xs shrink-0 ${status.ok ? 'text-success-text' : 'text-danger-text'}`}>{status.msg}</span>}
          <kbd className="text-3xs px-1.5 py-0.5 rounded text-text-tertiary bg-white/5 border border-white/10">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto" role="listbox">
          {rows.length === 0 && <div className="text-center py-12 text-text-tertiary text-sm">{isRTL ? 'نتیجه‌ای یافت نشد' : 'No results found'}</div>}
          {groups.map(g => (
            <div key={g.label}>
              <p className="text-3xs font-bold uppercase tracking-widest text-text-disabled px-4 pt-3 pb-1">{g.label}</p>
              {g.rows.map(({ row, idx }) => {
                const isSel = idx === selected
                return (
                  <div key={row.id}>
                    <button onClick={() => row.run()} onMouseEnter={() => setSelected(idx)} role="option" aria-selected={isSel}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-start transition-all ${isSel ? 'bg-brand/15 text-brand' : 'text-text-secondary'}`}>
                      <span className={`text-base w-5 text-center shrink-0 ${isSel ? 'text-brand' : 'text-text-tertiary'}`}>{row.icon}</span>
                      <span className="flex-1 text-start truncate">{isRTL ? row.labelFa : row.label}{row.sub ? <span className="text-text-tertiary"> — {row.sub}</span> : null}</span>
                      {isSel && <kbd className="text-3xs px-1.5 py-0.5 rounded text-text-tertiary bg-white/5 border border-white/10 shrink-0">↵</kbd>}
                    </button>
                    {isSel && row.entity && (
                      <div className="flex items-center gap-2 px-12 pb-2 flex-wrap">
                        {row.entity.map(a => (
                          <button key={a.id} onClick={() => runEntity(a)}
                            className="text-2xs px-2 py-1 rounded-md text-text-secondary bg-white/5 border border-white/10 hover:border-brand/40 hover:text-brand transition-colors">
                            <span className="me-1">{a.icon}</span>{isRTL ? a.labelFa : a.labelEn}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-3xs text-text-tertiary">
          <span><kbd className="text-text-secondary">↑↓</kbd> {isRTL ? 'ناوبری' : 'navigate'}</span>
          <span><kbd className="text-text-secondary">↵</kbd> {isRTL ? 'اجرا' : 'run'}</span>
          <span><kbd className="text-text-secondary">ESC</kbd> {isRTL ? 'بستن' : 'close'}</span>
          <span className="ms-auto">{isRTL ? `${rows.length} نتیجه` : `${rows.length} results`}</span>
        </div>
      </div>
    </div>
  )
}
