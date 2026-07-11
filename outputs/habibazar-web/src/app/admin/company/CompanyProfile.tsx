'use client'

/**
 * Company Profile (Phase 26) — the legal/branding identity printed on every
 * generated document (invoices, POs, contracts, …). Persists as `company_*`
 * keys in site_settings through the existing settings API; the Document Engine
 * (`loadCompanyProfile`) pulls these automatically at render time.
 */
import { useEffect, useState } from 'react'
import { Card, Btn, Input, PageHeader, useToast } from '@/components/admin/ui'
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
  {
    en: 'Branding media (URLs from Media Library)', fa: 'رسانهٔ برند (آدرس از کتابخانه رسانه)', fields: [
      { key: 'company_logo_url', en: 'Logo URL', fa: 'آدرس لوگو' },
      { key: 'company_letterhead_url', en: 'Letterhead banner URL (full width)', fa: 'آدرس سربرگ (تمام‌عرض)' },
      { key: 'company_seal_url', en: 'Seal / stamp URL', fa: 'آدرس مهر' },
      { key: 'company_signature_url', en: 'Signature image URL', fa: 'آدرس تصویر امضا' },
      { key: 'company_ceo', en: 'CEO name', fa: 'نام مدیرعامل' },
      { key: 'company_signature_title', en: 'Signature title (e.g. CEO)', fa: 'عنوان امضا (مثلاً مدیرعامل)' },
    ],
  },
]
const ALL_KEYS = GROUPS.flatMap(g => g.fields.map(f => f.key))

export function CompanyProfile() {
  const rtl = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then((d: Record<string, string>) => {
      const v: Record<string, string> = {}
      for (const k of ALL_KEYS) v[k] = d[k] ?? ''
      setValues(v)
    }).catch(() => {}).finally(() => setLoading(false))
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
      </div>
    </>
  )
}
