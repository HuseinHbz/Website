'use client'

/**
 * Company Profile (Phase 26) — the legal/branding identity printed on every
 * generated document (invoices, POs, contracts, …). Persists as `company_*`
 * keys in site_settings through the existing settings API; the Document Engine
 * (`loadCompanyProfile`) pulls these automatically at render time.
 *
 * DOC-BRAND бнд۵: the branding-media fields (logo/letterhead/seal/signature)
 * used to be plain text inputs — the operator had to separately open the
 * Media Library, upload, copy the URL, and paste it back here. They're now
 * MediaPicker widgets (the SAME `/api/admin/media` upload the rest of the
 * admin uses — no parallel upload path) with a live thumbnail preview before
 * saving, and the logo gets a low-resolution warning (checked client-side
 * against the actual decoded image, not the file size). No rebuild/deploy is
 * needed for a new logo to take effect — the Document Engine reads this
 * setting live on every render; the honest fallback when it's empty is the
 * company's text NAME printed in the header (renderDocumentHtml already did
 * this before this change) — there is no bundled default logo FILE to fall
 * back to, so none is claimed here.
 */
import { useEffect, useState, useCallback } from 'react'
import { Card, Btn, Input, PageHeader, useToast } from '@/components/admin/ui'
import { MediaPicker } from '@/components/admin/MediaPicker'
import { useAdminLocale } from '@/lib/admin/locale'

const lc = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)

interface FieldDef { key: string; en: string; fa: string }
const GROUPS: { en: string; fa: string; fields: FieldDef[] }[] = [
  {
    en: 'Identity', fa: 'هویت', fields: [
      { key: 'company_name', en: 'Company name', fa: 'نام شرکت' },
      { key: 'company_commercial_name', en: 'Commercial name', fa: 'نام تجاری' },
      { key: 'company_website', en: 'Website', fa: 'وب‌سایت' },
      { key: 'company_email', en: 'Email', fa: 'ایمیل' },
      { key: 'company_phone', en: 'Phone', fa: 'تلفن' },
    ],
  },
  {
    en: 'Registration & Tax', fa: 'ثبت و مالیات', fields: [
      { key: 'company_reg_no', en: 'Registration no.', fa: 'شماره ثبت' },
      { key: 'company_national_id', en: 'National ID', fa: 'شناسه ملی' },
      { key: 'company_economic_code', en: 'Economic code', fa: 'کد اقتصادی' },
      { key: 'company_tax_no', en: 'Tax number', fa: 'شماره مالیاتی' },
      { key: 'company_vat_no', en: 'VAT number', fa: 'شماره ارزش افزوده' },
    ],
  },
  {
    en: 'Address', fa: 'نشانی', fields: [
      { key: 'company_address', en: 'Address', fa: 'نشانی' },
      { key: 'company_postal_code', en: 'Postal code', fa: 'کد پستی' },
    ],
  },
  {
    en: 'Banking', fa: 'بانکی', fields: [
      { key: 'company_bank_name', en: 'Bank name', fa: 'نام بانک' },
      { key: 'company_iban', en: 'IBAN', fa: 'شبا' },
      { key: 'company_swift', en: 'SWIFT', fa: 'سوئیفت' },
    ],
  },
]

interface ImageFieldDef extends FieldDef { folder: string; minWidth: number }
const IMAGE_FIELDS: ImageFieldDef[] = [
  { key: 'company_logo_url', en: 'Invoice logo', fa: 'لوگوی فاکتور', folder: 'logos', minWidth: 300 },
  { key: 'company_letterhead_url', en: 'Letterhead banner (full width)', fa: 'سربرگ (تمام‌عرض)', folder: 'logos', minWidth: 800 },
  { key: 'company_seal_url', en: 'Seal / stamp', fa: 'مهر', folder: 'logos', minWidth: 150 },
  { key: 'company_signature_url', en: 'Signature image', fa: 'تصویر امضا', folder: 'logos', minWidth: 150 },
]
const TEXT_FIELDS: FieldDef[] = [
  { key: 'company_ceo', en: 'CEO name', fa: 'نام مدیرعامل' },
  { key: 'company_signature_title', en: 'Signature title (e.g. CEO)', fa: 'عنوان امضا (مثلاً مدیرعامل)' },
]
const ALL_KEYS = [...GROUPS.flatMap(g => g.fields.map(f => f.key)), ...IMAGE_FIELDS.map(f => f.key), ...TEXT_FIELDS.map(f => f.key)]

/** Decodes the image the URL actually points to and checks its real pixel
 *  width — not the file size, which says nothing about print quality. */
function checkResolution(url: string, minWidth: number): Promise<number | null> {
  return new Promise(resolve => {
    if (!url) { resolve(null); return }
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth)
    img.onerror = () => resolve(null)
    img.src = url
    void minWidth
  })
}

export function CompanyProfile() {
  const rtl = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lowRes, setLowRes] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then((d: Record<string, string>) => {
      const v: Record<string, string> = {}
      for (const k of ALL_KEYS) v[k] = d[k] ?? ''
      setValues(v)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const setImage = useCallback((f: ImageFieldDef, url: string) => {
    setValues(s => ({ ...s, [f.key]: url }))
    setLowRes(s => { const n = { ...s }; delete n[f.key]; return n })
    if (url) {
      checkResolution(url, f.minWidth).then(w => {
        if (w != null && w < f.minWidth) setLowRes(s => ({ ...s, [f.key]: w }))
      })
    }
  }, [])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      if (r.ok) toast(lc(rtl, 'Company profile saved — it now appears on all documents', 'پروفایل شرکت ذخیره شد — روی همهٔ اسناد اعمال می‌شود'), 'success')
      else toast(lc(rtl, 'Save failed', 'ذخیره ناموفق'), 'error')
    } finally { setSaving(false) }
  }

  if (loading) return <Card className="p-8 text-center text-text-tertiary">{lc(rtl, 'Loading…', 'بارگذاری…')}</Card>

  return (
    <>
      <ToastContainer />
      <PageHeader title={lc(rtl, 'Company Profile', 'پروفایل شرکت')}
        subtitle={lc(rtl, 'Legal identity + branding printed automatically on every generated document', 'هویت حقوقی و برند که خودکار روی هر سند چاپ می‌شود')}
        action={<Btn onClick={save} disabled={saving}>{saving ? lc(rtl, 'Saving…', 'در حال ذخیره…') : lc(rtl, 'Save profile', 'ذخیره پروفایل')}</Btn>} />
      <div className="grid lg:grid-cols-2 gap-4">
        {GROUPS.map(g => (
          <Card key={g.en} className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, g.en, g.fa)}</h3>
            {g.fields.map(f => (
              <Input key={f.key} label={lc(rtl, f.en, f.fa)} value={values[f.key] ?? ''} onChange={v => setValues(s => ({ ...s, [f.key]: v }))} />
            ))}
          </Card>
        ))}
        <Card className="p-5 space-y-4 lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Document branding', 'هویت اسناد')}</h3>
            <p className="text-3xs text-text-tertiary mt-0.5">
              {lc(rtl, 'Uploaded here, applied to every invoice/document immediately — no code change or deploy needed.', 'همین‌جا آپلود می‌شود و بلافاصله روی همهٔ فاکتور/اسناد اعمال می‌شود — بدون نیاز به تغییر کد یا Deploy.')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {IMAGE_FIELDS.map(f => (
              <div key={f.key}>
                <MediaPicker
                  label={lc(rtl, f.en, f.fa)}
                  folder={f.folder}
                  value={values[f.key] ?? ''}
                  onChange={url => setImage(f, url)}
                  placeholder={lc(rtl, 'No image selected — falls back to company name text', 'تصویری انتخاب نشده — به‌جای آن نام شرکت به‌صورت متن چاپ می‌شود')}
                />
                {lowRes[f.key] != null && (
                  <p className="text-3xs text-warning-text mt-1">
                    {lc(rtl,
                      `⚠ Low resolution (${lowRes[f.key]}px wide) — recommended at least ${f.minWidth}px for print quality.`,
                      `⚠ رزولوشن پایین (${lowRes[f.key]} پیکسل عرض) — برای کیفیت چاپ حداقل ${f.minWidth} پیکسل توصیه می‌شود.`)}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {TEXT_FIELDS.map(f => (
              <Input key={f.key} label={lc(rtl, f.en, f.fa)} value={values[f.key] ?? ''} onChange={v => setValues(s => ({ ...s, [f.key]: v }))} />
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
