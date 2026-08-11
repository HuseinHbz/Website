/**
 * Catalog of the hero's "orbit network" animations — the SVG/CSS-recreated
 * HBZ-hub network visual (src/components/sections/OrbitalNetwork.tsx), kept
 * as its own selectable category (parallel to src/lib/heroBgVideos.ts) per
 * the maintainer's three-part breakdown of the reference clip: text content /
 * orbit animation / background video, each configured independently from
 * `/admin/hero` (HeroCenter — "Templates" tab now hosts this picker instead
 * of the old, unused Phase-23 template gallery).
 *
 * Only one style exists today (matching the reference clip, HBZ-centered).
 * More can be added here later without touching the picker UI or Hero.tsx.
 */
export interface HeroOrbitStyle {
  id: string
  nameEn: string
  nameFa: string
}

export const HERO_ORBIT_STYLES: HeroOrbitStyle[] = [
  { id: 'hbz-orbit', nameEn: 'HBZ Orbit Network', nameFa: 'شبکه مداری HBZ' },
]

export const DEFAULT_ORBIT_STYLE = 'hbz-orbit'

export function heroOrbitStyleById(id: string | null | undefined): HeroOrbitStyle | null {
  if (!id) return null
  return HERO_ORBIT_STYLES.find(s => s.id === id) ?? null
}
