'use client'

/**
 * Phase 28.2 — leave, attendance, overtime and missions.
 *
 * The screen is built around one idea the operator has to be able to see: the
 * balance is a LEDGER. Every movement — accrual, use, a cancellation reversal,
 * a manual correction — is a visible row, so a number that looks wrong can
 * always be explained instead of argued about.
 *
 * A cancelled leave therefore shows BOTH the original use and the reversal;
 * that is deliberate, not a duplicate.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { crud } from '@/lib/admin/crud'
import { toJalaliStr } from '@/lib/erp/jalali'
import {
  LEAVE_STATUS_LABELS, OVERTIME_KINDS, OVERTIME_LABELS,
  type LeaveRequestStatus, type OvertimeKind,
} from '@/lib/hr/leave'

const L = (fa: boolean, en: string, faText: string) => (fa ? faText : en)

interface LeaveType {
  id: number; code: string; nameEn: string; nameFa: string
  paid: boolean; accrualPerMonth: number; maxDaysPerYear: number | null; deductsBalance: boolean
}
interface RequestRow {
  id: number; employeeId: number; employeeName: string; leaveTypeId: number
  leaveTypeNameFa: string; leaveTypeNameEn: string
  startDate: string; endDate: string; days: number
  status: LeaveRequestStatus; reason: string | null; createdAt: string
}
interface LedgerRow {
  id: number; kind: string; days: number; note: string | null; createdAt: string
}
interface BalanceRow {
  type: LeaveType; balance: number; accrued: number; used: number
}
interface HolidayRow { id: number; date: string; titleFa: string; titleEn: string | null; kind: string }
interface MissionRow {
  id: number; employeeId: number; employeeName: string
  startDate: string; endDate: string; destination: string; estimatedCost: number; status: string
}
interface EmployeeLite { id: number; fullName: string }

type Tab = 'requests' | 'balances' | 'attendance' | 'missions' | 'holidays'

const TABS: { id: Tab; en: string; fa: string }[] = [
  { id: 'requests', en: 'Leave requests', fa: 'درخواست‌های مرخصی' },
  { id: 'balances', en: 'Balances & ledger', fa: 'مانده و دفتر مرخصی' },
  { id: 'attendance', en: 'Attendance', fa: 'حضور و غیاب' },
  { id: 'missions', en: 'Missions', fa: 'مأموریت‌ها' },
  { id: 'holidays', en: 'Holidays', fa: 'تعطیلات رسمی' },
]

const LEDGER_KIND_LABELS: Record<string, { en: string; fa: string }> = {
  accrual:    { en: 'Accrual',    fa: 'تعلق ماهانه' },
  use:        { en: 'Used',       fa: 'استفاده' },
  carry_over: { en: 'Carry over', fa: 'انتقال از سال قبل' },
  payout:     { en: 'Paid out',   fa: 'بازخرید' },
  adjust:     { en: 'Correction', fa: 'اصلاح دستی' },
  reversal:   { en: 'Reversal',   fa: 'برگشت (ابطال مرخصی)' },
}

const EMPTY_REQ = { employeeId: '', leaveTypeId: '', startDate: '', endDate: '', halfDay: false, reason: '' }
const EMPTY_ATT = { employeeId: '', date: '', checkIn: '', checkOut: '', note: '' }
const EMPTY_OT = { employeeId: '', date: '', hours: '', kind: 'normal' as OvertimeKind, note: '' }
const EMPTY_MISSION = { employeeId: '', startDate: '', endDate: '', destination: '', purpose: '', estimatedCost: '' }
const EMPTY_HOLIDAY = { date: '', titleFa: '', titleEn: '', kind: 'public' }

export function LeaveManager() {
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()

  const [tab, setTab] = useState<Tab>('requests')
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [types, setTypes] = useState<LeaveType[]>([])
  const [overview, setOverview] = useState<{ pendingRequests: number; onLeaveToday: number; pendingOvertime: number; upcomingHolidays: number } | null>(null)
  const [employees, setEmployees] = useState<EmployeeLite[]>([])

  const [selEmployee, setSelEmployee] = useState('')
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [period, setPeriod] = useState({ from: '', to: '' })
  const [timesheet, setTimesheet] = useState<{ expectedWorkingDays: number; presentDays: number; leaveDays: number; totalLateMinutes: number; workedHours: number; overtimeHours: number; attendance: { id: number; date: string; checkIn: string | null; checkOut: string | null; workedMinutes: number; lateMinutes: number }[] } | null>(null)
  const [holidays, setHolidays] = useState<HolidayRow[]>([])
  const [missions, setMissions] = useState<MissionRow[]>([])

  const [reqModal, setReqModal] = useState(false)
  const [reqForm, setReqForm] = useState(EMPTY_REQ)
  const [attModal, setAttModal] = useState(false)
  const [attForm, setAttForm] = useState(EMPTY_ATT)
  const [otModal, setOtModal] = useState(false)
  const [otForm, setOtForm] = useState(EMPTY_OT)
  const [misModal, setMisModal] = useState(false)
  const [misForm, setMisForm] = useState(EMPTY_MISSION)
  const [holModal, setHolModal] = useState(false)
  const [holForm, setHolForm] = useState(EMPTY_HOLIDAY)

  const jdate = (iso: string | null) => (iso ? (fa ? toJalaliStr(iso) : iso) : '—')
  const num = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/hr/leave')
    if (r.ok) {
      const d = await r.json()
      setRequests(d.requests ?? [])
      setTypes(d.types ?? [])
      setOverview(d.overview ?? null)
    }
    const e = await fetch('/api/admin/hr/employees')
    if (e.ok) setEmployees(((await e.json()).employees ?? []) as EmployeeLite[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const loadBalances = useCallback(async (empId: string) => {
    if (!empId) { setBalances([]); setLedger([]); return }
    const r = await fetch(`/api/admin/hr/leave?view=balances&employeeId=${empId}`)
    if (r.ok) { const d = await r.json(); setBalances(d.balances ?? []); setLedger(d.ledger ?? []) }
  }, [])

  const loadAttendance = useCallback(async () => {
    if (!selEmployee || !period.from || !period.to) return
    const r = await fetch(`/api/admin/hr/leave?view=attendance&employeeId=${selEmployee}&from=${period.from}&to=${period.to}`)
    if (r.ok) setTimesheet((await r.json()).timesheet ?? null)
  }, [selEmployee, period])

  const loadHolidays = useCallback(async () => {
    const r = await fetch('/api/admin/hr/leave?view=holidays')
    if (r.ok) setHolidays((await r.json()).holidays ?? [])
  }, [])

  const loadMissions = useCallback(async () => {
    const r = await fetch('/api/admin/hr/leave?view=missions')
    if (r.ok) setMissions((await r.json()).missions ?? [])
  }, [])

  useEffect(() => {
    if (tab === 'holidays') loadHolidays()
    if (tab === 'missions') loadMissions()
  }, [tab, loadHolidays, loadMissions])

  async function post(body: Record<string, unknown>, okEn: string, okFa: string, after?: () => void) {
    const res = await fetch('/api/admin/hr/leave', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { toast(L(fa, okEn, okFa), 'success'); after?.() }
    else toast(await crud.errorOf(res, L(fa, 'Failed', 'ناموفق')), 'error')
    return res.ok
  }

  const decide = (id: number, action: 'approve' | 'reject' | 'cancel') =>
    post({ action, id },
      action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Cancelled — the days were returned',
      action === 'approve' ? 'تأیید شد' : action === 'reject' ? 'رد شد' : 'ابطال شد — روزها به مانده بازگشت',
      () => { load(); if (selEmployee) loadBalances(selEmployee) })

  // ── columns ───────────────────────────────────────────────────────────────
  const reqColumns: Column<RequestRow>[] = [
    { key: 'employeeName', labelEn: 'Employee', labelFa: 'کارمند',
      render: r => <span className="font-medium text-text-primary">{r.employeeName}</span> },
    { key: 'leaveTypeNameFa', labelEn: 'Leave type', labelFa: 'نوع مرخصی',
      render: r => <span className="text-text-secondary">{fa ? r.leaveTypeNameFa : r.leaveTypeNameEn}</span> },
    { key: 'startDate', labelEn: 'From', labelFa: 'از تاریخ', render: r => <span className="text-xs">{jdate(r.startDate)}</span> },
    { key: 'endDate', labelEn: 'To', labelFa: 'تا تاریخ', render: r => <span className="text-xs">{jdate(r.endDate)}</span> },
    { key: 'days', labelEn: 'Working days', labelFa: 'روز کاری', numeric: true,
      render: r => <span className="tabular-nums font-semibold text-text-primary">{num(r.days)}</span> },
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum',
      render: r => <Badge color={r.status === 'approved' ? 'green' : r.status === 'pending' ? 'yellow'
        : r.status === 'rejected' ? 'red' : 'slate'}>
        {fa ? LEAVE_STATUS_LABELS[r.status].fa : LEAVE_STATUS_LABELS[r.status].en}</Badge> },
    { key: 'reason', labelEn: 'Reason', labelFa: 'دلیل',
      render: r => <span className="text-xs text-text-tertiary">{r.reason ?? '—'}</span> },
  ]

  const reqActions: RowAction<RequestRow>[] = [
    { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓',
      hidden: r => r.status !== 'pending', onClick: r => decide(r.id, 'approve') },
    { id: 'reject', labelEn: 'Reject', labelFa: 'رد', icon: '✕',
      hidden: r => r.status !== 'pending', onClick: r => decide(r.id, 'reject') },
    // Cancelling an APPROVED leave is what posts the reversal — the reason the
    // balance is a ledger in the first place.
    { id: 'cancel', labelEn: 'Cancel (return the days)', labelFa: 'ابطال (بازگشت روزها)', icon: '↩',
      hidden: r => r.status !== 'approved', onClick: r => decide(r.id, 'cancel') },
  ]

  const holColumns: Column<HolidayRow>[] = [
    { key: 'date', labelEn: 'Date', labelFa: 'تاریخ', render: h => <span className="text-sm">{jdate(h.date)}</span> },
    { key: 'titleFa', labelEn: 'Title', labelFa: 'مناسبت',
      render: h => <span className="text-text-primary">{fa ? h.titleFa : (h.titleEn || h.titleFa)}</span> },
    { key: 'kind', labelEn: 'Kind', labelFa: 'نوع',
      render: h => <Badge color={h.kind === 'company' ? 'blue' : 'slate'}>
        {h.kind === 'company' ? L(fa, 'Company', 'سازمانی') : h.kind === 'religious' ? L(fa, 'Religious', 'مذهبی') : L(fa, 'Public', 'رسمی')}</Badge> },
  ]

  const holActions: RowAction<HolidayRow>[] = [
    { id: 'del', labelEn: 'Delete', labelFa: 'حذف', icon: '🗑', danger: true,
      onClick: async h => {
        const res = await fetch('/api/admin/hr/leave', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: h.id, kind: 'holiday' }),
        })
        if (res.ok) { toast(L(fa, 'Deleted', 'حذف شد'), 'success'); loadHolidays() }
        else toast(await crud.errorOf(res, L(fa, 'Delete failed', 'حذف نشد')), 'error')
      } },
  ]

  const misColumns: Column<MissionRow>[] = [
    { key: 'employeeName', labelEn: 'Employee', labelFa: 'کارمند' },
    { key: 'destination', labelEn: 'Destination', labelFa: 'مقصد' },
    { key: 'startDate', labelEn: 'From', labelFa: 'از تاریخ', render: m => <span className="text-xs">{jdate(m.startDate)}</span> },
    { key: 'endDate', labelEn: 'To', labelFa: 'تا تاریخ', render: m => <span className="text-xs">{jdate(m.endDate)}</span> },
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
      render: m => <Badge color={m.status === 'approved' ? 'green' : 'yellow'}>
        {m.status === 'approved' ? L(fa, 'Approved', 'تأییدشده') : L(fa, 'Pending', 'در انتظار')}</Badge> },
  ]

  const kpi = (label: string, value: string, tone?: 'ok' | 'warn') => (
    <div className={`rounded-xl p-4 bg-surface-2 border ${tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : 'border-subtle'}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )

  const employeeOptions = [{ value: '', label: L(fa, 'Select an employee…', 'یک کارمند انتخاب کنید…') },
    ...employees.map(e => ({ value: String(e.id), label: e.fullName }))]

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={L(fa, 'Leave & Attendance', 'مرخصی و حضور و غیاب')}
        subtitle={L(fa,
          'Working days come from the editable calendar; the balance is a ledger, so every day can be explained',
          'روزهای کاری از تقویم قابل ویرایش خوانده می‌شوند و مانده یک دفتر است — پس هر روز قابل توضیح است')}
        action={<div className="flex items-center gap-2">
          <Btn onClick={() => { setReqForm(EMPTY_REQ); setReqModal(true) }}>{L(fa, 'New request', 'درخواست جدید')}</Btn>
        </div>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpi(L(fa, 'Pending requests', 'در انتظار تأیید'), num(overview?.pendingRequests ?? 0), 'warn')}
        {kpi(L(fa, 'On leave today', 'امروز در مرخصی'), num(overview?.onLeaveToday ?? 0), 'ok')}
        {kpi(L(fa, 'Overtime awaiting approval', 'اضافه‌کار در انتظار تأیید'), num(overview?.pendingOvertime ?? 0))}
        {kpi(L(fa, 'Upcoming holidays', 'تعطیلات پیش‌رو'), num(overview?.upcomingHolidays ?? 0))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t.id
              ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:text-text-primary'}`}>
            {fa ? t.fa : t.en}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <DataTable<RequestRow>
          tableId="hr-leave-requests" rows={requests} columns={reqColumns} rowActions={reqActions}
          loading={loading} locale={fa ? 'fa' : 'en'} />
      )}

      {tab === 'balances' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid md:grid-cols-3 gap-3 items-end">
              <Select label={L(fa, 'Employee', 'کارمند')} value={selEmployee}
                onChange={v => { setSelEmployee(v); loadBalances(v) }} options={employeeOptions} />
              <div className="md:col-span-2 flex gap-2">
                <Btn variant="ghost" onClick={async () => {
                  const p = new Date().toISOString().slice(0, 7)
                  await post({ action: 'accrue', period: p },
                    'Monthly accrual posted', 'تعلق ماهانه ثبت شد',
                    () => selEmployee && loadBalances(selEmployee))
                }}>{L(fa, 'Run this month’s accrual', 'اجرای تعلق این ماه')}</Btn>
              </div>
            </div>
            <p className="text-2xs text-text-tertiary mt-2">
              {L(fa,
                'Accrual is idempotent per month — running it twice grants the days once.',
                'تعلق ماهانه idempotent است — اجرای دوباره برای همان ماه، روزها را دوبار نمی‌دهد.')}
            </p>
          </Card>

          {!selEmployee ? (
            <Card className="p-8 text-center text-sm text-text-tertiary">
              {L(fa, 'Choose an employee to see their balance and ledger.', 'برای دیدن مانده و دفتر مرخصی، یک کارمند انتخاب کنید.')}
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {balances.map(b => (
                  <Card key={b.type.id} className="p-4">
                    <p className="text-xs text-text-tertiary">{fa ? b.type.nameFa : b.type.nameEn}</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">{num(b.balance)}</p>
                    <p className="text-2xs text-text-tertiary mt-1">
                      {L(fa, `accrued ${num(b.accrued)} · used ${num(b.used)}`,
                        `تعلق‌گرفته ${num(b.accrued)} · استفاده‌شده ${num(b.used)}`)}
                    </p>
                    {!b.type.deductsBalance && (
                      <p className="text-2xs text-text-tertiary mt-1">
                        {L(fa, 'Does not consume a balance', 'از مانده کسر نمی‌شود')}
                      </p>
                    )}
                  </Card>
                ))}
              </div>

              <Card className="p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-1">{L(fa, 'Leave ledger', 'دفتر مرخصی')}</h3>
                <p className="text-2xs text-text-tertiary mb-3">
                  {L(fa,
                    'Every movement is a row. A cancelled leave shows both the original use and its reversal — that is the audit trail, not a duplicate.',
                    'هر جابه‌جایی یک سطر است. مرخصی ابطال‌شده هم سطر استفاده و هم سطر برگشت را نشان می‌دهد — این ردّ حسابرسی است، نه سطر تکراری.')}
                </p>
                {ledger.length === 0 ? (
                  <p className="text-sm text-text-tertiary text-center py-4">{L(fa, 'No movement yet.', 'هنوز جابه‌جایی ثبت نشده است.')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {ledger.map(t => (
                      <li key={t.id} className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2">
                        <div>
                          <span className="text-sm text-text-primary">
                            {fa ? (LEDGER_KIND_LABELS[t.kind]?.fa ?? t.kind) : (LEDGER_KIND_LABELS[t.kind]?.en ?? t.kind)}
                          </span>
                          {t.note && <span className="text-2xs text-text-tertiary ms-2">{t.note}</span>}
                        </div>
                        <span className={`tabular-nums font-semibold ${t.days < 0 ? 'text-danger' : 'text-success'}`}>
                          {t.days > 0 ? '+' : ''}{num(t.days)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <Select label={L(fa, 'Employee', 'کارمند')} value={selEmployee}
                onChange={setSelEmployee} options={employeeOptions} />
              <Input label={L(fa, 'From', 'از تاریخ')} value={period.from}
                onChange={v => setPeriod(p => ({ ...p, from: v }))} placeholder="2026-08-01" />
              <Input label={L(fa, 'To', 'تا تاریخ')} value={period.to}
                onChange={v => setPeriod(p => ({ ...p, to: v }))} placeholder="2026-08-31" />
              <div className="flex gap-2">
                <Btn onClick={loadAttendance} disabled={!selEmployee || !period.from || !period.to}>
                  {L(fa, 'Show', 'نمایش')}</Btn>
                <Btn variant="ghost" onClick={() => { setAttForm(EMPTY_ATT); setAttModal(true) }}>
                  {L(fa, 'Record', 'ثبت')}</Btn>
                <Btn variant="ghost" onClick={() => { setOtForm(EMPTY_OT); setOtModal(true) }}>
                  {L(fa, 'Overtime', 'اضافه‌کار')}</Btn>
              </div>
            </div>
          </Card>

          {timesheet && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {kpi(L(fa, 'Expected working days', 'روزهای کاری مورد انتظار'), num(timesheet.expectedWorkingDays))}
                {kpi(L(fa, 'Present days', 'روزهای حضور'), num(timesheet.presentDays), 'ok')}
                {kpi(L(fa, 'Leave days', 'روزهای مرخصی'), num(timesheet.leaveDays))}
                {kpi(L(fa, 'Late (minutes)', 'تأخیر (دقیقه)'), num(timesheet.totalLateMinutes), 'warn')}
                {kpi(L(fa, 'Overtime hours', 'ساعات اضافه‌کار'), num(timesheet.overtimeHours))}
              </div>
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">{L(fa, 'Daily attendance', 'حضور روزانه')}</h3>
                {timesheet.attendance.length === 0 ? (
                  <p className="text-sm text-text-tertiary text-center py-4">{L(fa, 'Nothing recorded in this period.', 'در این بازه چیزی ثبت نشده است.')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {timesheet.attendance.map(a => (
                      <li key={a.id} className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2 text-sm">
                        <span className="text-text-primary">{jdate(a.date)}</span>
                        <span className="font-mono text-text-secondary" dir="ltr">{a.checkIn ?? '—'} → {a.checkOut ?? '—'}</span>
                        <span className="tabular-nums text-text-secondary">
                          {L(fa, `${num(Math.round(a.workedMinutes / 6) / 10)} h`, `${num(Math.round(a.workedMinutes / 6) / 10)} ساعت`)}
                        </span>
                        {a.lateMinutes > 0 && <Badge color="yellow">{L(fa, `${num(a.lateMinutes)} min late`, `${num(a.lateMinutes)} دقیقه تأخیر`)}</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'missions' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Btn onClick={() => { setMisForm(EMPTY_MISSION); setMisModal(true) }}>{L(fa, 'New mission', 'مأموریت جدید')}</Btn>
          </div>
          <DataTable<MissionRow> tableId="hr-missions" rows={missions} columns={misColumns} locale={fa ? 'fa' : 'en'} />
        </div>
      )}

      {tab === 'holidays' && (
        <div className="space-y-4">
          <Card className="p-4 flex items-start justify-between gap-4">
            <p className="text-sm text-text-secondary">
              {L(fa,
                'Iranian public holidays move every year, so they are data you maintain here — not a hardcoded list. Every leave calculation reads this table.',
                'تعطیلات رسمی ایران هر سال جابه‌جا می‌شوند، پس داده‌ای هستند که همین‌جا نگه‌داری می‌کنید — نه فهرستی ثابت در کد. همهٔ محاسبات مرخصی از همین جدول خوانده می‌شوند.')}
            </p>
            <Btn onClick={() => { setHolForm(EMPTY_HOLIDAY); setHolModal(true) }}>{L(fa, 'Add holiday', 'افزودن تعطیلی')}</Btn>
          </Card>
          <DataTable<HolidayRow> tableId="hr-holidays" rows={holidays} columns={holColumns}
            rowActions={holActions} locale={fa ? 'fa' : 'en'} />
        </div>
      )}

      {/* ── new leave request ── */}
      <Modal open={reqModal} onClose={() => setReqModal(false)} title={L(fa, 'New leave request', 'درخواست مرخصی جدید')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Employee', 'کارمند')} value={reqForm.employeeId}
            onChange={v => setReqForm(f => ({ ...f, employeeId: v }))} options={employeeOptions} />
          <Select label={L(fa, 'Leave type', 'نوع مرخصی')} value={reqForm.leaveTypeId}
            onChange={v => setReqForm(f => ({ ...f, leaveTypeId: v }))}
            options={[{ value: '', label: '—' }, ...types.map(t => ({ value: String(t.id), label: fa ? t.nameFa : t.nameEn }))]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'From', 'از تاریخ')} value={reqForm.startDate}
              onChange={v => setReqForm(f => ({ ...f, startDate: v }))} placeholder="2026-08-01" />
            <Input label={L(fa, 'To', 'تا تاریخ')} value={reqForm.endDate}
              onChange={v => setReqForm(f => ({ ...f, endDate: v }))} placeholder="2026-08-05" />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={reqForm.halfDay}
              onChange={e => setReqForm(f => ({ ...f, halfDay: e.target.checked }))} />
            {L(fa, 'Half day (single-day requests only)', 'نیم‌روز (فقط برای درخواست یک‌روزه)')}
          </label>
          <Input label={L(fa, 'Reason', 'دلیل')} value={reqForm.reason}
            onChange={v => setReqForm(f => ({ ...f, reason: v }))} />
          <p className="text-2xs text-text-tertiary">
            {L(fa,
              'The number of days is calculated from the working calendar — holidays and rest days are not deducted from the balance.',
              'تعداد روز از تقویم کاری محاسبه می‌شود — تعطیلات و روزهای استراحت از مانده کسر نمی‌شوند.')}
          </p>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setReqModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!reqForm.employeeId || !reqForm.leaveTypeId || !reqForm.startDate || !reqForm.endDate}
              onClick={async () => {
                const ok = await post({
                  action: 'request', employeeId: Number(reqForm.employeeId),
                  leaveTypeId: Number(reqForm.leaveTypeId),
                  startDate: reqForm.startDate, endDate: reqForm.endDate,
                  halfDay: reqForm.halfDay, reason: reqForm.reason || null,
                }, 'Request submitted', 'درخواست ثبت شد', load)
                if (ok) { setReqModal(false); setReqForm(EMPTY_REQ) }
              }}>{L(fa, 'Submit', 'ثبت')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── attendance ── */}
      <Modal open={attModal} onClose={() => setAttModal(false)} title={L(fa, 'Record attendance', 'ثبت حضور و غیاب')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Employee', 'کارمند')} value={attForm.employeeId}
            onChange={v => setAttForm(f => ({ ...f, employeeId: v }))} options={employeeOptions} />
          <Input label={L(fa, 'Date', 'تاریخ')} value={attForm.date}
            onChange={v => setAttForm(f => ({ ...f, date: v }))} placeholder="2026-08-01" />
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Check in', 'ورود')} value={attForm.checkIn}
              onChange={v => setAttForm(f => ({ ...f, checkIn: v }))} placeholder="08:00" />
            <Input label={L(fa, 'Check out', 'خروج')} value={attForm.checkOut}
              onChange={v => setAttForm(f => ({ ...f, checkOut: v }))} placeholder="17:00" />
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setAttModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!attForm.employeeId || !attForm.date} onClick={async () => {
              const ok = await post({
                action: 'attendance', employeeId: Number(attForm.employeeId), date: attForm.date,
                checkIn: attForm.checkIn || null, checkOut: attForm.checkOut || null,
                note: attForm.note || null,
              }, 'Recorded', 'ثبت شد', loadAttendance)
              if (ok) setAttModal(false)
            }}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── overtime ── */}
      <Modal open={otModal} onClose={() => setOtModal(false)} title={L(fa, 'Record overtime', 'ثبت اضافه‌کار')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Employee', 'کارمند')} value={otForm.employeeId}
            onChange={v => setOtForm(f => ({ ...f, employeeId: v }))} options={employeeOptions} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Date', 'تاریخ')} value={otForm.date}
              onChange={v => setOtForm(f => ({ ...f, date: v }))} placeholder="2026-08-01" />
            <Input label={L(fa, 'Hours', 'ساعت')} type="number" value={otForm.hours}
              onChange={v => setOtForm(f => ({ ...f, hours: v }))} />
          </div>
          <Select label={L(fa, 'Kind', 'نوع')} value={otForm.kind}
            onChange={v => setOtForm(f => ({ ...f, kind: v as OvertimeKind }))}
            options={OVERTIME_KINDS.map(k => ({ value: k, label: fa ? OVERTIME_LABELS[k].fa : OVERTIME_LABELS[k].en }))} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setOtModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!otForm.employeeId || !otForm.date || !otForm.hours} onClick={async () => {
              const ok = await post({
                action: 'overtime', employeeId: Number(otForm.employeeId), date: otForm.date,
                hours: Number(otForm.hours), kind: otForm.kind, note: otForm.note || null,
              }, 'Overtime recorded', 'اضافه‌کار ثبت شد', load)
              if (ok) setOtModal(false)
            }}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── mission ── */}
      <Modal open={misModal} onClose={() => setMisModal(false)} title={L(fa, 'New mission', 'مأموریت جدید')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Employee', 'کارمند')} value={misForm.employeeId}
            onChange={v => setMisForm(f => ({ ...f, employeeId: v }))} options={employeeOptions} />
          <Input label={L(fa, 'Destination', 'مقصد')} value={misForm.destination}
            onChange={v => setMisForm(f => ({ ...f, destination: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'From', 'از تاریخ')} value={misForm.startDate}
              onChange={v => setMisForm(f => ({ ...f, startDate: v }))} placeholder="2026-08-01" />
            <Input label={L(fa, 'To', 'تا تاریخ')} value={misForm.endDate}
              onChange={v => setMisForm(f => ({ ...f, endDate: v }))} placeholder="2026-08-03" />
          </div>
          <Input label={L(fa, 'Purpose', 'موضوع')} value={misForm.purpose}
            onChange={v => setMisForm(f => ({ ...f, purpose: v }))} />
          <Input label={L(fa, 'Estimated cost', 'هزینهٔ برآوردی')} type="number" value={misForm.estimatedCost}
            onChange={v => setMisForm(f => ({ ...f, estimatedCost: v }))} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setMisModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!misForm.employeeId || !misForm.destination || !misForm.startDate || !misForm.endDate}
              onClick={async () => {
                const ok = await post({
                  action: 'mission', employeeId: Number(misForm.employeeId),
                  startDate: misForm.startDate, endDate: misForm.endDate,
                  destination: misForm.destination, purpose: misForm.purpose || null,
                  estimatedCost: Number(misForm.estimatedCost || 0),
                }, 'Mission created', 'مأموریت ثبت شد', loadMissions)
                if (ok) setMisModal(false)
              }}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── holiday ── */}
      <Modal open={holModal} onClose={() => setHolModal(false)} title={L(fa, 'Add holiday', 'افزودن تعطیلی')}>
        <div className="space-y-3">
          <Input label={L(fa, 'Date', 'تاریخ')} value={holForm.date}
            onChange={v => setHolForm(f => ({ ...f, date: v }))} placeholder="2027-03-21" />
          <Input label={L(fa, 'Title (Persian)', 'مناسبت (فارسی)')} value={holForm.titleFa}
            onChange={v => setHolForm(f => ({ ...f, titleFa: v }))} />
          <Input label={L(fa, 'Title (English)', 'مناسبت (انگلیسی)')} value={holForm.titleEn}
            onChange={v => setHolForm(f => ({ ...f, titleEn: v }))} />
          <Select label={L(fa, 'Kind', 'نوع')} value={holForm.kind}
            onChange={v => setHolForm(f => ({ ...f, kind: v }))}
            options={[
              { value: 'public', label: L(fa, 'Public', 'رسمی') },
              { value: 'religious', label: L(fa, 'Religious', 'مذهبی') },
              { value: 'company', label: L(fa, 'Company', 'سازمانی') }]} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setHolModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!holForm.date || !holForm.titleFa} onClick={async () => {
              const ok = await post({
                action: 'holiday', date: holForm.date, titleFa: holForm.titleFa,
                titleEn: holForm.titleEn || null, kind: holForm.kind,
              }, 'Holiday added', 'تعطیلی افزوده شد', loadHolidays)
              if (ok) setHolModal(false)
            }}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
