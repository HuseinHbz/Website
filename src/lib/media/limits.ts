/**
 * SINGLE SOURCE OF TRUTH for every upload size limit in the app (26.34
 * bند۲ — the previous pass set Next.js's middleware body cap to a flat
 * 100MB with no real justification; this replaces that with a value
 * DERIVED from the actual configured category limits, so the two can
 * never silently drift apart again).
 *
 * Every number here is env-overridable with the SAME env var name used
 * everywhere else in the codebase (validate.ts, the media route, the
 * diagnostics script, and this module all read the identical names) —
 * changing one env var changes the real enforced limit everywhere at
 * once instead of requiring a hunt across files.
 */
function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  const n = v ? parseInt(v, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Per-category limits in MB. `general` covers the LEGACY upload path
 *  (avatars/clients/blog/certifications/full documents & ZIPs via the
 *  Media Manager) — deliberately the highest of the set because it's the
 *  only category that ever accepts a whole document/archive rather than
 *  a single compressed image or a short clip. This is the reason the
 *  overall middleware cap below can't just be "25MB + a margin" — the
 *  app's own real largest legitimate upload is bigger than that. */
export const MEDIA_LIMITS_MB = {
  backgroundVideo: envInt('MEDIA_MAX_BACKGROUND_VIDEO_MB', 25),
  animationVideo: envInt('MEDIA_MAX_ANIMATION_VIDEO_MB', 8),
  image: envInt('MEDIA_MAX_IMAGE_MB', 5),
  vector: envInt('MEDIA_MAX_VECTOR_MB', 1),
  general: envInt('MEDIA_MAX_GENERAL_MB', 100),
} as const

/** The single number every OTHER layer (Next.js middleware, the nginx
 *  reverse-proxy template, the diagnostics script's expectation) should
 *  be checked against — the largest configured category limit plus a
 *  fixed 10MB margin for multipart/form-data framing overhead (field
 *  boundaries, headers, the bilingual name/alt/description text fields
 *  sent alongside the file). Never hand-typed elsewhere; every consumer
 *  either imports this (TypeScript code) or is verified against it by a
 *  test (next.config.mjs and the nginx template, which run outside the
 *  TS module graph and can't literally `import` this file). */
export const OVERALL_MAX_UPLOAD_MB = Math.max(...Object.values(MEDIA_LIMITS_MB)) + 10

export type MediaLimitCategory = keyof typeof MEDIA_LIMITS_MB
