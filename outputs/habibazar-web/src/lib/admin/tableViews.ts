/**
 * Saved-view visibility — pure (Enterprise DataTable Platform).
 *
 * A saved view is owned by a user and may be shared to their role, their
 * department, or globally. This decides which views a given user may see. No I/O
 * → unit-tested; the API route uses it to filter DB rows.
 */
export type ShareScope = 'private' | 'role' | 'department' | 'global'

export interface SavedViewRow {
  id: number
  owner_id: string
  table_id: string
  name: string
  state: string
  shared_scope: ShareScope
  shared_key: string | null
  is_default: boolean
}

export interface ViewViewer { id: string; role: string; department?: string | null }

export function isShareScope(s: string): s is ShareScope {
  return s === 'private' || s === 'role' || s === 'department' || s === 'global'
}

/** Can this viewer see this view? Owner always; else by share scope + key. */
export function canSeeView(v: SavedViewRow, u: ViewViewer): boolean {
  if (v.owner_id === u.id) return true
  switch (v.shared_scope) {
    case 'global': return true
    case 'role': return v.shared_key === u.role
    case 'department': return !!u.department && v.shared_key === u.department
    default: return false
  }
}

/** Filter a list of views to those the viewer may see. */
export function visibleViews(views: SavedViewRow[], u: ViewViewer): SavedViewRow[] {
  return views.filter(v => canSeeView(v, u))
}

/** The share key implied by a scope for a given user (role/department name). */
export function shareKeyFor(scope: ShareScope, u: ViewViewer): string | null {
  if (scope === 'role') return u.role
  if (scope === 'department') return u.department ?? null
  return null
}
