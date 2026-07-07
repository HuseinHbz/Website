import { describe, it, expect } from 'vitest'
import { canSeeView, visibleViews, isShareScope, shareKeyFor, type SavedViewRow } from '../tableViews'

const base = (o: Partial<SavedViewRow>): SavedViewRow => ({
  id: 1, owner_id: 'owner', table_id: 't', name: 'v', state: '{}', shared_scope: 'private', shared_key: null, is_default: false, ...o,
})
const viewer = { id: 'u2', role: 'editor', department: 'sales' }

describe('canSeeView', () => {
  it('owner always sees own view', () => {
    expect(canSeeView(base({ owner_id: 'u2', shared_scope: 'private' }), viewer)).toBe(true)
  })
  it('private view is hidden from non-owner', () => {
    expect(canSeeView(base({ shared_scope: 'private' }), viewer)).toBe(false)
  })
  it('role/department/global scopes match by key', () => {
    expect(canSeeView(base({ shared_scope: 'global' }), viewer)).toBe(true)
    expect(canSeeView(base({ shared_scope: 'role', shared_key: 'editor' }), viewer)).toBe(true)
    expect(canSeeView(base({ shared_scope: 'role', shared_key: 'administrator' }), viewer)).toBe(false)
    expect(canSeeView(base({ shared_scope: 'department', shared_key: 'sales' }), viewer)).toBe(true)
    expect(canSeeView(base({ shared_scope: 'department', shared_key: 'ops' }), viewer)).toBe(false)
  })
})

describe('helpers', () => {
  it('visibleViews filters, isShareScope validates, shareKeyFor resolves', () => {
    const views = [base({ id: 1, shared_scope: 'global' }), base({ id: 2, shared_scope: 'private' })]
    expect(visibleViews(views, viewer).map(v => v.id)).toEqual([1])
    expect(isShareScope('role')).toBe(true)
    expect(isShareScope('nope')).toBe(false)
    expect(shareKeyFor('role', viewer)).toBe('editor')
    expect(shareKeyFor('department', viewer)).toBe('sales')
    expect(shareKeyFor('global', viewer)).toBe(null)
  })
})
