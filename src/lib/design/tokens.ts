/**
 * HBZ Design Tokens — single source of truth for values consumed in TypeScript.
 *
 * CSS/Tailwind styling must use the semantic classes wired in tailwind.config.ts
 * (which reference the CSS custom properties in globals.css). This module is for
 * the cases that CANNOT use a class: values passed to JS libraries (recharts,
 * inline SVG data, canvas) and seed/fallback data literals. Never re-inline a raw
 * hex in a component — import from here so the palette stays centralized.
 */

/** Canonical brand palette (mirrors the CSS custom properties in globals.css). */
export const BRAND = {
  indigo: '#6366f1', // --color-brand
  indigoHover: '#4f46e5', // --color-brand-hover
  indigoLight: '#818cf8',
  cyan: '#06b6d4', // --color-accent
  green: '#10b981', // --color-success
  amber: '#f59e0b', // --color-warning
  red: '#ef4444', // --color-danger
} as const

/**
 * Ordered categorical palette for charts, timelines and multi-series accents.
 * Mirrors --color-chart-1..8. Index into this instead of repeating hexes.
 */
export const CHART_PALETTE = [
  BRAND.indigo,
  BRAND.cyan,
  BRAND.green,
  BRAND.amber,
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const

/** Official colors of external platforms — used for social/brand chips only. */
export const SOCIAL_BRAND = {
  linkedin: '#0077b5',
  instagram: '#e1306c',
  telegram: '#0088cc',
  whatsapp: '#25d366',
  github: '#ffffff',
  twitter: '#1da1f2',
} as const

/** Nth categorical color, wrapping around the palette. */
export function chartColor(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length]
}
