'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, PageHeader, Btn, Input, Select, Toggle, Badge, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'

const L = (fa: boolean, en: string, f: string) => (fa ? f : en)

type FieldType = 'text' | 'url' | 'secret' | 'select' | 'bool'
interface Field { key: string; labelFa: string; labelEn: string; type: FieldType; options?: { value: string; labelFa: string; labelEn: string }[]; placeholder?: string }
interface Provider { id: string; titleFa: string; titleEn: string; descFa: string; descEn: string; anchor: string; fields: Field[]; liveKeys: string[] }
interface FieldStatus { key: string; set: boolean; value: string | null; masked: boolean }
interface Status { providers: { id: string; status: 'live' | 'sandbox'; fields: FieldStatus[] }[]; fields: Record<string, FieldStatus> }

export function IntegrationSettings() {
  const locale = useAdminLocale()
  const fa = locale === 'fa'
  const { toast, ToastContainer } = useToast()
  const [providers, setProviders] = useState<Provider[]>([])
  const [status, setStatus] = useState<Status | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; mode: string; msg: string }>>({})

  const load = useCallback(() => {
    fetch('/api/admin/settings/integrations').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setProviders(d.providers); setStatus(d.status) }
    }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  // Deep-link: scroll to the provider anchored in the URL hash (from the wizard).
  useEffect(() => {
    if (!status) return
    const h = window.location.hash.replace('#', '')
    if (h) { const el = document.getElementById(h); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  }, [status])

  const fieldValue = (f: Field): string => {
    if (f.key in draft) return draft[f.key]
    const st = status?.fields[f.key]
    if (!st || st.masked) return '' // secrets: never prefill; blank means "leave unchanged"
    return st.value ?? (f.type === 'bool' ? '0' : '')
  }
  const setField = (k: string, v: string) => setDraft(d => ({ ...d, [k]: v }))

  const saveProvider = async (p: Provider) => {
    setBusy(true)
    try {
      const dirty = p.fields.filter(f => f.key in draft)
      // Skip empty secrets (empty = leave the stored value unchanged).
      const toSave = dirty.filter(f => !(f.type === 'secret' && draft[f.key] === ''))
      if (toSave.length === 0) { toast(L(fa, 'Nothing to save', 'چیزی برای ذخیره نیست')); setBusy(false); return }
      for (const f of toSave) {
        const res = await fetch('/api/admin/settings/integrations', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'save', key: f.key, value: draft[f.key] }),
        })
        if (!res.ok) throw new Error('save failed')
      }
      // Clear only the saved keys from the draft.
      setDraft(d => { const n = { ...d }; for (const f of toSave) delete n[f.key]; return n })
      toast(L(fa, 'Saved', 'ذخیره شد'))
      load()
    } catch { toast(L(fa, 'Save failed', 'ذخیره ناموفق بود')) }
    setBusy(false)
  }

  const testProvider = async (p: Provider) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/settings/integrations', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'test', provider: p.id }),
      })
      const d = await res.json()
      if (d?.result) setTestResult(t => ({ ...t, [p.id]: { ok: d.result.ok, mode: d.result.mode, msg: fa ? d.result.detailFa : d.result.detailEn } }))
    } catch { toast(L(fa, 'Test failed', 'آزمایش ناموفق بود')) }
    setBusy(false)
  }

  const providerStatus = (id: string) => status?.providers.find(p => p.id === id)?.status

  return (
    <div className="space-y-5" dir={fa ? 'rtl' : 'ltr'}>
      <PageHeader
        title={L(fa, 'Integrations', 'یکپارچه‌سازی‌ها')}
        subtitle={L(fa, 'Configure Moadian, payment gateway, SMS, WhatsApp and Telegram credentials', 'تنظیم اعتبارنامهٔ مودیان، درگاه پرداخت، پیامک، واتساپ و تلگرام')}
      />
      <Card className="p-3 text-xs text-text-secondary">
        {L(fa,
          'Secret keys are write-only: once saved they are never shown again — only a masked hint (•••• 1234). Leave a secret field blank to keep the stored value.',
          'کلیدهای محرمانه فقط‌نوشتنی‌اند: پس از ذخیره دیگر نمایش داده نمی‌شوند — تنها یک نشانهٔ ماسک‌شده (•••• ۱۲۳۴). برای حفظ مقدار قبلی، فیلد محرمانه را خالی بگذارید.')}
      </Card>

      {providers.map(p => {
        const st = providerStatus(p.id)
        const tr = testResult[p.id]
        return (
          <Card key={p.id} className="p-4 scroll-mt-20" >
            <div id={p.anchor} className="-mt-20 pt-20" aria-hidden />
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  {fa ? p.titleFa : p.titleEn}
                  {st && <Badge color={st === 'live' ? 'green' : 'yellow'}>{st === 'live' ? L(fa, 'Live', 'واقعی') : L(fa, 'Sandbox', 'سندباکس')}</Badge>}
                </h2>
                <p className="text-xs text-text-tertiary mt-1 max-w-xl">{fa ? p.descFa : p.descEn}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              {p.fields.map(f => {
                const st = status?.fields[f.key]
                const label = fa ? f.labelFa : f.labelEn
                if (f.type === 'bool') {
                  return (
                    <div key={f.key} className="flex items-center gap-3 pt-6">
                      <Toggle checked={fieldValue(f) === '1' || fieldValue(f) === 'true'} onChange={v => setField(f.key, v ? '1' : '0')} label={label} />
                    </div>
                  )
                }
                if (f.type === 'select') {
                  return (
                    <Select key={f.key} label={label} value={fieldValue(f)} onChange={v => setField(f.key, v)}
                      options={(f.options || []).map(o => ({ value: o.value, label: fa ? o.labelFa : o.labelEn }))} />
                  )
                }
                return (
                  <div key={f.key}>
                    <Input label={label} value={fieldValue(f)} onChange={v => setField(f.key, v)}
                      type={f.type === 'secret' ? 'password' : f.type === 'url' ? 'url' : 'text'}
                      placeholder={f.type === 'secret' && st?.set ? `•••• ${st.value?.slice(-4) ?? ''}` : (f.placeholder || '')} />
                    {f.type === 'secret' && st?.set && (
                      <p className="text-4xs text-text-tertiary mt-1">{L(fa, 'Saved · leave blank to keep', 'ذخیره‌شده · برای حفظ خالی بگذارید')} {st.value}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {tr && (
              <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${tr.ok ? 'bg-success-muted text-success-text' : 'bg-warning-muted text-warning-text'}`}>
                {tr.msg}
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <Btn onClick={() => saveProvider(p)} disabled={busy} size="sm">{L(fa, 'Save', 'ذخیره')}</Btn>
              <Btn onClick={() => testProvider(p)} disabled={busy} variant="secondary" size="sm">{L(fa, 'Test connection', 'آزمایش اتصال')}</Btn>
            </div>
          </Card>
        )
      })}

      <Card className="p-4">
        <h2 className="text-sm font-semibold">{L(fa, 'Portal knowledge base', 'پایگاه دانش پورتال')}</h2>
        <p className="text-xs text-text-tertiary mt-1">
          {L(fa,
            'To publish a knowledge article to the customer portal, open Content → AI Knowledge and toggle “Portal public” on the article.',
            'برای انتشار مقالهٔ دانش در پورتال مشتری، به محتوا ← دانش هوش مصنوعی بروید و گزینهٔ «عمومی پورتال» را روی مقاله فعال کنید.')}
        </p>
        <Link href="/admin/ai-kb" className="text-xs text-brand hover:underline mt-2 inline-block">{L(fa, 'Open AI Knowledge →', 'باز کردن دانش هوش مصنوعی ←')}</Link>
      </Card>
      <ToastContainer />
    </div>
  )
}
