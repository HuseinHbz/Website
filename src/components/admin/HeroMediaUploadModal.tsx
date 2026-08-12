'use client'

/**
 * HeroMediaUploadModal — the bilingual-metadata upload form for Hero media
 * categories (background video, animation video/vector/lottie, poster).
 * Real upload progress (XHR, not fetch — fetch has no upload-progress
 * event), Cancel, Retry, a name→slug preview, and an explicit
 * Rename/Replace/Cancel choice on a duplicate filename (never a silent
 * overwrite).
 */
import { useRef, useState } from 'react'
import { Modal, Input, Select, Btn } from '@/components/admin/ui'
import { faDigits } from '@/lib/admin/chartRtl'

export interface HeroMediaCategory {
  value: string
  labelEn: string
  labelFa: string
}

export const HERO_MEDIA_CATEGORIES: HeroMediaCategory[] = [
  { value: 'hero-background-video', labelEn: 'Background video', labelFa: 'ویدیوی پس‌زمینه' },
  { value: 'hero-animation-video', labelEn: 'Animation video', labelFa: 'ویدیوی انیمیشن' },
  { value: 'hero-animation-vector', labelEn: 'Animation (SVG)', labelFa: 'انیمیشن (SVG)' },
  { value: 'hero-animation-lottie', labelEn: 'Animation (Lottie)', labelFa: 'انیمیشن (Lottie)' },
  { value: 'hero-poster', labelEn: 'Poster image', labelFa: 'تصویر پوستر' },
]

function toKebab(s: string) {
  return s.trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

interface Props {
  open: boolean
  onClose: () => void
  rtl: boolean
  folder: string
  defaultCategory: string
  accept: string
  onUploaded: (url: string) => void
}

type Phase = 'form' | 'uploading' | 'conflict' | 'error'

/**
 * The 7 upload stages from the mission spec, mapped onto a progress range
 * each — the bar must NEVER show 100% before the server has actually
 * confirmed success (reaching 100% on the browser's raw byte-transfer
 * event only means "the browser finished sending", not "the file is
 * saved and registered" — that gap is exactly what read as a false
 * "آپلود ناموفق" after a full-looking progress bar).
 */
const STAGE_LABELS: { key: string; en: string; fa: string; upTo: number }[] = [
  { key: 'prepare', en: 'Preparing file', fa: 'آماده‌سازی فایل', upTo: 2 },
  { key: 'upload', en: 'Uploading file', fa: 'ارسال فایل به سرور', upTo: 85 },
  { key: 'validate', en: 'Validating file', fa: 'اعتبارسنجی فایل', upTo: 92 },
  { key: 'store', en: 'Saving to storage', fa: 'ذخیره در فضای رسانه', upTo: 95 },
  { key: 'database', en: 'Recording in database', fa: 'ثبت در پایگاه داده', upTo: 98 },
  { key: 'finalize', en: 'Finalizing', fa: 'پردازش نهایی', upTo: 99 },
  { key: 'done', en: 'Upload succeeded', fa: 'آپلود موفق', upTo: 100 },
]
function stageLabelFor(progress: number, rtl: boolean): string {
  const stage = STAGE_LABELS.find(s => progress <= s.upTo) ?? STAGE_LABELS[STAGE_LABELS.length - 1]
  return rtl ? stage.fa : stage.en
}

interface UploadFailure {
  messageFa?: string
  errorCode?: string
  requestId?: string
  stage?: string
  retryable?: boolean
  /** Legacy shape from call sites/older responses that predate the Persian
   *  error contract — still handled so nothing regresses to a blank error. */
  error?: string
}

export function HeroMediaUploadModal({ open, onClose, rtl, folder, defaultCategory, accept, onUploaded }: Props) {
  const t = (en: string, fa: string) => (rtl ? fa : en)
  const [nameEn, setNameEn] = useState('')
  const [nameFa, setNameFa] = useState('')
  const [altEn, setAltEn] = useState('')
  const [altFa, setAltFa] = useState('')
  const [category, setCategory] = useState(defaultCategory)
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('form')
  const [progress, setProgress] = useState(0)
  const [failure, setFailure] = useState<UploadFailure | null>(null)
  const [conflict, setConflict] = useState<{ suggestedFilename: string; existing: { nameEn?: string } } | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastSubmit = useRef<{ mode: 'create' | 'replace' | 'rename'; filenameOverride?: string } | null>(null)

  function reset() {
    setNameEn(''); setNameFa(''); setAltEn(''); setAltFa(''); setDescription('')
    setFile(null); setPhase('form'); setProgress(0); setFailure(null); setConflict(null)
    setCategory(defaultCategory)
  }
  function close() { if (xhrRef.current) xhrRef.current.abort(); reset(); onClose() }

  function fail(f: UploadFailure) { setFailure(f); setPhase('error') }

  function submit(mode: 'create' | 'replace' | 'rename', filenameOverride?: string) {
    if (!file) return
    lastSubmit.current = { mode, filenameOverride }
    if (nameEn.trim().length < 2 || nameEn.trim().length > 80) { fail({ messageFa: 'نام انگلیسی باید بین ۲ تا ۸۰ کاراکتر باشد.', errorCode: 'MEDIA_INVALID_NAME', retryable: false }); return }
    if (nameFa.trim().length < 2 || nameFa.trim().length > 80) { fail({ messageFa: 'نام فارسی باید بین ۲ تا ۸۰ کاراکتر باشد.', errorCode: 'MEDIA_INVALID_NAME', retryable: false }); return }

    setPhase('uploading')
    setProgress(1) // "آماده‌سازی فایل"
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)
    fd.append('category', category)
    fd.append('nameEn', mode === 'rename' && filenameOverride ? filenameOverride.replace(/\.[^.]+$/, '') : nameEn)
    fd.append('nameFa', nameFa)
    fd.append('altEn', altEn)
    fd.append('altFa', altFa)
    fd.append('description', description)
    fd.append('mode', mode === 'rename' ? 'create' : mode)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.open('POST', '/api/admin/media')
    // 0–85%: real byte-transfer progress. The browser reaching 100% here
    // only means "sent", not "saved" — see STAGE_LABELS above.
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(1 + Math.round((e.loaded / e.total) * 84)) }
    // The transfer itself finished; the server is now validating/writing/
    // committing to the DB — genuinely unknown how far along that is from
    // the client's side, so this advances through the remaining stages on
    // a timer rather than freezing at 85% or jumping straight to 100%.
    xhr.upload.onload = () => {
      setProgress(86)
      const ticks = [90, 94, 97, 99]
      ticks.forEach((p, i) => setTimeout(() => { if (xhrRef.current === xhr) setProgress(prev => Math.max(prev, p)) }, (i + 1) * 220))
    }
    xhr.onload = () => {
      let data: UploadFailure & { conflict?: boolean; suggestedFilename?: string; existing?: { nameEn?: string }; url?: string } = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* non-JSON error body */ }
      if (xhr.status === 409 && data.conflict) {
        setConflict({ suggestedFilename: String(data.suggestedFilename ?? ''), existing: data.existing ?? {} })
        setPhase('conflict')
        return
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof data.url === 'string') {
        setProgress(100)
        onUploaded(data.url)
        close()
        return
      }
      fail({
        messageFa: data.messageFa ?? (typeof data.error === 'string' ? data.error : undefined),
        errorCode: data.errorCode,
        requestId: data.requestId,
        stage: data.stage,
        retryable: data.retryable,
      })
    }
    xhr.onerror = () => fail({ messageFa: 'ارتباط با سرور هنگام آپلود قطع شد.', errorCode: 'MEDIA_NETWORK_ERROR', retryable: true })
    xhr.onabort = () => { setPhase('form') }
    xhr.send(fd)
  }

  function retry() {
    if (lastSubmit.current) submit(lastSubmit.current.mode, lastSubmit.current.filenameOverride)
  }

  const slugPreview = nameEn ? toKebab(nameEn) : ''

  return (
    <Modal open={open} onClose={close} title={t('Upload Hero Media', 'آپلود رسانهٔ هیرو')} size="md">
      <div className="space-y-4">
        {phase === 'form' && (
          <>
            <div>
              <label className="form-label">{t('File', 'فایل')}</label>
              <input ref={fileRef} type="file" accept={accept} className="form-input h-auto py-2"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
              {file && <p className="text-3xs text-text-tertiary mt-1">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('English name *', 'نام انگلیسی *')} value={nameEn} onChange={setNameEn} placeholder="Firewall Packet Inspection" />
              <Input label={t('Persian name *', 'نام فارسی *')} value={nameFa} onChange={setNameFa} placeholder="بازرسی بستهٔ فایروال" />
            </div>
            {slugPreview && <p className="text-3xs text-text-tertiary">{t('Saved as', 'ذخیره به‌عنوان')}: <span className="font-mono text-text-secondary">{slugPreview}.*</span></p>}
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('Alt text (EN)', 'متن جایگزین (EN)')} value={altEn} onChange={setAltEn} />
              <Input label={t('Alt text (FA)', 'متن جایگزین (FA)')} value={altFa} onChange={setAltFa} />
            </div>
            <Select label={t('Media type', 'نوع رسانه')} value={category} onChange={setCategory}
              options={HERO_MEDIA_CATEGORIES.map(c => ({ value: c.value, label: rtl ? c.labelFa : c.labelEn }))} />
            <Input label={t('Description (optional)', 'توضیح (اختیاری)')} value={description} onChange={setDescription} multiline rows={2} />
            <div className="flex gap-3">
              <Btn onClick={() => submit('create')} disabled={!file}>{t('Upload', 'آپلود')}</Btn>
              <Btn variant="secondary" onClick={close}>{t('Cancel', 'لغو')}</Btn>
            </div>
          </>
        )}

        {phase === 'uploading' && (
          <div className="space-y-4">
            <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-text-secondary text-center">{stageLabelFor(progress, rtl)} · {rtl ? faDigits(progress) : progress}%</p>
            <div className="flex justify-center">
              <Btn variant="secondary" onClick={() => xhrRef.current?.abort()}>{t('Cancel Upload', 'لغو آپلود')}</Btn>
            </div>
          </div>
        )}

        {phase === 'conflict' && conflict && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {t('A file with this name already exists', 'فایلی با این نام از قبل وجود دارد')}
              {conflict.existing.nameEn ? ` ("${conflict.existing.nameEn}")` : ''}.
            </p>
            <div className="flex flex-col gap-2">
              <Btn onClick={() => submit('rename', conflict.suggestedFilename)}>
                {t(`Rename to "${conflict.suggestedFilename}"`, `تغییر نام به «${conflict.suggestedFilename}»`)}
              </Btn>
              <Btn variant="danger" onClick={() => { if (window.confirm(t('Replace the existing file? This cannot be undone.', 'فایل موجود جایگزین شود؟ این عمل قابل بازگشت نیست.'))) submit('replace') }}>
                {t('Replace existing file', 'جایگزینی فایل موجود')}
              </Btn>
              <Btn variant="secondary" onClick={() => setPhase('form')}>{t('Cancel', 'لغو')}</Btn>
            </div>
          </div>
        )}

        {phase === 'error' && failure && (
          <div className="space-y-3">
            <p className="text-sm text-danger-text bg-danger-muted rounded-lg px-3 py-2">
              {rtl ? (failure.messageFa || 'آپلود ناموفق بود.') : (failure.messageFa || t('Upload failed', 'آپلود ناموفق بود'))}
            </p>
            {(failure.errorCode || failure.requestId || failure.stage) && (
              <details className="text-3xs text-text-tertiary">
                <summary className="cursor-pointer select-none">{t('Details', 'جزئیات')}</summary>
                <div className="mt-1 space-y-0.5 font-mono">
                  {failure.stage && <p>{t('Stage', 'مرحله')}: {failure.stage}</p>}
                  {failure.errorCode && <p>{t('Error code', 'کد خطا')}: {failure.errorCode}</p>}
                  {failure.requestId && <p>{t('Request ID', 'شناسه پیگیری')}: {failure.requestId}</p>}
                </div>
              </details>
            )}
            <div className="flex gap-3">
              {failure.retryable !== false && <Btn onClick={retry}>{t('Retry', 'تلاش مجدد')}</Btn>}
              <Btn variant="secondary" onClick={() => setPhase('form')}>{t('Back', 'بازگشت')}</Btn>
              <Btn variant="secondary" onClick={close}>{t('Cancel', 'لغو')}</Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
