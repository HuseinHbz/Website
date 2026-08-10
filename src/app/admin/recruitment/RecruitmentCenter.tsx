'use client'

/**
 * Phase 28.5 بند ۱ — recruitment workspace: openings → candidates → a kanban
 * pipeline (reusing `usePointerDnd`, the exact CRM/opportunities helper — not
 * a new drag implementation) → interviews → offer → hire.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency } from '@/lib/admin/currencyDisplay'
import { usePointerDnd } from '@/lib/admin/pointerDnd'
import { crud } from '@/lib/admin/crud'
import { CONTRACT_TYPES, CONTRACT_LABELS } from '@/lib/hr/employees'
import { STAGE_LABELS, type ApplicationStage } from '@/lib/hr/recruitment'

const L = (fa: boolean, en: string, faText: string) => (fa ? faText : en)
const STAGES: ApplicationStage[] = ['screening', 'interview_1', 'interview_2', 'offer', 'hired', 'rejected']

interface Opening { id: number; titleFa: string; titleEn: string | null; headcount: number; status: string; applicants: number }
interface Candidate { id: number; fullName: string; mobile: string | null; email: string | null; source: string; status: string; convertedEmployeeId: number | null }
interface Application { id: number; candidateId: number; candidateName: string; openingId: number; openingTitle: string; stage: ApplicationStage; note: string | null }

export function RecruitmentCenter() {
  const fa = useAdminLocale() === 'fa'
  const { money } = useDisplayCurrency()
  const { toast, ToastContainer } = useToast()

  const [openings, setOpenings] = useState<Opening[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [overview, setOverview] = useState<{ openOpenings: number; activeCandidates: number; hiredThisYear: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const [openingModal, setOpeningModal] = useState(false)
  const [openingForm, setOpeningForm] = useState({ titleFa: '', titleEn: '', headcount: '1' })
  const [candidateModal, setCandidateModal] = useState(false)
  const [candidateForm, setCandidateForm] = useState({ fullName: '', mobile: '', email: '', source: 'site' })
  const [applyModal, setApplyModal] = useState(false)
  const [applyForm, setApplyForm] = useState({ candidateId: '', openingId: '' })
  const [hireModal, setHireModal] = useState<Application | null>(null)
  const [hireForm, setHireForm] = useState({ hireDate: '', baseSalary: '', contractType: 'permanent' as typeof CONTRACT_TYPES[number] })

  const load = useCallback(async () => {
    setLoading(true)
    const [o, c, a, ov] = await Promise.all([
      crud.get<{ openings: Opening[] }>('/api/admin/hr/recruitment?view=openings'),
      crud.get<{ candidates: Candidate[] }>('/api/admin/hr/recruitment?view=candidates'),
      crud.get<{ applications: Application[] }>('/api/admin/hr/recruitment?view=applications'),
      crud.get<{ overview: typeof overview }>('/api/admin/hr/recruitment?view=overview'),
    ])
    setOpenings(o?.openings ?? [])
    setCandidates(c?.candidates ?? [])
    setApplications(a?.applications ?? [])
    setOverview(ov?.overview ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function move(app: Application, stage: ApplicationStage) {
    if (stage === 'hired') { setHireModal(app); return }
    const res = await fetch('/api/admin/hr/recruitment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', id: app.id, stage }),
    })
    if (res.ok) { void load(); return }
    toast(await crud.errorOf(res, L(fa, 'Could not move the application', 'انتقال درخواست انجام نشد')), 'error')
  }

  const dnd = usePointerDnd<number>((id, stage) => {
    const app = applications.find(a => a.id === id)
    if (app && app.stage !== stage) void move(app, stage as ApplicationStage)
  })

  async function saveOpening() {
    const res = await fetch('/api/admin/hr/recruitment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'opening', titleFa: openingForm.titleFa, titleEn: openingForm.titleEn || null, headcount: Number(openingForm.headcount) || 1 }),
    })
    if (res.ok) { toast(L(fa, 'Saved', 'ذخیره شد'), 'success'); setOpeningModal(false); setOpeningForm({ titleFa: '', titleEn: '', headcount: '1' }); void load() }
    else toast(await crud.errorOf(res, 'Failed'), 'error')
  }

  async function saveCandidate() {
    const res = await fetch('/api/admin/hr/recruitment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'candidate', ...candidateForm, mobile: candidateForm.mobile || null, email: candidateForm.email || null }),
    })
    if (res.ok) { toast(L(fa, 'Saved', 'ذخیره شد'), 'success'); setCandidateModal(false); setCandidateForm({ fullName: '', mobile: '', email: '', source: 'site' }); void load() }
    else toast(await crud.errorOf(res, 'Failed'), 'error')
  }

  async function saveApplication() {
    const res = await fetch('/api/admin/hr/recruitment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'application', candidateId: Number(applyForm.candidateId), openingId: Number(applyForm.openingId) }),
    })
    if (res.ok) { toast(L(fa, 'Application filed', 'ثبت شد'), 'success'); setApplyModal(false); void load() }
    else toast(await crud.errorOf(res, 'Failed'), 'error')
  }

  async function hire() {
    if (!hireModal) return
    const res = await fetch('/api/admin/hr/recruitment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'hire', applicationId: hireModal.id, hireDate: hireForm.hireDate,
        baseSalary: Number(hireForm.baseSalary) || 0, contractType: hireForm.contractType,
      }),
    })
    if (res.ok) { toast(L(fa, 'Hired — an employee file was created', 'استخدام شد — پروندهٔ کارمند ساخته شد'), 'success'); setHireModal(null); void load() }
    else toast(await crud.errorOf(res, 'Failed'), 'error')
  }

  const stLabel = (s: ApplicationStage) => (fa ? STAGE_LABELS[s].fa : STAGE_LABELS[s].en)

  return (
    <div>
      <ToastContainer />
      <PageHeader title={L(fa, 'Recruitment', 'استخدام')} subtitle={L(fa, 'From opening to employee', 'از آگهی تا کارمند')}
        action={<div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setCandidateModal(true)}>{L(fa, '+ Candidate', '+ کاندیدا')}</Btn>
          <Btn onClick={() => setOpeningModal(true)}>{L(fa, '+ Opening', '+ آگهی')}</Btn>
        </div>} />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4"><p className="text-2xs text-text-tertiary">{L(fa, 'Open openings', 'آگهی‌های باز')}</p><p className="text-xl font-bold">{overview?.openOpenings ?? 0}</p></Card>
        <Card className="p-4"><p className="text-2xs text-text-tertiary">{L(fa, 'Active candidates', 'کاندیدای فعال')}</p><p className="text-xl font-bold">{overview?.activeCandidates ?? 0}</p></Card>
        <Card className="p-4"><p className="text-2xs text-text-tertiary">{L(fa, 'Hired this year', 'استخدام‌شده امسال')}</p><p className="text-xl font-bold">{overview?.hiredThisYear ?? 0}</p></Card>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{L(fa, 'Pipeline', 'خط لولهٔ استخدام')}</h3>
        <Btn size="sm" variant="secondary" onClick={() => setApplyModal(true)}>{L(fa, '+ New application', '+ ثبت درخواست')}</Btn>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {STAGES.map(stage => {
          const items = applications.filter(a => a.stage === stage)
          return (
            <div key={stage} {...dnd.zoneProps(stage)}
              className={`rounded-xl border p-2 min-h-[200px] transition-colors ${dnd.overZone === stage && dnd.dragId !== null ? 'bg-brand/10 border-brand' : 'bg-surface-2 border-subtle'}`}>
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-xs font-semibold text-text-secondary">{stLabel(stage)}</p>
                <span className="text-2xs text-text-tertiary tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(app => (
                  <div key={app.id} {...dnd.dragHandlers(app.id, stage)}
                    className="rounded-lg bg-surface border border-border p-2.5 hover:border-brand/50 transition-colors">
                    <p className="text-xs font-semibold truncate">{app.candidateName}</p>
                    <p className="text-2xs text-text-tertiary truncate">{app.openingTitle}</p>
                    <select value={app.stage} onChange={e => void move(app, e.target.value as ApplicationStage)}
                      aria-label={L(fa, 'Move to stage', 'انتقال به مرحله')}
                      className="form-input !py-0.5 !px-1 text-3xs w-full mt-1.5">
                      {STAGES.map(s => <option key={s} value={s}>{stLabel(s)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{L(fa, 'Openings', 'آگهی‌ها')}</h3>
          <div className="space-y-2">
            {openings.map(o => (
              <div key={o.id} className="flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2">
                <span>{fa ? o.titleFa : (o.titleEn ?? o.titleFa)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-text-tertiary">{o.applicants} {L(fa, 'applicants', 'متقاضی')}</span>
                  <Badge color={o.status === 'open' ? 'green' : 'slate'}>{o.status}</Badge>
                </div>
              </div>
            ))}
            {!loading && openings.length === 0 && <p className="text-xs text-text-tertiary">{L(fa, 'No openings yet', 'هنوز آگهی‌ای ثبت نشده')}</p>}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{L(fa, 'Candidates', 'کاندیداها')}</h3>
          <div className="space-y-2">
            {candidates.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2">
                <span>{c.fullName}</span>
                <Badge color={c.status === 'hired' ? 'green' : c.status === 'rejected' ? 'red' : 'blue'}>{c.status}</Badge>
              </div>
            ))}
            {!loading && candidates.length === 0 && <p className="text-xs text-text-tertiary">{L(fa, 'No candidates yet', 'هنوز کاندیدایی ثبت نشده')}</p>}
          </div>
        </Card>
      </div>

      <Modal open={openingModal} onClose={() => setOpeningModal(false)} title={L(fa, 'New opening', 'آگهی جدید')}>
          <div className="space-y-3">
            <Input label={L(fa, 'Title (fa)', 'عنوان (فارسی)')} value={openingForm.titleFa} onChange={v => setOpeningForm(s => ({ ...s, titleFa: v }))} />
            <Input label={L(fa, 'Title (en)', 'عنوان (انگلیسی)')} value={openingForm.titleEn} onChange={v => setOpeningForm(s => ({ ...s, titleEn: v }))} />
            <Input label={L(fa, 'Headcount', 'تعداد نیاز')} value={openingForm.headcount} onChange={v => setOpeningForm(s => ({ ...s, headcount: v }))} />
            <Btn onClick={saveOpening} disabled={!openingForm.titleFa}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </Modal>

      <Modal open={candidateModal} onClose={() => setCandidateModal(false)} title={L(fa, 'New candidate', 'کاندیدای جدید')}>
          <div className="space-y-3">
            <Input label={L(fa, 'Full name', 'نام کامل')} value={candidateForm.fullName} onChange={v => setCandidateForm(s => ({ ...s, fullName: v }))} />
            <Input label={L(fa, 'Mobile', 'موبایل')} value={candidateForm.mobile} onChange={v => setCandidateForm(s => ({ ...s, mobile: v }))} />
            <Input label={L(fa, 'Email', 'ایمیل')} value={candidateForm.email} onChange={v => setCandidateForm(s => ({ ...s, email: v }))} />
            <Select label={L(fa, 'Source', 'منبع')} value={candidateForm.source} onChange={v => setCandidateForm(s => ({ ...s, source: v }))}
              options={[['site', L(fa, 'Website', 'سایت')], ['referral', L(fa, 'Referral', 'ارجاع')], ['agency', L(fa, 'Agency', 'آژانس')], ['other', L(fa, 'Other', 'سایر')]].map(([v, l]) => ({ value: v, label: l }))} />
            <Btn onClick={saveCandidate} disabled={!candidateForm.fullName}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </Modal>

      <Modal open={applyModal} onClose={() => setApplyModal(false)} title={L(fa, 'New application', 'ثبت درخواست')}>
          <div className="space-y-3">
            <Select label={L(fa, 'Candidate', 'کاندیدا')} value={applyForm.candidateId} onChange={v => setApplyForm(s => ({ ...s, candidateId: v }))}
              options={[{ value: '', label: '—' }, ...candidates.map(c => ({ value: String(c.id), label: c.fullName }))]} />
            <Select label={L(fa, 'Opening', 'آگهی')} value={applyForm.openingId} onChange={v => setApplyForm(s => ({ ...s, openingId: v }))}
              options={[{ value: '', label: '—' }, ...openings.map(o => ({ value: String(o.id), label: fa ? o.titleFa : (o.titleEn ?? o.titleFa) }))]} />
            <Btn onClick={saveApplication} disabled={!applyForm.candidateId || !applyForm.openingId}>{L(fa, 'File', 'ثبت')}</Btn>
          </div>
        </Modal>

      <Modal open={!!hireModal} onClose={() => setHireModal(null)} title={L(fa, `Hire ${hireModal?.candidateName ?? ''}`, `استخدام ${hireModal?.candidateName ?? ''}`)}>
          <div className="space-y-3">
            <Input label={L(fa, 'Hire date', 'تاریخ شروع')} value={hireForm.hireDate} onChange={v => setHireForm(s => ({ ...s, hireDate: v }))} placeholder="1405-01-01" />
            <Input label={L(fa, 'Base salary', 'حقوق پایه')} value={hireForm.baseSalary} onChange={v => setHireForm(s => ({ ...s, baseSalary: v }))} />
            <Select label={L(fa, 'Contract type', 'نوع قرارداد')} value={hireForm.contractType} onChange={v => setHireForm(s => ({ ...s, contractType: v as typeof CONTRACT_TYPES[number] }))}
              options={CONTRACT_TYPES.map(c => ({ value: c, label: fa ? CONTRACT_LABELS[c].fa : CONTRACT_LABELS[c].en }))} />
            <p className="text-2xs text-text-tertiary">{money(Number(hireForm.baseSalary) || 0)}</p>
            <Btn onClick={hire} disabled={!hireForm.hireDate || !hireForm.baseSalary}>{L(fa, 'Confirm hire', 'تأیید استخدام')}</Btn>
          </div>
        </Modal>
    </div>
  )
}
