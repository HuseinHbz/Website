/**
 * Environment variable validation — runs at startup (server side only).
 * Call validateEnv() in instrumentation.ts or the first DB init.
 */

interface EnvSpec {
  required: string[]
  recommended: string[]
  secretPatterns: RegExp[]
}

const spec: EnvSpec = {
  required: [
    'ADMIN_JWT_SECRET',
  ],
  recommended: [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_API_URL',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'CONTACT_EMAIL',
  ],
  // These must NOT contain their default/example values in production
  secretPatterns: [
    /HBZ-Admin-Secret-Key-2025-Change-In-Production/,
    /change.?me/i,
    /your.?secret/i,
    /example/i,
  ],
}

export function validateEnv(): { ok: boolean; warnings: string[]; errors: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const isProd = process.env.NODE_ENV === 'production'

  for (const key of spec.required) {
    if (!process.env[key]) {
      errors.push(`Missing required env var: ${key}`)
    }
  }

  for (const key of spec.recommended) {
    if (!process.env[key]) {
      warnings.push(`Missing recommended env var: ${key}`)
    }
  }

  if (isProd) {
    const jwtSecret = process.env.ADMIN_JWT_SECRET ?? ''
    for (const pattern of spec.secretPatterns) {
      if (pattern.test(jwtSecret)) {
        errors.push('ADMIN_JWT_SECRET contains a default/example value — replace before production deployment')
        break
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/** Call once at boot — logs warnings, throws on errors in production */
export function assertEnv() {
  const { ok, errors, warnings } = validateEnv()

  for (const w of warnings) {
    console.warn(`[ENV] ⚠ ${w}`)
  }

  if (!ok) {
    for (const e of errors) {
      console.error(`[ENV] ✕ ${e}`)
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`)
    }
  }
}
