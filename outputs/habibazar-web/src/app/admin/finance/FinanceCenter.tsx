'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'

type Tab = 'dashboard' | 'accounts' | 'journal' | 'reports'
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
function money(n: number | undefined): string { const v = n ?? 0; return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

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
        {(['dashboard', 'accounts', 'journal', 'reports'] as Tab[]).map(tb => (
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

  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { setEditing({ type: 'asset', active: 1 }); setModal(true) }}>{t('fin_newAccount')}</Btn></div>
      <Card className="p-0 overflow-hidden">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('fin_loading')}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-text-tertiary text-left border-b border-subtle">{[t('fin_cCode'), t('fin_cName'), t('fin_cType'), t('fin_cBalance'), t('fin_cActions')].map(h => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}</tr></thead>
            <tbody>{accounts.map(a => {
              const net = (a.debit ?? 0) - (a.credit ?? 0)
              const bal = (a.type === 'asset' || a.type === 'expense') ? net : -net
              return (
                <tr key={a.id} className="border-b border-subtle/50">
                  <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{a.code}</td>
                  <td className="px-4 py-2.5 text-text-primary">{fa ? (a.nameFa || a.nameEn) : a.nameEn}</td>
                  <td className="px-4 py-2.5"><Badge color={TYPE_COLOR[a.type]}>{t(`fin_at_${a.type}` as 'fin_at_asset')}</Badge></td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">{money(bal)}</td>
                  <td className="px-4 py-2.5"><Btn size="sm" variant="secondary" onClick={() => { setEditing(a); setModal(true) }}>{t('fin_edit')}</Btn></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
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
  return (
    <>
      <div className="flex justify-end mb-4"><Btn onClick={() => { reset(); setModal(true) }}>{t('fin_newEntry')}</Btn></div>
      <Card className="p-0 overflow-hidden">
        {loading ? <p className="text-sm text-text-tertiary p-5">{t('fin_loading')}</p>
          : entries.length === 0 ? <p className="text-sm text-text-tertiary p-5">{t('fin_noEntries')}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-text-tertiary text-left border-b border-subtle">{[t('fin_cNo'), t('fin_cDate'), t('fin_cMemo'), t('fin_cStatus'), t('fin_cTotal'), t('fin_cActions')].map(h => <th key={h} className="px-4 py-2 text-xs font-medium">{h}</th>)}</tr></thead>
            <tbody>{entries.map(e => (
              <tr key={e.id} className="border-b border-subtle/50">
                <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{e.entryNo}</td>
                <td className="px-4 py-2.5 text-text-tertiary text-xs">{e.date}</td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{e.memo || '—'}</td>
                <td className="px-4 py-2.5"><Badge color={e.status === 'posted' ? 'green' : e.status === 'void' ? 'slate' : 'yellow'}>{t(`fin_st_${e.status}` as 'fin_st_posted')}</Badge></td>
                <td className="px-4 py-2.5 text-text-secondary text-xs">{money(e.total)}</td>
                <td className="px-4 py-2.5"><div className="flex gap-2">
                  {e.status === 'draft' && <Btn size="sm" onClick={() => op(e.id, 'post')}>{t('fin_post')}</Btn>}
                  {e.status === 'posted' && <Btn size="sm" variant="secondary" onClick={() => op(e.id, 'void')}>{t('fin_void')}</Btn>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
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
