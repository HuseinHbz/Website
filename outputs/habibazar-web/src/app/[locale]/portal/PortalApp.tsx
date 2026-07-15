'use client'

import { useCallback, useEffect, useState } from 'react'
import { faDigits } from '@/lib/admin/chartRtl'
import { fmtMoney } from '@/lib/format'

type View = 'dashboard' | 'invoices' | 'payments' | 'profile'
interface Dash { customer: { name: string; code: string }; balance: number; aging: { current: number; d31_60: number; d61_90: number; d90plus: number; total: number }; creditLimit: number; paymentTerms: number; openCount: number; channels: { id: number; channel: string; address: string; optIn: number }[] }
interface Inv { id: number; docNo: string; date: string; dueDate: string | null; status: string; total: number; paid: number; currency: string }
interface Pay { id: number; date: string; amount: number; method: string; reference: string | null; invoiceNo: string | null }

export function PortalApp({ locale }: { locale: 'fa' | 'en' }) {
  const fa = locale === 'fa'
  const t = (en: string, f: string) => (fa ? f : en)
  const num = (v: unknown) => (fa ? faDigits(String(v ?? '')) : String(v ?? ''))
  const money = (v: number) => fmtMoney(v)

  const [authed, setAuthed] = useState<boolean | null>(null)
  const [view, setView] = useState<View>('dashboard')

  const checkAuth = useCallback(async () => {
    const r = await fetch('/api/portal/me')
    setAuthed(r.ok)
  }, [])
  useEffect(() => { checkAuth() }, [checkAuth])

  if (authed === null) return <Shell fa={fa}><p className="text-center text-sm text-text-tertiary py-20">{t('Loading…', 'در حال بارگذاری…')}</p></Shell>
  if (!authed) return <Shell fa={fa}><Login fa={fa} onDone={() => setAuthed(true)} /></Shell>

  return (
    <Shell fa={fa}>
      <nav className="flex flex-wrap gap-1 mb-5 border-b border-border pb-3">
        {(['dashboard', 'invoices', 'payments', 'profile'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === v ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-2'}`}>
            {v === 'dashboard' ? t('Dashboard', 'داشبورد') : v === 'invoices' ? t('My invoices', 'فاکتورهای من') : v === 'payments' ? t('My payments', 'پرداخت‌های من') : t('Profile', 'پروفایل')}
          </button>
        ))}
        <button onClick={async () => { await fetch('/api/portal/auth/logout', { method: 'POST' }); setAuthed(false) }} className="ms-auto px-3 py-1.5 rounded-lg text-sm text-danger-text hover:bg-danger/5">{t('Log out', 'خروج')}</button>
      </nav>
      {view === 'dashboard' && <Dashboard fa={fa} money={money} num={num} t={t} />}
      {view === 'invoices' && <Invoices fa={fa} money={money} num={num} t={t} />}
      {view === 'payments' && <Payments fa={fa} money={money} num={num} t={t} />}
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
          <span className="text-xs text-text-tertiary">{fa ? 'پرتال مشتری' : 'Customer Portal'}</span>
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

function Login({ fa, onDone }: { fa: boolean; onDone: () => void }) {
  const t = (en: string, f: string) => (fa ? f : en)
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const [identifier, setIdentifier] = useState('')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const request = async () => {
    setBusy(true); setMsg('')
    const r = await fetch('/api/portal/auth/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel, identifier }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(t('Too many requests — try later.', 'درخواست زیاد — بعداً تلاش کنید.')); return }
    setSessionId(d.sessionId ?? null); setStep('verify')
    setMsg(t('If the account exists, a code was sent.', 'اگر حساب وجود داشته باشد، کد ارسال شد.'))
  }
  const verify = async () => {
    if (!sessionId) { setMsg(t('No pending code — request again.', 'کدی در انتظار نیست — دوباره درخواست دهید.')); return }
    setBusy(true); setMsg('')
    const r = await fetch('/api/portal/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, code }) })
    setBusy(false)
    if (r.ok) { onDone(); return }
    setMsg(r.status === 429 ? t('Locked — too many attempts.', 'قفل شد — تلاش زیاد.') : t('Invalid or expired code.', 'کد نامعتبر یا منقضی.'))
  }

  return (
    <div className="max-w-sm mx-auto mt-10 space-y-4">
      <h1 className="text-lg font-bold text-center">{t('Sign in to your account', 'ورود به حساب')}</h1>
      {step === 'request' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['sms', 'email'] as const).map(c => (
              <button key={c} onClick={() => setChannel(c)} className={`flex-1 py-2 rounded-lg text-sm ${channel === c ? 'bg-brand text-white' : 'bg-surface-2 border border-border'}`}>{c === 'sms' ? t('SMS', 'پیامک') : t('Email', 'ایمیل')}</button>
            ))}
          </div>
          <Field label={channel === 'sms' ? t('Mobile number', 'شماره موبایل') : t('Email', 'ایمیل')}>
            <input className={inputCls} value={identifier} onChange={e => setIdentifier(e.target.value)} dir="ltr" />
          </Field>
          <button disabled={busy || identifier.length < 3} onClick={request} className="w-full py-2 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50">{t('Send code', 'ارسال کد')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label={t('Verification code', 'کد تأیید')}>
            <input className={`${inputCls} tracking-widest text-center`} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} dir="ltr" maxLength={6} inputMode="numeric" />
          </Field>
          <button disabled={busy || code.length < 4} onClick={verify} className="w-full py-2 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50">{t('Verify & enter', 'تأیید و ورود')}</button>
          <button onClick={() => setStep('request')} className="w-full text-xs text-text-tertiary">{t('Change number', 'تغییر شماره')}</button>
        </div>
      )}
      {msg && <p className="text-xs text-center text-text-secondary">{msg}</p>}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>{children}</div>
}
type Fn = { fa: boolean; money: (v: number) => string; num: (v: unknown) => string; t: (en: string, f: string) => string }

function Dashboard({ money, num, t }: Fn) {
  const [d, setD] = useState<Dash | null>(null)
  useEffect(() => { fetch('/api/portal/me').then(r => r.ok ? r.json() : null).then(setD) }, [])
  if (!d) return <p className="text-sm text-text-tertiary">…</p>
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">{t('Welcome', 'خوش آمدید')}, <b className="text-text-primary">{d.customer.name}</b></p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><div className="text-xs text-text-tertiary">{t('Balance due', 'مانده بدهی')}</div><div className="text-lg font-bold">{money(d.balance)}</div></Card>
        <Card><div className="text-xs text-text-tertiary">{t('Open invoices', 'فاکتورهای باز')}</div><div className="text-lg font-bold">{num(d.openCount)}</div></Card>
        <Card><div className="text-xs text-text-tertiary">{t('Payment terms', 'مهلت پرداخت')}</div><div className="text-lg font-bold">{num(d.paymentTerms)} {t('days', 'روز')}</div></Card>
      </div>
      <Card>
        <div className="text-sm font-semibold mb-2">{t('Receivables aging', 'سن‌بندی بدهی')}</div>
        {([['current', '0-30'], ['d31_60', '31-60'], ['d61_90', '61-90'], ['d90plus', '90+']] as const).map(([k, l]) => (
          <div key={k} className="flex justify-between text-xs py-0.5"><span className="text-text-tertiary">{num(l)}</span><span>{money(d.aging[k])}</span></div>
        ))}
      </Card>
    </div>
  )
}

function Invoices({ money, num, t }: Fn) {
  const [inv, setInv] = useState<Inv[]>([])
  const [busy, setBusy] = useState(0)
  const load = useCallback(() => { fetch('/api/portal/invoices').then(r => r.json()).then(d => setInv(d.invoices ?? [])) }, [])
  useEffect(() => { load() }, [load])
  const pay = async (id: number) => {
    setBusy(id)
    const r = await fetch('/api/portal/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invoiceId: id }) })
    const d = await r.json().catch(() => ({}))
    setBusy(0)
    if (d.redirectUrl) window.location.href = d.redirectUrl
    else alert(d.error ?? t('Payment could not be started', 'شروع پرداخت ناموفق بود'))
  }
  return (
    <div className="space-y-2">
      {inv.length === 0 && <p className="text-sm text-text-tertiary">{t('No invoices', 'فاکتوری نیست')}</p>}
      {inv.map(i => {
        const out = Math.round((i.total - i.paid) * 100) / 100
        return (
          <Card key={i.id} className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-mono">{num(i.docNo)}</div>
              <div className="text-xs text-text-tertiary">{num(i.date)} · {t('Total', 'جمع')} {money(i.total)}{out > 0 ? ` · ${t('Due', 'مانده')} ${money(out)}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/api/portal/invoices/${i.id}/print`} className="text-xs text-brand hover:underline" target="_blank" rel="noreferrer">{t('View / print', 'مشاهده / چاپ')}</a>
              {out > 0 && <button disabled={busy === i.id} onClick={() => pay(i.id)} className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold disabled:opacity-50">{t('Pay online', 'پرداخت آنلاین')}</button>}
              {out <= 0 && <span className="text-xs text-emerald-500">{t('Paid', 'پرداخت‌شده')}</span>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function Payments({ money, num, t }: Fn) {
  const [pays, setPays] = useState<Pay[]>([])
  useEffect(() => { fetch('/api/portal/payments').then(r => r.json()).then(d => setPays(d.payments ?? [])) }, [])
  return (
    <div className="space-y-2">
      {pays.length === 0 && <p className="text-sm text-text-tertiary">{t('No payments', 'پرداختی نیست')}</p>}
      {pays.map(p => (
        <Card key={p.id} className="flex items-center justify-between">
          <div className="text-xs text-text-tertiary">{num(p.date)} · {p.method}{p.invoiceNo ? ` · ${num(p.invoiceNo)}` : ''}</div>
          <div className="text-sm font-semibold text-emerald-500">{money(p.amount)}</div>
        </Card>
      ))}
    </div>
  )
}

function Profile({ fa, t }: { fa: boolean; t: (en: string, f: string) => string }) {
  const [channels, setChannels] = useState<Dash['channels']>([])
  const load = useCallback(() => { fetch('/api/portal/me').then(r => r.ok ? r.json() : null).then(d => setChannels(d?.channels ?? [])) }, [])
  useEffect(() => { load() }, [load])
  const toggle = async (id: number, optIn: boolean) => {
    const r = await fetch('/api/portal/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channelId: id, optIn }) })
    if (r.ok) { const d = await r.json(); setChannels(d.channels ?? []) }
  }
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{t('Communication channels', 'کانال‌های ارتباطی')}</h2>
      <p className="text-xs text-text-tertiary">{t('Choose which channels may contact you.', 'انتخاب کنید از چه کانال‌هایی با شما تماس گرفته شود.')}</p>
      {channels.length === 0 && <p className="text-sm text-text-tertiary">{t('No channels', 'کانالی نیست')}</p>}
      {channels.map(c => (
        <Card key={c.id} className="flex items-center justify-between" >
          <div><span className="text-sm">{c.channel}</span> <span className="text-xs text-text-tertiary font-mono" dir="ltr">{c.address}</span></div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={!!c.optIn} onChange={e => toggle(c.id, e.target.checked)} />
            {c.optIn ? t('Subscribed', 'فعال') : t('Unsubscribed', 'لغو')}
          </label>
        </Card>
      ))}
      <span className="sr-only">{fa ? 'پروفایل' : 'profile'}</span>
    </div>
  )
}
