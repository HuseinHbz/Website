'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

interface Rule { id: number; key: string; nameEn: string; nameFa: string | null; category: string; description: string | null; currentVersion: number; activeVersion: number; status: string }
interface Version { id: number; version: number; definition: string; note: string | null; createdAt: string }
interface SimResult { matched: string[]; outputs: Record<string, unknown>; trace: { ruleId: string; matched: boolean }[] }

const CATEGORIES = ['discount', 'tax', 'validation', 'approval', 'inventory', 'pricing', 'financial', 'general']
const STARTER = JSON.stringify({
  mode: 'first',
  rules: [
    { id: 'vip', priority: 20, match: 'all', conditions: [{ field: 'tier', op: 'eq', value: 'gold' }], outputs: { discountPct: 20 } },
    { id: 'bulk', priority: 10, conditions: [{ field: 'amount', op: 'gte', value: 1000 }], outputs: { discountPct: 10 } },
    { id: 'default', priority: 0, conditions: [], outputs: { discountPct: 0 } },
  ],
}, null, 2)
const EMPTY = { key: '', nameEn: '', nameFa: '', category: 'discount', description: '', definition: STARTER }
function statusColor(s: string) { return s === 'active' ? 'green' : s === 'archived' ? 'slate' : 'yellow' }

export function RulesCenter() {
  const t = useT()
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Rule | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [newDef, setNewDef] = useState('')
  const [facts, setFacts] = useState('{ "tier": "gold", "amount": 1500 }')
  const [sim, setSim] = useState<SimResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/admin/erp/rules'); if (r.ok) { const d = await r.json(); setRules(d.rules ?? []) } }
    catch { toast(t('rule_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  const openDetail = useCallback(async (r: Rule) => {
    setDetail(r); setVersions([]); setSim(null); setNewDef('')
    try { const res = await fetch(`/api/admin/erp/rules?id=${r.id}`); if (res.ok) { const d = await res.json(); setDetail(d.rule); setVersions(d.versions ?? []); setNewDef(d.versions?.[0]?.definition ?? '') } } catch { toast(t('rule_loadFail'), 'error') }
  }, [toast, t])

  const activeDef = useMemo(() => versions.find(v => v.version === detail?.activeVersion)?.definition ?? '', [versions, detail])

  async function create() {
    if (!draft.key.trim() || !draft.nameEn.trim()) return
    setSaving(true)
    try { const r = await fetch('/api/admin/erp/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed'); toast(t('rule_created'), 'success'); setCreateOpen(false); setDraft({ ...EMPTY }); load() }
    catch (e) { toast(e instanceof Error ? e.message : t('rule_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function op(body: Record<string, unknown>, ok: string) {
    try { const r = await fetch('/api/admin/erp/rules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed'); toast(ok, 'success'); if (detail) openDetail(detail); load() }
    catch (e) { toast(e instanceof Error ? e.message : t('rule_saveFail'), 'error') }
  }
  async function del(id: number) {
    if (!confirm(t('rule_confirmDel'))) return
    try { const r = await fetch('/api/admin/erp/rules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (!r.ok) throw new Error(); toast(t('rule_deleted'), 'success'); setDetail(null); load() } catch { toast(t('rule_saveFail'), 'error') }
  }
  async function simulate() {
    let parsedFacts: Record<string, unknown>
    try { parsedFacts = JSON.parse(facts) } catch { toast(t('rule_factsInvalid'), 'error'); return }
    const def = newDef || activeDef
    try { const r = await fetch('/api/admin/erp/rules/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definition: def, facts: parsedFacts }) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed'); setSim(d.result) }
    catch (e) { toast(e instanceof Error ? e.message : t('rule_saveFail'), 'error') }
  }

  if (detail) {
    return (
      <>
        <ToastContainer />
        <button onClick={() => setDetail(null)} className="text-xs text-brand hover:underline mb-3">{t('rule_back')}</button>
        <PageHeader title={fa ? (detail.nameFa || detail.nameEn) : detail.nameEn}
          subtitle={`${detail.key} · ${detail.category} · ${t('rule_active')} v${detail.activeVersion}/v${detail.currentVersion}`}
          action={<div className="flex gap-2">
            {detail.status !== 'active' && <Btn size="sm" onClick={() => op({ id: detail.id, op: 'activate' }, t('rule_activated'))}>{t('rule_activate')}</Btn>}
            {detail.status !== 'archived' && <Btn size="sm" variant="secondary" onClick={() => op({ id: detail.id, op: 'archive' }, t('rule_archived'))}>{t('rule_archive')}</Btn>}
            <Btn size="sm" variant="danger" onClick={() => del(detail.id)}>{t('rule_delete')}</Btn>
          </div>} />
        <div className="mb-4"><Badge color={statusColor(detail.status)}>{detail.status}</Badge></div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('rule_definition')}</h3>
            <textarea value={newDef} onChange={e => setNewDef(e.target.value)} rows={16} spellCheck={false} className="w-full font-mono text-xs bg-background border border-border rounded-lg p-3 text-text-primary" />
            <div className="mt-3"><Btn size="sm" onClick={() => op({ id: detail.id, op: 'newVersion', definition: newDef }, t('rule_versionAdded'))}>{t('rule_saveVersion')}</Btn></div>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('rule_simulate')}</h3>
            <label className="text-xs text-text-tertiary">{t('rule_facts')}</label>
            <textarea value={facts} onChange={e => setFacts(e.target.value)} rows={4} spellCheck={false} className="w-full font-mono text-xs bg-background border border-border rounded-lg p-2 text-text-primary mb-2" />
            <Btn size="sm" onClick={simulate}>{t('rule_run')}</Btn>
            {sim && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">{sim.matched.length === 0 ? <span className="text-xs text-text-tertiary">{t('rule_noMatch')}</span> : sim.matched.map(m => <Badge key={m} color="green">{m}</Badge>)}</div>
                <div><p className="text-xs text-text-tertiary mb-1">{t('rule_outputs')}</p><pre className="text-2xs text-text-secondary bg-background rounded p-2 overflow-x-auto">{JSON.stringify(sim.outputs, null, 2)}</pre></div>
                <div><p className="text-xs text-text-tertiary mb-1">{t('rule_trace')}</p><div className="flex flex-wrap gap-1">{sim.trace.map((tr, i) => <Badge key={i} color={tr.matched ? 'green' : 'slate'}>{tr.ruleId}</Badge>)}</div></div>
              </div>
            )}
          </Card>
        </div>

        <Card className="p-5 mt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('rule_history')}</h3>
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex items-center justify-between text-xs border border-subtle rounded-lg p-2.5">
                <span className="text-text-secondary">v{v.version} {v.version === detail.activeVersion && <Badge color="green">{t('rule_activeBadge')}</Badge>} <span className="text-text-tertiary">{v.note || ''} · {v.createdAt}</span></span>
                {v.version !== detail.activeVersion && <Btn size="sm" variant="secondary" onClick={() => op({ id: detail.id, op: 'setActive', version: v.version }, t('rule_rolledBack'))}>{t('rule_makeActive')}</Btn>}
              </div>
            ))}
          </div>
        </Card>
      </>
    )
  }

  const columns: Column<Rule>[] = [
    { key: 'nameEn', labelEn: 'Name', labelFa: t('rule_cName'), value: r => fa ? (r.nameFa || r.nameEn) : r.nameEn, render: r => <div><div className="font-medium text-text-primary">{fa ? (r.nameFa || r.nameEn) : r.nameEn}</div><div className="text-xs text-text-tertiary">{r.description || '—'}</div></div> },
    { key: 'key', labelEn: 'Key', labelFa: t('rule_cKey'), render: r => <span className="font-mono text-xs text-text-tertiary">{r.key}</span> },
    { key: 'category', labelEn: 'Category', labelFa: t('rule_cCategory'), type: 'enum', options: CATEGORIES.map(x => ({ value: x, labelEn: x, labelFa: x })), render: r => <Badge color="indigo">{t(`rule_cat_${r.category}` as 'rule_cat_general')}</Badge> },
    { key: 'activeVersion', labelEn: 'Version', labelFa: t('rule_cVersion'), type: 'number', numeric: true, render: r => <span className="text-text-secondary text-xs">v{r.activeVersion}/v{r.currentVersion}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('rule_cStatus'), type: 'enum', options: ['draft', 'active', 'archived'].map(x => ({ value: x, labelEn: x, labelFa: x })), render: r => <Badge color={statusColor(r.status)}>{r.status}</Badge> },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('rule_title')} subtitle={t('rule_subtitle')} action={<Btn onClick={() => { setDraft({ ...EMPTY }); setCreateOpen(true) }}>{t('rule_new')}</Btn>} />
      <Card className="p-4">
        <DataTable
          tableId="erp-rules"
          columns={columns}
          rows={rules}
          locale={fa ? 'fa' : 'en'}
          loading={loading}
          rowKey={r => String(r.id)}
          onRowClick={openDetail}
          exportName="business-rules"
          emptyLabel={t('rule_empty')}
          quickCreate={{ labelEn: 'New Rule', labelFa: t('rule_new'), onClick: () => { setDraft({ ...EMPTY }); setCreateOpen(true) } }}
        />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('rule_new')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><Input label={t('rule_fKey')} value={draft.key} onChange={v => setDraft(s => ({ ...s, key: v }))} placeholder="discount-policy" /><Select label={t('rule_fCategory')} value={draft.category} onChange={v => setDraft(s => ({ ...s, category: v }))} options={CATEGORIES.map(x => ({ value: x, label: t(`rule_cat_${x}` as 'rule_cat_general') }))} /></div>
          <div className="grid grid-cols-2 gap-4"><Input label={t('rule_fNameEn')} value={draft.nameEn} onChange={v => setDraft(s => ({ ...s, nameEn: v }))} /><Input label={t('rule_fNameFa')} value={draft.nameFa} onChange={v => setDraft(s => ({ ...s, nameFa: v }))} /></div>
          <Input label={t('rule_fDescription')} value={draft.description} onChange={v => setDraft(s => ({ ...s, description: v }))} />
          <div><label className="form-label">{t('rule_definition')}</label><textarea value={draft.definition} onChange={e => setDraft(s => ({ ...s, definition: e.target.value }))} rows={10} spellCheck={false} className="w-full font-mono text-xs bg-background border border-border rounded-lg p-3 text-text-primary" /></div>
          <div className="flex gap-3"><Btn onClick={create} disabled={saving}>{saving ? t('rule_saving') : t('rule_create')}</Btn><Btn variant="secondary" onClick={() => setCreateOpen(false)}>{t('rule_cancel')}</Btn></div>
        </div>
      </Modal>
    </>
  )
}
