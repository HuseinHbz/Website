import { verifyDocument } from '@/lib/erp/documentData'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ locale: string; code: string }> }

// Public document verification landing (the QR on every generated document
// points here). Confirms the document exists and is not voided.
export default async function VerifyPage({ params }: Props) {
  const { locale, code } = await params
  const fa = locale === 'fa'
  let result: Awaited<ReturnType<typeof verifyDocument>> = { valid: false }
  try { result = await verifyDocument(code) } catch { /* invalid */ }

  const t = (en: string, faStr: string) => (fa ? faStr : en)
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6" dir={fa ? 'rtl' : 'ltr'}>
      <div className={`w-full max-w-md rounded-2xl border p-8 text-center ${result.valid ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'}`}>
        <div className="text-5xl mb-4" aria-hidden>{result.valid ? '✅' : '⛔'}</div>
        <h1 className="text-xl font-bold text-text-primary mb-2">
          {result.valid ? t('Document verified', 'سند تأیید شد') : t('Document not found', 'سند یافت نشد')}
        </h1>
        {result.valid ? (
          <div className="text-sm text-text-secondary space-y-1 mt-4">
            <p>{t('Number', 'شماره')}: <span className="font-mono">{result.number}</span></p>
            <p>{t('Title', 'عنوان')}: {result.title}</p>
            <p>{t('Date', 'تاریخ')}: {result.date}</p>
          </div>
        ) : (
          <p className="text-sm text-text-tertiary mt-2">{t('This verification code is invalid or the document was voided.', 'این کد تأیید نامعتبر است یا سند ابطال شده است.')}</p>
        )}
        <p className="text-xs text-text-tertiary mt-6 font-mono">{code}</p>
      </div>
    </div>
  )
}
