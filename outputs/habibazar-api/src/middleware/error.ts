import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import logger from '../lib/logger';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Known application errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, err.message);
    } else {
      logger.warn({ code: err.code, path: req.path }, err.message);
    }

    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err.details !== undefined) {
      response.error.details = err.details;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn({ code: err.code, meta: err.meta }, 'Prisma error');

    if (err.code === 'P2002') {
      // Unique constraint violation
      const fields = (err.meta?.['target'] as string[]) ?? ['field'];
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: `Duplicate value for: ${fields.join(', ')}`,
        },
      });
      return;
    }

    if (err.code === 'P2025') {
      // Record not found
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
      return;
    }

    if (err.code === 'P2003') {
      // Foreign key constraint
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Referenced resource does not exist',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn({ err }, 'Prisma validation error');
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data provided',
      },
    });
    return;
  }

  // Unknown errors
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
