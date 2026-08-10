'use client'

/**
 * Phase 28.4 — employee portal.
 *
 * 🔴 This shell is intentionally styled like `PortalApp.tsx` (the customer
 * portal) for visual familiarity, but shares NO session, NO cookie and NO
 * data-fetching path with it — every call here goes to `/api/hr-portal/*`,
 * scoped by the independent `hr_portal_token` session.
 */
import { useCallback, useEffect, useState } from 'react'
import { faDigits } from '@/lib/admin/chartRtl'
import { fmtMoney } from '@/lib/format'
import { toJalaliStr } from '@/lib/erp/jalali'

type View = 'dashboard' | 'payslips' | 'leave' | 'requests' | 'profile'

interface Dash {
  employee: { id: number; firstName: string; lastName: string; employeeCode: string }
  dashboard: {
    leaveBalance: number; pendingLeaveRequests: number; pendingPortalRequests: number
    lastSlip: { jalaliYear: number; jalaliMonth: number; net: number } | null
  }
}

export function HrPortalApp({ locale }: { locale: 'fa' | 'en' }) {
  const fa = locale === 'fa'
  const t = (en: string, f: string) => (fa ? f : en)
  const num = (v: unknown) => (fa ? faDigits(String(v ?? '')) : String(v ?? ''))
  const money = (v: number) => fmtMoney(v)
  const jdate = (iso: string) => (fa ? toJalaliStr(iso) : iso)

  const [authed, setAuthed] = useState<boolean | null>(null)
  const [me, setMe] = useState<Dash | null>(null)
  const [view, setView] = useState<View>('dashboard')

  const checkAuth = useCallback(async () => {
    const r = await fetch('/api/hr-portal/me')
    if (r.ok) { setMe(await r.json()); setAuthed(true) } else setAuthed(false)
  }, [])
  useEffect(() => { checkAuth() }, [checkAuth])

  if (authed === null) return <Shell fa={fa}><p className="text-center text-sm text-text-tertiary py-20">{t('Loading…', 'در حال بارگذاری…')}</p></Shell>
  if (!authed) return <Shell fa={fa}><Login fa={fa} onDone={checkAuth} /></Shell>

  return (
    <Shell fa={fa}>
      {me && (
        <p className="text-sm text-text-secondary mb-3">
          {t('Welcome,', 'خوش آمدید،')} <span className="font-semibold text-text-primary">{me.employee.firstName} {me.employee.lastName}</span>
          <span className="text-2xs text-text-tertiary ms-2" dir="ltr">{me.employee.employeeCode}</span>
        </p>
      )}
      <nav className="flex flex-wrap gap-1 mb-5 border-b border-border pb-3">
        {(['dashboard', 'payslips', 'leave', 'requests', 'profile'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === v ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-2'}`}>
            {v === 'dashboard' ? t('Dashboard', 'داشبورد') : v === 'payslips' ? t('My payslips', 'فیش‌های من')
              : v === 'leave' ? t('Leave & attendance', 'مرخصی و حضور') : v === 'requests' ? t('Requests', 'درخواست‌ها')
                : t('Profile', 'پروفایل')}
          </button>
        ))}
        <button onClick={async () => { await fetch('/api/hr-portal/auth/logout', { method: 'POST' }); setAuthed(false); setMe(null) }}
          className="ms-auto px-3 py-1.5 rounded-lg text-sm text-danger-text hover:bg-danger/5">{t('Log out', 'خروج')}</button>
      </nav>
      {view === 'dashboard' && <Dashboard fa={fa} t={t} num={num} money={money} me={me} onGo={setView} />}
      {view === 'payslips' && <Payslips fa={fa} t={t} num={num} money={money} />}
      {view === 'leave' && <Leave fa={fa} t={t} num={num} jdate={jdate} />}
      {view === 'requests' && <Requests fa={fa} t={t} />}
      {view === 'profile' && <Profile fa={fa} t={t} />}
    </Shell>
  )
}

function Shell({ children, fa }: { children: React.ReactNode; fa: boolean }) {
  return (
    <div dir={fa ? 'rtl' : 'ltr'} className="min-h-screen bg-bg text-text-primary">
      <header className="border-b border-border bg-surface-2/60">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-brand">HBZ</span>
          <span className="text-xs text-text-tertiary">{fa ? 'پورتال کارمند' : 'Employee Portal'}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs text-text-tertiary">{label}</span>{children}</label>
}
const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand outline-none'
const card = 'rounded-xl border border-border bg-surface p-4'

// ── login ─────────────────────────────────────────────────────────────────

function Login({ fa, onDone }: { fa: boolean; onDone: () => void }) {
  const t = (en: string, f: string) => (fa ? f : en)
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [mobile, setMobile] = useState('')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const request = async () => {
    setBusy(true); setMsg('')
    const r = await fetch('/api/hr-portal/auth/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mobile }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(t('Too many requests — try later.', 'درخواست زیاد — بعداً تلاش کنید.')); return }
    setSessionId(d.sessionId ?? null); setStep('verify')
    setMsg(t('If this mobile is registered, a code was sent.', 'اگر این شماره ثبت شده باشد، کد ارسال شد.'))
  }
  const verify = async () => {
    if (!sessionId) { setMsg(t('No pending code — request again.', 'کدی در انتظار نیست — دوباره درخواست دهید.')); return }
    setBusy(true); setMsg('')
    const r = await fetch('/api/hr-portal/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, code }) })
    setBusy(false)
    if (r.ok) { onDone(); return }
    setMsg(r.status === 429 ? t('Locked — too many attempts.', 'قفل شد — تلاش زیاد.') : t('Invalid or expired code.', 'کد نامعتبر یا منقضی.'))
  }

  return (
    <div className="max-w-sm mx-auto mt-10 space-y-4">
      <h1 className="text-lg font-bold text-center">{t('Employee sign-in', 'ورود کارمند')}</h1>
      {step === 'request' ? (
        <div className="space-y-3">
          <Field label={t('Registered mobile number', 'شمارهٔ موبایل ثبت‌شده')}>
            <input className={inputCls} value={mobile} onChange={e => setMobile(e.target.value)} dir="ltr" placeholder="09121234567" />
          </Field>
          <button disabled={busy || mobile.length < 8} onClick={request}
            className="w-full py-2 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50">{t('Send code', 'ارسال کد')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label={t('Verification code', 'کد تأیید')}>
            <input className={`${inputCls} tracking-widest text-center`} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))} dir="ltr" maxLength={6} inputMode="numeric" />
          </Field>
          <button disabled={busy || code.length < 4} onClick={verify}
            className="w-full py-2 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50">{t('Verify & enter', 'تأیید و ورود')}</button>
          <button onClick={() => setStep('request')} className="w-full text-xs text-text-tertiary">{t('Change number', 'تغییر شماره')}</button>
        </div>
      )}
      {msg && <p className="text-xs text-center text-text-tertiary">{msg}</p>}
    </div>
  )
}

// ── dashboard ─────────────────────────────────────────────────────────────

function Dashboard({ t, num, money, me, onGo }: {
  fa: boolean; t: (e: string, f: string) => string; num: (v: unknown) => string
  money: (v: number) => string; me: Dash | null; onGo: (v: View) => void
}) {
  const d = me?.dashboard
  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => onGo('leave')} className={`${card} text-start`}>
        <p className="text-xs text-text-tertiary mb-1">{t('Leave balance', 'مانده مرخصی')}</p>
        <p className="text-2xl font-bold">{num(d?.leaveBalance ?? 0)}</p>
      </button>
      <button onClick={() => onGo('payslips')} className={`${card} text-start`}>
        <p className="text-xs text-text-tertiary mb-1">{t('Last net pay', 'آخرین خالص پرداختی')}</p>
        <p className="text-lg font-bold">{d?.lastSlip ? money(d.lastSlip.net) : '—'}</p>
      </button>
      <button onClick={() => onGo('leave')} className={`${card} text-start`}>
        <p className="text-xs text-text-tertiary mb-1">{t('Pending leave requests', 'درخواست مرخصی در انتظار')}</p>
        <p className="text-2xl font-bold">{num(d?.pendingLeaveRequests ?? 0)}</p>
      </button>
      <button onClick={() => onGo('requests')} className={`${card} text-start`}>
        <p className="text-xs text-text-tertiary mb-1">{t('Pending requests', 'درخواست‌های در انتظار')}</p>
        <p className="text-2xl font-bold">{num(d?.pendingPortalRequests ?? 0)}</p>
      </button>
    </div>
  )
}

// ── payslips ──────────────────────────────────────────────────────────────

const MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const MONTHS_EN = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand']

interface Slip { id: number; jalaliYear: number; jalaliMonth: number; gross: number; net: number; tax: number; status: string }
interface SlipDetail extends Slip {
  lines: { lineType: string; labelFa: string; labelEn: string; amount: number }[]
}

function Payslips({ fa, t, num, money }: { fa: boolean; t: (e: string, f: string) => string; num: (v: unknown) => string; money: (v: number) => string }) {
  const [slips, setSlips] = useState<Slip[]>([])
  const [detail, setDetail] = useState<SlipDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/hr-portal/payslips')
    if (r.ok) setSlips((await r.json()).slips ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const open = async (id: number) => {
    const r = await fetch(`/api/hr-portal/payslips/${id}`)
    if (r.ok) setDetail(await r.json())
  }

  if (detail) {
    return (
      <div className="space-y-3">
        <button onClick={() => setDetail(null)} className="text-xs text-brand">{t('← Back', '← بازگشت')}</button>
        <div className={card}>
          <h3 className="font-semibold mb-2">
            {fa ? MONTHS_FA[detail.jalaliMonth - 1] : MONTHS_EN[detail.jalaliMonth - 1]} {num(detail.jalaliYear)}
          </h3>
          <ul className="space-y-1 text-sm">
            {detail.lines.map((l, i) => (
              <li key={i} className="flex justify-between border-b border-subtle py-1">
                <span className="text-text-secondary">{fa ? l.labelFa : l.labelEn}</span>
                <span className={`tabular-nums ${l.lineType === 'deduction' ? 'text-danger' : ''}`}>
                  {l.lineType === 'deduction' ? '−' : ''}{money(l.amount)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between mt-3 pt-2 border-t border-border font-semibold">
            <span>{t('Net pay', 'خالص پرداختی')}</span><span className="tabular-nums">{money(detail.net)}</span>
          </div>
          <a href={`/api/hr-portal/payslips/${detail.id}/print`} target="_blank" rel="noopener noreferrer"
            className="block text-center mt-3 py-2 rounded-lg bg-surface-2 text-sm">{t('Print / Download', 'چاپ / دانلود')}</a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {loading && <p className="text-sm text-text-tertiary">{t('Loading…', 'در حال بارگذاری…')}</p>}
      {!loading && slips.length === 0 && <p className="text-sm text-text-tertiary">{t('No payslips yet.', 'هنوز فیشی وجود ندارد.')}</p>}
      {slips.map(s => (
        <button key={s.id} onClick={() => open(s.id)} className={`${card} w-full text-start flex items-center justify-between`}>
          <span>{fa ? MONTHS_FA[s.jalaliMonth - 1] : MONTHS_EN[s.jalaliMonth - 1]} {num(s.jalaliYear)}</span>
          <span className="tabular-nums font-semibold">{money(s.net)}</span>
        </button>
      ))}
    </div>
  )
}

// ── leave ─────────────────────────────────────────────────────────────────

interface LeaveType { id: number; nameFa: string; nameEn: string }
interface Balance { type: LeaveType; balance: number; accrued: number; used: number }
interface LeaveReq { id: number; leaveTypeNameFa: string; leaveTypeNameEn: string; startDate: string; endDate: string; days: number; status: string; reason: string | null }

function Leave({ fa, t, num, jdate }: { fa: boolean; t: (e: string, f: string) => string; num: (v: unknown) => string; jdate: (iso: string) => string }) {
  const [balances, setBalances] = useState<Balance[]>([])
  const [requests, setRequests] = useState<LeaveReq[]>([])
  const [types, setTypes] = useState<LeaveType[]>([])
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/hr-portal/leave')
    if (r.ok) {
      const d = await r.json()
      setBalances(d.balances ?? []); setRequests(d.requests ?? []); setTypes(d.types ?? [])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    setMsg('')
    const r = await fetch('/api/hr-portal/leave', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leaveTypeId: Number(form.leaveTypeId), startDate: form.startDate, endDate: form.endDate, reason: form.reason || null }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.error ?? t('Failed', 'ناموفق')); return }
    setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' })
    setMsg(t('Request submitted.', 'درخواست ثبت شد.'))
    load()
  }

  const cancel = async (id: number) => {
    await fetch(`/api/hr-portal/leave/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {balances.map(b => (
          <div key={b.type.id} className={card}>
            <p className="text-xs text-text-tertiary">{fa ? b.type.nameFa : b.type.nameEn}</p>
            <p className="text-xl font-bold tabular-nums">{num(b.balance)}</p>
          </div>
        ))}
      </div>

      <div className={card}>
        <h3 className="font-semibold mb-2 text-sm">{t('New leave request', 'درخواست مرخصی جدید')}</h3>
        <div className="space-y-2">
          <select className={inputCls} value={form.leaveTypeId} onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))}>
            <option value="">{t('Select type…', 'نوع را انتخاب کنید…')}</option>
            {types.map(ty => <option key={ty.id} value={ty.id}>{fa ? ty.nameFa : ty.nameEn}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="2026-08-01" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} dir="ltr" />
            <input className={inputCls} placeholder="2026-08-05" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} dir="ltr" />
          </div>
          <input className={inputCls} placeholder={t('Reason', 'دلیل')} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          <button disabled={!form.leaveTypeId || !form.startDate || !form.endDate} onClick={submit}
            className="w-full py-2 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50">{t('Submit', 'ثبت')}</button>
          {msg && <p className="text-xs text-text-tertiary">{msg}</p>}
        </div>
      </div>

      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className={`${card} flex items-center justify-between`}>
            <div>
              <p className="text-sm">{fa ? r.leaveTypeNameFa : r.leaveTypeNameEn} — {jdate(r.startDate)} → {jdate(r.endDate)}</p>
              <p className="text-2xs text-text-tertiary">{num(r.days)} {t('days', 'روز')} · {r.status}</p>
            </div>
            {r.status === 'pending' && <button onClick={() => cancel(r.id)} className="text-xs text-danger-text">{t('Cancel', 'لغو')}</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── requests ──────────────────────────────────────────────────────────────

interface PReq { id: number; kind: string; status: string; createdAt: string }
const KIND_LABEL: Record<string, { en: string; fa: string }> = {
  certificate: { en: 'Employment certificate', fa: 'گواهی اشتغال' },
  advance: { en: 'Advance', fa: 'مساعده' },
  mission: { en: 'Mission', fa: 'مأموریت' },
  info_correction: { en: 'Info correction', fa: 'اصلاح اطلاعات فردی' },
}

function Requests({ fa, t }: { fa: boolean; t: (e: string, f: string) => string }) {
  const [rows, setRows] = useState<PReq[]>([])
  const [kind, setKind] = useState<'certificate' | 'advance' | 'mission' | 'info_correction'>('certificate')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/hr-portal/requests')
    if (r.ok) setRows((await r.json()).requests ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    setMsg('')
    const payload: Record<string, string> = kind === 'info_correction' ? { field: note } : { note }
    const r = await fetch('/api/hr-portal/requests', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, payload }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.error ?? t('Failed', 'ناموفق')); return }
    setNote(''); setMsg(t('Submitted.', 'ثبت شد.')); load()
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold mb-2 text-sm">{t('New request', 'درخواست جدید')}</h3>
        <div className="space-y-2">
          <select className={inputCls} value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{fa ? l.fa : l.en}</option>)}
          </select>
          <input className={inputCls} placeholder={kind === 'info_correction' ? t('What needs to change?', 'چه چیزی باید اصلاح شود؟') : t('Note', 'یادداشت')}
            value={note} onChange={e => setNote(e.target.value)} />
          {kind === 'info_correction' && (
            <p className="text-2xs text-text-tertiary">
              {t('This is a PROPOSAL — HR reviews and applies the change; sensitive fields are never updated automatically.',
                'این یک پیشنهاد است — HR بررسی و اعمال می‌کند؛ فیلدهای حساس هرگز خودکار به‌روز نمی‌شوند.')}
            </p>
          )}
          <button onClick={submit} className="w-full py-2 rounded-lg bg-brand text-white text-sm font-semibold">{t('Submit', 'ثبت')}</button>
          {msg && <p className="text-xs text-text-tertiary">{msg}</p>}
        </div>
      </div>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className={`${card} flex items-center justify-between`}>
            <span className="text-sm">{fa ? KIND_LABEL[r.kind]?.fa : KIND_LABEL[r.kind]?.en}</span>
            <span className="text-xs text-text-tertiary">{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── profile ───────────────────────────────────────────────────────────────

interface Profile { firstName: string; lastName: string; employeeCode: string; nationalIdMasked: string | null; mobile: string | null; email: string | null; address: string | null }

function Profile({ fa, t }: { fa: boolean; t: (e: string, f: string) => string }) {
  const [p, setP] = useState<Profile | null>(null)
  const [form, setForm] = useState({ email: '', address: '' })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/hr-portal/profile')
    if (r.ok) {
      const d = await r.json()
      setP(d.profile); setForm({ email: d.profile.email ?? '', address: d.profile.address ?? '' })
    }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setMsg('')
    const r = await fetch('/api/hr-portal/profile', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form),
    })
    setMsg(r.ok ? t('Saved.', 'ذخیره شد.') : t('Failed.', 'ناموفق.'))
  }

  if (!p) return <p className="text-sm text-text-tertiary">{t('Loading…', 'در حال بارگذاری…')}</p>

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="text-sm"><span className="text-text-tertiary">{t('Name', 'نام')}: </span>{p.firstName} {p.lastName}</p>
        <p className="text-sm"><span className="text-text-tertiary">{t('Employee code', 'کد پرسنلی')}: </span><span dir="ltr">{p.employeeCode}</span></p>
        <p className="text-sm"><span className="text-text-tertiary">{t('National ID', 'کد ملی')}: </span><span dir="ltr">{p.nationalIdMasked ?? '—'}</span></p>
        <p className="text-2xs text-text-tertiary mt-2">
          {t('To change your national ID or IBAN, submit an info-correction request.',
            'برای تغییر کد ملی یا شبا، درخواست اصلاح اطلاعات ثبت کنید.')}
        </p>
      </div>
      <div className={card}>
        <h3 className="font-semibold mb-2 text-sm">{t('Editable info', 'اطلاعات قابل ویرایش')}</h3>
        <div className="space-y-2">
          <Field label={t('Email', 'ایمیل')}>
            <input className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" />
          </Field>
          <Field label={t('Address', 'آدرس')}>
            <input className={inputCls} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </Field>
          <button onClick={save} className="w-full py-2 rounded-lg bg-brand text-white text-sm font-semibold">{t('Save', 'ذخیره')}</button>
          {msg && <p className="text-xs text-text-tertiary">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
