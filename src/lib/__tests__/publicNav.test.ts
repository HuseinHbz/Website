import { describe, it, expect } from 'vitest'
import { buildNavTree, DEFAULT_HEADER, DEFAULT_FOOTER, type NavNode } from '../navigation'

type Row = Parameters<typeof buildNavTree>[0][number]
const row = (id: number, href: string, sortOrder = 0, parentId: number | null = null): Row => ({
  id, labelEn: `L${id}`, labelFa: `ل${id}`, href, location: 'header', parentId, sortOrder,
})

describe('26.31 بند ۱ — site menu from the database', () => {
  it('R4: an EMPTY table falls back to the built-in menu (site never has no nav)', () => {
    expect(buildNavTree([], DEFAULT_HEADER)).toBe(DEFAULT_HEADER)
    expect(buildNavTree([], DEFAULT_FOOTER)).toBe(DEFAULT_FOOTER)
  })

  it('builds a two-level tree from parent/child rows', () => {
    const tree = buildNavTree([
      row(1, '/', 1),
      row(2, '/services', 2),
      row(3, '/solutions', 1, 2),
      row(4, '/industries', 2, 2),
    ], DEFAULT_HEADER)
    expect(tree).toHaveLength(2)
    expect(tree[0].href).toBe('/')
    expect(tree[0].children).toHaveLength(0)
    expect(tree[1].children.map(c => c.href)).toEqual(['/solutions', '/industries'])
  })

  it('respects sortOrder at both levels, with id as the tiebreaker', () => {
    const tree = buildNavTree([
      row(10, '/b', 2), row(11, '/a', 1),
      row(12, '/a2', 5, 11), row(13, '/a1', 1, 11),
      row(14, '/a3', 5, 11),
    ], DEFAULT_HEADER)
    expect(tree.map(t => t.href)).toEqual(['/a', '/b'])
    expect(tree[0].children.map(c => c.href)).toEqual(['/a1', '/a2', '/a3'])
  })

  it('a child whose parent is missing (e.g. the parent was deactivated) becomes a root — never disappears', () => {
    const tree = buildNavTree([row(5, '/orphan', 1, 999)], DEFAULT_HEADER)
    expect(tree).toHaveLength(1)
    expect(tree[0].href).toBe('/orphan')
  })

  it('uses the DB labels, not the built-in ones (the operator is in control)', () => {
    const tree = buildNavTree([row(7, '/custom', 1)], DEFAULT_HEADER)
    expect(tree[0].labelFa).toBe('ل7')
    expect(tree[0].labelEn).toBe('L7')
  })
})

describe('26.31 بند ۲/۳ — no orphan public page', () => {
  const hrefsOf = (tree: NavNode[]) => tree.flatMap(t => [t.href, ...t.children.map(c => c.href)])

  it('every previously orphaned page is reachable from the header or the footer', () => {
    const reachable = new Set([...hrefsOf(DEFAULT_HEADER), ...hrefsOf(DEFAULT_FOOTER)])
    for (const page of ['/technologies', '/academy', '/events', '/products',
      '/solutions', '/industries', '/docs', '/search', '/projects']) {
      expect(reachable.has(page), `${page} must be linked`).toBe(true)
    }
  })

  it('the original 7 top-level destinations are still present (no regression)', () => {
    const header = new Set(hrefsOf(DEFAULT_HEADER))
    for (const page of ['/', '/about', '/services', '/case-studies', '/blog', '/ai', '/consultation']) {
      expect(header.has(page), `${page} missing from the header`).toBe(true)
    }
  })

  it('the header stays small enough for one row (dropdowns, not 16 links)', () => {
    expect(DEFAULT_HEADER.length).toBeLessThanOrEqual(8)
  })

  it('every dropdown parent links somewhere real (never a dead "#" toggle)', () => {
    for (const item of [...DEFAULT_HEADER, ...DEFAULT_FOOTER]) {
      expect(item.href.startsWith('/')).toBe(true)
    }
  })
})
