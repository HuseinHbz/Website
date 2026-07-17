import { describe, it, expect } from 'vitest'
import { buildTree, descendants, canMove, levelOf, treeStats, type CategoryRow } from '../categoryTree'
import { rankSuppliers, gradeOf, bestSupplier, compareSuppliers, type ProductSupplier } from '../supplierRanking'
import { diffValues, hasChanges, restorePayload, compareVersions } from '../versioning'
import { dimensionRollup, isValidEmail, isValidIranNationalId, isValidEconomicCode } from '../quality'

const cat = (id: number, parentId: number | null, level: number, active = 1): CategoryRow =>
  ({ id, parentId, code: `c${id}`, nameEn: `C${id}`, level, sortOrder: 0, active })
// Tree:  1 → 2 → 3 ; 1 → 4 ; 5 (root)
const rows: CategoryRow[] = [cat(1, null, 0), cat(2, 1, 1), cat(3, 2, 2), cat(4, 1, 1), cat(5, null, 0)]

describe('categoryTree (M1)', () => {
  it('builds a nested tree with two roots', () => {
    const t = buildTree(rows)
    expect(t).toHaveLength(2)
    const root1 = t.find(n => n.id === 1)!
    expect(root1.children.map(c => c.id).sort()).toEqual([2, 4])
    expect(root1.children.find(c => c.id === 2)!.children[0].id).toBe(3)
  })
  it('attaches product counts', () => {
    const t = buildTree(rows, { 3: 7 })
    const leaf = t.find(n => n.id === 1)!.children.find(c => c.id === 2)!.children[0]
    expect(leaf.productCount).toBe(7)
  })
  it('lists descendants', () => {
    expect(descendants(rows, 1).sort()).toEqual([2, 3, 4])
    expect(descendants(rows, 2)).toEqual([3])
    expect(descendants(rows, 5)).toEqual([])
  })
  it('allows a legal move and rejects a cycle', () => {
    expect(canMove(rows, 4, 5)).toBe(true)        // 4 under 5 → ok
    expect(canMove(rows, 1, 3)).toBe(false)       // 1 under its own descendant 3 → cycle
    expect(canMove(rows, 2, 2)).toBe(false)       // into itself
    expect(canMove(rows, 3, null)).toBe(true)     // to root
    expect(canMove(rows, 3, 999)).toBe(false)     // non-existent parent
  })
  it('computes level from parent', () => {
    expect(levelOf(rows, null)).toBe(0)
    expect(levelOf(rows, 1)).toBe(1)
    expect(levelOf(rows, 2)).toBe(2)
  })
  it('rolls up tree stats', () => {
    const s = treeStats(rows)
    expect(s.total).toBe(5)
    expect(s.roots).toBe(2)
    expect(s.maxDepth).toBe(3) // 1→2→3
    expect(s.leaves).toBe(3)   // 3, 4, 5
  })
})

const sup = (id: number, supplierId: number, price: number, lead: number, q: number, d: number): ProductSupplier =>
  ({ id, supplierId, purchasePrice: price, leadTimeDays: lead, qualityScore: q, deliveryScore: d })

describe('supplierRanking (M2)', () => {
  const list = [sup(1, 10, 900, 3, 95, 90), sup(2, 20, 850, 10, 80, 70)]
  it('grades by band', () => {
    expect(gradeOf(90)).toBe('A'); expect(gradeOf(75)).toBe('B'); expect(gradeOf(55)).toBe('C'); expect(gradeOf(40)).toBe('D')
  })
  it('ranks and scores suppliers 0..100', () => {
    const r = rankSuppliers(list)
    expect(r).toHaveLength(2)
    expect(r[0].rank).toBe(1)
    expect(r[0].score).toBeGreaterThanOrEqual(r[1].score)
    r.forEach(s => { expect(s.score).toBeGreaterThanOrEqual(0); expect(s.score).toBeLessThanOrEqual(100) })
  })
  it('recommends the best (higher quality+delivery wins here)', () => {
    // Supplier 10 is pricier but far better on lead/quality/delivery.
    expect(bestSupplier(list)!.supplierId).toBe(10)
  })
  it('compares cheapest / fastest / recommended', () => {
    const c = compareSuppliers(list)
    expect(c.cheapest).toBe(20)
    expect(c.fastest).toBe(10)
    expect(c.recommended).toBe(10)
    expect(c.count).toBe(2)
  })
  it('handles an empty list', () => {
    expect(rankSuppliers([])).toEqual([])
    expect(bestSupplier([])).toBeNull()
    expect(compareSuppliers([]).count).toBe(0)
  })
  it('single supplier scores on its own merits (price/lead = 100)', () => {
    const r = rankSuppliers([sup(1, 10, 500, 5, 80, 80)])
    expect(r[0].score).toBe(Math.round((100 * 0.3 + 100 * 0.2 + 80 * 0.3 + 80 * 0.2) * 10) / 10)
  })
})

describe('versioning (M3)', () => {
  const fields = ['price', 'name']
  it('diffs only changed tracked fields', () => {
    const d = diffValues({ price: 1000, name: 'X', extra: 1 }, { price: 900, name: 'X', extra: 2 }, fields)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ field: 'price', old: 1000, new: 900 })
  })
  it('treats numeric/string equivalence as no change', () => {
    expect(diffValues({ price: 1000 }, { price: '1000' }, ['price'])).toHaveLength(0)
  })
  it('hasChanges reflects the diff', () => {
    expect(hasChanges({ price: 1 }, { price: 2 }, ['price'])).toBe(true)
    expect(hasChanges({ price: 1 }, { price: 1 }, ['price'])).toBe(false)
  })
  it('restorePayload parses new_value JSON', () => {
    expect(restorePayload({ newValue: '{"price":900}' })).toEqual({ price: 900 })
    expect(restorePayload({ newValue: null })).toBeNull()
    expect(restorePayload({ newValue: 'not json' })).toBeNull()
  })
  it('compares two versions', () => {
    const changes = compareVersions({ newValue: '{"price":1000}' }, { newValue: '{"price":900}' }, ['price'])
    expect(changes).toHaveLength(1)
    expect(changes[0].field).toBe('price')
  })
})

describe('quality dimensions + validity (M7)', () => {
  it('rolls up weighted dimensions', () => {
    const s = dimensionRollup([
      { dimension: 'completeness', score: 100, issues: 0 },
      { dimension: 'validity', score: 100, issues: 0 },
    ])
    expect(s).toBe(100)
  })
  it('weights completeness above relationship', () => {
    const a = dimensionRollup([{ dimension: 'completeness', score: 100, issues: 0 }, { dimension: 'relationship', score: 0, issues: 1 }])
    const b = dimensionRollup([{ dimension: 'completeness', score: 0, issues: 1 }, { dimension: 'relationship', score: 100, issues: 0 }])
    expect(a).toBeGreaterThan(b)
  })
  it('empty dims → 100', () => { expect(dimensionRollup([])).toBe(100) })
  it('validates email', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail(null)).toBe(false)
  })
  it('validates an Iranian national id with the check digit', () => {
    expect(isValidIranNationalId('0084575948')).toBe(true) // valid check digit
    expect(isValidIranNationalId('1234567890')).toBe(false)
    expect(isValidIranNationalId('1111111111')).toBe(false) // repeated
    expect(isValidIranNationalId('123')).toBe(false)
  })
  it('validates an economic code (11–14 digits)', () => {
    expect(isValidEconomicCode('12345678901')).toBe(true)
    expect(isValidEconomicCode('123')).toBe(false)
    expect(isValidEconomicCode(null)).toBe(false)
  })
})

describe('categoryTree — extra edge cases', () => {
  it('sorts siblings by sortOrder then name', () => {
    const r: CategoryRow[] = [
      { id: 1, parentId: null, code: 'a', nameEn: 'Zeta', level: 0, sortOrder: 2, active: 1 },
      { id: 2, parentId: null, code: 'b', nameEn: 'Alpha', level: 0, sortOrder: 1, active: 1 },
    ]
    expect(buildTree(r).map(n => n.id)).toEqual([2, 1])
  })
  it('orphan (missing parent) becomes a root', () => {
    const r: CategoryRow[] = [{ id: 9, parentId: 404, code: 'x', nameEn: 'X', level: 1, sortOrder: 0, active: 1 }]
    expect(buildTree(r)).toHaveLength(1)
  })
  it('stats count active vs total', () => {
    const r: CategoryRow[] = [cat(1, null, 0, 1), cat(2, 1, 1, 0)]
    expect(treeStats(r).active).toBe(1)
    expect(treeStats(r).total).toBe(2)
  })
  it('empty tree stats', () => {
    const s = treeStats([])
    expect(s.total).toBe(0); expect(s.roots).toBe(0); expect(s.maxDepth).toBe(0)
  })
})

describe('supplierRanking — extra edge cases', () => {
  it('cheapest wins when quality/delivery are equal', () => {
    const r = rankSuppliers([sup(1, 10, 1000, 5, 80, 80), sup(2, 20, 500, 5, 80, 80)])
    expect(r[0].supplierId).toBe(20)
  })
  it('grade boundaries are inclusive at 85/70/50', () => {
    expect(gradeOf(85)).toBe('A'); expect(gradeOf(70)).toBe('B'); expect(gradeOf(50)).toBe('C'); expect(gradeOf(49.9)).toBe('D')
  })
  it('ranks are 1..n contiguous', () => {
    const r = rankSuppliers([sup(1, 10, 900, 3, 95, 90), sup(2, 20, 850, 10, 80, 70), sup(3, 30, 800, 20, 60, 60)])
    expect(r.map(s => s.rank)).toEqual([1, 2, 3])
  })
})

describe('versioning — extra edge cases', () => {
  it('detects multiple changed fields', () => {
    const d = diffValues({ price: 1, name: 'a', active: 1 }, { price: 2, name: 'b', active: 1 }, ['price', 'name', 'active'])
    expect(d.map(c => c.field).sort()).toEqual(['name', 'price'])
  })
  it('null vs empty string is not a change', () => {
    expect(diffValues({ nameFa: null }, { nameFa: '' }, ['nameFa'])).toHaveLength(0)
  })
})
