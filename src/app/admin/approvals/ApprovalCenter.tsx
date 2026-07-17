'use client'

/**
 * Approval Center (Phase 26.12) — the enterprise approval inbox + matrix +
 * delegations + analytics over the centralized approval platform. Reuses the
 * display-currency engine for amounts and the shared AI engine for pre-approval
 * briefings. Every action is RBAC-checked + audited server-side.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, Badge, PageHeader, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency } from '@/lib/admin/currencyDisplay'

const L = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)
type Tab = 'inbox' | 'matrix' | 'delegations' | 'analytics'
type InboxTab = 'pending' | 'approved' | 'rejected' | 'delegated' | 'expired'
type Toast = ReturnType<typeof useToast>['toast']

interface ReqRow { id: number; docType: string; title: string; amount: number; currency: string; department: string | null; status: string; currentLevel: number; slaBreached: number; pendingSince?: string }

export function ApprovalCenter() {
  const rtl = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [tab, setTab] = useState<Tab>('inbox')
  const TABS: [Tab, string, string][] = [['inbox', 'Inbox', 'کارتابل'], ['matrix', 'Approval Matrix', 'ماتریس تأیید'], ['delegations', 'Delegations', 'تفویض'], ['analytics', 'Analytics', 'تحلیل']]
  return (
    <>
      <ToastContainer />
      <PageHeader title={L(rtl, 'Approval Center', 'مرکز تأیید')} subtitle={L(rtl, 'Multi-level approvals, delegation, SLA escalation and AI briefings across every ERP document', 'تأیید چندسطحی، تفویض، تشدید SLA و تحلیل هوشمند برای همه اسناد')} />
      <div className="flex gap-1 mb-6 border-b border-subtle flex-wrap">
        {TABS.map(([id, en, fa]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>{L(rtl, en, fa)}</button>
        ))}
      </div>
      {tab === 'inbox' && <Inbox rtl={rtl} toast={toast} />}
      {tab === 'matrix' && <MatrixTab rtl={rtl} />}
      {tab === 'delegations' && <Delegations rtl={rtl} toast={toast} />}
      {tab === 'analytics' && <Analytics rtl={rtl} />}
    </>
  )
}

function Inbox({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const { money } = useDisplayCurrency()
  const [itab, setItab] = useState<InboxTab>('pending')
  const [rows, setRows] = useState<ReqRow[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const load = useCallback(async () => { const r = await fetch(`/api/admin/erp/approvals?tab=${itab}`); if (r.ok) { setRows((await r.json()).requests ?? []); setChecked(new Set()) } }, [itab])
  useEffect(() => { load() }, [load])
  const ITABS: [InboxTab, string, string][] = [['pending', 'Pending', 'در انتظار'], ['approved', 'Approved', 'تأییدشده'], ['rejected', 'Rejected', 'ردشده'], ['delegated', 'Delegated', 'تفویض‌شده'], ['expired', 'Expired', 'منقضی']]

  async function bulk() {
    if (!checked.size) return
    const r = await fetch('/api/admin/erp/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bulk', ids: [...checked] }) })
    if (r.ok) { const d = await r.json(); toast(L(rtl, `Approved ${d.approved}, skipped ${d.skipped}`, `${d.approved} تأیید، ${d.skipped} رد`), 'success'); load() }
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {ITABS.map(([id, en, fa]) => <button key={id} onClick={() => setItab(id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${itab === id ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary'}`}>{L(rtl, en, fa)}</button>)}
        {itab === 'pending' && checked.size > 0 && <Btn size="sm" onClick={bulk}>{L(rtl, `Bulk approve (${checked.size})`, `تأیید گروهی (${checked.size})`)}</Btn>}
      </div>
      <Card className="p-4">
        <table className="w-full text-sm">
          <thead><tr className="text-text-tertiary text-2xs">{itab === 'pending' && <th></th>}<th className="text-start py-1">{L(rtl, 'Document', 'سند')}</th><th>{L(rtl, 'Type', 'نوع')}</th><th className="text-end">{L(rtl, 'Amount', 'مبلغ')}</th><th>{L(rtl, 'Level', 'سطح')}</th><th>{L(rtl, 'Status', 'وضعیت')}</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-t border-subtle">
              {itab === 'pending' && <td><input type="checkbox" checked={checked.has(r.id)} onChange={e => setChecked(s => { const n = new Set(s); e.target.checked ? n.add(r.id) : n.delete(r.id); return n })} /></td>}
              <td className="py-2 text-text-primary">{r.title}{r.slaBreached ? <Badge color="red">SLA</Badge> : null}</td>
              <td className="text-center text-2xs text-text-secondary">{r.docType}</td>
              <td className="text-end text-text-secondary">{money(r.amount)}</td>
              <td className="text-center text-text-secondary">L{r.currentLevel}</td>
              <td className="text-center"><Badge color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : r.status === 'changes_requested' ? 'amber' : 'slate'}>{r.status}</Badge></td>
              <td className="text-end"><button onClick={() => setSel(r.id)} className="text-2xs text-brand hover:underline">{L(rtl, 'Open', 'باز')}</button></td>
            </tr>
          ))}{!rows.length && <tr><td colSpan={7} className="text-center text-text-tertiary py-6">{L(rtl, 'Nothing here', 'موردی نیست')}</td></tr>}</tbody>
        </table>
      </Card>
      {sel && <RequestDrawer rtl={rtl} id={sel} onClose={() => setSel(null)} onChanged={load} toast={toast} />}
    </div>
  )
}

function RequestDrawer({ rtl, id, onClose, onChanged, toast }: { rtl: boolean; id: number; onClose: () => void; onChanged: () => void; toast: Toast }) {
  const { money } = useDisplayCurrency()
  const [data, setData] = useState<{ request: ReqRow; state: { status: string; currentLevel: number | null; progressPct: number; awaiting: { type: string; ref: string }[] }; actions: { level: number; approverId: string; decision: string; at?: string }[]; comments: { id: number; authorName?: string; body: string; createdAt: string }[]; escalations: { stage: number; action: string; target?: string }[] } | null>(null)
  const [comment, setComment] = useState('')
  const [ai, setAi] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await fetch(`/api/admin/erp/approvals?id=${id}`); if (r.ok) setData(await r.json()) }, [id])
  useEffect(() => { load() }, [load])
  async function decide(decision: string) {
    setBusy(true)
    const r = await fetch('/api/admin/erp/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decide', id, decision, comment: comment || undefined }) })
    setBusy(false)
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast(L(rtl, `Marked ${d.status}`, `ثبت شد: ${d.status}`), 'success'); setComment(''); load(); onChanged() } else toast(d.error || L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  async function addComment() { if (!comment.trim()) return; const r = await fetch('/api/admin/erp/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'comment', id, body: comment }) }); if (r.ok) { setComment(''); load() } }
  async function brief() { setBusy(true); setAi(''); const r = await fetch('/api/admin/erp/approvals/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, locale: rtl ? 'fa' : 'en' }) }); setBusy(false); const d = await r.json().catch(() => ({})); if (r.ok) setAi(d.text || ''); else toast(d.error || L(rtl, 'AI unavailable', 'هوش مصنوعی در دسترس نیست'), 'error') }

  return (
    <Modal open onClose={onClose} title={data ? data.request.title : L(rtl, 'Request', 'درخواست')} size="lg">
      {!data ? <p className="text-text-tertiary text-sm">{L(rtl, 'Loading…', 'بارگذاری…')}</p> : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <Badge color={data.state.status === 'approved' ? 'green' : data.state.status === 'rejected' ? 'red' : 'slate'}>{data.state.status}</Badge>
            <span className="text-text-secondary">{money(data.request.amount)}</span>
            <span className="text-2xs text-text-tertiary">{L(rtl, 'Progress', 'پیشرفت')} {data.state.progressPct}%</span>
            {data.state.currentLevel && <span className="text-2xs text-text-tertiary">{L(rtl, 'Awaiting L', 'در انتظار سطح ')}{data.state.currentLevel}: {data.state.awaiting.map(a => a.ref).join(', ')}</span>}
          </div>
          {(data.state.status === 'pending' || data.state.status === 'changes_requested') && (
            <div className="flex gap-2 flex-wrap">
              <Btn onClick={() => decide('approved')} disabled={busy}>{L(rtl, 'Approve', 'تأیید')}</Btn>
              <Btn variant="secondary" onClick={() => decide('changes_requested')} disabled={busy}>{L(rtl, 'Request change', 'درخواست اصلاح')}</Btn>
              <Btn variant="ghost" onClick={() => decide('rejected')} disabled={busy}>{L(rtl, 'Reject', 'رد')}</Btn>
              <Btn variant="ghost" onClick={brief} disabled={busy}>{L(rtl, '🤖 AI brief', '🤖 تحلیل هوشمند')}</Btn>
            </div>
          )}
          {ai && <Card className="p-3"><pre className="whitespace-pre-wrap text-2xs text-text-secondary leading-6" style={{ fontFamily: 'inherit' }}>{ai}</pre><p className="text-3xs text-text-tertiary mt-2">{L(rtl, 'AI advises only — the decision is yours.', 'هوش مصنوعی فقط مشورت می‌دهد — تصمیم با شماست.')}</p></Card>}
          <Input label={L(rtl, 'Comment', 'یادداشت')} value={comment} onChange={setComment} multiline rows={2} />
          <button onClick={addComment} className="text-2xs text-brand hover:underline">{L(rtl, '+ Add comment', '+ افزودن یادداشت')}</button>
          {data.actions.length > 0 && <div><p className="text-2xs text-text-tertiary mb-1">{L(rtl, 'History', 'تاریخچه')}</p>{data.actions.map((a, i) => <p key={i} className="text-2xs text-text-secondary">L{a.level} · {a.decision} · {a.approverId}</p>)}</div>}
          {data.escalations.length > 0 && <div><p className="text-2xs text-text-tertiary mb-1">{L(rtl, 'Escalations', 'تشدیدها')}</p>{data.escalations.map((e, i) => <p key={i} className="text-2xs text-warning-text">{e.action} {e.target ? `→ ${e.target}` : ''} (stage {e.stage})</p>)}</div>}
          {data.comments.length > 0 && <div className="space-y-1">{data.comments.map(c => <p key={c.id} className="text-2xs text-text-secondary"><strong>{c.authorName || '—'}:</strong> {c.body}</p>)}</div>}
        </div>
      )}
    </Modal>
  )
}

function MatrixTab({ rtl }: { rtl: boolean }) {
  const [rules, setRules] = useState<{ id: number; docType: string; nameEn: string | null; nameFa: string | null; minAmount: number; maxAmount: number | null; levels: string; priority: number; active: number }[]>([])
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/approvals/matrix'); if (r.ok) setRules((await r.json()).rules ?? []) }, [])
  useEffect(() => { load() }, [load])
  function levelSummary(levels: string): string { try { const ls = JSON.parse(levels) as { level: number; approvers: { ref: string }[] }[]; return ls.map(l => `L${l.level}:${l.approvers.map(a => a.ref).join('+')}`).join(' → ') } catch { return '—' } }
  return (
    <Card className="p-4">
      <p className="text-2xs text-text-tertiary mb-3">{L(rtl, 'Amount-tiered approval routing per document type (edit via API/rules; administrator-gated).', 'مسیر تأیید بر اساس مبلغ برای هر نوع سند (مدیریت با دسترسی مدیر).')}</p>
      <table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'Doc type', 'نوع سند')}</th><th className="text-end">{L(rtl, 'From', 'از')}</th><th className="text-end">{L(rtl, 'To', 'تا')}</th><th className="text-start">{L(rtl, 'Levels', 'سطوح')}</th></tr></thead>
        <tbody>{rules.map(r => <tr key={r.id} className="border-t border-subtle"><td className="py-2 text-text-primary">{r.docType}</td><td className="text-end text-text-secondary">{r.minAmount.toLocaleString()}</td><td className="text-end text-text-secondary">{r.maxAmount == null ? '∞' : r.maxAmount.toLocaleString()}</td><td className="text-2xs text-text-secondary">{levelSummary(r.levels)}</td></tr>)}
          {!rules.length && <tr><td colSpan={4} className="text-center text-text-tertiary py-6">{L(rtl, 'No matrix rules', 'قاعده‌ای نیست')}</td></tr>}</tbody></table>
      <p className="text-3xs text-text-tertiary mt-3">{L(rtl, 'Seeded default: purchase_order 0–100M dept-manager, 100M–1B +finance-manager, >1B +CFO+CEO.', 'پیش‌فرض: خرید تا ۱۰۰م مدیر بخش، تا ۱میلیارد +مدیر مالی، بالای ۱میلیارد +CFO+CEO.')}</p>
    </Card>
  )
}

function Delegations({ rtl, toast }: { rtl: boolean; toast: Toast }) {
  const [rows, setRows] = useState<{ id: number; fromName?: string; toName?: string; fromUserId: string; toUserId: string; startDate: string; endDate: string; docType: string | null; active: number }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({ fromUserId: '', toUserId: '', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) })
  const load = useCallback(async () => { const r = await fetch('/api/admin/erp/approvals/delegations'); if (r.ok) setRows((await r.json()).delegations ?? []) }, [])
  useEffect(() => { load(); fetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }).then(d => setUsers((d.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))).catch(() => {}) }, [load])
  async function create() {
    const r = await fetch('/api/admin/erp/approvals/delegations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...form }) })
    if (r.ok) { toast(L(rtl, 'Delegation created', 'تفویض ثبت شد'), 'success'); load() } else toast((await r.json().catch(() => ({}))).error || L(rtl, 'Failed', 'ناموفق'), 'error')
  }
  async function revoke(id: number) { const r = await fetch('/api/admin/erp/approvals/delegations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke', id }) }); if (r.ok) load() }
  const opts = [{ value: '', label: '—' }, ...users.map(u => ({ value: u.id, label: u.name }))]
  return (
    <div className="space-y-4">
      <Card className="p-4 grid md:grid-cols-5 gap-2 items-end">
        <Select label={L(rtl, 'From', 'از')} value={form.fromUserId} onChange={v => setForm(f => ({ ...f, fromUserId: v }))} options={opts} />
        <Select label={L(rtl, 'To', 'به')} value={form.toUserId} onChange={v => setForm(f => ({ ...f, toUserId: v }))} options={opts} />
        <Input label={L(rtl, 'Start', 'شروع')} type="date" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} />
        <Input label={L(rtl, 'End', 'پایان')} type="date" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} />
        <Btn onClick={create} disabled={!form.fromUserId || !form.toUserId}>{L(rtl, 'Delegate', 'تفویض')}</Btn>
      </Card>
      <Card className="p-4"><table className="w-full text-sm"><thead><tr className="text-text-tertiary text-2xs"><th className="text-start py-1">{L(rtl, 'From', 'از')}</th><th>{L(rtl, 'To', 'به')}</th><th>{L(rtl, 'Window', 'بازه')}</th><th></th></tr></thead>
        <tbody>{rows.map(d => <tr key={d.id} className="border-t border-subtle"><td className="py-2 text-text-primary">{d.fromName || d.fromUserId}</td><td className="text-center text-text-secondary">{d.toName || d.toUserId}</td><td className="text-center text-2xs text-text-secondary">{d.startDate} → {d.endDate}</td><td className="text-end">{d.active ? <button onClick={() => revoke(d.id)} className="text-2xs text-danger hover:underline">{L(rtl, 'Revoke', 'لغو')}</button> : <Badge color="slate">{L(rtl, 'inactive', 'غیرفعال')}</Badge>}</td></tr>)}
          {!rows.length && <tr><td colSpan={4} className="text-center text-text-tertiary py-6">{L(rtl, 'No delegations', 'تفویضی نیست')}</td></tr>}</tbody></table></Card>
    </div>
  )
}

function Analytics({ rtl }: { rtl: boolean }) {
  const [k, setK] = useState<{ total: number; pending: number; approved: number; rejected: number; rejectionRatePct: number; avgApprovalHours: number; slaViolations: number; bottlenecks: { approverId: string; count: number; avgWaitHours: number }[]; byDepartment: { department: string; total: number; approved: number; rejected: number; avgHours: number }[] } | null>(null)
  useEffect(() => { fetch('/api/admin/erp/approvals?view=analytics').then(r => r.ok ? r.json() : null).then(setK).catch(() => {}) }, [])
  if (!k) return <Card className="p-8 text-center text-text-tertiary">{L(rtl, 'Loading…', 'بارگذاری…')}</Card>
  const kc = (label: string, value: string | number) => <div className="metric-card"><p className="text-overline">{label}</p><p className="text-2xl font-bold text-text-primary">{value}</p></div>
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kc(L(rtl, 'Total', 'کل'), k.total)}{kc(L(rtl, 'Pending', 'در انتظار'), k.pending)}
        {kc(L(rtl, 'Avg time (h)', 'میانگین زمان'), k.avgApprovalHours)}{kc(L(rtl, 'Rejection %', 'نرخ رد'), `${k.rejectionRatePct}%`)}
        {kc(L(rtl, 'SLA violations', 'نقض SLA'), k.slaViolations)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4"><h3 className="text-sm font-semibold text-text-primary mb-2">{L(rtl, 'Bottleneck approvers', 'گلوگاه‌ها')}</h3><table className="w-full text-sm"><tbody>{k.bottlenecks.map(b => <tr key={b.approverId} className="border-t border-subtle"><td className="py-1.5 text-text-secondary">{b.approverId}</td><td className="text-end text-text-tertiary text-2xs">{b.count} · {b.avgWaitHours}h</td></tr>)}{!k.bottlenecks.length && <tr><td className="text-text-tertiary text-2xs py-3">—</td></tr>}</tbody></table></Card>
        <Card className="p-4"><h3 className="text-sm font-semibold text-text-primary mb-2">{L(rtl, 'Department performance', 'عملکرد بخش')}</h3><table className="w-full text-sm"><tbody>{k.byDepartment.map(d => <tr key={d.department} className="border-t border-subtle"><td className="py-1.5 text-text-secondary">{d.department}</td><td className="text-end text-text-tertiary text-2xs">{d.approved}/{d.total} · {d.avgHours}h</td></tr>)}{!k.byDepartment.length && <tr><td className="text-text-tertiary text-2xs py-3">—</td></tr>}</tbody></table></Card>
      </div>
    </div>
  )
}
