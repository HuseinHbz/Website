import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import logger from '../lib/logger';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

export async function idempotency(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.headers['idempotency-key'] as string | undefined;

  if (!key) {
    return next();
  }

  // Validate key format
  if (typeof key !== 'string' || key.length > 255) {
    return next();
  }

  try {
    // Check for existing idempotency key
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing && existing.expiresAt > new Date()) {
      // Return cached response
      const cached = existing.response as {
        status: number;
        body: unknown;
      };
      res.status(cached.status).json(cached.body);
      return;
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      const response = originalJson(body);

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000);

        prisma.idempotencyKey
          .upsert({
            where: { key },
            create: {
              key,
              response: { status: res.statusCode, body } as unknown as Prisma.InputJsonValue,
              expiresAt,
            },
            update: {
              response: { status: res.statusCode, body } as unknown as Prisma.InputJsonValue,
              expiresAt,
            },
          })
          .catch((err: unknown) => {
            logger.error({ err }, 'Failed to store idempotency key');
          });
      }

      return response;
    };

    next();
  } catch (err) {
    logger.error({ err }, 'Idempotency middleware error');
    next();
  }
}
