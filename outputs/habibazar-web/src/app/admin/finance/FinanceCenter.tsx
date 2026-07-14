'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtMoney, setDefaultCurrency } from '@/lib/format'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Tab = 'dashboard' | 'accounts' | 'journal' | 'accounting' | 'reports' | 'currency' | 'banking'
type AType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

interface Account { id: number; code: string; nameEn: string; nameFa: string | null; type: AType; active: number; debit?: number; credit?: number }
interface Line { accountId: number; debit: number; credit: number; memo?: string }
interface Entry { id: number; entryNo: string; date: string; memo: string | null; status: string; total: number; createdAt?: string; postedAt?: string | null }
interface SLine { id: number; code: string; nameEn: string; nameFa?: string | null; amount: number }
interface TBRow { id: number; code: string; nameEn: string; nameFa?: string | null; type: AType; debit: number; credit: number }
interface Reports {
  trialBalance: { rows: TBRow[]; totalDebit: number; totalCredit: number; balanced: boolean }
  incomeStatement: { revenue: SLine[]; expenses: SLine[]; totalRevenue: number; totalExpenses: number; netIncome: number }
  balanceSheet: { assets: SLine[]; liabilities: SLine[]; equity: SLine[]; totalAssets: number; totalLiabilities: number; totalEquity: number; netIncome: number; balanced: boolean }
}
interface Overview {
  kpis: { totalAssets: number; totalLiabilities: number; totalEquity: number; revenue: number; expenses: number; netIncome: number; cash: number }
  income: Reports['incomeStatement']; balance: Reports['balanceSheet']
  recent: Entry[]; byStatus: Record<string, number>
}

const ATYPES: AType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']
const TYPE_COLOR: Record<AType, 'blue' | 'red' | 'indigo' | 'green' | 'yellow'> = { asset: 'blue', liability: 'red', equity: 'indigo', revenue: 'green', expense: 'yellow' }
const money = (n: number | null | undefined) => fmtMoney(n, { min: 2, max: 2, signed: true })

export function FinanceCenter() {
  const t = useT()
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [autoNew, setAutoNew] = useState(false)
  // Quick-action deep link (?new=journal) + tab deep link (?tab=currency…).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('new') === 'journal') { setTab('journal'); setAutoNew(true) }
    else if (sp.get('tab')) setTab(sp.get('tab') as Tab)
  }, [])
  return (
    <>
      <ToastContainer />
      <PageHeader title={t('fin_title')} subtitle={t('fin_subtitle')} />
      <div className="flex gap-1 mb-6 border-b border-subtle overflow-x-auto">
        {(['dashboard', 'accounts', 'journal', 'accounting', 'reports', 'currency', 'banking'] as Tab[]).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === tb ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {t(`fin_tab_${tb}` as 'fin_tab_dashboard')}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <div className="space-y-6"><Dashboard t={t} /><FinanceAiCard fa={fa} /></div>}
      {tab === 'accounts' && <Accounts t={t} fa={fa} toast={toast} />}
      {tab === 'journal' && <Journal t={t} fa={fa} toast={toast} autoNew={autoNew} onAutoNew={() => setAutoNew(false)} />}
      {tab === 'accounting' && <AccountingView fa={fa} toast={toast} />}
      {tab === 'reports' && <ReportsView t={t} fa={fa} />}
      {tab === 'currency' && <CurrencyView fa={fa} toast={toast} />}
      {tab === 'banking' && <BankingView fa={fa} toast={toast} />}
    </>
  )
}
type T = ReturnType<typeof useT>
type Toast = ReturnType<typeof useToast>['toast']

function Dashboard({ t }: { t: T }) {
  const { money: dmoney } = useDisplayCurrency()
  const [d, setD] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/finance/overview'); if (r.ok) setD(await r.json()) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  if (loading && !d) return <p className="text-sm text-text-tertiary">{t('fin_loading')}</p>
  if (!d) return <Card className="p-5"><p className="text-sm text-text-tertiary">{t('fin_empty')}</p></Card>
  const k = d.kpis
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><CurrencyPicker /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t('fin_kAssets')} value={dmoney(k.totalAssets)} icon="🏦" />
        <Kpi label={t('fin_kLiabilities')} value={dmoney(k.totalLiabilities)} icon="📕" />
        <Kpi label={t('fin_kEquity')} value={dmoney(k.totalEquity)} icon="📗" tone="ok" />
        <Kpi label={t('fin_kCash')} value={dmoney(k.cash)} icon="💵" />
        <Kpi label={t('fin_kRevenue')} value={dmoney(k.revenue)} icon="📈" tone="ok" />
        <Kpi label={t('fin_kExpenses')} value={dmoney(k.expenses)} icon="📉" />
        <Kpi label={t('fin_kNetIncome')} value={dmoney(k.netIncome)} icon="💰" tone={k.netIncome >= 0 ? 'ok' : 'bad'} />
        <Kpi label={t('fin_kEntries')} value={`${d.byStatus.posted ?? 0} / ${d.byStatus.draft ?? 0}`} icon="🧾" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fin_incomeSummary')}</h3>
          <Row label={t('fin_totalRevenue')} value={money(d.income.totalRevenue)} />
          <Row label={t('fin_totalExpenses')} value={money(d.income.totalExpenses)} />
          <div className="border-t border-subtle mt-2 pt-2"><Row label={t('fin_netIncome')} value={money(d.income.netIncome)} bold /></div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fin_balanceSummary')}</h3>
          <Row label={t('fin_totalAssets')} value={money(d.balance.totalAssets)} />
          <Row label={t('fin_totalLiabilities')} value={money(d.balance.totalLiabilities)} />
          <Row label={t('fin_totalEquity')} value={money(d.balance.totalEquity)} />
          <div className="mt-2"><Badge color={d.balance.balanced ? 'green' : 'red'}>{d.balance.balanced ? t('fin_balanced') : t('fin_unbalanced')}</Badge></div>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fin_recentEntries')}</h3>
        {d.recent.length === 0 ? <p className="text-xs text-text-tertiary">{t('fin_noEntries')}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-text-tertiary text-left border-b border-subtle">{[t('fin_cNo'), t('fin_cDate'), t('fin_cMemo'), t('fin_cStatus'), t('fin_cTotal')].map(h => <th key={h} className="px-3 py-2 text-xs font-medium">{h}</th>)}</tr></thead>
            <tbody>{d.recent.map(e => (
              <tr key={e.id} className="border-b border-subtle/50">
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">{e.entryNo}</td>
                <td className="px-3 py-2 text-text-tertiary text-xs">{e.date}</td>
                <td className="px-3 py-2 text-text-secondary text-xs">{e.memo || '—'}</td>
                <td className="px-3 py-2"><Badge color={e.status === 'posted' ? 'green' : e.status === 'void' ? 'slate' : 'yellow'}>{t(`fin_st_${e.status}` as 'fin_st_posted')}</Badge></td>
                <td className="px-3 py-2 text-text-secondary text-xs">{money(e.total)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'ok' | 'bad' }) {
  const ring = tone === 'ok' ? 'border-success/40' : tone === 'bad' ? 'border-danger/40' : 'border-subtle'
  return <div className={`rounded-xl p-4 bg-surface-2 border ${ring}`}><div className="flex items-center justify-between mb-1"><p className="text-xs text-text-tertiary">{label}</p><span aria-hidden>{icon}</span></div><p className="text-lg font-bold text-text-primary">{value}</p></div>
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className="flex justify-between py-1"><span className={`text-sm ${bold ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{label}</span><span className={`text-sm ${bold ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>{value}</span></div>
}

// ── Chart of Accounts ────────────────────────────────────────────────────────
function Accounts({ t, fa, toast }: { t: T; fa: boolean; toast: Toast }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Account>>({ type: 'asset', active: 1 })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/finance/accounts'); if (r.ok) { const d = await r.json(); setAccounts(d.accounts ?? []) } } catch { toast(t('fin_loadFail'), 'error') } finally { setLoading(false) } }, [toast, t])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing.code || !editing.nameEn) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/finance/accounts', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editing, active: editing.active !== 0 }) })
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed')
      toast(t('fin_saved'), 'success'); setModal(false); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('fin_saveFail'), 'error') } finally { setSaving(false) }
  }

  const bal = (a: Account) => { const net = (a.debit ?? 0) - (a.credit ?? 0); return (a.type === 'asset' || a.type === 'expense') ? net : -net }
  const columns: Column<Account>[] = [
    { key: 'code', labelEn: 'Code', labelFa: t('fin_cCode'), render: a => <span className="font-mono text-xs text-text-secondary">{a.code}</span> },
    { key: 'nameEn', labelEn: 'Name', labelFa: t('fin_cName'), value: a => fa ? (a.nameFa || a.nameEn) : a.nameEn, render: a => <span className="text-text-primary">{fa ? (a.nameFa || a.nameEn) : a.nameEn}</span> },
    { key: 'type', labelEn: 'Type', labelFa: t('fin_cType'), type: 'enum', options: ATYPES.map(x => ({ value: x, labelEn: x, labelFa: t(`fin_at_${x}` as 'fin_at_asset') })), render: a => <Badge color={TYPE_COLOR[a.type]}>{t(`fin_at_${a.type}` as 'fin_at_asset')}</Badge> },
    { key: 'balance', labelEn: 'Balance', labelFa: t('fin_cBalance'), type: 'number', numeric: true, value: bal, render: a => <span className="text-text-secondary text-xs">{money(bal(a))}</span> },
  ]
  const rowActions: RowAction<Account>[] = [{ id: 'edit', labelEn: 'Edit', labelFa: t('fin_edit'), icon: '✎', onClick: a => { setEditing(a); setModal(true) } }]
  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { setEditing({ type: 'asset', active: 1 }); setModal(true) }}>{t('fin_newAccount')}</Btn></div>
      <Card className="p-4">
        <DataTable tableId="finance-accounts" columns={columns} rows={accounts} locale={fa ? 'fa' : 'en'} loading={loading} rowKey={a => String(a.id)} rowActions={rowActions} exportName="chart-of-accounts" />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('fin_editAccount') : t('fin_newAccount')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('fin_fCode')} value={editing.code || ''} onChange={v => setEditing(e => ({ ...e, code: v }))} placeholder="1000" />
            <Select label={t('fin_fType')} value={editing.type || 'asset'} onChange={v => setEditing(e => ({ ...e, type: v as AType }))} options={ATYPES.map(x => ({ value: x, label: t(`fin_at_${x}` as 'fin_at_asset') }))} />
          </div>
          <Input label={t('fin_fNameEn')} value={editing.nameEn || ''} onChange={v => setEditing(e => ({ ...e, nameEn: v }))} />
          <Input label={t('fin_fNameFa')} value={editing.nameFa || ''} onChange={v => setEditing(e => ({ ...e, nameFa: v }))} />
          <div className="flex gap-3"><Btn onClick={save} disabled={saving}>{saving ? t('fin_saving') : t('fin_save')}</Btn><Btn variant="secondary" onClick={() => setModal(false)}>{t('fin_cancel')}</Btn></div>
        </div>
      </Modal>
    </>
  )
}

// ── Journal Entries ──────────────────────────────────────────────────────────
function Journal({ t, fa, toast, autoNew = false, onAutoNew }: { t: T; fa: boolean; toast: Toast; autoNew?: boolean; onAutoNew?: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  useEffect(() => { if (autoNew) { setModal(true); onAutoNew?.() } }, [autoNew, onAutoNew])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [currency, setCurrency] = useState('IRR')
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<Line[]>([{ accountId: 0, debit: 0, credit: 0 }, { accountId: 0, debit: 0, credit: 0 }])
  const [saving, setSaving] = useState(false)
  // 26.23: draft editing, copy-from-entry, templates, maker/checker queue.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [templates, setTemplates] = useState<{ id: number; name: string; memo: string | null; lines: string }[]>([])
  const [tplName, setTplName] = useState('')
  const [pending, setPending] = useState<{ id: number; entryId: number; title: string; amount: number; createdByName: string | null }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [e, a] = await Promise.all([fetch('/api/admin/erp/finance/journal').then(r => r.json()), fetch('/api/admin/erp/finance/accounts').then(r => r.json())])
      setEntries(e.entries ?? []); setAccounts((a.accounts ?? []).filter((x: Account) => x.active !== 0))
      const [tp, pa] = await Promise.all([
        fetch('/api/admin/erp/finance/journal?templates=1').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/erp/finance/journal?pendingApprovals=1').then(r => r.json()).catch(() => ({})),
      ])
      setTemplates(tp.templates ?? []); setPending(pa.pending ?? [])
    } catch { toast(t('fin_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), [lines])
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0), [lines])
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0

  function setLine(i: number, patch: Partial<Line>) { setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l)) }
  function reset() { setDate(new Date().toISOString().slice(0, 10)); setMemo(''); setLines([{ accountId: 0, debit: 0, credit: 0 }, { accountId: 0, debit: 0, credit: 0 }]); setEditingId(null); setTplName('') }

  // Load an existing entry's lines into the editor (draft edit or copy).
  async function loadEntry(id: number, asEdit: boolean) {
    const r = await fetch(`/api/admin/erp/finance/journal?id=${id}`)
    if (!r.ok) return
    const d = await r.json()
    setDate(asEdit ? d.entry.date : new Date().toISOString().slice(0, 10))
    setMemo(asEdit ? (d.entry.memo ?? '') : `${fa ? 'کپی از' : 'Copy of'} ${d.entry.entryNo}`)
    setLines((d.lines ?? []).map((l: { accountId: number; debit: number; credit: number }) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit })))
    setEditingId(asEdit ? id : null)
    setModal(true)
  }
  function loadTemplate(tpl: { memo: string | null; lines: string }) {
    try {
      const ls = JSON.parse(tpl.lines) as Line[]
      setLines(ls.map(l => ({ accountId: l.accountId, debit: l.debit || 0, credit: l.credit || 0 })))
      if (tpl.memo) setMemo(tpl.memo)
    } catch { /* malformed template */ }
  }

  async function submit(post: boolean) {
    const clean = lines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0))
    if (clean.length < 2 || !balanced) { toast(t('fin_mustBalance'), 'error'); return }
    setSaving(true)
    try {
      const r = editingId
        ? await fetch('/api/admin/erp/finance/journal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, op: 'update', date, memo, lines: clean }) })
        : await fetch('/api/admin/erp/finance/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, currency, memo, post, lines: clean, saveTemplate: tplName.trim() || undefined }) })
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed')
      if (d.pendingApproval) toast(fa ? 'سند در صف تأیید قرار گرفت (Maker/Checker)' : 'Entry queued for approval (maker/checker)', 'success')
      else toast(post ? t('fin_posted') : t('fin_savedDraft'), 'success')
      setModal(false); reset(); load()
    } catch (e) { toast(e instanceof Error ? e.message : t('fin_saveFail'), 'error') } finally { setSaving(false) }
  }
  async function op(id: number, o: 'post' | 'void') {
    const r = await fetch('/api/admin/erp/finance/journal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, op: o }) })
    if (r.ok) { toast(t('fin_saved'), 'success'); load() } else { const d = await r.json().catch(() => ({})); toast(d.error || t('fin_saveFail'), 'error') }
  }

  const accOpts = accounts.map(a => ({ value: String(a.id), label: `${a.code} — ${fa ? (a.nameFa || a.nameEn) : a.nameEn}` }))
  const journalColumns: Column<Entry>[] = [
    { key: 'entryNo', labelEn: 'No.', labelFa: t('fin_cNo'), render: e => <span className="font-mono text-xs text-text-secondary">{e.entryNo}</span> },
    { key: 'date', labelEn: 'Date', labelFa: t('fin_cDate'), type: 'date', render: e => <span className="text-text-tertiary text-xs">{e.date}</span> },
    { key: 'memo', labelEn: 'Memo', labelFa: t('fin_cMemo'), render: e => <span className="text-text-secondary text-xs">{e.memo || '—'}</span> },
    { key: 'status', labelEn: 'Status', labelFa: t('fin_cStatus'), type: 'enum', options: ['draft', 'posted', 'void'].map(x => ({ value: x, labelEn: x, labelFa: t(`fin_st_${x}` as 'fin_st_posted') })), render: e => <Badge color={e.status === 'posted' ? 'green' : e.status === 'void' ? 'slate' : 'yellow'}>{t(`fin_st_${e.status}` as 'fin_st_posted')}</Badge> },
    { key: 'total', labelEn: 'Total', labelFa: t('fin_cTotal'), type: 'number', numeric: true, render: e => <span className="text-text-secondary text-xs">{money(e.total)}</span> },
  ]
  const journalActions: RowAction<Entry>[] = [
    { id: 'post', labelEn: 'Post', labelFa: t('fin_post'), icon: '✓', hidden: e => e.status !== 'draft', onClick: e => op(e.id, 'post') },
    { id: 'editDraft', labelEn: 'Edit draft', labelFa: fa ? 'ویرایش پیش‌نویس' : 'Edit draft', icon: '✎', hidden: e => e.status !== 'draft', onClick: e => loadEntry(e.id, true) },
    { id: 'copy', labelEn: 'Copy entry', labelFa: fa ? 'کپی از سند' : 'Copy entry', icon: '⧉', onClick: e => loadEntry(e.id, false) },
    { id: 'void', labelEn: 'Void (reversal)', labelFa: fa ? 'ابطال (سند معکوس)' : 'Void (reversal)', icon: '✕', danger: true, hidden: e => e.status !== 'posted', onClick: e => op(e.id, 'void') },
  ]
  return (
    <>
      {pending.length > 0 && (
        <Card className="p-3 mb-4 border-warning/40">
          <p className="text-xs font-semibold text-warning mb-1">{fa ? `${pending.length} سند در انتظار تأیید (Maker/Checker)` : `${pending.length} entr${pending.length === 1 ? 'y' : 'ies'} awaiting posting approval`}</p>
          <div className="flex flex-wrap gap-2">
            {pending.map(p => <Link key={p.id} href="/admin/approvals" className="text-2xs text-brand hover:underline">{p.title} · {money(p.amount)} · {p.createdByName ?? ''}</Link>)}
          </div>
        </Card>
      )}
      <div className="flex justify-end mb-4"><Btn onClick={() => { reset(); setModal(true) }}>{t('fin_newEntry')}</Btn></div>
      <Card className="p-4">
        <DataTable tableId="finance-journal" columns={journalColumns} rows={entries} locale={fa ? 'fa' : 'en'} loading={loading} rowKey={e => String(e.id)} rowActions={journalActions} exportName="journal-entries" emptyLabel={t('fin_noEntries')} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editingId ? (fa ? `ویرایش پیش‌نویس #${editingId}` : `Edit draft #${editingId}`) : t('fin_newEntry')} size="xl">
        <div className="space-y-4">
          {!editingId && templates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">{fa ? 'الگو:' : 'Template:'}</span>
              <select onChange={e => { const tpl = templates.find(x => String(x.id) === e.target.value); if (tpl) loadTemplate(tpl) }} defaultValue="" className="form-input !py-1.5 !px-2 text-xs w-auto">
                <option value="" disabled>{fa ? 'بارگذاری الگو…' : 'Load a template…'}</option>
                {templates.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('fin_fDate')} type="date" value={date} onChange={setDate} />
            <Select label={fa ? 'ارز' : 'Currency'} value={currency} onChange={setCurrency} options={['IRR', 'IRT', 'USD', 'EUR'].map(c => ({ value: c, label: c }))} />
            <Input label={t('fin_fMemo')} value={memo} onChange={setMemo} />
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-text-tertiary px-1"><span className="col-span-6">{t('fin_lAccount')}</span><span className="col-span-2 text-right">{t('fin_lDebit')}</span><span className="col-span-2 text-right">{t('fin_lCredit')}</span></div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6"><Select value={String(l.accountId)} onChange={v => setLine(i, { accountId: Number(v) })} options={[{ value: '0', label: t('fin_selectAccount') }, ...accOpts]} /></div>
                <input type="number" value={l.debit || ''} onChange={e => setLine(i, { debit: Number(e.target.value) || 0, credit: 0 })} className="form-input col-span-2 text-right !py-2" />
                <input type="number" value={l.credit || ''} onChange={e => setLine(i, { credit: Number(e.target.value) || 0, debit: 0 })} className="form-input col-span-2 text-right !py-2" />
                <button onClick={() => setLines(ls => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls)} className="col-span-2 text-xs text-danger hover:underline">{t('fin_removeLine')}</button>
              </div>
            ))}
            <button onClick={() => setLines(ls => [...ls, { accountId: 0, debit: 0, credit: 0 }])} className="text-xs text-brand hover:underline">{t('fin_addLine')}</button>
          </div>
          <div className={`flex justify-between items-center rounded-lg p-3 border ${balanced ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'}`}>
            <span className="text-sm text-text-secondary">{t('fin_totals')}: {money(totalDebit)} / {money(totalCredit)}</span>
            <Badge color={balanced ? 'green' : 'red'}>{balanced ? t('fin_balanced') : t('fin_unbalanced')}</Badge>
          </div>
          {!editingId && <Input label={fa ? 'ذخیره به‌عنوان الگو (اختیاری)' : 'Save as template (optional)'} value={tplName} onChange={setTplName} />}
          <div className="flex gap-3">
            {!editingId && <Btn onClick={() => submit(true)} disabled={saving || !balanced}>{t('fin_postEntry')}</Btn>}
            <Btn variant="secondary" onClick={() => submit(false)} disabled={saving || !balanced}>{editingId ? (fa ? 'ذخیره تغییرات' : 'Save changes') : t('fin_saveDraft')}</Btn>
            <Btn variant="ghost" onClick={() => setModal(false)}>{t('fin_cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Reports ──────────────────────────────────────────────────────────────────
interface CompanyRow { id: number; code: string; nameEn: string; nameFa: string; isDefault: boolean }
function ReportsView({ t, fa }: { t: T; fa: boolean }) {
  const [d, setD] = useState<(Reports & { companies?: CompanyRow[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'trial' | 'income' | 'balance'>('trial')
  const [company, setCompany] = useState('all')
  const [showCompany, setShowCompany] = useState(false)
  const [showIc, setShowIc] = useState(false)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch(`/api/admin/erp/finance/reports?company=${company}`); if (r.ok) setD(await r.json()) } finally { setLoading(false) } }, [company])
  useEffect(() => { load() }, [load])
  if (loading && !d) return <p className="text-sm text-text-tertiary">{t('fin_loading')}</p>
  if (!d) return <Card className="p-5"><p className="text-sm text-text-tertiary">{t('fin_empty')}</p></Card>
  const name = (l: { nameEn: string; nameFa?: string | null }) => fa ? (l.nameFa || l.nameEn) : l.nameEn
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(['trial', 'income', 'balance'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === v ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>{t(`fin_rep_${v}` as 'fin_rep_trial')}</button>
          ))}
        </div>
        <div className="ms-auto flex items-end gap-2">
          <Select label={L(fa, 'Company scope', 'محدودهٔ شرکت')} value={company} onChange={setCompany}
            options={[{ value: 'all', label: L(fa, 'Consolidated (all companies)', 'تلفیقی (همهٔ شرکت‌ها)') }, ...((d?.companies ?? []).map(c => ({ value: String(c.id), label: `${fa ? c.nameFa : c.nameEn} (${c.code})` })))]} />
          <Btn size="sm" variant="secondary" onClick={() => setShowCompany(true)}>+ {L(fa, 'Company', 'شرکت')}</Btn>
          <Btn size="sm" variant="secondary" onClick={() => setShowIc(true)}>⇄ {L(fa, 'Intercompany', 'بین‌شرکتی')}</Btn>
        </div>
      </div>
      {showCompany && <CompanyModal fa={fa} onClose={() => setShowCompany(false)} onDone={() => { setShowCompany(false); load() }} />}
      {showIc && <IntercompanyModal fa={fa} companies={d?.companies ?? []} onClose={() => setShowIc(false)} onDone={() => { setShowIc(false); load() }} />}
      {view === 'trial' && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fin_rep_trial')}</h3>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-text-tertiary text-left border-b border-subtle">{[t('fin_cCode'), t('fin_cName'), t('fin_lDebit'), t('fin_lCredit')].map(h => <th key={h} className="px-3 py-2 text-xs font-medium">{h}</th>)}</tr></thead>
            <tbody>{d.trialBalance.rows.map(r => (
              <tr key={r.id} className="border-b border-subtle/50"><td className="px-3 py-1.5 font-mono text-xs text-text-tertiary">{r.code}</td><td className="px-3 py-1.5 text-text-secondary">{name(r)}</td><td className="px-3 py-1.5 text-text-secondary text-xs">{r.debit ? money(r.debit) : ''}</td><td className="px-3 py-1.5 text-text-secondary text-xs">{r.credit ? money(r.credit) : ''}</td></tr>
            ))}</tbody>
            <tfoot><tr className="border-t-2 border-subtle font-bold"><td className="px-3 py-2" colSpan={2}>{t('fin_total')}</td><td className="px-3 py-2 text-xs">{money(d.trialBalance.totalDebit)}</td><td className="px-3 py-2 text-xs">{money(d.trialBalance.totalCredit)}</td></tr></tfoot>
          </table></div>
          <div className="mt-3"><Badge color={d.trialBalance.balanced ? 'green' : 'red'}>{d.trialBalance.balanced ? t('fin_balanced') : t('fin_unbalanced')}</Badge></div>
        </Card>
      )}
      {view === 'income' && (
        <Card className="p-5 max-w-2xl">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fin_rep_income')}</h3>
          <p className="text-xs text-text-tertiary uppercase mt-2 mb-1">{t('fin_at_revenue')}</p>
          {d.incomeStatement.revenue.map(l => <Row key={l.id} label={name(l)} value={money(l.amount)} />)}
          <div className="border-t border-subtle mt-1 pt-1"><Row label={t('fin_totalRevenue')} value={money(d.incomeStatement.totalRevenue)} bold /></div>
          <p className="text-xs text-text-tertiary uppercase mt-4 mb-1">{t('fin_at_expense')}</p>
          {d.incomeStatement.expenses.map(l => <Row key={l.id} label={name(l)} value={money(l.amount)} />)}
          <div className="border-t border-subtle mt-1 pt-1"><Row label={t('fin_totalExpenses')} value={money(d.incomeStatement.totalExpenses)} bold /></div>
          <div className="border-t-2 border-subtle mt-3 pt-2"><Row label={t('fin_netIncome')} value={money(d.incomeStatement.netIncome)} bold /></div>
        </Card>
      )}
      {view === 'balance' && (
        <Card className="p-5 max-w-2xl">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t('fin_rep_balance')}</h3>
          <p className="text-xs text-text-tertiary uppercase mt-2 mb-1">{t('fin_at_asset')}</p>
          {d.balanceSheet.assets.map(l => <Row key={l.id} label={name(l)} value={money(l.amount)} />)}
          <div className="border-t border-subtle mt-1 pt-1"><Row label={t('fin_totalAssets')} value={money(d.balanceSheet.totalAssets)} bold /></div>
          <p className="text-xs text-text-tertiary uppercase mt-4 mb-1">{t('fin_at_liability')}</p>
          {d.balanceSheet.liabilities.map(l => <Row key={l.id} label={name(l)} value={money(l.amount)} />)}
          <div className="border-t border-subtle mt-1 pt-1"><Row label={t('fin_totalLiabilities')} value={money(d.balanceSheet.totalLiabilities)} bold /></div>
          <p className="text-xs text-text-tertiary uppercase mt-4 mb-1">{t('fin_at_equity')}</p>
          {d.balanceSheet.equity.map(l => <Row key={l.id} label={name(l)} value={money(l.amount)} />)}
          <Row label={t('fin_netIncome')} value={money(d.balanceSheet.netIncome)} />
          <div className="border-t border-subtle mt-1 pt-1"><Row label={t('fin_totalEquity')} value={money(d.balanceSheet.totalEquity)} bold /></div>
          <div className="mt-3"><Badge color={d.balanceSheet.balanced ? 'green' : 'red'}>{d.balanceSheet.balanced ? t('fin_balanced') : t('fin_unbalanced')}</Badge></div>
        </Card>
      )}
    </div>
  )
}

// ── Currency & exchange rates (Phase 26) ─────────────────────────────────────
interface CurRow { code: string; nameEn: string; nameFa: string; symbolEn: string; symbolFa: string; decimals: number; isBase: boolean; active: boolean; latestRate: number | null; rateDate: string | null }
const L = (fa: boolean, en: string, faS: string) => (fa ? faS : en)

function CurrencyView({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<CurRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ code: 'USD', rateDate: new Date().toISOString().slice(0, 10), baseRate: '' })
  const [conv, setConv] = useState({ amount: '1', from: 'IRT', to: 'IRR', result: '' })
  const [cfg, setCfg] = useState<{ defaultCurrency: string; displayCurrency: string; decimalPrecision: number; supportedCurrencies: string[] } | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try { const d = await fetch('/api/admin/erp/finance/currency').then(r => r.json()); setRows(d.currencies ?? []) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { fetch('/api/admin/erp/settings').then(r => r.json()).then(setCfg).catch(() => {}) }, [])
  async function saveCfg(patch: Record<string, unknown>) {
    const r = await fetch('/api/admin/erp/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { setCfg(c => c ? { ...c, ...d } : c); setDefaultCurrency(d.displayCurrency || d.defaultCurrency, d.decimalPrecision); toast(L(fa, 'Currency settings saved', 'تنظیمات ارز ذخیره شد'), 'success') }
    else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
  }

  async function saveRate() {
    if (!form.baseRate) { toast(L(fa, 'Enter a rate', 'نرخ را وارد کنید'), 'error'); return }
    const r = await fetch('/api/admin/erp/finance/currency', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setRate', code: form.code, rateDate: form.rateDate, baseRate: Number(form.baseRate) }) })
    if (r.ok) { toast(L(fa, 'Rate saved', 'نرخ ذخیره شد'), 'success'); setForm(f => ({ ...f, baseRate: '' })); load() }
    else { const d = await r.json().catch(() => ({})); toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error') }
  }
  async function doConvert() {
    const d = await fetch(`/api/admin/erp/finance/currency?convert=${encodeURIComponent(conv.amount)}&from=${conv.from}&to=${conv.to}`).then(r => r.json())
    setConv(c => ({ ...c, result: String(d.result ?? '') }))
  }

  const codes = rows.map(r => ({ value: r.code, label: r.code }))
  const columns: Column<CurRow>[] = [
    { key: 'code', labelEn: 'Code', labelFa: 'کد', render: c => <span className="font-mono font-semibold">{c.code}{c.isBase && <Badge color="blue">base</Badge>}</span> },
    { key: 'nameEn', labelEn: 'Name', labelFa: 'نام', render: c => <span>{fa ? c.nameFa : c.nameEn}</span> },
    { key: 'latestRate', labelEn: 'Rial rate', labelFa: 'نرخ ریالی', type: 'number', numeric: true, render: c => <span>{c.latestRate != null ? c.latestRate.toLocaleString() : (c.code === 'IRR' ? '1' : c.code === 'IRT' ? '10' : '—')}</span> },
    { key: 'rateDate', labelEn: 'As of', labelFa: 'تاریخ', render: c => <span className="text-xs text-text-tertiary">{c.rateDate ?? '—'}</span> },
  ]
  return (
    <div className="space-y-4">
      {cfg && (
        <Card className="p-4 flex flex-wrap items-end gap-3">
          <h4 className="w-full text-xs font-semibold text-text-primary">{L(fa, 'Global currency configuration', 'پیکربندی سراسری ارز')}</h4>
          <Select label={L(fa, 'Default transaction currency', 'ارز پیش‌فرض اسناد')} value={cfg.defaultCurrency} onChange={v => saveCfg({ defaultCurrency: v })} options={(cfg.supportedCurrencies ?? ['IRR', 'IRT', 'USD', 'EUR']).map(c => ({ value: c, label: c }))} />
          <Select label={L(fa, 'Display currency (dashboards)', 'ارز نمایش (داشبوردها)')} value={cfg.displayCurrency} onChange={v => saveCfg({ displayCurrency: v })} options={(cfg.supportedCurrencies ?? ['IRR', 'IRT', 'USD', 'EUR']).map(c => ({ value: c, label: c }))} />
          <Select label={L(fa, 'Decimals', 'اعشار')} value={String(cfg.decimalPrecision)} onChange={v => saveCfg({ decimalPrecision: Number(v) })} options={['0', '1', '2', '3', '4'].map(x => ({ value: x, label: x }))} />
          <p className="w-full text-3xs text-text-tertiary">{L(fa, 'IRR is the base (1 Toman = 10 Rial); USD/EUR convert via the daily rates below. All KPIs and documents follow this configuration.', 'ریال مبناست (۱ تومان = ۱۰ ریال)؛ دلار/یورو با نرخ روزانه زیر تبدیل می‌شوند. همه KPIها و اسناد از همین پیکربندی پیروی می‌کنند.')}</p>
        </Card>
      )}
      <RevaluationSection fa={fa} toast={toast} />
      <TaxProfilesSection fa={fa} toast={toast} />
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Set exchange rate', 'ثبت نرخ ارز')}</h3>
          <p className="text-xs text-text-tertiary">{L(fa, 'Rate = Rial value of one unit of the currency.', 'نرخ = ارزش ریالی هر واحد ارز.')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Select label={L(fa, 'Currency', 'ارز')} value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} options={codes.filter(c => c.value !== 'IRR' && c.value !== 'IRT')} />
            <Input label={L(fa, 'Date', 'تاریخ')} value={form.rateDate} onChange={v => setForm(f => ({ ...f, rateDate: v }))} />
          </div>
          <Input label={L(fa, 'Rial per unit', 'ریال به ازای هر واحد')} value={form.baseRate} onChange={v => setForm(f => ({ ...f, baseRate: v }))} type="text" />
          <Btn onClick={saveRate}>{L(fa, 'Save rate', 'ذخیره نرخ')}</Btn>
        </Card>
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Converter', 'مبدل ارز')}</h3>
          <div className="grid grid-cols-3 gap-2 items-end">
            <Input label={L(fa, 'Amount', 'مبلغ')} value={conv.amount} onChange={v => setConv(c => ({ ...c, amount: v }))} />
            <Select label={L(fa, 'From', 'از')} value={conv.from} onChange={v => setConv(c => ({ ...c, from: v }))} options={codes} />
            <Select label={L(fa, 'To', 'به')} value={conv.to} onChange={v => setConv(c => ({ ...c, to: v }))} options={codes} />
          </div>
          <Btn variant="secondary" onClick={doConvert}>{L(fa, 'Convert', 'تبدیل')}</Btn>
          {conv.result !== '' && <p className="text-lg font-bold text-text-primary">{Number(conv.result).toLocaleString()} <span className="text-sm text-text-tertiary">{conv.to}</span></p>}
        </Card>
      </div>
      <Card className="p-4">
        <DataTable tableId="erp-currencies" columns={columns} rows={rows} locale={fa ? 'fa' : 'en'} loading={loading} rowKey={c => c.code} onRefresh={load} exportName="currencies" emptyLabel={L(fa, 'No currencies.', 'ارزی نیست.')} />
      </Card>
    </div>
  )
}

// ── Banking: reconciliation · cheques · petty cash (Phase 26) ─────────────────
interface BankAccount { id: number; name: string; bank: string | null; iban: string | null; currency: string }
interface StmtLine { id: number; date: string; description: string | null; amount: number; reference: string | null; status: string; matched_ref: string | null }
interface Cheque { id: number; direction: string; number: string; party: string; amount: number; dueDate: string | null; status: string }
interface PettyRow { id: number; kind: string; date: string; amount: number; category: string | null; note: string | null }

function BankingView({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [sec, setSec] = useState<'recon' | 'cheques' | 'petty' | 'cashflow'>('recon')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit rounded-lg bg-white/5 p-1">
        {([['recon', 'Reconciliation', 'مغایرت‌گیری بانکی'], ['cheques', 'Cheques', 'چک‌ها'], ['petty', 'Petty cash', 'تنخواه'], ['cashflow', 'Cash flow', 'جریان نقدی']] as const).map(([id, en, faL]) => (
          <button key={id} onClick={() => setSec(id)} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${sec === id ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>{L(fa, en, faL)}</button>
        ))}
      </div>
      {sec === 'recon' && <ReconSection fa={fa} toast={toast} />}
      {sec === 'cheques' && <ChequeSection fa={fa} toast={toast} />}
      {sec === 'petty' && <PettySection fa={fa} toast={toast} />}
      {sec === 'cashflow' && <CashFlowSection fa={fa} />}
    </div>
  )
}

/** Treasury dashboard: live bank balances + monthly in/out/net + MA forecast. */
function CashFlowSection({ fa }: { fa: boolean }) {
  interface CfPoint { month: string; inflow: number; outflow: number; net: number }
  interface CfData { months: CfPoint[]; forecast: CfPoint[]; totals: { inflow: number; outflow: number; net: number }; accounts: { id: number; name: string; currency: string; balance: number }[]; bankBalance: number }
  const [d, setD] = useState<CfData | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/admin/erp/finance/banking?view=cashflow').then(r => r.json()).then(setD).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="h-60 rounded-xl border border-subtle bg-surface animate-pulse" />
  if (!d) return <Card className="p-8 text-center text-sm text-text-tertiary">{L(fa, 'Cash-flow data unavailable.', 'داده جریان نقدی در دسترس نیست.')}</Card>
  const peak = Math.max(1, ...d.months.map(m => Math.max(m.inflow, m.outflow)), ...d.forecast.map(m => Math.max(m.inflow, m.outflow)))
  const bar = (v: number, tone: 'in' | 'out') => (
    <div className="h-2 rounded bg-surface-2 overflow-hidden"><div className={`h-full ${tone === 'in' ? 'bg-success' : 'bg-danger'}`} style={{ width: `${Math.min(100, (v / peak) * 100)}%` }} /></div>
  )
  const rows = [...d.months.map(m => ({ ...m, isForecast: false })), ...d.forecast.map(m => ({ ...m, isForecast: true }))]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Bank balance (live)', 'موجودی بانک (زنده)', d.bankBalance.toLocaleString(), d.bankBalance >= 0],
          ['Inflow (12m)', 'ورودی (۱۲ ماه)', d.totals.inflow.toLocaleString(), true],
          ['Outflow (12m)', 'خروجی (۱۲ ماه)', d.totals.outflow.toLocaleString(), false],
          ['Net (12m)', 'خالص (۱۲ ماه)', d.totals.net.toLocaleString(), d.totals.net >= 0],
        ] as const).map(([en, faL, v, ok]) => (
          <div key={en} className={`rounded-xl p-3 bg-surface-2 border ${ok ? 'border-success/40' : 'border-danger/40'}`}>
            <p className="text-xs text-text-tertiary">{L(fa, en, faL)}</p><p className="text-lg font-bold text-text-primary">{v}</p>
          </div>
        ))}
      </div>
      {d.accounts.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold text-text-primary mb-2">{L(fa, 'Account balances', 'موجودی حساب‌ها')}</h4>
          <div className="flex flex-wrap gap-2">
            {d.accounts.map(a => (
              <span key={a.id} className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3 py-1.5 text-sm">
                <span className="text-text-secondary">{a.name}</span>
                <span className={`font-semibold ${a.balance >= 0 ? 'text-success-text' : 'text-danger-text'}`}>{a.balance.toLocaleString()} {a.currency}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
      <Card className="p-4">
        <h4 className="text-xs font-semibold text-text-primary mb-3">{L(fa, 'Monthly cash flow + 3-month forecast (moving average)', 'جریان نقدی ماهانه + پیش‌بینی ۳ ماهه (میانگین متحرک)')}</h4>
        <div className="space-y-1.5">
          {rows.map(m => (
            <div key={m.month} className={`grid grid-cols-12 items-center gap-2 text-xs rounded-lg px-2 py-1.5 ${m.isForecast ? 'border border-dashed border-subtle opacity-80' : ''}`}>
              <span className="col-span-2 font-mono text-text-tertiary">{m.month}{m.isForecast && <span className="ms-1 text-4xs">{L(fa, '(fc)', '(پیش‌بینی)')}</span>}</span>
              <div className="col-span-3">{bar(m.inflow, 'in')}</div>
              <span className="col-span-2 text-success-text text-end">{m.inflow.toLocaleString()}</span>
              <div className="col-span-3">{bar(m.outflow, 'out')}</div>
              <span className="col-span-1 text-danger-text text-end">{m.outflow.toLocaleString()}</span>
              <span className={`col-span-1 text-end font-semibold ${m.net >= 0 ? 'text-success-text' : 'text-danger-text'}`}>{m.net.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="text-3xs text-text-tertiary mt-3">{L(fa, 'Inflow = customer receipts (sales payments) · Outflow = vendor payments (purchasing). Forecast holds the trailing 3-month average.', 'ورودی = دریافت از مشتری (پرداخت‌های فروش) · خروجی = پرداخت به تأمین‌کننده (خرید). پیش‌بینی، میانگین ۳ ماه اخیر است.')}</p>
      </Card>
    </div>
  )
}

function ReconSection({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [accountId, setAccountId] = useState(0)
  const [lines, setLines] = useState<StmtLine[]>([])
  const [summary, setSummary] = useState<{ total: number; matched: number; unmatched: number; matchedPct: number; inflow: number; outflow: number } | null>(null)
  const [csv, setCsv] = useState('')

  const loadAccounts = useCallback(async () => {
    const d = await fetch('/api/admin/erp/finance/banking?view=accounts').then(r => r.json()).catch(() => ({ accounts: [] }))
    setAccounts(d.accounts ?? [])
    if (!accountId && d.accounts?.[0]) setAccountId(d.accounts[0].id)
  }, [accountId])
  const loadLines = useCallback(async () => {
    if (!accountId) return
    const d = await fetch(`/api/admin/erp/finance/banking?view=statement&account=${accountId}`).then(r => r.json()).catch(() => ({}))
    setLines(d.lines ?? []); setSummary(d.summary ?? null)
  }, [accountId])
  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadLines() }, [loadLines])

  async function post(bodyObj: Record<string, unknown>, okMsg: string) {
    const r = await fetch('/api/admin/erp/finance/banking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(okMsg, 'success'); loadAccounts(); loadLines() } else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
    return d
  }
  async function addAccount() {
    const name = window.prompt(L(fa, 'Account name', 'نام حساب')); if (!name) return
    await post({ action: 'account.create', name }, L(fa, 'Account created', 'حساب ساخته شد'))
  }
  async function importCsv() {
    // CSV: date,amount,description — one line per row.
    const rows = csv.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [date, amount, ...desc] = l.split(',')
      return { date: date?.trim(), amount: Number(amount), description: desc.join(',').trim() || undefined }
    }).filter(r => r.date && Number.isFinite(r.amount))
    if (!rows.length) { toast(L(fa, 'No valid rows (date,amount,description)', 'ردیف معتبری نیست'), 'error'); return }
    const d = await post({ action: 'statement.import', accountId, lines: rows }, L(fa, 'Statement imported', 'صورتحساب وارد شد'))
    if (d.imported != null) setCsv('')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select label={L(fa, 'Bank account', 'حساب بانکی')} value={String(accountId)} onChange={v => setAccountId(Number(v))} options={[{ value: '0', label: '—' }, ...accounts.map(a => ({ value: String(a.id), label: a.name }))]} />
        <Btn size="sm" variant="secondary" onClick={addAccount}>+ {L(fa, 'New account', 'حساب جدید')}</Btn>
        <Btn size="sm" onClick={() => post({ action: 'statement.auto', accountId }, L(fa, 'Auto-match complete', 'تطبیق خودکار انجام شد'))} disabled={!accountId}>⚡ {L(fa, 'Auto-match', 'تطبیق خودکار')}</Btn>
      </div>
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {([['Total lines', 'کل ردیف‌ها', summary.total], ['Matched', 'تطبیق‌شده', summary.matched], ['Unmatched', 'نامطابق', summary.unmatched], ['Inflow', 'ورودی', summary.inflow.toLocaleString()], ['Outflow', 'خروجی', summary.outflow.toLocaleString()]] as const).map(([en, faL, v]) => (
            <div key={en} className="rounded-xl p-3 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary">{L(fa, en, faL)}</p><p className="text-lg font-bold text-text-primary">{v}</p></div>
          ))}
        </div>
      )}
      <Card className="p-4 space-y-2">
        <h4 className="text-xs font-semibold text-text-primary">{L(fa, 'Import statement (CSV: date,amount,description)', 'ورود صورتحساب (CSV: تاریخ،مبلغ،شرح)')}</h4>
        <Input label="" value={csv} onChange={setCsv} multiline rows={3} placeholder="2026-07-01, 1500000, Customer transfer" />
        <Btn size="sm" variant="secondary" onClick={importCsv} disabled={!accountId}>{L(fa, 'Import', 'ورود')}</Btn>
      </Card>
      <Card className="p-4">
        <DataTable tableId="bank-statement" columns={[
          { key: 'date', labelEn: 'Date', labelFa: 'تاریخ' },
          { key: 'description', labelEn: 'Description', labelFa: 'شرح', render: (l: StmtLine) => <span className="text-text-secondary text-xs">{l.description || '—'}</span> },
          { key: 'amount', labelEn: 'Amount', labelFa: 'مبلغ', type: 'number', numeric: true, render: (l: StmtLine) => <span className={l.amount >= 0 ? 'text-success-text' : 'text-danger-text'}>{l.amount.toLocaleString()}</span> },
          { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum', render: (l: StmtLine) => <span className="flex items-center gap-1"><Badge color={l.status === 'matched' ? 'green' : l.status === 'excluded' ? 'slate' : 'yellow'}>{l.status}</Badge>{l.matched_ref && <span className="text-4xs text-text-tertiary font-mono">{l.matched_ref}</span>}</span> },
        ] as Column<StmtLine>[]} rows={lines} locale={fa ? 'fa' : 'en'} rowKey={(l: StmtLine) => String(l.id)}
          rowActions={[
            { id: 'unmatch', labelEn: 'Unmatch', labelFa: 'لغو تطبیق', icon: '↩', hidden: (l: StmtLine) => l.status !== 'matched', onClick: (l: StmtLine) => post({ action: 'statement.set', lineId: l.id, status: 'unmatched' }, L(fa, 'Unmatched', 'لغو شد')) },
            { id: 'exclude', labelEn: 'Exclude', labelFa: 'مستثنا', icon: '✕', hidden: (l: StmtLine) => l.status === 'excluded', onClick: (l: StmtLine) => post({ action: 'statement.set', lineId: l.id, status: 'excluded' }, L(fa, 'Excluded', 'مستثنا شد')) },
          ] as RowAction<StmtLine>[]}
          exportName="bank-statement" emptyLabel={L(fa, 'No statement lines — import a CSV above.', 'ردیفی نیست — CSV وارد کنید.')} />
      </Card>
    </div>
  )
}

function ChequeSection({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<Cheque[]>([])
  const [kpis, setKpis] = useState<{ open: number; openAmount: number; dueSoon: number; bounced: number; cleared: number } | null>(null)
  const [form, setForm] = useState({ direction: 'issued', number: '', party: '', amount: '', dueDate: '' })
  const load = useCallback(async () => {
    const d = await fetch('/api/admin/erp/finance/banking?view=cheques').then(r => r.json()).catch(() => ({}))
    setRows(d.cheques ?? []); setKpis(d.kpis ?? null)
  }, [])
  useEffect(() => { load() }, [load])
  async function post(bodyObj: Record<string, unknown>, okMsg: string) {
    const r = await fetch('/api/admin/erp/finance/banking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(okMsg, 'success'); load() } else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
  }
  const NEXT: Record<string, string[]> = { issued: ['presented', 'cancelled'], received: ['deposited', 'cancelled'], presented: ['cleared', 'bounced'], deposited: ['cleared', 'bounced'], bounced: ['presented', 'deposited', 'cancelled'] }
  return (
    <div className="space-y-4">
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {([['Open', 'باز', kpis.open], ['Open amount', 'مبلغ باز', kpis.openAmount.toLocaleString()], ['Due ≤7d', 'سررسید ≤۷روز', kpis.dueSoon], ['Bounced', 'برگشتی', kpis.bounced], ['Cleared', 'وصول‌شده', kpis.cleared]] as const).map(([en, faL, v]) => (
            <div key={en} className="rounded-xl p-3 bg-surface-2 border border-subtle"><p className="text-xs text-text-tertiary">{L(fa, en, faL)}</p><p className="text-lg font-bold text-text-primary">{v}</p></div>
          ))}
        </div>
      )}
      <Card className="p-4 grid md:grid-cols-6 gap-3 items-end">
        <Select label={L(fa, 'Direction', 'نوع')} value={form.direction} onChange={v => setForm(f => ({ ...f, direction: v }))} options={[{ value: 'issued', label: L(fa, 'Issued (payable)', 'پرداختنی') }, { value: 'received', label: L(fa, 'Received (receivable)', 'دریافتنی') }]} />
        <Input label={L(fa, 'Cheque no.', 'شماره چک')} value={form.number} onChange={v => setForm(f => ({ ...f, number: v }))} />
        <Input label={L(fa, 'Party', 'طرف')} value={form.party} onChange={v => setForm(f => ({ ...f, party: v }))} />
        <Input label={L(fa, 'Amount', 'مبلغ')} value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
        <Input label={L(fa, 'Due date', 'سررسید')} value={form.dueDate} onChange={v => setForm(f => ({ ...f, dueDate: v }))} placeholder="2026-08-01" />
        <Btn onClick={() => { if (!form.number || !form.party || !Number(form.amount)) { toast(L(fa, 'Fill number/party/amount', 'شماره/طرف/مبلغ'), 'error'); return } post({ action: 'cheque.create', direction: form.direction, number: form.number, party: form.party, amount: Number(form.amount), dueDate: form.dueDate || undefined }, L(fa, 'Cheque registered', 'چک ثبت شد')); setForm(f => ({ ...f, number: '', party: '', amount: '', dueDate: '' })) }}>{L(fa, 'Register', 'ثبت')}</Btn>
      </Card>
      <Card className="p-4">
        <DataTable tableId="cheques" columns={[
          { key: 'number', labelEn: 'No.', labelFa: 'شماره', render: (c: Cheque) => <span className="font-mono text-xs">{c.number}</span> },
          { key: 'direction', labelEn: 'Direction', labelFa: 'نوع', type: 'enum' },
          { key: 'party', labelEn: 'Party', labelFa: 'طرف' },
          { key: 'amount', labelEn: 'Amount', labelFa: 'مبلغ', type: 'number', numeric: true, render: (c: Cheque) => <span>{c.amount.toLocaleString()}</span> },
          { key: 'dueDate', labelEn: 'Due', labelFa: 'سررسید', render: (c: Cheque) => <span className="text-xs text-text-tertiary">{c.dueDate || '—'}</span> },
          { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum', render: (c: Cheque) => <Badge color={c.status === 'cleared' ? 'green' : c.status === 'bounced' ? 'red' : c.status === 'cancelled' ? 'slate' : 'yellow'}>{c.status}</Badge> },
        ] as Column<Cheque>[]} rows={rows} locale={fa ? 'fa' : 'en'} rowKey={(c: Cheque) => String(c.id)}
          rowActions={(['presented', 'deposited', 'cleared', 'bounced', 'cancelled'] as const).map(to => ({
            id: to, labelEn: `→ ${to}`, labelFa: `→ ${to}`, icon: '▸',
            hidden: (c: Cheque) => !(NEXT[c.status] ?? []).includes(to),
            onClick: (c: Cheque) => post({ action: 'cheque.transition', id: c.id, to }, L(fa, `Moved to ${to}`, `به ${to} منتقل شد`)),
          })) as RowAction<Cheque>[]}
          exportName="cheques" emptyLabel={L(fa, 'No cheques registered.', 'چکی ثبت نشده.')} />
      </Card>
    </div>
  )
}

function PettySection({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<PettyRow[]>([])
  const [summary, setSummary] = useState<{ balance: number; floatTotal: number; spent: number; replenished: number; lowBalance: boolean } | null>(null)
  const [form, setForm] = useState({ kind: 'expense', amount: '', category: '', note: '' })
  const load = useCallback(async () => {
    const d = await fetch('/api/admin/erp/finance/banking?view=petty').then(r => r.json()).catch(() => ({}))
    setRows(d.entries ?? []); setSummary(d.summary ?? null)
  }, [])
  useEffect(() => { load() }, [load])
  async function add() {
    if (!Number(form.amount)) { toast(L(fa, 'Enter an amount', 'مبلغ را وارد کنید'), 'error'); return }
    const r = await fetch('/api/admin/erp/finance/banking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'petty.add', kind: form.kind, date: new Date().toISOString().slice(0, 10), amount: Number(form.amount), category: form.category || undefined, note: form.note || undefined }) })
    if (r.ok) { toast(L(fa, 'Entry recorded', 'ثبت شد'), 'success'); setForm(f => ({ ...f, amount: '', category: '', note: '' })); load() } else toast(L(fa, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([['Balance', 'مانده', summary.balance.toLocaleString()], ['Float', 'تنخواه اولیه', summary.floatTotal.toLocaleString()], ['Spent', 'هزینه‌شده', summary.spent.toLocaleString()], ['Replenished', 'شارژ مجدد', summary.replenished.toLocaleString()]] as const).map(([en, faL, v]) => (
            <div key={en} className={`rounded-xl p-3 bg-surface-2 border ${en === 'Balance' && summary.lowBalance ? 'border-danger/50' : 'border-subtle'}`}><p className="text-xs text-text-tertiary">{L(fa, en, faL)}</p><p className="text-lg font-bold text-text-primary">{v}</p></div>
          ))}
        </div>
      )}
      {summary?.lowBalance && <p className="text-xs text-danger-text">⚠ {L(fa, 'Petty cash is below 20% of the float — consider replenishing.', 'ماندهٔ تنخواه زیر ۲۰٪ است — شارژ مجدد کنید.')}</p>}
      <Card className="p-4 grid md:grid-cols-5 gap-3 items-end">
        <Select label={L(fa, 'Kind', 'نوع')} value={form.kind} onChange={v => setForm(f => ({ ...f, kind: v }))} options={[{ value: 'expense', label: L(fa, 'Expense', 'هزینه') }, { value: 'float', label: L(fa, 'Float (initial)', 'تنخواه اولیه') }, { value: 'replenish', label: L(fa, 'Replenish', 'شارژ مجدد') }]} />
        <Input label={L(fa, 'Amount', 'مبلغ')} value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
        <Input label={L(fa, 'Category', 'دسته')} value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} />
        <Input label={L(fa, 'Note', 'یادداشت')} value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} />
        <Btn onClick={add}>{L(fa, 'Record', 'ثبت')}</Btn>
      </Card>
      <Card className="p-4">
        <DataTable tableId="petty-cash" columns={[
          { key: 'date', labelEn: 'Date', labelFa: 'تاریخ' },
          { key: 'kind', labelEn: 'Kind', labelFa: 'نوع', type: 'enum', render: (e: PettyRow) => <Badge color={e.kind === 'expense' ? 'red' : 'green'}>{e.kind}</Badge> },
          { key: 'amount', labelEn: 'Amount', labelFa: 'مبلغ', type: 'number', numeric: true, render: (e: PettyRow) => <span>{e.amount.toLocaleString()}</span> },
          { key: 'category', labelEn: 'Category', labelFa: 'دسته', render: (e: PettyRow) => <span className="text-xs text-text-secondary">{e.category || '—'}</span> },
          { key: 'note', labelEn: 'Note', labelFa: 'یادداشت', render: (e: PettyRow) => <span className="text-xs text-text-tertiary">{e.note || '—'}</span> },
        ] as Column<PettyRow>[]} rows={rows} locale={fa ? 'fa' : 'en'} rowKey={(e: PettyRow) => String(e.id)} exportName="petty-cash" emptyLabel={L(fa, 'No entries yet.', 'ثبتی نیست.')} />
      </Card>
    </div>
  )
}

// ── AI Financial Assistant (Phase 26) — grounded on the live books ───────────
function FinanceAiCard({ fa }: { fa: boolean }) {
  const [action, setAction] = useState('summarize')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [anoms, setAnoms] = useState<{ code: string; message: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function ask() {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/admin/erp/finance/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, question: question || undefined, locale: fa ? 'fa' : 'en' }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setAnswer(d.text ?? ''); setAnoms(d.anomalies ?? []) }
      else setErr(d.error || L(fa, 'Assistant failed', 'دستیار ناموفق بود'))
    } finally { setBusy(false) }
  }
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">✨ {L(fa, 'AI Financial Assistant (grounded on live books)', 'دستیار مالی هوش مصنوعی (متصل به دفاتر زنده)')}</h3>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Select label={L(fa, 'Task', 'وظیفه')} value={action} onChange={setAction} options={[
          { value: 'summarize', label: L(fa, 'Summarize financial position', 'خلاصهٔ وضعیت مالی') },
          { value: 'analyze', label: L(fa, 'Analyze risks & anomalies', 'تحلیل ریسک و ناهنجاری') },
          { value: 'forecast', label: L(fa, 'Cash outlook', 'چشم‌انداز نقدینگی') },
          { value: 'explain', label: L(fa, 'Explain accounting concept', 'توضیح مفهوم حسابداری') },
        ]} />
        <div className="flex-1 min-w-[220px]"><Input label={L(fa, 'Question (optional)', 'سؤال (اختیاری)')} value={question} onChange={setQuestion} /></div>
        <Btn onClick={ask} disabled={busy}>{busy ? L(fa, 'Thinking…', 'در حال فکر…') : L(fa, 'Ask', 'بپرس')}</Btn>
      </div>
      {err && <p className="text-xs text-danger-text">{err}</p>}
      {anoms.length > 0 && (
        <ul className="space-y-1">
          {anoms.map((a, i) => <li key={i} className="text-3xs text-warning-text flex gap-1.5"><span>⚠</span>{a.message}</li>)}
        </ul>
      )}
      {answer && <div className="rounded-lg border border-subtle bg-surface-2 p-4 text-sm text-text-secondary whitespace-pre-line leading-relaxed">{answer}</div>}
      <p className="text-4xs text-text-tertiary">{L(fa, 'The assistant sees only a read-only snapshot of the books; every generation is audited.', 'دستیار فقط یک تصویر فقط‌خواندنی از دفاتر می‌بیند؛ هر تولید در audit ثبت می‌شود.')}</p>
    </Card>
  )
}

/** Register a company/branch with its legal identity (Phase 26.5). */
function CompanyModal({ fa, onClose, onDone }: { fa: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: '', nameEn: '', nameFa: '', regNo: '', nationalId: '', economicCode: '', taxNo: '', address: '', phone: '' })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }))
  async function save() {
    if (!f.code.trim() || !f.nameEn.trim()) { setErr(L(fa, 'Code and name are required', 'کد و نام الزامی است')); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/finance/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'company.create', code: f.code.trim(), nameEn: f.nameEn.trim(), nameFa: f.nameFa.trim() || f.nameEn.trim(),
          regNo: f.regNo.trim() || undefined, nationalId: f.nationalId.trim() || undefined,
          economicCode: f.economicCode.trim() || undefined, taxNo: f.taxNo.trim() || undefined,
          address: f.address.trim() || undefined, phone: f.phone.trim() || undefined,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) onDone(); else setErr(d.error || L(fa, 'Failed', 'ناموفق'))
    } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={L(fa, 'New company / branch', 'شرکت/شعبه جدید')} size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Input label={L(fa, 'Code', 'کد')} value={f.code} onChange={set('code')} placeholder="BR1" />
          <Input label={L(fa, 'Name (EN)', 'نام (EN)')} value={f.nameEn} onChange={set('nameEn')} />
          <Input label={L(fa, 'Name (FA)', 'نام (FA)')} value={f.nameFa} onChange={set('nameFa')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={L(fa, 'Registration no', 'شماره ثبت')} value={f.regNo} onChange={set('regNo')} />
          <Input label={L(fa, 'National ID (شناسه ملی)', 'شناسه ملی')} value={f.nationalId} onChange={set('nationalId')} />
          <Input label={L(fa, 'Economic code', 'کد اقتصادی')} value={f.economicCode} onChange={set('economicCode')} />
          <Input label={L(fa, 'Tax no', 'شماره مالیاتی')} value={f.taxNo} onChange={set('taxNo')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={L(fa, 'Address', 'نشانی')} value={f.address} onChange={set('address')} />
          <Input label={L(fa, 'Phone', 'تلفن')} value={f.phone} onChange={set('phone')} />
        </div>
        {err && <p className="text-xs text-danger-text">{err}</p>}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>{L(fa, 'Cancel', 'انصراف')}</Btn>
          <Btn onClick={save} disabled={saving}>{L(fa, 'Create', 'ساخت')}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/** Book a mirrored intercompany transfer/settlement — two posted entries (Phase 26.5). */
function IntercompanyModal({ fa, companies, onClose, onDone }: { fa: boolean; companies: CompanyRow[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ kind: 'transfer', from: '', to: '', amount: '', date: new Date().toISOString().slice(0, 10), memo: '' })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const opts = companies.map(c => ({ value: String(c.id), label: `${fa ? c.nameFa : c.nameEn} (${c.code})` }))
  async function save() {
    if (!f.from || !f.to || f.from === f.to || !(Number(f.amount) > 0)) { setErr(L(fa, 'Pick two different companies and a positive amount', 'دو شرکت متفاوت و مبلغ مثبت لازم است')); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/finance/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'intercompany.transfer', kind: f.kind, fromCompanyId: Number(f.from), toCompanyId: Number(f.to), amount: Number(f.amount), date: f.date, memo: f.memo.trim() || undefined }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) onDone(); else setErr(d.error || L(fa, 'Failed', 'ناموفق'))
    } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={L(fa, 'Intercompany transfer', 'انتقال بین‌شرکتی')}>
      <div className="space-y-3">
        <Select label={L(fa, 'Kind', 'نوع')} value={f.kind} onChange={v => setF(x => ({ ...x, kind: v }))}
          options={[{ value: 'transfer', label: L(fa, 'Transfer (lend/fund)', 'انتقال (تأمین وجه)') }, { value: 'settle', label: L(fa, 'Settlement (repay)', 'تسویه (بازپرداخت)') }]} />
        <div className="grid grid-cols-2 gap-3">
          <Select label={L(fa, 'From company', 'از شرکت')} value={f.from} onChange={v => setF(x => ({ ...x, from: v }))} options={[{ value: '', label: '—' }, ...opts]} />
          <Select label={L(fa, 'To company', 'به شرکت')} value={f.to} onChange={v => setF(x => ({ ...x, to: v }))} options={[{ value: '', label: '—' }, ...opts]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={L(fa, 'Amount', 'مبلغ')} value={f.amount} onChange={v => setF(x => ({ ...x, amount: v }))} />
          <Input label={L(fa, 'Date', 'تاریخ')} type="date" value={f.date} onChange={v => setF(x => ({ ...x, date: v }))} />
        </div>
        <Input label={L(fa, 'Memo (optional)', 'شرح (اختیاری)')} value={f.memo} onChange={v => setF(x => ({ ...x, memo: v }))} />
        <p className="text-3xs text-text-tertiary">{L(fa, 'Books two posted, balanced entries via the 1150/2150 clearing accounts — they offset in consolidation. Administrator only.', 'دو سند قطعی متوازن روی حساب‌های واسط ۱۱۵۰/۲۱۵۰ ثبت می‌شود که در تلفیق یکدیگر را خنثی می‌کنند. فقط مدیر.')}</p>
        {err && <p className="text-xs text-danger-text">{err}</p>}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>{L(fa, 'Cancel', 'انصراف')}</Btn>
          <Btn onClick={save} disabled={saving}>{L(fa, 'Book entries', 'ثبت اسناد')}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/** Currency revaluation (Phase 26.8): FX exposure + book the unrealized gain/loss. */
function RevaluationSection({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  interface Pos { key: string; label: string; kind: string; currency: string; amountForeign: number; bookedRate: number; currentRate: number; bookedValue: number; currentValue: number; gainLoss: number }
  interface Prev { positions: Pos[]; exposure: { currency: string; amountForeign: number; currentValue: number; gainLoss: number; positions: number }[]; totalGain: number; totalLoss: number; net: number; alreadyBooked: number; deltaToBook: number; history: { entryNo: string; date: string; gain: number; loss: number }[] }
  const [d, setD] = useState<Prev | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/erp/finance/revaluation').then(x => x.ok ? x.json() : null).catch(() => null)
    if (r) setD(r)
  }, [])
  useEffect(() => { load() }, [load])
  async function book() {
    if (!confirm(L(fa, 'Book the revaluation delta as a posted journal entry?', 'اختلاف تسعیر به‌صورت سند قطعی ثبت شود؟'))) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/erp/finance/revaluation', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { toast(L(fa, `Booked ${j.entryNo}`, `سند ${j.entryNo} ثبت شد`), 'success'); load() }
      else toast(j.error || L(fa, 'Failed', 'ناموفق'), 'error')
    } finally { setBusy(false) }
  }
  if (!d) return null
  const kindFa: Record<string, string> = { asset: 'دارایی', receivable: 'دریافتنی', payable: 'پرداختنی' }
  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-text-primary">{L(fa, 'Currency revaluation — unrealized FX gain/loss', 'تسعیر ارز — سود/زیان شناسایی‌نشده')}</h4>
        <Btn size="sm" onClick={book} disabled={busy || d.deltaToBook === 0}>{L(fa, 'Book revaluation entry', 'ثبت سند تسعیر')}</Btn>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          [L(fa, 'Unrealized gain', 'سود شناسایی‌نشده'), d.totalGain, d.totalGain > 0],
          [L(fa, 'Unrealized loss', 'زیان شناسایی‌نشده'), d.totalLoss, false],
          [L(fa, 'Already booked', 'ثبت‌شده قبلی'), d.alreadyBooked, true],
          [L(fa, 'Delta to book', 'قابل ثبت'), d.deltaToBook, d.deltaToBook >= 0],
        ] as const).map(([label, v, ok]) => (
          <div key={label} className={`rounded-xl p-3 bg-surface-2 border ${ok ? 'border-success/40' : 'border-danger/40'}`}>
            <p className="text-xs text-text-tertiary">{label}</p><p className="text-lg font-bold text-text-primary">{Number(v).toLocaleString()}</p>
          </div>
        ))}
      </div>
      {d.positions.length === 0 ? (
        <p className="text-xs text-text-tertiary">{L(fa, 'No open foreign-currency positions (assets, receivables, payables in USD/EUR/AED).', 'موقعیت ارزی بازی وجود ندارد (دارایی/دریافتنی/پرداختنی دلاری، یورویی یا درهمی).')}</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {d.positions.map(p => (
            <div key={p.key} className="grid grid-cols-12 items-center gap-2 text-xs border border-subtle rounded-lg px-2 py-1.5">
              <span className="col-span-3 text-text-primary truncate">{p.label}</span>
              <span className="col-span-2"><Badge color={p.kind === 'payable' ? 'yellow' : 'blue'}>{fa ? (kindFa[p.kind] || p.kind) : p.kind}</Badge></span>
              <span className="col-span-2 font-mono text-text-secondary">{p.amountForeign.toLocaleString()} {p.currency}</span>
              <span className="col-span-2 text-text-tertiary">{p.bookedRate.toLocaleString()} → {p.currentRate.toLocaleString()}</span>
              <span className={`col-span-3 text-end font-semibold ${p.gainLoss >= 0 ? 'text-success-text' : 'text-danger-text'}`}>{p.gainLoss.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {d.history.length > 0 && (
        <div className="text-3xs text-text-tertiary">
          {L(fa, 'Booked entries:', 'اسناد ثبت‌شده:')} {d.history.map(h => `${h.entryNo} (${(h.gain - h.loss).toLocaleString()})`).join(' · ')}
        </div>
      )}
      <p className="text-3xs text-text-tertiary">{L(fa, 'Original documents keep their currency and rate — the delta vs already-booked revaluations posts to 1190/4900/6980. Administrator only.', 'اسناد اصلی با ارز و نرخ خود دست‌نخورده می‌مانند — فقط اختلاف نسبت به تسعیرهای قبلی روی حساب‌های ۱۱۹۰/۴۹۰۰/۶۹۸۰ ثبت می‌شود. فقط مدیر.')}</p>
    </Card>
  )
}

// ── Accounting Core (Phase 26.9): periods · opening balance · year-end · statement ──
interface CoaFlat { id: number; code: string; nameEn: string; nameFa: string | null; type: string }
function AccountingView({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [sec, setSec] = useState<'periods' | 'opening' | 'closing' | 'statement' | 'validation'>('periods')
  const [accounts, setAccounts] = useState<CoaFlat[]>([])
  useEffect(() => { fetch('/api/admin/erp/finance/periods?view=accounts').then(r => r.json()).then(d => setAccounts(d.flat ?? [])).catch(() => {}) }, [])
  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit rounded-lg bg-white/5 p-1 flex-wrap">
        {([['periods', 'Fiscal periods', 'دوره‌های مالی'], ['opening', 'Opening balance', 'تراز افتتاحیه'], ['closing', 'Year-end closing', 'بستن سال مالی'], ['statement', 'Account statement', 'کاردکس حساب'], ['validation', 'Ledger validation', 'اعتبارسنجی دفتر']] as const).map(([id, en, faL]) => (
          <button key={id} onClick={() => setSec(id)} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${sec === id ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>{L(fa, en, faL)}</button>
        ))}
      </div>
      {sec === 'periods' && <PeriodsSection fa={fa} toast={toast} />}
      {sec === 'opening' && <OpeningSection fa={fa} toast={toast} accounts={accounts} />}
      {sec === 'closing' && <ClosingSection fa={fa} toast={toast} />}
      {sec === 'statement' && <StatementSection fa={fa} accounts={accounts} />}
      {sec === 'validation' && <ValidationSection fa={fa} />}
    </div>
  )
}

// ── Accounting Validation Engine (Phase 26.15.1) ─────────────────────────────
// Read-only auditor scan of the GL: unbalanced / one-sided / missing-account /
// zero-total entries + an integrity score. Never mutates.
interface ValIssue { code: string; severity: string; message: string; lineNo?: number }
interface ValEntry { entryId: number; entryNo: string | null; totalDebit: number; totalCredit: number; difference: number; issues: ValIssue[] }
interface ValSummary { entriesChecked: number; clean: number; withIssues: number; criticalCount: number; warningCount: number; byCode: Record<string, number>; score: number; entries: ValEntry[] }
function ValidationSection({ fa }: { fa: boolean }) {
  const [sum, setSum] = useState<ValSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'posted' | 'all'>('posted')
  const run = useCallback(async () => {
    setLoading(true)
    try { const d = await fetch(`/api/admin/erp/finance/validate?status=${status}`).then(r => r.json()); setSum(d.summary ?? null) } finally { setLoading(false) }
  }, [status])
  useEffect(() => { run() }, [run])
  const scoreColor = !sum ? 'text-text-tertiary' : sum.score >= 95 ? 'text-success' : sum.score >= 80 ? 'text-warning' : 'text-danger'
  const cell = (label: string, value: string, cls = 'text-text-primary') => (
    <div className="rounded-lg border border-subtle p-3"><p className="text-2xs text-text-tertiary mb-1">{label}</p><p className={`text-lg font-bold ${cls}`}>{value}</p></div>
  )
  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Accounting Validation Engine', 'موتور اعتبارسنجی حسابداری')}</h3>
        <div className="flex items-center gap-2">
          <select value={status} onChange={e => setStatus(e.target.value as 'posted' | 'all')} className="form-input !py-1.5 text-xs">
            <option value="posted">{L(fa, 'Posted entries', 'اسناد قطعی')}</option>
            <option value="all">{L(fa, 'All entries', 'همه اسناد')}</option>
          </select>
          <Btn size="sm" onClick={run} disabled={loading}>{loading ? L(fa, 'Scanning…', 'در حال بررسی…') : L(fa, 'Re-scan', 'بررسی مجدد')}</Btn>
        </div>
      </div>
      {sum && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {cell(L(fa, 'Integrity score', 'امتیاز صحت'), `${sum.score}`, scoreColor)}
            {cell(L(fa, 'Entries checked', 'اسناد بررسی‌شده'), `${sum.entriesChecked}`)}
            {cell(L(fa, 'Clean', 'سالم'), `${sum.clean}`, 'text-success')}
            {cell(L(fa, 'Critical', 'بحرانی'), `${sum.criticalCount}`, sum.criticalCount ? 'text-danger' : 'text-text-tertiary')}
            {cell(L(fa, 'Warnings', 'هشدار'), `${sum.warningCount}`, sum.warningCount ? 'text-warning' : 'text-text-tertiary')}
          </div>
          {sum.withIssues === 0
            ? <p className="text-xs text-text-tertiary">{L(fa, '✓ Every posted entry is balanced and well-formed.', '✓ همهٔ اسناد قطعی متوازن و درست‌اند.')}</p>
            : <DataTable tableId="ledger-validation" columns={[
                { key: 'entryNo', labelEn: 'Entry', labelFa: 'سند', render: (r: ValEntry) => <span className="font-mono text-xs">{r.entryNo ?? r.entryId}</span> },
                { key: 'difference', labelEn: 'Δ (Dr−Cr)', labelFa: 'اختلاف', numeric: true, render: (r: ValEntry) => <span className={r.difference !== 0 ? 'text-danger' : 'text-text-tertiary'}>{r.difference.toLocaleString()}</span> },
                { key: 'issues', labelEn: 'Issues', labelFa: 'ایرادها', render: (r: ValEntry) => <div className="flex flex-wrap gap-1">{r.issues.map((i, k) => <Badge key={k} color={i.severity === 'critical' ? 'danger' : 'warning'}>{i.code}{i.lineNo != null ? ` #${i.lineNo}` : ''}</Badge>)}</div> },
              ]} rows={sum.entries} locale={fa ? 'fa' : 'en'} rowKey={(r: ValEntry) => String(r.entryId)} exportName="ledger-validation"
              emptyLabel={L(fa, 'No issues.', 'ایرادی نیست.')} />}
        </>
      )}
    </Card>
  )
}

interface Period { id: number; name: string; startDate: string; endDate: string; status: string; kind: string; parentId: number | null }
function PeriodsSection({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<Period[]>([])
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', kind: 'period', parentId: '' })
  const load = useCallback(async () => { const d = await fetch('/api/admin/erp/finance/periods').then(r => r.json()); setRows(d.periods ?? []) }, [])
  useEffect(() => { load() }, [load])
  async function post(bodyObj: Record<string, unknown>, ok: string) {
    const r = await fetch('/api/admin/erp/finance/periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(ok, 'success'); load() } else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
  }
  async function create() {
    if (!form.name || !form.startDate || !form.endDate) { toast(L(fa, 'Fill name and dates', 'نام و تاریخ‌ها را وارد کنید'), 'error'); return }
    await post({ action: 'period.create', name: form.name, startDate: form.startDate, endDate: form.endDate, kind: form.kind, parentId: form.parentId ? Number(form.parentId) : undefined }, L(fa, 'Period created', 'دوره ساخته شد'))
    setForm({ name: '', startDate: '', endDate: '', kind: 'period', parentId: '' })
  }
  const years = rows.filter(r => r.kind === 'year')
  const NEXT: Record<string, { to: string; en: string; fa: string }[]> = {
    open: [{ to: 'closed', en: 'Close', fa: 'بستن' }],
    closed: [{ to: 'open', en: 'Reopen', fa: 'بازگشایی' }, { to: 'locked', en: 'Lock', fa: 'قفل' }],
    locked: [],
  }
  return (
    <div className="space-y-4">
      <Card className="p-4 grid md:grid-cols-6 gap-3 items-end">
        <Input label={L(fa, 'Name', 'نام')} value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="FY1404" />
        <Select label={L(fa, 'Kind', 'نوع')} value={form.kind} onChange={v => setForm(f => ({ ...f, kind: v }))} options={[{ value: 'year', label: L(fa, 'Fiscal year', 'سال مالی') }, { value: 'period', label: L(fa, 'Period', 'دوره') }]} />
        <Input label={L(fa, 'Start', 'شروع')} type="date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} />
        <Input label={L(fa, 'End', 'پایان')} type="date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} />
        <Select label={L(fa, 'Parent year', 'سال والد')} value={form.parentId} onChange={v => setForm(f => ({ ...f, parentId: v }))} options={[{ value: '', label: '—' }, ...years.map(y => ({ value: String(y.id), label: y.name }))]} />
        <Btn size="sm" onClick={create}>{L(fa, 'Add period', 'افزودن')}</Btn>
      </Card>
      <Card className="p-4 space-y-2">
        {rows.length === 0 && <p className="text-xs text-text-tertiary">{L(fa, 'No fiscal periods yet.', 'هنوز دوره‌ای نیست.')}</p>}
        {rows.map(p => (
          <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 border border-subtle rounded-lg px-3 py-2 ${p.kind === 'year' ? 'bg-surface-2' : 'ms-4'}`}>
            <div className="flex items-center gap-2">
              <Badge color={p.kind === 'year' ? 'indigo' : 'slate'}>{p.kind === 'year' ? L(fa, 'Year', 'سال') : L(fa, 'Period', 'دوره')}</Badge>
              <span className="text-sm font-medium text-text-primary">{p.name}</span>
              <span className="text-3xs text-text-tertiary font-mono">{p.startDate} → {p.endDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={p.status === 'open' ? 'green' : p.status === 'closed' ? 'yellow' : 'red'}>{p.status === 'open' ? L(fa, 'Open', 'باز') : p.status === 'closed' ? L(fa, 'Closed', 'بسته') : L(fa, 'Locked', 'قفل‌شده')}</Badge>
              {(NEXT[p.status] || []).map(n => (
                <Btn key={n.to} size="sm" variant="ghost" onClick={() => post({ action: 'period.transition', id: p.id, to: n.to }, L(fa, 'Updated', 'به‌روزرسانی شد'))}>{L(fa, n.en, n.fa)}</Btn>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <p className="text-3xs text-text-tertiary">{L(fa, 'Posting a journal into a closed or locked period is rejected. Locked is permanent.', 'ثبت سند در دوره بسته یا قفل‌شده رد می‌شود. قفل دائمی است.')}</p>
    </div>
  )
}

function OpeningSection({ fa, toast, accounts }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void; accounts: CoaFlat[] }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<{ accountId: string; amount: string }[]>([{ accountId: '', amount: '' }, { accountId: '', amount: '' }])
  const [saving, setSaving] = useState(false)
  async function submit() {
    const entries = lines.filter(l => l.accountId && Number(l.amount)).map(l => ({ accountId: Number(l.accountId), amount: Number(l.amount) }))
    if (entries.length < 2) { toast(L(fa, 'Add at least two accounts', 'حداقل دو حساب'), 'error'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/finance/periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'opening.post', date, entries }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { toast(L(fa, 'Opening balance posted', 'تراز افتتاحیه ثبت شد'), 'success'); setLines([{ accountId: '', amount: '' }, { accountId: '', amount: '' }]) }
      else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
    } finally { setSaving(false) }
  }
  const opts = [{ value: '', label: '—' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.code} · ${fa ? (a.nameFa || a.nameEn) : a.nameEn}` }))]
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-end gap-3">
        <Input label={L(fa, 'Opening date', 'تاریخ افتتاح')} type="date" value={date} onChange={setDate} />
        <p className="text-3xs text-text-tertiary">{L(fa, 'Enter each account balance on its normal side; assets/expenses are debits, the rest credits. Must balance.', 'مانده هر حساب را در جهت طبیعی وارد کنید؛ دارایی/هزینه بدهکار، بقیه بستانکار. باید تراز شود.')}</p>
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-7"><Select label={i === 0 ? L(fa, 'Account', 'حساب') : ''} value={l.accountId} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, accountId: v } : x))} options={opts} /></div>
            <div className="col-span-4"><Input label={i === 0 ? L(fa, 'Amount', 'مبلغ') : ''} value={l.amount} onChange={v => setLines(ls => ls.map((x, j) => j === i ? { ...x, amount: v } : x))} /></div>
            <div className="col-span-1"><Btn size="sm" variant="ghost" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>✕</Btn></div>
          </div>
        ))}
        <Btn size="sm" variant="secondary" onClick={() => setLines(ls => [...ls, { accountId: '', amount: '' }])}>+ {L(fa, 'Add account', 'افزودن حساب')}</Btn>
      </div>
      <div className="flex justify-end"><Btn onClick={submit} disabled={saving}>{L(fa, 'Post opening balance', 'ثبت تراز افتتاحیه')}</Btn></div>
    </Card>
  )
}

function ClosingSection({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [years, setYears] = useState<Period[]>([])
  const [sel, setSel] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { fetch('/api/admin/erp/finance/periods').then(r => r.json()).then(d => setYears((d.periods ?? []).filter((p: Period) => p.kind === 'year'))).catch(() => {}) }, [])
  async function run() {
    if (!sel) { toast(L(fa, 'Pick a fiscal year', 'سال مالی را انتخاب کنید'), 'error'); return }
    if (!confirm(L(fa, 'Post the year-end closing entry (revenue/expense → retained earnings)?', 'سند اختتامیه ثبت شود (درآمد/هزینه ← سود انباشته)؟'))) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/erp/finance/periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'closing.run', fiscalPeriodId: Number(sel) }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) toast(L(fa, `Closed — net income ${Number(d.netIncome).toLocaleString()}`, `بسته شد — سود خالص ${Number(d.netIncome).toLocaleString()}`), 'success')
      else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
    } finally { setBusy(false) }
  }
  return (
    <Card className="p-4 space-y-3">
      <h4 className="text-xs font-semibold text-text-primary">{L(fa, 'Year-end closing', 'بستن سال مالی')}</h4>
      <div className="flex items-end gap-3">
        <Select label={L(fa, 'Fiscal year', 'سال مالی')} value={sel} onChange={setSel} options={[{ value: '', label: '—' }, ...years.map(y => ({ value: String(y.id), label: `${y.name} (${y.startDate} → ${y.endDate})` }))]} />
        <Btn onClick={run} disabled={busy}>{L(fa, 'Run closing', 'اجرای اختتامیه')}</Btn>
      </div>
      <p className="text-3xs text-text-tertiary">{L(fa, 'Zeroes revenue & expense accounts for the year and transfers the profit/loss to Retained Earnings (3900). Runs once per year.', 'حساب‌های درآمد و هزینه سال را صفر کرده و سود/زیان را به سود انباشته (۳۹۰۰) منتقل می‌کند. هر سال یک‌بار.')}</p>
    </Card>
  )
}

function StatementSection({ fa, accounts }: { fa: boolean; accounts: CoaFlat[] }) {
  interface StLine { entryNo: string; date: string; memo: string | null; reference: string | null; debit: number; credit: number; balance: number }
  const [accountId, setAccountId] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [d, setD] = useState<{ account: { code: string; nameEn: string }; lines: StLine[]; totals: { debit: number; credit: number; balance: number } } | null>(null)
  const load = useCallback(async () => {
    if (!accountId) { setD(null); return }
    const q = new URLSearchParams({ account: accountId })
    if (range.from) q.set('from', range.from)
    if (range.to) q.set('to', range.to)
    const r = await fetch(`/api/admin/erp/finance/statement?${q}`).then(x => x.ok ? x.json() : null).catch(() => null)
    setD(r)
  }, [accountId, range])
  useEffect(() => { load() }, [load])
  const opts = [{ value: '', label: L(fa, 'Select account…', 'انتخاب حساب…') }, ...accounts.map(a => ({ value: String(a.id), label: `${a.code} · ${fa ? (a.nameFa || a.nameEn) : a.nameEn}` }))]
  return (
    <div className="space-y-3">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <Select label={L(fa, 'Account', 'حساب')} value={accountId} onChange={setAccountId} options={opts} />
        <Input label={L(fa, 'From', 'از')} type="date" value={range.from} onChange={v => setRange(r => ({ ...r, from: v }))} />
        <Input label={L(fa, 'To', 'تا')} type="date" value={range.to} onChange={v => setRange(r => ({ ...r, to: v }))} />
      </Card>
      {d && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-text-primary">{d.account.code} · {d.account.nameEn}</h4>
            <span className={`text-sm font-bold ${d.totals.balance >= 0 ? 'text-text-primary' : 'text-danger-text'}`}>{L(fa, 'Balance', 'مانده')}: {d.totals.balance.toLocaleString()}</span>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            <div className="grid grid-cols-12 gap-2 text-3xs text-text-tertiary px-2">
              <span className="col-span-2">{L(fa, 'Date', 'تاریخ')}</span><span className="col-span-3">{L(fa, 'Entry', 'سند')}</span><span className="col-span-3">{L(fa, 'Memo', 'شرح')}</span>
              <span className="col-span-1 text-end">{L(fa, 'Debit', 'بدهکار')}</span><span className="col-span-1 text-end">{L(fa, 'Credit', 'بستانکار')}</span><span className="col-span-2 text-end">{L(fa, 'Balance', 'مانده')}</span>
            </div>
            {d.lines.length === 0 && <p className="text-xs text-text-tertiary p-2">{L(fa, 'No postings.', 'گردشی نیست.')}</p>}
            {d.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center text-xs border border-subtle rounded-lg px-2 py-1.5">
                <span className="col-span-2 font-mono text-text-tertiary">{l.date}</span>
                <span className="col-span-3 font-mono text-text-secondary">{l.entryNo}</span>
                <span className="col-span-3 text-text-secondary truncate">{l.memo || l.reference || '—'}</span>
                <span className="col-span-1 text-end text-text-secondary">{l.debit ? l.debit.toLocaleString() : '—'}</span>
                <span className="col-span-1 text-end text-text-secondary">{l.credit ? l.credit.toLocaleString() : '—'}</span>
                <span className="col-span-2 text-end font-semibold text-text-primary">{l.balance.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/** Tax profiles (Phase 26.9): reusable VAT/withholding/exemption setups over the tax engine. */
interface TaxProfileRow { id: number; code: string; nameEn: string; nameFa: string; category: string; vatRate: number; withholdingRate: number; exempt: boolean; active: boolean }
function TaxProfilesSection({ fa, toast }: { fa: boolean; toast: (m: string, k?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<TaxProfileRow[]>([])
  const [form, setForm] = useState({ code: '', nameEn: '', nameFa: '', category: 'standard', vatRate: '9', withholdingRate: '0', exempt: false })
  const load = useCallback(async () => { const d = await fetch('/api/admin/erp/finance/tax').then(r => r.json()); setRows(d.profiles ?? []) }, [])
  useEffect(() => { load() }, [load])
  async function save() {
    if (!form.code || !form.nameEn) { toast(L(fa, 'Code and name required', 'کد و نام لازم است'), 'error'); return }
    const r = await fetch('/api/admin/erp/finance/tax', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', code: form.code, nameEn: form.nameEn, nameFa: form.nameFa || form.nameEn, category: form.category, vatRate: Number(form.vatRate) || 0, withholdingRate: Number(form.withholdingRate) || 0, exempt: form.exempt }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L(fa, 'Tax profile saved', 'پروفایل مالیاتی ذخیره شد'), 'success'); setForm({ code: '', nameEn: '', nameFa: '', category: 'standard', vatRate: '9', withholdingRate: '0', exempt: false }); load() }
    else toast(d.error || L(fa, 'Failed', 'ناموفق'), 'error')
  }
  async function del(id: number) {
    if (!confirm(L(fa, 'Delete this tax profile?', 'این پروفایل حذف شود؟'))) return
    const r = await fetch('/api/admin/erp/finance/tax', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
    if (r.ok) { toast(L(fa, 'Deleted', 'حذف شد'), 'success'); load() }
  }
  const catLabel: Record<string, [string, string]> = { standard: ['Standard', 'استاندارد'], zero_rated: ['Zero-rated', 'نرخ صفر'], exempt: ['Exempt', 'معاف'], export: ['Export', 'صادرات'], service: ['Service', 'خدمات'] }
  return (
    <Card className="p-4 space-y-3">
      <h4 className="text-xs font-semibold text-text-primary">{L(fa, 'Tax profiles (VAT · withholding · exemption)', 'پروفایل‌های مالیاتی (ارزش‌افزوده · تکلیفی · معافیت)')}</h4>
      <div className="grid md:grid-cols-7 gap-2 items-end">
        <Input label={L(fa, 'Code', 'کد')} value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} />
        <Input label={L(fa, 'Name', 'نام')} value={form.nameEn} onChange={v => setForm(f => ({ ...f, nameEn: v }))} />
        <Select label={L(fa, 'Category', 'دسته')} value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={Object.entries(catLabel).map(([k, l]) => ({ value: k, label: L(fa, l[0], l[1]) }))} />
        <Input label={L(fa, 'VAT %', 'ارزش‌افزوده ٪')} value={form.vatRate} onChange={v => setForm(f => ({ ...f, vatRate: v }))} />
        <Input label={L(fa, 'WHT %', 'تکلیفی ٪')} value={form.withholdingRate} onChange={v => setForm(f => ({ ...f, withholdingRate: v }))} />
        <label className="flex items-center gap-1.5 text-xs text-text-secondary"><input type="checkbox" checked={form.exempt} onChange={e => setForm(f => ({ ...f, exempt: e.target.checked }))} /> {L(fa, 'Exempt', 'معاف')}</label>
        <Btn size="sm" onClick={save}>{L(fa, 'Add', 'افزودن')}</Btn>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map(p => (
          <div key={p.id} className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3 py-1.5 text-sm">
            <span className="font-mono text-3xs text-text-tertiary">{p.code}</span>
            <span className="text-text-secondary">{fa ? p.nameFa : p.nameEn}</span>
            <Badge color={p.exempt ? 'slate' : 'blue'}>{L(fa, ...(catLabel[p.category] ?? ['', '']) as [string, string])}</Badge>
            <span className="text-3xs text-text-tertiary">VAT {p.vatRate}%{p.withholdingRate > 0 ? ` · WHT ${p.withholdingRate}%` : ''}</span>
            <button onClick={() => del(p.id)} className="text-danger text-xs">✕</button>
          </div>
        ))}
      </div>
    </Card>
  )
}
