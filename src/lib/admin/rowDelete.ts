/**
 * 26.33 BUG-205 root fix — the shared Delete row action.
 *
 * The reported symptom was "delete does not work" in Events and the Technology
 * catalogue. Measured on the live server, the DELETE endpoints answer 200 and
 * the row really is removed — the API was never the problem. The managers
 * simply never rendered a Delete affordance: their `rowActions` array held only
 * `edit`, so there was nothing to click. Ten modules were in that state (the
 * same class as the 26.29 academy button, recurring at scale).
 *
 * Ten hand-written copies of the same confirm/fetch/toast/reload block is how
 * that class keeps coming back, so this is one helper the managers call.
 *
 * It also carries the 26.29 error contract: a refusal must say WHY. A delete a
 * role is not allowed to perform answers 403, and surfacing the server's own
 * message ("Delete requires an administrator role") is the difference between
 * an understandable permission boundary and a module that looks broken.
 */
import { crud } from '@/lib/admin/crud'
import type { RowAction } from '@/components/admin/DataTable'

/** The toast signature every admin manager already has from `useToast()`. */
type ToastFn = (message: string, kind?: 'success' | 'error' | 'info') => void

export interface DeleteActionOptions<T extends object> {
  /** API path, e.g. `/api/admin/technologies`. */
  path: string
  /** Persian UI? Drives the confirm text and the fallback messages. */
  fa: boolean
  toast: ToastFn
  /** Re-fetch the list after a successful delete. */
  reload: () => void | Promise<void>
  /** Row → id. Defaults to `row.id`. */
  idOf?: (row: T) => number | string
  /** Row → human label used in the confirm prompt. */
  labelOf?: (row: T) => string
  /** Hide the action for specific rows (e.g. a seeded record). */
  hidden?: (row: T) => boolean
}

/** Confirm text — named, so the operator knows exactly what is about to go. */
export function confirmText(fa: boolean, label?: string): string {
  if (fa) return label ? `«${label}» حذف شود؟ این کار برگشت‌پذیر نیست.` : 'این مورد حذف شود؟ این کار برگشت‌پذیر نیست.'
  return label ? `Delete “${label}”? This cannot be undone.` : 'Delete this item? This cannot be undone.'
}

/**
 * Build the standard Delete row action. `requires: 'delete'` lets the DataTable
 * hide it from a role that cannot delete, so the button is not offered and then
 * refused — but the server check remains the authority.
 */
export function deleteRowAction<T extends object>(o: DeleteActionOptions<T>): RowAction<T> {
  const idOf = o.idOf ?? ((row: T) => (row as { id: number | string }).id)
  return {
    id: 'delete',
    labelEn: 'Delete',
    labelFa: 'حذف',
    icon: '🗑',
    danger: true,
    requires: 'delete',
    hidden: o.hidden,
    onClick: async (row: T) => {
      if (!window.confirm(confirmText(o.fa, o.labelOf?.(row)))) return
      const res = await crud.remove(o.path, idOf(row))
      if (res.ok) {
        o.toast(o.fa ? 'حذف شد' : 'Deleted', 'success')
        await o.reload()
        return
      }
      // 26.29 contract: show the server's reason, never a bare "Failed".
      o.toast(await crud.errorOf(res, o.fa ? 'حذف انجام نشد' : 'Delete failed'), 'error')
    },
  }
}
