'use client'

import { useState } from 'react'
import { crud, useResource } from '@/lib/admin/crud'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { MediaPicker, GalleryPicker } from '@/components/admin/MediaPicker'
import { useT, useAdminLocale } from '@/lib/admin/locale'

type Project = {
  id?: number; slug: string; nameEn: string; nameFa: string; industryEn: string; industryFa: string
  clientEn: string; clientFa: string; challengeEn: string; challengeFa: string
  solutionEn: string; solutionFa: string; resultsEn: string; resultsFa: string
  tagsEn: string; tagsFa: string; coverImage: string; gallery: string; color: string
  year: string; featured: boolean; sortOrder: number; active: boolean
  // Phase 3 Case Study fields
  executiveSummaryEn: string; executiveSummaryFa: string
  existingInfraEn: string; existingInfraFa: string
  proposedArchEn: string; proposedArchFa: string
  techStackJson: string
  securityConsiderationsEn: string; securityConsiderationsFa: string
  haAvailabilityEn: string; haAvailabilityFa: string
  backupStrategyEn: string; backupStrategyFa: string
  disasterRecoveryEn: string; disasterRecoveryFa: string
  monitoringStrategyEn: string; monitoringStrategyFa: string
  deploymentProcessEn: string; deploymentProcessFa: string
  implementationTimelineJson: string
  beforeAfterJson: string
  businessImpactJson: string
  lessonsLearnedEn: string; lessonsLearnedFa: string
  futureImprovementsEn: string; futureImprovementsFa: string
  networkDiagramUrl: string; infraDiagramUrl: string
  downloadPdfUrl: string; downloadArchUrl: string; downloadTechSummaryUrl: string
  clientLogoUrl: string
  technologyFilters: string
  businessScopeEn: string; businessScopeFa: string
  collaborationType: string
  projectStatus: string
  isConfidential: boolean
  seoTitle: string; seoDescription: string; seoKeywords: string; ogImage: string
  relatedCaseStudySlugs: string
}

const EMPTY: Project = {
  slug: '', nameEn: '', nameFa: '', industryEn: '', industryFa: '', clientEn: '', clientFa: '',
  challengeEn: '', challengeFa: '', solutionEn: '', solutionFa: '',
  resultsEn: '[]', resultsFa: '[]', tagsEn: '[]', tagsFa: '[]',
  coverImage: '', gallery: '[]', color: '#6366f1', year: '', featured: false, sortOrder: 0, active: true,
  executiveSummaryEn: '', executiveSummaryFa: '',
  existingInfraEn: '', existingInfraFa: '',
  proposedArchEn: '', proposedArchFa: '',
  techStackJson: '[]',
  securityConsiderationsEn: '', securityConsiderationsFa: '',
  haAvailabilityEn: '', haAvailabilityFa: '',
  backupStrategyEn: '', backupStrategyFa: '',
  disasterRecoveryEn: '', disasterRecoveryFa: '',
  monitoringStrategyEn: '', monitoringStrategyFa: '',
  deploymentProcessEn: '', deploymentProcessFa: '',
  implementationTimelineJson: '[]',
  beforeAfterJson: '[]',
  businessImpactJson: '[]',
  lessonsLearnedEn: '', lessonsLearnedFa: '',
  futureImprovementsEn: '', futureImprovementsFa: '',
  networkDiagramUrl: '', infraDiagramUrl: '',
  downloadPdfUrl: '', downloadArchUrl: '', downloadTechSummaryUrl: '',
  clientLogoUrl: '',
  technologyFilters: '[]',
  businessScopeEn: '', businessScopeFa: '',
  collaborationType: 'implementation',
  projectStatus: 'completed',
  isConfidential: false,
  seoTitle: '', seoDescription: '', seoKeywords: '', ogImage: '',
  relatedCaseStudySlugs: '[]',
}

function parseGallery(v: string | null | undefined): string[] {
  if (!v) return []
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
}

const TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'casestudy', label: 'Case Study' },
  { id: 'technical', label: 'Technical Details' },
  { id: 'strategy', label: 'Strategy & Process' },
  { id: 'results', label: 'Results & Impact' },
  { id: 'media', label: 'Media & Downloads' },
  { id: 'seo', label: 'SEO' },
] as const
type TabId = typeof TABS[number]['id']

export function ProjectsManager() {
  const t = useT()
  const locale = useAdminLocale()
  const rtl = locale === 'fa'
  const lc = (en: string, fa: string) => (rtl ? fa : en)
  const isFa = locale === 'fa'
  const { data: projects, reload: load } = useResource<Project>('/api/admin/projects')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Project>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const { toast, ToastContainer } = useToast()

  async function save() {
    setSaving(true)
    const res = await crud.save('/api/admin/projects', editing)
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(await crud.errorOf(res, t('failed')), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    const res = await crud.remove('/api/admin/projects', id)
    if (res.ok) { toast(t('deleted')); load() } else toast(await crud.errorOf(res, t('failed')), 'error')
  }

  async function toggle(p: Project) {
    const res = await crud.patch('/api/admin/projects', { id: p.id, active: !p.active })
    if (res.ok) { toast(t('saved')); load() } else toast(await crud.errorOf(res, t('failed')), 'error')
  }

  function set<K extends keyof Project>(k: K, v: Project[K]) { setEditing((e) => ({ ...e, [k]: v })) }
  const galleryUrls = parseGallery(editing.gallery)
  function setGallery(urls: string[]) { set('gallery', JSON.stringify(urls)) }

  function openNew() { setEditing(EMPTY); setActiveTab('basic'); setModal(true) }
  function openEdit(p: Project) { setEditing(p); setActiveTab('basic'); setModal(true) }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('caseStudiesTitle')}
        action={<Btn onClick={openNew}>{t('newCaseStudy')}</Btn>}
      />

      <Card>
        <DataTable
          tableId="cms-projects"
          columns={[
            { key: 'nameEn', labelEn: 'Name', labelFa: t('name'), value: p => isFa ? p.nameFa : p.nameEn, render: p => <div className="flex items-center gap-2"><ColorDot color={p.color} /><div><div className="font-medium text-text-primary">{isFa ? p.nameFa : p.nameEn}</div><div className="text-xs text-text-tertiary">{isFa ? p.nameEn : p.nameFa} · {p.year}</div><div className="text-3xs text-text-disabled">{p.slug}</div></div></div> },
            { key: 'industryEn', labelEn: 'Industry', labelFa: t('industry'), type: 'enum', value: p => isFa ? p.industryFa : p.industryEn, render: p => <span className="text-text-secondary text-xs">{isFa ? p.industryFa : p.industryEn}</span> },
            { key: 'projectStatus', labelEn: 'Status', labelFa: t('status'), type: 'enum', options: ['completed', 'ongoing', 'planned'].map(s => ({ value: s, labelEn: s, labelFa: s })), render: p => <Badge color={p.projectStatus === 'completed' ? 'green' : p.projectStatus === 'ongoing' ? 'indigo' : 'slate'}>{t(p.projectStatus || 'completed')}</Badge> },
            { key: 'featured', labelEn: 'Featured', labelFa: t('featured'), type: 'boolean', value: p => !!p.featured, render: p => <Badge color={p.featured ? 'indigo' : 'slate'}>{p.featured ? `★ ${t('featured')}` : t('regular')}</Badge> },
            { key: 'coverImage', labelEn: 'Cover', labelFa: t('cover'), sortable: false, render: p => p.coverImage ? <img src={p.coverImage} alt="" className="w-10 h-10 object-cover rounded-lg border border-border" /> : <span className="text-text-disabled text-xs">—</span> },
          ] as Column<Project>[]}
          rows={projects}
          locale={locale}
          rowKey={p => String(p.id)}
          rowActions={[
            { id: 'edit', labelEn: 'Edit', labelFa: t('edit'), icon: '✎', onClick: p => openEdit(p) },
            { id: 'toggle', labelEn: 'Toggle', labelFa: t('status'), icon: '⇄', onClick: p => toggle(p) },
            { id: 'del', labelEn: 'Delete', labelFa: t('delete'), icon: '🗑', danger: true, onClick: p => del(p.id!) },
          ] as RowAction<Project>[]}
          exportName="case-studies"
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('editCaseStudy') : t('newCaseStudyModal')} size="xl">
        {/* Tab nav */}
        <div className="flex gap-1 mb-5 border-b border-border pb-3 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${activeTab === tab.id ? 'bg-brand text-white' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* BASIC INFO */}
          {activeTab === 'basic' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Input label={t('slug') + ' *'} value={editing.slug} onChange={(v) => set('slug', v)} placeholder="enterprise-network-upgrade" />
                <Input label={lc('Year', 'سال')} value={editing.year} onChange={(v) => set('year', v)} placeholder="2024" />
                <Input label={lc('Brand Color', 'رنگ برند')} type="color" value={editing.color} onChange={(v) => set('color', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label={lc('Name (EN)', 'نام (انگلیسی)')} value={editing.nameEn} onChange={(v) => set('nameEn', v)} />
                <Input label={lc('Name (FA)', 'نام (فارسی)')} value={editing.nameFa} onChange={(v) => set('nameFa', v)} />
                <Input label={lc('Industry (EN)', 'صنعت (انگلیسی)')} value={editing.industryEn} onChange={(v) => set('industryEn', v)} />
                <Input label={lc('Industry (FA)', 'صنعت (فارسی)')} value={editing.industryFa} onChange={(v) => set('industryFa', v)} />
                <Input label={lc('Client (EN)', 'مشتری (انگلیسی)')} value={editing.clientEn} onChange={(v) => set('clientEn', v)} />
                <Input label={lc('Client (FA)', 'مشتری (فارسی)')} value={editing.clientFa} onChange={(v) => set('clientFa', v)} />
                <Input label={lc('Business Scope (EN)', 'حوزه فعالیت (انگلیسی)')} value={editing.businessScopeEn} onChange={(v) => set('businessScopeEn', v)} placeholder="Enterprise-grade, 500+ employees" />
                <Input label={lc('Business Scope (FA)', 'حوزه فعالیت (فارسی)')} value={editing.businessScopeFa} onChange={(v) => set('businessScopeFa', v)} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Select label={lc('Collaboration Type', 'نوع همکاری')} value={editing.collaborationType} onChange={(v) => set('collaborationType', v)} options={[
                  { value: 'implementation', label: lc('Implementation', 'پیاده‌سازی') },
                  { value: 'consulting', label: lc('Consulting', 'مشاوره') },
                  { value: 'design', label: lc('Design', 'طراحی') },
                  { value: 'managed_service', label: lc('Managed Service', 'خدمات مدیریت‌شده') },
                ]} />
                <Select label={lc('Project Status', 'وضعیت پروژه')} value={editing.projectStatus} onChange={(v) => set('projectStatus', v)} options={[
                  { value: 'completed', label: lc('Completed', 'تکمیل‌شده') },
                  { value: 'ongoing', label: lc('Ongoing', 'در حال اجرا') },
                  { value: 'archived', label: lc('Archived', 'بایگانی‌شده') },
                ]} />
                <Select label={lc('Confidential', 'محرمانه')} value={editing.isConfidential ? 'true' : 'false'} onChange={(v) => set('isConfidential', v === 'true')} options={[
                  { value: 'false', label: lc('Public', 'عمومی') },
                  { value: 'true', label: lc('Confidential (hide client)', 'محرمانه (مشتری مخفی)') },
                ]} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Select label={t('featured')} value={editing.featured ? 'true' : 'false'} onChange={(v) => set('featured', v === 'true')} options={[{ value: 'true', label: t('featured') }, { value: 'false', label: t('regular') }]} />
                <Select label={t('status')} value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('hidden') }]} />
                <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
              </div>
              <Input label={lc('Technology Filters (JSON array of categories)', 'فیلترهای فناوری (آرایه JSON از دسته‌ها)')} value={editing.technologyFilters} onChange={(v) => set('technologyFilters', v)} placeholder='["Networking","Security","Virtualization"]' />
              <div className="grid grid-cols-2 gap-4">
                <Input label={lc('Tags (EN, JSON array)', 'تگ‌ها (انگلیسی، آرایه JSON)')} value={editing.tagsEn} onChange={(v) => set('tagsEn', v)} placeholder='["Cisco","VMware"]' />
                <Input label={lc('Tags (FA, JSON array)', 'تگ‌ها (فارسی، آرایه JSON)')} value={editing.tagsFa} onChange={(v) => set('tagsFa', v)} />
              </div>
              <Input label={lc('Related Case Study Slugs (JSON array)', 'اسلاگ نمونه‌کارهای مرتبط (آرایه JSON)')} value={editing.relatedCaseStudySlugs} onChange={(v) => set('relatedCaseStudySlugs', v)} placeholder='["slug-one","slug-two"]' />
            </>
          )}

          {/* CASE STUDY */}
          {activeTab === 'casestudy' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label={lc('Executive Summary (EN)', 'خلاصه اجرایی (انگلیسی)')} value={editing.executiveSummaryEn} onChange={(v) => set('executiveSummaryEn', v)} multiline rows={4} placeholder="High-level summary for decision makers..." />
                <Input label={lc('Executive Summary (FA)', 'خلاصه اجرایی (فارسی)')} value={editing.executiveSummaryFa} onChange={(v) => set('executiveSummaryFa', v)} multiline rows={4} />
                <Input label={lc('Business Challenge (EN)', 'چالش کسب‌وکار (انگلیسی)')} value={editing.challengeEn} onChange={(v) => set('challengeEn', v)} multiline rows={3} />
                <Input label={lc('Business Challenge (FA)', 'چالش کسب‌وکار (فارسی)')} value={editing.challengeFa} onChange={(v) => set('challengeFa', v)} multiline rows={3} />
                <Input label={lc('Existing Infrastructure (EN)', 'زیرساخت فعلی (انگلیسی)')} value={editing.existingInfraEn} onChange={(v) => set('existingInfraEn', v)} multiline rows={3} />
                <Input label={lc('Existing Infrastructure (FA)', 'زیرساخت فعلی (فارسی)')} value={editing.existingInfraFa} onChange={(v) => set('existingInfraFa', v)} multiline rows={3} />
                <Input label={lc('Proposed Architecture (EN)', 'معماری پیشنهادی (انگلیسی)')} value={editing.proposedArchEn} onChange={(v) => set('proposedArchEn', v)} multiline rows={3} />
                <Input label={lc('Proposed Architecture (FA)', 'معماری پیشنهادی (فارسی)')} value={editing.proposedArchFa} onChange={(v) => set('proposedArchFa', v)} multiline rows={3} />
                <Input label={lc('Solution Overview (EN)', 'نمای کلی راهکار (انگلیسی)')} value={editing.solutionEn} onChange={(v) => set('solutionEn', v)} multiline rows={3} />
                <Input label={lc('Solution Overview (FA)', 'نمای کلی راهکار (فارسی)')} value={editing.solutionFa} onChange={(v) => set('solutionFa', v)} multiline rows={3} />
              </div>
            </>
          )}

          {/* TECHNICAL DETAILS */}
          {activeTab === 'technical' && (
            <>
              <div>
                <p className="text-xs text-text-secondary mb-1">{lc('Tech Stack (JSON array of objects with name, category, icon?, url?)', 'پشته فناوری (آرایه JSON از اشیاء با name، category، icon؟، url؟)')}</p>
                <Input label="" value={editing.techStackJson} onChange={(v) => set('techStackJson', v)} multiline rows={6} placeholder='[{"name":"Cisco","category":"Networking"},{"name":"VMware","category":"Virtualization"}]' />
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">{lc('Implementation Timeline (JSON array of phases)', 'جدول زمانی پیاده‌سازی (آرایه JSON از فازها)')}</p>
                <Input label="" value={editing.implementationTimelineJson} onChange={(v) => set('implementationTimelineJson', v)} multiline rows={6} placeholder='[{"phase":"Phase 1","titleEn":"Assessment","titleFa":"ارزیابی","durationEn":"2 weeks","durationFa":"۲ هفته","descriptionEn":"...","descriptionFa":"...","icon":"🔍"}]' />
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">{lc('Before/After Comparison (JSON array of comparison rows)', 'مقایسه قبل/بعد (آرایه JSON از ردیف‌های مقایسه)')}</p>
                <Input label="" value={editing.beforeAfterJson} onChange={(v) => set('beforeAfterJson', v)} multiline rows={5} placeholder='[{"aspectEn":"Network Speed","aspectFa":"سرعت شبکه","beforeEn":"100Mbps","beforeFa":"۱۰۰ مگابیت","afterEn":"10Gbps","afterFa":"۱۰ گیگابیت"}]' />
              </div>
            </>
          )}

          {/* STRATEGY & PROCESS */}
          {activeTab === 'strategy' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label={lc('Security Considerations (EN)', 'ملاحظات امنیتی (انگلیسی)')} value={editing.securityConsiderationsEn} onChange={(v) => set('securityConsiderationsEn', v)} multiline rows={3} />
                <Input label={lc('Security Considerations (FA)', 'ملاحظات امنیتی (فارسی)')} value={editing.securityConsiderationsFa} onChange={(v) => set('securityConsiderationsFa', v)} multiline rows={3} />
                <Input label={lc('HA & Availability Strategy (EN)', 'راهکار دسترس‌پذیری بالا (انگلیسی)')} value={editing.haAvailabilityEn} onChange={(v) => set('haAvailabilityEn', v)} multiline rows={3} />
                <Input label={lc('HA & Availability Strategy (FA)', 'راهکار دسترس‌پذیری بالا (فارسی)')} value={editing.haAvailabilityFa} onChange={(v) => set('haAvailabilityFa', v)} multiline rows={3} />
                <Input label={lc('Backup Strategy (EN)', 'راهکار پشتیبان‌گیری (انگلیسی)')} value={editing.backupStrategyEn} onChange={(v) => set('backupStrategyEn', v)} multiline rows={3} />
                <Input label={lc('Backup Strategy (FA)', 'راهکار پشتیبان‌گیری (فارسی)')} value={editing.backupStrategyFa} onChange={(v) => set('backupStrategyFa', v)} multiline rows={3} />
                <Input label={lc('Disaster Recovery (EN)', 'بازیابی فاجعه (انگلیسی)')} value={editing.disasterRecoveryEn} onChange={(v) => set('disasterRecoveryEn', v)} multiline rows={3} />
                <Input label={lc('Disaster Recovery (FA)', 'بازیابی فاجعه (فارسی)')} value={editing.disasterRecoveryFa} onChange={(v) => set('disasterRecoveryFa', v)} multiline rows={3} />
                <Input label={lc('Monitoring Strategy (EN)', 'راهکار پایش (انگلیسی)')} value={editing.monitoringStrategyEn} onChange={(v) => set('monitoringStrategyEn', v)} multiline rows={3} />
                <Input label={lc('Monitoring Strategy (FA)', 'راهکار پایش (فارسی)')} value={editing.monitoringStrategyFa} onChange={(v) => set('monitoringStrategyFa', v)} multiline rows={3} />
                <Input label={lc('Deployment Process (EN)', 'فرایند استقرار (انگلیسی)')} value={editing.deploymentProcessEn} onChange={(v) => set('deploymentProcessEn', v)} multiline rows={3} />
                <Input label={lc('Deployment Process (FA)', 'فرایند استقرار (فارسی)')} value={editing.deploymentProcessFa} onChange={(v) => set('deploymentProcessFa', v)} multiline rows={3} />
              </div>
            </>
          )}

          {/* RESULTS & IMPACT */}
          {activeTab === 'results' && (
            <>
              <div>
                <p className="text-xs text-text-secondary mb-1">{lc('Business Impact (JSON array of metrics with before/after)', 'تأثیر کسب‌وکار (آرایه JSON از معیارها با before/after)')}</p>
                <Input label="" value={editing.businessImpactJson} onChange={(v) => set('businessImpactJson', v)} multiline rows={6} placeholder='[{"metricEn":"Network Uptime","metricFa":"آپ‌تایم شبکه","before":"85%","after":"99.9%","unit":"","improvement":"+14.9%","icon":"📈"}]' />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label={lc('Key Results (EN, JSON array)', 'نتایج کلیدی (انگلیسی، آرایه JSON)')} value={editing.resultsEn} onChange={(v) => set('resultsEn', v)} multiline rows={4} placeholder='["Reduced downtime by 90%","Improved throughput 10x"]' />
                <Input label={lc('Key Results (FA, JSON array)', 'نتایج کلیدی (فارسی، آرایه JSON)')} value={editing.resultsFa} onChange={(v) => set('resultsFa', v)} multiline rows={4} />
                <Input label={lc('Lessons Learned (EN)', 'درس‌های آموخته‌شده (انگلیسی)')} value={editing.lessonsLearnedEn} onChange={(v) => set('lessonsLearnedEn', v)} multiline rows={3} />
                <Input label={lc('Lessons Learned (FA)', 'درس‌های آموخته‌شده (فارسی)')} value={editing.lessonsLearnedFa} onChange={(v) => set('lessonsLearnedFa', v)} multiline rows={3} />
                <Input label={lc('Future Improvements (EN)', 'بهبودهای آینده (انگلیسی)')} value={editing.futureImprovementsEn} onChange={(v) => set('futureImprovementsEn', v)} multiline rows={3} />
                <Input label={lc('Future Improvements (FA)', 'بهبودهای آینده (فارسی)')} value={editing.futureImprovementsFa} onChange={(v) => set('futureImprovementsFa', v)} multiline rows={3} />
              </div>
            </>
          )}

          {/* MEDIA & DOWNLOADS */}
          {activeTab === 'media' && (
            <>
              <MediaPicker label={lc('Cover Image', 'تصویر کاور')} value={editing.coverImage} onChange={(v) => set('coverImage', v)} folder="projects" placeholder={lc('Select cover image from media library', 'انتخاب تصویر کاور از کتابخانه رسانه')} />
              <MediaPicker label={lc('Client Logo', 'لوگوی مشتری')} value={editing.clientLogoUrl} onChange={(v) => set('clientLogoUrl', v)} folder="clients" placeholder={lc('Select client logo', 'انتخاب لوگوی مشتری')} />
              <MediaPicker label={lc('Network Diagram', 'نمودار شبکه')} value={editing.networkDiagramUrl} onChange={(v) => set('networkDiagramUrl', v)} folder="diagrams" placeholder={lc('Select network diagram', 'انتخاب نمودار شبکه')} />
              <MediaPicker label={lc('Infrastructure Diagram', 'نمودار زیرساخت')} value={editing.infraDiagramUrl} onChange={(v) => set('infraDiagramUrl', v)} folder="diagrams" placeholder={lc('Select infra diagram', 'انتخاب نمودار زیرساخت')} />
              <GalleryPicker label={lc(`Project Gallery (${galleryUrls.length} images)`, `گالری پروژه (${galleryUrls.length} تصویر)`)} value={galleryUrls} onChange={setGallery} folder="projects" />
              <div className="grid grid-cols-3 gap-4 pt-2">
                <Input label={lc('Download PDF URL', 'لینک دانلود PDF')} value={editing.downloadPdfUrl} onChange={(v) => set('downloadPdfUrl', v)} placeholder="/downloads/case-study.pdf" />
                <Input label={lc('Download Architecture URL', 'لینک دانلود معماری')} value={editing.downloadArchUrl} onChange={(v) => set('downloadArchUrl', v)} />
                <Input label={lc('Download Tech Summary URL', 'لینک دانلود خلاصه فنی')} value={editing.downloadTechSummaryUrl} onChange={(v) => set('downloadTechSummaryUrl', v)} />
              </div>
            </>
          )}

          {/* SEO */}
          {activeTab === 'seo' && (
            <>
              <Input label={t('seoTitle')} value={editing.seoTitle} onChange={(v) => set('seoTitle', v)} placeholder="Enterprise Network Upgrade Case Study | HBZ Technology" />
              <Input label={t('seoDescription')} value={editing.seoDescription} onChange={(v) => set('seoDescription', v)} multiline rows={3} placeholder="How HBZ Technology transformed..." />
              <Input label={lc('SEO Keywords', 'کلیدواژه‌های سئو')} value={editing.seoKeywords} onChange={(v) => set('seoKeywords', v)} placeholder="enterprise networking, cisco, vmware, case study" />
              <MediaPicker label={lc('OG Image', 'تصویر OG')} value={editing.ogImage} onChange={(v) => set('ogImage', v)} folder="seo" placeholder={lc('Select Open Graph image (1200x630)', 'انتخاب تصویر Open Graph (۱۲۰۰×۶۳۰)')} />
            </>
          )}

          <div className="flex gap-3 pt-2 border-t border-border">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
