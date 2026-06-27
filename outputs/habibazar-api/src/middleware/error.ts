import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import logger from '../lib/logger';

interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
  clientVersion: string;
}

function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'clientVersion' in err &&
    typeof (err as PrismaKnownError).code === 'string'
  );
}

function isPrismaValidationError(err: unknown): err is { message: string; name: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'PrismaClientValidationError'
  );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, err.message);
    } else {
      logger.warn({ code: err.code, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) },
    });
    return;
  }

  if (isPrismaKnownError(err)) {
    logger.warn({ code: err.code, meta: err.meta }, 'Prisma error');
    if (err.code === 'P2002') {
      const fields = (err.meta?.['target'] as string[]) ?? ['field'];
      res.status(409).json({ error: { code: 'CONFLICT', message: `Duplicate value for: ${fields.join(', ')}` } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Referenced resource does not exist' } });
      return;
    }
    res.status(500).json({ error: { code: 'DATABASE_ERROR', message: 'A database error occurred' } });
    return;
  }

  if (isPrismaValidationError(err)) {
    logger.warn({ err }, 'Prisma validation error');
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data provided' } });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}
