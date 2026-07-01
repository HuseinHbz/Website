'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast, ColorDot } from '@/components/admin/ui'
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
  const isFa = locale === 'fa'
  const [projects, setProjects] = useState<Project[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Project>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const { toast, ToastContainer } = useToast()

  async function load() {
    try {
      const r = await fetch('/api/admin/projects')
      if (!r.ok) return
      const d = await r.json()
      setProjects(Array.isArray(d) ? d : [])
    } catch { /* network error — leave existing list */ }
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/projects', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(t('failed'), 'error')
  }

  async function del(id: number) {
    if (!confirm(t('confirmDel'))) return
    const res = await fetch('/api/admin/projects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) { toast(t('deleted')); load() } else toast(t('failed'), 'error')
  }

  async function toggle(p: Project) {
    const res = await fetch('/api/admin/projects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, active: !p.active }) })
    if (res.ok) { toast(t('saved')); load() } else toast(t('failed'), 'error')
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
        <Table headers={[t('name'), t('industry'), t('status'), t('featured'), t('cover'), t('actions')]}>
          {projects.map((p) => (
            <TR key={p.id}>
              <TD>
                <div className="flex items-center gap-2">
                  <ColorDot color={p.color} />
                  <div>
                    <div className="font-medium text-white">{isFa ? p.nameFa : p.nameEn}</div>
                    <div className="text-xs text-text-tertiary">{isFa ? p.nameEn : p.nameFa} · {p.year}</div>
                    <div className="text-[10px] text-text-disabled">{p.slug}</div>
                  </div>
                </div>
              </TD>
              <TD className="text-text-secondary text-xs">{isFa ? p.industryFa : p.industryEn}</TD>
              <TD>
                <Badge color={p.projectStatus === 'completed' ? 'green' : p.projectStatus === 'ongoing' ? 'indigo' : 'slate'}>
                  {t(p.projectStatus || 'completed')}
                </Badge>
              </TD>
              <TD><Badge color={p.featured ? 'indigo' : 'slate'}>{p.featured ? `★ ${t('featured')}` : t('regular')}</Badge></TD>
              <TD>
                {p.coverImage
                  ? <img src={p.coverImage} alt="" className="w-10 h-10 object-cover rounded-lg border border-border" />
                  : <span className="text-text-disabled text-xs">—</span>}
              </TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => openEdit(p)}>{t('edit')}</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => toggle(p)}>{p.active ? '⏸' : '▶'}</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(p.id!)}>{t('delete')}</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('editCaseStudy') : t('newCaseStudyModal')} size="xl">
        {/* Tab nav */}
        <div className="flex gap-1 mb-5 border-b border-border pb-3 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${activeTab === tab.id ? 'bg-brand text-white' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
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
                <Input label="Slug *" value={editing.slug} onChange={(v) => set('slug', v)} placeholder="enterprise-network-upgrade" />
                <Input label="Year" value={editing.year} onChange={(v) => set('year', v)} placeholder="2024" />
                <Input label="Brand Color" type="color" value={editing.color} onChange={(v) => set('color', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Name (EN)" value={editing.nameEn} onChange={(v) => set('nameEn', v)} />
                <Input label="Name (FA)" value={editing.nameFa} onChange={(v) => set('nameFa', v)} />
                <Input label="Industry (EN)" value={editing.industryEn} onChange={(v) => set('industryEn', v)} />
                <Input label="Industry (FA)" value={editing.industryFa} onChange={(v) => set('industryFa', v)} />
                <Input label="Client (EN)" value={editing.clientEn} onChange={(v) => set('clientEn', v)} />
                <Input label="Client (FA)" value={editing.clientFa} onChange={(v) => set('clientFa', v)} />
                <Input label="Business Scope (EN)" value={editing.businessScopeEn} onChange={(v) => set('businessScopeEn', v)} placeholder="Enterprise-grade, 500+ employees" />
                <Input label="Business Scope (FA)" value={editing.businessScopeFa} onChange={(v) => set('businessScopeFa', v)} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Select label="Collaboration Type" value={editing.collaborationType} onChange={(v) => set('collaborationType', v)} options={[
                  { value: 'implementation', label: 'Implementation' },
                  { value: 'consulting', label: 'Consulting' },
                  { value: 'design', label: 'Design' },
                  { value: 'managed_service', label: 'Managed Service' },
                ]} />
                <Select label="Project Status" value={editing.projectStatus} onChange={(v) => set('projectStatus', v)} options={[
                  { value: 'completed', label: 'Completed' },
                  { value: 'ongoing', label: 'Ongoing' },
                  { value: 'archived', label: 'Archived' },
                ]} />
                <Select label="Confidential" value={editing.isConfidential ? 'true' : 'false'} onChange={(v) => set('isConfidential', v === 'true')} options={[
                  { value: 'false', label: 'Public' },
                  { value: 'true', label: 'Confidential (hide client)' },
                ]} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Select label={t('featured')} value={editing.featured ? 'true' : 'false'} onChange={(v) => set('featured', v === 'true')} options={[{ value: 'true', label: t('featured') }, { value: 'false', label: t('regular') }]} />
                <Select label={t('status')} value={editing.active ? 'true' : 'false'} onChange={(v) => set('active', v === 'true')} options={[{ value: 'true', label: t('active') }, { value: 'false', label: t('hidden') }]} />
                <Input label={t('sortOrder')} type="number" value={String(editing.sortOrder)} onChange={(v) => set('sortOrder', Number(v))} />
              </div>
              <Input label="Technology Filters (JSON array of categories)" value={editing.technologyFilters} onChange={(v) => set('technologyFilters', v)} placeholder='["Networking","Security","Virtualization"]' />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Tags (EN, JSON array)" value={editing.tagsEn} onChange={(v) => set('tagsEn', v)} placeholder='["Cisco","VMware"]' />
                <Input label="Tags (FA, JSON array)" value={editing.tagsFa} onChange={(v) => set('tagsFa', v)} />
              </div>
              <Input label="Related Case Study Slugs (JSON array)" value={editing.relatedCaseStudySlugs} onChange={(v) => set('relatedCaseStudySlugs', v)} placeholder='["slug-one","slug-two"]' />
            </>
          )}

          {/* CASE STUDY */}
          {activeTab === 'casestudy' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Executive Summary (EN)" value={editing.executiveSummaryEn} onChange={(v) => set('executiveSummaryEn', v)} multiline rows={4} placeholder="High-level summary for decision makers..." />
                <Input label="Executive Summary (FA)" value={editing.executiveSummaryFa} onChange={(v) => set('executiveSummaryFa', v)} multiline rows={4} />
                <Input label="Business Challenge (EN)" value={editing.challengeEn} onChange={(v) => set('challengeEn', v)} multiline rows={3} />
                <Input label="Business Challenge (FA)" value={editing.challengeFa} onChange={(v) => set('challengeFa', v)} multiline rows={3} />
                <Input label="Existing Infrastructure (EN)" value={editing.existingInfraEn} onChange={(v) => set('existingInfraEn', v)} multiline rows={3} />
                <Input label="Existing Infrastructure (FA)" value={editing.existingInfraFa} onChange={(v) => set('existingInfraFa', v)} multiline rows={3} />
                <Input label="Proposed Architecture (EN)" value={editing.proposedArchEn} onChange={(v) => set('proposedArchEn', v)} multiline rows={3} />
                <Input label="Proposed Architecture (FA)" value={editing.proposedArchFa} onChange={(v) => set('proposedArchFa', v)} multiline rows={3} />
                <Input label="Solution Overview (EN)" value={editing.solutionEn} onChange={(v) => set('solutionEn', v)} multiline rows={3} />
                <Input label="Solution Overview (FA)" value={editing.solutionFa} onChange={(v) => set('solutionFa', v)} multiline rows={3} />
              </div>
            </>
          )}

          {/* TECHNICAL DETAILS */}
          {activeTab === 'technical' && (
            <>
              <div>
                <p className="text-xs text-text-secondary mb-1">Tech Stack (JSON array of objects with name, category, icon?, url?)</p>
                <Input label="" value={editing.techStackJson} onChange={(v) => set('techStackJson', v)} multiline rows={6} placeholder='[{"name":"Cisco","category":"Networking"},{"name":"VMware","category":"Virtualization"}]' />
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Implementation Timeline (JSON array of phases)</p>
                <Input label="" value={editing.implementationTimelineJson} onChange={(v) => set('implementationTimelineJson', v)} multiline rows={6} placeholder='[{"phase":"Phase 1","titleEn":"Assessment","titleFa":"ارزیابی","durationEn":"2 weeks","durationFa":"۲ هفته","descriptionEn":"...","descriptionFa":"...","icon":"🔍"}]' />
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Before/After Comparison (JSON array of comparison rows)</p>
                <Input label="" value={editing.beforeAfterJson} onChange={(v) => set('beforeAfterJson', v)} multiline rows={5} placeholder='[{"aspectEn":"Network Speed","aspectFa":"سرعت شبکه","beforeEn":"100Mbps","beforeFa":"۱۰۰ مگابیت","afterEn":"10Gbps","afterFa":"۱۰ گیگابیت"}]' />
              </div>
            </>
          )}

          {/* STRATEGY & PROCESS */}
          {activeTab === 'strategy' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Security Considerations (EN)" value={editing.securityConsiderationsEn} onChange={(v) => set('securityConsiderationsEn', v)} multiline rows={3} />
                <Input label="Security Considerations (FA)" value={editing.securityConsiderationsFa} onChange={(v) => set('securityConsiderationsFa', v)} multiline rows={3} />
                <Input label="HA & Availability Strategy (EN)" value={editing.haAvailabilityEn} onChange={(v) => set('haAvailabilityEn', v)} multiline rows={3} />
                <Input label="HA & Availability Strategy (FA)" value={editing.haAvailabilityFa} onChange={(v) => set('haAvailabilityFa', v)} multiline rows={3} />
                <Input label="Backup Strategy (EN)" value={editing.backupStrategyEn} onChange={(v) => set('backupStrategyEn', v)} multiline rows={3} />
                <Input label="Backup Strategy (FA)" value={editing.backupStrategyFa} onChange={(v) => set('backupStrategyFa', v)} multiline rows={3} />
                <Input label="Disaster Recovery (EN)" value={editing.disasterRecoveryEn} onChange={(v) => set('disasterRecoveryEn', v)} multiline rows={3} />
                <Input label="Disaster Recovery (FA)" value={editing.disasterRecoveryFa} onChange={(v) => set('disasterRecoveryFa', v)} multiline rows={3} />
                <Input label="Monitoring Strategy (EN)" value={editing.monitoringStrategyEn} onChange={(v) => set('monitoringStrategyEn', v)} multiline rows={3} />
                <Input label="Monitoring Strategy (FA)" value={editing.monitoringStrategyFa} onChange={(v) => set('monitoringStrategyFa', v)} multiline rows={3} />
                <Input label="Deployment Process (EN)" value={editing.deploymentProcessEn} onChange={(v) => set('deploymentProcessEn', v)} multiline rows={3} />
                <Input label="Deployment Process (FA)" value={editing.deploymentProcessFa} onChange={(v) => set('deploymentProcessFa', v)} multiline rows={3} />
              </div>
            </>
          )}

          {/* RESULTS & IMPACT */}
          {activeTab === 'results' && (
            <>
              <div>
                <p className="text-xs text-text-secondary mb-1">Business Impact (JSON array of metrics with before/after)</p>
                <Input label="" value={editing.businessImpactJson} onChange={(v) => set('businessImpactJson', v)} multiline rows={6} placeholder='[{"metricEn":"Network Uptime","metricFa":"آپ‌تایم شبکه","before":"85%","after":"99.9%","unit":"","improvement":"+14.9%","icon":"📈"}]' />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Key Results (EN, JSON array)" value={editing.resultsEn} onChange={(v) => set('resultsEn', v)} multiline rows={4} placeholder='["Reduced downtime by 90%","Improved throughput 10x"]' />
                <Input label="Key Results (FA, JSON array)" value={editing.resultsFa} onChange={(v) => set('resultsFa', v)} multiline rows={4} />
                <Input label="Lessons Learned (EN)" value={editing.lessonsLearnedEn} onChange={(v) => set('lessonsLearnedEn', v)} multiline rows={3} />
                <Input label="Lessons Learned (FA)" value={editing.lessonsLearnedFa} onChange={(v) => set('lessonsLearnedFa', v)} multiline rows={3} />
                <Input label="Future Improvements (EN)" value={editing.futureImprovementsEn} onChange={(v) => set('futureImprovementsEn', v)} multiline rows={3} />
                <Input label="Future Improvements (FA)" value={editing.futureImprovementsFa} onChange={(v) => set('futureImprovementsFa', v)} multiline rows={3} />
              </div>
            </>
          )}

          {/* MEDIA & DOWNLOADS */}
          {activeTab === 'media' && (
            <>
              <MediaPicker label="Cover Image" value={editing.coverImage} onChange={(v) => set('coverImage', v)} folder="projects" placeholder="Select cover image from media library" />
              <MediaPicker label="Client Logo" value={editing.clientLogoUrl} onChange={(v) => set('clientLogoUrl', v)} folder="clients" placeholder="Select client logo" />
              <MediaPicker label="Network Diagram" value={editing.networkDiagramUrl} onChange={(v) => set('networkDiagramUrl', v)} folder="diagrams" placeholder="Select network diagram" />
              <MediaPicker label="Infrastructure Diagram" value={editing.infraDiagramUrl} onChange={(v) => set('infraDiagramUrl', v)} folder="diagrams" placeholder="Select infra diagram" />
              <GalleryPicker label={`Project Gallery (${galleryUrls.length} images)`} value={galleryUrls} onChange={setGallery} folder="projects" />
              <div className="grid grid-cols-3 gap-4 pt-2">
                <Input label="Download PDF URL" value={editing.downloadPdfUrl} onChange={(v) => set('downloadPdfUrl', v)} placeholder="/downloads/case-study.pdf" />
                <Input label="Download Architecture URL" value={editing.downloadArchUrl} onChange={(v) => set('downloadArchUrl', v)} />
                <Input label="Download Tech Summary URL" value={editing.downloadTechSummaryUrl} onChange={(v) => set('downloadTechSummaryUrl', v)} />
              </div>
            </>
          )}

          {/* SEO */}
          {activeTab === 'seo' && (
            <>
              <Input label="SEO Title" value={editing.seoTitle} onChange={(v) => set('seoTitle', v)} placeholder="Enterprise Network Upgrade Case Study | HBZ Technology" />
              <Input label="SEO Description" value={editing.seoDescription} onChange={(v) => set('seoDescription', v)} multiline rows={3} placeholder="How HBZ Technology transformed..." />
              <Input label="SEO Keywords" value={editing.seoKeywords} onChange={(v) => set('seoKeywords', v)} placeholder="enterprise networking, cisco, vmware, case study" />
              <MediaPicker label="OG Image" value={editing.ogImage} onChange={(v) => set('ogImage', v)} folder="seo" placeholder="Select Open Graph image (1200x630)" />
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
