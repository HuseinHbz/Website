/**
 * 26.31 بند ۱ — SERVER-ONLY loader for the public site menu.
 *
 * The structure/types/pure helpers live in `@/lib/navigation` so client
 * components can import them without dragging the `pg` driver into the browser
 * bundle. This file touches the database and must never be imported by a
 * client component.
 */
import { DEFAULT_HEADER, DEFAULT_FOOTER, buildNavTree, type NavNode, type NavRow } from '@/lib/navigation'

export { DEFAULT_HEADER, DEFAULT_FOOTER, buildNavTree }
export type { NavNode }

/** Load one menu location from the DB. Falls back on empty/error (R4). */
export async function loadPublicNav(location: 'header' | 'footer'): Promise<NavNode[]> {
  const fallback = location === 'header' ? DEFAULT_HEADER : DEFAULT_FOOTER
  try {
    const { pgQuery } = await import('@/lib/db')
    const rows = await pgQuery<NavRow>(
      `SELECT id, label_en AS "labelEn", label_fa AS "labelFa", href, location,
              parent_id AS "parentId", sort_order AS "sortOrder"
       FROM navigation_items
       WHERE active = true AND location = $1
       ORDER BY sort_order, id`, [location])
    return buildNavTree(rows, fallback)
  } catch {
    return fallback   // R4: the site never renders without navigation
  }
}
