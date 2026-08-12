import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MEDIA_LIMITS_MB, OVERALL_MAX_UPLOAD_MB } from '../limits'

describe('MEDIA_LIMITS_MB — single source of truth', () => {
  it('has the expected default per-category limits', () => {
    expect(MEDIA_LIMITS_MB).toEqual({
      backgroundVideo: 25,
      animationVideo: 8,
      image: 5,
      vector: 1,
      general: 100,
    })
  })

  it('OVERALL_MAX_UPLOAD_MB is the largest category + a 10MB margin', () => {
    // general (100) is the largest by design — full documents/ZIPs via the
    // legacy media path, a real pre-existing allowance, not Hero video.
    expect(OVERALL_MAX_UPLOAD_MB).toBe(110)
  })
})

describe('cross-language consistency (26.34 бند۲) — next.config.ts and nginx must never drift from this module', () => {
  const projectRoot = fileURLToPath(new URL('../../../..', import.meta.url))

  it('next.config.ts imports OVERALL_MAX_UPLOAD_MB directly (no hand-copied number)', () => {
    const src = readFileSync(`${projectRoot}/next.config.ts`, 'utf8')
    expect(src).toContain("import { OVERALL_MAX_UPLOAD_MB } from './src/lib/media/limits'")
    expect(src).toContain('middlewareClientMaxBodySize: `${OVERALL_MAX_UPLOAD_MB}mb`')
    // No leftover hardcoded '100mb'/'30mb'-style literal for this setting.
    expect(src).not.toMatch(/middlewareClientMaxBodySize:\s*['"]\d+mb['"]/)
  })

  it('render-nginx.sh reads the exact same env var names with the exact same fallback defaults', () => {
    const src = readFileSync(`${projectRoot}/deploy/nginx/render-nginx.sh`, 'utf8')
    const expected: [string, number][] = [
      ['MEDIA_MAX_BACKGROUND_VIDEO_MB', 25],
      ['MEDIA_MAX_ANIMATION_VIDEO_MB', 8],
      ['MEDIA_MAX_IMAGE_MB', 5],
      ['MEDIA_MAX_VECTOR_MB', 1],
      ['MEDIA_MAX_GENERAL_MB', 100],
    ]
    for (const [envName, fallback] of expected) {
      expect(src).toContain(`readenv ${envName} ${fallback}`)
      // The TS default for this exact env var must match the bash fallback —
      // if someone changes one without the other, this line fails.
      const tsKey = { MEDIA_MAX_BACKGROUND_VIDEO_MB: 'backgroundVideo', MEDIA_MAX_ANIMATION_VIDEO_MB: 'animationVideo', MEDIA_MAX_IMAGE_MB: 'image', MEDIA_MAX_VECTOR_MB: 'vector', MEDIA_MAX_GENERAL_MB: 'general' }[envName] as keyof typeof MEDIA_LIMITS_MB
      expect(MEDIA_LIMITS_MB[tsKey]).toBe(fallback)
    }
    // Same "largest + 10" formula in bash as OVERALL_MAX_UPLOAD_MB in TS.
    expect(src).toContain('MAX_UPLOAD_MB=$((MAX_UPLOAD_MB + 10))')
  })

  it('the nginx template substitutes the computed value — no hardcoded client_max_body_size', () => {
    const src = readFileSync(`${projectRoot}/deploy/nginx/habibazar.conf.template`, 'utf8')
    expect(src).toContain('client_max_body_size {{MAX_UPLOAD_MB}}m;')
    expect(src).not.toMatch(/client_max_body_size\s+\d+M;/)
  })
})
