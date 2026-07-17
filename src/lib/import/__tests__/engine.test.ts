import { describe, it, expect } from 'vitest'
import { parseCsv } from '@/lib/admin/dataTableExport'
import {
  ENTITY_SPECS, templateCsv, autoMapColumns, applyMapping, coerce, validateRecord,
  journalGroupBalanced, approvalTierFor, tierSatisfiedBy, canTransitionJob,
  type EntityType,
} from '../engine'

// ── CSV parsing (reused dataTableExport.parseCsv — exercised for import shapes) ──
describe('CSV parsing (reused parseCsv)', () => {
  it('parses a simple header + rows matrix', () => {
    const m = parseCsv('a,b\n1,2\n3,4')
    expect(m).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })
  it('handles quoted cells with commas', () => {
    const m = parseCsv('name,city\n"Acme, Inc",Tehran')
    expect(m[1][0]).toBe('Acme, Inc')
  })
  it('handles escaped quotes', () => {
    const m = parseCsv('a\n"He said ""hi"""')
    expect(m[1][0]).toBe('He said "hi"')
  })
  it('handles CRLF line endings', () => {
    const m = parseCsv('a,b\r\n1,2\r\n')
    expect(m).toHaveLength(2)
  })
  it('handles quoted cells containing newlines', () => {
    const m = parseCsv('a,b\n"line1\nline2",x')
    expect(m[1][0]).toBe('line1\nline2')
  })
  it('handles Persian content', () => {
    const m = parseCsv('نام,کد\nشرکت آکمه,C1')
    expect(m[1][0]).toBe('شرکت آکمه')
  })
})

// ── Templates ────────────────────────────────────────────────────────────────
describe('templates', () => {
  it('every entity has a spec with at least one required identity/ref field', () => {
    for (const e of Object.keys(ENTITY_SPECS) as EntityType[]) {
      expect(ENTITY_SPECS[e].length).toBeGreaterThan(1)
      expect(ENTITY_SPECS[e].some(f => f.required)).toBe(true)
    }
  })
  it('templateCsv emits the field keys as a header row', () => {
    expect(templateCsv('customer').startsWith('code,name')).toBe(true)
    expect(templateCsv('journal').split(',')).toContain('debit')
  })
})

// ── Auto mapping ─────────────────────────────────────────────────────────────
describe('autoMapColumns', () => {
  it('maps exact field keys', () => {
    const m = autoMapColumns(['code', 'name', 'phone'], 'customer')
    expect(m.code).toBe('code')
    expect(m.name).toBe('name')
    expect(m.phone).toBe('phone')
  })
  it('maps English labels and synonyms (every company Excel is different)', () => {
    const m = autoMapColumns(['Cust_Code', 'Cust_Name', 'MobileNo', 'E-Mail'], 'customer')
    expect(m.code).toBe('Cust_Code')
    expect(m.name).toBe('Cust_Name')
    expect(m.phone).toBe('MobileNo')
    expect(m.email).toBe('E-Mail')
  })
  it('maps Persian labels', () => {
    const m = autoMapColumns(['کد مشتری', 'نام', 'تلفن'], 'customer')
    expect(m.code).toBe('کد مشتری')
    expect(m.name).toBe('نام')
    expect(m.phone).toBe('تلفن')
  })
  it('never claims the same header twice', () => {
    const m = autoMapColumns(['name'], 'product') // could match nameEn only
    const claimed = Object.values(m)
    expect(new Set(claimed).size).toBe(claimed.length)
  })
  it('maps product synonyms (item_code/sale_price)', () => {
    const m = autoMapColumns(['item_code', 'title', 'sale_price'], 'product')
    expect(m.sku).toBe('item_code')
    expect(m.nameEn).toBe('title')
    expect(m.price).toBe('sale_price')
  })
  it('leaves unknown headers unmapped', () => {
    const m = autoMapColumns(['zzz_nothing'], 'customer')
    expect(Object.keys(m)).toHaveLength(0)
  })
})

// ── applyMapping ─────────────────────────────────────────────────────────────
describe('applyMapping', () => {
  it('projects raw headers onto field keys and trims', () => {
    const out = applyMapping({ Cust_Name: '  Acme ', MobileNo: '0912' }, { name: 'Cust_Name', phone: 'MobileNo' })
    expect(out).toEqual({ name: 'Acme', phone: '0912' })
  })
  it('missing source header → empty string', () => {
    expect(applyMapping({}, { name: 'X' }).name).toBe('')
  })
  it('ignores unmapped fields', () => {
    expect(applyMapping({ a: '1' }, { name: '' })).toEqual({})
  })
})

// ── coerce ───────────────────────────────────────────────────────────────────
describe('coerce', () => {
  it('parses numbers incl. thousands separators', () => {
    expect(coerce('number', '1,000,000').value).toBe(1000000)
    expect(coerce('number', '12.5').value).toBe(12.5)
  })
  it('flags non-numbers', () => {
    expect(coerce('number', 'abc').error).toBeTruthy()
  })
  it('booleans accept yes/1/بله', () => {
    expect(coerce('boolean', 'yes').value).toBe(true)
    expect(coerce('boolean', 'بله').value).toBe(true)
    expect(coerce('boolean', 'no').value).toBe(false)
  })
  it('empty → null', () => {
    expect(coerce('number', '').value).toBeNull()
    expect(coerce(undefined, ' ').value).toBeNull()
  })
})

// ── validateRecord ───────────────────────────────────────────────────────────
describe('validateRecord', () => {
  it('valid customer passes', () => {
    const r = validateRecord('customer', { code: 'C1', name: 'Acme', email: 'a@b.com' })
    expect(r.status).toBe('valid')
    expect(r.issues).toHaveLength(0)
  })
  it('missing required → error', () => {
    const r = validateRecord('customer', { name: 'Acme' })
    expect(r.status).toBe('error')
    expect(r.issues.some(i => i.code === 'required' && i.field === 'code')).toBe(true)
  })
  it('invalid national id → error', () => {
    const r = validateRecord('customer', { code: 'C1', name: 'X', nationalId: '1234567890' })
    expect(r.status).toBe('error')
    expect(r.issues.some(i => i.code === 'format' && i.field === 'nationalId')).toBe(true)
  })
  it('valid national id passes the check digit', () => {
    const r = validateRecord('customer', { code: 'C1', name: 'X', nationalId: '0084575948' })
    expect(r.status).toBe('valid')
  })
  it('invalid email → warning (not fatal)', () => {
    const r = validateRecord('customer', { code: 'C1', name: 'X', email: 'nope' })
    expect(r.status).toBe('warning')
  })
  it('bad number type → error', () => {
    const r = validateRecord('customer', { code: 'C1', name: 'X', creditLimit: 'lots' })
    expect(r.status).toBe('error')
    expect(r.issues.some(i => i.code === 'type')).toBe(true)
  })
  it('relationship: unknown product SKU on an inventory row → error', () => {
    const ctx = { refs: { product: new Set(['sku-1']), warehouse: new Set(['wh-1']) } }
    const bad = validateRecord('inventory', { sku: 'SKU-404', warehouse: 'WH-1', qty: '5' }, ctx)
    expect(bad.status).toBe('error')
    expect(bad.issues.some(i => i.code === 'relationship' && i.field === 'sku')).toBe(true)
    const good = validateRecord('inventory', { sku: 'SKU-1', warehouse: 'WH-1', qty: '5' }, ctx)
    expect(good.status).toBe('valid')
  })
  it('duplicate identity blocks under block resolution', () => {
    const ctx = { existing: { code: new Set(['c1']) }, resolution: 'block' as const }
    const r = validateRecord('customer', { code: 'C1', name: 'X' }, ctx)
    expect(r.status).toBe('error')
    expect(r.conflict).toBe(true)
  })
  it('duplicate identity warns under skip/update resolution', () => {
    const skip = validateRecord('customer', { code: 'C1', name: 'X' }, { existing: { code: new Set(['c1']) }, resolution: 'skip' })
    expect(skip.status).toBe('warning')
    expect(skip.conflict).toBe(true)
    const upd = validateRecord('customer', { code: 'C1', name: 'X' }, { existing: { code: new Set(['c1']) }, resolution: 'update' })
    expect(upd.status).toBe('warning')
  })
  it('duplicate detection matches case/whitespace-insensitively (normalizeKey)', () => {
    const r = validateRecord('customer', { code: '  c1 ', name: 'X' }, { existing: { code: new Set(['c1']) }, resolution: 'block' })
    expect(r.conflict).toBe(true)
  })
  it('journal row with both sides → error; one side → valid', () => {
    const both = validateRecord('journal', { ref: 'J1', account: '1010', debit: '10', credit: '10' })
    expect(both.status).toBe('error')
    const one = validateRecord('journal', { ref: 'J1', account: '1010', debit: '10' })
    expect(one.status).toBe('valid')
  })
  it('journal row with neither side → error', () => {
    const r = validateRecord('journal', { ref: 'J1', account: '1010' })
    expect(r.status).toBe('error')
  })
})

// ── journalGroupBalanced ─────────────────────────────────────────────────────
describe('journalGroupBalanced (Dr = Cr)', () => {
  it('balanced group ok', () => {
    const b = journalGroupBalanced([{ debit: 100 }, { credit: 60 }, { credit: 40 }])
    expect(b.ok).toBe(true)
    expect(b.debit).toBe(100)
    expect(b.credit).toBe(100)
  })
  it('unbalanced group rejected', () => {
    expect(journalGroupBalanced([{ debit: 100 }, { credit: 90 }]).ok).toBe(false)
  })
  it('zero group rejected', () => {
    expect(journalGroupBalanced([]).ok).toBe(false)
  })
  it('rounding tolerant to 0.005', () => {
    expect(journalGroupBalanced([{ debit: 10.001 }, { credit: 10.0 }]).ok).toBe(true)
  })
})

// ── Approval tiers ───────────────────────────────────────────────────────────
describe('approvalTierFor + tierSatisfiedBy', () => {
  it('<100 auto · 100–1000 manager · >1000 admin', () => {
    expect(approvalTierFor(99)).toBe('auto')
    expect(approvalTierFor(100)).toBe('manager')
    expect(approvalTierFor(1000)).toBe('manager')
    expect(approvalTierFor(1001)).toBe('admin')
  })
  it('role gates per tier', () => {
    expect(tierSatisfiedBy('auto', 'editor')).toBe(true)
    expect(tierSatisfiedBy('manager', 'editor')).toBe(false)
    expect(tierSatisfiedBy('manager', 'administrator')).toBe(true)
    expect(tierSatisfiedBy('admin', 'administrator')).toBe(false)
    expect(tierSatisfiedBy('admin', 'super_admin')).toBe(true)
  })
})

// ── Job state machine ────────────────────────────────────────────────────────
describe('canTransitionJob', () => {
  it('follows the happy path draft→…→completed', () => {
    expect(canTransitionJob('draft', 'mapping')).toBe(true)
    expect(canTransitionJob('mapping', 'validating')).toBe(true)
    expect(canTransitionJob('validating', 'validated')).toBe(true)
    expect(canTransitionJob('validated', 'approved')).toBe(true)
    expect(canTransitionJob('approved', 'processing')).toBe(true)
    expect(canTransitionJob('processing', 'completed')).toBe(true)
  })
  it('completed can only roll back', () => {
    expect(canTransitionJob('completed', 'rolled_back')).toBe(true)
    expect(canTransitionJob('completed', 'processing')).toBe(false)
  })
  it('cannot skip approval', () => {
    expect(canTransitionJob('validated', 'processing')).toBe(false)
    expect(canTransitionJob('draft', 'completed')).toBe(false)
  })
  it('failed can be re-mapped/re-validated; rolled_back is terminal', () => {
    expect(canTransitionJob('failed', 'validating')).toBe(true)
    expect(canTransitionJob('rolled_back', 'validating')).toBe(false)
  })
})
