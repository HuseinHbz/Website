'use client'

/**
 * Phase 28.5 بند ۳ — performance review workspace, gated by
 * `reviewDataGate()`: without a real management chain on file, the cycle/
 * template framework still works, but the analytical claim "your team's
 * performance trend" would be a number over near-empty data — so this screen
 * shows the gate result plainly instead of a chart that would be lying.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { crud } from '@/lib/admin/crud'

const L = (fa: boolean, en: string, faText: string) => (fa ? faText : en)

interface Gate { ready: boolean; activeEmployees: number; withManager: number; coveragePct: number; threshold: number }
interface Cycle { id: number; nameFa: string; nameEn: string | null; period: string; startDate: string; endDate: string; status: string }
interface ReviewRow { id: number; employeeId: number; employeeName: string; reviewerId: number | null; kind: string; overallScore: number | null; status: string }

export function ReviewCenter() {
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()

  const [gate, setGate] = useState<Gate | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [activeCycle, setActiveCycle] = useState<number | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cycleModal, setCycleModal] = useState(false)
  const [cycleForm, setCycleForm] = useState({ nameFa: '', period: '', startDate: '', endDate: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [g, c] = await Promise.all([
      crud.get<{ gate: Gate }>('/api/admin/hr/reviews?view=gate'),
      crud.get<{ cycles: Cycle[] }>('/api/admin/hr/reviews?view=cycles'),
    ])
    setGate(g?.gate ?? null)
    setCycles(c?.cycles ?? [])
    if (c?.cycles?.[0]) setActiveCycle(c.cycles[0].id)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!activeCycle) { setReviews([]); return }
    void crud.get<{ reviews: ReviewRow[] }>(`/api/admin/hr/reviews?view=reviews&cycleId=${activeCycle}`)
      .then(r => setReviews(r?.reviews ?? []))
  }, [activeCycle])

  async function saveCycle() {
    const res = await fetch('/api/admin/hr/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cycle', ...cycleForm }),
    })
    if (res.ok) { toast(L(fa, 'Cycle created', 'دوره ساخته شد'), 'success'); setCycleModal(false); setCycleForm({ nameFa: '', period: '', startDate: '', endDate: '' }); void load() }
    else toast(await crud.errorOf(res, 'Failed'), 'error')
  }

  async function finalize(id: number) {
    const res = await fetch('/api/admin/hr/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finalize', id }),
    })
    if (res.ok) {
      toast(L(fa, 'Finalized — frozen from now on', 'نهایی شد — از این پس منجمد است'), 'success')
      if (activeCycle) void crud.get<{ reviews: ReviewRow[] }>(`/api/admin/hr/reviews?view=reviews&cycleId=${activeCycle}`).then(r => setReviews(r?.reviews ?? []))
    } else toast(await crud.errorOf(res, 'Failed'), 'error')
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader title={L(fa, 'Performance Reviews', 'ارزیابی عملکرد')}
        subtitle={L(fa, 'Cycle-based, append-only once finalized', 'دوره‌ای — پس از نهایی‌سازی تغییرناپذیر')}
        action={<Btn onClick={() => setCycleModal(true)}>{L(fa, '+ Cycle', '+ دوره')}</Btn>} />

      {gate && (
        <Card className={`p-4 mb-6 border ${gate.ready ? 'border-success/30' : 'border-warning/30'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{L(fa, 'Management-chain data gate', 'گیت دادهٔ سلسله‌مراتب مدیریتی')}</p>
              <p className="text-xs text-text-tertiary mt-1">
                {L(fa,
                  `${gate.withManager} of ${gate.activeEmployees} active employees have a manager on file (${gate.coveragePct}%, threshold ${gate.threshold}%).`,
                  `${gate.withManager} از ${gate.activeEmployees} کارمند فعال، مدیر ثبت‌شده دارند (${gate.coveragePct}٪، آستانه ${gate.threshold}٪).`)}
              </p>
            </div>
            <Badge color={gate.ready ? 'green' : 'yellow'}>
              {gate.ready ? L(fa, 'Analytics enabled', 'تحلیل فعال') : L(fa, 'Framework only — analytics deferred', 'فقط چارچوب — تحلیل deferred')}
            </Badge>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold">{L(fa, 'Cycles', 'دوره‌ها')}</h3>
          <Select value={activeCycle ? String(activeCycle) : ''} onChange={v => setActiveCycle(v ? Number(v) : null)}
            options={cycles.map(c => ({ value: String(c.id), label: `${c.nameFa} (${c.period})` }))} />
        </div>
        <div className="space-y-2">
          {reviews.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2">
              <span>{r.employeeName} — {r.kind}</span>
              <div className="flex items-center gap-2">
                {r.overallScore != null && <span className="text-xs text-text-tertiary tabular-nums">{r.overallScore}</span>}
                <Badge color={r.status === 'finalized' ? 'green' : r.status === 'submitted' ? 'blue' : 'slate'}>{r.status}</Badge>
                {r.status === 'submitted' && <Btn size="sm" variant="secondary" onClick={() => void finalize(r.id)}>{L(fa, 'Finalize', 'نهایی‌سازی')}</Btn>}
              </div>
            </div>
          ))}
          {!loading && reviews.length === 0 && <p className="text-xs text-text-tertiary">{L(fa, 'No reviews in this cycle yet', 'هنوز ارزیابی‌ای در این دوره نیست')}</p>}
        </div>
      </Card>

      <Modal open={cycleModal} onClose={() => setCycleModal(false)} title={L(fa, 'New review cycle', 'دورهٔ ارزیابی جدید')}>
        <div className="space-y-3">
          <Input label={L(fa, 'Name (fa)', 'نام (فارسی)')} value={cycleForm.nameFa} onChange={v => setCycleForm(s => ({ ...s, nameFa: v }))} />
          <Input label={L(fa, 'Period (e.g. 1405-Q1)', 'دوره (مثلاً ۱۴۰۵-س۱)')} value={cycleForm.period} onChange={v => setCycleForm(s => ({ ...s, period: v }))} />
          <Input label={L(fa, 'Start date', 'تاریخ شروع')} value={cycleForm.startDate} onChange={v => setCycleForm(s => ({ ...s, startDate: v }))} />
          <Input label={L(fa, 'End date', 'تاریخ پایان')} value={cycleForm.endDate} onChange={v => setCycleForm(s => ({ ...s, endDate: v }))} />
          <Btn onClick={saveCycle} disabled={!cycleForm.nameFa || !cycleForm.period}>{L(fa, 'Create', 'ساخت')}</Btn>
        </div>
      </Modal>
    </div>
  )
}
