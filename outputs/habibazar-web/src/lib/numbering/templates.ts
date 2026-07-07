/**
 * Enterprise Numbering Engine — curated starter templates (Phase 21.11, item 3).
 *
 * A pure, static catalogue of common numbering patterns admins can apply as a
 * starting point in the format builder. No I/O; safe to import on client + server.
 */
export interface NumberingTemplate {
  id: string
  nameEn: string; nameFa: string
  pattern: string
  prefix: string
  resetPolicy: 'never' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'fiscal'
  padding: number
  example: string
}

export const NUMBERING_TEMPLATES: NumberingTemplate[] = [
  { id: 'classic_year', nameEn: 'Prefix · Year · Counter', nameFa: 'پیشوند · سال · شمارنده', pattern: '{PREFIX}-{YEAR}-{COUNTER}', prefix: 'INV', resetPolicy: 'yearly', padding: 6, example: 'INV-2026-000001' },
  { id: 'year_month', nameEn: 'Prefix · Year · Month · Counter', nameFa: 'پیشوند · سال · ماه · شمارنده', pattern: '{PREFIX}-{YEAR}{MONTH}-{COUNTER}', prefix: 'PO', resetPolicy: 'monthly', padding: 4, example: 'PO-202607-0001' },
  { id: 'branch_year', nameEn: 'Prefix · Branch · Year · Counter', nameFa: 'پیشوند · شعبه · سال · شمارنده', pattern: '{PREFIX}-{BRANCH}-{YEAR}-{COUNTER}', prefix: 'INV', resetPolicy: 'yearly', padding: 5, example: 'INV-TEH-2026-00001' },
  { id: 'company_branch', nameEn: 'Company · Branch · Counter', nameFa: 'شرکت · شعبه · شمارنده', pattern: '{COMPANY}-{BRANCH}-{COUNTER}', prefix: '', resetPolicy: 'never', padding: 6, example: 'HBZ-TEH-000001' },
  { id: 'warehouse_transfer', nameEn: 'Warehouse Transfer', nameFa: 'انتقال انبار', pattern: '{PREFIX}-{WAREHOUSE}-{YEAR}-{COUNTER}', prefix: 'WRH-TR', resetPolicy: 'yearly', padding: 4, example: 'WRH-TR-WH1-2026-0001' },
  { id: 'daily_seq', nameEn: 'Daily Sequence', nameFa: 'توالی روزانه', pattern: '{PREFIX}-{YEAR}{MONTH}{DAY}-{COUNTER}', prefix: 'TKT', resetPolicy: 'daily', padding: 3, example: 'TKT-20260707-001' },
  { id: 'fiscal_year', nameEn: 'Fiscal Year · Counter', nameFa: 'سال مالی · شمارنده', pattern: '{PREFIX}-{COUNTER}', prefix: 'CTR', resetPolicy: 'fiscal', padding: 5, example: 'CTR-00001' },
  { id: 'project_code', nameEn: 'Project Code', nameFa: 'کد پروژه', pattern: '{PREFIX}-{YEAR}-{COUNTER}', prefix: 'PRJ', resetPolicy: 'yearly', padding: 4, example: 'PRJ-2026-0001' },
]
