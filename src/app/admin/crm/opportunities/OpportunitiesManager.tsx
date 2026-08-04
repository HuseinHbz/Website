'use client'

/**
 * Phase 27 بند۱ — the opportunity workspace.
 *
 * Table + kanban, reusing `usePointerDnd` (the shared helper, not a new drag
 * implementation) and `deleteRowAction` (so this module ships with a working
 * Delete from day one — the 26.33 BUG-205 lesson).
 *
 * The headline figure is the WEIGHTED pipeline: the raw sum of open deals
 * always flatters a forecast because it counts a 10% deal like a signed one.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { deleteRowAction } from '@/lib/admin/rowDelete'
import { usePointerDnd } from '@/lib/admin/pointerDnd'
import { crud } from '@/lib/admin/crud'
import { formatDateTime } from '@/lib/admin/datetime'
import {
  OPPORTUNITY_STAGES, OPEN_STAGES, STAGE_LABELS, STAGE_DEFAULT_PROBABILITY,
  type OpportunityStage,
} from '@/lib/crm/opportunities'

const L = (fa: boolean, en: string, faText: string) => (fa ? faText : en)

interface Opp {
  id: number
  title: string
  amount: number
  currency: string
  probability: number
  stage: OpportunityStage
  expectedCloseDate: string | null
  customerId: number | null
  customerName: string | null
  ownerName: string | null
  outcomeReason: string | null
  salesDocumentId: number | null
  salesDocNo: string | null
  updatedAt: string
}

interface Summary {
  openCount: number; openValue: number; weightedValue: number
  wonValue: number; lostValue: number; winRatePct: number
  byStage: { stage: OpportunityStage; count: number; value: number; weighted: number }[]
}

const EMPTY = {
  title: '', amount: '', probability: '', stage: 'identified' as OpportunityStage,
  expectedCloseDate: '', customerId: '', outcomeReason: '', notes: '',
}

export function OpportunitiesManager() {
  const fa = useAdminLocale() === 'fa'
  const { money } = useDisplayCurrency()
  const { toast, ToastContainer } = useToast()

  const [rows, setRows] = useState<Opp[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [losses, setLosses] = useState<{ reason: string; count: number; value: number }[]>([])
  const [reasons, setReasons] = useState<{ id: number; labelEn: string; labelFa: string }[]>([])
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([])
  const [view, setView] = useState<'table' | 'kanban'>('kanban')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<typeof EMPTY & { id?: number }>(EMPTY)
  const [convertFor, setConvertFor] = useState<Opp | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/crm/opportunities')
    if (r.ok) {
      const d = await r.json()
      setRows(d.opportunities ?? [])
      setSummary(d.summary ?? null)
      setLosses(d.losses ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/admin/crm/opportunities?view=lossReasons')
      .then(r => r.ok ? r.json() : { reasons: [] }).then(d => setReasons(d.reasons ?? [])).catch(() => {})
    fetch('/api/admin/erp/sales/customers')
      .then(r => r.ok ? r.json() : { customers: [] })
      .then(d => setCustomers((d.customers ?? []).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }))))
      .catch(() => {})
  }, [])

  async function move(o: Opp, stage: OpportunityStage) {
    // A loss owes a reason — ask for it rather than letting the server refuse.
    if (stage === 'lost' && !o.outcomeReason) {
      setEditing({ ...EMPTY, id: o.id, title: o.title, stage: 'lost', amount: String(o.amount), probability: '0' })
      setModal(true)
      return
    }
    const res = await fetch('/api/admin/crm/opportunities', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, stage, probability: STAGE_DEFAULT_PROBABILITY[stage] }),
    })
    if (res.ok) { load(); return }
    toast(await crud.errorOf(res, L(fa, 'Could not move the deal', 'انتقال فرصت انجام نشد')), 'error')
  }

  const dnd = usePointerDnd<number>((id, stage) => {
    const o = rows.find(r => r.id === id)
    if (o && o.stage !== stage) void move(o, stage as OpportunityStage)
  })

  async function save() {
    const body = {
      ...(editing.id ? { id: editing.id } : {}),
      title: editing.title,
      amount: editing.amount === '' ? undefined : Number(editing.amount),
      probability: editing.probability === '' ? undefined : Number(editing.probability),
      stage: editing.stage,
      expectedCloseDate: editing.expectedCloseDate || null,
      customerId: editing.customerId ? Number(editing.customerId) : null,
      outcomeReason: editing.outcomeReason || null,
      notes: editing.notes || null,
    }
    const res = await fetch('/api/admin/crm/opportunities', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast(L(fa, 'Saved', 'ذخیره شد'), 'success'); setModal(false); setEditing(EMPTY); load()
    } else {
      toast(await crud.errorOf(res, L(fa, 'Save failed', 'ذخیره نشد')), 'error')
    }
  }

  async function convert(docType: 'quote' | 'invoice') {
    if (!convertFor) return
    const res = await fetch('/api/admin/crm/opportunities', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert', id: convertFor.id, docType }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      toast(d.alreadyConverted
        ? L(fa, `Already converted: ${d.docNo}`, `قبلاً تبدیل شده: ${d.docNo}`)
        : L(fa, `Created ${d.docNo}`, `سند ${d.docNo} ساخته شد`), 'success')
      setConvertFor(null); load()
    } else {
      toast(d.error || L(fa, 'Conversion failed', 'تبدیل انجام نشد'), 'error')
    }
  }

  const stLabel = (s: OpportunityStage) => (fa ? STAGE_LABELS[s].fa : STAGE_LABELS[s].en)

  const columns: Column<Opp>[] = [
    { key: 'title', labelEn: 'Opportunity', labelFa: 'فرصت',
      render: o => <div><div className="font-medium text-text-primary">{o.title}</div>
        <div className="text-xs text-text-tertiary">{o.customerName ?? '—'}</div></div> },
    { key: 'stage', labelEn: 'Stage', labelFa: 'مرحله', type: 'enum',
      options: OPPORTUNITY_STAGES.map(s => ({ value: s, labelEn: STAGE_LABELS[s].en, labelFa: STAGE_LABELS[s].fa })),
      render: o => <Badge color={o.stage === 'won' ? 'green' : o.stage === 'lost' ? 'red' : 'blue'}>{stLabel(o.stage)}</Badge> },
    { key: 'amount', labelEn: 'Amount', labelFa: 'مبلغ', type: 'number', numeric: true,
      render: o => <span className="text-text-secondary">{money(o.amount)}</span> },
    { key: 'probability', labelEn: 'Probability', labelFa: 'احتمال', type: 'number', numeric: true,
      render: o => <span className="text-text-secondary tabular-nums">{fa ? o.probability.toLocaleString('fa-IR') : o.probability}٪</span> },
    { key: 'weighted', labelEn: 'Weighted', labelFa: 'ارزش وزنی', numeric: true,
      render: o => <span className="font-semibold text-text-primary">{money(o.amount * o.probability / 100)}</span> },
    { key: 'ownerName', labelEn: 'Owner', labelFa: 'مسئول',
      render: o => <span className="text-xs text-text-tertiary">{o.ownerName ?? '—'}</span> },
    { key: 'salesDocNo', labelEn: 'Document', labelFa: 'سند',
      render: o => o.salesDocumentId
        ? <Link href={`/admin/sales?doc=${o.salesDocumentId}`} className="text-xs text-brand hover:underline font-mono">{o.salesDocNo}</Link>
        : <span className="text-xs text-text-tertiary">—</span> },
    { key: 'updatedAt', labelEn: 'Updated', labelFa: 'به‌روزرسانی',
      render: o => <span className="text-2xs text-text-tertiary">{formatDateTime(o.updatedAt, fa ? 'fa' : 'en')}</span> },
  ]

  const rowActions: RowAction<Opp>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: 'ویرایش', icon: '✎',
      onClick: o => {
        setEditing({
          id: o.id, title: o.title, amount: String(o.amount), probability: String(o.probability),
          stage: o.stage, expectedCloseDate: o.expectedCloseDate ?? '',
          customerId: o.customerId ? String(o.customerId) : '',
          outcomeReason: o.outcomeReason ?? '', notes: '',
        })
        setModal(true)
      } },
    { id: 'convert', labelEn: 'Convert to document', labelFa: 'تبدیل به سند', icon: '📄',
      hidden: o => !!o.salesDocumentId, onClick: o => setConvertFor(o) },
    deleteRowAction<Opp>({
      path: '/api/admin/crm/opportunities', fa, toast, reload: load,
      labelOf: o => o.title,
    }),
  ]

  const kpi = (label: string, value: string, tone?: 'ok' | 'warn') => (
    <div className={`rounded-xl p-4 bg-surface-2 border ${tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : 'border-subtle'}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={L(fa, 'Opportunities', 'فرصت‌های فروش')}
        subtitle={L(fa,
          'Deals in play — one customer can have several at once',
          'معاملات در جریان — یک مشتری می‌تواند هم‌زمان چند فرصت داشته باشد')}
        action={<div className="flex items-center gap-2">
          <CurrencyPicker fa={fa} />
          <Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{L(fa, 'New opportunity', 'فرصت جدید')}</Btn>
        </div>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {kpi(L(fa, 'Open deals', 'فرصت باز'), fa ? (summary?.openCount ?? 0).toLocaleString('fa-IR') : String(summary?.openCount ?? 0))}
        {kpi(L(fa, 'Pipeline value', 'ارزش خط لوله'), money(summary?.openValue ?? 0))}
        {kpi(L(fa, 'Weighted value', 'ارزش وزنی'), money(summary?.weightedValue ?? 0), 'ok')}
        {kpi(L(fa, 'Won', 'برد'), money(summary?.wonValue ?? 0), 'ok')}
        {kpi(L(fa, 'Win rate', 'نرخ برد'), `${fa ? (summary?.winRatePct ?? 0).toLocaleString('fa-IR') : (summary?.winRatePct ?? 0)}٪`)}
      </div>

      <div className="flex gap-1 rounded-lg bg-surface-2 border border-subtle p-1 w-fit mb-4">
        {([['kanban', 'Kanban', 'کانبان'], ['table', 'Table', 'جدول']] as const).map(([id, en, faL]) => (
          <button key={id} onClick={() => setView(id)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === id ? 'bg-brand text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            {L(fa, en, faL)}
          </button>
        ))}
      </div>

      {view === 'kanban' && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          {OPPORTUNITY_STAGES.map(stage => {
            const items = rows.filter(o => o.stage === stage)
            const weighted = items.reduce((s, o) => s + o.amount * o.probability / 100, 0)
            return (
              <div key={stage} {...dnd.zoneProps(stage)}
                className={`rounded-xl border p-2 min-h-[220px] transition-colors ${dnd.overZone === stage && dnd.dragId !== null ? 'bg-brand/10 border-brand' : 'bg-surface-2 border-subtle'}`}>
                <div className="px-1 mb-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-text-secondary">{stLabel(stage)}</p>
                    <span className="text-2xs text-text-tertiary tabular-nums">{fa ? items.length.toLocaleString('fa-IR') : items.length}</span>
                  </div>
                  {OPEN_STAGES.includes(stage) && items.length > 0 && (
                    <p className="text-3xs text-text-tertiary mt-0.5">{money(weighted)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map(o => (
                    <div key={o.id} {...dnd.dragHandlers(o.id, stage)}
                      className="rounded-lg bg-surface border border-border p-2.5 hover:border-brand/50 transition-colors">
                      <p className="text-xs font-semibold text-text-primary truncate">{o.title}</p>
                      {o.customerName && <p className="text-2xs text-text-tertiary truncate">{o.customerName}</p>}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-2xs text-text-secondary">{money(o.amount)}</span>
                        <span className="text-2xs text-text-tertiary tabular-nums">{fa ? o.probability.toLocaleString('fa-IR') : o.probability}٪</span>
                      </div>
                      {/* Touch-friendly fallback — the same reason the CRM board has one. */}
                      <select value={o.stage} onChange={e => move(o, e.target.value as OpportunityStage)}
                        aria-label={L(fa, 'Move to stage', 'انتقال به مرحله')}
                        className="form-input !py-0.5 !px-1 text-3xs w-full mt-1.5">
                        {OPPORTUNITY_STAGES.map(s => <option key={s} value={s}>{stLabel(s)}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'table' && (
        <DataTable<Opp>
          tableId="crm-opportunities" rows={rows} columns={columns} rowActions={rowActions}
          loading={loading} locale={fa ? 'fa' : 'en'} />
      )}

      {losses.length > 0 && (
        <Card className="p-4 mt-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Why we lose', 'چرا می‌بازیم')}</h3>
          <div className="space-y-2">
            {losses.map(l => (
              <div key={l.reason} className="flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2">
                <span className="text-text-secondary">{l.reason}</span>
                <span className="flex items-center gap-3">
                  <span className="text-text-tertiary text-xs">{fa ? l.count.toLocaleString('fa-IR') : l.count}×</span>
                  <span className="font-semibold text-text-primary">{money(l.value)}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)}
        title={editing.id ? L(fa, 'Edit opportunity', 'ویرایش فرصت') : L(fa, 'New opportunity', 'فرصت جدید')}>
        <div className="space-y-3">
          <Input label={L(fa, 'Title', 'عنوان')} value={editing.title} onChange={v => setEditing(e => ({ ...e, title: v }))} />
          <Select label={L(fa, 'Customer', 'مشتری')} value={editing.customerId}
            onChange={v => setEditing(e => ({ ...e, customerId: v }))}
            options={[{ value: '', label: L(fa, '— none —', '— بدون مشتری —') },
              ...customers.map(c => ({ value: String(c.id), label: c.name }))]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Amount', 'مبلغ')} type="number" value={editing.amount} onChange={v => setEditing(e => ({ ...e, amount: v }))} />
            <Input label={L(fa, 'Probability (%)', 'احتمال (٪)')} type="number" value={editing.probability} onChange={v => setEditing(e => ({ ...e, probability: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={L(fa, 'Stage', 'مرحله')} value={editing.stage}
              onChange={v => setEditing(e => ({ ...e, stage: v as OpportunityStage, probability: String(STAGE_DEFAULT_PROBABILITY[v as OpportunityStage]) }))}
              options={OPPORTUNITY_STAGES.map(s => ({ value: s, label: stLabel(s) }))} />
            <Input label={L(fa, 'Expected close', 'تاریخ تخمینی بستن')} value={editing.expectedCloseDate}
              onChange={v => setEditing(e => ({ ...e, expectedCloseDate: v }))} placeholder="1405-06-31" />
          </div>
          {editing.stage === 'lost' && (
            <Select label={L(fa, 'Loss reason (required)', 'دلیل باخت (الزامی)')} value={editing.outcomeReason}
              onChange={v => setEditing(e => ({ ...e, outcomeReason: v }))}
              options={[{ value: '', label: L(fa, '— select —', '— انتخاب کنید —') },
                ...reasons.map(r => ({ value: fa ? r.labelFa : r.labelEn, label: fa ? r.labelFa : r.labelEn }))]} />
          )}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn onClick={save} disabled={!editing.title.trim()}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!convertFor} onClose={() => setConvertFor(null)} title={L(fa, 'Convert to a sales document', 'تبدیل به سند فروش')}>
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            {L(fa,
              'A draft is created in Sales with this deal’s lines. Posting to the ledger stays a Sales decision.',
              'یک پیش‌نویس با اقلام همین فرصت در بخش فروش ساخته می‌شود. ثبت در دفتر همچنان تصمیم بخش فروش است.')}
          </p>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setConvertFor(null)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn variant="secondary" onClick={() => convert('quote')}>{L(fa, 'Quotation', 'پیش‌فاکتور')}</Btn>
            <Btn onClick={() => convert('invoice')}>{L(fa, 'Invoice', 'فاکتور')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
