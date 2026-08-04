'use client'

/**
 * Phase 28.1 — the personnel workspace.
 *
 * Two things this screen is careful about:
 *
 *  · **Sensitive columns.** The API omits national id and bank details without
 *    the grant, so the UI must not pretend they exist. When `canSeeSensitive`
 *    is false the fields are absent from the form and a note says why — an
 *    empty box the operator cannot fill is worse than an honest explanation.
 *  · **Employment history is a timeline, not an edit form.** A raise is
 *    recorded as a new record; the old one stays visible, because severance and
 *    payroll are computed from it.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { useDisplayCurrency, CurrencyPicker } from '@/lib/admin/currencyDisplay'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { deleteRowAction } from '@/lib/admin/rowDelete'
import { crud } from '@/lib/admin/crud'
import { toJalaliStr } from '@/lib/erp/jalali'
import {
  CONTRACT_TYPES, CONTRACT_LABELS, EMPLOYEE_STATUSES, STATUS_LABELS, maskNationalId,
  type ContractType, type EmployeeStatus,
} from '@/lib/hr/employees'

const L = (fa: boolean, en: string, faText: string) => (fa ? faText : en)

interface Employee {
  id: number
  employeeCode: string
  firstName: string
  lastName: string
  fullName: string
  nationalId?: string | null
  iban?: string | null
  mobile: string | null
  email: string | null
  status: EmployeeStatus
  hireDate: string | null
  departmentName: string | null
  currentSalary: number | null
  currentPosition: string | null
  contractType: ContractType | null
  serviceYears: number
}

interface EmploymentRow {
  id: number
  startDate: string
  endDate: string | null
  baseSalary: number
  contractType: ContractType
  positionTitle: string | null
  managerName: string | null
  changeReason: string | null
}

const EMPTY = {
  firstName: '', lastName: '', nationalId: '', iban: '', mobile: '', email: '',
  birthDate: '', gender: '', maritalStatus: '', childrenCount: '0',
  hireDate: '', status: 'active' as EmployeeStatus, address: '',
}

const EMPTY_EMPLOYMENT = {
  startDate: '', baseSalary: '', contractType: 'contract' as ContractType,
  workLocation: '', changeReason: '',
}

export function EmployeesManager() {
  const fa = useAdminLocale() === 'fa'
  const { money } = useDisplayCurrency()
  const { toast, ToastContainer } = useToast()

  const [rows, setRows] = useState<Employee[]>([])
  const [overview, setOverview] = useState<{ active: number; onLeave: number; terminated: number; total: number } | null>(null)
  const [canSeeSensitive, setCanSeeSensitive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<typeof EMPTY & { id?: number }>(EMPTY)
  const [fileFor, setFileFor] = useState<Employee | null>(null)
  const [history, setHistory] = useState<EmploymentRow[]>([])
  const [empModal, setEmpModal] = useState(false)
  const [empForm, setEmpForm] = useState(EMPTY_EMPLOYMENT)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/hr/employees')
    if (r.ok) {
      const d = await r.json()
      setRows(d.employees ?? [])
      setOverview(d.overview ?? null)
      setCanSeeSensitive(!!d.canSeeSensitive)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openFile = useCallback(async (e: Employee) => {
    setFileFor(e)
    const r = await fetch(`/api/admin/hr/employees?employment=${e.id}`)
    if (r.ok) setHistory((await r.json()).history ?? [])
  }, [])

  async function save() {
    const body: Record<string, unknown> = {
      ...(editing.id ? { id: editing.id } : {}),
      firstName: editing.firstName, lastName: editing.lastName,
      mobile: editing.mobile || null, email: editing.email || null,
      birthDate: editing.birthDate || null, gender: editing.gender || null,
      maritalStatus: editing.maritalStatus || null,
      childrenCount: Number(editing.childrenCount || 0),
      hireDate: editing.hireDate || null, status: editing.status,
      address: editing.address || null,
    }
    // Only send the sensitive fields when the operator is allowed to set them.
    if (canSeeSensitive) {
      body.nationalId = editing.nationalId || null
      body.iban = editing.iban || null
    }
    const res = await fetch('/api/admin/hr/employees', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { toast(L(fa, 'Saved', 'ذخیره شد'), 'success'); setModal(false); setEditing(EMPTY); load() }
    else toast(await crud.errorOf(res, L(fa, 'Save failed', 'ذخیره نشد')), 'error')
  }

  async function addEmployment() {
    if (!fileFor) return
    const res = await fetch('/api/admin/hr/employees', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'employment', employeeId: fileFor.id,
        startDate: empForm.startDate, baseSalary: Number(empForm.baseSalary || 0),
        contractType: empForm.contractType,
        workLocation: empForm.workLocation || null,
        changeReason: empForm.changeReason || null,
      }),
    })
    if (res.ok) {
      toast(L(fa, 'Employment record added', 'سابقهٔ استخدامی ثبت شد'), 'success')
      setEmpModal(false); setEmpForm(EMPTY_EMPLOYMENT); openFile(fileFor); load()
    } else toast(await crud.errorOf(res, L(fa, 'Failed', 'ناموفق')), 'error')
  }

  const jdate = (iso: string | null) => (iso ? (fa ? toJalaliStr(iso) : iso) : '—')
  const num = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')

  const columns: Column<Employee>[] = [
    { key: 'employeeCode', labelEn: 'Code', labelFa: 'کد پرسنلی',
      render: e => <span className="font-mono text-xs text-brand" dir="ltr">{e.employeeCode}</span> },
    { key: 'fullName', labelEn: 'Name', labelFa: 'نام',
      render: e => <div><div className="font-medium text-text-primary">{e.fullName}</div>
        <div className="text-xs text-text-tertiary">{e.currentPosition ?? e.departmentName ?? '—'}</div></div> },
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum',
      options: EMPLOYEE_STATUSES.map(s => ({ value: s, labelEn: STATUS_LABELS[s].en, labelFa: STATUS_LABELS[s].fa })),
      render: e => <Badge color={e.status === 'active' ? 'green' : e.status === 'on_leave' ? 'yellow' : 'slate'}>
        {fa ? STATUS_LABELS[e.status].fa : STATUS_LABELS[e.status].en}</Badge> },
    { key: 'contractType', labelEn: 'Contract', labelFa: 'نوع قرارداد',
      render: e => <span className="text-xs text-text-secondary">{e.contractType ? (fa ? CONTRACT_LABELS[e.contractType].fa : CONTRACT_LABELS[e.contractType].en) : '—'}</span> },
    { key: 'hireDate', labelEn: 'Hired', labelFa: 'تاریخ استخدام',
      render: e => <span className="text-xs text-text-secondary">{jdate(e.hireDate)}</span> },
    { key: 'serviceYears', labelEn: 'Service', labelFa: 'سنوات', numeric: true,
      render: e => <span className="tabular-nums text-text-secondary">{L(fa, `${num(e.serviceYears)} yr`, `${num(e.serviceYears)} سال`)}</span> },
    { key: 'mobile', labelEn: 'Mobile', labelFa: 'موبایل',
      render: e => <span className="text-xs text-text-tertiary font-mono" dir="ltr">{e.mobile ?? '—'}</span> },
    // Only rendered when the grant allows it — the value is absent otherwise.
    ...(canSeeSensitive ? [{
      key: 'nationalId', labelEn: 'National ID', labelFa: 'کد ملی',
      render: (e: Employee) => <span className="text-xs text-text-tertiary font-mono" dir="ltr">{maskNationalId(e.nationalId)}</span>,
    } as Column<Employee>] : []),
  ]

  const rowActions: RowAction<Employee>[] = [
    { id: 'file', labelEn: 'Personnel file', labelFa: 'پروندهٔ پرسنلی', icon: '📁', onClick: openFile },
    { id: 'edit', labelEn: 'Edit', labelFa: 'ویرایش', icon: '✎',
      onClick: e => {
        setEditing({
          id: e.id, firstName: e.firstName, lastName: e.lastName,
          nationalId: e.nationalId ?? '', iban: e.iban ?? '',
          mobile: e.mobile ?? '', email: e.email ?? '', birthDate: '', gender: '',
          maritalStatus: '', childrenCount: '0', hireDate: e.hireDate ?? '',
          status: e.status, address: '',
        })
        setModal(true)
      } },
    deleteRowAction<Employee>({
      path: '/api/admin/hr/employees', fa, toast, reload: load, labelOf: e => e.fullName,
    }),
  ]

  const kpi = (label: string, value: string, tone?: 'ok' | 'warn') => (
    <div className={`rounded-xl p-4 bg-surface-2 border ${tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : 'border-subtle'}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={L(fa, 'Employees', 'پرسنل')}
        subtitle={L(fa,
          'Personnel files and employment history — the basis for payroll and severance',
          'پروندهٔ پرسنلی و سوابق استخدامی — مبنای محاسبهٔ حقوق و سنوات')}
        action={<div className="flex items-center gap-2">
          <CurrencyPicker fa={fa} />
          <Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{L(fa, 'New employee', 'کارمند جدید')}</Btn>
        </div>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpi(L(fa, 'Active', 'شاغل'), num(overview?.active ?? 0), 'ok')}
        {kpi(L(fa, 'On leave', 'در مرخصی'), num(overview?.onLeave ?? 0), 'warn')}
        {kpi(L(fa, 'Terminated', 'ترک خدمت'), num(overview?.terminated ?? 0))}
        {kpi(L(fa, 'Total', 'کل'), num(overview?.total ?? 0))}
      </div>

      {!canSeeSensitive && (
        <div className="mb-4 rounded-xl border border-info/40 bg-info/10 px-4 py-3">
          <p className="text-sm text-text-secondary">
            {L(fa,
              'National ID and bank details are not shown — they require the “sensitive data” permission. They are omitted from the response, not merely hidden.',
              'کد ملی و اطلاعات بانکی نمایش داده نمی‌شوند — نیازمند دسترسی «دادهٔ حساس» هستند. این فیلدها اصلاً در پاسخ سرور نیستند، نه اینکه پنهان شده باشند.')}
          </p>
        </div>
      )}

      <DataTable<Employee>
        tableId="hr-employees" rows={rows} columns={columns} rowActions={rowActions}
        loading={loading} locale={fa ? 'fa' : 'en'} />

      {/* ── personnel file ── */}
      <Modal open={!!fileFor} onClose={() => setFileFor(null)}
        title={fileFor ? L(fa, `Personnel file — ${fileFor.fullName}`, `پروندهٔ پرسنلی — ${fileFor.fullName}`) : ''} size="lg">
        {fileFor && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-text-tertiary text-xs">{L(fa, 'Code', 'کد پرسنلی')}</p><p className="font-mono" dir="ltr">{fileFor.employeeCode}</p></div>
              <div><p className="text-text-tertiary text-xs">{L(fa, 'Hired', 'تاریخ استخدام')}</p><p>{jdate(fileFor.hireDate)}</p></div>
              <div><p className="text-text-tertiary text-xs">{L(fa, 'Service', 'سنوات')}</p><p>{L(fa, `${num(fileFor.serviceYears)} yr`, `${num(fileFor.serviceYears)} سال`)}</p></div>
              <div><p className="text-text-tertiary text-xs">{L(fa, 'Current salary', 'حقوق فعلی')}</p><p>{fileFor.currentSalary != null ? money(fileFor.currentSalary) : '—'}</p></div>
            </div>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Employment history', 'سوابق استخدامی')}</h3>
                <Btn size="sm" onClick={() => setEmpModal(true)}>{L(fa, 'Record a change', 'ثبت تغییر')}</Btn>
              </div>
              <p className="text-2xs text-text-tertiary mb-3">
                {L(fa,
                  'Records are never overwritten — a change closes the previous record and opens a new one, because severance and payroll are calculated from this history.',
                  'رکوردها بازنویسی نمی‌شوند — هر تغییر رکورد قبلی را می‌بندد و رکورد تازه باز می‌کند، چون سنوات و حقوق از همین تاریخچه محاسبه می‌شوند.')}
              </p>
              {history.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-4">{L(fa, 'No employment record yet.', 'هنوز سابقه‌ای ثبت نشده است.')}</p>
              ) : (
                <ul className="space-y-2">
                  {history.map(h => (
                    <li key={h.id} className="rounded-lg border border-subtle px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-primary">
                          {jdate(h.startDate)} — {h.endDate ? jdate(h.endDate) : L(fa, 'present', 'تاکنون')}
                        </span>
                        <span className="text-sm font-semibold text-text-primary">{money(h.baseSalary)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-2xs text-text-tertiary">
                        <span>{fa ? CONTRACT_LABELS[h.contractType].fa : CONTRACT_LABELS[h.contractType].en}</span>
                        {h.positionTitle && <span>{h.positionTitle}</span>}
                        {h.changeReason && <span>· {h.changeReason}</span>}
                        {!h.endDate && <Badge color="green">{L(fa, 'Current', 'جاری')}</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Modal>

      {/* ── employment change ── */}
      <Modal open={empModal} onClose={() => setEmpModal(false)} title={L(fa, 'Employment change', 'ثبت تغییر استخدامی')}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Effective from', 'از تاریخ')} value={empForm.startDate}
              onChange={v => setEmpForm(f => ({ ...f, startDate: v }))} placeholder="2026-01-01" />
            <Input label={L(fa, 'Base salary', 'حقوق پایه')} type="number" value={empForm.baseSalary}
              onChange={v => setEmpForm(f => ({ ...f, baseSalary: v }))} />
          </div>
          <Select label={L(fa, 'Contract type', 'نوع قرارداد')} value={empForm.contractType}
            onChange={v => setEmpForm(f => ({ ...f, contractType: v as ContractType }))}
            options={CONTRACT_TYPES.map(c => ({ value: c, label: fa ? CONTRACT_LABELS[c].fa : CONTRACT_LABELS[c].en }))} />
          <Input label={L(fa, 'Reason for change', 'دلیل تغییر')} value={empForm.changeReason}
            onChange={v => setEmpForm(f => ({ ...f, changeReason: v }))} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setEmpModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn onClick={addEmployment} disabled={!empForm.startDate}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── employee form ── */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing.id ? L(fa, 'Edit employee', 'ویرایش کارمند') : L(fa, 'New employee', 'کارمند جدید')}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'First name', 'نام')} value={editing.firstName} onChange={v => setEditing(e => ({ ...e, firstName: v }))} />
            <Input label={L(fa, 'Last name', 'نام خانوادگی')} value={editing.lastName} onChange={v => setEditing(e => ({ ...e, lastName: v }))} />
          </div>
          {canSeeSensitive && (
            <div className="grid grid-cols-2 gap-3">
              <Input label={L(fa, 'National ID', 'کد ملی')} value={editing.nationalId} onChange={v => setEditing(e => ({ ...e, nationalId: v }))} />
              <Input label={L(fa, 'IBAN', 'شبا')} value={editing.iban} onChange={v => setEditing(e => ({ ...e, iban: v }))} placeholder="IR…" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Mobile', 'موبایل')} value={editing.mobile} onChange={v => setEditing(e => ({ ...e, mobile: v }))} placeholder="09121234567" />
            <Input label={L(fa, 'Email', 'ایمیل')} value={editing.email} onChange={v => setEditing(e => ({ ...e, email: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={L(fa, 'Marital status', 'وضعیت تأهل')} value={editing.maritalStatus}
              onChange={v => setEditing(e => ({ ...e, maritalStatus: v }))}
              options={[{ value: '', label: '—' },
                { value: 'single', label: L(fa, 'Single', 'مجرد') },
                { value: 'married', label: L(fa, 'Married', 'متأهل') },
                { value: 'divorced', label: L(fa, 'Divorced', 'مطلقه') },
                { value: 'widowed', label: L(fa, 'Widowed', 'همسر فوت‌شده') }]} />
            <Input label={L(fa, 'Children', 'تعداد فرزند')} type="number" value={editing.childrenCount}
              onChange={v => setEditing(e => ({ ...e, childrenCount: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Hire date', 'تاریخ استخدام')} value={editing.hireDate}
              onChange={v => setEditing(e => ({ ...e, hireDate: v }))} placeholder="2026-01-01" />
            <Select label={L(fa, 'Status', 'وضعیت')} value={editing.status}
              onChange={v => setEditing(e => ({ ...e, status: v as EmployeeStatus }))}
              options={EMPLOYEE_STATUSES.map(s => ({ value: s, label: fa ? STATUS_LABELS[s].fa : STATUS_LABELS[s].en }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn onClick={save} disabled={!editing.firstName.trim() || !editing.lastName.trim()}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
