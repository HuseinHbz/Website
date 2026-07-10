'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type Tab = 'dashboard' | 'accounts' | 'journal' | 'reports' | 'currency' | 'banking'
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
  return (
    <>
      <ToastContainer />
      <PageHeader title={t('fin_title')} subtitle={t('fin_subtitle')} />
      <div className="flex gap-1 mb-6 border-b border-subtle overflow-x-auto">
        {(['dashboard', 'accounts', 'journal', 'reports', 'currency', 'banking'] as Tab[]).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === tb ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {t(`fin_tab_${tb}` as 'fin_tab_dashboard')}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <Dashboard t={t} />}
      {tab === 'accounts' && <Accounts t={t} fa={fa} toast={toast} />}
      {tab === 'journal' && <Journal t={t} fa={fa} toast={toast} />}
      {tab === 'reports' && <ReportsView t={t} fa={fa} />}
      {tab === 'currency' && <CurrencyView fa={fa} toast={toast} />}
      {tab === 'banking' && <BankingView fa={fa} toast={toast} />}
    </>
  )
}
type T = ReturnType<typeof useT>
type Toast = ReturnType<typeof useToast>['toast']

function Dashboard({ t }: { t: T }) {
  const [d, setD] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/finance/overview'); if (r.ok) setD(await r.json()) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  if (loading && !d) return <p className="text-sm text-text-tertiary">{t('fin_loading')}</p>
  if (!d) return <Card className="p-5"><p className="text-sm text-text-tertiary">{t('fin_empty')}</p></Card>
  const k = d.kpis
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t('fin_kAssets')} value={money(k.totalAssets)} icon="🏦" />
        <Kpi label={t('fin_kLiabilities')} value={money(k.totalLiabilities)} icon="📕" />
        <Kpi label={t('fin_kEquity')} value={money(k.totalEquity)} icon="📗" tone="ok" />
        <Kpi label={t('fin_kCash')} value={money(k.cash)} icon="💵" />
        <Kpi label={t('fin_kRevenue')} value={money(k.revenue)} icon="📈" tone="ok" />
        <Kpi label={t('fin_kExpenses')} value={money(k.expenses)} icon="📉" />
        <Kpi label={t('fin_kNetIncome')} value={money(k.netIncome)} icon="💰" tone={k.netIncome >= 0 ? 'ok' : 'bad'} />
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
function Journal({ t, fa, toast }: { t: T; fa: boolean; toast: Toast }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<Line[]>([{ accountId: 0, debit: 0, credit: 0 }, { accountId: 0, debit: 0, credit: 0 }])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [e, a] = await Promise.all([fetch('/api/admin/erp/finance/journal').then(r => r.json()), fetch('/api/admin/erp/finance/accounts').then(r => r.json())])
      setEntries(e.entries ?? []); setAccounts((a.accounts ?? []).filter((x: Account) => x.active !== 0))
    } catch { toast(t('fin_loadFail'), 'error') } finally { setLoading(false) }
  }, [toast, t])
  useEffect(() => { load() }, [load])

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), [lines])
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0), [lines])
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0

  function setLine(i: number, patch: Partial<Line>) { setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l)) }
  function reset() { setDate(new Date().toISOString().slice(0, 10)); setMemo(''); setLines([{ accountId: 0, debit: 0, credit: 0 }, { accountId: 0, debit: 0, credit: 0 }]) }

  async function submit(post: boolean) {
    const clean = lines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0))
    if (clean.length < 2 || !balanced) { toast(t('fin_mustBalance'), 'error'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/erp/finance/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, memo, post, lines: clean }) })
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'failed')
      toast(post ? t('fin_posted') : t('fin_savedDraft'), 'success'); setModal(false); reset(); load()
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
    { id: 'void', labelEn: 'Void', labelFa: t('fin_void'), icon: '✕', danger: true, hidden: e => e.status !== 'posted', onClick: e => op(e.id, 'void') },
  ]
  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { reset(); setModal(true) }}>{t('fin_newEntry')}</Btn></div>
      <Card className="p-4">
        <DataTable tableId="finance-journal" columns={journalColumns} rows={entries} locale={fa ? 'fa' : 'en'} loading={loading} rowKey={e => String(e.id)} rowActions={journalActions} exportName="journal-entries" emptyLabel={t('fin_noEntries')} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={t('fin_newEntry')} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('fin_fDate')} type="date" value={date} onChange={setDate} />
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
          <div className="flex gap-3">
            <Btn onClick={() => submit(true)} disabled={saving || !balanced}>{t('fin_postEntry')}</Btn>
            <Btn variant="secondary" onClick={() => submit(false)} disabled={saving || !balanced}>{t('fin_saveDraft')}</Btn>
            <Btn variant="ghost" onClick={() => setModal(false)}>{t('fin_cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Reports ──────────────────────────────────────────────────────────────────
function ReportsView({ t, fa }: { t: T; fa: boolean }) {
  const [d, setD] = useState<Reports | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'trial' | 'income' | 'balance'>('trial')
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/admin/erp/finance/reports'); if (r.ok) setD(await r.json()) } finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  if (loading && !d) return <p className="text-sm text-text-tertiary">{t('fin_loading')}</p>
  if (!d) return <Card className="p-5"><p className="text-sm text-text-tertiary">{t('fin_empty')}</p></Card>
  const name = (l: { nameEn: string; nameFa?: string | null }) => fa ? (l.nameFa || l.nameEn) : l.nameEn
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['trial', 'income', 'balance'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === v ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary border border-border'}`}>{t(`fin_rep_${v}` as 'fin_rep_trial')}</button>
        ))}
      </div>
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
  const [conv, setConv] = useState({ amount: '1', from: 'USD', to: 'IRT', result: '' })
  const load = useCallback(async () => {
    setLoading(true)
    try { const d = await fetch('/api/admin/erp/finance/currency').then(r => r.json()); setRows(d.currencies ?? []) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

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
  const [sec, setSec] = useState<'recon' | 'cheques' | 'petty'>('recon')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit rounded-lg bg-white/5 p-1">
        {([['recon', 'Reconciliation', 'مغایرت‌گیری بانکی'], ['cheques', 'Cheques', 'چک‌ها'], ['petty', 'Petty cash', 'تنخواه']] as const).map(([id, en, faL]) => (
          <button key={id} onClick={() => setSec(id)} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${sec === id ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}>{L(fa, en, faL)}</button>
        ))}
      </div>
      {sec === 'recon' && <ReconSection fa={fa} toast={toast} />}
      {sec === 'cheques' && <ChequeSection fa={fa} toast={toast} />}
      {sec === 'petty' && <PettySection fa={fa} toast={toast} />}
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
