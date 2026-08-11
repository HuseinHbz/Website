'use client'

/**
 * Brand & Identity Settings — the admin editor for every string/logo that
 * used to be a hardcoded literal ("HBZ", "حسین حبیب‌آذر", "معمار زیرساخت",
 * the browser tab title, the favicon). Reads/writes through the dedicated
 * `/api/admin/settings/branding` (text fields) and
 * `/api/admin/settings/branding/logo` (upload/remove) routes — both backed
 * by the existing `site_settings` key/value table (no parallel schema).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, Btn, Input, PageHeader, Badge, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'

const lc = (rtl: boolean, en: string, fa: string) => (rtl ? fa : en)

interface BrandForm {
  brandNameFa: string; brandNameEn: string
  brandSubtitleFa: string; brandSubtitleEn: string
  homepageTitleFa: string; homepageTitleEn: string
  pageTitleTemplateFa: string; pageTitleTemplateEn: string
  logoUrl: string
  logoAltFa: string; logoAltEn: string
  logoVersion: string
}

const LOGO_ACCEPT = 'image/png,image/webp,image/svg+xml,image/x-icon,.png,.webp,.svg,.ico'

export function BrandingSettings() {
  const rtl = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()
  const [lang, setLang] = useState<'fa' | 'en'>(rtl ? 'fa' : 'en')
  const [form, setForm] = useState<BrandForm | null>(null)
  const [saved, setSaved] = useState<BrandForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/settings/branding')
      if (r.status === 401 || r.status === 403) { setForbidden(true); return }
      const d = await r.json()
      const next: BrandForm = {
        brandNameFa: d.brandNameFa, brandNameEn: d.brandNameEn,
        brandSubtitleFa: d.brandSubtitleFa, brandSubtitleEn: d.brandSubtitleEn,
        homepageTitleFa: d.homepageTitleFa, homepageTitleEn: d.homepageTitleEn,
        pageTitleTemplateFa: d.pageTitleTemplateFa, pageTitleTemplateEn: d.pageTitleTemplateEn,
        logoUrl: d.logoUrl, logoAltFa: d.logoAltFa, logoAltEn: d.logoAltEn,
        logoVersion: d.logoVersion,
      }
      setForm(next)
      setSaved(next)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const dirty = !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved)

  // Warn on navigating away with unsaved changes (spec بند ۶).
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  function set<K extends keyof BrandForm>(key: K, v: string) {
    setForm(f => f ? { ...f, [key]: v } : f)
  }

  async function save() {
    if (!form || saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/settings/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandNameFa: form.brandNameFa, brandNameEn: form.brandNameEn,
          brandSubtitleFa: form.brandSubtitleFa, brandSubtitleEn: form.brandSubtitleEn,
          homepageTitleFa: form.homepageTitleFa, homepageTitleEn: form.homepageTitleEn,
          pageTitleTemplateFa: form.pageTitleTemplateFa, pageTitleTemplateEn: form.pageTitleTemplateEn,
          logoAltFa: form.logoAltFa, logoAltEn: form.logoAltEn,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        toast(lc(rtl, 'Branding settings saved — live on the site now', 'تنظیمات برند ذخیره شد — همین حالا روی سایت اعمال شد'), 'success')
        setSaved(form)
      } else {
        toast(d.error || lc(rtl, 'Save failed', 'ذخیره ناموفق بود'), 'error')
      }
    } finally { setSaving(false) }
  }

  async function resetDefaults() {
    if (!window.confirm(lc(rtl,
      'Reset all text fields (name, subtitle, titles, template) to the built-in defaults? The logo is not affected.',
      'همه فیلدهای متنی (نام، زیرعنوان، عنوان‌ها، قالب) به مقادیر پیش‌فرض بازگردانده شوند؟ لوگو تغییر نمی‌کند.'
    ))) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/settings/branding', { method: 'DELETE' })
      if (r.ok) { toast(lc(rtl, 'Reset to defaults', 'به مقادیر پیش‌فرض بازگردانده شد'), 'success'); await load() }
      else toast(lc(rtl, 'Reset failed', 'بازگردانی ناموفق بود'), 'error')
    } finally { setSaving(false) }
  }

  async function uploadLogo(file: File) {
    if (uploading) return
    if (file.size > 2 * 1024 * 1024) { toast(lc(rtl, 'File exceeds the 2MB limit', 'حجم فایل بیش از ۲ مگابایت است'), 'error'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/admin/settings/branding/logo', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { toast(lc(rtl, 'Logo uploaded — applied everywhere immediately', 'لوگو آپلود شد — همه‌جا فوراً اعمال شد'), 'success'); await load() }
      else toast(d.error || lc(rtl, 'Upload failed', 'آپلود ناموفق بود'), 'error')
    } finally { setUploading(false) }
  }

  async function removeLogo() {
    if (!window.confirm(lc(rtl,
      'Remove the custom logo? The site will fall back to the built-in "HBZ" badge and favicon.',
      'لوگوی سفارشی حذف شود؟ سایت به نشان و Favicon پیش‌فرض «HBZ» بازمی‌گردد.'
    ))) return
    setUploading(true)
    try {
      const r = await fetch('/api/admin/settings/branding/logo', { method: 'DELETE' })
      if (r.ok) { toast(lc(rtl, 'Logo removed', 'لوگو حذف شد'), 'success'); await load() }
      else toast(lc(rtl, 'Failed', 'ناموفق'), 'error')
    } finally { setUploading(false) }
  }

  if (forbidden) {
    return (
      <>
        <ToastContainer />
        <PageHeader title={lc(rtl, 'Brand & Identity Settings', 'تنظیمات برند و هویت سایت')} />
        <Card className="p-6 text-center text-sm text-text-tertiary">
          {lc(rtl, "You don't have permission to view brand settings.", 'شما مجوز مشاهده تنظیمات برند را ندارید.')}
        </Card>
      </>
    )
  }

  if (loading || !form) {
    return (
      <>
        <ToastContainer />
        <PageHeader title={lc(rtl, 'Brand & Identity Settings', 'تنظیمات برند و هویت سایت')} />
        <p className="text-xs text-text-tertiary">{lc(rtl, 'Loading…', 'در حال بارگذاری…')}</p>
      </>
    )
  }

  const nameField = lang === 'fa' ? 'brandNameFa' : 'brandNameEn'
  const subtitleField = lang === 'fa' ? 'brandSubtitleFa' : 'brandSubtitleEn'
  const homeTitleField = lang === 'fa' ? 'homepageTitleFa' : 'homepageTitleEn'
  const templateField = lang === 'fa' ? 'pageTitleTemplateFa' : 'pageTitleTemplateEn'
  const altField = lang === 'fa' ? 'logoAltFa' : 'logoAltEn'
  const previewLogo = form.logoUrl ? `${form.logoUrl}${form.logoUrl.includes('?') ? '&' : '?'}v=${form.logoVersion}` : null
  const templateSample = form[templateField]
    .replace('{{pageTitle}}', lc(lang === 'fa', 'Sample Page', 'صفحه نمونه'))
    .replace('{{brandName}}', form[nameField])

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={lc(rtl, 'Brand & Identity Settings', 'تنظیمات برند و هویت سایت')}
        subtitle={lc(rtl,
          'Edit the browser tab title, logo/favicon, the name shown next to the logo, and the brand subtitle — no code changes.',
          'عنوان تب مرورگر، لوگو/Favicon، نام کنار لوگو و زیرعنوان برند را بدون تغییر کد ویرایش کنید.')}
        action={dirty ? <Badge color="yellow">{lc(rtl, 'Unsaved changes', 'تغییرات ذخیره‌نشده')}</Badge> : undefined}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Language tabs */}
          <div className="flex gap-1 shrink-0 rounded-lg border border-subtle p-0.5 w-fit">
            {(['fa', 'en'] as const).map(l => (
              <button key={l} type="button" onClick={() => setLang(l)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${lang === l ? 'bg-brand text-white' : 'text-text-tertiary hover:text-text-primary'}`}>
                {l === 'fa' ? 'فارسی' : 'English'}
              </button>
            ))}
          </div>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Name & Subtitle', 'نام و زیرعنوان')}</h3>
            <Input label={lc(rtl, 'Brand / Person Name', 'نام برند/شخص')} value={form[nameField]} onChange={v => set(nameField, v)} placeholder="Husein Habibazar" />
            <Input label={lc(rtl, 'Brand Subtitle', 'زیرعنوان برند')} value={form[subtitleField]} onChange={v => set(subtitleField, v)} placeholder="Infrastructure Architect" />
            <Input label={lc(rtl, 'Logo Alternative Text', 'متن جایگزین لوگو')} value={form[altField]} onChange={v => set(altField, v)} placeholder="HBZ logo" />
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Browser Title', 'عنوان مرورگر')}</h3>
            <Input label={lc(rtl, 'Homepage Browser Title', 'عنوان صفحه اصلی در تب مرورگر')} value={form[homeTitleField]} onChange={v => set(homeTitleField, v)} />
            <div>
              <Input label={lc(rtl, 'Internal Page Title Template', 'قالب عنوان صفحات داخلی')} value={form[templateField]} onChange={v => set(templateField, v)} placeholder="{{pageTitle}} | {{brandName}}" />
              <p className="text-3xs text-text-tertiary mt-1">
                {lc(rtl, 'Use {{pageTitle}} and {{brandName}} — {{pageTitle}} is required.', 'از {{pageTitle}} و {{brandName}} استفاده کنید — {{pageTitle}} الزامی است.')}
              </p>
              <p className="text-xs text-text-secondary mt-2 font-mono bg-surface-2 rounded-lg px-3 py-2 border border-subtle">
                {lc(rtl, 'Preview: ', 'پیش‌نمایش: ')}<span className="text-text-primary">{templateSample}</span>
              </p>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{lc(rtl, 'Logo', 'لوگو')}</h3>
              {form.logoUrl && <Badge color="green">{lc(rtl, 'Custom logo active', 'لوگوی سفارشی فعال')}</Badge>}
            </div>
            <p className="text-xs text-text-tertiary">
              {lc(rtl,
                'Used as the favicon, header logo (desktop & mobile), mobile menu, footer, and every identity spot on the site. PNG, WebP, SVG (sanitized) or ICO — max 2MB.',
                'در Favicon، لوگوی هدر (دسکتاپ و موبایل)، منوی موبایل، فوتر و همه بخش‌های هویتی سایت استفاده می‌شود. PNG، WebP، SVG (پاک‌سازی‌شده) یا ICO — حداکثر ۲ مگابایت.')}
            </p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border border-subtle bg-surface-2 flex items-center justify-center overflow-hidden shrink-0">
                {previewLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewLogo} alt={form[altField] || 'logo'} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm"
                    style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))', color: '#fff' }}>HBZ</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
                  style={{ background: 'var(--color-brand)', color: '#fff' }}>
                  {uploading ? lc(rtl, 'Uploading…', 'در حال آپلود…') : `⇧ ${form.logoUrl ? lc(rtl, 'Replace logo', 'جایگزینی لوگو') : lc(rtl, 'Upload logo', 'آپلود لوگو')}`}
                  <input ref={fileInputRef} type="file" accept={LOGO_ACCEPT} className="hidden" disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
                </label>
                {form.logoUrl && (
                  <Btn variant="danger" onClick={removeLogo} disabled={uploading}>
                    {lc(rtl, 'Remove (revert to default)', 'حذف (بازگشت به پیش‌فرض)')}
                  </Btn>
                )}
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Btn variant="secondary" onClick={resetDefaults} disabled={saving}>
              {lc(rtl, 'Restore Defaults', 'بازگردانی مقادیر پیش‌فرض')}
            </Btn>
            <Btn onClick={save} disabled={saving || !dirty}>
              {saving ? lc(rtl, 'Saving…', 'در حال ذخیره…') : lc(rtl, 'Save Changes', 'ذخیره تغییرات')}
            </Btn>
          </div>
        </div>

        {/* Live preview */}
        <div className="space-y-4">
          <Card className="p-4">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">{lc(rtl, 'Header preview', 'پیش‌نمایش هدر')}</h4>
            {/* Deliberately hardcoded dark — this simulates the PUBLIC site's
                header (its own separate colour scope), not an admin surface,
                so it must not follow the admin light/dark theme toggle. Text
                colours are inline style (not text-white/70 utilities) so the
                theme-consistency audit doesn't mistake this mockup for a
                real admin surface that broke the light theme. */}
            <div className="rounded-xl border border-subtle p-4 flex items-center gap-3" style={{ background: '#0a0a12' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0 overflow-hidden" style={{ color: '#fff' }}>
                {previewLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={previewLogo} alt="" className="w-full h-full object-contain" />
                  : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7477ff,#9698ff)' }}>HBZ</div>}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: '#fff' }}>{form[nameField] || '—'}</div>
                <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{form[subtitleField] || '—'}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">{lc(rtl, 'Browser tab preview', 'پیش‌نمایش تب مرورگر')}</h4>
            <div className="rounded-t-lg border border-b-0 border-subtle bg-surface-2 px-3 py-2 flex items-center gap-2 max-w-xs">
              <div className="w-4 h-4 rounded-sm overflow-hidden shrink-0 flex items-center justify-center">
                {previewLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={previewLogo} alt="" className="w-full h-full object-contain" />
                  : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#7477ff,#9698ff)' }} />}
              </div>
              <span className="text-xs text-text-secondary truncate">{form[homeTitleField] || '—'}</span>
            </div>
            <div className="h-2 rounded-b-lg border border-t-0 border-subtle bg-surface" />
            <p className="text-3xs text-text-tertiary mt-2">
              {lc(rtl, 'Homepage title shown above. Internal pages use the template preview on the left.', 'عنوان صفحه اصلی بالا نمایش داده شد. صفحات داخلی از قالب سمت چپ استفاده می‌کنند.')}
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
