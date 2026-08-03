'use client'

import { useMemo } from 'react'
import { Card, Btn, Input, Select, Toggle, Badge, EmptyState, PageHeader } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/DataTable'
import { useAdminLocale } from '@/lib/admin/locale'
import { allNavItems, workspaceById } from '@/lib/admin/workspaces'
import type { Column } from '@/lib/admin/dataTable'

const TOKENS = [
  { cls: 'bg-brand', name: 'brand' }, { cls: 'bg-accent', name: 'accent' },
  { cls: 'bg-success', name: 'success' }, { cls: 'bg-warning', name: 'warning' },
  { cls: 'bg-danger', name: 'danger' }, { cls: 'bg-info', name: 'info' },
  { cls: 'bg-surface', name: 'surface' }, { cls: 'bg-surface-2', name: 'surface-2' },
  { cls: 'bg-border', name: 'border' }, { cls: 'bg-background', name: 'background' },
]
const TYPE = [
  { cls: 'text-3xl font-bold', label: 'Display / H1' },
  { cls: 'text-2xl font-bold', label: 'Heading 2' },
  { cls: 'text-lg font-semibold', label: 'Heading 3' },
  { cls: 'text-sm', label: 'Body' },
  { cls: 'text-xs text-text-tertiary', label: 'Caption' },
  { cls: 'text-2xs text-text-tertiary', label: 'Micro (2xs · 11px)' },
  { cls: 'text-3xs text-text-tertiary', label: 'Micro (3xs · 10px)' },
  { cls: 'text-4xs text-text-tertiary', label: 'Micro (4xs · 9px)' },
  { cls: 'text-overline text-text-tertiary', label: 'Overline / Label' },
]
const BADGES = ['green', 'red', 'yellow', 'blue', 'indigo', 'slate']

interface RouteRow { module: string; path: string; workspace: string; [k: string]: unknown }

export function DesignSystem() {
  const locale = useAdminLocale()
  const isRTL = locale === 'fa'
  const L = (en: string, fa: string) => (isRTL ? fa : en)

  const routeRows = useMemo<RouteRow[]>(() => allNavItems().map(it => ({
    module: isRTL ? it.labelFa : it.labelEn,
    path: it.href,
    workspace: workspaceById(it.workspaceId)?.[isRTL ? 'nameFa' : 'nameEn'] ?? it.workspaceId,
  })), [isRTL])

  const routeCols: Column<RouteRow>[] = [
    { key: 'module', labelEn: 'Module', labelFa: 'ماژول' },
    { key: 'path', labelEn: 'Path', labelFa: 'مسیر', render: r => <code className="text-xs text-text-tertiary">{r.path}</code> },
    { key: 'workspace', labelEn: 'Workspace', labelFa: 'فضای کاری', render: r => <Badge color="indigo">{r.workspace}</Badge> },
  ]

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card className="p-5 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </Card>
  )

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={L('Design System', 'سیستم طراحی')} subtitle={L('The single enterprise design language — tokens, components and the DataTable — every module follows.', 'زبان واحد طراحی سازمانی — توکن‌ها، کامپوننت‌ها و جدول داده — که همهٔ ماژول‌ها از آن پیروی می‌کنند.')} />

      {/* 26.33 BUG-202 — reported as "does not work": nothing on this page
          reacts, because every control here is a SPECIMEN of a component, not an
          action. That is the intended design (it is a reference catalogue), but
          an unlabelled page full of dead buttons is indistinguishable from a
          broken one. Saying so is the fix. */}
      <div className="mb-6 rounded-xl border border-info/40 bg-info/10 px-4 py-3">
        <p className="text-sm font-semibold text-text-primary">
          {L('Reference only — this page is not editable', 'فقط مرجع — این صفحه قابل ویرایش نیست')}
        </p>
        <p className="text-xs text-text-secondary mt-1">
          {L('Every control below is a sample of a component, shown so you can see how it looks. The samples deliberately do nothing when clicked. To change brand colours or the logo, use Company Profile; feature toggles live in Feature Flags.',
             'همهٔ کنترل‌های زیر نمونهٔ کامپوننت‌اند و فقط برای دیدن ظاهرشان نمایش داده می‌شوند؛ با کلیک عمداً کاری انجام نمی‌دهند. برای تغییر رنگ برند یا لوگو از «پروفایل شرکت» و برای فعال/غیرفعال‌کردن قابلیت‌ها از «پرچم‌های ویژگی» استفاده کنید.')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Section title={L('Color tokens', 'توکن‌های رنگ')}>
          <div className="grid grid-cols-5 gap-3">
            {TOKENS.map(tk => (
              <div key={tk.name} className="text-center">
                <div className={`${tk.cls} h-12 rounded-lg border border-border`} />
                <p className="text-3xs text-text-tertiary mt-1 truncate">{tk.name}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-tertiary">{L('All colors are semantic tokens; the audit:tokens gate fails on any arbitrary color class.', 'همهٔ رنگ‌ها توکن معنایی هستند؛ ممیزی توکن روی هر کلاس رنگ دلخواه شکست می‌خورد.')}</p>
        </Section>

        <Section title={L('Typography scale', 'مقیاس تایپوگرافی')}>
          <div className="space-y-2">
            {TYPE.map(ty => <p key={ty.label} className={ty.cls}>{ty.label}</p>)}
          </div>
        </Section>

        <Section title={L('Buttons', 'دکمه‌ها')}>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary">Primary</Btn>
            <Btn variant="secondary">Secondary</Btn>
            <Btn variant="danger">Danger</Btn>
            <Btn variant="ghost">Ghost</Btn>
            <Btn size="sm">Small</Btn>
            <Btn disabled>Disabled</Btn>
          </div>
        </Section>

        <Section title={L('Badges', 'نشان‌ها')}>
          <div className="flex flex-wrap gap-2">
            {BADGES.map(c => <Badge key={c} color={c}>{c}</Badge>)}
          </div>
        </Section>

        <Section title={L('Form controls', 'کنترل‌های فرم')}>
          <div className="space-y-3">
            <Input label={L('Text input', 'ورودی متن')} value="" onChange={() => {}} placeholder="Placeholder" />
            <Select label={L('Select', 'انتخاب')} value="a" onChange={() => {}} options={[{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }]} />
            <Toggle checked onChange={() => {}} label={L('Toggle', 'کلید')} />
          </div>
        </Section>

        <Section title={L('States', 'حالت‌ها')}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="h-10 rounded-lg bg-white/[0.05] animate-pulse" />
              <div className="h-10 rounded-lg bg-white/[0.05] animate-pulse" />
              <div className="h-10 rounded-lg bg-white/[0.05] animate-pulse" />
            </div>
            <div className="border border-border rounded-xl">
              <EmptyState icon="📭" title={L('Nothing here yet', 'هنوز چیزی نیست')} description={L('Empty state component.', 'کامپوننت حالت خالی.')} />
            </div>
          </div>
        </Section>
      </div>

      <Section title={L('Enterprise DataTable — live route inventory', 'جدول دادهٔ سازمانی — فهرست زندهٔ مسیرها')}>
        <p className="text-xs text-text-tertiary">{L('One reusable table: sort, filter, density, column visibility, pagination — shown here over the real admin route registry.', 'یک جدول قابل‌استفادهٔ مجدد: مرتب‌سازی، فیلتر، تراکم، نمایش ستون‌ها و صفحه‌بندی — اینجا روی رجیستری واقعی مسیرهای ادمین.')}</p>
        <DataTable columns={routeCols} rows={routeRows} locale={locale} pageSize={8} searchKeys={['module', 'path', 'workspace']} rowKey={r => r.path} />
      </Section>
    </div>
  )
}
