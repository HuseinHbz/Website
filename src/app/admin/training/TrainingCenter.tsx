'use client'

/**
 * Phase 28.5 بند ۲ — training assignment on top of the existing academy
 * `courses` catalog. HR enrolls (optionally mandatory) an employee into a
 * published course; the coverage panel shows completion of mandatory courses.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Select, PageHeader, Badge, Modal, Toggle, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { crud } from '@/lib/admin/crud'

const L = (fa: boolean, en: string, faText: string) => (fa ? faText : en)

interface Course { id: number; titleFa: string | null; titleEn: string }
interface Enrollment { id: number; employeeId: number; employeeName: string; courseId: number; titleFa: string | null; titleEn: string; mandatory: number; status: string }
interface Coverage { courseId: number; titleFa: string | null; titleEn: string; enrolled: number; completed: number; coveragePct: number }

export function TrainingCenter() {
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()

  const [courses, setCourses] = useState<Course[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [coverage, setCoverage] = useState<Coverage[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ employeeId: '', courseId: '', mandatory: false })
  const [employees, setEmployees] = useState<{ id: number; fullName: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [c, e, cov, emp] = await Promise.all([
      crud.get<{ courses: Course[] }>('/api/admin/hr/training?view=courses'),
      crud.get<{ enrollments: Enrollment[] }>('/api/admin/hr/training?view=enrollments'),
      crud.get<{ coverage: Coverage[] }>('/api/admin/hr/training?view=coverage'),
      crud.get<{ employees: { id: number; fullName: string }[] }>('/api/admin/hr/employees'),
    ])
    setCourses(c?.courses ?? [])
    setEnrollments(e?.enrollments ?? [])
    setCoverage(cov?.coverage ?? [])
    setEmployees(emp?.employees ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function enroll() {
    const res = await fetch('/api/admin/hr/training', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enroll', employeeId: Number(form.employeeId), courseId: Number(form.courseId), mandatory: form.mandatory }),
    })
    if (res.ok) { toast(L(fa, 'Enrolled', 'ثبت‌نام شد'), 'success'); setModal(false); setForm({ employeeId: '', courseId: '', mandatory: false }); void load() }
    else toast(await crud.errorOf(res, 'Failed'), 'error')
  }

  return (
    <div>
      <ToastContainer />
      <PageHeader title={L(fa, 'Organizational Training', 'آموزش سازمانی')}
        subtitle={L(fa, 'Built on the existing academy catalog', 'روی کاتالوگ آکادمی موجود')}
        action={<Btn onClick={() => setModal(true)}>{L(fa, '+ Enroll', '+ ثبت‌نام')}</Btn>} />

      {coverage.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3">{L(fa, 'Mandatory-course coverage', 'پوشش دوره‌های الزامی')}</h3>
          <div className="space-y-2">
            {coverage.map(c => (
              <div key={c.courseId} className="flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2">
                <span>{fa ? (c.titleFa ?? c.titleEn) : c.titleEn}</span>
                <span className="text-xs text-text-tertiary">{c.completed}/{c.enrolled} — {c.coveragePct}٪</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">{L(fa, 'Enrollments', 'ثبت‌نام‌ها')}</h3>
        <div className="space-y-2">
          {enrollments.map(e => (
            <div key={e.id} className="flex items-center justify-between text-sm border border-subtle rounded-lg px-3 py-2">
              <span>{e.employeeName} — {fa ? (e.titleFa ?? e.titleEn) : e.titleEn}</span>
              <div className="flex items-center gap-2">
                {e.mandatory === 1 && <Badge color="yellow">{L(fa, 'Mandatory', 'الزامی')}</Badge>}
                <Badge color={e.status === 'completed' ? 'green' : 'blue'}>{e.status}</Badge>
              </div>
            </div>
          ))}
          {!loading && enrollments.length === 0 && <p className="text-xs text-text-tertiary">{L(fa, 'No enrollments yet', 'هنوز ثبت‌نامی نشده')}</p>}
        </div>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={L(fa, 'Enroll an employee', 'ثبت‌نام کارمند')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Employee', 'کارمند')} value={form.employeeId} onChange={v => setForm(s => ({ ...s, employeeId: v }))}
            options={[{ value: '', label: '—' }, ...employees.map(e => ({ value: String(e.id), label: e.fullName }))]} />
          <Select label={L(fa, 'Course', 'دوره')} value={form.courseId} onChange={v => setForm(s => ({ ...s, courseId: v }))}
            options={[{ value: '', label: '—' }, ...courses.map(c => ({ value: String(c.id), label: fa ? (c.titleFa ?? c.titleEn) : c.titleEn }))]} />
          <Toggle checked={form.mandatory} onChange={v => setForm(s => ({ ...s, mandatory: v }))} label={L(fa, 'Mandatory', 'الزامی')} />
          <Btn onClick={enroll} disabled={!form.employeeId || !form.courseId}>{L(fa, 'Enroll', 'ثبت‌نام')}</Btn>
        </div>
      </Modal>
    </div>
  )
}
