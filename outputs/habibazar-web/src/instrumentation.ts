/**
 * Next.js instrumentation hook — runs once on server startup.
 * Validates environment, initializes the database, and performs boot-time checks.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertEnv } = await import('@/lib/env')
    assertEnv()

    const { logger } = await import('@/lib/logger')

    // Initialize the database on startup so the app (and /api/health) works
    // immediately — no need to hit an admin route first to create the schema.
    // Both are idempotent (CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE).
    try {
      const { runMigrations } = await import('@/lib/db/migrate')
      const { seedDatabase } = await import('@/lib/db/seed')
      runMigrations()
      await seedDatabase()
      logger.info('Database initialized')
    } catch (err) {
      logger.error('Database initialization failed', { error: String(err) })
    }

    // Start the internal (cron-free) backup scheduler now the DB is ready.
    try {
      const { scheduler } = await import('@/lib/backup/scheduler')
      scheduler.start()
    } catch (err) {
      logger.error('Backup scheduler failed to start', { error: String(err) })
    }

    // Capture uncaught runtime failures into the real-time log stream.
    try {
      const { logBus } = await import('@/lib/logs/bus')
      process.on('uncaughtException', (e) => logBus.publish({ level: 'error', source: 'system', service: 'runtime', message: `uncaughtException: ${e.message}`, stacktrace: e.stack }))
      process.on('unhandledRejection', (r) => logBus.publish({ level: 'error', source: 'system', service: 'runtime', message: `unhandledRejection: ${String(r)}` }))
    } catch { /* non-fatal */ }

    logger.info('HBZ Platform starting', {
      version: process.env.APP_VERSION ?? '2.0.0',
      env: process.env.NODE_ENV,
      node: process.version,
    })
  }
}
