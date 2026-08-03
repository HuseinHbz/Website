'use client'

/**
 * Treasury Center (Phase 26.14) — the enterprise treasury workspace: overview,
 * banks, statement import, reconciliation, payments, receipts, cheques, cash
 * forecast, FX risk and the AI treasury assistant. Reuses the display-currency
 * engine (amounts reprice live), the approval platform (payment approval) and the
 * shared AI engine. RTL/EN.
 */
import { useCallback, useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/admin/datetime'
import { Card, Btn, Input, Select, Badge, PageHeader, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'

const L = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)
type Tab = 'overview' | 'banks' | 'statements' | 'reconcile' | 'payments' | 'receipts' | 'cheques' | 'cash' | 'risk' | 'ai'
type Toast = ReturnType<typeof useToast>['toast']

export function TreasuryCenter() {
  const rtl = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab') as Tab | null; if (t) setTab(t) }, [])
  const TABS: [Tab, string, string][] = [
    ['overview', 'Overview', 'نمای کلی'], ['banks', 'Banks', 'بانک‌ها'], ['statements', 'Statements', 'صورت‌حساب'],
    ['reconcile', 'Reconciliation', 'مغایرت‌گیری'], ['payments', 'Payments', 'پرداخت‌ها'], ['receipts', 'Receipts', 'دریافت‌ها'],
    ['cheques', 'Cheques', 'چک‌ها'], ['cash', 'Cash Forecast', 'پیش‌بینی نقدینگی'], ['risk', 'Risk Analysis', 'تحلیل ریسک'], ['ai', 'AI Assistant', 'دستیار هوشمند'],
  ]
  return (
    <>
      <ToastContainer />
      <PageHeader title={L(rtl, 'Treasury', 'خزانه‌داری')} subtitle={L(rtl, 'Bank, cash, payment, receipt, reconciliation, cheque, liquidity and FX-risk management', 'مدیریت بانک، نقدینگی، پرداخت، دریافت، مغایرت‌گیری، چک و ریسک ارزی')} action={<CurrencyPicker fa={rtl} />} />
      <div className="flex gap-1 mb-6 border-b border-subtle flex-wrap">
        {TABS.map(([id, en, fa]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{L(rtl, en, fa)}</button>)}
      </div>
      {tab === 'overview' && <Overview rtl={rtl} />}
      {tab === 'banks' && <Banks rtl={rtl} toast={toast} />}
      {tab === 'statements' && <Statements rtl={rtl} toast={toast} />}
      {tab === 'reconcile' && <Reconcile rtl={rtl} toast={toast} />}
      {tab === 'payments' && <Payments rtl={rtl} toast={toast} />}
      {tab === 'receipts' && <Receipts rtl={rtl} toast={toast} />}
      {tab === 'cheques' && <Cheques rtl={rtl} />}
      {tab === 'cash' && <CashForecast rtl={rtl} />}
      {tab === 'risk' && <RiskAnalysis rtl={rtl} />}
      {tab === 'ai' && <Assistant rtl={rtl} toast={toast} />}
    </>
  )
}
function mc(label: string, value: string | number, sub?: string) {
  return <div className="metric-card"><p className="text-overline">{label}</p><p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>{sub && <p className="text-2xs text-text-tertiary mt-1">{sub}</p>}</div>
}

function Overview({ rtl }: { rtl: boolean }) {
  const { money } = useDisplayCurrency()
  const [d, setD] = useState<{ cash: { available: number; projected: number; pendingReceipts: number; pendingPayments: number }; liquidity: { risk: string }; risk: { level: string; totalUnrealized: number }; banks: number; unmatched: number; pendingPayments: number; openCheques: number } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/treasury/overview').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}) }, [])
  if (!d) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Loading…', 'بارگذاری…')}</Card>
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mc(L(rtl, 'Available cash', 'نقد در دسترس'), money(d.cash.available))}
        {mc(L(rtl, 'Projected', 'پیش‌بینی'), money(d.cash.projected))}
        {mc(L(rtl, 'Pending receipts', 'دریافت‌های معلق'), money(d.cash.pendingReceipts))}
        {mc(L(rtl, 'Pending payments', 'پرداخت‌های معلق'), money(d.cash.pendingPayments))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mc(L(rtl, 'Liquidity risk', 'ریسک نقدینگی'), d.liquidity.risk)}
        {mc(L(rtl, 'FX risk', 'ریسک ارزی'), d.risk.level, `${L(rtl, 'unrealized', 'تحقق‌نیافته')} ${money(d.risk.totalUnrealized)}`)}
        {mc(L(rtl, 'Open cheques', 'چک باز'), d.openCheques)}
        {mc(L(rtl, 'Unreconciled lines', 'ردیف مغایر'), d.unmatched)}
      </div>
    </div>
  )
}

function Banks({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const { money } = useDisplayCurrency()
  const [banks, setBanks] = useState<{ id: number; name: string; bank: string | null; currency: string; accountType: string; status: string; openingBalance: number }[]>([])
  const [form, setForm] = useState({ name: '', bank: '', iban: '', swift: '', accountType: 'current', currency: 'IRR', openingBalance: '' })
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/treasury/banks'); if (r.ok) setBanks((await r.json()).banks ?? []) }, [])
  useEffect(() => { load() }, [load])
  async function save() {
    const r = await fetch('/api/admin/erp/treasury/banks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, openingBalance: form.openingBalance ? Number(form.openingBalance) : 0 }) })
    if (r.ok) { toast(L(rtl, 'Bank saved', 'بانک ذخیره شد'), 'success'); setForm({ name: '', bank: '', iban: '', swift: '', accountType: 'current', currency: 'IRR', openingBalance: '' }); load() } else toast(L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <div className="space-y-4">
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Account', 'حساب')}</th><th>{L(rtl, 'Bank', 'بانک')}</th><th>{L(rtl, 'Type', 'نوع')}</th><th>{L(rtl, 'Currency', 'ارز')}</th><th className="text-end">{L(rtl, 'Opening', 'اولیه')}</th></tr></thead>
        <tbody>{banks.map(b => <tr key={b.id} className="border-t border-subtle"><td className="py-2 text-text-primary">{b.name}</td><td className="text-center text-text-secondary text-2xs">{b.bank}</td><td className="text-center text-2xs"><Badge color="slate">{b.accountType}</Badge></td><td className="text-center text-text-secondary">{b.currency}</td><td className="text-end text-text-secondary">{money(b.openingBalance)}</td></tr>)}
          {!banks.length && <tr><td colSpan={5} className="text-center text-text-tertiary py-6">{L(rtl, 'No bank accounts', 'حسابی نیست')}</td></tr>}</tbody></table></Card>
      <Card className="p-4 grid md:grid-cols-7 gap-2 items-end">
        <Input label={L(rtl, 'Name', 'نام')} value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
        <Input label={L(rtl, 'Bank', 'بانک')} value={form.bank} onChange={v => setForm(f => ({ ...f, bank: v }))} />
        <Input label="IBAN" value={form.iban} onChange={v => setForm(f => ({ ...f, iban: v }))} />
        <Input label="SWIFT" value={form.swift} onChange={v => setForm(f => ({ ...f, swift: v }))} />
        <Select label={L(rtl, 'Type', 'نوع')} value={form.accountType} onChange={v => setForm(f => ({ ...f, accountType: v }))} options={['current', 'saving', 'foreign', 'petty_cash', 'clearing'].map(x => ({ value: x, label: x }))} />
        <Select label={L(rtl, 'Currency', 'ارز')} value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={['IRR', 'IRT', 'USD', 'EUR', 'AED'].map(x => ({ value: x, label: x }))} />
        <Btn onClick={save} disabled={!form.name}>{L(rtl, 'Add bank', 'افزودن')}</Btn>
      </Card>
    </div>
  )
}

function Statements({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [banks, setBanks] = useState<{ id: number; name: string }[]>([])
  const [accountId, setAccountId] = useState('')
  const [format, setFormat] = useState('csv')
  const [content, setContent] = useState('')
  const [lines, setLines] = useState<{ id: number; date: string; description: string; amount: number; erpType: string; status: string }[]>([])
  useEffect(() => { fetch('/api/admin/erp/treasury/banks').then(r => r.json()).then(d => setBanks((d.banks ?? []).map((b: { id: number; name: string }) => ({ id: b.id, name: b.name })))).catch(() => {}) }, [])
  const loadLines = useCallback(async () => { if (!accountId) return; const r = await fetch(`/api/admin/erp/treasury/statements?accountId=${accountId}&status=all`); if (r.ok) setLines((await r.json()).lines ?? []) }, [accountId])
  useEffect(() => { loadLines() }, [loadLines])
  async function doImport() {
    if (!accountId || !content.trim()) return
    const r = await fetch('/api/admin/erp/treasury/statements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: Number(accountId), format, content, mapping: { date: 'date', amount: 'amount', description: 'description', reference: 'reference' } }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L(rtl, `Imported ${d.imported}, ${d.duplicates} duplicates skipped`, `${d.imported} وارد شد، ${d.duplicates} تکراری`), 'success'); setContent(''); loadLines() } else toast(d.error || L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-2">
          <Select label={L(rtl, 'Bank account', 'حساب بانکی')} value={accountId} onChange={setAccountId} options={[{ value: '', label: '—' }, ...banks.map(b => ({ value: String(b.id), label: b.name }))]} />
          <Select label={L(rtl, 'Format', 'فرمت')} value={format} onChange={setFormat} options={[['csv', 'CSV'], ['mt940', 'MT940'], ['camt053', 'CAMT.053']].map(([v, l]) => ({ value: v, label: l }))} />
          <div className="flex items-end"><Btn onClick={doImport} disabled={!accountId || !content.trim()}>{L(rtl, 'Import', 'وارد کردن')}</Btn></div>
        </div>
        <Input label={L(rtl, 'Paste statement (CSV header: date,amount,description,reference)', 'صورت‌حساب را بچسبانید')} value={content} onChange={setContent} multiline rows={5} />
      </Card>
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Date', 'تاریخ')}</th><th className="text-start">{L(rtl, 'Description', 'شرح')}</th><th className="text-end">{L(rtl, 'Amount', 'مبلغ')}</th><th>{L(rtl, 'Type', 'نوع')}</th><th>{L(rtl, 'Status', 'وضعیت')}</th></tr></thead>
        <tbody>{lines.map(l => <tr key={l.id} className="border-t border-subtle"><td className="py-1.5 text-text-secondary text-2xs">{l.date}</td><td className="text-text-secondary">{l.description}</td><td className={`text-end ${l.amount < 0 ? 'text-danger' : 'text-success-text'}`}>{l.amount.toLocaleString()}</td><td className="text-center text-2xs text-text-tertiary">{l.erpType}</td><td className="text-center"><Badge color={l.status === 'matched' ? 'green' : 'slate'}>{l.status}</Badge></td></tr>)}
          {!lines.length && <tr><td colSpan={5} className="text-center text-text-tertiary py-6">{L(rtl, 'No lines', 'ردیفی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

function Reconcile({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [banks, setBanks] = useState<{ id: number; name: string }[]>([])
  const [accountId, setAccountId] = useState('')
  const [data, setData] = useState<{ suggestions: { lineId: number; candidateId: string; confidence: number; status: string; reasons: string[] }[]; stats: { total: number; matched: number; autoMatchRatePct: number } } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/treasury/banks').then(r => r.json()).then(d => setBanks((d.banks ?? []).map((b: { id: number; name: string }) => ({ id: b.id, name: b.name })))).catch(() => {}) }, [])
  // 26.32 بند۴: `bank_matches` recorded every confirm/reject and was read by
  // nothing — an auditor could not see WHY a line counts as reconciled, and a
  // rejected suggestion looked like it had never been decided.
  const [history, setHistory] = useState<{ id: number; lineId: number; erpRef: string; confidence: number; status: string; matchedByName: string | null; createdAt: string }[]>([])
  const load = useCallback(async () => {
    if (!accountId) return
    const r = await fetch(`/api/admin/erp/treasury/reconcile?accountId=${accountId}`); if (r.ok) setData(await r.json())
    const h = await fetch(`/api/admin/erp/treasury/reconcile?accountId=${accountId}&history=1`)
    if (h.ok) setHistory((await h.json()).history ?? [])
  }, [accountId])
  useEffect(() => { load() }, [load])
  async function confirm(s: { lineId: number; candidateId: string; confidence: number; reasons: string[] }, status: 'matched' | 'rejected') {
    const r = await fetch('/api/admin/erp/treasury/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineId: s.lineId, erpRef: s.candidateId, confidence: s.confidence, status, reasons: s.reasons }) })
    if (r.ok) { toast(L(rtl, 'Recorded', 'ثبت شد'), 'success'); load() }
  }
  return (
    <div className="space-y-4">
      <Select label={L(rtl, 'Bank account', 'حساب بانکی')} value={accountId} onChange={setAccountId} options={[{ value: '', label: '—' }, ...banks.map(b => ({ value: String(b.id), label: b.name }))]} />
      {data && <p className="text-2xs text-text-tertiary">{L(rtl, 'Auto-match rate', 'نرخ تطبیق خودکار')}: {data.stats.autoMatchRatePct}% ({data.stats.matched}/{data.stats.total})</p>}
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Line', 'ردیف')}</th><th>{L(rtl, 'Candidate', 'نامزد')}</th><th className="text-end">{L(rtl, 'Confidence', 'اطمینان')}</th><th></th></tr></thead>
        <tbody>{(data?.suggestions ?? []).filter(s => s.candidateId).map(s => <tr key={s.lineId} className="border-t border-subtle"><td className="py-1.5 text-text-secondary">#{s.lineId}</td><td className="text-center text-2xs text-text-secondary">{s.candidateId}</td><td className="text-end"><Badge color={s.status === 'matched' ? 'green' : s.status === 'suggested' ? 'amber' : 'slate'}>{Math.round(s.confidence * 100)}%</Badge></td><td className="text-end whitespace-nowrap"><button onClick={() => confirm(s, 'matched')} className="text-2xs text-brand hover:underline mx-1">{L(rtl, 'Match', 'تطبیق')}</button><button onClick={() => confirm(s, 'rejected')} className="text-2xs text-danger hover:underline mx-1">{L(rtl, 'Reject', 'رد')}</button></td></tr>)}
          {!data?.suggestions.some(s => s.candidateId) && <tr><td colSpan={4} className="text-center text-text-tertiary py-6">{L(rtl, 'No suggestions', 'پیشنهادی نیست')}</td></tr>}</tbody></table></Card>
      {history.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{L(rtl, 'Reconciliation trail', 'سابقهٔ مغایرت‌گیری')}</h3>
          <table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Line', 'ردیف')}</th><th>{L(rtl, 'ERP ref', 'مرجع')}</th><th>{L(rtl, 'Decision', 'تصمیم')}</th><th>{L(rtl, 'By', 'توسط')}</th><th className="text-end">{L(rtl, 'When', 'زمان')}</th></tr></thead>
            <tbody>{history.map(h => (
              <tr key={h.id} className="border-t border-subtle">
                <td className="py-1.5 text-text-secondary">#{h.lineId}</td>
                <td className="text-center text-2xs text-text-secondary font-mono">{h.erpRef}</td>
                <td className="text-center"><Badge color={h.status === 'matched' ? 'green' : 'red'}>{h.status}</Badge></td>
                <td className="text-center text-2xs text-text-secondary">{h.matchedByName ?? '—'}</td>
                <td className="text-end text-2xs text-text-tertiary">{formatDateTime(h.createdAt, rtl ? 'fa' : 'en')}</td>
              </tr>
            ))}</tbody></table>
        </Card>
      )}
    </div>
  )
}

function Payments({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const { money } = useDisplayCurrency()
  const [rows, setRows] = useState<{ id: number; paymentNo: string; paymentType: string; party: string | null; amount: number; currency: string; status: string }[]>([])
  const [form, setForm] = useState({ paymentType: 'supplier_payment', party: '', amount: '' })
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/treasury/payments'); if (r.ok) setRows((await r.json()).payments ?? []) }, [])
  useEffect(() => { load() }, [load])
  async function act(body: object, ok: string) { const r = await fetch('/api/admin/erp/treasury/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (r.ok) { toast(ok, 'success'); load() } else toast(d.error || L(rtl, 'Failed', 'ناموفق'), 'error') }
  const NEXT: Record<string, { action: string; label: string } | null> = { draft: { action: 'submit', label: L(rtl, 'Submit', 'ارسال') }, approved: { action: 'process', label: L(rtl, 'Process→GL', 'پردازش') }, pending_approval: null }
  return (
    <div className="space-y-4">
      <Card className="p-4 grid md:grid-cols-4 gap-2 items-end">
        <Select label={L(rtl, 'Type', 'نوع')} value={form.paymentType} onChange={v => setForm(f => ({ ...f, paymentType: v }))} options={['supplier_payment', 'customer_refund', 'internal_transfer', 'salary_payment', 'tax_payment', 'foreign_payment'].map(x => ({ value: x, label: x }))} />
        <Input label={L(rtl, 'Party', 'طرف')} value={form.party} onChange={v => setForm(f => ({ ...f, party: v }))} />
        <Input label={L(rtl, 'Amount', 'مبلغ')} type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
        <Btn onClick={() => act({ action: 'create', paymentType: form.paymentType, party: form.party || undefined, amount: Number(form.amount) }, L(rtl, 'Payment created', 'پرداخت ساخته شد'))} disabled={!form.amount}>{L(rtl, 'Create', 'ایجاد')}</Btn>
      </Card>
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'No.', 'شماره')}</th><th>{L(rtl, 'Type', 'نوع')}</th><th className="text-end">{L(rtl, 'Amount', 'مبلغ')}</th><th>{L(rtl, 'Status', 'وضعیت')}</th><th></th></tr></thead>
        <tbody>{rows.map(p => <tr key={p.id} className="border-t border-subtle"><td className="py-2 text-text-primary text-2xs font-mono">{p.paymentNo}</td><td className="text-center text-2xs text-text-secondary">{p.paymentType}</td><td className="text-end text-text-secondary">{money(p.amount)}</td><td className="text-center"><Badge color={p.status === 'completed' ? 'green' : p.status === 'rejected' ? 'red' : p.status === 'approved' ? 'blue' : 'slate'}>{p.status}</Badge></td><td className="text-end">{NEXT[p.status] && <button onClick={() => act({ action: NEXT[p.status]!.action, id: p.id }, L(rtl, 'Done', 'انجام شد'))} className="text-2xs text-brand hover:underline">{NEXT[p.status]!.label}</button>}</td></tr>)}
          {!rows.length && <tr><td colSpan={5} className="text-center text-text-tertiary py-6">{L(rtl, 'No payments', 'پرداختی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

function Receipts({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const { money } = useDisplayCurrency()
  const [rows, setRows] = useState<{ id: number; receiptNo: string; customer: string; amount: number; advance: number }[]>([])
  const [form, setForm] = useState({ customerId: '', amount: '' })
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/treasury/receipts'); if (r.ok) setRows((await r.json()).receipts ?? []) }, [])
  useEffect(() => { load() }, [load])
  async function create() {
    const r = await fetch('/api/admin/erp/treasury/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: form.customerId ? Number(form.customerId) : undefined, amount: Number(form.amount) }) })
    const d = await r.json().catch(() => ({})); if (r.ok) { toast(L(rtl, `Receipt: ${d.allocations?.length ?? 0} invoices settled, advance ${d.advance ?? 0}`, `دریافت ثبت شد`), 'success'); setForm({ customerId: '', amount: '' }); load() } else toast(d.error || L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  return (
    <div className="space-y-4">
      <Card className="p-4 grid md:grid-cols-3 gap-2 items-end">
        <Input label={L(rtl, 'Customer ID', 'شناسه مشتری')} value={form.customerId} onChange={v => setForm(f => ({ ...f, customerId: v }))} />
        <Input label={L(rtl, 'Amount', 'مبلغ')} type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
        <Btn onClick={create} disabled={!form.amount}>{L(rtl, 'Record receipt', 'ثبت دریافت')}</Btn>
      </Card>
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'No.', 'شماره')}</th><th>{L(rtl, 'Customer', 'مشتری')}</th><th className="text-end">{L(rtl, 'Amount', 'مبلغ')}</th><th className="text-end">{L(rtl, 'Advance', 'علی‌الحساب')}</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} className="border-t border-subtle"><td className="py-2 text-2xs font-mono text-text-primary">{r.receiptNo}</td><td className="text-center text-text-secondary">{r.customer}</td><td className="text-end text-text-secondary">{money(r.amount)}</td><td className="text-end text-text-tertiary">{money(r.advance)}</td></tr>)}
          {!rows.length && <tr><td colSpan={4} className="text-center text-text-tertiary py-6">{L(rtl, 'No receipts', 'دریافتی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

function Cheques({ rtl }: { rtl: boolean }) {
  const { money } = useDisplayCurrency()
  const [d, setD] = useState<{ aging: { bucket: string; count: number; amount: number }[]; calendar: { date: string; count: number; amount: number; direction: string }[] } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/treasury/cheques').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}) }, [])
  if (!d) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Loading…', 'بارگذاری…')}</Card>
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-4"><h3 className="text-sm font-semibold text-text-primary mb-2">{L(rtl, 'Aging', 'تحلیل سنی')}</h3><table className="w-full text-sm"><tbody>{d.aging.map(a => <tr key={a.bucket} className="border-t border-subtle"><td className="py-1.5 text-text-secondary">{a.bucket}</td><td className="text-end text-text-tertiary text-2xs">{a.count} · {money(a.amount)}</td></tr>)}</tbody></table></Card>
      <Card className="p-4"><h3 className="text-sm font-semibold text-text-primary mb-2">{L(rtl, 'Calendar', 'تقویم')}</h3><table className="w-full text-sm"><tbody>{d.calendar.map((c, i) => <tr key={i} className="border-t border-subtle"><td className="py-1.5 text-text-secondary text-2xs">{c.date}</td><td className="text-center text-2xs"><Badge color={c.direction === 'issued' ? 'red' : 'green'}>{c.direction}</Badge></td><td className="text-end text-text-tertiary text-2xs">{money(c.amount)}</td></tr>)}{!d.calendar.length && <tr><td className="text-text-tertiary text-2xs py-3">{L(rtl, 'No dated cheques', 'چکی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

function CashForecast({ rtl }: { rtl: boolean }) {
  const { money } = useDisplayCurrency()
  const [d, setD] = useState<{ opening: number; risk: string; buckets: { days: number; inflow: number; outflow: number; net: number; expectedBalance: number }[] } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/treasury/liquidity').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}) }, [])
  if (!d) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Loading…', 'بارگذاری…')}</Card>
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">{L(rtl, 'Opening cash', 'نقد ابتدای دوره')}: <strong className="text-text-primary">{money(d.opening)}</strong> · {L(rtl, 'Risk', 'ریسک')}: <Badge color={d.risk === 'critical' ? 'red' : d.risk === 'watch' ? 'amber' : 'green'}>{d.risk}</Badge></p>
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Horizon', 'افق')}</th><th className="text-end">{L(rtl, 'Inflow', 'ورودی')}</th><th className="text-end">{L(rtl, 'Outflow', 'خروجی')}</th><th className="text-end">{L(rtl, 'Net', 'خالص')}</th><th className="text-end">{L(rtl, 'Expected balance', 'مانده مورد انتظار')}</th></tr></thead>
        <tbody>{d.buckets.map(b => <tr key={b.days} className="border-t border-subtle"><td className="py-2 text-text-primary">{b.days}d</td><td className="text-end text-success-text">{money(b.inflow)}</td><td className="text-end text-danger">{money(b.outflow)}</td><td className="text-end text-text-secondary">{money(b.net)}</td><td className={`text-end font-medium ${b.expectedBalance < 0 ? 'text-danger' : 'text-text-primary'}`}>{money(b.expectedBalance)}</td></tr>)}</tbody></table></Card>
    </div>
  )
}

function RiskAnalysis({ rtl }: { rtl: boolean }) {
  const [d, setD] = useState<{ exposures: { currency: string; assets: number; liabilities: number; netExposure: number }[]; summary: { level: string; totalUnrealized: number } } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/treasury/risk').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}) }, [])
  if (!d) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Loading…', 'بارگذاری…')}</Card>
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">{L(rtl, 'Currency risk', 'ریسک ارزی')}: <Badge color={d.summary.level === 'high' ? 'red' : d.summary.level === 'medium' ? 'amber' : 'green'}>{d.summary.level}</Badge> · {L(rtl, 'Unrealized FX', 'تسعیر تحقق‌نیافته')}: {d.summary.totalUnrealized.toLocaleString()}</p>
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Currency', 'ارز')}</th><th className="text-end">{L(rtl, 'Assets', 'دارایی')}</th><th className="text-end">{L(rtl, 'Liabilities', 'بدهی')}</th><th className="text-end">{L(rtl, 'Net exposure', 'خالص مواجهه')}</th></tr></thead>
        <tbody>{d.exposures.map(e => <tr key={e.currency} className="border-t border-subtle"><td className="py-2 text-text-primary">{e.currency}</td><td className="text-end text-text-secondary">{e.assets.toLocaleString()}</td><td className="text-end text-text-secondary">{e.liabilities.toLocaleString()}</td><td className="text-end text-text-primary">{e.netExposure.toLocaleString()}</td></tr>)}
          {!d.exposures.length && <tr><td colSpan={4} className="text-center text-text-tertiary py-6">{L(rtl, 'No foreign-currency exposure', 'مواجهه ارزی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

function Assistant({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [q, setQ] = useState(rtl ? 'آیا این ماه می‌توانیم به تأمین‌کنندگان پرداخت کنیم؟' : 'Can we pay suppliers this month?')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  async function ask() { setBusy(true); setAnswer(''); try { const r = await fetch('/api/admin/erp/treasury/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, locale: rtl ? 'fa' : 'en' }) }); const d = await r.json().catch(() => ({})); if (r.ok) setAnswer(d.text || ''); else toast(d.error || L(rtl, 'AI unavailable', 'در دسترس نیست'), 'error') } finally { setBusy(false) } }
  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <p className="text-sm text-text-secondary">{L(rtl, 'Ask the treasury assistant — it reasons over cash, due payments, receivables and the liquidity forecast (grounded, never modifies transactions).', 'از دستیار خزانه بپرسید — روی نقدینگی، پرداخت‌های سررسید، دریافتنی‌ها و پیش‌بینی استدلال می‌کند (بدون تغییر تراکنش).')}</p>
        <Input label={L(rtl, 'Question', 'پرسش')} value={q} onChange={setQ} multiline rows={2} />
        <Btn onClick={ask} disabled={busy}>{busy ? L(rtl, 'Analyzing…', 'در حال تحلیل…') : L(rtl, 'Ask', 'بپرس')}</Btn>
      </Card>
      {answer && <Card className="p-5"><pre className="whitespace-pre-wrap text-sm text-text-secondary leading-7" style={{ fontFamily: 'inherit' }}>{answer}</pre></Card>}
    </div>
  )
}
