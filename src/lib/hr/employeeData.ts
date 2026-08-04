/**
 * Phase 28.1 — HR server layer.
 *
 * Two invariants live here rather than in the route, so they cannot be missed
 * by a future endpoint:
 *
 *  · employment history is written by SUPERSEDING, never by UPDATE — the
 *    previous row is closed and a new one opened, inside one transaction
 *  · sensitive columns are stripped from the returned rows unless the caller
 *    holds `hr.employees:sensitive_view`
 */
import { pgQuery } from '@/lib/db'
import { stripFields } from '@/lib/rbac/data'
import {
  supersede, currentEmployment, serviceDays, serviceYears, fullName,
  SENSITIVE_EMPLOYEE_FIELDS, type EmploymentRecord, type ContractType, type EmployeeStatus,
} from './employees'

const NOW = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`

export interface EmployeeRow {
  id: number
  employeeCode: string
  firstName: string
  lastName: string
  fullName: string
  nationalId: string | null
  iban: string | null
  bankAccount: string | null
  insuranceNo: string | null
  birthDate: string | null
  gender: string | null
  maritalStatus: string | null
  childrenCount: number
  mobile: string | null
  email: string | null
  address: string | null
  status: EmployeeStatus
  hireDate: string | null
  endDate: string | null
  departmentId: number | null
  departmentName: string | null
  userId: string | null
  serviceDays: number
  serviceYears: number
  currentSalary: number | null
  currentPosition: string | null
  contractType: ContractType | null
}

export interface EmployeeInputData {
  employeeCode?: string
  firstName: string
  lastName: string
  nationalId?: string | null
  iban?: string | null
  bankAccount?: string | null
  insuranceNo?: string | null
  birthDate?: string | null
  gender?: string | null
  maritalStatus?: string | null
  childrenCount?: number
  mobile?: string | null
  email?: string | null
  address?: string | null
  status?: EmployeeStatus
  hireDate?: string | null
  endDate?: string | null
  departmentId?: number | null
  userId?: string | null
  notes?: string | null
}

/** `EMP-0001`-style code, continuing from the highest existing one. */
export async function nextEmployeeCode(): Promise<string> {
  const r = await pgQuery<{ n: string }>(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_code, '\\D', '', 'g'), '')::int), 0)::text AS n
     FROM hr_employees WHERE employee_code ~ '^EMP-'`)
  return `EMP-${String(Number(r[0]?.n ?? 0) + 1).padStart(4, '0')}`
}

export async function listEmployees(
  opts: { scopeClause?: string; scopeParams?: unknown[]; status?: string; search?: string } = {},
): Promise<EmployeeRow[]> {
  const params: unknown[] = []
  let where = '1=1'
  if (opts.status) { params.push(opts.status); where += ` AND e.status=$${params.length}` }
  if (opts.search) {
    params.push(`%${opts.search}%`)
    where += ` AND (e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length})`
  }
  const rows = await pgQuery<Record<string, unknown>>(
    `SELECT e.id, e.employee_code AS "employeeCode", e.first_name AS "firstName", e.last_name AS "lastName",
            e.national_id AS "nationalId", e.iban, e.bank_account AS "bankAccount",
            e.insurance_no AS "insuranceNo", e.birth_date AS "birthDate", e.gender,
            e.marital_status AS "maritalStatus", e.children_count AS "childrenCount",
            e.mobile, e.email, e.address, e.status, e.hire_date AS "hireDate", e.end_date AS "endDate",
            e.department_id AS "departmentId", e.user_id AS "userId",
            d.name_fa AS "departmentName",
            emp.base_salary::float AS "currentSalary", emp.contract_type AS "contractType",
            p.title_fa AS "currentPosition"
     FROM hr_employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN LATERAL (
       SELECT base_salary, contract_type, position_id FROM hr_employment
       WHERE employee_id = e.id ORDER BY (end_date IS NULL) DESC, start_date DESC LIMIT 1
     ) emp ON true
     LEFT JOIN hr_positions p ON p.id = emp.position_id
     WHERE ${where}${opts.scopeClause ?? ''}
     ORDER BY e.employee_code`,
    [...params, ...(opts.scopeParams ?? [])],
  )
  return rows.map(r => ({
    ...r,
    fullName: fullName({ firstName: r.firstName as string, lastName: r.lastName as string }),
    serviceDays: r.hireDate ? serviceDays(r.hireDate as string, r.endDate as string | null) : 0,
    serviceYears: r.hireDate ? serviceYears(r.hireDate as string, r.endDate as string | null) : 0,
  })) as unknown as EmployeeRow[]
}

/**
 * Remove the sensitive columns unless the caller holds the grant.
 *
 * Stripping happens HERE, on the way out of the data layer, so a new endpoint
 * cannot accidentally return them by forgetting a helper call in the route.
 */
export function applySensitiveScope<T extends Record<string, unknown>>(rows: T[], canSeeSensitive: boolean) {
  return canSeeSensitive ? rows : stripFields(rows, [...SENSITIVE_EMPLOYEE_FIELDS])
}

export async function createEmployee(d: EmployeeInputData, userId: string): Promise<number> {
  const code = d.employeeCode?.trim() || await nextEmployeeCode()
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_employees
       (employee_code, first_name, last_name, national_id, iban, bank_account, insurance_no,
        birth_date, gender, marital_status, children_count, mobile, email, address,
        status, hire_date, end_date, department_id, user_id, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     RETURNING id`,
    [code, d.firstName, d.lastName, d.nationalId || null, d.iban || null, d.bankAccount || null,
      d.insuranceNo || null, d.birthDate || null, d.gender || null, d.maritalStatus || null,
      d.childrenCount ?? 0, d.mobile || null, d.email || null, d.address || null,
      d.status ?? 'active', d.hireDate || null, d.endDate || null,
      d.departmentId ?? null, d.userId || null, d.notes || null, userId],
  ))[0]
  return row.id
}

export async function updateEmployee(id: number, d: Partial<EmployeeInputData>) {
  // COALESCE throughout: a partial update must never blank a field it did not
  // mention (the 26.30 BUG-206 lesson, applied up front).
  await pgQuery(
    `UPDATE hr_employees SET
       first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name),
       national_id = COALESCE($4, national_id), iban = COALESCE($5, iban),
       bank_account = COALESCE($6, bank_account), insurance_no = COALESCE($7, insurance_no),
       birth_date = COALESCE($8, birth_date), gender = COALESCE($9, gender),
       marital_status = COALESCE($10, marital_status), children_count = COALESCE($11, children_count),
       mobile = COALESCE($12, mobile), email = COALESCE($13, email), address = COALESCE($14, address),
       status = COALESCE($15, status), hire_date = COALESCE($16, hire_date),
       end_date = COALESCE($17, end_date), department_id = COALESCE($18, department_id),
       user_id = COALESCE($19, user_id), notes = COALESCE($20, notes),
       updated_at = ${NOW}
     WHERE id=$1`,
    [id, d.firstName ?? null, d.lastName ?? null, d.nationalId ?? null, d.iban ?? null,
      d.bankAccount ?? null, d.insuranceNo ?? null, d.birthDate ?? null, d.gender ?? null,
      d.maritalStatus ?? null, d.childrenCount ?? null, d.mobile ?? null, d.email ?? null,
      d.address ?? null, d.status ?? null, d.hireDate ?? null, d.endDate ?? null,
      d.departmentId ?? null, d.userId ?? null, d.notes ?? null],
  )
}

export async function deleteEmployee(id: number) {
  await pgQuery(`DELETE FROM hr_employees WHERE id=$1`, [id])
}

// ── employment history ──────────────────────────────────────────────────────

export async function employmentHistory(employeeId: number): Promise<(EmploymentRecord & {
  id: number; positionTitle: string | null; managerName: string | null; changeReason: string | null
})[]> {
  return await pgQuery(
    `SELECT h.id, h.start_date AS "startDate", h.end_date AS "endDate",
            h.base_salary::float AS "baseSalary", h.contract_type AS "contractType",
            h.position_id AS "positionId", h.work_location AS "workLocation",
            h.change_reason AS "changeReason",
            p.title_fa AS "positionTitle",
            (m.first_name || ' ' || m.last_name) AS "managerName"
     FROM hr_employment h
     LEFT JOIN hr_positions p ON p.id = h.position_id
     LEFT JOIN hr_employees m ON m.id = h.manager_id
     WHERE h.employee_id=$1
     ORDER BY h.start_date DESC, h.id DESC`, [employeeId]) as never
}

/**
 * Record an employment change.
 *
 * Never an UPDATE: the record in force is CLOSED the day before the new one
 * starts, and a new row is opened — both in one transaction, so no window
 * exists in which two salaries are in force on the same day.
 */
export async function addEmploymentRecord(
  employeeId: number,
  next: { startDate: string; baseSalary: number; contractType: ContractType; positionId?: number | null; managerId?: number | null; workLocation?: string | null; changeReason?: string | null },
  userId: string,
): Promise<{ id: number; closedId?: number }> {
  const history = await employmentHistory(employeeId)
  const plan = supersede(history as EmploymentRecord[], next)

  await pgQuery('BEGIN')
  try {
    if (plan.closeId && plan.closeDate) {
      await pgQuery(`UPDATE hr_employment SET end_date=$2 WHERE id=$1 AND end_date IS NULL`,
        [plan.closeId, plan.closeDate])
    }
    const row = (await pgQuery<{ id: number }>(
      `INSERT INTO hr_employment
         (employee_id, position_id, contract_type, start_date, base_salary,
          work_location, manager_id, change_reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [employeeId, next.positionId ?? null, next.contractType, next.startDate, next.baseSalary,
        next.workLocation ?? null, next.managerId ?? null, next.changeReason ?? null, userId],
    ))[0]
    await pgQuery('COMMIT')
    return { id: row.id, closedId: plan.closeId }
  } catch (e) {
    await pgQuery('ROLLBACK')
    throw e
  }
}

// ── dependents, documents, positions ────────────────────────────────────────

export async function dependentsOf(employeeId: number) {
  return await pgQuery<{ id: number; fullName: string; relation: string; birthDate: string | null; isDependent: number }>(
    `SELECT id, full_name AS "fullName", relation, birth_date AS "birthDate",
            is_dependent AS "isDependent"
     FROM hr_dependents WHERE employee_id=$1 ORDER BY id`, [employeeId])
}

export async function addDependent(
  employeeId: number, d: { fullName: string; relation: string; nationalId?: string | null; birthDate?: string | null },
): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_dependents (employee_id, full_name, relation, national_id, birth_date)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [employeeId, d.fullName, d.relation, d.nationalId ?? null, d.birthDate ?? null]))[0]
  return row.id
}

export async function documentsOf(employeeId: number) {
  return await pgQuery<{ id: number; kind: string; title: string; mediaUrl: string | null; expiresAt: string | null }>(
    `SELECT id, kind, title, media_url AS "mediaUrl", expires_at AS "expiresAt"
     FROM hr_documents WHERE employee_id=$1 ORDER BY id DESC`, [employeeId])
}

export async function listPositions() {
  return await pgQuery<{ id: number; titleEn: string; titleFa: string; departmentId: number | null; level: number }>(
    `SELECT id, title_en AS "titleEn", title_fa AS "titleFa",
            department_id AS "departmentId", level
     FROM hr_positions WHERE active=1 ORDER BY level, id`)
}

export async function createPosition(d: { titleEn: string; titleFa: string; departmentId?: number | null; level?: number }): Promise<number> {
  const row = (await pgQuery<{ id: number }>(
    `INSERT INTO hr_positions (title_en, title_fa, department_id, level) VALUES ($1,$2,$3,$4) RETURNING id`,
    [d.titleEn, d.titleFa, d.departmentId ?? null, d.level ?? 1]))[0]
  return row.id
}

/** The full personnel file — the employee tab set in one call. */
export async function employeeFile(id: number, canSeeSensitive: boolean) {
  const [employee] = applySensitiveScope(await listEmployees() as unknown as Record<string, unknown>[], canSeeSensitive)
    .filter(e => e.id === id) as unknown as EmployeeRow[]
  if (!employee) return null
  return {
    employee,
    employment: await employmentHistory(id),
    dependents: await dependentsOf(id),
    documents: await documentsOf(id),
  }
}

/** Headcount figures for the module header. */
export async function hrOverview() {
  const rows = await pgQuery<{ status: string; n: string }>(
    `SELECT status, count(*)::text AS n FROM hr_employees GROUP BY status`)
  const by = Object.fromEntries(rows.map(r => [r.status, Number(r.n)]))
  return {
    active: by.active ?? 0,
    onLeave: by.on_leave ?? 0,
    terminated: by.terminated ?? 0,
    total: rows.reduce((s, r) => s + Number(r.n), 0),
  }
}

export { currentEmployment }
