/**
 * DataTable export / import — pure engine (Enterprise DataTable Platform).
 *
 * No I/O, no DOM → fully unit-tested. The component wraps these in Blob/download
 * and file-read shells. Export honours the visible/exportable columns; import
 * parses CSV, validates against the column schema, detects duplicates and reports
 * per-row errors so the UI can preview + roll back on failure.
 */
import type { Column, Row } from './dataTable'
import { cellValue } from './dataTable'

/** Stringify a cell for export: null→'', Date→ISO, objects→JSON, else String. */
export function exportCell(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Columns eligible for export (exclude actions / noExport). */
export function exportColumns<T extends object>(columns: Column<T>[]): Column<T>[] {
  return columns.filter(c => !c.noExport && c.key !== '__actions')
}

function csvEscape(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC-4180 CSV (with header row of EN labels). */
export function toCsv<T extends object>(columns: Column<T>[], rows: T[], locale: 'fa' | 'en' = 'en'): string {
  const cols = exportColumns(columns)
  const header = cols.map(c => csvEscape(locale === 'fa' ? c.labelFa : c.labelEn)).join(',')
  const body = rows.map(r => cols.map(c => csvEscape(exportCell(cellValue(c, r)))).join(',')).join('\r\n')
  return body ? `${header}\r\n${body}` : header
}

/** JSON array keyed by column key. */
export function toJson<T extends object>(columns: Column<T>[], rows: T[]): string {
  const cols = exportColumns(columns)
  return JSON.stringify(rows.map(r => Object.fromEntries(cols.map(c => [c.key, cellValue(c, r)]))), null, 2)
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * SpreadsheetML 2003 (.xls) — opens natively in Excel/LibreOffice with no
 * dependency. Numbers are typed as Number cells, everything else as String.
 */
export function toExcelXml<T extends object>(columns: Column<T>[], rows: T[], sheet = 'Sheet1', locale: 'fa' | 'en' = 'en'): string {
  const cols = exportColumns(columns)
  const cell = (v: unknown, numeric?: boolean) => {
    const s = exportCell(v)
    if (numeric && s !== '' && !Number.isNaN(Number(s))) return `<Cell><Data ss:Type="Number">${xmlEscape(s)}</Data></Cell>`
    return `<Cell><Data ss:Type="String">${xmlEscape(s)}</Data></Cell>`
  }
  const head = `<Row>${cols.map(c => cell(locale === 'fa' ? c.labelFa : c.labelEn)).join('')}</Row>`
  const body = rows.map(r => `<Row>${cols.map(c => cell(cellValue(c, r), c.numeric || c.type === 'number')).join('')}</Row>`).join('')
  return `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Worksheet ss:Name="${xmlEscape(sheet)}"><Table>${head}${body}</Table></Worksheet></Workbook>`
}

// ── CSV import (parse → validate → preview) ─────────────────────────────────
/** Minimal RFC-4180 CSV parser (handles quotes, escaped quotes, CRLF/LF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = '', row: string[] = [], inQuotes = false
  const src = text.replace(/^﻿/, '') // strip BOM
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); field = ''; row = []
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''))
}

export interface ImportError { row: number; message: string }
export interface ImportResult<T extends object> { rows: T[]; errors: ImportError[]; duplicates: number[]; headers: string[] }

/**
 * Parse CSV against the column schema. Maps header cells to column keys by EN or
 * FA label (case-insensitive) or raw key; coerces number/boolean; collects
 * per-row validation errors; flags duplicate rows by `dedupeKey`. The caller
 * decides to commit (only when `errors` is empty) or roll back.
 */
export function importCsv<T extends object>(
  text: string, columns: Column<T>[],
  opts: { required?: string[]; dedupeKey?: string } = {},
): ImportResult<T> {
  const matrix = parseCsv(text)
  if (matrix.length === 0) return { rows: [], errors: [{ row: 0, message: 'Empty file' }], duplicates: [], headers: [] }
  const headers = matrix[0].map(h => h.trim())
  const colFor = (h: string) => columns.find(c =>
    c.key.toLowerCase() === h.toLowerCase() || c.labelEn.toLowerCase() === h.toLowerCase() || c.labelFa === h)
  const mapped = headers.map(colFor)
  const errors: ImportError[] = []
  const rows: T[] = []
  const seen = new Map<string, number>()
  const duplicates: number[] = []
  const required = new Set(opts.required ?? [])

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r]
    const obj: Row = {}
    mapped.forEach((col, i) => {
      if (!col) return
      const raw = (cells[i] ?? '').trim()
      if (col.type === 'number') obj[col.key] = raw === '' ? null : Number(raw)
      else if (col.type === 'boolean') obj[col.key] = /^(1|true|yes|on)$/i.test(raw)
      else obj[col.key] = raw
    })
    for (const req of required) {
      const v = obj[req]
      if (v == null || v === '' || (typeof v === 'number' && Number.isNaN(v))) errors.push({ row: r + 1, message: `Missing required "${req}"` })
    }
    for (const col of columns) if (col.type === 'number' && typeof obj[col.key] === 'number' && Number.isNaN(obj[col.key])) errors.push({ row: r + 1, message: `"${col.key}" is not a number` })
    if (opts.dedupeKey) {
      const dk = String(obj[opts.dedupeKey] ?? '').toLowerCase()
      if (dk) { if (seen.has(dk)) duplicates.push(r + 1); else seen.set(dk, r + 1) }
    }
    rows.push(obj as T)
  }
  return { rows, errors, duplicates, headers }
}
