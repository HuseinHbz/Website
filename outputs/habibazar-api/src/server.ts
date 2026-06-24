import app from './app';
import { env } from './config/env';
import logger from './lib/logger';
import prisma from './db/prisma';
import http from 'http';

const server = http.createServer(app);

async function start() {
  try {
    // Verify DB connection on startup
    await prisma.$connect();
    logger.info('Database connected');

    server.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV },
        `Habibazar API server running on port ${env.PORT}`,
      );
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server');
    } else {
      logger.info('HTTP server closed');
    }

    try {
      await prisma.$disconnect();
      logger.info('Database disconnected');
    } catch (disconnectErr) {
      logger.error({ err: disconnectErr }, 'Error disconnecting from database');
    }

    process.exit(err ? 1 : 0);
  });

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});

start();
