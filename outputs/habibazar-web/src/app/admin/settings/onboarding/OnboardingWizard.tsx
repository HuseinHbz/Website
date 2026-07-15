'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, PageHeader } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { faDigits } from '@/lib/admin/chartRtl'

const L = (fa: boolean, en: string, f: string) => (fa ? f : en)
interface Item { key: string; labelEn: string; labelFa: string; ready: boolean; href: string; hintEn: string; hintFa: string; optional?: boolean }
interface Data { items: Item[]; readyCount: number; total: number; requiredReady: boolean }

export function OnboardingWizard() {
  const locale = useAdminLocale()
  const fa = locale === 'fa'
  const num = (v: unknown) => (fa ? faDigits(String(v ?? '')) : String(v ?? ''))
  const [d, setD] = useState<Data | null>(null)
  useEffect(() => { fetch('/api/admin/settings/onboarding').then(r => r.json()).then(setD).catch(() => setD(null)) }, [])

  if (!d) return <p className="text-sm text-text-tertiary p-4">…</p>
  const pct = Math.round((d.readyCount / d.total) * 100)

  return (
    <div className="space-y-5 max-w-3xl" dir={fa ? 'rtl' : 'ltr'}>
      <PageHeader title={L(fa, 'Go-Live checklist', 'چک‌لیست راه‌اندازی')} subtitle={L(fa, 'What is ready before opening to real customers', 'آنچه قبل از شروع کار با مشتری واقعی آماده است')} />

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{num(d.readyCount)} / {num(d.total)} {L(fa, 'ready', 'آماده')}</span>
          <span className={`text-sm font-bold ${d.requiredReady ? 'text-success' : 'text-amber-500'}`}>{d.requiredReady ? L(fa, '✓ Ready for pilot', '✓ آماده پایلوت') : L(fa, 'Required items pending', 'موارد ضروری باقی‌مانده')}</span>
        </div>
        <div className="w-full bg-surface-2 rounded-full h-3 overflow-hidden">
          <div className={`h-full ${d.requiredReady ? 'bg-success' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <div className="space-y-2">
        {d.items.map(it => (
          <Card key={it.key} className={`p-3 flex items-start gap-3 ${it.ready ? '' : 'border-amber-500/30'}`}>
            <span className={`mt-0.5 text-lg ${it.ready ? 'text-success' : 'text-text-tertiary'}`}>{it.ready ? '✓' : '○'}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{fa ? it.labelFa : it.labelEn}</span>
                {it.optional && <span className="text-4xs text-text-tertiary px-1.5 py-0.5 rounded bg-surface-2">{L(fa, 'optional', 'اختیاری')}</span>}
              </div>
              <p className="text-xs text-text-tertiary mt-0.5">{fa ? it.hintFa : it.hintEn}</p>
            </div>
            {!it.ready && <Link href={it.href} className="text-xs text-brand hover:underline whitespace-nowrap">{L(fa, 'Set up →', 'تنظیم →')}</Link>}
          </Card>
        ))}
      </div>
      <p className="text-xs text-text-tertiary">{L(fa, 'This checklist only reads your current configuration — it does not change any settings.', 'این چک‌لیست فقط پیکربندی فعلی را می‌خواند و هیچ تنظیمی را تغییر نمی‌دهد.')}</p>
    </div>
  )
}
