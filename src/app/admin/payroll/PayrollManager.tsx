'use client'

/**
 * Phase 28.3-الف — payroll workspace.
 *
 * The settings tabs are not an accessory to this screen, they are the point of
 * it: the operator must be able to build next year's ruleset — new brackets,
 * new rates, even a brand-new earning with its own insurable/taxable flags —
 * without a developer. So the bracket editor validates as you type, the
 * preview answers "what tax would this income pay?" before anything is
 * approved, and a ruleset that has already issued slips is read-only with the
 * reason stated rather than silently disabled.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { crud } from '@/lib/admin/crud'
import { formatCurrency } from '@/lib/format'
import {
  validateBrackets, JALALI_MONTHS_FA, JALALI_MONTHS_EN,
  PERIOD_STATUS_LABELS, type PeriodStatus,
} from '@/lib/hr/payroll'

const L = (fa: boolean, en: string, faText: string) => (fa ? faText : en)

interface Ruleset {
  id: number; year: number; version: number; title: string | null
  effectiveFrom: string; effectiveTo: string | null; source: string | null
  status: 'draft' | 'approved' | 'archived'; slipCount: number
}
interface Parameter {
  id: number; group: string; key: string; labelFa: string; labelEn: string
  valueType: string; value: number; unit: string | null; description: string | null
}
interface Bracket { id?: number; seq: number; fromAmount: number; toAmount: number | null; ratePercent: number }
interface EarningRow {
  id: number; key: string; labelFa: string; labelEn: string; earningGroup: string
  recurring: boolean; insurable: string; insurableCap: number | null
  taxable: string; taxableCap: number | null
  inEidBase: boolean; inSeveranceBase: boolean; inOvertimeBase: boolean
  calcMethod: string; calcValue: number; paramKey: string | null; active: boolean; sortOrder: number
}
interface Period {
  id: number; rulesetId: number; jalaliYear: number; jalaliMonth: number
  startDate: string; endDate: string; daysInMonth: number
  status: PeriodStatus; glEntryId: number | null; slipCount: number
  totalNet: number; totalGross: number; totalTax: number
}
interface Slip {
  id: number; employeeId: number; employeeName: string; employeeCode: string
  gross?: number; net?: number; tax?: number; employeeInsurance?: number
  insuranceBase?: number; status: string
}
interface TaxRow { seq: number; from: number; to: number | null; ratePercent: number; amountInBracket: number; tax: number }

type Tab = 'periods' | 'slips' | 'bank' | 'advances' | 'eid' | 'severance' | 'settlements' | 'exports'
  | 'rulesets' | 'tax' | 'insurance' | 'earnings' | 'loans'

const TABS: { id: Tab; en: string; fa: string }[] = [
  { id: 'periods', en: 'Payroll runs', fa: 'دوره‌های حقوق' },
  { id: 'slips', en: 'Payslips', fa: 'فیش‌ها' },
  { id: 'bank', en: 'Bank payment', fa: 'پرداخت بانکی' },
  { id: 'advances', en: 'Advances', fa: 'مساعده' },
  { id: 'eid', en: 'Eid bonus', fa: 'عیدی' },
  { id: 'severance', en: 'Severance', fa: 'سنوات پایان خدمت' },
  { id: 'settlements', en: 'Final settlement', fa: 'تسویه‌حساب' },
  { id: 'exports', en: 'Legal exports', fa: 'خروجی‌های قانونی' },
  { id: 'rulesets', en: 'Rule versions', fa: 'نسخه‌های قوانین' },
  { id: 'tax', en: 'Tax brackets', fa: 'پلکان مالیاتی' },
  { id: 'insurance', en: 'Rates & allowances', fa: 'نرخ‌ها و مزایا' },
  { id: 'earnings', en: 'Earning types', fa: 'اقلام حقوقی' },
  { id: 'loans', en: 'Loans', fa: 'وام‌ها' },
]

interface EidRow {
  id: number; employeeId: number; employeeName: string; employeeCode: string
  jalaliYear: number; serviceDays: number; monthlyBase?: number
  amount?: number; tax?: number; net?: number; status: string; glEntryId: number | null
}
interface SeveranceRow {
  id: number; employeeId: number; employeeName: string; employeeCode: string
  fromDate: string; toDate: string; serviceDays: number; dailyBase?: number
  basePolicy: string; amount?: number; accruedBefore?: number
  status: string; glEntryId: number | null
}
interface SettlementRow {
  id: number; employeeId: number; employeeName: string; employeeCode: string
  endDate: string; reason: string | null
  finalPay?: number; severance?: number; eid?: number; leaveEncashment?: number
  leaveDays: number; loanOutstanding?: number; total?: number
  status: string; glEntryId: number | null
}
interface ExportLayout {
  id: number; key: string; titleFa: string; titleEn: string; kind: string
  delimiter: string; includeHeader: boolean
  columns: { key: string; labelFa: string }[]
  verified: boolean; note: string | null
}
interface BankFormat {
  id: number; key: string; bankName: string; fileType: string
  columns: { key: string; labelFa: string }[]; verified: boolean; note: string | null
}
interface BankBatch {
  id: number; periodId: number; formatId: number | null; formatName: string | null
  sourceAccount: string | null; paymentDate: string | null
  recordCount: number; totalAmount?: number; status: string; glEntryId: number | null
}
interface AdvanceRow {
  id: number; employeeId: number; employeeName: string; amount?: number
  deductJalaliYear: number; deductJalaliMonth: number; status: string; glEntryId: number | null
}

const GROUP_LABELS: Record<string, { en: string; fa: string }> = {
  tax: { en: 'Tax', fa: 'مالیات' },
  insurance: { en: 'Insurance', fa: 'بیمه' },
  labor: { en: 'Statutory allowances', fa: 'مزایای قانونی' },
  company: { en: 'Company policy', fa: 'سیاست شرکت' },
}

const INCLUSION_LABELS: Record<string, { en: string; fa: string }> = {
  yes: { en: 'Yes', fa: 'بله' },
  no: { en: 'No', fa: 'خیر' },
  capped: { en: 'Up to a cap', fa: 'تا سقف' },
}

const METHOD_LABELS: Record<string, { en: string; fa: string }> = {
  fixed: { en: 'Fixed amount', fa: 'مبلغ ثابت' },
  percent_of_base: { en: 'Percent of base salary', fa: 'درصدی از حقوق پایه' },
  daily_prorated: { en: 'Prorated by days worked', fa: 'به نسبت روز کارکرد' },
  per_child: { en: 'Per child', fa: 'به ازای هر فرزند' },
  manual: { en: 'Entered manually', fa: 'ورود دستی' },
}

const EMPTY_EARNING = {
  key: '', labelFa: '', labelEn: '', earningGroup: 'allowance', recurring: true,
  insurable: 'yes', insurableCap: '', taxable: 'yes', taxableCap: '',
  inEidBase: false, inSeveranceBase: false, inOvertimeBase: false,
  calcMethod: 'manual', calcValue: '', paramKey: '', sortOrder: '50',
}

export function PayrollManager() {
  const fa = useAdminLocale() === 'fa'
  const { toast, ToastContainer } = useToast()

  const [tab, setTab] = useState<Tab>('periods')
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<Period[]>([])
  const [rulesets, setRulesets] = useState<Ruleset[]>([])
  const [overview, setOverview] = useState<{ periods: number; openPeriods: number; awaitingApproval: number; rulesets: number; activeLoans: number; outstandingLoans: number } | null>(null)
  const [canSeeAmounts, setCanSeeAmounts] = useState(false)

  const [selRuleset, setSelRuleset] = useState<number | null>(null)
  const [params, setParams] = useState<Parameter[]>([])
  const [brackets, setBrackets] = useState<Bracket[]>([])
  const [earnings, setEarnings] = useState<EarningRow[]>([])
  const [editable, setEditable] = useState(true)
  const [mismatch, setMismatch] = useState<{ stated: number; effective: number } | null>(null)

  const [selPeriod, setSelPeriod] = useState<number | null>(null)
  const [slips, setSlips] = useState<Slip[]>([])
  const [loans, setLoans] = useState<{ id: number; employeeName: string; totalAmount: number; monthlyAmount: number; paid: number; outstanding: number; status: string }[]>([])

  const [eidRows, setEidRows] = useState<EidRow[]>([])
  const [sevRows, setSevRows] = useState<SeveranceRow[]>([])
  const [settlements, setSettlements] = useState<SettlementRow[]>([])
  const [layouts, setLayouts] = useState<ExportLayout[]>([])
  const [annual, setAnnual] = useState<{ eidCount: number; eidTotal: number; severanceCount: number; severanceTotal: number; severanceProvision: number; settlements: number } | null>(null)
  const [eidYear, setEidYear] = useState('1405')
  const [sevForm, setSevForm] = useState({ employeeId: '', endDate: '' })
  const [setForm, setSetForm] = useState({ employeeId: '', endDate: '', reason: '', otherDeductions: '' })
  const [sevModal, setSevModal] = useState(false)
  const [setModal, setSetModal] = useState(false)
  const [exportPeriod, setExportPeriod] = useState('')
  const [employees, setEmployees] = useState<{ id: number; fullName: string }[]>([])

  const [bankFormats, setBankFormats] = useState<BankFormat[]>([])
  const [bankBatches, setBankBatches] = useState<BankBatch[]>([])
  const [advances, setAdvances] = useState<AdvanceRow[]>([])
  const [genForm, setGenForm] = useState({ periodId: '', formatId: '', sourceAccount: '', paymentDate: '' })
  const [genModal, setGenModal] = useState(false)
  const [advForm, setAdvForm] = useState({ employeeId: '', amount: '', deductJalaliYear: '', deductJalaliMonth: '1', note: '' })
  const [advModal, setAdvModal] = useState(false)

  const [previewIncome, setPreviewIncome] = useState('1000000000')
  const [preview, setPreview] = useState<TaxRow[] | null>(null)

  const [copyModal, setCopyModal] = useState(false)
  const [copyForm, setCopyForm] = useState({ year: '', version: '1', effectiveFrom: '', effectiveTo: '', source: '' })
  const [openModal, setOpenModal] = useState(false)
  const [openForm, setOpenForm] = useState({ jalaliYear: '', jalaliMonth: '1' })
  const [earnModal, setEarnModal] = useState(false)
  const [earnForm, setEarnForm] = useState<typeof EMPTY_EARNING & { id?: number }>(EMPTY_EARNING)

  const money = useCallback((n: number | undefined) =>
    n == null ? '—' : formatCurrency(n, undefined, { locale: fa ? 'fa' : 'en' }), [fa])
  const num = useCallback((n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US'), [fa])
  const monthName = (m: number) => (fa ? JALALI_MONTHS_FA[m - 1] : JALALI_MONTHS_EN[m - 1])

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/hr/payroll')
    if (r.ok) {
      const d = await r.json()
      setPeriods(d.periods ?? [])
      setRulesets(d.rulesets ?? [])
      setOverview(d.overview ?? null)
      setCanSeeAmounts(!!d.canSeeAmounts)
      if (!selRuleset && d.rulesets?.length) setSelRuleset(d.rulesets[0].id)
    }
    const e = await fetch('/api/admin/hr/employees')
    if (e.ok) setEmployees(((await e.json()).employees ?? []) as { id: number; fullName: string }[])
    setLoading(false)
  }, [selRuleset])
  useEffect(() => { load() }, [load])

  const loadRuleset = useCallback(async (id: number) => {
    const r = await fetch(`/api/admin/hr/payroll?view=ruleset&id=${id}`)
    if (!r.ok) return
    const d = await r.json()
    setParams(d.parameters ?? [])
    setBrackets(d.brackets ?? [])
    setEarnings(d.earningTypes ?? [])
    setEditable(!!d.editable)
    setMismatch(d.exemptionMismatch ?? null)
  }, [])
  useEffect(() => { if (selRuleset) loadRuleset(selRuleset) }, [selRuleset, loadRuleset])

  const loadSlips = useCallback(async (periodId: number) => {
    const r = await fetch(`/api/admin/hr/payroll?view=slips&periodId=${periodId}`)
    if (r.ok) { const d = await r.json(); setSlips(d.slips ?? []); setCanSeeAmounts(!!d.canSeeAmounts) }
  }, [])

  const loadLoans = useCallback(async () => {
    const r = await fetch('/api/admin/hr/payroll?view=loans')
    if (r.ok) setLoans((await r.json()).loans ?? [])
  }, [])
  useEffect(() => { if (tab === 'loans') loadLoans() }, [tab, loadLoans])

  const loadEid = useCallback(async () => {
    const r = await fetch('/api/admin/hr/payroll?view=eid')
    if (r.ok) { const d = await r.json(); setEidRows(d.eid ?? []); setAnnual(d.overview ?? null) }
  }, [])
  const loadSeverance = useCallback(async () => {
    const r = await fetch('/api/admin/hr/payroll?view=severance')
    if (r.ok) { const d = await r.json(); setSevRows(d.severance ?? []); setAnnual(d.overview ?? null) }
  }, [])
  const loadSettlements = useCallback(async () => {
    const r = await fetch('/api/admin/hr/payroll?view=settlements')
    if (r.ok) setSettlements((await r.json()).settlements ?? [])
  }, [])
  const loadLayouts = useCallback(async () => {
    const r = await fetch('/api/admin/hr/payroll?view=exportLayouts')
    if (r.ok) setLayouts((await r.json()).layouts ?? [])
  }, [])

  const loadBankFormats = useCallback(async () => {
    const r = await fetch('/api/admin/hr/payroll?view=bankFormats')
    if (r.ok) setBankFormats((await r.json()).formats ?? [])
  }, [])
  const loadBankBatches = useCallback(async () => {
    const r = await fetch('/api/admin/hr/payroll?view=bankBatches')
    if (r.ok) setBankBatches((await r.json()).batches ?? [])
  }, [])
  const loadAdvances = useCallback(async () => {
    const r = await fetch('/api/admin/hr/payroll?view=advances')
    if (r.ok) setAdvances((await r.json()).advances ?? [])
  }, [])

  useEffect(() => {
    if (tab === 'eid') loadEid()
    if (tab === 'severance') loadSeverance()
    if (tab === 'settlements') loadSettlements()
    if (tab === 'exports') loadLayouts()
    if (tab === 'bank') { loadBankFormats(); loadBankBatches() }
    if (tab === 'advances') loadAdvances()
  }, [tab, loadEid, loadSeverance, loadSettlements, loadLayouts, loadBankFormats, loadBankBatches, loadAdvances])

  async function post(body: Record<string, unknown>, okEn: string, okFa: string, after?: () => void) {
    const res = await fetch('/api/admin/hr/payroll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { toast(L(fa, okEn, okFa), 'success'); after?.() }
    else toast(await crud.errorOf(res, L(fa, 'Failed', 'ناموفق')), 'error')
    return res.ok
  }

  async function runPreview() {
    if (!selRuleset) return
    const r = await fetch(`/api/admin/hr/payroll?view=preview&rulesetId=${selRuleset}&income=${Number(previewIncome || 0)}`)
    if (r.ok) setPreview((await r.json()).breakdown ?? [])
    else toast(await crud.errorOf(r, L(fa, 'Preview failed', 'پیش‌نمایش ناموفق')), 'error')
  }

  // ── bracket editing ───────────────────────────────────────────────────────
  const bracketIssues = validateBrackets(brackets)

  function setBracket(i: number, patch: Partial<Bracket>) {
    setBrackets(b => b.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  function addBracket() {
    const last = brackets[brackets.length - 1]
    const from = last?.toAmount ?? (last ? last.fromAmount : 0)
    setBrackets(b => [
      ...b.map(r => (r.toAmount === null ? { ...r, toAmount: from } : r)),
      { seq: b.length, fromAmount: from, toAmount: null, ratePercent: 0 },
    ])
  }
  function removeBracket(i: number) {
    setBrackets(b => b.filter((_, idx) => idx !== i).map((r, idx, arr) =>
      ({ ...r, seq: idx, toAmount: idx === arr.length - 1 ? null : r.toAmount })))
  }

  // ── columns ───────────────────────────────────────────────────────────────
  const periodColumns: Column<Period>[] = [
    { key: 'jalaliMonth', labelEn: 'Month', labelFa: 'ماه',
      render: p => <span className="font-medium text-text-primary">
        {monthName(p.jalaliMonth)} {num(p.jalaliYear)}</span> },
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت', type: 'enum',
      render: p => <Badge color={p.status === 'locked' ? 'slate' : p.status === 'paid' ? 'green'
        : p.status === 'approved' ? 'blue' : p.status === 'calculated' ? 'yellow' : 'slate'}>
        {fa ? PERIOD_STATUS_LABELS[p.status].fa : PERIOD_STATUS_LABELS[p.status].en}</Badge> },
    { key: 'slipCount', labelEn: 'Payslips', labelFa: 'تعداد فیش', numeric: true,
      render: p => <span className="tabular-nums">{num(p.slipCount)}</span> },
    { key: 'totalGross', labelEn: 'Gross', labelFa: 'جمع مزایا', numeric: true,
      render: p => <span className="tabular-nums">{canSeeAmounts ? money(p.totalGross) : '—'}</span> },
    { key: 'totalTax', labelEn: 'Tax', labelFa: 'مالیات', numeric: true,
      render: p => <span className="tabular-nums">{canSeeAmounts ? money(p.totalTax) : '—'}</span> },
    { key: 'totalNet', labelEn: 'Net', labelFa: 'خالص پرداختی', numeric: true,
      render: p => <span className="tabular-nums font-semibold text-text-primary">
        {canSeeAmounts ? money(p.totalNet) : '—'}</span> },
    { key: 'glEntryId', labelEn: 'Journal entry', labelFa: 'سند حسابداری',
      render: p => p.glEntryId
        ? <Badge color="green">{L(fa, `#${p.glEntryId}`, `#${num(p.glEntryId)}`)}</Badge>
        : <span className="text-xs text-text-tertiary">—</span> },
  ]

  const periodActions: RowAction<Period>[] = [
    { id: 'slips', labelEn: 'View payslips', labelFa: 'مشاهدهٔ فیش‌ها', icon: '📄',
      onClick: p => { setSelPeriod(p.id); loadSlips(p.id); setTab('slips') } },
    { id: 'calc', labelEn: 'Calculate', labelFa: 'محاسبه', icon: '🧮',
      hidden: p => p.status !== 'open' && p.status !== 'calculated',
      onClick: p => post({ action: 'period.calculate', id: p.id }, 'Calculated', 'محاسبه شد', load) },
    { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓',
      hidden: p => p.status !== 'calculated',
      onClick: p => post({ action: 'period.approve', id: p.id }, 'Approved', 'تأیید شد', load) },
    { id: 'post', labelEn: 'Post to ledger', labelFa: 'ثبت در دفتر کل', icon: '📘',
      hidden: p => p.status !== 'approved' || !!p.glEntryId,
      onClick: p => post({ action: 'period.post', id: p.id }, 'Posted to the ledger', 'در دفتر کل ثبت شد', load) },
    { id: 'pay', labelEn: 'Mark paid', labelFa: 'ثبت پرداخت', icon: '💵',
      hidden: p => p.status !== 'approved',
      onClick: p => post({ action: 'period.pay', id: p.id }, 'Marked paid', 'پرداخت ثبت شد', load) },
    { id: 'lock', labelEn: 'Lock', labelFa: 'قفل کردن', icon: '🔒',
      hidden: p => p.status !== 'paid',
      onClick: p => post({ action: 'period.lock', id: p.id }, 'Locked', 'قفل شد', load) },
  ]

  const slipColumns: Column<Slip>[] = [
    { key: 'employeeCode', labelEn: 'Code', labelFa: 'کد پرسنلی',
      render: s => <span className="font-mono text-xs text-brand" dir="ltr">{s.employeeCode}</span> },
    { key: 'employeeName', labelEn: 'Employee', labelFa: 'کارمند',
      render: s => <span className="font-medium text-text-primary">{s.employeeName}</span> },
    ...(canSeeAmounts ? [
      { key: 'gross', labelEn: 'Gross', labelFa: 'جمع مزایا', numeric: true,
        render: (s: Slip) => <span className="tabular-nums">{money(s.gross)}</span> } as Column<Slip>,
      { key: 'employeeInsurance', labelEn: 'Insurance', labelFa: 'بیمه', numeric: true,
        render: (s: Slip) => <span className="tabular-nums">{money(s.employeeInsurance)}</span> } as Column<Slip>,
      { key: 'tax', labelEn: 'Tax', labelFa: 'مالیات', numeric: true,
        render: (s: Slip) => <span className="tabular-nums">{money(s.tax)}</span> } as Column<Slip>,
      { key: 'net', labelEn: 'Net', labelFa: 'خالص پرداختی', numeric: true,
        render: (s: Slip) => <span className="tabular-nums font-semibold text-text-primary">{money(s.net)}</span> } as Column<Slip>,
    ] : []),
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
      render: s => <Badge color={s.status === 'reversed' ? 'red' : s.status === 'paid' ? 'green'
        : s.status === 'correction' ? 'yellow' : 'slate'}>{s.status}</Badge> },
  ]

  const rulesetColumns: Column<Ruleset>[] = [
    { key: 'year', labelEn: 'Year', labelFa: 'سال',
      render: r => <span className="font-medium text-text-primary">{num(r.year)}</span> },
    { key: 'version', labelEn: 'Version', labelFa: 'نسخه',
      render: r => <span className="tabular-nums">{num(r.version)}</span> },
    { key: 'title', labelEn: 'Title', labelFa: 'عنوان',
      render: r => <span className="text-text-secondary">{r.title ?? '—'}</span> },
    { key: 'effectiveFrom', labelEn: 'In force from', labelFa: 'از تاریخ',
      render: r => <span className="text-xs" dir="ltr">{r.effectiveFrom}</span> },
    { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
      render: r => <Badge color={r.status === 'approved' ? 'green' : r.status === 'archived' ? 'slate' : 'yellow'}>
        {r.status === 'approved' ? L(fa, 'Approved', 'تأییدشده')
          : r.status === 'archived' ? L(fa, 'Archived', 'بایگانی') : L(fa, 'Draft', 'پیش‌نویس')}</Badge> },
    { key: 'slipCount', labelEn: 'Payslips issued', labelFa: 'فیش صادرشده', numeric: true,
      render: r => <span className="tabular-nums">{num(r.slipCount)}</span> },
  ]

  const rulesetActions: RowAction<Ruleset>[] = [
    { id: 'select', labelEn: 'Open', labelFa: 'باز کردن', icon: '📂',
      onClick: r => { setSelRuleset(r.id); setTab('tax') } },
    { id: 'copy', labelEn: 'Copy to a new version', labelFa: 'کپی به نسخهٔ جدید', icon: '⧉',
      onClick: r => {
        setCopyForm({
          year: String(r.year + 1), version: '1',
          effectiveFrom: '', effectiveTo: '', source: '',
        })
        setSelRuleset(r.id); setCopyModal(true)
      } },
    { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓',
      hidden: r => r.status !== 'draft',
      onClick: r => post({ action: 'ruleset.approve', id: r.id }, 'Approved', 'تأیید شد', load) },
  ]

  const earningColumns: Column<EarningRow>[] = [
    { key: 'labelFa', labelEn: 'Earning', labelFa: 'قلم حقوقی',
      render: e => <div><div className="font-medium text-text-primary">{fa ? e.labelFa : e.labelEn}</div>
        <div className="text-2xs text-text-tertiary font-mono" dir="ltr">{e.key}</div></div> },
    { key: 'recurring', labelEn: 'Type', labelFa: 'نوع',
      render: e => <Badge color={e.recurring ? 'blue' : 'slate'}>
        {e.recurring ? L(fa, 'Recurring', 'مستمر') : L(fa, 'Non-recurring', 'غیرمستمر')}</Badge> },
    { key: 'insurable', labelEn: 'Insurable', labelFa: 'مشمول بیمه',
      render: e => <span className="text-xs text-text-secondary">
        {fa ? INCLUSION_LABELS[e.insurable]?.fa : INCLUSION_LABELS[e.insurable]?.en}
        {e.insurable === 'capped' && e.insurableCap != null ? ` (${money(e.insurableCap)})` : ''}</span> },
    { key: 'taxable', labelEn: 'Taxable', labelFa: 'مشمول مالیات',
      render: e => <span className="text-xs text-text-secondary">
        {fa ? INCLUSION_LABELS[e.taxable]?.fa : INCLUSION_LABELS[e.taxable]?.en}</span> },
    { key: 'calcMethod', labelEn: 'Calculation', labelFa: 'روش محاسبه',
      render: e => <span className="text-xs text-text-tertiary">
        {fa ? METHOD_LABELS[e.calcMethod]?.fa : METHOD_LABELS[e.calcMethod]?.en}</span> },
    { key: 'inEidBase', labelEn: 'Eid base', labelFa: 'مبنای عیدی',
      render: e => <span className="text-xs">{e.inEidBase ? '✓' : '—'}</span> },
    { key: 'inSeveranceBase', labelEn: 'Severance base', labelFa: 'مبنای سنوات',
      render: e => <span className="text-xs">{e.inSeveranceBase ? '✓' : '—'}</span> },
  ]

  const earningActions: RowAction<EarningRow>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: 'ویرایش', icon: '✎',
      onClick: e => {
        setEarnForm({
          id: e.id, key: e.key, labelFa: e.labelFa, labelEn: e.labelEn,
          earningGroup: e.earningGroup, recurring: e.recurring,
          insurable: e.insurable, insurableCap: e.insurableCap != null ? String(e.insurableCap) : '',
          taxable: e.taxable, taxableCap: e.taxableCap != null ? String(e.taxableCap) : '',
          inEidBase: e.inEidBase, inSeveranceBase: e.inSeveranceBase, inOvertimeBase: e.inOvertimeBase,
          calcMethod: e.calcMethod, calcValue: String(e.calcValue ?? ''),
          paramKey: e.paramKey ?? '', sortOrder: String(e.sortOrder),
        })
        setEarnModal(true)
      } },
    { id: 'del', labelEn: 'Delete', labelFa: 'حذف', icon: '🗑', danger: true,
      onClick: async e => {
        const res = await fetch('/api/admin/hr/payroll', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: e.id, rulesetId: selRuleset, kind: 'earning' }),
        })
        if (res.ok) { toast(L(fa, 'Deleted', 'حذف شد'), 'success'); if (selRuleset) loadRuleset(selRuleset) }
        else toast(await crud.errorOf(res, L(fa, 'Delete failed', 'حذف نشد')), 'error')
      } },
  ]

  const kpi = (label: string, value: string, tone?: 'ok' | 'warn') => (
    <div className={`rounded-xl p-4 bg-surface-2 border ${tone === 'ok' ? 'border-success/40' : tone === 'warn' ? 'border-warning/40' : 'border-subtle'}`}>
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )

  const rulesetPicker = (
    <Select label={L(fa, 'Rule version', 'نسخهٔ قوانین')} value={selRuleset ? String(selRuleset) : ''}
      onChange={v => setSelRuleset(Number(v))}
      options={rulesets.map(r => ({
        value: String(r.id),
        label: L(fa, `${r.year} v${r.version}`, `${num(r.year)} نسخهٔ ${num(r.version)}`),
      }))} />
  )

  const frozenNotice = !editable && (
    <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
      <p className="text-sm text-text-secondary">
        {L(fa,
          'This rule version has already issued payslips, so it is read-only. Editing it would silently restate figures that were already reported and posted. To change a rate, copy it to a new version.',
          'این نسخه فیش صادرشده دارد و فقط خواندنی است. ویرایش آن، ارقامی را که قبلاً گزارش و ثبت شده‌اند بی‌صدا تغییر می‌دهد. برای تغییر نرخ، یک نسخهٔ جدید کپی کنید.')}
      </p>
    </div>
  )

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={L(fa, 'Payroll', 'حقوق و دستمزد')}
        subtitle={L(fa,
          'Every statutory figure is data you maintain — rates, brackets and which earnings are insurable',
          'همهٔ اعداد قانونی داده‌ای هستند که خودتان نگه می‌دارید — نرخ‌ها، پلکان‌ها و مشمولیت اقلام')}
        action={<div className="flex items-center gap-2">
          <Btn onClick={() => { setOpenForm({ jalaliYear: '', jalaliMonth: '1' }); setOpenModal(true) }}>
            {L(fa, 'Open a payroll month', 'باز کردن دورهٔ حقوق')}</Btn>
        </div>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpi(L(fa, 'Payroll runs', 'دوره‌های حقوق'), num(overview?.periods ?? 0))}
        {kpi(L(fa, 'Awaiting approval', 'در انتظار تأیید'), num(overview?.awaitingApproval ?? 0), 'warn')}
        {kpi(L(fa, 'Rule versions', 'نسخه‌های قوانین'), num(overview?.rulesets ?? 0))}
        {kpi(L(fa, 'Outstanding loans', 'مانده وام‌ها'),
          canSeeAmounts ? money(overview?.outstandingLoans ?? 0) : '—')}
      </div>

      {!canSeeAmounts && (
        <div className="mb-4 rounded-xl border border-info/40 bg-info/10 px-4 py-3">
          <p className="text-sm text-text-secondary">
            {L(fa,
              'Payroll amounts are not shown — they require the “payroll amounts” permission. They are omitted from the server response, not merely hidden.',
              'مبالغ حقوق نمایش داده نمی‌شوند — نیازمند دسترسی «مبالغ حقوق» هستند. این مقادیر اصلاً در پاسخ سرور نیستند، نه اینکه پنهان شده باشند.')}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t.id
              ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:text-text-primary'}`}>
            {fa ? t.fa : t.en}
          </button>
        ))}
      </div>

      {tab === 'periods' && (
        <DataTable<Period> tableId="hr-payroll-periods" rows={periods} columns={periodColumns}
          rowActions={periodActions} loading={loading} locale={fa ? 'fa' : 'en'} />
      )}

      {tab === 'slips' && (
        <div className="space-y-4">
          <Card className="p-4">
            <Select label={L(fa, 'Payroll run', 'دورهٔ حقوق')} value={selPeriod ? String(selPeriod) : ''}
              onChange={v => { setSelPeriod(Number(v)); loadSlips(Number(v)) }}
              options={[{ value: '', label: L(fa, 'Select a run…', 'یک دوره انتخاب کنید…') },
                ...periods.map(p => ({ value: String(p.id), label: `${monthName(p.jalaliMonth)} ${num(p.jalaliYear)}` }))]} />
          </Card>
          {!selPeriod ? (
            <Card className="p-8 text-center text-sm text-text-tertiary">
              {L(fa, 'Choose a payroll run to see its payslips.', 'برای دیدن فیش‌ها، یک دوره انتخاب کنید.')}
            </Card>
          ) : (
            <DataTable<Slip> tableId="hr-payroll-slips" rows={slips} columns={slipColumns} locale={fa ? 'fa' : 'en'} />
          )}
        </div>
      )}



      {tab === 'bank' && (
        <div className="space-y-4">
          <Card className="p-4 flex items-start justify-between gap-4">
            <p className="text-sm text-text-secondary">
              {L(fa,
                'A batch is generated ONCE per period — a retried click hits the same batch, never a second payment run. An employee with no or invalid IBAN is refused by name, never silently dropped from the file. Confirming the batch settles salaries payable to zero.',
                'دسته فقط یک‌بار برای هر دوره تولید می‌شود — کلیک دوباره همان دسته را برمی‌گرداند، نه دستهٔ جدید. کارمند بدون شبا یا با شبای نامعتبر با ذکر نام رد می‌شود، نه حذف خاموش از فایل. تأیید دسته، حقوق پرداختنی را صفر می‌کند.')}
            </p>
            <Btn onClick={() => { setGenForm({ periodId: '', formatId: '', sourceAccount: '', paymentDate: '' }); setGenModal(true) }}>
              {L(fa, 'Generate batch', 'تولید دسته')}</Btn>
          </Card>

          {bankFormats.some(f => !f.verified) && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
              <p className="text-sm text-text-secondary">
                ⚠️ {L(fa,
                  'One or more bank formats are not verified against a real bank template. Check the file with your bank before relying on it.',
                  'یک یا چند فرمت بانکی با نمونهٔ واقعی بانک تطبیق داده نشده‌اند. پیش از اتکا به فایل، با بانک بررسی کنید.')}
              </p>
            </div>
          )}

          <DataTable<BankBatch> tableId="hr-payroll-bank-batches" rows={bankBatches} locale={fa ? 'fa' : 'en'}
            columns={[
              { key: 'formatName', labelEn: 'Bank', labelFa: 'بانک', render: b => <span>{b.formatName ?? '—'}</span> },
              { key: 'recordCount', labelEn: 'Records', labelFa: 'تعداد رکورد', numeric: true,
                render: b => <span className="tabular-nums">{num(b.recordCount)}</span> },
              { key: 'totalAmount', labelEn: 'Total', labelFa: 'مبلغ کل', numeric: true,
                render: b => <span className="tabular-nums font-semibold">{money(b.totalAmount)}</span> },
              { key: 'paymentDate', labelEn: 'Payment date', labelFa: 'تاریخ پرداخت',
                render: b => <span className="text-xs" dir="ltr">{b.paymentDate ?? '—'}</span> },
              { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
                render: b => <Badge color={b.status === 'confirmed' ? 'green' : b.status === 'sent' ? 'blue' : 'slate'}>
                  {b.status}</Badge> },
            ]}
            rowActions={[
              { id: 'download', labelEn: 'Download file', labelFa: 'دریافت فایل', icon: '⬇',
                onClick: b => { window.location.href = `/api/admin/hr/payroll?view=bankFile&id=${b.id}` } },
              { id: 'send', labelEn: 'Mark sent', labelFa: 'ثبت ارسال', icon: '📤',
                hidden: b => b.status !== 'generated',
                onClick: b => post({ action: 'bankBatch.send', id: b.id }, 'Marked sent', 'ثبت شد', loadBankBatches) },
              { id: 'confirm', labelEn: 'Confirm payment', labelFa: 'تأیید پرداخت', icon: '✓',
                hidden: b => b.status === 'draft' || b.status === 'confirmed',
                onClick: b => post({ action: 'bankBatch.confirm', id: b.id, rejectedEmployeeIds: [] },
                  'Payment confirmed — salaries payable settled', 'پرداخت تأیید شد — حقوق پرداختنی تسویه شد',
                  () => { loadBankBatches(); load() }) },
            ]} />
        </div>
      )}

      {tab === 'advances' && (
        <div className="space-y-4">
          <Card className="p-4 flex items-start justify-between gap-4">
            <p className="text-sm text-text-secondary">
              {L(fa,
                'An advance is NOT a loan: a single lump sum deducted once, in the named month, with no instalment schedule. The cap is company policy, and a request beyond it is refused with the cap shown.',
                'مساعده وام نیست: یک مبلغ یک‌جا که فقط در ماه تعیین‌شده و بدون اقساط کسر می‌شود. سقف آن سیاست شرکت است و درخواست بیش از سقف با نمایش همان سقف رد می‌شود.')}
            </p>
            <Btn onClick={() => { setAdvForm({ employeeId: '', amount: '', deductJalaliYear: '', deductJalaliMonth: '1', note: '' }); setAdvModal(true) }}>
              {L(fa, 'New advance', 'مساعدهٔ جدید')}</Btn>
          </Card>

          <DataTable<AdvanceRow> tableId="hr-payroll-advances" rows={advances} locale={fa ? 'fa' : 'en'}
            columns={[
              { key: 'employeeName', labelEn: 'Employee', labelFa: 'کارمند' },
              { key: 'amount', labelEn: 'Amount', labelFa: 'مبلغ', numeric: true,
                render: a => <span className="tabular-nums font-semibold">{money(a.amount)}</span> },
              { key: 'deductJalaliMonth', labelEn: 'Deducted in', labelFa: 'کسر در',
                render: a => <span>{monthName(a.deductJalaliMonth)} {num(a.deductJalaliYear)}</span> },
              { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
                render: a => <Badge color={a.status === 'deducted' ? 'green' : a.status === 'paid' ? 'blue'
                  : a.status === 'approved' ? 'yellow' : 'slate'}>{a.status}</Badge> },
            ]}
            rowActions={[
              { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓',
                hidden: a => a.status !== 'requested',
                onClick: a => post({ action: 'advance.approve', id: a.id }, 'Approved', 'تأیید شد', loadAdvances) },
              { id: 'pay', labelEn: 'Pay out', labelFa: 'پرداخت', icon: '💵',
                hidden: a => a.status !== 'approved',
                onClick: a => post({ action: 'advance.pay', id: a.id }, 'Paid', 'پرداخت شد', loadAdvances) },
            ]} />
        </div>
      )}

      {tab === 'eid' && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm text-text-secondary mb-3">
              {L(fa,
                'The bonus is a number of days of the employee’s own recurring pay, pro-rated by service inside the year, then held between a floor and a ceiling expressed in days of the MINIMUM wage. That last part surprises people: the cap is not a multiple of their own salary, so most mid-to-high earners receive exactly the ceiling.',
                'عیدی چند روز از مزایای مستمر خودِ کارمند است، به نسبت روزهای خدمت در همان سال، و بعد بین یک کف و یک سقف که هر دو بر حسب روزِ حداقل مزد تعریف شده‌اند محدود می‌شود. همین بند آخر معمولاً غافلگیرکننده است: سقف مضربی از حقوق خودِ فرد نیست، پس بیشتر حقوق‌های متوسط به بالا دقیقاً همان سقف را می‌گیرند.')}
            </p>
            <div className="flex gap-2 items-end">
              <div className="w-40">
                <Input label={L(fa, 'Jalali year', 'سال شمسی')} type="number" value={eidYear}
                  onChange={setEidYear} placeholder="1405" />
              </div>
              <Btn onClick={() => post({ action: 'eid.calculate', jalaliYear: Number(eidYear) },
                'Eid bonus calculated', 'عیدی محاسبه شد', loadEid)}>
                {L(fa, 'Calculate for the year', 'محاسبه برای سال')}</Btn>
            </div>
          </Card>

          {annual && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {kpi(L(fa, 'Calculations', 'تعداد محاسبه'), num(annual.eidCount))}
              {kpi(L(fa, 'Total Eid bonus', 'جمع عیدی'), canSeeAmounts ? money(annual.eidTotal) : '—')}
              {kpi(L(fa, 'Severance provision', 'ذخیرهٔ سنوات'), canSeeAmounts ? money(annual.severanceProvision) : '—')}
            </div>
          )}

          <DataTable<EidRow> tableId="hr-payroll-eid" rows={eidRows} locale={fa ? 'fa' : 'en'}
            columns={[
              { key: 'employeeCode', labelEn: 'Code', labelFa: 'کد پرسنلی',
                render: r => <span className="font-mono text-xs text-brand" dir="ltr">{r.employeeCode}</span> },
              { key: 'employeeName', labelEn: 'Employee', labelFa: 'کارمند' },
              { key: 'jalaliYear', labelEn: 'Year', labelFa: 'سال', render: r => <span>{num(r.jalaliYear)}</span> },
              { key: 'serviceDays', labelEn: 'Service days', labelFa: 'روزهای خدمت', numeric: true,
                render: r => <span className="tabular-nums">{num(r.serviceDays)}</span> },
              { key: 'amount', labelEn: 'Eid bonus', labelFa: 'عیدی', numeric: true,
                render: r => <span className="tabular-nums font-semibold text-text-primary">{money(r.amount)}</span> },
              { key: 'tax', labelEn: 'Tax', labelFa: 'مالیات', numeric: true,
                render: r => <span className="tabular-nums">{money(r.tax)}</span> },
              { key: 'net', labelEn: 'Net', labelFa: 'خالص', numeric: true,
                render: r => <span className="tabular-nums">{money(r.net)}</span> },
              { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
                render: r => <Badge color={r.status === 'paid' ? 'green' : r.status === 'reversed' ? 'red'
                  : r.status === 'approved' ? 'blue' : 'slate'}>{r.status}</Badge> },
            ]}
            rowActions={[
              { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓',
                hidden: r => r.status !== 'draft',
                onClick: r => post({ action: 'eid.approve', id: r.id }, 'Approved', 'تأیید شد', loadEid) },
              { id: 'post', labelEn: 'Post to ledger', labelFa: 'ثبت در دفتر کل', icon: '📘',
                hidden: r => r.status !== 'approved',
                onClick: r => post({ action: 'eid.post', id: r.id }, 'Posted', 'ثبت شد', loadEid) },
              { id: 'reverse', labelEn: 'Reverse', labelFa: 'برگشت', icon: '↩', danger: true,
                hidden: r => r.status === 'reversed' || r.status === 'draft',
                onClick: r => post({ action: 'eid.reverse', id: r.id },
                  'Reversed — the original stays', 'برگشت خورد — اصلی سرِ جایش ماند', loadEid) },
            ]} />
        </div>
      )}

      {tab === 'severance' && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              {L(fa, 'Severance is not the seniority allowance', 'سنوات پایان خدمت با پایهٔ سنوات یکی نیست')}</h3>
            <p className="text-sm text-text-secondary">
              {L(fa,
                'Two different things share a Persian word. «پایهٔ سنوات» is a monthly allowance added to pay every month — it is an earning type, configured on the Earning types tab. Severance is a termination benefit: one month’s pay for each year of service, paid when someone leaves. This tab is only about the second one. Service days are read from the append-only employment history, so a later raise cannot change how long someone worked.',
                'دو چیز کاملاً متفاوت یک نام فارسی مشترک دارند. «پایهٔ سنوات» یک مزایای ماهانه است که هر ماه به حقوق اضافه می‌شود — یک قلم حقوقی است و در تب «اقلام حقوقی» تنظیم می‌شود. «سنوات پایان خدمت» مزایای ترک خدمت است: یک ماه مزد به ازای هر سال سابقه، هنگام خروج. این تب فقط دربارهٔ دومی است. روزهای خدمت از تاریخچهٔ استخدامیِ فقط‌افزودنی خوانده می‌شود، پس افزایش حقوقِ بعدی نمی‌تواند مدت خدمت را تغییر دهد.')}
            </p>
            <div className="flex justify-end mt-3">
              <Btn onClick={() => { setSevForm({ employeeId: '', endDate: '' }); setSevModal(true) }}>
                {L(fa, 'Calculate severance', 'محاسبهٔ سنوات')}</Btn>
            </div>
          </Card>

          <DataTable<SeveranceRow> tableId="hr-payroll-severance" rows={sevRows} locale={fa ? 'fa' : 'en'}
            columns={[
              { key: 'employeeName', labelEn: 'Employee', labelFa: 'کارمند' },
              { key: 'fromDate', labelEn: 'From', labelFa: 'از تاریخ',
                render: r => <span className="text-xs" dir="ltr">{r.fromDate}</span> },
              { key: 'toDate', labelEn: 'To', labelFa: 'تا تاریخ',
                render: r => <span className="text-xs" dir="ltr">{r.toDate}</span> },
              { key: 'serviceDays', labelEn: 'Service days', labelFa: 'روزهای خدمت', numeric: true,
                render: r => <span className="tabular-nums">{num(r.serviceDays)}</span> },
              { key: 'basePolicy', labelEn: 'Base', labelFa: 'مبنا',
                render: r => <span className="text-xs text-text-tertiary">
                  {r.basePolicy === 'average' ? L(fa, 'Average', 'میانگین') : L(fa, 'Last month', 'آخرین ماه')}</span> },
              { key: 'amount', labelEn: 'Severance', labelFa: 'سنوات', numeric: true,
                render: r => <span className="tabular-nums font-semibold text-text-primary">{money(r.amount)}</span> },
              { key: 'accruedBefore', labelEn: 'Already provisioned', labelFa: 'ذخیرهٔ انباشته', numeric: true,
                render: r => <span className="tabular-nums">{money(r.accruedBefore)}</span> },
              { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
                render: r => <Badge color={r.status === 'paid' ? 'green' : r.status === 'approved' ? 'blue' : 'slate'}>
                  {r.status}</Badge> },
            ]}
            rowActions={[
              { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓',
                hidden: r => r.status !== 'draft',
                onClick: r => post({ action: 'severance.approve', id: r.id }, 'Approved', 'تأیید شد', loadSeverance) },
              { id: 'post', labelEn: 'Post to ledger', labelFa: 'ثبت در دفتر کل', icon: '📘',
                hidden: r => r.status !== 'approved',
                onClick: r => post({ action: 'severance.post', id: r.id }, 'Posted', 'ثبت شد', loadSeverance) },
            ]} />
        </div>
      )}

      {tab === 'settlements' && (
        <div className="space-y-4">
          <Card className="p-4 flex items-start justify-between gap-4">
            <p className="text-sm text-text-secondary">
              {L(fa,
                'The settlement pulls each figure from the module that owns it — the last payslip, severance, the pro-rated Eid bonus, unused leave from the balance ledger, and the outstanding loan — so it can never disagree with the records it summarises. A NEGATIVE total means the leaver owes the company, and it is shown as negative rather than quietly written off.',
                'تسویه‌حساب هر عدد را از همان ماژولی می‌خواند که مالکش است — آخرین فیش، سنوات، عیدی نسبی، مرخصی استفاده‌نشده از دفتر مانده، و مانده وام — پس هرگز با سوابقی که خلاصه‌شان می‌کند اختلاف پیدا نمی‌کند. جمع منفی یعنی کارمند به شرکت بدهکار است و منفی نشان داده می‌شود، نه اینکه بی‌صدا صرف‌نظر شود.')}
            </p>
            <Btn onClick={() => { setSetForm({ employeeId: '', endDate: '', reason: '', otherDeductions: '' }); setSetModal(true) }}>
              {L(fa, 'New settlement', 'تسویه‌حساب جدید')}</Btn>
          </Card>

          <DataTable<SettlementRow> tableId="hr-payroll-settlements" rows={settlements} locale={fa ? 'fa' : 'en'}
            columns={[
              { key: 'employeeName', labelEn: 'Employee', labelFa: 'کارمند' },
              { key: 'endDate', labelEn: 'End date', labelFa: 'تاریخ خاتمه',
                render: r => <span className="text-xs" dir="ltr">{r.endDate}</span> },
              { key: 'finalPay', labelEn: 'Final pay', labelFa: 'آخرین فیش', numeric: true,
                render: r => <span className="tabular-nums">{money(r.finalPay)}</span> },
              { key: 'severance', labelEn: 'Severance', labelFa: 'سنوات', numeric: true,
                render: r => <span className="tabular-nums">{money(r.severance)}</span> },
              { key: 'eid', labelEn: 'Eid', labelFa: 'عیدی', numeric: true,
                render: r => <span className="tabular-nums">{money(r.eid)}</span> },
              { key: 'leaveEncashment', labelEn: 'Unused leave', labelFa: 'بازخرید مرخصی', numeric: true,
                render: r => <span className="tabular-nums">
                  {money(r.leaveEncashment)}{r.leaveDays ? ` (${num(r.leaveDays)})` : ''}</span> },
              { key: 'loanOutstanding', labelEn: 'Loan', labelFa: 'مانده وام', numeric: true,
                render: r => <span className="tabular-nums">{money(r.loanOutstanding)}</span> },
              { key: 'total', labelEn: 'Total', labelFa: 'جمع تسویه', numeric: true,
                render: r => <span className={`tabular-nums font-semibold ${(r.total ?? 0) < 0 ? 'text-danger' : 'text-text-primary'}`}>
                  {money(r.total)}</span> },
              { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
                render: r => <Badge color={r.status === 'paid' ? 'green' : r.status === 'approved' ? 'blue' : 'slate'}>
                  {r.status}</Badge> },
            ]}
            rowActions={[
              { id: 'approve', labelEn: 'Approve', labelFa: 'تأیید', icon: '✓',
                hidden: r => r.status !== 'draft',
                onClick: r => post({ action: 'settlement.approve', id: r.id }, 'Approved', 'تأیید شد', loadSettlements) },
              { id: 'post', labelEn: 'Post & close', labelFa: 'ثبت و خاتمه', icon: '📘',
                hidden: r => r.status !== 'approved',
                onClick: r => post({ action: 'settlement.post', id: r.id },
                  'Posted — the employee is now terminated', 'ثبت شد — وضعیت کارمند به ترک خدمت تغییر کرد',
                  () => { loadSettlements(); load() }) },
            ]} />
        </div>
      )}

      {tab === 'exports' && (
        <div className="space-y-4">
          <Card className="p-4">
            <Select label={L(fa, 'Payroll run', 'دورهٔ حقوق')} value={exportPeriod}
              onChange={setExportPeriod}
              options={[{ value: '', label: L(fa, 'Select a run…', 'یک دوره انتخاب کنید…') },
                ...periods.map(p => ({ value: String(p.id), label: `${monthName(p.jalaliMonth)} ${num(p.jalaliYear)}` }))]} />
          </Card>

          {layouts.map(l => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text-primary">{fa ? l.titleFa : l.titleEn}</h3>
                  <p className="text-2xs text-text-tertiary mt-1">
                    {l.columns.map(c => c.labelFa).join(' · ')}
                  </p>
                  {!l.verified && l.note && (
                    <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                      <p className="text-xs text-text-secondary">⚠️ {l.note}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge color={l.verified ? 'green' : 'yellow'}>
                    {l.verified ? L(fa, 'Verified', 'تأییدشده') : L(fa, 'Not verified', 'تأیید نشده')}</Badge>
                  <Btn size="sm" disabled={!exportPeriod}
                    onClick={() => { window.location.href = `/api/admin/hr/payroll?view=export&periodId=${exportPeriod}&layout=${l.key}` }}>
                    {L(fa, 'Download', 'دریافت فایل')}</Btn>
                  {!l.verified && (
                    <Btn size="sm" variant="ghost" onClick={() => post({
                      action: 'export.saveLayout', key: l.key, columns: l.columns,
                      verified: true, note: null,
                    }, 'Marked verified', 'به‌عنوان تأییدشده علامت خورد', loadLayouts)}>
                      {L(fa, 'I checked it against the portal', 'با سامانه تطبیق دادم')}</Btn>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'rulesets' && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm text-text-secondary">
              {L(fa,
                'A rule version is how next year gets built: copy the current one, edit the handful of figures the budget changed, and payroll is correct — no developer involved. Versions exist within a year too, because a circular can change the minimum wage mid-year and a payslip must always name the exact version it was computed with.',
                'نسخهٔ قوانین همان راهی است که سال بعد ساخته می‌شود: نسخهٔ فعلی را کپی کنید، همان چند عددی را که بودجه تغییر داده ویرایش کنید، و حقوق درست محاسبه می‌شود — بدون دخالت توسعه‌دهنده. نسخه‌بندی درون سال هم لازم است، چون بخشنامه ممکن است وسط سال حداقل مزد را عوض کند و هر فیش باید بگوید با کدام نسخه محاسبه شده است.')}
            </p>
          </Card>
          <DataTable<Ruleset> tableId="hr-payroll-rulesets" rows={rulesets} columns={rulesetColumns}
            rowActions={rulesetActions} locale={fa ? 'fa' : 'en'} />
        </div>
      )}

      {tab === 'tax' && (
        <div className="space-y-4">
          <Card className="p-4">{rulesetPicker}</Card>
          {frozenNotice}

          {mismatch && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
              <p className="text-sm text-text-secondary">
                {L(fa,
                  `The stated exemption (${money(mismatch.stated)}) does not match the bracket table, which exempts ${money(mismatch.effective)}. The calculation uses the table — fix the first bracket or the parameter so they agree.`,
                  `معافیت اعلام‌شده (${money(mismatch.stated)}) با جدول پلکان که ${money(mismatch.effective)} را معاف می‌کند هم‌خوان نیست. محاسبه از جدول استفاده می‌کند — پلهٔ اول یا پارامتر را اصلاح کنید تا یکی شوند.`)}
              </p>
            </div>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">{L(fa, 'Tax brackets', 'پلکان مالیاتی')}</h3>
              {editable && <Btn size="sm" variant="ghost" onClick={addBracket}>{L(fa, 'Add a bracket', 'افزودن پله')}</Btn>}
            </div>
            <p className="text-2xs text-text-tertiary mb-3">
              {L(fa,
                'The number of brackets is free — add or remove rows as the law changes. Tax is progressive: each slice of income is taxed at its own rate, so the exemption is simply the first band at zero percent.',
                'تعداد پله‌ها آزاد است — با تغییر قانون ردیف اضافه یا کم کنید. مالیات پلکانی است: هر بخش از درآمد با نرخ خودش محاسبه می‌شود، پس معافیت همان پلهٔ اول با نرخ صفر است.')}
            </p>

            <div className="space-y-2">
              {brackets.map((b, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Input label={i === 0 ? L(fa, 'From', 'از مبلغ') : ''} type="number"
                      value={String(b.fromAmount)} disabled={!editable}
                      onChange={v => setBracket(i, { fromAmount: Number(v || 0) })} />
                  </div>
                  <div className="col-span-4">
                    <Input label={i === 0 ? L(fa, 'To (empty = no limit)', 'تا مبلغ (خالی = بی‌نهایت)') : ''}
                      type="number" value={b.toAmount == null ? '' : String(b.toAmount)} disabled={!editable}
                      onChange={v => setBracket(i, { toAmount: v === '' ? null : Number(v) })} />
                  </div>
                  <div className="col-span-3">
                    <Input label={i === 0 ? L(fa, 'Rate %', 'نرخ ٪') : ''} type="number"
                      value={String(b.ratePercent)} disabled={!editable}
                      onChange={v => setBracket(i, { ratePercent: Number(v || 0) })} />
                  </div>
                  <div className="col-span-1">
                    {editable && brackets.length > 1 && (
                      <Btn size="sm" variant="ghost" onClick={() => removeBracket(i)}>✕</Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {bracketIssues.length > 0 && (
              <ul className="mt-3 space-y-1">
                {bracketIssues.map((iss, i) => (
                  <li key={i} className="text-xs text-danger">
                    {L(fa, `Bracket ${iss.seq}: ${iss.en}`, `پلهٔ ${num(iss.seq)}: ${iss.fa}`)}
                  </li>
                ))}
              </ul>
            )}

            {editable && (
              <div className="flex justify-end mt-3">
                <Btn disabled={bracketIssues.length > 0} onClick={() => post({
                  action: 'brackets.save', rulesetId: selRuleset,
                  rows: brackets.map((b, i) => ({ ...b, seq: i })),
                }, 'Brackets saved', 'پلکان ذخیره شد', () => selRuleset && loadRuleset(selRuleset))}>
                  {L(fa, 'Save brackets', 'ذخیرهٔ پلکان')}
                </Btn>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              {L(fa, 'What would this income pay?', 'این درآمد چقدر مالیات دارد؟')}</h3>
            <p className="text-2xs text-text-tertiary mb-3">
              {L(fa, 'Check the brackets against a real figure before approving them.',
                'پیش از تأیید، پلکان را با یک عدد واقعی بسنجید.')}
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input label={L(fa, 'Taxable income', 'درآمد مشمول مالیات')} type="number"
                  value={previewIncome} onChange={setPreviewIncome} />
              </div>
              <Btn onClick={runPreview}>{L(fa, 'Calculate', 'محاسبه')}</Btn>
            </div>
            {preview && (
              <div className="mt-3 space-y-1">
                {preview.map(r => (
                  <div key={r.seq} className="flex items-center justify-between text-sm rounded-lg border border-subtle px-3 py-2">
                    <span className="text-text-secondary">
                      {money(r.from)} — {r.to == null ? L(fa, 'above', 'به بالا') : money(r.to)} · {num(r.ratePercent)}٪
                    </span>
                    <span className="tabular-nums text-text-secondary">{money(r.amountInBracket)}</span>
                    <span className="tabular-nums font-semibold text-text-primary">{money(r.tax)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-semibold px-3 py-2">
                  <span className="text-text-primary">{L(fa, 'Total tax', 'جمع مالیات')}</span>
                  <span className="tabular-nums text-text-primary">
                    {money(preview.reduce((s, r) => s + r.tax, 0))}</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'insurance' && (
        <div className="space-y-4">
          <Card className="p-4">{rulesetPicker}</Card>
          {frozenNotice}
          {(['insurance', 'labor', 'company', 'tax'] as const).map(group => {
            const rows = params.filter(p => p.group === group)
            if (!rows.length) return null
            return (
              <Card key={group} className="p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  {fa ? GROUP_LABELS[group].fa : GROUP_LABELS[group].en}</h3>
                <div className="space-y-2">
                  {rows.map(p => (
                    <div key={p.id} className="grid grid-cols-12 gap-3 items-center rounded-lg border border-subtle px-3 py-2">
                      <div className="col-span-6">
                        <p className="text-sm text-text-primary">{fa ? p.labelFa : p.labelEn}</p>
                        {p.description && <p className="text-2xs text-text-tertiary mt-0.5">{p.description}</p>}
                      </div>
                      <div className="col-span-4">
                        <Input label="" type="number" value={String(p.value)} disabled={!editable}
                          onChange={v => setParams(list => list.map(x =>
                            x.id === p.id ? { ...x, value: Number(v || 0) } : x))} />
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <span className="text-2xs text-text-tertiary">{p.unit ?? ''}</span>
                        {editable && (
                          <Btn size="sm" variant="ghost" onClick={() => post({
                            action: 'parameter.set', rulesetId: selRuleset, key: p.key, value: p.value,
                          }, 'Saved', 'ذخیره شد', () => selRuleset && loadRuleset(selRuleset))}>
                            {L(fa, 'Save', 'ذخیره')}
                          </Btn>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'earnings' && (
        <div className="space-y-4">
          <Card className="p-4">{rulesetPicker}</Card>
          {frozenNotice}
          <Card className="p-4 flex items-start justify-between gap-4">
            <p className="text-sm text-text-secondary">
              {L(fa,
                'Whether an allowance is insurable or taxable is regulation, and regulation changes — so it lives here as data, never in code. Change a flag and the next calculation follows it. The recurring/non-recurring setting is what the Eid bonus and severance will be based on.',
                'اینکه یک مزایا مشمول بیمه یا مالیات هست یا نه، مقررات است و مقررات تغییر می‌کند — پس همین‌جا داده است، نه در کد. یک پرچم را عوض کنید، محاسبهٔ بعدی از آن پیروی می‌کند. تنظیم مستمر/غیرمستمر همان چیزی است که مبنای عیدی و سنوات خواهد بود.')}
            </p>
            {editable && (
              <Btn onClick={() => { setEarnForm(EMPTY_EARNING); setEarnModal(true) }}>
                {L(fa, 'New earning type', 'قلم حقوقی جدید')}</Btn>
            )}
          </Card>
          <DataTable<EarningRow> tableId="hr-payroll-earnings" rows={earnings} columns={earningColumns}
            rowActions={editable ? earningActions : []} locale={fa ? 'fa' : 'en'} />
        </div>
      )}

      {tab === 'loans' && (
        <DataTable tableId="hr-payroll-loans" rows={loans} locale={fa ? 'fa' : 'en'}
          columns={[
            { key: 'employeeName', labelEn: 'Employee', labelFa: 'کارمند' },
            { key: 'totalAmount', labelEn: 'Loan', labelFa: 'مبلغ وام', numeric: true,
              render: l => <span className="tabular-nums">{money(l.totalAmount)}</span> },
            { key: 'monthlyAmount', labelEn: 'Monthly', labelFa: 'قسط ماهانه', numeric: true,
              render: l => <span className="tabular-nums">{money(l.monthlyAmount)}</span> },
            { key: 'paid', labelEn: 'Repaid', labelFa: 'بازپرداخت‌شده', numeric: true,
              render: l => <span className="tabular-nums">{money(l.paid)}</span> },
            { key: 'outstanding', labelEn: 'Outstanding', labelFa: 'مانده', numeric: true,
              render: l => <span className="tabular-nums font-semibold text-text-primary">{money(l.outstanding)}</span> },
            { key: 'status', labelEn: 'Status', labelFa: 'وضعیت',
              render: l => <Badge color={l.status === 'settled' ? 'green' : 'yellow'}>
                {l.status === 'settled' ? L(fa, 'Settled', 'تسویه‌شده') : L(fa, 'Active', 'جاری')}</Badge> },
          ]} />
      )}



      {/* ── generate bank batch ── */}
      <Modal open={genModal} onClose={() => setGenModal(false)} title={L(fa, 'Generate bank batch', 'تولید دستهٔ بانکی')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Payroll run', 'دورهٔ حقوق')} value={genForm.periodId}
            onChange={v => setGenForm(f => ({ ...f, periodId: v }))}
            options={[{ value: '', label: L(fa, 'Select…', 'انتخاب کنید…') },
              ...periods.filter(p => p.status === 'approved' || p.status === 'paid')
                .map(p => ({ value: String(p.id), label: `${monthName(p.jalaliMonth)} ${num(p.jalaliYear)}` }))]} />
          <Select label={L(fa, 'Bank format', 'فرمت بانک')} value={genForm.formatId}
            onChange={v => setGenForm(f => ({ ...f, formatId: v }))}
            options={[{ value: '', label: L(fa, 'Select…', 'انتخاب کنید…') },
              ...bankFormats.map(f => ({ value: String(f.id), label: `${f.bankName}${f.verified ? '' : ` (${L(fa, 'unverified', 'تأییدنشده')})`}` }))]} />
          <Input label={L(fa, 'Source account', 'شمارهٔ حساب مبدأ')} value={genForm.sourceAccount}
            onChange={v => setGenForm(f => ({ ...f, sourceAccount: v }))} />
          <Input label={L(fa, 'Payment date', 'تاریخ پرداخت')} value={genForm.paymentDate}
            onChange={v => setGenForm(f => ({ ...f, paymentDate: v }))} placeholder="2026-08-01" />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setGenModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!genForm.periodId || !genForm.formatId || !genForm.paymentDate} onClick={async () => {
              const ok = await post({
                action: 'bankBatch.generate', periodId: Number(genForm.periodId),
                formatId: Number(genForm.formatId), sourceAccount: genForm.sourceAccount || null,
                paymentDate: genForm.paymentDate,
              }, 'Batch generated', 'دسته تولید شد', loadBankBatches)
              if (ok) setGenModal(false)
            }}>{L(fa, 'Generate', 'تولید')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── advance ── */}
      <Modal open={advModal} onClose={() => setAdvModal(false)} title={L(fa, 'New advance', 'مساعدهٔ جدید')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Employee', 'کارمند')} value={advForm.employeeId}
            onChange={v => setAdvForm(f => ({ ...f, employeeId: v }))}
            options={[{ value: '', label: L(fa, 'Select an employee…', 'یک کارمند انتخاب کنید…') },
              ...employees.map(e => ({ value: String(e.id), label: e.fullName }))]} />
          <Input label={L(fa, 'Amount', 'مبلغ')} type="number" value={advForm.amount}
            onChange={v => setAdvForm(f => ({ ...f, amount: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Deduct in year', 'کسر در سال')} type="number" value={advForm.deductJalaliYear}
              onChange={v => setAdvForm(f => ({ ...f, deductJalaliYear: v }))} placeholder="1405" />
            <Select label={L(fa, 'Deduct in month', 'کسر در ماه')} value={advForm.deductJalaliMonth}
              onChange={v => setAdvForm(f => ({ ...f, deductJalaliMonth: v }))}
              options={JALALI_MONTHS_FA.map((m, i) => ({ value: String(i + 1), label: fa ? m : JALALI_MONTHS_EN[i] }))} />
          </div>
          <Input label={L(fa, 'Note', 'یادداشت')} value={advForm.note}
            onChange={v => setAdvForm(f => ({ ...f, note: v }))} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setAdvModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!advForm.employeeId || !advForm.amount || !advForm.deductJalaliYear} onClick={async () => {
              const ok = await post({
                action: 'advance.request', employeeId: Number(advForm.employeeId),
                amount: Number(advForm.amount), deductJalaliYear: Number(advForm.deductJalaliYear),
                deductJalaliMonth: Number(advForm.deductJalaliMonth), note: advForm.note || null,
              }, 'Advance requested', 'مساعده ثبت شد', loadAdvances)
              if (ok) setAdvModal(false)
            }}>{L(fa, 'Request', 'ثبت درخواست')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── severance ── */}
      <Modal open={sevModal} onClose={() => setSevModal(false)}
        title={L(fa, 'Calculate severance', 'محاسبهٔ سنوات پایان خدمت')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Employee', 'کارمند')} value={sevForm.employeeId}
            onChange={v => setSevForm(f => ({ ...f, employeeId: v }))}
            options={[{ value: '', label: L(fa, 'Select an employee…', 'یک کارمند انتخاب کنید…') },
              ...employees.map(e => ({ value: String(e.id), label: e.fullName }))]} />
          <Input label={L(fa, 'Last day of service', 'آخرین روز خدمت')} value={sevForm.endDate}
            onChange={v => setSevForm(f => ({ ...f, endDate: v }))} placeholder="2026-08-22" />
          <p className="text-2xs text-text-tertiary">
            {L(fa,
              'A partial year is pro-rated, not rounded down — rounding down to whole years underpays everyone who did not leave on their anniversary.',
              'سال ناقص به تناسب محاسبه می‌شود، نه گرد به پایین — گرد کردن به سال کامل، حق هر کسی را که سرِ سالگرد استخدامش نرفته کم می‌گذارد.')}
          </p>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setSevModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!sevForm.employeeId || !sevForm.endDate} onClick={async () => {
              const ok = await post({
                action: 'severance.calculate', employeeId: Number(sevForm.employeeId),
                endDate: sevForm.endDate,
              }, 'Severance calculated', 'سنوات محاسبه شد', loadSeverance)
              if (ok) setSevModal(false)
            }}>{L(fa, 'Calculate', 'محاسبه')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── settlement ── */}
      <Modal open={setModal} onClose={() => setSetModal(false)}
        title={L(fa, 'Final settlement', 'تسویه‌حساب پایان خدمت')}>
        <div className="space-y-3">
          <Select label={L(fa, 'Employee', 'کارمند')} value={setForm.employeeId}
            onChange={v => setSetForm(f => ({ ...f, employeeId: v }))}
            options={[{ value: '', label: L(fa, 'Select an employee…', 'یک کارمند انتخاب کنید…') },
              ...employees.map(e => ({ value: String(e.id), label: e.fullName }))]} />
          <Input label={L(fa, 'Last day of service', 'آخرین روز خدمت')} value={setForm.endDate}
            onChange={v => setSetForm(f => ({ ...f, endDate: v }))} placeholder="2026-08-22" />
          <Input label={L(fa, 'Reason', 'دلیل خاتمه')} value={setForm.reason}
            onChange={v => setSetForm(f => ({ ...f, reason: v }))} />
          <Input label={L(fa, 'Other deductions', 'سایر کسورات')} type="number"
            value={setForm.otherDeductions}
            onChange={v => setSetForm(f => ({ ...f, otherDeductions: v }))} />
          <p className="text-2xs text-text-tertiary">
            {L(fa,
              'Calculate severance and the Eid bonus FIRST — the settlement collects what already exists rather than recomputing it.',
              'اول سنوات و عیدی را محاسبه کنید — تسویه‌حساب آنچه را که از قبل وجود دارد جمع می‌کند، دوباره حساب نمی‌کند.')}
          </p>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setSetModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!setForm.employeeId || !setForm.endDate} onClick={async () => {
              const ok = await post({
                action: 'settlement.build', employeeId: Number(setForm.employeeId),
                endDate: setForm.endDate, reason: setForm.reason || null,
                otherDeductions: Number(setForm.otherDeductions || 0),
              }, 'Settlement prepared', 'تسویه‌حساب تنظیم شد', loadSettlements)
              if (ok) setSetModal(false)
            }}>{L(fa, 'Prepare', 'تنظیم')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── copy ruleset ── */}
      <Modal open={copyModal} onClose={() => setCopyModal(false)}
        title={L(fa, 'Copy to a new rule version', 'کپی به نسخهٔ جدید قوانین')}>
        <div className="space-y-3">
          <p className="text-2xs text-text-tertiary">
            {L(fa,
              'Every parameter, bracket and earning type is copied. Then you edit only what changed.',
              'همهٔ پارامترها، پلکان‌ها و اقلام حقوقی کپی می‌شوند. بعد فقط آنچه تغییر کرده را ویرایش می‌کنید.')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Year', 'سال')} type="number" value={copyForm.year}
              onChange={v => setCopyForm(f => ({ ...f, year: v }))} placeholder="1406" />
            <Input label={L(fa, 'Version', 'نسخه')} type="number" value={copyForm.version}
              onChange={v => setCopyForm(f => ({ ...f, version: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'In force from', 'از تاریخ')} value={copyForm.effectiveFrom}
              onChange={v => setCopyForm(f => ({ ...f, effectiveFrom: v }))} placeholder="2027-03-21" />
            <Input label={L(fa, 'In force to', 'تا تاریخ')} value={copyForm.effectiveTo}
              onChange={v => setCopyForm(f => ({ ...f, effectiveTo: v }))} placeholder="2028-03-19" />
          </div>
          <Input label={L(fa, 'Source (circular number)', 'منبع (شمارهٔ بخشنامه)')} value={copyForm.source}
            onChange={v => setCopyForm(f => ({ ...f, source: v }))} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCopyModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!copyForm.year || !copyForm.effectiveFrom} onClick={async () => {
              const ok = await post({
                action: 'ruleset.copy', sourceId: selRuleset,
                year: Number(copyForm.year), version: Number(copyForm.version || 1),
                effectiveFrom: copyForm.effectiveFrom,
                effectiveTo: copyForm.effectiveTo || null,
                source: copyForm.source || null,
              }, 'New rule version created', 'نسخهٔ جدید ساخته شد', load)
              if (ok) setCopyModal(false)
            }}>{L(fa, 'Create', 'ساخت')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── open period ── */}
      <Modal open={openModal} onClose={() => setOpenModal(false)}
        title={L(fa, 'Open a payroll month', 'باز کردن دورهٔ حقوق')}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label={L(fa, 'Jalali year', 'سال شمسی')} type="number" value={openForm.jalaliYear}
              onChange={v => setOpenForm(f => ({ ...f, jalaliYear: v }))} placeholder="1405" />
            <Select label={L(fa, 'Month', 'ماه')} value={openForm.jalaliMonth}
              onChange={v => setOpenForm(f => ({ ...f, jalaliMonth: v }))}
              options={JALALI_MONTHS_FA.map((m, i) => ({
                value: String(i + 1), label: fa ? m : JALALI_MONTHS_EN[i],
              }))} />
          </div>
          <p className="text-2xs text-text-tertiary">
            {L(fa,
              'The run is bound to the rule version in force on the first day of that month — later rate changes will not affect it.',
              'دوره به نسخهٔ قوانینِ معتبر در روز اول همان ماه گره می‌خورد — تغییر نرخ‌ها بعداً روی آن اثر نمی‌گذارد.')}
          </p>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setOpenModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!openForm.jalaliYear} onClick={async () => {
              const ok = await post({
                action: 'period.open', jalaliYear: Number(openForm.jalaliYear),
                jalaliMonth: Number(openForm.jalaliMonth),
              }, 'Payroll month opened', 'دوره باز شد', load)
              if (ok) setOpenModal(false)
            }}>{L(fa, 'Open', 'باز کردن')}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── earning type ── */}
      <Modal open={earnModal} onClose={() => setEarnModal(false)} size="lg"
        title={earnForm.id ? L(fa, 'Edit earning type', 'ویرایش قلم حقوقی') : L(fa, 'New earning type', 'قلم حقوقی جدید')}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {/* The key is an ASCII identifier the engine stores, so the example
                is shown as a format hint rather than as English prose. */}
            <Input label={L(fa, 'Key (Latin letters and underscore)', 'کلید (حروف لاتین و زیرخط)')}
              value={earnForm.key} disabled={!!earnForm.id}
              onChange={v => setEarnForm(f => ({ ...f, key: v }))}
              placeholder={L(fa, 'job_allowance', 'job_allowance')} />
            <Input label={L(fa, 'Persian label', 'عنوان فارسی')} value={earnForm.labelFa}
              onChange={v => setEarnForm(f => ({ ...f, labelFa: v }))} />
            <Input label={L(fa, 'English label', 'عنوان انگلیسی')} value={earnForm.labelEn}
              onChange={v => setEarnForm(f => ({ ...f, labelEn: v }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label={L(fa, 'Insurable', 'مشمول بیمه')} value={earnForm.insurable}
              onChange={v => setEarnForm(f => ({ ...f, insurable: v }))}
              options={Object.entries(INCLUSION_LABELS).map(([k, v]) => ({ value: k, label: fa ? v.fa : v.en }))} />
            <Input label={L(fa, 'Insurance cap', 'سقف بیمه')} type="number" value={earnForm.insurableCap}
              onChange={v => setEarnForm(f => ({ ...f, insurableCap: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={L(fa, 'Taxable', 'مشمول مالیات')} value={earnForm.taxable}
              onChange={v => setEarnForm(f => ({ ...f, taxable: v }))}
              options={Object.entries(INCLUSION_LABELS).map(([k, v]) => ({ value: k, label: fa ? v.fa : v.en }))} />
            <Input label={L(fa, 'Tax cap', 'سقف مالیات')} type="number" value={earnForm.taxableCap}
              onChange={v => setEarnForm(f => ({ ...f, taxableCap: v }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label={L(fa, 'Calculation method', 'روش محاسبه')} value={earnForm.calcMethod}
              onChange={v => setEarnForm(f => ({ ...f, calcMethod: v }))}
              options={Object.entries(METHOD_LABELS).map(([k, v]) => ({ value: k, label: fa ? v.fa : v.en }))} />
            <Input label={L(fa, 'Amount / percent', 'مبلغ یا درصد')} type="number" value={earnForm.calcValue}
              onChange={v => setEarnForm(f => ({ ...f, calcValue: v }))} />
          </div>
          <Select label={L(fa, 'Read the amount from a parameter', 'مبلغ از این پارامتر خوانده شود')}
            value={earnForm.paramKey} onChange={v => setEarnForm(f => ({ ...f, paramKey: v }))}
            options={[{ value: '', label: L(fa, 'None — use the amount above', 'هیچ‌کدام — از مبلغ بالا استفاده کن') },
              ...params.map(p => ({ value: p.key, label: fa ? p.labelFa : p.labelEn }))]} />

          <div className="flex flex-wrap gap-4">
            {([
              ['recurring', L(fa, 'Recurring (مستمر)', 'مستمر')],
              ['inEidBase', L(fa, 'Counts towards the Eid bonus', 'وارد مبنای عیدی')],
              ['inSeveranceBase', L(fa, 'Counts towards severance', 'وارد مبنای سنوات')],
              ['inOvertimeBase', L(fa, 'Counts towards the overtime base', 'وارد مبنای اضافه‌کار')],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={Boolean(earnForm[k])}
                  onChange={e => setEarnForm(f => ({ ...f, [k]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setEarnModal(false)}>{L(fa, 'Cancel', 'انصراف')}</Btn>
            <Btn disabled={!earnForm.key.trim() || !earnForm.labelFa.trim() || !earnForm.labelEn.trim()}
              onClick={async () => {
                const ok = await post({
                  action: 'earning.save', rulesetId: selRuleset,
                  ...(earnForm.id ? { id: earnForm.id } : {}),
                  key: earnForm.key, labelFa: earnForm.labelFa, labelEn: earnForm.labelEn,
                  earningGroup: earnForm.earningGroup, recurring: earnForm.recurring,
                  insurable: earnForm.insurable,
                  insurableCap: earnForm.insurableCap === '' ? null : Number(earnForm.insurableCap),
                  taxable: earnForm.taxable,
                  taxableCap: earnForm.taxableCap === '' ? null : Number(earnForm.taxableCap),
                  inEidBase: earnForm.inEidBase, inSeveranceBase: earnForm.inSeveranceBase,
                  inOvertimeBase: earnForm.inOvertimeBase,
                  calcMethod: earnForm.calcMethod, calcValue: Number(earnForm.calcValue || 0),
                  paramKey: earnForm.paramKey || null, sortOrder: Number(earnForm.sortOrder || 50),
                }, 'Saved', 'ذخیره شد', () => selRuleset && loadRuleset(selRuleset))
                if (ok) setEarnModal(false)
              }}>{L(fa, 'Save', 'ذخیره')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
