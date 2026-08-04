'use client'

/**
 * Phase 27 بند۲ — the loyalty club workspace.
 *
 * The figure this screen leads with is the **outstanding liability**, not the
 * member count: points the company has promised are money it owes, and an
 * operator setting an earn rate should see that consequence immediately.
 *
 * The points ledger is read-only here by design. Corrections go through an
 * "adjust" movement, so the balance is always explainable from its history.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { deleteRowAction } from '@/lib/admin/rowDelete'
import { crud } from '@/lib/admin/crud'
import { formatDateTime } from '@/lib/admin/datetime'

const L = (fa: boolean, en: string, faText: string) => (fa ? faText : en)

interface Program {
  id: number; nameEn: string; nameFa: string; kind: string
  earnRate: number; redeemRate: number; pointsExpireDays: number | null; active: boolean
}
interface Tier { id: number; nameEn: string; nameFa: string; threshold: number; discountPct: number }
interface Coupon {
  id: number; code: string; kind: 'percent' | 'amount'; value: number
  minOrderTotal: number; maxRedemptions: number | null; maxPerCustomer: number
  validFrom: string | null; validUntil: string | null; active: boolean; redemptions: number
}
interface Overview {
  members: number; pointsOutstanding: number; liabilityValue: number
  tierDistribution: { tier: string; count: number }[]
  couponRedemptions: number; couponDiscount: number
}

type Tab = 'program' | 'tiers' | 'coupons'

const EMPTY_PROGRAM = { nameEn: '', nameFa: '', kind: 'hybrid', earnRate: '0.001', redeemRate: '10', pointsExpireDays: '' }
const EMPTY_TIER = { nameEn: '', nameFa: '', threshold: '', discountPct: '' }
const EMPTY_COUPON = { code: '', kind: 'percent' as 'percent' | 'amount', value: '', minOrderTotal: '', maxRedemptions: '', maxPerCustomer: '1', validUntil: '' }

export function LoyaltyManager() {
  const fa = useAdminLocale() === 'fa'
  const { money } = useDisplayCurrency()
  const { toast, ToastContainer } = useToast()

  const [tab, setTab] = useState<Tab>('program')
  const [programs, setPrograms] = useState<Program[]>([])
  const [tiers, setTiers] = useState<Tier[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Tab | null>(null)
  const [pForm, setPForm] = useState(EMPTY_PROGRAM)
  const [tForm, setTForm] = useState(EMPTY_TIER)
  const [cForm, setCForm] = useState(EMPTY_COUPON)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/crm/loyalty')
    if (r.ok) {
      const d = await r.json()
      setPrograms(d.programs ?? []); setTiers(d.tiers ?? [])
      setCoupons(d.coupons ?? []); setOverview(d.overview ?? null)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const activeProgram = programs.find(p => p.active) ?? programs[0] ?? null
  const num = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')

  async function post(body: object, ok: string) {
    const res = await fetch('/api/admin/crm/loyalty', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { toast(ok, 'success'); setModal(null); load() }
    else toast(await crud.errorOf(res, L(fa, 'Save failed', 'ذخیره نشد')), 'error')
  }

  async function runExpiry() {
    const res = await fetch('/api/admin/crm/loyalty', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'expire' }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      toast(L(fa, `${num(d.points ?? 0)} points expired across ${num(d.accounts ?? 0)} accounts`,
        `${num(d.points ?? 0)} امتیاز در ${num(d.accounts ?? 0)} حساب منقضی شد`), 'success')
      load()
    } else toast(await crud.errorOf(res, L(fa, 'Failed', 'ناموفق')), 'error')
  }

  const tierColumns: Column<Tier>[] = [
    { key: 'name', labelEn: 'Tier', labelFa: 'سطح', render: t => <span className="font-medium text-text-primary">{fa ? t.nameFa : t.nameEn}</span> },
    { key: 'threshold', labelEn: 'Threshold (points)', labelFa: 'آستانه (امتیاز)', numeric: true, render: t => <span className="tabular-nums text-text-secondary">{num(t.threshold)}</span> },
    { key: 'discountPct', labelEn: 'Discount', labelFa: 'تخفیف', numeric: true, render: t => <span className="tabular-nums text-text-secondary">{num(t.discountPct)}٪</span> },
  ]
  const tierActions: RowAction<Tier>[] = [
    deleteRowAction<Tier>({ path: '/api/admin/crm/loyalty', fa, toast, reload: load, labelOf: t => (fa ? t.nameFa : t.nameEn) }),
  ]

  const couponColumns: Column<Coupon>[] = [
    { key: 'code', labelEn: 'Code', labelFa: 'کد', render: c => <span className="font-mono text-brand" dir="ltr">{c.code}</span> },
    { key: 'value', labelEn: 'Value', labelFa: 'مقدار',
      render: c => <span className="text-text-secondary">{c.kind === 'percent' ? `${num(c.value)}٪` : money(c.value)}</span> },
    { key: 'minOrderTotal', labelEn: 'Minimum order', labelFa: 'حداقل سفارش', numeric: true, render: c => <span className="text-text-secondary">{money(c.minOrderTotal)}</span> },
    { key: 'redemptions', labelEn: 'Used', labelFa: 'استفاده‌شده', numeric: true,
      render: c => <span className="tabular-nums text-text-secondary">{num(c.redemptions)}{c.maxRedemptions ? ` / ${num(c.maxRedemptions)}` : ''}</span> },
    { key: 'validUntil', labelEn: 'Valid until', labelFa: 'اعتبار تا', render: c => <span className="text-2xs text-text-tertiary">{c.validUntil ? formatDateTime(c.validUntil, fa ? 'fa' : 'en') : '—'}</span> },
    { key: 'active', labelEn: 'Status', labelFa: 'وضعیت', render: c => <Badge color={c.active ? 'green' : 'slate'}>{c.active ? L(fa, 'Active', 'فعال') : L(fa, 'Inactive', 'غیرفعال')}</Badge> },
  ]
  const couponActions: RowAction<Coupon>[] = [
    deleteRowAction<Coupon>({ path: '/api/admin/crm/loyalty', fa, toast, reload: load, labelOf: c => c.code }),
  ]

  const kpi = (label: string, value: string, sub?: string, tone?: 'warn') => (
    <div className={`rounded-xl p-4 bg-surface-2 border ${tone === 'warn' ? 'border-warning/40' : 'border-subtle'}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-2xs text-text-tertiary mt-1">{sub}</p>}
    </div>
  )

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={L(fa, 'Loyalty Club', 'باشگاه مشتریان')}
        subtitle={L(fa,
          'Points are a liability, not decoration — every point is a discount you owe',
          'امتیاز یک بدهی است نه تزئین — هر امتیاز، تخفیفی است که بدهکارید')}
        action={<CurrencyPicker fa={fa} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpi(L(fa, 'Members', 'اعضا'), num(overview?.members ?? 0))}
        {kpi(L(fa, 'Points outstanding', 'امتیاز در گردش'), num(overview?.pointsOutstanding ?? 0))}
        {kpi(L(fa, 'Open liability', 'بدهی باز'), money(overview?.liabilityValue ?? 0),
          L(fa, 'points × redeem rate', 'امتیاز × نرخ تبدیل'), 'warn')}
        {kpi(L(fa, 'Coupon discount given', 'تخفیف کوپن'), money(overview?.couponDiscount ?? 0),
          L(fa, `${num(overview?.couponRedemptions ?? 0)} redemptions`, `${num(overview?.couponRedemptions ?? 0)} بار استفاده`))}
      </div>

      <div className="flex gap-1 mb-6 border-b border-subtle flex-wrap">
        {([['program', 'Programme', 'برنامه'], ['tiers', 'Tiers', 'سطوح'], ['coupons', 'Coupons', 'کوپن‌ها']] as const).map(([id, en, faL]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {L(fa, en, faL)}
          </button>
        ))}
      </div>

      {tab === 'program' && (
        <div className="space-y-4">
          {activeProgram ? (
            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-text-primary">{fa ? activeProgram.nameFa : activeProgram.nameEn}</h3>
                  <Badge color={activeProgram.active ? 'green' : 'slate'}>{activeProgram.kind}</Badge>
                </div>
                <Btn variant="secondary" onClick={runExpiry}>{L(fa, 'Run point expiry', 'اجرای انقضای امتیاز')}</Btn>
              </div>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div><p className="text-text-tertiary text-xs">{L(fa, 'Earn rate', 'نرخ کسب')}</p>
                  <p className="text-text-primary font-semibold">{activeProgram.earnRate}</p>
                  <p className="text-3xs text-text-tertiary">{L(fa, 'points per 1 unit of invoice value', 'امتیاز به‌ازای هر ۱ واحد مبلغ فاکتور')}</p></div>
                <div><p className="text-text-tertiary text-xs">{L(fa, 'Redeem rate', 'نرخ تبدیل')}</p>
                  <p className="text-text-primary font-semibold">{money(activeProgram.redeemRate)}</p>
                  <p className="text-3xs text-text-tertiary">{L(fa, 'value of one point', 'ارزش هر امتیاز')}</p></div>
                <div><p className="text-text-tertiary text-xs">{L(fa, 'Point expiry', 'انقضای امتیاز')}</p>
                  <p className="text-text-primary font-semibold">{activeProgram.pointsExpireDays ? L(fa, `${num(activeProgram.pointsExpireDays)} days`, `${num(activeProgram.pointsExpireDays)} روز`) : L(fa, 'Never', 'بدون انقضا')}</p></div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-sm text-text-tertiary mb-4">{L(fa, 'No loyalty programme yet.', 'هنوز برنامهٔ وفاداری تعریف نشده است.')}</p>
              <Btn onClick={() => setModal('program')}>{L(fa, 'Create a programme', 'ساخت برنامه')}</Btn>
            </Card>
          )}
          {activeProgram && <Btn variant="ghost" onClick={() => setModal('program')}>{L(fa, 'New programme', 'برنامهٔ جدید')}</Btn>}
        </div>
      )}

      {tab === 'tiers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Btn onClick={() => setModal('tiers')} disabled={!activeProgram}>{L(fa, 'New tier', 'سطح جدید')}</Btn>
          </div>
          <DataTable<Tier> tableId="loyalty-tiers" rows={tiers} columns={tierColumns}
            rowActions={tierActions} loading={loading} locale={fa ? 'fa' : 'en'} />
          {overview && overview.tierDistribution.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Members per tier', 'توزیع اعضا در سطوح')}</h3>
              <div className="flex flex-wrap gap-2">
                {overview.tierDistribution.map(t => (
                  <span key={t.tier} className="inline-flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-sm">
                    <span className="text-text-secondary">{t.tier}</span>
                    <span className="text-text-primary font-semibold tabular-nums">{num(t.count)}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'coupons' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Btn onClick={() => setModal('coupons')}>{L(fa, 'New coupon', 'کوپن جدید')}</Btn>
          </div>
          <DataTable<Coupon> tableId="loyalty-coupons" rows={coupons} columns={couponColumns}
            rowActions={couponActions} loading={loading} locale={fa ? 'fa' : 'en'} />
        </div>
      )}

      {/* ── programme ── */}
      <Modal open={modal === 'program'} onClose={() => setModal(null)} title={L(fa, 'Loyalty programme', 'برنامهٔ وفاداری')}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Name (English)', 'نام (انگلیسی)')} value={pForm.nameEn} onChange={v => setPForm(f => ({ ...f, nameEn: v }))} />
            <Input label={L(fa, 'Name (Persian)', 'نام (فارسی)')} value={pForm.nameFa} onChange={v => setPForm(f => ({ ...f, nameFa: v }))} />
          </div>
          <Select label={L(fa, 'Type', 'نوع')} value={pForm.kind} onChange={v => setPForm(f => ({ ...f, kind: v }))}
            options={[
              { value: 'points', label: L(fa, 'Points', 'امتیازی') },
              { value: 'tier', label: L(fa, 'Tiers', 'سطحی') },
              { value: 'hybrid', label: L(fa, 'Points + tiers', 'ترکیبی') },
            ]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Earn rate', 'نرخ کسب')} type="number" value={pForm.earnRate} onChange={v => setPForm(f => ({ ...f, earnRate: v }))} />
            <Input label={L(fa, 'Redeem rate', 'نرخ تبدیل')} type="number" value={pForm.redeemRate} onChange={v => setPForm(f => ({ ...f, redeemRate: v }))} />
          </div>
          <Input label={L(fa, 'Point expiry in days (blank = never)', 'انقضای امتیاز به روز (خالی = بدون انقضا)')} type="number"
            value={pForm.pointsExpireDays} onChange={v => setPForm(f => ({ ...f, pointsExpireDays: v }))} />
          <p className="text-2xs text-text-tertiary">
            {L(fa,
              'Earn rate × invoice total = points granted. Points × redeem rate = the discount you owe.',
              'نرخ کسب × مبلغ فاکتور = امتیاز اعطایی. امتیاز × نرخ تبدیل = تخفیفی که بدهکار می‌شوید.')}
          </p>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!pForm.nameEn.trim() || !pForm.nameFa.trim()}
              onClick={() => post({
                nameEn: pForm.nameEn, nameFa: pForm.nameFa, kind: pForm.kind,
                earnRate: Number(pForm.earnRate), redeemRate: Number(pForm.redeemRate),
                pointsExpireDays: pForm.pointsExpireDays ? Number(pForm.pointsExpireDays) : null,
              }, L(fa, 'Programme created', 'برنامه ساخته شد'))}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── tier ── */}
      <Modal open={modal === 'tiers'} onClose={() => setModal(null)} title={L(fa, 'Loyalty tier', 'سطح وفاداری')}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Name (English)', 'نام (انگلیسی)')} value={tForm.nameEn} onChange={v => setTForm(f => ({ ...f, nameEn: v }))} />
            <Input label={L(fa, 'Name (Persian)', 'نام (فارسی)')} value={tForm.nameFa} onChange={v => setTForm(f => ({ ...f, nameFa: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Threshold (points)', 'آستانه (امتیاز)')} type="number" value={tForm.threshold} onChange={v => setTForm(f => ({ ...f, threshold: v }))} />
            <Input label={L(fa, 'Discount (%)', 'تخفیف (٪)')} type="number" value={tForm.discountPct} onChange={v => setTForm(f => ({ ...f, discountPct: v }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!activeProgram || !tForm.nameEn.trim()}
              onClick={() => post({
                entity: 'tier', programId: activeProgram!.id, nameEn: tForm.nameEn, nameFa: tForm.nameFa,
                threshold: Number(tForm.threshold || 0), discountPct: Number(tForm.discountPct || 0),
              }, L(fa, 'Tier created', 'سطح ساخته شد'))}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── coupon ── */}
      <Modal open={modal === 'coupons'} onClose={() => setModal(null)} title={L(fa, 'Coupon', 'کوپن تخفیف')}>
        <div className="space-y-3">
          <Input label={L(fa, 'Code', 'کد')} value={cForm.code} onChange={v => setCForm(f => ({ ...f, code: v.toUpperCase() }))} placeholder="NOWRUZ1405" />
          <div className="grid grid-cols-2 gap-3">
            <Select label={L(fa, 'Type', 'نوع')} value={cForm.kind} onChange={v => setCForm(f => ({ ...f, kind: v as 'percent' | 'amount' }))}
              options={[{ value: 'percent', label: L(fa, 'Percentage', 'درصدی') }, { value: 'amount', label: L(fa, 'Fixed amount', 'مبلغ ثابت') }]} />
            <Input label={L(fa, 'Value', 'مقدار')} type="number" value={cForm.value} onChange={v => setCForm(f => ({ ...f, value: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Minimum order', 'حداقل سفارش')} type="number" value={cForm.minOrderTotal} onChange={v => setCForm(f => ({ ...f, minOrderTotal: v }))} />
            <Input label={L(fa, 'Max uses per customer', 'سقف استفاده هر مشتری')} type="number" value={cForm.maxPerCustomer} onChange={v => setCForm(f => ({ ...f, maxPerCustomer: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Total usage limit (blank = unlimited)', 'سقف کل (خالی = نامحدود)')} type="number" value={cForm.maxRedemptions} onChange={v => setCForm(f => ({ ...f, maxRedemptions: v }))} />
            <Input label={L(fa, 'Valid until', 'اعتبار تا')} value={cForm.validUntil} onChange={v => setCForm(f => ({ ...f, validUntil: v }))} placeholder="2026-12-31" />
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setModal(null)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!cForm.code.trim()}
              onClick={() => post({
                entity: 'coupon', code: cForm.code, kind: cForm.kind, value: Number(cForm.value || 0),
                minOrderTotal: Number(cForm.minOrderTotal || 0),
                maxRedemptions: cForm.maxRedemptions ? Number(cForm.maxRedemptions) : null,
                maxPerCustomer: Number(cForm.maxPerCustomer || 1),
                validUntil: cForm.validUntil || null,
              }, L(fa, 'Coupon created', 'کوپن ساخته شد'))}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
