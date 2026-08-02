'use client'
/**
 * 26.27 بند ۴ — the per-user permission tree (workspace → module → tab + ops).
 * Three-state nodes (منع/خواندن/ویرایش), inherited values dimmed with source,
 * explicit values bold with "back to inheritance", none-subtrees greyed+locked,
 * per-op checkboxes, search, template apply, copy-from-user, live "what this
 * user sees" preview. Server enforcement lives in requirePermission — this UI
 * is a view over it, never the security boundary (R4).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT, useAdminLocale } from '@/lib/admin/locale'

type Level = 'none' | 'read' | 'write'
interface Node { key: string; kind: 'workspace' | 'module' | 'tab'; parent: string | null; labelEn: string; labelFa: string; ops: string[] }
interface Resolved { key: string; level: Level | null; source: string | null; explicit: boolean }
interface Payload {
  user: { id: string; name: string; email: string; role: string }
  nodes: Node[]
  tree: Resolved[]
  grants: Record<string, Level>
  ops: Record<string, boolean>
  opKeys: string[]
  scopes: Record<string, string>
  scopedModules?: Record<string, string[]>
  templates: Array<{ id: number; name: string; name_fa: string }>
  audit: Array<{ actor_id: string; permission_key: string; old_value: string | null; new_value: string | null; created_at: string }>
}

const LEVELS: Array<{ v: Level; fa: string; en: string }> = [
  { v: 'none', fa: 'منع', en: 'Deny' },
  { v: 'read', fa: 'خواندن', en: 'Read' },
  { v: 'write', fa: 'ویرایش', en: 'Write' },
]

export function PermissionTree({ userId }: { userId: string }) {
  const t = useT()
  const locale = useAdminLocale()
  const fa = locale === 'fa'
  const [data, setData] = useState<Payload | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/users/${userId}/permissions`)
    if (r.ok) setData(await r.json())
    else setError(t('perm_load_failed'))
  }, [userId, t])
  useEffect(() => { void load() }, [load])

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setError('')
    const r = await fetch(`/api/admin/users/${userId}/permissions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    setBusy(false)
    if (!r.ok) { setError((await r.json().catch(() => ({})) as { error?: string }).error ?? t('perm_change_failed')); return }
    await load()
  }, [userId, load, t])

  const resolved = useMemo(() => new Map((data?.tree ?? []).map(n => [n.key, n])), [data])
  const children = useMemo(() => {
    const m = new Map<string | null, Node[]>()
    for (const n of data?.nodes ?? []) {
      const arr = m.get(n.parent) ?? []
      arr.push(n); m.set(n.parent, arr)
    }
    return m
  }, [data])

  const matches = useCallback((n: Node): boolean => {
    if (!q) return true
    const hit = n.key.includes(q) || n.labelFa.includes(q) || n.labelEn.toLowerCase().includes(q.toLowerCase())
    if (hit) return true
    return (children.get(n.key) ?? []).some(matches)
  }, [q, children])

  if (!data) return <div className="p-6 text-muted">{error || t('loading')}</div>

  const visiblePreview = data.nodes.filter(n => n.kind === 'workspace')
    .filter(w => resolved.get(w.key)?.level !== 'none')
    .map(w => (fa ? w.labelFa : w.labelEn))

  const renderNode = (n: Node, depth: number) => {
    if (!matches(n)) return null
    const r = resolved.get(n.key)
    const level = r?.level ?? null
    const explicit = r?.explicit ?? false
    const denied = level === 'none'
    const kids = children.get(n.key) ?? []
    const isOpen = open[n.key] ?? (depth < 1 || !!q)
    return (
      <div key={n.key} className={denied && !explicit ? 'opacity-50' : ''}>
        <div className="flex items-center gap-2 py-1.5 border-b border-border/50" style={{ paddingInlineStart: depth * 20 }}>
          {kids.length > 0 ? (
            <button type="button" className="w-5 text-muted" onClick={() => setOpen(o => ({ ...o, [n.key]: !isOpen }))} aria-label={isOpen ? t('perm_collapse') : t('perm_expand')}>
              {isOpen ? '▾' : fa ? '◂' : '▸'}
            </button>
          ) : <span className="w-5" />}
          {denied && <span title={t('perm_denied_subtree')}>🔒</span>}
          <span className={`text-sm ${explicit ? 'font-bold' : 'text-muted'}`}>{fa ? n.labelFa : n.labelEn}</span>
          <code className="text-3xs text-muted/70">{n.key}</code>
          {!explicit && level !== null && r?.source && (
            <span className="text-3xs rounded bg-surface-2 px-1.5 py-0.5 text-muted" title={r.source}>
              {t('perm_inherited_from')} {r.source === n.parent || r.source !== n.key ? r.source : ''}
            </span>
          )}
          {level === null && <span className="text-3xs rounded bg-surface-2 px-1.5 py-0.5 text-muted">{t('perm_role_default')} ({data.user.role})</span>}
          <span className="ms-auto flex items-center gap-1">
            {LEVELS.map(l => (
              <button key={l.v} type="button" disabled={busy}
                className={`text-2xs rounded px-2 py-1 border ${explicit && level === l.v ? (l.v === 'none' ? 'bg-danger/20 border-danger text-danger' : l.v === 'write' ? 'bg-success/20 border-success text-success' : 'bg-brand/20 border-brand text-brand') : (!explicit && level === l.v ? 'border-border text-muted' : 'border-border/50 text-muted/60 hover:border-border')}`}
                onClick={() => void act({ action: 'grant', key: n.key, level: l.v })}>
                {fa ? l.fa : l.en}
              </button>
            ))}
            {explicit && (
              <button type="button" disabled={busy} className="text-2xs text-muted underline" onClick={() => void act({ action: 'grant', key: n.key, level: null })}>
                {t('perm_back_to_inherit')}
              </button>
            )}
          </span>
        </div>
        {isOpen && (data.scopedModules?.[n.key]?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 py-1.5 bg-surface-2/40" style={{ paddingInlineStart: (depth + 1) * 20 }}>
            <span className="text-3xs text-muted">{t('perm_row_scope')}:</span>
            <select
              disabled={busy || denied}
              className="text-2xs rounded border border-border bg-surface px-2 py-1"
              value={data.scopes[n.key] ?? 'all'}
              onChange={e => void act({ action: 'scope', key: n.key, scope: e.target.value === 'all' ? null : e.target.value })}
            >
              {(data.scopedModules?.[n.key] ?? []).map(s => (
                <option key={s} value={s}>
                  {fa ? ({ all: 'همه', own: 'فقط خودم', department: 'واحد من' } as Record<string, string>)[s] : s}
                </option>
              ))}
            </select>
            {(data.scopes[n.key] ?? 'all') !== 'all' && <span className="text-3xs text-brand">{t('perm_scope_active')}</span>}
          </div>
        )}
        {isOpen && n.ops.length > 0 && (
          <div className="flex flex-wrap gap-3 py-1.5 bg-surface-2/40" style={{ paddingInlineStart: (depth + 1) * 20 }}>
            <span className="text-3xs text-muted">{t('perm_sensitive_ops')}:</span>
            {n.ops.map(op => {
              const opKey = `${n.key}:${op}`
              const val = data.ops[opKey]
              return (
                <label key={opKey} className={`flex items-center gap-1 text-2xs ${denied ? 'opacity-50' : ''}`} title={denied ? t('perm_denied_subtree') : opKey}>
                  <input type="checkbox" disabled={busy || denied} checked={val === true}
                    onChange={e => void act({ action: 'op', opKey, allowed: e.target.checked ? true : (val === undefined ? false : null) })} />
                  <code>{op}</code>
                  {val === false && <span className="text-danger">✗</span>}
                </label>
              )
            })}
          </div>
        )}
        {isOpen && kids.map(k => renderNode(k, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-4" dir={fa ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-bold">{data.user.name}</h2>
          <p className="text-2xs text-muted">{data.user.email} · {data.user.role}</p>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('perm_search')}
          className="ms-auto rounded border border-border bg-surface px-3 py-1.5 text-sm" />
        <select disabled={busy} className="rounded border border-border bg-surface px-2 py-1.5 text-sm" defaultValue=""
          onChange={e => { if (e.target.value) { void act({ action: 'template', templateId: Number(e.target.value) }); e.target.value = '' } }}>
          <option value="">{t('perm_apply_template')}</option>
          {data.templates.map(tp => <option key={tp.id} value={tp.id}>{fa ? tp.name_fa : tp.name}</option>)}
        </select>
        <button type="button" disabled={busy} className="rounded border border-border px-3 py-1.5 text-sm"
          onClick={() => { const from = prompt(t('perm_copy_prompt')); if (from) void act({ action: 'copy', fromUserId: from }) }}>
          {t('perm_copy_from')}
        </button>
      </div>
      {error && <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
      <div className="rounded border border-border bg-surface p-3 text-2xs text-muted">
        {t('perm_preview')}: {visiblePreview.join(' · ') || t('perm_preview_none')}
      </div>
      <div className="rounded border border-border bg-surface">
        {(children.get(null) ?? []).map(w => renderNode(w, 0))}
      </div>
    </div>
  )
}
