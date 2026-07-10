import type { Metadata } from 'next'
import { portalData } from '@/lib/erp/vendorPortal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Vendor Portal' }

interface Props { params: Promise<{ locale: string; token: string }> }

const STATUS_TONE: Record<string, string> = {
  paid: 'text-emerald-500', cleared: 'text-emerald-500', approved: 'text-sky-500',
  confirmed: 'text-sky-500', partial: 'text-amber-500', submitted: 'text-amber-500',
  rejected: 'text-red-500', void: 'text-slate-500',
}

// Vendor Portal (Phase 26.1) — token-gated, READ-ONLY supplier view. The magic
// link is issued/revoked by an admin from the Purchasing Center; the token is
// 128-bit, expiring and revocable, and this page only ever shows the vendor's
// own documents. noindex.
export default async function VendorPortalPage({ params }: Props) {
  const { locale, token } = await params
  const fa = locale === 'fa'
  const t = (en: string, faStr: string) => (fa ? faStr : en)
  let data: Awaited<ReturnType<typeof portalData>> = null
  try { data = await portalData(token) } catch { /* invalid */ }

  if (!data) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6" dir={fa ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-md rounded-2xl border border-danger/40 bg-danger/5 p-8 text-center">
          <div className="text-5xl mb-4" aria-hidden>⛔</div>
          <h1 className="text-xl font-bold text-text-primary mb-2">{t('Portal link is invalid or expired', 'پیوند پرتال نامعتبر یا منقضی است')}</h1>
          <p className="text-sm text-text-secondary">{t('Ask your contact at HBZ Technology for a new link.', 'برای دریافت پیوند جدید با رابط خود در HBZ تماس بگیرید.')}</p>
        </div>
      </div>
    )
  }

  const v = data.vendor
  return (
    <div className="min-h-[70vh] max-w-4xl mx-auto p-6 space-y-6" dir={fa ? 'rtl' : 'ltr'}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-60">{t('Vendor Portal', 'پرتال تأمین‌کننده')}</p>
          <h1 className="text-2xl font-bold">{v.name}</h1>
          <p className="text-xs opacity-60 font-mono">{v.code} · {t('Grade', 'درجه')} {v.grade} · {v.currency}</p>
        </div>
        <div className="text-end">
          <p className="text-xs opacity-60">{t('Outstanding balance', 'ماندهٔ بدهی')}</p>
          <p className="text-2xl font-bold">{data.outstanding.toLocaleString()} <span className="text-sm opacity-60">{v.currency}</span></p>
        </div>
      </header>

      <section>
        <h2 className="text-sm font-semibold mb-3">{t('Your documents', 'اسناد شما')}</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead><tr className="text-start opacity-60 text-xs border-b border-white/10">
              {[t('No.', 'شماره'), t('Type', 'نوع'), t('Date', 'تاریخ'), t('Status', 'وضعیت'), t('Total', 'مبلغ'), t('Paid', 'پرداخت‌شده')].map(h => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {data.documents.map((d, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{d.docNo || '—'}</td>
                  <td className="px-3 py-2 text-xs">{d.docType}</td>
                  <td className="px-3 py-2 text-xs opacity-70">{d.date}</td>
                  <td className={`px-3 py-2 text-xs font-medium ${STATUS_TONE[d.status] ?? 'opacity-70'}`}>{d.status}</td>
                  <td className="px-3 py-2 text-xs">{d.total.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">{d.paidTotal.toLocaleString()}</td>
                </tr>
              ))}
              {data.documents.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs opacity-60">{t('No documents yet.', 'سندی نیست.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">{t('Payments received', 'پرداخت‌های دریافتی')}</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead><tr className="opacity-60 text-xs border-b border-white/10">
              {[t('Date', 'تاریخ'), t('Amount', 'مبلغ'), t('Method', 'روش'), t('Reference', 'مرجع')].map(h => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {data.payments.map((p, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-3 py-2 text-xs opacity-70">{p.date}</td>
                  <td className="px-3 py-2 text-xs">{p.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">{p.method}</td>
                  <td className="px-3 py-2 text-xs font-mono">{p.reference || '—'}</td>
                </tr>
              ))}
              {data.payments.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-xs opacity-60">{t('No payments yet.', 'پرداختی نیست.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs opacity-50">{t('This is a read-only view issued by HBZ Technology. Contact us for any discrepancy.', 'این نمای فقط‌خواندنی توسط HBZ صادر شده است. در صورت مغایرت با ما تماس بگیرید.')}</p>
    </div>
  )
}
