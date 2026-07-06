'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, PageHeader, Badge, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'

interface Agent {
  id: string
  category: string
  nameEn: string; nameFa: string
  descEn: string; descFa: string
  icon: string
  useRag: boolean
  examplesEn: string[]; examplesFa: string[]
}
interface Source { id: number; title: string; excerpt: string }

export function AiAgentsManager() {
  const t = useT()
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Agent | null>(null)
  const [task, setTask] = useState('')
  const [running, setRunning] = useState(false)
  const [reply, setReply] = useState('')
  const [sources, setSources] = useState<Source[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/ai/agents')
      if (r.ok) { const d = await r.json(); setAgents(d.agents ?? []) }
    } catch { toast(t('aia_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  const examples = useMemo(() => active ? (fa ? active.examplesFa : active.examplesEn) : [], [active, fa])

  function open(a: Agent) { setActive(a); setTask(''); setReply(''); setSources([]) }

  async function run() {
    if (!active || !task.trim()) return
    setRunning(true); setReply(''); setSources([])
    try {
      const r = await fetch('/api/admin/ai/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: active.id, task }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'run failed')
      setReply(d.reply || ''); setSources(d.sources ?? [])
    } catch (e) { toast(e instanceof Error ? e.message : t('aia_runFail'), 'error') } finally { setRunning(false) }
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('aia_title')} subtitle={t('aia_subtitle')} />

      {loading ? (
        <p className="text-sm text-text-tertiary">{t('aia_loading')}</p>
      ) : active ? (
        <Card className="p-5">
          <button onClick={() => setActive(null)} className="text-xs text-brand hover:underline mb-4">{t('aia_back')}</button>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl" aria-hidden>{active.icon}</span>
            <div>
              <h3 className="text-base font-semibold text-text-primary">{fa ? active.nameFa : active.nameEn}</h3>
              <p className="text-xs text-text-tertiary">{fa ? active.descFa : active.descEn}</p>
            </div>
            {active.useRag && <Badge color="indigo">{t('aia_rag')}</Badge>}
          </div>

          <label className="form-label">{t('aia_taskLabel')}</label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={4}
            placeholder={t('aia_taskPh')}
            className="form-input w-full mb-2"
          />
          <div className="flex flex-wrap gap-2 mb-4">
            {examples.map((ex, i) => (
              <button key={i} onClick={() => setTask(ex)} className="text-[11px] px-2 py-1 rounded-md bg-surface-2 border border-subtle text-text-secondary hover:border-brand/40">
                {ex}
              </button>
            ))}
          </div>
          <Btn onClick={run} disabled={running || !task.trim()}>{running ? t('aia_running') : t('aia_run')}</Btn>

          {reply && (
            <div className="mt-5 rounded-lg border border-subtle p-4 bg-background">
              <p className="text-xs text-text-tertiary mb-2">{t('aia_response')}</p>
              <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{reply}</div>
              {sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-subtle">
                  <p className="text-xs text-text-tertiary mb-1">{t('aia_sources')}</p>
                  <ul className="space-y-1">
                    {sources.map((s, i) => (
                      <li key={s.id} className="text-xs text-text-secondary">[{i + 1}] {s.title}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <button key={a.id} onClick={() => open(a)} className="text-start rounded-xl p-4 bg-surface-2 border border-subtle hover:border-brand/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden>{a.icon}</span>
                <span className="font-semibold text-text-primary text-sm">{fa ? a.nameFa : a.nameEn}</span>
                {a.useRag && <Badge color="indigo">{t('aia_rag')}</Badge>}
              </div>
              <p className="text-xs text-text-tertiary leading-relaxed">{fa ? a.descFa : a.descEn}</p>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
