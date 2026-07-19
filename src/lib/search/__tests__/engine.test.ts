import { describe, it, expect } from 'vitest'
import { tokenize, scoreField, scoreCandidate, rankHits, groupByModule, editDistance, type SearchCandidate } from '../engine'

describe('tokenize', () => {
  it('lowercases, splits and de-duplicates', () => {
    expect(tokenize('  Acme  acme  Server ')).toEqual(['acme', 'server'])
  })
  it('returns [] for empty input', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('scoreField', () => {
  it('rewards exact > prefix > word-boundary > substring', () => {
    expect(scoreField('acme', ['acme'], 'acme')).toBe(10)
    expect(scoreField('acme corp', ['acme'], 'acme')).toBe(6 + 3) // prefix + word-boundary term
    expect(scoreField('the acme', ['acme'], 'acme')).toBe(3)      // word boundary only
    expect(scoreField('teacment', ['acme'], 'acme')).toBe(1)      // substring only
    expect(scoreField(null, ['acme'], 'acme')).toBe(0)
  })
})

describe('fuzzy / typo tolerance', () => {
  it('matches a small typo via edit distance', () => {
    // "invioce" (transposed) should still score against "invoice"
    expect(scoreField('Invoice register', ['invioce'], 'invioce')).toBeGreaterThan(0)
    // exact/substring still beats fuzzy
    expect(scoreField('invoice', ['invoice'], 'invoice')).toBe(10)
  })
  it('does not fuzzy-match unrelated words', () => {
    expect(scoreField('dashboard', ['xyzzy'], 'xyzzy')).toBe(0)
  })
  it('editDistance is bounded + correct', () => {
    expect(editDistance('invoice', 'invioce', 2)).toBe(2)
    expect(editDistance('abc', 'xyzuvw', 1)).toBe(2) // early-exit cap (max+1)
  })
})

describe('scoreCandidate', () => {
  it('weights title > subtitle > keywords', () => {
    const c: SearchCandidate = { module: 'sales', type: 'customer', id: 1, title: 'Acme', subtitle: 'x', keywords: 'x', url: '/x' }
    // title exact (10*3) + subtitle 0 + keywords 0
    expect(scoreCandidate(c, ['acme'], 'acme')).toBe(30)
  })
})

describe('rankHits', () => {
  const cands: SearchCandidate[] = [
    { module: 'sales', type: 'customer', id: 1, title: 'Acme Corp', url: '/a' },
    { module: 'assets', type: 'asset', id: 2, title: 'Acme Server', subtitle: 'datacenter', url: '/b' },
    { module: 'crm', type: 'lead', id: 3, title: 'Zeta Ltd', url: '/c' },
  ]
  it('ranks by score, drops non-matches', () => {
    const hits = rankHits(cands, 'acme')
    expect(hits).toHaveLength(2)
    expect(hits.every(h => h.title.toLowerCase().includes('acme'))).toBe(true)
  })
  it('returns [] for an empty query', () => {
    expect(rankHits(cands, '   ')).toEqual([])
  })
  it('respects the limit', () => {
    expect(rankHits(cands, 'acme', 1)).toHaveLength(1)
  })
})

describe('groupByModule', () => {
  it('groups ranked hits by module', () => {
    const hits = rankHits([
      { module: 'sales', type: 'customer', id: 1, title: 'Acme Corp', url: '/a' },
      { module: 'assets', type: 'asset', id: 2, title: 'Acme Server', url: '/b' },
    ], 'acme')
    const groups = groupByModule(hits)
    expect(groups.map(g => g.module).sort()).toEqual(['assets', 'sales'])
  })
})
