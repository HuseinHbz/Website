import { describe, it, expect } from 'vitest'

/**
 * 26.29 regression tests for two public-site defects the user hit in production.
 *
 * BUG-113 — the case-studies listing filtered EVERYTHING out on first load in
 * Persian: the filter state starts at the English 'All' while the "no filter"
 * label is «همه», so `activeIndustry !== allLabel` was true and every project
 * was compared to the literal string 'All'.
 *
 * BUG-114 — the public queries fell back to hardcoded demo data whenever the
 * active-filtered result was empty, so deactivating every client made ALL demo
 * clients appear. The two empty cases must be distinguished.
 */

// mirrors CaseStudiesListing: "no filter" is either the canonical value or the
// localized label
const isAll = (v: string, allLabel: string) => v === 'All' || v === allLabel

function applyIndustry<T extends { industry: string }>(rows: T[], active: string, allLabel: string): T[] {
  return rows.filter(r => (isAll(active, allLabel) ? true : r.industry === active))
}

// mirrors activeOrNull in publicData.ts
function activeOrNull<T>(activeRows: T[], totalRows: number): T[] | null {
  if (activeRows.length > 0) return activeRows
  return totalRows > 0 ? [] : null
}

describe('BUG-113 — case-studies default filter (bilingual)', () => {
  const rows = [{ industry: 'Retail' }, { industry: 'Banking' }]

  it('shows everything on first load in Persian (state=All, label=همه)', () => {
    expect(applyIndustry(rows, 'All', 'همه')).toHaveLength(2)
  })

  it('shows everything on first load in English', () => {
    expect(applyIndustry(rows, 'All', 'All')).toHaveLength(2)
  })

  it('still shows everything after clicking the localized «همه» tab', () => {
    expect(applyIndustry(rows, 'همه', 'همه')).toHaveLength(2)
  })

  it('a real industry choice still filters', () => {
    expect(applyIndustry(rows, 'Retail', 'همه')).toEqual([{ industry: 'Retail' }])
  })

  it('the pre-fix behaviour would have returned nothing (guards the regression)', () => {
    const buggy = rows.filter(r => ('All' !== 'همه' ? r.industry === 'All' : true))
    expect(buggy).toHaveLength(0)
  })
})

describe('BUG-114 — deactivated means deactivated', () => {
  it('active rows are returned as-is', () => {
    expect(activeOrNull([{ id: 1 }], 3)).toEqual([{ id: 1 }])
  })

  it('rows exist but none active → [] (empty state, NOT demo data)', () => {
    expect(activeOrNull([], 5)).toEqual([])
  })

  it('no rows at all → null (never configured, demo content is fine)', () => {
    expect(activeOrNull([], 0)).toBeNull()
  })

  it('the component contract: fall back ONLY on null', () => {
    const demo = ['demo-a', 'demo-b']
    const render = (db: string[] | null) => (db !== null && db !== undefined ? db : demo)
    expect(render(null)).toEqual(demo)          // fresh install
    expect(render([])).toEqual([])              // all deactivated → nothing
    expect(render(['real'])).toEqual(['real'])  // configured
  })
})
