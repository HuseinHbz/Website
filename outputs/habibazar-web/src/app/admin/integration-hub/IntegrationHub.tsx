'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Tab = 'connectors' | 'monitoring' | 'dlq'
type CType = 'rest' | 'graphql' | 'webhook' | 'smtp' | 'kafka' | 'rabbitmq' | 'sftp'

interface Connector { id?: number; key: string; name: string; type: CType; config: Record<string, unknown>; retries: number; active: number | boolean; executable?: boolean; dispatches?: number; dlq?: number }
interface Dispatch { id: number; connectorKey: string; type: string; status: string; latencyMs: number; attempts: number; error: string | null; createdAt: string }
interface Metrics { total: number; success: number; dead: number; queued: number; avgLatency: number }

const TYPES: CType[] = ['rest', 'graphql', 'webhook', 'smtp', 'kafka', 'rabbitmq', 'sftp']
const STATUS_COLOR: Record<string, 'green' | 'red' | 'yellow' | 'slate'> = { success: 'green', failed: 'red', dead: 'red', queued: 'yellow' }
const EMPTY: Connector = { key: '', name: '', type: 'rest', config: { url: '', method: 'POST', authType: 'none' }, retries: 2, active: true }

export function IntegrationHub() {
  const t = useT()
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('connectors')
  return (
    <>
      <ToastContainer />
      <PageHeader title={t('int_title')} subtitle={t('int_subtitle')} />
      <div className="flex gap-1 mb-6 border-b border-subtle">
        {(['connectors', 'monitoring', 'dlq'] as Tab[]).map(tb => (
          <button key={tb} onClick={() => setTab(tb)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tb ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{t(`int_tab_${tb}` as 'int_tab_connectors')}</button>
        ))}
      </div>
      {tab === 'connectors' && <Connectors t={t} toast={toast} />}
      {tab === 'monitoring' && <Monitoring t={t} />}
      {tab === 'dlq' && <Dlq t={t} toast={toast} />}
    </>
  )
}
type T = ReturnType<typeof useT>
type Toast = ReturnType<typeof useToast>['toast']

function Connectors({ t, toast }: { t: T; toast: Toast }) {
  const [rows, setRows] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Connector>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/integrations'); if (r.ok) { const d = await r.json(); setRows(d.connectors ?? []) } } catch { toast(t('int_loadFail'), 'error') } finally { setLoading(false) } }, [toast, t])
  useEffect(() => { load() }, [load])

  function cfg<K extends string>(k: K, v: unknown) { setEditing(e => ({ ...e, config: { ...e.config, [k]: v } })) }
  async function save() {
    if (!editing.key.trim() || !editing.name.trim()) return
    setSaving(true)
    try { const r = await fetch('/api/admin/erp/integrations', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editing, active: !!editing.active }) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed'); toast(t('int_saved'), 'success'); setModal(false); load() }
    catch (e) { toast(e instanceof Error ? e.message : t('int_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function del(id: number) { if (!confirm(t('int_confirmDel'))) return; const r = await fetch('/api/admin/erp/integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (r.ok) { toast(t('int_deleted'), 'success'); load() } }
  async function test(c: Connector) {
    const r = await fetch('/api/admin/erp/integrations/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectorId: c.id, payload: { test: true, at: new Date().toISOString() } }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) toast(`${t('int_test')}: ${d.result?.status}`, d.result?.status === 'success' || d.result?.status === 'queued' ? 'success' : 'error'); else toast(d.error || t('int_saveFail'), 'error')
    load()
  }

  const http = editing.type === 'rest' || editing.type === 'graphql' || editing.type === 'webhook'
  const intent = editing.type === 'kafka' || editing.type === 'rabbitmq' || editing.type === 'sftp'
  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{t('int_new')}</Btn></div>
      <Card className="p-0 overflow-hidden">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('int_loading')}</p> : rows.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('int_empty')}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-text-tertiary text-left border-b border-subtle">{[t('int_cName'), t('int_cType'), t('int_cMode'), t('int_cDispatches'), t('int_cDlq'), t('int_cActions')].map(h => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.map(c => (
              <tr key={c.id} className="border-b border-subtle/50">
                <td className="px-4 py-2.5"><div className="font-medium text-text-primary">{c.name}</div><div className="text-xs text-text-tertiary font-mono">{c.key}</div></td>
                <td className="px-4 py-2.5"><Badge color="indigo">{c.type}</Badge></td>
                <td className="px-4 py-2.5"><Badge color={c.executable ? 'green' : 'yellow'}>{c.executable ? t('int_executes') : t('int_intent')}</Badge></td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{c.dispatches ?? 0}</td>
                <td className="px-4 py-2.5">{c.dlq ? <Badge color="red">{c.dlq}</Badge> : <span className="text-text-tertiary text-xs">0</span>}</td>
                <td className="px-4 py-2.5"><div className="flex gap-2">
                  <Btn size="sm" onClick={() => test(c)}>{t('int_test')}</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing({ ...c, active: !!c.active }); setModal(true) }}>{t('int_edit')}</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(c.id!)}>{t('int_del')}</Btn>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('int_editConnector') : t('int_new')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('int_fKey')} value={editing.key} onChange={v => setEditing(e => ({ ...e, key: v }))} placeholder="crm-webhook" />
            <Input label={t('int_fName')} value={editing.name} onChange={v => setEditing(e => ({ ...e, name: v }))} />
            <Select label={t('int_fType')} value={editing.type} onChange={v => setEditing(e => ({ ...e, type: v as CType }))} options={TYPES.map(x => ({ value: x, label: x }))} />
          </div>
          {http && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2"><Input label={t('int_fUrl')} value={String(editing.config.url ?? '')} onChange={v => cfg('url', v)} /></div>
                {editing.type === 'rest' && <Select label={t('int_fMethod')} value={String(editing.config.method ?? 'POST')} onChange={v => cfg('method', v)} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(x => ({ value: x, label: x }))} />}
              </div>
              {editing.type === 'graphql' && <Input label={t('int_fQuery')} value={String(editing.config.query ?? '')} onChange={v => cfg('query', v)} multiline rows={3} />}
              <div className="grid grid-cols-3 gap-4">
                <Select label={t('int_fAuth')} value={String(editing.config.authType ?? 'none')} onChange={v => cfg('authType', v)} options={[{ value: 'none', label: t('int_authNone') }, { value: 'bearer', label: 'Bearer' }, { value: 'header', label: t('int_authHeader') }]} />
                {editing.config.authType === 'header' && <Input label={t('int_fAuthHeader')} value={String(editing.config.authHeader ?? '')} onChange={v => cfg('authHeader', v)} />}
                {(editing.config.authType === 'bearer' || editing.config.authType === 'header') && <Input label={t('int_fAuthToken')} value={String(editing.config.authToken ?? '')} onChange={v => cfg('authToken', v)} />}
              </div>
            </>
          )}
          {editing.type === 'smtp' && (
            <div className="grid grid-cols-2 gap-4"><Input label={t('int_fTo')} value={String(editing.config.to ?? '')} onChange={v => cfg('to', v)} /><Input label={t('int_fSubject')} value={String(editing.config.subject ?? '')} onChange={v => cfg('subject', v)} /></div>
          )}
          {intent && (
            <>
              <p className="text-[11px] text-warning-text">{t('int_intentNote')}</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label={editing.type === 'sftp' ? t('int_fHost') : t('int_fBroker')} value={String((editing.type === 'sftp' ? editing.config.host : editing.config.broker) ?? '')} onChange={v => cfg(editing.type === 'sftp' ? 'host' : 'broker', v)} />
                <Input label={editing.type === 'sftp' ? t('int_fPath') : editing.type === 'kafka' ? t('int_fTopic') : t('int_fQueue')} value={String((editing.type === 'sftp' ? editing.config.path : editing.type === 'kafka' ? editing.config.topic : editing.config.queue) ?? '')} onChange={v => cfg(editing.type === 'sftp' ? 'path' : editing.type === 'kafka' ? 'topic' : 'queue', v)} />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('int_fRetries')} type="number" value={String(editing.retries)} onChange={v => setEditing(e => ({ ...e, retries: Number(v) || 0 }))} />
            <label className="flex items-center gap-2 text-sm text-text-secondary mt-6"><input type="checkbox" checked={!!editing.active} onChange={e => setEditing(x => ({ ...x, active: e.target.checked }))} /> {t('int_fActive')}</label>
          </div>
          <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? t('int_saving') : t('int_save')}</Btn><Btn variant="secondary" onClick={() => setModal(false)}>{t('int_cancel')}</Btn></div>
        </div>
      </Modal>
    </>
  )
}

function Monitoring({ t }: { t: T }) {
  const [data, setData] = useState<{ dispatches: Dispatch[]; metrics: Metrics } | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/integrations/dispatch'); if (r.ok) setData(await r.json()) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  if (loading && !data) return <p className="text-sm text-text-tertiary">{t('int_loading')}</p>
  const m = data?.metrics
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi label={t('int_mTotal')} value={String(m?.total ?? 0)} />
        <Kpi label={t('int_mSuccess')} value={String(m?.success ?? 0)} tone="ok" />
        <Kpi label={t('int_mQueued')} value={String(m?.queued ?? 0)} />
        <Kpi label={t('int_mDead')} value={String(m?.dead ?? 0)} tone={m?.dead ? 'bad' : undefined} />
        <Kpi label={t('int_mLatency')} value={`${m?.avgLatency ?? 0}ms`} />
      </div>
      <Card className="p-0 overflow-hidden">
        {!data || data.dispatches.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('int_noDispatches')}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-text-tertiary text-left border-b border-subtle">{[t('int_cDate'), t('int_cConnector'), t('int_cStatus'), t('int_cLatency'), t('int_cAttempts')].map(h => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}</tr></thead>
            <tbody>{data.dispatches.map(d => (
              <tr key={d.id} className="border-b border-subtle/50">
                <td className="px-4 py-2.5 text-text-tertiary text-xs font-mono">{d.createdAt}</td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{d.connectorKey} <Badge color="slate">{d.type}</Badge></td>
                <td className="px-4 py-2.5"><Badge color={STATUS_COLOR[d.status] ?? 'slate'}>{t(`int_st_${d.status}` as 'int_st_success')}</Badge>{d.error && <span className="text-[11px] text-danger ml-1">{d.error.slice(0, 40)}</span>}</td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{d.latencyMs}ms</td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{d.attempts}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}
function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}><p className="text-xs text-text-tertiary mb-1">{label}</p><p className="text-lg font-bold text-text-primary">{value}</p></div>
}

function Dlq({ t, toast }: { t: T; toast: Toast }) {
  const [rows, setRows] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/integrations/dispatch?dlq=1'); if (r.ok) { const d = await r.json(); setRows(d.dispatches ?? []) } } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  async function retry(id: number) {
    const r = await fetch('/api/admin/erp/integrations/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redispatchId: id }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(`${t('int_retry')}: ${d.result?.status}`, d.result?.status === 'success' ? 'success' : 'error'); load() } else toast(d.error || t('int_saveFail'), 'error')
  }
  return (
    <Card className="p-0 overflow-hidden">
      {loading ? <p className="text-sm text-text-tertiary p-5">{t('int_loading')}</p> : rows.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('int_dlqEmpty')}</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-text-tertiary text-left border-b border-subtle">{[t('int_cDate'), t('int_cConnector'), t('int_cAttempts'), t('int_cError'), t('int_cActions')].map(h => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}</tr></thead>
          <tbody>{rows.map(d => (
            <tr key={d.id} className="border-b border-subtle/50">
              <td className="px-4 py-2.5 text-text-tertiary text-xs font-mono">{d.createdAt}</td>
              <td className="px-4 py-2.5 text-text-secondary text-xs">{d.connectorKey}</td>
              <td className="px-4 py-2.5 text-text-secondary text-xs">{d.attempts}</td>
              <td className="px-4 py-2.5 text-danger text-xs">{d.error?.slice(0, 60) || '—'}</td>
              <td className="px-4 py-2.5"><Btn size="sm" onClick={() => retry(d.id)}>{t('int_retry')}</Btn></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  )
}
