import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Public payment-result page (بند ۴.۲). Shown after the gateway callback
// verifies (or fails) a payment. No sensitive data — just the outcome.
export default async function PayResult({ searchParams }: { searchParams: Promise<{ ok?: string; ref?: string; reason?: string; tx?: string }> }) {
  const sp = await searchParams
  const ok = sp.ok === '1'
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 text-center">
        <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center text-3xl ${ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {ok ? '✓' : '✕'}
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">
          {ok ? 'پرداخت با موفقیت انجام شد' : 'پرداخت ناموفق بود'}
        </h1>
        {ok
          ? <p className="text-sm text-text-secondary">کد پیگیری: <span className="font-mono">{sp.ref || '—'}</span></p>
          : <p className="text-sm text-text-secondary">{sp.reason === 'canceled' ? 'پرداخت توسط شما لغو شد.' : 'در پردازش پرداخت مشکلی پیش آمد. مبلغی از حساب شما کسر نشده است.'}</p>}
        {sp.tx && <p className="text-xs text-text-tertiary mt-2">شناسه تراکنش: {sp.tx}</p>}
        <Link href="/" className="inline-block mt-6 px-5 py-2 rounded-lg bg-brand text-white text-sm font-semibold">بازگشت به سایت</Link>
      </div>
    </main>
  )
}
