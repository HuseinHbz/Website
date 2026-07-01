/**
 * Next.js instrumentation hook — runs once on server startup.
 * Validates environment and performs boot-time checks.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertEnv } = await import('@/lib/env')
    assertEnv()

    const { logger } = await import('@/lib/logger')
    logger.info('HBZ Platform starting', {
      version: process.env.APP_VERSION ?? '2.0.0',
      env: process.env.NODE_ENV,
      node: process.version,
    })
  }
}
