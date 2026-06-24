import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';

import { env } from './config/env';
import logger from './lib/logger';
import prisma from './db/prisma';
import { errorHandler } from './middleware/error';
import { authenticate } from './middleware/authenticate';
import { csrfMiddleware } from './middleware/csrf';

import authRouter from './modules/auth/auth.router';
import adminRouter from './modules/admin/admin.router';
import publicRouter from './modules/public/public.router';
import aiRouter from './modules/ai/ai.routes';

const app = express();

// Trust proxy for correct IP detection behind load balancer
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
);

// CORS
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'Idempotency-Key',
      'X-Request-ID',
    ],
  }),
);

// Cookie parser
app.use(cookieParser());

// JSON body parser (1MB limit)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// HTTP request logging with request ID
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => {
      const existing = req.headers['x-request-id'] as string | undefined;
      return existing ?? uuidv4();
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
    ],
  }),
);

// ─── Health checks ────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth routes (no CSRF - uses Bearer tokens)
app.use('/api/v1/auth', authRouter);

// Admin routes (require auth + CSRF)
app.use('/api/v1/admin', authenticate, csrfMiddleware, adminRouter);

// AI routes (public with rate limiting)
app.use('/api/v1/ai', aiRouter);

// Public routes
app.use('/api/v1', publicRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
